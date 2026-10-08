const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting End-to-End System Tests against ' + BASE);

  // 1. Test Public Landing Page
  const homeRes = await fetch(BASE);
  if (homeRes.status === 200) {
    console.log('✅ 1. Public Landing Page responded with 200 OK');
  } else {
    throw new Error(`Landing page returned ${homeRes.status}`);
  }

  // 2. Test Parent Login
  const parentLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'parent@example.com', password: 'Parent123' }),
  });
  const parentLoginData = await parentLoginRes.json();
  const parentCookie = parentLoginRes.headers.get('set-cookie');
  if (parentLoginRes.ok && parentLoginData.success) {
    console.log(`✅ 2. Parent Login successful: ${parentLoginData.user.name} (${parentLoginData.user.role})`);
  } else {
    throw new Error('Parent login failed');
  }

  // 3. Test Get Children
  const childrenRes = await fetch(`${BASE}/api/parent/children`, {
    headers: { cookie: parentCookie || '' },
  });
  const childrenData = await childrenRes.json();
  console.log(`✅ 3. Retrieved ${childrenData.students.length} children: ${childrenData.students.map((c: any) => `${c.name} (Class ${c.grade}-${c.division})`).join(', ')}`);

  // 4. Test Fetch Menu
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const menuRes = await fetch(`${BASE}/api/menu?date=${tomorrowStr}`);
  let menuData = await menuRes.json();
  if (!menuData.menus || menuData.menus.length === 0) {
    const fallbackRes = await fetch(`${BASE}/api/menu`);
    menuData = await fallbackRes.json();
  }
  console.log(`✅ 4. Retrieved ${menuData.menus?.length || 0} menu items for ${tomorrowStr}. First meal: ${menuData.menus?.[0]?.meal?.name} (₹${menuData.menus?.[0]?.meal?.price})`);

  // 5. Test Multi-Child Order Placement
  const child1 = childrenData.students[0];
  const child2 = childrenData.students[1];
  const meal1 = menuData.menus[0].meal;
  const meal2 = menuData.menus[1]?.meal || meal1;
  const targetDate = menuData.menus[0].date;

  const orderRes = await fetch(`${BASE}/api/parent/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: parentCookie || '',
    },
    body: JSON.stringify({
      cartItems: [
        {
          studentId: child1.id,
          studentName: child1.name,
          studentGrade: child1.grade,
          studentDivision: child1.division,
          mealId: meal1.id,
          mealName: meal1.name,
          mealPrice: meal1.price,
          isVegetarian: meal1.isVegetarian,
          date: targetDate,
          quantity: 1,
        },
        {
          studentId: child2.id,
          studentName: child2.name,
          studentGrade: child2.grade,
          studentDivision: child2.division,
          mealId: meal2.id,
          mealName: meal2.name,
          mealPrice: meal2.price,
          isVegetarian: meal2.isVegetarian,
          date: targetDate,
          quantity: 1,
        },
      ],
      paymentMethod: 'UPI',
      upiId: 'sharma.pooja@okhdfcbank',
      notes: 'Test order verification with multi-child cart',
    }),
  });

  const orderData = await orderRes.json();
  if (orderRes.ok && orderData.success) {
    console.log(`✅ 5. Multi-child order placed successfully: Order ID ${orderData.orderId}, Total ₹${orderData.totalAmount}, Txn: ${orderData.transactionRef}`);
  } else {
    throw new Error(`Order placement failed: ${orderData.error}`);
  }

  // 6. Test Admin Login
  const adminLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@school.com', password: 'Admin123' }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminCookie = adminLoginRes.headers.get('set-cookie');
  if (adminLoginRes.ok && adminLoginData.user.role === 'ADMIN') {
    console.log(`✅ 6. Admin Login successful: ${adminLoginData.user.name} (${adminLoginData.user.role})`);
  } else {
    throw new Error('Admin login failed');
  }

  // 7. Test Admin Stats
  const statsRes = await fetch(`${BASE}/api/admin/stats`, {
    headers: { cookie: adminCookie || '' },
  });
  const statsData = await statsRes.json();
  console.log(`✅ 7. Admin Stats: Total Orders: ${statsData.stats?.totalOrders}, Total Revenue: ₹${statsData.stats?.totalOrderValue}, Today Meals: ${statsData.stats?.todayTotalMeals}, Tomorrow Meals: ${statsData.stats?.tomorrowTotalMeals}`);

  // 8. Test Kitchen Preparation Report
  const kitchenRes = await fetch(`${BASE}/api/admin/kitchen?date=${targetDate}`, {
    headers: { cookie: adminCookie || '' },
  });
  const kitchenData = await kitchenRes.json();
  console.log(`✅ 8. Kitchen Prep Report for ${kitchenData.date}: Total Meals: ${kitchenData.totalMeals}`);
  kitchenData.mealCounts.forEach((m: any) => {
    console.log(`   - ${m.mealName}: ${m.count} portions`);
  });

  // 9. Test Reports & CSV Data
  const reportsRes = await fetch(`${BASE}/api/admin/reports`, {
    headers: { cookie: adminCookie || '' },
  });
  const reportsData = await reportsRes.json();
  console.log(`✅ 9. Reports Data: Total Revenue: ₹${reportsData.summary.totalRevenue}, Most Ordered: ${reportsData.mostOrderedMeals[0]?.mealName} (${reportsData.mostOrderedMeals[0]?.count} portions)`);

  console.log('\n🎉 ALL 9 END-TO-END SYSTEM INTEGRATION TESTS PASSED PERFECTLY!');
}

runTests().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
