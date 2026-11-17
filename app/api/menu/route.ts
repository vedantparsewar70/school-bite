import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTodayString, APP_TIMEZONE, isDeadlinePassed } from '@/lib/utils';
import { evaluateAllergyConflict, getSystemSetting } from '@/lib/allergy';
import { getCurrentUser } from '@/lib/auth';
import { getStudentCategory } from '@/lib/student-category';
import { displayMenuEntry, type MenuEntryLike } from '@/lib/menu-entries';
import { extrasOn, MAX_EXTRA_PER_CHILD } from '@/lib/menu-extras';
import { deadlineFor, type MenuEntry } from '@/lib/menu-orders';
import { normalizeStudentCategory } from '@/lib/menu-stock';
import { brunchPriceFor, dishPrice } from '@/lib/brunch-prices';
import { getBrunchPrices } from '@/lib/brunch-prices-server';

export function clearMenuCache() {
  // Authoritative database querying is always real-time
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const childId = searchParams.get('childId');
    const categoryParam = searchParams.get('category') || searchParams.get('studentCategory');
    const includeHolidays = searchParams.get('includeHolidays') !== 'false';

    let whereClause: any = {};
    if (!includeHolidays) {
      whereClause.isActive = true;
    }

    const todayStr = getTodayString(APP_TIMEZONE);

    if (date) {
      whereClause.date = date;
    } else if (startDate && endDate) {
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      };
    } else {
      whereClause.date = todayStr;
    }

    const allowAllergyOrdersSettingPromise = getSystemSetting('ALLOW_ALLERGY_ORDERS', 'true');
    const brunchPricesPromise = getBrunchPrices();

    // Optimize: Fetch child allergies and student category
    let studentAllergiesList: string[] = [];
    let studentName = '';
    let derivedStudentCategory: string | null = null;
    if (childId) {
      const student = await prisma.student.findUnique({
        where: { id: childId },
        include: {
          studentAllergies: { include: { allergy: true } },
        },
      });
      // A child's name and allergies are private: only that child's parent (or staff) may see them.
      const viewer = await getCurrentUser(req);
      const mayView =
        viewer && (viewer.role === 'STAFF' || viewer.role === 'ADMIN' || (student && viewer.parentId === student.parentId));
      if (student && !mayView) {
        return NextResponse.json({ error: 'Child not found' }, { status: 404 });
      }
      if (student) {
        studentName = student.name;
        derivedStudentCategory = getStudentCategory(student.grade, (student as any).studentCategory);
        if (student.studentAllergies && student.studentAllergies.length > 0) {
          student.studentAllergies.forEach((sa: any) => {
            if (sa.allergy?.name) studentAllergiesList.push(sa.allergy.name);
            if (sa.customNote) studentAllergiesList.push(sa.customNote);
          });
        }
        if (student.allergies) {
          student.allergies.split(/[,;]/).forEach((part: string) => {
            const clean = part.trim();
            if (clean && !studentAllergiesList.includes(clean)) {
              studentAllergiesList.push(clean);
            }
          });
        }
      }
    }

    const filterCategory = categoryParam || derivedStudentCategory;
    if (filterCategory) {
      whereClause.studentCategory = {
        in: [filterCategory, 'ALL'],
      };
    }

    // Authoritative real-time query
    const allMenus = await prisma.menu.findMany({
      where: whereClause,
      include: {
        meal: {
          include: {
            mealAllergens: {
              include: { allergen: true },
            },
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { meal: { category: 'asc' } },
        { meal: { name: 'asc' } },
      ],
    });

    // One dish per date and category: if several tools left entries for the same day, parents see
    // only the one that checkout accepts (lib/menu-entries.ts).
    const menus = filterCategory
      ? allMenus.filter((m) => displayMenuEntry(allMenus as MenuEntryLike[], m.date, filterCategory)?.id === m.id)
      : allMenus;

    const allowAllergyOrdersSetting = await allowAllergyOrdersSettingPromise;
    const allowAllergyOrders = allowAllergyOrdersSetting === 'true';
    const brunchPrices = await brunchPricesPromise;
    // The main brunch price is the class price: the child's class, else the requested class, else the
    // entry's own class (an older entry shared by 'ALL' classes has no single price without a class).
    const viewCategory = filterCategory ? normalizeStudentCategory(filterCategory) : null;
    const mainPriceFor = (entryCategory: unknown) =>
      brunchPriceFor(viewCategory && viewCategory !== 'ALL' ? viewCategory : normalizeStudentCategory(String(entryCategory || 'ALL')), brunchPrices);

    const evaluatedMenus = menus.map((item) => {
      const isHoliday = Boolean((item as any).isHoliday);
      const isPastDate = item.date < todayStr;
      const deadlinePassed = isPastDate || isDeadlinePassed(item.date, item.orderingDeadline || '08:30');
      const isAvailable = Boolean(item.isActive) && !isHoliday && !isPastDate && (item.availableQuantity > 0) && !deadlinePassed;

      if (isHoliday) {
        return {
          ...item,
          studentCategory: (item as any).studentCategory || 'ALL',
          isHoliday: true,
          holidayReason: (item as any).holidayReason || 'Holiday Today — No Brunch Scheduled',
          isPastDate,
          isAvailable: false,
          isDeadlinePassed: deadlinePassed,
          meal: null,
          allergyEvaluation: {
            hasConflict: false,
            matchingAllergens: [],
            childName: studentName || undefined,
            mealName: 'Holiday',
          },
        };
      }

      // An entry whose dish was deleted is not shown at all (never a made-up dish or price).
      if (!item.meal) return null;
      const mealObj = item.meal;

      const allergensList = ((mealObj as any).mealAllergens || []).map((ma: any) => ma.allergen?.name).filter(Boolean);
      if ((mealObj as any).allergens && allergensList.length === 0) {
        (mealObj as any).allergens.split(/[,;]/).forEach((p: string) => {
          const t = p.trim();
          if (t && !allergensList.includes(t)) allergensList.push(t);
        });
      }

      let allergyEvaluation = {
        hasConflict: false,
        matchingAllergens: [] as string[],
        childName: studentName || undefined,
        mealName: mealObj.name,
      };

      if (childId && studentAllergiesList.length > 0) {
        const conflictRes = evaluateAllergyConflict(studentAllergiesList, allergensList, studentName, mealObj.name);
        allergyEvaluation = {
          hasConflict: conflictRes.hasConflict,
          matchingAllergens: conflictRes.matchingAllergens,
          childName: studentName || undefined,
          mealName: mealObj.name,
        };
      }

      return {
        ...item,
        studentCategory: (item as any).studentCategory || 'ALL',
        isHoliday: false,
        holidayReason: null,
        isPastDate,
        isAvailable,
        isDeadlinePassed: deadlinePassed,
        meal: {
          ...mealObj,
          price: mainPriceFor((item as any).studentCategory),
          allergensList,
          imageUrl: null, // No photo
        },
        allergyEvaluation,
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    // Optional extras for one date and class, shown under the main brunch (lib/menu-extras.ts).
    let extras: any[] = [];
    if (date && filterCategory && normalizeStudentCategory(filterCategory) !== 'ALL') {
      const cat = normalizeStudentCategory(filterCategory);
      const main = evaluatedMenus.find((m: any) => m.date === date);
      const onDay = (await extrasOn([date])).filter((e) => e.isActive !== false && normalizeStudentCategory(e.studentCategory) === cat);
      if (onDay.length > 0 && main && !main.isHoliday) {
        const extraMeals = await prisma.meal.findMany({
          where: { id: { in: Array.from(new Set(onDay.map((e) => e.mealId))) } },
          include: { mealAllergens: { include: { allergen: true } } },
        });
        const byId = new Map(extraMeals.map((m: any) => [m.id, m]));
        const deadline = deadlineFor(allMenus as unknown as MenuEntry[], date, cat);
        const deadlinePassed = date < todayStr || isDeadlinePassed(date, deadline);
        extras = onDay
          // An extra is sold at its dish's own price; a dish with no price is not offered.
          .filter((e) => byId.has(e.mealId) && dishPrice(byId.get(e.mealId)) !== null)
          .map((e) => {
            const meal: any = byId.get(e.mealId);
            const allergensList = (meal.mealAllergens || []).map((ma: any) => ma.allergen?.name).filter(Boolean);
            if (meal.allergens && allergensList.length === 0) {
              String(meal.allergens).split(/[,;]/).forEach((p: string) => {
                const t = p.trim();
                if (t && !allergensList.includes(t)) allergensList.push(t);
              });
            }
            const conflict =
              childId && studentAllergiesList.length > 0
                ? evaluateAllergyConflict(studentAllergiesList, allergensList, studentName, meal.name)
                : { hasConflict: false, matchingAllergens: [] as string[] };
            const availableQuantity = Number(e.availableQuantity ?? 0);
            return {
              id: e.id,
              date,
              studentCategory: cat,
              mealId: e.mealId,
              orderingDeadline: deadline,
              availableQuantity,
              maxPerChild: MAX_EXTRA_PER_CHILD,
              isAvailable: !deadlinePassed && availableQuantity > 0,
              isDeadlinePassed: deadlinePassed,
              meal: {
                id: meal.id,
                name: meal.name,
                price: dishPrice(meal),
                category: meal.category,
                isVegetarian: meal.isVegetarian !== false,
                description: meal.description || null,
                allergens: meal.allergens || null,
                allergensList,
                imageUrl: null,
              },
              allergyEvaluation: {
                hasConflict: conflict.hasConflict,
                matchingAllergens: conflict.matchingAllergens,
                childName: studentName || undefined,
                mealName: meal.name,
              },
            };
          })
          .sort((a, b) => a.meal.name.localeCompare(b.meal.name));
      }
    }

    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };

    return NextResponse.json(
      {
        menus: evaluatedMenus,
        extras,
        policy: {
          allowAllergyOrders,
        },
      },
      { headers }
    );
  } catch (error) {
    console.error('Error fetching menus:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}
