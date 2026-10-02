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
  await prisma.meal.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing records.');

  // Passwords
  const adminPasswordHash = await bcrypt.hash('Admin123', 10);
  const parentPasswordHash = await bcrypt.hash('Parent123', 10);

  // 1. Create Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@school.com',
      passwordHash: adminPasswordHash,
      name: 'R. K. Verma (Admin)',
      phone: '+91 98100 12345',
      role: 'ADMIN',
    },
  });

  // 2. Create Demo Parent
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

  // 3. Create Second Demo Parent for realistic school multi-family data
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

  // 4. Create Students / Children
  const aarav = await prisma.student.create({
    data: {
      parentId: parentProfile.id,
      name: 'Aarav Sharma',
      dob: '2015-04-12',
      grade: '5',
      division: 'A',
      rollNo: '12',
      studentId: 'STU-2026-012',
      allergies: 'Peanuts (Mild)',
      isVegetarian: true,
      profilePhoto: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80',
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
      allergies: 'Lactose Intolerant',
      isVegetarian: true,
      profilePhoto: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=200&auto=format&fit=crop&q=80',
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
      allergies: 'None',
      isVegetarian: false,
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    },
  });

  console.log('✅ Created users and children.');

  // 5. Create Meals
  const mealsData = [
    {
      name: 'Paneer Rice Bowl',
      description: 'Cottage cheese cubes simmered in mildly spiced tomato-cashew gravy served with steamed basmati rice, dal tadka, and crisp cucumber salad.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Basmati Rice, Paneer, Tomatoes, Cashew Paste, Toor Dal, Spices, Cucumber',
      allergens: 'Dairy, Cashew',
      calories: 460,
      price: 100,
      imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Deluxe Veg Thali',
      description: 'Wholesome balanced meal: 2 whole wheat Phulkas, Paneer Makhani, Dal Tadka, Jeera Rice, Boondi Raita, and Gulab Jamun dessert.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Whole Wheat Atta, Paneer, Butter, Toor Dal, Jeera Rice, Curd, Gulab Jamun',
      allergens: 'Gluten, Dairy',
      calories: 620,
      price: 120,
      imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Rajma Chawal Bowl',
      description: 'Slow-simmered Kashmiri red kidney beans in aromatic spiced onion-tomato gravy, served over fragrant steamed jeera rice with pickled onions.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Red Kidney Beans, Basmati Rice, Cumin, Tomatoes, Onions, Ginger Garlic, Ghee',
      allergens: 'None',
      calories: 410,
      price: 90,
      imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Creamy Garden Veg Pasta',
      description: 'Durum wheat penne tossed in rich homemade béchamel sauce with fresh broccoli, sweet corn, tricolor bell peppers, and warm garlic toast.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Durum Wheat Penne, Milk, Butter, Broccoli, Sweet Corn, Bell Peppers, Oregano, Cheese',
      allergens: 'Gluten, Dairy',
      calories: 480,
      price: 95,
      imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281788?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'South Indian Masala Idli & Sambar',
      description: 'Steamed fluffy rice cakes sautéed with mustard seeds, curry leaves, and podi spice, served with piping hot vegetable sambar & coconut dip.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Rice, Urad Dal, Curry Leaves, Mustard Seeds, Drumstick, Pumpkin, Toor Dal, Coconut',
      allergens: 'Mustard',
      calories: 340,
      price: 75,
      imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Nutritious Veg Pulao & Raita',
      description: 'Fragrant basmati rice gently spiced with star anise, cloves, green peas, carrots, and french beans. Served with chilled cucumber-mint raita.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Basmati Rice, Green Peas, Carrots, Beans, Mint, Curd, Cumin, Cow Ghee',
      allergens: 'Dairy',
      calories: 390,
      price: 85,
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Chole Kulche Combo',
      description: 'Spiced Kabuli chana cooked in traditional Punjabi spices, accompanied by two soft leavened kulchas, tangy imli chutney, and sliced onions.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Kabuli Chana, Refined Flour, Kasuri Methi, Pomegranate Powder, Ghee, Tamarind',
      allergens: 'Gluten',
      calories: 520,
      price: 105,
      imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Moong Dal Khichdi Bowl (Light & Healthy)',
      description: 'Traditional wholesome yellow lentil and rice comfort dish tempered with pure desi ghee and cumin seeds, served with roasted papad and fresh curd.',
      category: 'LUNCH',
      isVegetarian: true,
      ingredients: 'Moong Dal, Kolam Rice, Cow Ghee, Turmeric, Cumin, Hing, Curd',
      allergens: 'Dairy',
      calories: 330,
      price: 80,
      imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Fresh Fruit & Nut Box',
      description: 'Chilled freshly sliced apple, seedless pomegranate arils, papaya cubes, seedless green grapes, topped with honey-roasted almonds & walnuts.',
      category: 'SNACKS',
      isVegetarian: true,
      ingredients: 'Apple, Pomegranate, Papaya, Grapes, Almonds, Walnuts, Honey',
      allergens: 'Tree Nuts',
      calories: 210,
      price: 60,
      imageUrl: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Grilled Corn & Cheese Sandwich',
      description: 'Multi-grain bread stuffed with sweet corn kernels, melted cheddar cheese, bell peppers, and mild green herb sauce toasted until golden crisp.',
      category: 'SNACKS',
      isVegetarian: true,
      ingredients: 'Multigrain Bread, Sweet Corn, Cheese, Capsicum, Butter, Mint Chutney',
      allergens: 'Gluten, Dairy',
      calories: 310,
      price: 70,
      imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80',
    },
  ];

  const createdMeals = [];
  for (const m of mealsData) {
    const meal = await prisma.meal.create({ data: m });
    createdMeals.push(meal);
  }

  console.log(`✅ Created ${createdMeals.length} meals.`);

  // 6. Create Daily Menus for 10 consecutive days starting today
  // Date format: YYYY-MM-DD
  const daysOffsets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Distribute meals across days
  for (const offset of daysOffsets) {
    const dateStr = getFormattedDate(offset);
    // pick 4-5 meals per day
    // Rotate items so each day has variety
    const selectedIndexes = [
      (offset * 2) % createdMeals.length,
      (offset * 2 + 1) % createdMeals.length,
      (offset * 2 + 2) % createdMeals.length,
      (offset * 2 + 3) % createdMeals.length,
      8, // Fruit box snack
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

  // 7. Create Sample Orders for Parent 1 and Parent 2
  const todayStr = getFormattedDate(0);
  const tomorrowStr = getFormattedDate(1);
  const yesterdayStr = getFormattedDate(-1);

  // Past order (Yesterday) - Collected
  const pastOrder = await prisma.order.create({
    data: {
      id: 'ORD-2026-000101',
      parentId: parentProfile.id,
      totalAmount: 180,
      paymentStatus: 'PAID',
      orderStatus: 'COLLECTED',
      notes: 'No spice for Aarav',
      createdAt: new Date(Date.now() - 24 * 3600 * 1000),
      items: {
        create: [
          {
            studentId: aarav.id,
            mealId: createdMeals[0].id, // Paneer Rice Bowl
            date: yesterdayStr,
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
          {
            studentId: anaya.id,
            mealId: createdMeals[7].id, // Khichdi
            date: yesterdayStr,
            quantity: 1,
            unitPrice: 80,
            totalPrice: 80,
          },
        ],
      },
      payments: {
        create: {
          id: 'PAY-2026-9001',
          amount: 180,
          paymentMethod: 'UPI',
          status: 'SUCCESS',
          transactionRef: 'UPI-982103847291',
          upiId: 'sharma.pooja@okhdfcbank',
          createdAt: new Date(Date.now() - 24 * 3600 * 1000),
        },
      },
    },
  });

  // Today's Order - Preparing
  const todayOrder = await prisma.order.create({
    data: {
      id: 'ORD-2026-000123',
      parentId: parentProfile.id,
      totalAmount: 195,
      paymentStatus: 'PAID',
      orderStatus: 'PREPARING',
      notes: 'Allergy alert: mild lactose intolerance for Anaya',
      createdAt: new Date(),
      items: {
        create: [
          {
            studentId: aarav.id,
            mealId: createdMeals[0].id, // Paneer Rice Bowl
            date: todayStr,
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
          {
            studentId: anaya.id,
            mealId: createdMeals[3].id, // Pasta
            date: todayStr,
            quantity: 1,
            unitPrice: 95,
            totalPrice: 95,
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

  // Other parent's order for Today - Confirmed
  await prisma.order.create({
    data: {
      id: 'ORD-2026-000124',
      parentId: parentProfile2.id,
      totalAmount: 120,
      paymentStatus: 'PAID',
      orderStatus: 'CONFIRMED',
      notes: 'Extra raita please',
      createdAt: new Date(),
      items: {
        create: [
          {
            studentId: kabir.id,
            mealId: createdMeals[1].id, // Deluxe Thali
            date: todayStr,
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
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
  const upcomingOrder = await prisma.order.create({
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
            mealId: createdMeals[1].id, // Veg Thali
            date: tomorrowStr,
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
          },
          {
            studentId: anaya.id,
            mealId: createdMeals[2].id, // Rajma Chawal
            date: tomorrowStr,
            quantity: 1,
            unitPrice: 90,
            totalPrice: 90,
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

  console.log('✅ Created sample orders and payments.');
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
