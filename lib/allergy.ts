import prisma from '@/lib/prisma';

export interface AllergyCheckResult {
  hasConflict: boolean;
  matchingAllergens: string[];
  childName?: string;
  mealName?: string;
}

// Synonyms / groupings for accurate allergy matching
const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  milk: ['milk', 'dairy', 'lactose', 'cheese', 'paneer', 'butter', 'curd', 'ghee', 'cream'],
  peanuts: ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
  'tree nuts': ['tree nut', 'tree nuts', 'cashew', 'cashews', 'almond', 'almonds', 'walnut', 'walnuts', 'pistachio', 'nut', 'nuts'],
  egg: ['egg', 'eggs', 'egg albumen', 'egg yolk'],
  soy: ['soy', 'soya', 'soybean', 'soybeans', 'tofu'],
  wheat: ['wheat', 'gluten', 'flour', 'maida', 'atta', 'bread', 'roti', 'chapati', 'pasta'],
  fish: ['fish', 'salmon', 'tuna', 'cod'],
  shellfish: ['shellfish', 'prawn', 'prawns', 'shrimp', 'shrimps', 'crab', 'crabs', 'lobster'],
  sesame: ['sesame', 'til', 'gingelly'],
};

/**
 * Normalizes an allergy or allergen string into comparable tokens
 */
function normalizeTerm(term: string): string[] {
  if (!term) return [];
  return term
    .toLowerCase()
    .replace(/[(),.\-_/]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Checks if two allergen tokens match directly or via synonym groups
 */
function termsMatch(studentTerm: string, mealTerm: string): boolean {
  const s = studentTerm.toLowerCase().trim();
  const m = mealTerm.toLowerCase().trim();

  // Direct equality or substring match
  if (s === m) return true;
  if (s.length > 2 && m.includes(s)) return true;
  if (m.length > 2 && s.includes(m)) return true;

  // Check synonym group matches
  for (const [groupName, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
    const sMatches = synonyms.some((syn) => syn === s || s.includes(syn));
    const mMatches = synonyms.some((syn) => syn === m || m.includes(syn));
    if (sMatches && mMatches) return true;
  }

  return false;
}

/**
 * Pure evaluation function comparing student allergy list against meal allergen list
 */
export function evaluateAllergyConflict(
  studentAllergies: string[],
  mealAllergens: string[],
  childName?: string,
  mealName?: string
): AllergyCheckResult {
  const matchingSet = new Set<string>();

  // Filter out empty or "none" entries
  const validStudentAllergies = studentAllergies.filter(
    (a) => a && a.trim() && a.trim().toLowerCase() !== 'none' && a.trim().toLowerCase() !== 'no known allergies'
  );

  const validMealAllergens = mealAllergens.filter(
    (a) => a && a.trim() && a.trim().toLowerCase() !== 'none'
  );

  for (const sAllergy of validStudentAllergies) {
    const sTokens = normalizeTerm(sAllergy);
    for (const mAllergen of validMealAllergens) {
      const mTokens = normalizeTerm(mAllergen);

      // Check if any student token matches any meal allergen token
      let matched = false;
      for (const st of sTokens) {
        for (const mt of mTokens) {
          if (termsMatch(st, mt)) {
            matched = true;
            break;
          }
        }
        if (matched) break;
      }

      if (matched || termsMatch(sAllergy, mAllergen)) {
        // Pretty format allergen name (e.g. Milk, Peanuts)
        const displayLabel = mAllergen.trim();
        matchingSet.add(displayLabel);
      }
    }
  }

  const matchingAllergens = Array.from(matchingSet);
  return {
    hasConflict: matchingAllergens.length > 0,
    matchingAllergens,
    childName,
    mealName,
  };
}

/**
 * Backend service to check allergy conflict between a student and a meal from database
 */
export async function checkMealAllergy(studentId: string, mealId: string): Promise<AllergyCheckResult> {
  try {
    const [student, meal] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        include: {
          studentAllergies: {
            include: { allergy: true },
          },
        },
      }),
      prisma.meal.findUnique({
        where: { id: mealId },
        include: {
          mealAllergens: {
            include: { allergen: true },
          },
        },
      }),
    ]);

    if (!student || !meal) {
      return { hasConflict: false, matchingAllergens: [] };
    }

    // Combine relational allergies with legacy allergies field
    const studentAllergies: string[] = [];
    if (student.studentAllergies && student.studentAllergies.length > 0) {
      student.studentAllergies.forEach((sa) => {
        studentAllergies.push(sa.allergy.name);
        if (sa.customNote) studentAllergies.push(sa.customNote);
      });
    }
    if (student.allergies) {
      student.allergies.split(/[,;]/).forEach((part) => {
        const clean = part.trim();
        if (clean && !studentAllergies.includes(clean)) {
          studentAllergies.push(clean);
        }
      });
    }

    // Combine relational allergens with legacy allergens field
    const mealAllergens: string[] = [];
    if (meal.mealAllergens && meal.mealAllergens.length > 0) {
      meal.mealAllergens.forEach((ma) => {
        mealAllergens.push(ma.allergen.name);
      });
    }
    if (meal.allergens) {
      meal.allergens.split(/[,;]/).forEach((part) => {
        const clean = part.trim();
        if (clean && !mealAllergens.includes(clean)) {
          mealAllergens.push(clean);
        }
      });
    }

    return evaluateAllergyConflict(studentAllergies, mealAllergens, student.name, meal.name);
  } catch (error) {
    console.error('Error in checkMealAllergy:', error);
    return { hasConflict: false, matchingAllergens: [] };
  }
}

/**
 * Helper to fetch system setting (e.g. ALLOW_ALLERGY_ORDERS)
 */
export async function getSystemSetting(key: string, defaultValue: string = 'true'): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    return setting ? setting.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Helper to set system setting
 */
export async function setSystemSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
