import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SOURCE_IMAGE = 'C:/Users/Vaibhav/.gemini/antigravity-ide/brain/23afe046-6cb1-4830-bbc2-c26f59ac943f/.user_uploaded/media_1791648085909.png';
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const APP_DIR = path.join(ROOT_DIR, 'app');

async function buildIco(inputPath: string, sizes = [16, 32, 48]): Promise<Buffer> {
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(inputPath).resize(size, size).png().toBuffer())
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(sizes.length, 4); // count

  let offset = 6 + sizes.length * 16;
  const entries: Buffer[] = [];

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += buf.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

async function main() {
  console.log('Generating School Bite branding assets from master image...');
  if (!fs.existsSync(SOURCE_IMAGE)) {
    throw new Error(`Master logo file not found at ${SOURCE_IMAGE}`);
  }

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // 1. /public/logo.png (512x512)
  const logo512 = await sharp(SOURCE_IMAGE)
    .resize(512, 512)
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.png'), logo512);
  console.log('✓ Created /public/logo.png (512x512)');

  // 2. /public/logo.webp (512x512)
  const logoWebp = await sharp(SOURCE_IMAGE)
    .resize(512, 512)
    .webp({ quality: 90 })
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.webp'), logoWebp);
  console.log('✓ Created /public/logo.webp (512x512)');

  // 3. /public/icon.png (192x192) and /public/icon-512.png (512x512)
  const icon192 = await sharp(SOURCE_IMAGE)
    .resize(192, 192)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.png'), icon192);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-512.png'), logo512);
  console.log('✓ Created /public/icon.png and /public/icon-512.png');

  // 4. /public/apple-icon.png (180x180)
  const apple180 = await sharp(SOURCE_IMAGE)
    .resize(180, 180)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-icon.png'), apple180);
  console.log('✓ Created /public/apple-icon.png (180x180)');

  // 5. Next.js App Router metadata icons in /app
  fs.writeFileSync(path.join(APP_DIR, 'icon.png'), icon192);
  fs.writeFileSync(path.join(APP_DIR, 'apple-icon.png'), apple180);
  console.log('✓ Created /app/icon.png and /app/apple-icon.png');

  // 6. ICO generation (replaces default Vercel favicon)
  const icoBuffer = await buildIco(SOURCE_IMAGE, [16, 32, 48]);
  fs.writeFileSync(path.join(APP_DIR, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log('✓ Created /app/favicon.ico and /public/favicon.ico (Replacing Vercel favicon)');

  // 7. /public/manifest.json (PWA & browser metadata)
  const manifest = {
    name: 'School Bite - School Meal Pre-Ordering Platform',
    short_name: 'School Bite',
    description: 'School meal pre-ordering platform for parents at S.B. Patil School',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f97316',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
  fs.writeFileSync(path.join(PUBLIC_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('✓ Created /public/manifest.json');

  console.log('All School Bite branding assets generated successfully!');
}

main().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
