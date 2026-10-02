import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTodayString } from '@/lib/utils';
import { checkMealAllergy, getSystemSetting } from '@/lib/allergy';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const childId = searchParams.get('childId');

    let whereClause: any = { isActive: true };

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

    const [menus, allowAllergyOrdersSetting] = await Promise.all([
      prisma.menu.findMany({
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
      }),
      getSystemSetting('ALLOW_ALLERGY_ORDERS', 'true'),
    ]);

    const allowAllergyOrders = allowAllergyOrdersSetting === 'true';

    // If childId is provided, evaluate allergy conflicts for each meal
    const evaluatedMenus = await Promise.all(
      menus.map(async (item) => {
        let allergyEvaluation = {
          hasConflict: false,
          matchingAllergens: [] as string[],
        };

        if (childId) {
          allergyEvaluation = await checkMealAllergy(childId, item.meal.id);
        }

        const allergensList = item.meal.mealAllergens.map((ma) => ma.allergen.name);
        if (item.meal.allergens && allergensList.length === 0) {
          item.meal.allergens.split(/[,;]/).forEach((p) => {
            const t = p.trim();
            if (t && !allergensList.includes(t)) allergensList.push(t);
          });
        }

        return {
          ...item,
          meal: {
            ...item.meal,
            allergensList,
            imageUrl: null, // No photo
          },
          allergyEvaluation,
        };
      })
    );

    return NextResponse.json({
      menus: evaluatedMenus,
      policy: {
        allowAllergyOrders,
      },
    });
  } catch (error) {
    console.error('Error fetching menus:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}
