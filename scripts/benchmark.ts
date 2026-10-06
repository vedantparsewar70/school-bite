import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:3000';

async function measureRequest(name: string, fn: () => Promise<Response>) {
  const start = performance.now();
  let res: Response;
  try {
    res = await fn();
    const duration = performance.now() - start;
    let dataSize = 0;
    try {
      const text = await res.text();
      dataSize = text.length;
    } catch {}
    console.log(`[BENCHMARK] ${name}: ${duration.toFixed(1)}ms | Status: ${res.status} | Size: ${dataSize} bytes`);
    return { name, duration, status: res.status, dataSize };
  } catch (err: any) {
    const duration = performance.now() - start;
    console.log(`[BENCHMARK] ${name}: FAILED after ${duration.toFixed(1)}ms - ${err.message}`);
    return { name, duration, status: 0, error: err.message };
  }
}

async function runBenchmark() {
  console.log('=== BENCHMARK STARTED ===\n');

  // 1. Staff Login
  let staffCookie = '';
  await measureRequest('1. Staff Login POST /api/auth/login', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'staff@school.com',
        password: process.env.STAFF_PASS || 'Staff123',
        requestedRole: 'staff',
      }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      staffCookie = setCookie.split(';')[0];
    }
    return res;
  });

  // 2. Staff Auth Verification /api/auth/me
  await measureRequest('2. Staff GET /api/auth/me', () =>
    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: staffCookie },
    })
  );

  // 3. Staff Kitchen Production GET /api/admin/kitchen
  await measureRequest("3. Staff Kitchen GET /api/admin/kitchen (Tomorrow's date)", () =>
    fetch(`${BASE_URL}/api/admin/kitchen?date=2026-10-07`, {
      headers: { Cookie: staffCookie },
    })
  );

  // 4. Staff Orders GET /api/admin/orders
  await measureRequest("4. Staff Orders GET /api/admin/orders (Tomorrow's date)", () =>
    fetch(`${BASE_URL}/api/admin/orders?date=2026-10-07`, {
      headers: { Cookie: staffCookie },
    })
  );

  // 5. Admin Login
  let adminCookie = '';
  await measureRequest('5. Admin Login POST /api/auth/login', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@school.com',
        password: process.env.ADMIN_PASS || 'Admin123',
        requestedRole: 'admin',
      }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      adminCookie = setCookie.split(';')[0];
    }
    return res;
  });

  // 6. Admin Stats GET /api/admin/stats
  await measureRequest('6. Admin Dashboard GET /api/admin/stats', () =>
    fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    })
  );

  // 7. Parent Login & Orders History
  let parentCookie = '';
  await measureRequest('7. Parent Login POST /api/auth/login', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'parent@example.com',
        password: 'Parent123',
      }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      parentCookie = setCookie.split(';')[0];
    }
    return res;
  });

  // 8. Parent History GET /api/parent/orders
  if (parentCookie) {
    await measureRequest('8. Parent Order History GET /api/parent/orders', () =>
      fetch(`${BASE_URL}/api/parent/orders`, {
        headers: { Cookie: parentCookie },
      })
    );
  }

  // 9. Public Menu GET /api/menu
  await measureRequest('9. Menu GET /api/menu?date=2026-10-07', () =>
    fetch(`${BASE_URL}/api/menu?date=2026-10-07`)
  );

  console.log('\n=== BENCHMARK COMPLETED ===');
}

runBenchmark();
