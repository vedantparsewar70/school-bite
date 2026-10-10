import https from 'https';

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
  { name: 'Legal/Proprietor Name (GANESH GOPAL UDAS)', pattern: /GANESH GOPAL UDAS/i },
  { name: 'Business Name (Bright Catering)', pattern: /BRIGHT CATERING/i },
  { name: 'Trade Name (Bright Designers)', pattern: /BRIGHT DESIGNERS/i },
  { name: 'Trade Name (New Bright Xerox)', pattern: /NEW BRIGHT XEROX/i },
  { name: 'Customer Email (gayatriparsewar@gmail.com)', pattern: /gayatriparsewar@gmail\.com/i },
  { name: 'Customer Phone (9922028988)', pattern: /9922028988/ },
  { name: 'Website URL (school-bite.vercel.app)', pattern: /school-bite\.vercel\.app/i },
];

function fetchPage(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
  console.log('=== CHECKING CURRENT LIVE VERCEL DEPLOYMENT ===\n');

  for (const page of PAGES) {
    const url = `https://school-bite.vercel.app${page}`;
    try {
      const res = await fetchPage(url);
      console.log(`Live URL: ${url} (HTTP ${res.statusCode}):`);
      for (const item of REQUIRED_ITEMS) {
        const found = item.pattern.test(res.body);
        console.log(`  ${found ? '✓' : '✗'} ${item.name}`);
      }
      console.log('');
    } catch (err: any) {
      console.error(`Failed to fetch ${url}:`, err.message);
    }
  }
}

run();
