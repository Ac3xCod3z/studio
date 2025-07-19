const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgIcon = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
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
    await generateIcons();
    createAssetLinks();
}

main().catch(err => {
    console.error('Error generating PWA assets:', err);
    process.exit(1);
});
