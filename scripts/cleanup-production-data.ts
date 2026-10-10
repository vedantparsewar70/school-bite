import fs from 'fs';
import path from 'path';
import { db } from '../lib/firebase-admin';

async function performProductionDataCleanup() {
  console.log('🚀 ========================================================');
  console.log('   SCHOOL-BITE: PRODUCTION DATA CLEANUP BEFORE LAUNCH');
  console.log('========================================================\n');

  // STEP 1: SAFETY BACKUP
  console.log('📦 Step 1: Generating local safety backup of current data...');
  const collectionsToBackup = [
    'users',
    'parents',
    'students',
    'studentAllergies',
    'orders',
    'orderItems',
    'payments',
    'teacher_orders',
  ];

  const backupData: Record<string, any[]> = {};

  for (const colName of collectionsToBackup) {
    const snap = await db.collection(colName).get();
    backupData[colName] = snap.docs.map((doc) => ({
      _id: doc.id,
      ...doc.data(),
    }));
    console.log(`   - Backed up ${backupData[colName].length} records from "${colName}"`);
  }

  const backupPath = path.resolve(process.cwd(), 'prisma/backup_pre_cleanup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`✅ Safety backup saved to: ${backupPath}\n`);

  // STEP 2: VERIFY ACCOUNTS TO PRESERVE
  console.log('🔒 Step 2: Verifying protected administrative & staff credentials...');
  const usersSnap = await db.collection('users').get();
  const preservedUsers: string[] = [];
  const parentUsersToDelete: string[] = [];

  usersSnap.forEach((doc) => {
    const data = doc.data();
    if (data.role === 'ADMIN' || data.role === 'STAFF') {
      preservedUsers.push(`${data.email} (${data.name}, Role: ${data.role})`);
    } else {
      parentUsersToDelete.push(doc.id);
    }
  });

  console.log('   Protected Accounts (WILL NOT BE MODIFIED):');
  preservedUsers.forEach((u) => console.log(`     🛡️  ${u}`));
  console.log(`   Parent users scheduled for deletion: ${parentUsersToDelete.length}\n`);

  // Helper for batch deletion
  async function batchDeleteCollection(
    collectionName: string,
    filterPredicate?: (docId: string, data: any) => boolean
  ): Promise<number> {
    const snap = await db.collection(collectionName).get();
    let batch = db.batch();
    let count = 0;
    let totalDeleted = 0;
    const BATCH_SIZE = 400;

    for (const doc of snap.docs) {
      if (filterPredicate && !filterPredicate(doc.id, doc.data())) {
        continue;
      }
      batch.delete(doc.ref);
      count++;
      totalDeleted++;

      if (count >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    return totalDeleted;
  }

  // STEP 3: EXECUTE SAFE DELETIONS
  console.log('🗑️ Step 3: Executing targeted deletions in correct dependency order...');

  // 3.1 Order Items
  const deletedOrderItems = await batchDeleteCollection('orderItems');
  console.log(`   - Deleted ${deletedOrderItems} test records from "orderItems"`);

  // 3.2 Orders
  const deletedOrders = await batchDeleteCollection('orders');
  console.log(`   - Deleted ${deletedOrders} test records from "orders"`);

  // 3.3 Payments
  const deletedPayments = await batchDeleteCollection('payments');
  console.log(`   - Deleted ${deletedPayments} test records from "payments"`);

  // 3.4 Teacher Orders
  const deletedTeacherOrders = await batchDeleteCollection('teacher_orders');
  console.log(`   - Deleted ${deletedTeacherOrders} test records from "teacher_orders"`);

  // 3.5 Student Allergies
  const deletedStudentAllergies = await batchDeleteCollection('studentAllergies');
  console.log(`   - Deleted ${deletedStudentAllergies} test records from "studentAllergies"`);

  // 3.6 Students
  const deletedStudents = await batchDeleteCollection('students');
  console.log(`   - Deleted ${deletedStudents} test records from "students"`);

  // 3.7 Parents
  const deletedParents = await batchDeleteCollection('parents');
  console.log(`   - Deleted ${deletedParents} test records from "parents"`);

  // 3.8 Parent Users (preserving ADMIN and STAFF)
  const deletedParentUsers = await batchDeleteCollection('users', (_id, data) => {
    return data.role !== 'ADMIN' && data.role !== 'STAFF';
  });
  console.log(`   - Deleted ${deletedParentUsers} test parent accounts from "users" (ADMIN & STAFF preserved)`);

  console.log('\n🔍 Step 4: Post-cleanup verification & sanity check...');

  // STEP 4: VERIFY COUNTS
  const verifyCols = [
    { name: 'users', expectedRoleOnly: ['ADMIN', 'STAFF'] },
    { name: 'parents', expectedCount: 0 },
    { name: 'students', expectedCount: 0 },
    { name: 'studentAllergies', expectedCount: 0 },
    { name: 'orders', expectedCount: 0 },
    { name: 'orderItems', expectedCount: 0 },
    { name: 'payments', expectedCount: 0 },
    { name: 'teacher_orders', expectedCount: 0 },
    { name: 'meals', minExpected: 1 },
    { name: 'menus', minExpected: 1 },
    { name: 'teacher_meals', minExpected: 1 },
    { name: 'allergies', minExpected: 1 },
    { name: 'allergens', minExpected: 1 },
    { name: 'mealAllergens', minExpected: 1 },
    { name: 'systemSettings', minExpected: 1 },
  ];

  let allChecksPassed = true;

  for (const check of verifyCols) {
    const snap = await db.collection(check.name).get();
    if (check.expectedCount !== undefined) {
      if (snap.size === check.expectedCount) {
        console.log(`   ✅ "${check.name}" is completely clear (0 records).`);
      } else {
        console.error(`   ❌ "${check.name}" still contains ${snap.size} records!`);
        allChecksPassed = false;
      }
    } else if (check.minExpected !== undefined) {
      if (snap.size >= check.minExpected) {
        console.log(`   ✅ "${check.name}" intact with ${snap.size} configuration records.`);
      } else {
        console.error(`   ❌ "${check.name}" lost records! Found: ${snap.size}`);
        allChecksPassed = false;
      }
    } else if (check.name === 'users') {
      const remainingRoles = snap.docs.map((d) => d.data().role);
      const invalidRoles = remainingRoles.filter((r) => r !== 'ADMIN' && r !== 'STAFF');
      if (invalidRoles.length === 0 && snap.size === 2) {
        console.log(`   ✅ "users" contains exactly 2 accounts: Admin & Staff preserved.`);
      } else {
        console.error(`   ❌ "users" unexpected state: ${snap.size} users, roles:`, remainingRoles);
        allChecksPassed = false;
      }
    }
  }

  if (allChecksPassed) {
    console.log('\n🎉 ALL CHECKS PASSED! The database is 100% clean and ready for official launch.');
  } else {
    console.error('\n⚠️ Some verification checks failed! Review the errors above.');
    process.exit(1);
  }

  process.exit(0);
}

performProductionDataCleanup().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
