const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgIcon = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#38A3A5"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
    <path d="M12 18a6 6 0 0 0 6-6h-6V6a6 6 0 0 0-6 6h6v6z" />
    <path d="M12 6V3" />
    <path d="M12 3l2 2" />
    <path d="M12 3l-2 2" />
  </svg>
`;

const publicDir = path.join(__dirname, '..', 'public');
const wellKnownDir = path.join(publicDir, '.well-known');

async function generateIcons() {
  const svgBuffer = Buffer.from(svgIcon);

  // Define icon sizes
  const sizes = [192, 512];

  for (const size of sizes) {
    const outputPath = path.join(publicDir, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated icon: ${outputPath}`);
  }
}

function createAssetLinks() {
    if (!fs.existsSync(wellKnownDir)) {
        fs.mkdirSync(wellKnownDir, { recursive: true });
    }
    const assetLinksPath = path.join(wellKnownDir, 'assetlinks.json');
    if (!fs.existsSync(assetLinksPath)) {
        fs.writeFileSync(assetLinksPath, '[]', 'utf-8');
        console.log(`Generated empty assetlinks.json at: ${assetLinksPath}`);
    } else {
        console.log('assetlinks.json already exists.');
    }
}

async function main() {
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    await generateIcons();
    createAssetLinks();
}

main().catch(err => {
    console.error('Error generating PWA assets:', err);
    process.exit(1);
});
