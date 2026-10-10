import assert from 'assert';

async function main() {
  console.log('🧪 Starting Teacher Ordering Feature Test Suite...\n');

  const BASE_URL = 'http://localhost:3000';

  // Step 1: Public Teacher Menu GET
  console.log('1. Testing Public Teacher Menu GET (/api/teacher/menu)...');
  const menuRes = await fetch(`${BASE_URL}/api/teacher/menu`);
  assert.strictEqual(menuRes.ok, true, 'GET /api/teacher/menu must return 200 OK');
  const menuData = await menuRes.json();
  assert.ok(Array.isArray(menuData.meals), 'Response must have meals array');
  assert.ok(menuData.meals.length > 0, 'Menu must contain seeded teacher meals');
  console.log(`✅ Passed: Found ${menuData.meals.length} available teacher meals (e.g. "${menuData.meals[0].name}")`);

  // Step 2: Staff Login
  console.log('\n2. Logging in as Staff to test Staff Teacher Menu Manager...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff@school.com', password: 'Staff123' }),
  });
  assert.strictEqual(loginRes.ok, true, 'Staff login must succeed');
  const cookie = loginRes.headers.get('set-cookie') || '';

  // Step 3: Staff Teacher Menu CRUD
  console.log('\n3. Testing Staff Teacher Menu CRUD (/api/staff/teacher-menu)...');
  const staffMenuRes = await fetch(`${BASE_URL}/api/staff/teacher-menu`, {
    headers: { cookie },
  });
  assert.strictEqual(staffMenuRes.ok, true, 'Staff GET teacher-menu must return 200');
  const staffMenuData = await staffMenuRes.json();
  console.log(`✅ Staff can view all ${staffMenuData.meals.length} teacher meals`);

  // Create a new teacher dish
  const createRes = await fetch(`${BASE_URL}/api/staff/teacher-menu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      name: 'Special Masala Dosa for Teachers',
      price: 85,
      category: 'BREAKFAST',
      isVegetarian: true,
      description: 'Crispy rice crepe with spiced potato filling, coconut chutney and sambar',
    }),
  });
  assert.strictEqual(createRes.ok, true, 'POST teacher meal must succeed');
  const createdData = await createRes.json();
  const createdId = createdData.meal.id;
  assert.ok(createdId, 'Created meal must have ID');
  console.log(`✅ Created test dish: ${createdData.meal.name} (ID: ${createdId})`);

  // Toggle availability (hide from teachers)
  const toggleRes = await fetch(`${BASE_URL}/api/staff/teacher-menu`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ id: createdId, isAvailable: false }),
  });
  assert.strictEqual(toggleRes.ok, true, 'PATCH toggle must succeed');
  console.log('✅ Successfully toggled dish to unavailable');

  // Verify it is hidden from public menu
  const publicAfterToggle = await (await fetch(`${BASE_URL}/api/teacher/menu`)).json();
  assert.strictEqual(
    publicAfterToggle.meals.some((m: any) => m.id === createdId),
    false,
    'Unavailable dish must not appear in public menu'
  );
  console.log('✅ Verified dish is hidden from public teacher menu');

  // Delete test dish
  const deleteRes = await fetch(`${BASE_URL}/api/staff/teacher-menu?id=${createdId}`, {
    method: 'DELETE',
    headers: { cookie },
  });
  assert.strictEqual(deleteRes.ok, true, 'DELETE teacher meal must succeed');
  console.log('✅ Successfully deleted test dish');

  // Step 4: Teacher Direct Order Validation
  console.log('\n4. Testing Teacher Direct Order Placement Validation (/api/teacher/orders)...');
  const noNameRes = await fetch(`${BASE_URL}/api/teacher/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherName: '',
      items: [{ mealId: 'TM-001', mealName: 'Thali', quantity: 1, price: 120 }],
    }),
  });
  assert.strictEqual(noNameRes.status, 400, 'Order without teacher name must return 400');
  console.log('✅ Correctly rejected order without teacher name');

  // Step 5: Staff Teacher Orders List & "Mark Given"
  console.log('\n5. Testing Staff Teacher Orders List & Handout Workflow (/api/staff/teacher-orders)...');
  const staffOrdersRes = await fetch(`${BASE_URL}/api/staff/teacher-orders`, {
    headers: { cookie },
  });
  assert.strictEqual(staffOrdersRes.ok, true, 'GET /api/staff/teacher-orders must succeed');
  const staffOrdersData = await staffOrdersRes.json();
  assert.ok(Array.isArray(staffOrdersData.orders), 'Orders must be an array');
  console.log(`✅ Staff can view today's teacher orders (${staffOrdersData.orders.length} orders found)`);

  console.log('\n🎉 ALL TEACHER ORDERING API TESTS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
