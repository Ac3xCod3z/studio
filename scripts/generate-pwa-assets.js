

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgIcon = `
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
    <circle cx="250" cy="250" r="200" fill="#F7F4EF"/>
    <path d="M100,380 V150 h50 v170 h150 v-170 h50 v230 h-250
             M125,150 h250 a20,20 0 0,0 -250,0
             M100,150 a150,20 0 0,1 300,0"
          fill="#D12920"
          stroke="#D12920"
          strokeWidth="5"
    />
</svg>
`;

const publicDir = path.join(__dirname, '..', 'public');
const wellKnownDir = path.join(publicDir, '.well-known');
const iconSource = path.join(__dirname, '..', 'public', 'logo.png');

async function generateIcons() {
  if (!fs.existsSync(iconSource)) {
    console.log(`Icon source not found at ${iconSource}. Using default SVG.`);
    const svgBuffer = Buffer.from(svgIcon);
    for (const size of [192, 512]) {
        const outputPath = path.join(publicDir, `icon-${size}x${size}.png`);
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`Generated icon: ${outputPath}`);
    }
    return;
  }

  // Define icon sizes
  const sizes = [192, 512];

  for (const size of sizes) {
    const outputPath = path.join(publicDir, `icon-${size}x${size}.png`);
    await sharp(iconSource)
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


