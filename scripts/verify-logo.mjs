import sharp from 'sharp';

const L = await sharp('public/logo-v26.png').resize(256, 256).png().toBuffer();
const circMask = Buffer.from(
  `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
    <circle cx="128" cy="128" r="128" fill="white"/>
  </svg>`
);
const circled = await sharp(L)
  .ensureAlpha()
  .composite([{ input: circMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 600,
    height: 320,
    channels: 3,
    background: { r: 255, g: 105, b: 180 },
  },
})
  .composite([
    { input: L, left: 30, top: 32 },
    { input: circled, left: 320, top: 32 },
  ])
  .png()
  .toFile('public/logo-verify-pink.png');

console.log('wrote public/logo-verify-pink.png');
