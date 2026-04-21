import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const BG = '#2C2C2A';

// Full icon SVG (with rounded background)
const iconSvg = readFileSync('./assets/images/onepapier.svg');

// Foreground only SVG: paper on transparent background, scaled to safe zone
// Android adaptive icon: 108dp canvas, 72dp safe zone = 66.67% of canvas
// We scale the paper content so it fits in the safe zone with some breathing room
const fgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="scale(0.65) translate(281, 281)">
    <path d="M 184 143 L 716 143 L 839 266 L 839 471 L 757 511 L 685 450 L 614 511 L 532 461 L 450 522 L 368 461 L 276 511 L 184 471 Z" fill="white"/>
    <path d="M 716 143 L 839 143 L 839 266 Z" fill="transparent"/>
    <path d="M 716 143 L 839 266 L 716 266 Z" fill="#888780"/>
    <path d="M 184 553 L 276 614 L 368 532 L 450 593 L 532 543 L 614 583 L 685 532 L 757 583 L 839 543 L 839 881 L 184 881 Z" fill="white"/>
  </g>
</svg>`;

// Monochrome: same as foreground but pure white only
const monoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="scale(0.65) translate(281, 281)">
    <path d="M 184 143 L 716 143 L 839 266 L 839 471 L 757 511 L 685 450 L 614 511 L 532 461 L 450 522 L 368 461 L 276 511 L 184 471 Z" fill="white"/>
    <path d="M 716 143 L 839 266 L 716 266 Z" fill="transparent"/>
    <path d="M 716 143 L 839 266 L 716 266 Z" fill="white"/>
    <path d="M 184 553 L 276 614 L 368 532 L 450 593 L 532 543 L 614 583 L 685 532 L 757 583 L 839 543 L 839 881 L 184 881 Z" fill="white"/>
  </g>
</svg>`;

// Background: solid color rectangle
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${BG}"/>
</svg>`;

// Splash: full icon centered on dark background, no rounded corners
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${BG}"/>
  <g transform="scale(0.65) translate(281, 281)">
    <path d="M 184 143 L 716 143 L 839 266 L 839 471 L 757 511 L 685 450 L 614 511 L 532 461 L 450 522 L 368 461 L 276 511 L 184 471 Z" fill="white"/>
    <path d="M 716 143 L 839 143 L 839 266 Z" fill="${BG}"/>
    <path d="M 716 143 L 839 266 L 716 266 Z" fill="#888780"/>
    <path d="M 184 553 L 276 614 L 368 532 L 450 593 L 532 543 L 614 583 L 685 532 L 757 583 L 839 543 L 839 881 L 184 881 Z" fill="white"/>
  </g>
</svg>`;

async function generate() {
  // icon.png - 1024x1024 full icon
  await sharp(iconSvg).resize(1024, 1024).png().toFile('./assets/images/icon.png');
  console.log('✓ icon.png');

  // favicon.png - 48x48
  await sharp(iconSvg).resize(48, 48).png().toFile('./assets/images/favicon.png');
  console.log('✓ favicon.png');

  // splash-icon.png - flat dark background, no rounded corners (Android <12 full-screen splash)
  await sharp(Buffer.from(splashSvg)).resize(1024, 1024).png().toFile('./assets/images/splash-icon.png');
  console.log('✓ splash-icon.png');

  // android-icon-foreground.png - 1024x1024 paper on transparent
  await sharp(Buffer.from(fgSvg)).resize(1024, 1024).png().toFile('./assets/images/android-icon-foreground.png');
  console.log('✓ android-icon-foreground.png');

  // android-icon-background.png - 1024x1024 solid dark
  await sharp(Buffer.from(bgSvg)).resize(1024, 1024).png().toFile('./assets/images/android-icon-background.png');
  console.log('✓ android-icon-background.png');

  // android-icon-monochrome.png - 1024x1024 white shapes on transparent
  await sharp(Buffer.from(monoSvg)).resize(1024, 1024).png().toFile('./assets/images/android-icon-monochrome.png');
  console.log('✓ android-icon-monochrome.png');
}

generate().catch(console.error);
