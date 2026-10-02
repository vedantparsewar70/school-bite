import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';

async function restore() {
  const dumpPath = path.resolve(process.cwd(), 'prisma/sqlite_dump.json');
  if (!fs.existsSync(dumpPath)) {
    console.error('❌ sqlite_dump.json not found at:', dumpPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dumpPath, 'utf-8');
  const data = JSON.parse(raw);

  console.log('🔄 Restoring SQLite data into PostgreSQL...');

  // 1. System Settings
  for (const s of data.SystemSetting || []) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, updatedAt: new Date(s.updatedAt) },
      create: { key: s.key, value: s.value, updatedAt: new Date(s.updatedAt) },
    });
  }
  console.log('✅ SystemSettings restored');

  // 2. Allergies
  for (const a of data.Allergy || []) {
    await prisma.allergy.upsert({
      where: { id: a.id },
      update: { name: a.name },
      create: { id: a.id, name: a.name, createdAt: new Date(a.createdAt) },
    });
  }
  console.log('✅ Allergies restored');

  // 3. Allergens
  for (const a of data.Allergen || []) {
    await prisma.allergen.upsert({
      where: { id: a.id },
      update: { name: a.name },
      create: { id: a.id, name: a.name, createdAt: new Date(a.createdAt) },
    });
  }
  console.log('✅ Allergens restored');

  // 4. Users
  for (const u of data.User || []) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        phone: u.phone,
        role: u.role,
      },
      create: {
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        phone: u.phone,
        role: u.role,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
      },
    });
  }
  console.log('✅ Users restored');

  // 5. Parents
  for (const p of data.Parent || []) {
    await prisma.parent.upsert({
      where: { id: p.id },
      update: { walletBalance: parseFloat(p.walletBalance) },
      create: {
        id: p.id,
        userId: p.userId,
        walletBalance: parseFloat(p.walletBalance),
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      },
    });
  }
  console.log('✅ Parents restored');

  // 6. Students
  for (const s of data.Student || []) {
    await prisma.student.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        dob: s.dob,
        grade: s.grade,
        division: s.division,
        rollNo: s.rollNo,
        studentId: s.studentId,
        allergies: s.allergies,
        dietaryRestrictions: s.dietaryRestrictions,
        foodPreference: s.foodPreference,
        notes: s.notes,
        isVegetarian: Boolean(s.isVegetarian),
        profilePhoto: s.profilePhoto,
        isActive: Boolean(s.isActive),
      },
      create: {
        id: s.id,
        parentId: s.parentId,
        name: s.name,
        dob: s.dob,
        grade: s.grade,
        division: s.division,
        rollNo: s.rollNo,
        studentId: s.studentId,
        allergies: s.allergies,
        dietaryRestrictions: s.dietaryRestrictions,
        foodPreference: s.foodPreference,
        notes: s.notes,
        isVegetarian: Boolean(s.isVegetarian),
        profilePhoto: s.profilePhoto,
        isActive: Boolean(s.isActive),
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      },
    });
  }
  console.log('✅ Students restored');

  // 7. StudentAllergies
  for (const sa of data.StudentAllergy || []) {
    await prisma.studentAllergy.upsert({
      where: { id: sa.id },
      update: { customNote: sa.customNote },
      create: {
        id: sa.id,
        studentId: sa.studentId,
        allergyId: sa.allergyId,
        customNote: sa.customNote,
        createdAt: new Date(sa.createdAt),
      },
    });
  }
  console.log('✅ StudentAllergies restored');

  // 8. Meals
  for (const m of data.Meal || []) {
    await prisma.meal.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        description: m.description,
        category: m.category,
        isVegetarian: Boolean(m.isVegetarian),
        ingredients: m.ingredients,
        allergens: m.allergens,
        calories: m.calories ? parseInt(m.calories) : null,
        price: parseFloat(m.price),
        imageUrl: m.imageUrl,
      },
      create: {
        id: m.id,
        name: m.name,
        description: m.description,
        category: m.category,
        isVegetarian: Boolean(m.isVegetarian),
        ingredients: m.ingredients,
        allergens: m.allergens,
        calories: m.calories ? parseInt(m.calories) : null,
        price: parseFloat(m.price),
        imageUrl: m.imageUrl,
        createdAt: new Date(m.createdAt),
        updatedAt: new Date(m.updatedAt),
      },
    });
  }
  console.log('✅ Meals restored');

  // 9. MealAllergens
  for (const ma of data.MealAllergen || []) {
    await prisma.mealAllergen.upsert({
      where: { id: ma.id },
      update: {},
      create: {
        id: ma.id,
        mealId: ma.mealId,
        allergenId: ma.allergenId,
        createdAt: new Date(ma.createdAt),
      },
    });
  }
  console.log('✅ MealAllergens restored');

  // 10. Menus
  for (const mn of data.Menu || []) {
    await prisma.menu.upsert({
      where: { id: mn.id },
      update: {
        availableQuantity: parseInt(mn.availableQuantity),
        maxQuantity: parseInt(mn.maxQuantity),
        orderingDeadline: mn.orderingDeadline,
        isActive: Boolean(mn.isActive),
      },
      create: {
        id: mn.id,
        mealId: mn.mealId,
        date: mn.date,
        availableQuantity: parseInt(mn.availableQuantity),
        maxQuantity: parseInt(mn.maxQuantity),
        orderingDeadline: mn.orderingDeadline,
        isActive: Boolean(mn.isActive),
        createdAt: new Date(mn.createdAt),
        updatedAt: new Date(mn.updatedAt),
      },
    });
  }
  console.log('✅ Menus restored');

  // 11. Orders
  for (const o of data.Order || []) {
    await prisma.order.upsert({
      where: { id: o.id },
      update: {
        totalAmount: parseFloat(o.totalAmount),
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        notes: o.notes,
      },
      create: {
        id: o.id,
        parentId: o.parentId,
        totalAmount: parseFloat(o.totalAmount),
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        notes: o.notes,
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt),
      },
    });
  }
  console.log('✅ Orders restored');

  // 12. OrderItems
  for (const oi of data.OrderItem || []) {
    await prisma.orderItem.upsert({
      where: { id: oi.id },
      update: {
        quantity: parseInt(oi.quantity),
        unitPrice: parseFloat(oi.unitPrice),
        totalPrice: parseFloat(oi.totalPrice),
        hasAllergyAlert: Boolean(oi.hasAllergyAlert),
        conflictAllergens: oi.conflictAllergens,
      },
      create: {
        id: oi.id,
        orderId: oi.orderId,
        studentId: oi.studentId,
        mealId: oi.mealId,
        date: oi.date,
        quantity: parseInt(oi.quantity),
        unitPrice: parseFloat(oi.unitPrice),
        totalPrice: parseFloat(oi.totalPrice),
        hasAllergyAlert: Boolean(oi.hasAllergyAlert),
        conflictAllergens: oi.conflictAllergens,
        createdAt: new Date(oi.createdAt),
      },
    });
  }
  console.log('✅ OrderItems restored');

  // 13. Payments
  for (const p of data.Payment || []) {
    await prisma.payment.upsert({
      where: { id: p.id },
      update: {
        amount: parseFloat(p.amount),
        paymentMethod: p.paymentMethod,
        status: p.status,
        transactionRef: p.transactionRef,
        upiId: p.upiId,
        cardLastFour: p.cardLastFour,
        bankName: p.bankName,
      },
      create: {
        id: p.id,
        orderId: p.orderId,
        amount: parseFloat(p.amount),
        paymentMethod: p.paymentMethod,
        status: p.status,
        transactionRef: p.transactionRef,
        upiId: p.upiId,
        cardLastFour: p.cardLastFour,
        bankName: p.bankName,
        createdAt: new Date(p.createdAt),
      },
    });
  }
  console.log('✅ Payments restored');

  console.log('\n🎉 ALL SQLITE DATA SUCCESSFULLY MIGRATED TO POSTGRESQL!');
}

restore()
  .catch((e) => {
    console.error('❌ Restore failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
