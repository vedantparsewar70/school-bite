import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function getFormattedDate(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean old data in reverse dependency order
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.mealAllergen.deleteMany();
  await prisma.studentAllergy.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.allergy.deleteMany();
  await prisma.allergen.deleteMany();
  await prisma.systemSetting.deleteMany();

  console.log('🧹 Cleaned existing records.');

  // 1. System Settings
  await prisma.systemSetting.create({
    data: {
      key: 'ALLOW_ALLERGY_ORDERS',
      value: 'true',
    },
  });
  console.log('⚙️ Initialized system settings.');

  // 2. Master Allergies (Child Profile Choices)
  const masterAllergiesList = [
    'Milk',
    'Peanuts',
    'Egg',
    'Soy',
    'Wheat',
    'Tree Nuts',
    'Fish',
    'Shellfish',
    'Sesame',
  ];
  const allergyMap = new Map<string, string>();
  for (const name of masterAllergiesList) {
    const a = await prisma.allergy.create({ data: { name } });
    allergyMap.set(name, a.id);
  }

  // 3. Master Allergens (Meal Allergens)
  const masterAllergensList = [
    'Milk',
    'Peanuts',
    'Tree Nuts',
    'Wheat',
    'Egg',
    'Soy',
    'Cashew',
    'Gluten',
    'Mustard',
    'Sesame',
  ];
  const allergenMap = new Map<string, string>();
  for (const name of masterAllergensList) {
    const a = await prisma.allergen.create({ data: { name } });
    allergenMap.set(name, a.id);
  }
  console.log('🏷️ Master allergies & allergens created.');

  // Passwords
  const adminPasswordHash = await bcrypt.hash('Admin123', 10);
  const parentPasswordHash = await bcrypt.hash('Parent123', 10);

  // 4. Create Admin
  await prisma.user.create({
    data: {
      email: 'admin@school.com',
      passwordHash: adminPasswordHash,
      name: 'R. K. Verma (Admin)',
      phone: '+91 98100 12345',
      role: 'ADMIN',
    },
  });

  // 5. Create Demo Parent 1
  const parentUser = await prisma.user.create({
    data: {
      email: 'parent@example.com',
      passwordHash: parentPasswordHash,
      name: 'Pooja Sharma',
      phone: '+91 98765 43210',
      role: 'PARENT',
      parent: {
        create: {
          walletBalance: 500.0,
        },
      },
    },
    include: { parent: true },
  });
  const parentProfile = parentUser.parent!;

  // 6. Create Demo Parent 2
  const parentUser2 = await prisma.user.create({
    data: {
      email: 'vikram@example.com',
      passwordHash: parentPasswordHash,
      name: 'Vikram Malhotra',
      phone: '+91 97112 34567',
      role: 'PARENT',
      parent: {
        create: {
          walletBalance: 350.0,
        },
      },
    },
    include: { parent: true },
  });
  const parentProfile2 = parentUser2.parent!;

  // 7. Create Students / Children with relational allergies
  const aarav = await prisma.student.create({
    data: {
      parentId: parentProfile.id,
      name: 'Aarav Sharma',
      dob: '2015-04-12',
      grade: '5',
      division: 'A',
      rollNo: '12',
      studentId: 'STU-2026-012',
      allergies: 'Milk, Peanuts',
      dietaryRestrictions: 'No outside junk food',
      foodPreference: 'Vegetarian',
      notes: 'Requires strict allergy awareness for dairy & peanuts.',
      isVegetarian: true,
      profilePhoto: null,
      studentAllergies: {
        create: [
          { allergyId: allergyMap.get('Milk')! },
          { allergyId: allergyMap.get('Peanuts')! },
        ],
      },
    },
  });

  const anaya = await prisma.student.create({
    data: {
      parentId: parentProfile.id,
      name: 'Anaya Sharma',
      dob: '2017-09-24',
      grade: '3',
      division: 'B',
      rollNo: '07',
      studentId: 'STU-2026-037',
      allergies: '',
      dietaryRestrictions: 'Low spice',
      foodPreference: 'Vegetarian',
      notes: 'No known allergies',
      isVegetarian: true,
      profilePhoto: null,
    },
  });

  const kabir = await prisma.student.create({
    data: {
      parentId: parentProfile2.id,
      name: 'Kabir Malhotra',
      dob: '2014-11-15',
      grade: '6',
      division: 'A',
      rollNo: '18',
      studentId: 'STU-2026-088',
      allergies: 'Wheat',
      dietaryRestrictions: 'Gluten sensitivity',
      foodPreference: 'Non-Vegetarian',
      notes: 'Avoid wheat and gluten-based dough.',
      isVegetarian: false,
      profilePhoto: null,
      studentAllergies: {
        create: [{ allergyId: allergyMap.get('Wheat')! }],
      },
    },
  });

  console.log('✅ Created users and children with allergy profiles.');

  // 8. Create Meals with relational allergens
  const mealsDef = [
    {
      name: 'Paneer Rice Bowl',
      description:
        'Cottage cheese cubes simmered in mildly spiced tomato-cashew gravy served with steamed basmati rice, dal tadka, and crisp cucumber salad.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Basmati Rice, Paneer, Tomatoes, Cashew Paste, Toor Dal, Spices, Cucumber',
      allergensStr: 'Milk, Cashew',
      allergenTags: ['Milk', 'Cashew'],
      calories: 460,
      price: 100,
    },
    {
      name: 'Deluxe Veg Thali',
      description:
        'Wholesome balanced meal: 2 whole wheat Phulkas, Paneer Makhani, Dal Tadka, Jeera Rice, Boondi Raita, and Gulab Jamun dessert.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Whole Wheat Atta, Paneer, Butter, Toor Dal, Jeera Rice, Curd, Gulab Jamun',
      allergensStr: 'Wheat, Milk, Gluten',
      allergenTags: ['Wheat', 'Milk', 'Gluten'],
      calories: 620,
      price: 120,
    },
    {
      name: 'Rajma Chawal Bowl',
      description:
        'Slow-simmered Kashmiri red kidney beans in aromatic spiced onion-tomato gravy, served over fragrant steamed jeera rice with pickled onions.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Red Kidney Beans, Basmati Rice, Cumin, Tomatoes, Onions, Ginger Garlic, Ghee',
      allergensStr: '',
      allergenTags: [],
      calories: 410,
      price: 90,
    },
    {
      name: 'Creamy Garden Veg Pasta',
      description:
        'Durum wheat penne tossed in rich homemade béchamel sauce with fresh broccoli, sweet corn, tricolor bell peppers, and warm garlic toast.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Durum Wheat Penne, Milk, Butter, Broccoli, Sweet Corn, Bell Peppers, Oregano, Cheese',
      allergensStr: 'Wheat, Milk, Gluten',
      allergenTags: ['Wheat', 'Milk', 'Gluten'],
      calories: 480,
      price: 95,
    },
    {
      name: 'South Indian Masala Idli & Sambar',
      description:
        'Steamed fluffy rice cakes sautéed with mustard seeds, curry leaves, and podi spice, served with piping hot vegetable sambar & coconut dip.',
      category: 'BREAKFAST',
      isVegetarian: true,
      ingredients: 'Rice, Urad Dal, Curry Leaves, Mustard Seeds, Drumstick, Pumpkin, Toor Dal, Coconut',
      allergensStr: 'Mustard',
      allergenTags: ['Mustard'],
      calories: 340,
      price: 75,
    },
    {
      name: 'Nutritious Veg Pulao & Raita',
      description:
        'Fragrant basmati rice gently spiced with star anise, cloves, green peas, carrots, and french beans. Served with chilled cucumber-mint raita.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Basmati Rice, Green Peas, Carrots, Beans, Mint, Curd, Cumin, Cow Ghee',
      allergensStr: 'Milk',
      allergenTags: ['Milk'],
      calories: 390,
      price: 85,
    },
    {
      name: 'Fresh Fruit & Nut Box',
      description:
        'Chilled freshly sliced apple, seedless pomegranate arils, papaya cubes, seedless green grapes, topped with honey-roasted almonds & walnuts.',
      category: 'SNACK',
      isVegetarian: true,
      ingredients: 'Apple, Pomegranate, Papaya, Grapes, Almonds, Walnuts, Honey',
      allergensStr: 'Tree Nuts',
      allergenTags: ['Tree Nuts'],
      calories: 210,
      price: 60,
    },
    {
      name: 'Grilled Corn & Cheese Sandwich',
      description:
        'Multi-grain bread stuffed with sweet corn kernels, melted cheddar cheese, bell peppers, and mild green herb sauce toasted until golden crisp.',
      category: 'SNACK',
      isVegetarian: true,
      ingredients: 'Multigrain Bread, Sweet Corn, Cheese, Capsicum, Butter, Mint Chutney',
      allergensStr: 'Wheat, Milk, Gluten',
      allergenTags: ['Wheat', 'Milk', 'Gluten'],
      calories: 310,
      price: 70,
    },
  ];

  const createdMeals = [];
  for (const m of mealsDef) {
    const meal = await prisma.meal.create({
      data: {
        name: m.name,
        description: m.description,
        category: m.category,
        isVegetarian: m.isVegetarian,
        ingredients: m.ingredients,
        allergens: m.allergensStr,
        calories: m.calories,
        price: m.price,
        imageUrl: null,
        mealAllergens: {
          create: m.allergenTags
            .map((tagName) => {
              const allergenId = allergenMap.get(tagName);
              return allergenId ? { allergenId } : null;
            })
            .filter((x): x is { allergenId: string } => x !== null),
        },
      },
    });
    createdMeals.push(meal);
  }

  console.log(`✅ Created ${createdMeals.length} meals with relational allergen mappings.`);

  // 9. Daily Menus for 10 consecutive days
  const daysOffsets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const offset of daysOffsets) {
    const dateStr = getFormattedDate(offset);
    const selectedIndexes = [
      (offset * 2) % createdMeals.length,
      (offset * 2 + 1) % createdMeals.length,
      (offset * 2 + 2) % createdMeals.length,
      6, // Fruit box snack
    ];
    const uniqueMealIndices = Array.from(new Set(selectedIndexes));

    for (const idx of uniqueMealIndices) {
      const meal = createdMeals[idx];
      await prisma.menu.create({
        data: {
          mealId: meal.id,
          date: dateStr,
          availableQuantity: 45,
          maxQuantity: 50,
          orderingDeadline: '08:30',
          isActive: true,
        },
      });
    }
  }

  console.log('✅ Created daily menus for next 10 days.');

  // 10. Create Sample Orders with explicit Allergy Alert indicators on items
  const todayStr = getFormattedDate(0);
  const tomorrowStr = getFormattedDate(1);
  const yesterdayStr = getFormattedDate(-1);

  // Yesterday's Order - Collected
  await prisma.order.create({
    data: {
      id: 'ORD-2026-000101',
      parentId: parentProfile.id,
      totalAmount: 190,
      paymentStatus: 'PAID',
      orderStatus: 'COLLECTED',
      notes: 'No spice for Aarav',
      createdAt: new Date(Date.now() - 24 * 3600 * 1000),
      items: {
        create: [
          {
            studentId: aarav.id,
            mealId: createdMeals[0].id, // Paneer Rice Bowl (contains Milk, Aarav has Milk allergy!)
            date: yesterdayStr,
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            hasAllergyAlert: true,
            conflictAllergens: 'Milk',
          },
          {
            studentId: anaya.id,
            mealId: createdMeals[2].id, // Rajma Chawal (No allergens)
            date: yesterdayStr,
            quantity: 1,
            unitPrice: 90,
            totalPrice: 90,
            hasAllergyAlert: false,
            conflictAllergens: null,
          },
        ],
      },
      payments: {
        create: {
          id: 'PAY-2026-9001',
          amount: 190,
          paymentMethod: 'UPI',
          status: 'SUCCESS',
          transactionRef: 'UPI-982103847291',
          upiId: 'sharma.pooja@okhdfcbank',
          createdAt: new Date(Date.now() - 24 * 3600 * 1000),
        },
      },
    },
  });

  // Today's Order 1 - Preparing (Aarav has Paneer Rice Bowl -> Milk Allergy Alert!)
  await prisma.order.create({
    data: {
      id: 'ORD-2026-000123',
      parentId: parentProfile.id,
      totalAmount: 195,
      paymentStatus: 'PAID',
      orderStatus: 'PREPARING',
      notes: 'Allergy alert: Parent acknowledged Milk warning for Aarav',
      createdAt: new Date(),
      items: {
        create: [
          {
            studentId: aarav.id,
            mealId: createdMeals[0].id, // Paneer Rice Bowl (Contains Milk -> Alert!)
            date: todayStr,
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            hasAllergyAlert: true,
            conflictAllergens: 'Milk',
          },
          {
            studentId: anaya.id,
            mealId: createdMeals[3].id, // Pasta
            date: todayStr,
            quantity: 1,
            unitPrice: 95,
            totalPrice: 95,
            hasAllergyAlert: false,
            conflictAllergens: null,
          },
        ],
      },
      payments: {
        create: {
          id: 'PAY-2026-9145',
          amount: 195,
          paymentMethod: 'UPI',
          status: 'SUCCESS',
          transactionRef: 'UPI-984210491823',
          upiId: 'sharma.pooja@okhdfcbank',
          createdAt: new Date(),
        },
      },
    },
  });

  // Today's Order 2 - Confirmed (Kabir has Deluxe Thali -> Wheat Allergy Alert!)
  await prisma.order.create({
    data: {
      id: 'ORD-2026-000124',
      parentId: parentProfile2.id,
      totalAmount: 120,
      paymentStatus: 'PAID',
      orderStatus: 'CONFIRMED',
      notes: 'Parent acknowledged wheat warning for Kabir',
      createdAt: new Date(),
      items: {
        create: [
          {
            studentId: kabir.id,
            mealId: createdMeals[1].id, // Deluxe Thali (Contains Wheat -> Alert!)
            date: todayStr,
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
            hasAllergyAlert: true,
            conflictAllergens: 'Wheat',
          },
        ],
      },
      payments: {
        create: {
          id: 'PAY-2026-9146',
          amount: 120,
          paymentMethod: 'CARD',
          cardLastFour: '4242',
          status: 'SUCCESS',
          transactionRef: 'CARD-TXN-491203',
          createdAt: new Date(),
        },
      },
    },
  });

  // Upcoming Order (Tomorrow) - Confirmed
  await prisma.order.create({
    data: {
      id: 'ORD-2026-000125',
      parentId: parentProfile.id,
      totalAmount: 210,
      paymentStatus: 'PAID',
      orderStatus: 'CONFIRMED',
      notes: 'Packed lunch box',
      createdAt: new Date(),
      items: {
        create: [
          {
            studentId: aarav.id,
            mealId: createdMeals[1].id, // Veg Thali (Contains Milk -> Alert!)
            date: tomorrowStr,
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
            hasAllergyAlert: true,
            conflictAllergens: 'Milk',
          },
          {
            studentId: anaya.id,
            mealId: createdMeals[2].id, // Rajma Chawal (No allergens)
            date: tomorrowStr,
            quantity: 1,
            unitPrice: 90,
            totalPrice: 90,
            hasAllergyAlert: false,
            conflictAllergens: null,
          },
        ],
      },
      payments: {
        create: {
          id: 'PAY-2026-9147',
          amount: 210,
          paymentMethod: 'NET_BANKING',
          bankName: 'HDFC Bank',
          status: 'SUCCESS',
          transactionRef: 'NETB-849201948',
          createdAt: new Date(),
        },
      },
    },
  });

  console.log('✅ Created sample orders with persistent allergy alerts.');
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
