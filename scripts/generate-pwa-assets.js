

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgIcon = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 160 120"
>
    <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feOffset result="offOut" in="SourceAlpha" dx="1" dy="1" />
            <feGaussianBlur result="blurOut" in="offOut" stdDeviation="1" />
            <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
        </filter>
    </defs>
    <g filter="url(#shadow)">
        <circle cx="80" cy="50" r="40" fill="#F0EFEF" />
        <path
            d="M40 90 V50 H50 V40 H110 V50 H120 V90 H110 V50 H95 V40 H65 V50 H50 V90 H40 Z"
            fill="#C0392B"
        />
        <path
            d="M30 40 C30 30, 130 30, 130 40 H120 C120 35, 40 35, 40 40 H30 Z"
            fill="#C0392B"
        />
        <text
            x="80"
            y="110"
            fontFamily="sans-serif"
            fontWeight="bold"
            fontSize="20"
            fill="#FFFFFF"
            stroke="#000000"
            strokeWidth="0.5"
            textAnchor="middle"
            alignmentBaseline="middle"
        >
            CENTSEI
        </text>
    </g>
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
