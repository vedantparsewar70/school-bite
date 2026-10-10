import http from 'http';

const PAGES = [
  '/',
  '/about',
  '/contact',
  '/terms-and-conditions',
  '/privacy-policy',
  '/refund-policy',
  '/delivery-policy',
];

const REQUIRED_ITEMS = [
  { name: 'Legal/Proprietor Name', pattern: /GANESH GOPAL UDAS/i },
  { name: 'Business Name (Bright Catering)', pattern: /BRIGHT CATERING/i },
  { name: 'Trade Name (Bright Designers)', pattern: /BRIGHT DESIGNERS/i },
  { name: 'Trade Name (New Bright Xerox)', pattern: /NEW BRIGHT XEROX/i },
  { name: 'Customer Email', pattern: /gayatriparsewar@gmail\.com/i },
  { name: 'Customer Phone (Raw)', pattern: /9922028988/ },
  { name: 'Customer Phone (Formatted)', pattern: /\+91 99220 28988/ },
  { name: 'Website URL', pattern: /https:\/\/school-bite\.vercel\.app/i },
];

function fetchPage(path: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, body: data });
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('=== VERIFYING CASHFREE COMPLIANCE ON LOCAL PAGES ===\n');
  let allPassed = true;

  for (const page of PAGES) {
    try {
      const res = await fetchPage(page);
      console.log(`Checking [${page}] - HTTP ${res.statusCode}:`);
      if (res.statusCode !== 200) {
        console.error(`  FAIL: Expected HTTP 200, got ${res.statusCode}`);
        allPassed = false;
        continue;
      }

      let pagePassed = true;
      for (const item of REQUIRED_ITEMS) {
        const hasMatch = item.pattern.test(res.body);
        if (hasMatch) {
          console.log(`  ✓ ${item.name}`);
        } else {
          console.error(`  ✗ MISSING: ${item.name}`);
          pagePassed = false;
          allPassed = false;
        }
      }

      if (pagePassed) {
        console.log(`  -> ALL REQUIRED ITEMS FOUND ON ${page}\n`);
      } else {
        console.log(`  -> GAPS DETECTED ON ${page}\n`);
      }
    } catch (err: any) {
      console.error(`Failed to fetch ${page}:`, err.message);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('==================================================');
    console.log('SUCCESS: All 7 pages contain all compliance items!');
    console.log('==================================================');
    process.exit(0);
  } else {
    console.error('==================================================');
    console.error('FAILURE: Some compliance items are missing.');
    console.error('==================================================');
    process.exit(1);
  }
}

run();
