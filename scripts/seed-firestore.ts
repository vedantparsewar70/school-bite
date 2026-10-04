import fs from 'fs';
import path from 'path';
import { db } from '../lib/firebase-admin';

async function seedFirestore() {
  console.log('🔥 Starting Firestore database migration & seeding...');

  const dumpPath = path.resolve(process.cwd(), 'prisma/sqlite_dump.json');
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found at: ${dumpPath}`);
  }

  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  const batchLimit = 400;

  async function commitInBatches(items: any[], collectionName: string, idField: string = 'id') {
    if (!items || items.length === 0) return;
    console.log(`⏳ Seeding ${items.length} records into collection "${collectionName}"...`);

    let currentBatch = db.batch();
    let count = 0;

    for (const item of items) {
      const docId = String(item[idField]);
      const ref = db.collection(collectionName).doc(docId);
      currentBatch.set(ref, item, { merge: true });
      count++;

      if (count % batchLimit === 0) {
        await currentBatch.commit();
        currentBatch = db.batch();
      }
    }

    if (count % batchLimit !== 0) {
      await currentBatch.commit();
    }
    console.log(`✅ Collection "${collectionName}" populated with ${count} records.`);
  }

  // 1. System Settings (key as document ID)
  await commitInBatches(dump.SystemSetting || [], 'systemSettings', 'key');

  // 2. Allergies
  await commitInBatches(dump.Allergy || [], 'allergies', 'id');

  // 3. Allergens
  await commitInBatches(dump.Allergen || [], 'allergens', 'id');

  // 4. Users
  await commitInBatches(dump.User || [], 'users', 'id');

  // 5. Parents
  await commitInBatches(dump.Parent || [], 'parents', 'id');

  // 6. Students
  await commitInBatches(dump.Student || [], 'students', 'id');

  // 7. StudentAllergies
  await commitInBatches(dump.StudentAllergy || [], 'studentAllergies', 'id');

  // 8. Meals
  await commitInBatches(dump.Meal || [], 'meals', 'id');

  // 9. MealAllergens
  await commitInBatches(dump.MealAllergen || [], 'mealAllergens', 'id');

  // 10. Menus
  await commitInBatches(dump.Menu || [], 'menus', 'id');

  // 11. Orders
  await commitInBatches(dump.Order || [], 'orders', 'id');

  // 12. OrderItems
  await commitInBatches(dump.OrderItem || [], 'orderItems', 'id');

  // 13. Payments
  await commitInBatches(dump.Payment || [], 'payments', 'id');

  console.log('🎉 Firestore data migration and seed complete!');
}

seedFirestore()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Firestore migration failed:', err);
    process.exit(1);
  });
