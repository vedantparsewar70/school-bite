async function testUrls() {
  const urls = [
    'http://localhost:3000/favicon.ico',
    'http://localhost:3000/icon.png',
    'http://localhost:3000/apple-icon.png',
    'http://localhost:3000/logo.png',
    'http://localhost:3000/manifest.json',
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u);
      console.log(`${u} -> HTTP ${res.status} [${res.headers.get('content-type')}] (${res.headers.get('content-length')} bytes)`);
    } catch (e: any) {
      console.error(`${u} -> FAILED: ${e.message}`);
    }
  }
}

testUrls();
