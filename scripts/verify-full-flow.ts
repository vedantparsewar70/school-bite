export {};

const BASE_URL = 'http://localhost:3000';

function getOffsetDate(offset: number = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

async function run() {
  console.log('🧪 Starting Full Flow Automated Verification...');
  const tomorrow = getOffsetDate(1);
  console.log(`📅 Testing for Tomorrow's Date: ${tomorrow}`);

  // 1. PARENT LOGIN
  console.log('\n--- 1. Testing Parent Login ---');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'parent@example.com', password: 'Parent123' })
  });
  const loginData = await loginRes.json();
  if (loginRes.status !== 200) {
    throw new Error(`Parent login failed: ${JSON.stringify(loginData)}`);
  }
  const setCookie = loginRes.headers.get('set-cookie');
  const sessionCookie = setCookie?.split(';')[0] || '';
  console.log(`✅ Parent logged in successfully: ${loginData.user.name} (${loginData.user.role})`);
  console.log(`🔑 Cookie received: ${sessionCookie.slice(0, 30)}...`);

  // 2. FETCH CHILDREN
  console.log('\n--- 2. Testing Fetch Children ---');
  const childrenRes = await fetch(`${BASE_URL}/api/parent/children`, {
    headers: { Cookie: sessionCookie }
  });
  const childrenData = await childrenRes.json();
  const children = childrenData.students || [];
  console.log(`✅ Retrieved ${children.length} children for parent`);
  let activeChild = children[0];

  // 3. ADD A NEW CHILD
  console.log('\n--- 3. Testing Add Child ---');
  const newChildRes = await fetch(`${BASE_URL}/api/parent/children`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      name: `Test Child ${Date.now() % 1000}`,
      grade: '4',
      division: 'B',
      rollNo: '42',
      allergies: 'Peanuts'
    })
  });
  const newChildData = await newChildRes.json();
  if (newChildRes.status !== 201 && newChildRes.status !== 200) {
    throw new Error(`Failed to add child: ${JSON.stringify(newChildData)}`);
  }
  const createdChild = newChildData.student || newChildData;
  console.log(`✅ Successfully added new child: ${createdChild.name} (ID: ${createdChild.id})`);
  activeChild = createdChild;

  // 4. ADMIN LOGIN
  console.log('\n--- 4. Testing Admin Login ---');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@school.com', password: 'Admin123' })
  });
  const adminLoginData = await adminLoginRes.json();
  if (adminLoginRes.status !== 200) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
  }
  const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
  console.log(`✅ Admin logged in: ${adminLoginData.user.name} (${adminLoginData.user.role})`);

  // 5. ADMIN TOMORROW'S MENU PUBLISHING
  console.log('\n--- 5. Testing Admin Menu Publishing for Tomorrow ---');
  // First fetch master meals
  const mealsRes = await fetch(`${BASE_URL}/api/admin/meals`, {
    headers: { Cookie: adminCookie }
  });
  const mealsData = await mealsRes.json();
  const meals = mealsData.meals || mealsData;
  if (!Array.isArray(meals) || meals.length === 0) {
    throw new Error(`No master meals found: ${JSON.stringify(mealsData)}`);
  }
  console.log(`Found ${meals.length} master meals in catalog`);

  // Select the first 2 meals to publish for tomorrow
  const selectedMeals = meals.slice(0, 2);
  const selectedMealIds = selectedMeals.map((m: any) => m.id);
  console.log(`Selecting meals to publish: ${selectedMeals.map((m: any) => m.name).join(', ')}`);

  const publishRes = await fetch(`${BASE_URL}/api/admin/menus/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie
    },
    body: JSON.stringify({
      date: tomorrow,
      selectedMealIds
    })
  });
  const publishText = await publishRes.text();
  console.log(`Publish HTTP ${publishRes.status}: ${publishText}`);
  let publishData;
  try {
    publishData = JSON.parse(publishText);
  } catch (e) {
    throw new Error(`Failed to parse publish JSON: ${publishText}`);
  }
  if (publishRes.status !== 200) {
    throw new Error(`Failed to publish menu: ${JSON.stringify(publishData)}`);
  }
  console.log(`✅ Admin successfully published menu for ${tomorrow} (published count: ${selectedMealIds.length})`);

  // 6. PARENT TOMORROW'S MENU QUERY
  console.log("\n--- 6. Testing Parent Tomorrow's Menu Visibility ---");
  const parentMenuRes = await fetch(`${BASE_URL}/api/menu?date=${tomorrow}`, {
    headers: { Cookie: sessionCookie }
  });
  const parentMenuData = await parentMenuRes.json();
  const parentMenuItems = parentMenuData.menus || parentMenuData;
  console.log(`Parent received ${parentMenuItems.length} menu items for ${tomorrow}`);
  const parentMealIds = parentMenuItems.map((item: any) => item.mealId);
  
  // Verify that only published items appear
  for (const m of parentMenuItems) {
    if (!selectedMealIds.includes(m.mealId)) {
      throw new Error(`Unexpected unselected meal ${m.meal?.name} showed up in tomorrow's menu!`);
    }
  }
  console.log(`✅ Verification passed: Only the ${parentMenuItems.length} Admin-published meals are visible to parents!`);

  // 7. ORDER CREATION WITH IDEMPOTENCY
  console.log('\n--- 7. Testing Order Creation & Duplicate Protection ---');
  const targetItem = parentMenuItems[0];
  const orderDate = tomorrow;
  const idempotencyKey = `ORD_IDEM_${Date.now()}`;
  const orderPayload = {
    cartItems: [
      {
        mealId: targetItem.mealId,
        studentId: activeChild.id,
        studentName: activeChild.name,
        date: orderDate,
        quantity: 2,
        meal: {
          id: targetItem.mealId,
          name: targetItem.meal.name,
          price: targetItem.meal.price
        }
      }
    ],
    paymentMethod: 'UPI',
    upiId: 'parent@okhdfcbank',
    idempotencyKey
  };

  const orderRes = await fetch(`${BASE_URL}/api/parent/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify(orderPayload)
  });
  const orderData = await orderRes.json();
  if (orderRes.status !== 201 && orderRes.status !== 200) {
    throw new Error(`Order creation failed: ${JSON.stringify(orderData)}`);
  }
  const createdOrderId = orderData.orderId || orderData.order?.id;
  console.log(`✅ Order created successfully! ID: ${createdOrderId}, Status: ${orderData.order?.orderStatus || 'CONFIRMED'}, Payment: ${orderData.order?.paymentStatus || 'PAID'}`);

  // Test Duplicate Submission with same idempotencyKey
  console.log('Sending duplicate request with same idempotencyKey...');
  const dupRes = await fetch(`${BASE_URL}/api/parent/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify(orderPayload)
  });
  const dupData = await dupRes.json();
  const dupOrderId = dupData.orderId || dupData.order?.id;
  if (dupOrderId !== createdOrderId) {
    throw new Error(`Duplicate protection failed! Expected order ${createdOrderId}, got ${dupOrderId}`);
  }
  console.log(`✅ Duplicate protection verified: Returned existing order ID ${dupOrderId} (isDuplicate: ${dupData.isDuplicateSubmission})!`);

  // 8. PARENT ORDER HISTORY
  console.log('\n--- 8. Testing Parent Order History ---');
  const historyRes = await fetch(`${BASE_URL}/api/parent/orders`, {
    headers: { Cookie: sessionCookie }
  });
  const historyData = await historyRes.json();
  const historyOrders = historyData.orders || historyData;
  const foundOrder = historyOrders.find((o: any) => o.id === createdOrderId);
  if (!foundOrder) {
    throw new Error(`Created order ${createdOrderId} not found in parent order history!`);
  }
  console.log(`✅ Order found in Parent History! Student: ${foundOrder.items?.[0]?.studentName}, Total: ₹${foundOrder.totalAmount}`);

  // 9. ADMIN ORDER VIEW
  console.log("\n--- 9. Testing Admin View for Tomorrow's Orders ---");
  const adminOrdersRes = await fetch(`${BASE_URL}/api/admin/orders?date=${tomorrow}`, {
    headers: { Cookie: adminCookie }
  });
  const adminOrdersData = await adminOrdersRes.json();
  const adminOrders = adminOrdersData.orders || adminOrdersData;
  const adminFound = adminOrders.find((o: any) => o.id === createdOrderId);
  if (!adminFound) {
    throw new Error(`Order ${createdOrderId} not visible in Admin orders for ${tomorrow}!`);
  }
  console.log(`✅ Order found in Admin Orders for ${tomorrow}!`);
  console.log(`   Student: ${adminFound.items?.[0]?.studentName} (Class ${adminFound.items?.[0]?.studentGrade}-${adminFound.items?.[0]?.studentDivision})`);
  console.log(`   Parent: ${adminFound.parentName} (${adminFound.parentEmail})`);
  console.log(`   Meal: ${adminFound.items?.[0]?.mealName} x ${adminFound.items?.[0]?.quantity}`);
  console.log(`   Amount: ₹${adminFound.totalAmount}, Payment: ${adminFound.paymentStatus}, Order Status: ${adminFound.orderStatus}`);

  console.log('\n🎉 ALL PARENT AND ADMIN FLOW TESTS PASSED SUCCESSFULLY! 🚀');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
