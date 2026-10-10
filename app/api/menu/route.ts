import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTodayString, getOffsetDateString, APP_TIMEZONE, isDeadlinePassed } from '@/lib/utils';
import { evaluateAllergyConflict, getSystemSetting } from '@/lib/allergy';

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

    let whereClause: any = { isActive: true };
    const targetDate = date || (!startDate && !endDate ? getTodayString() : null);

    if (date) {
      whereClause.date = date;
    } else if (startDate && endDate) {
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      };
    } else {
      whereClause.date = getTodayString();
    }

    const tomorrowStr = getOffsetDateString(1, APP_TIMEZONE);
    if (targetDate === tomorrowStr || whereClause.date === tomorrowStr) {
      try {
        const { ensureTomorrowMenuReset } = await import('@/lib/menu-schedule');
        await ensureTomorrowMenuReset(tomorrowStr);
      } catch {
        // ignore
      }
    }

    const allowAllergyOrdersSettingPromise = getSystemSetting('ALLOW_ALLERGY_ORDERS', 'true');

    // Authoritative real-time query (no stale in-memory cache)
    const menus = await prisma.menu.findMany({
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

    const allowAllergyOrdersSetting = await allowAllergyOrdersSettingPromise;
    const allowAllergyOrders = allowAllergyOrdersSetting === 'true';

    // Optimize: Fetch child allergies ONCE instead of re-fetching in a loop per meal!
    let studentAllergiesList: string[] = [];
    let studentName = '';
    if (childId) {
      const student = await prisma.student.findUnique({
        where: { id: childId },
        include: {
          studentAllergies: { include: { allergy: true } },
        },
      });
      if (student) {
        studentName = student.name;
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

    const evaluatedMenus = menus.map((item) => {
      const allergensList = (item.meal.mealAllergens || []).map((ma: any) => ma.allergen?.name).filter(Boolean);
      if (item.meal.allergens && allergensList.length === 0) {
        item.meal.allergens.split(/[,;]/).forEach((p: string) => {
          const t = p.trim();
          if (t && !allergensList.includes(t)) allergensList.push(t);
        });
      }

      let allergyEvaluation = {
        hasConflict: false,
        matchingAllergens: [] as string[],
        childName: studentName || undefined,
        mealName: item.meal.name,
      };

      if (childId && studentAllergiesList.length > 0) {
        const conflictRes = evaluateAllergyConflict(studentAllergiesList, allergensList, studentName, item.meal.name);
        allergyEvaluation = {
          hasConflict: conflictRes.hasConflict,
          matchingAllergens: conflictRes.matchingAllergens,
          childName: studentName || undefined,
          mealName: item.meal.name,
        };
      }

      const deadlinePassed = isDeadlinePassed(item.date, item.orderingDeadline || '08:30');
      const isAvailable = Boolean(item.isActive) && (item.availableQuantity > 0) && !deadlinePassed;

      return {
        ...item,
        isAvailable,
        isDeadlinePassed: deadlinePassed,
        meal: {
          ...item.meal,
          allergensList,
          imageUrl: null, // No photo
        },
        allergyEvaluation,
      };
    });

    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };

    return NextResponse.json(
      {
        menus: evaluatedMenus,
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
