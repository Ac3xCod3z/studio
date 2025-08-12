

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svgIcon = `
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
    <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feOffset result="offOut" in="SourceAlpha" dx="5" dy="5" />
            <feGaussianBlur result="blurOut" in="offOut" stdDeviation="5" />
            <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
        </filter>
    </defs>
    <g filter="url(#shadow)">
        <circle cx="250" cy="250" r="240" fill="#F0EFEB" stroke="black" strokeWidth="2" />
        <path d="M100,400 L100,150 C100,120 120,100 150,100 L350,100 C380,100 400,120 400,150 L400,400" stroke="black" strokeWidth="20" fill="none"/>
        <path d="M50,150 L450,150 C480,150 500,170 500,200 L0,200 C0,170 20,150 50,150" transform="translate(0, -50)" stroke="black" strokeWidth="20" fill="#D12920"/>
        <path d="M75,400 L425,400" stroke="black" strokeWidth="20" fill="none"/>
        <text x="250" y="460" fontFamily="Arial, sans-serif" fontSize="60" fontWeight="bold" fill="white" stroke="black" strokeWidth="2" textAnchor="middle" dominantBaseline="middle">CENTSEI</text>
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
