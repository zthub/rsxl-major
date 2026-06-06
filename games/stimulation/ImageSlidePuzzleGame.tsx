import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

type LevelDef = {
  id: number;
  title: string;
  imageDataUri: string;
};

const GAME_STORAGE_KEY = 'image_slide_puzzle_v1';
const TOTAL_LEVELS = 50;
const FREE_SWITCH_LEVELS = 20;
const GRID_SIZE = 3; // fixed 3x3

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function encodeSvgDataUri(svg: string) {
  // Keep it compact and safe in a data URI
  const cleaned = svg
    .replace(/\n+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(cleaned)}`;
}

function makeCuteAnimalSvg(seed: number) {
  const rand = (n: number) => {
    // deterministic pseudo-random in [0, 1)
    const x = Math.sin(seed * 999 + n * 777) * 10000;
    return x - Math.floor(x);
  };

  const pick = <T,>(arr: T[], n: number) => arr[Math.floor(rand(n) * arr.length)];
  const paletteBg = [
    ['#ffedd5', '#fde68a', '#fef9c3'],
    ['#dbeafe', '#bfdbfe', '#e0e7ff'],
    ['#dcfce7', '#bbf7d0', '#ccfbf1'],
    ['#fce7f3', '#fbcfe8', '#ffe4e6'],
    ['#ede9fe', '#ddd6fe', '#e9d5ff'],
  ];
  const furColors = ['#fbbf24', '#fb7185', '#60a5fa', '#34d399', '#a78bfa', '#f97316', '#22c55e'];
  const earStyles: Array<'cat' | 'bear' | 'rabbit'> = ['cat', 'bear', 'rabbit'];

  const bg = pick(paletteBg, 1);
  const fur = pick(furColors, 2);
  const ear = pick(earStyles, 3);
  const accent = pick(['#ef4444', '#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b'], 4);

  const eyeY = 190 + Math.floor(rand(5) * 10);
  const cheekY = 230 + Math.floor(rand(6) * 10);
  const mouthY = 220 + Math.floor(rand(7) * 10);
  const faceR = 150 + Math.floor(rand(8) * 14);

  const starCount = 7 + Math.floor(rand(9) * 4);
  const stars = Array.from({ length: starCount }).map((_, i) => {
    const x = 60 + Math.floor(rand(10 + i) * 480);
    const y = 60 + Math.floor(rand(20 + i) * 420);
    const r = 6 + Math.floor(rand(30 + i) * 10);
    const o = 0.12 + rand(40 + i) * 0.18;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${o.toFixed(2)}" />`;
  }).join('');

  const earSvg = (() => {
    if (ear === 'bear') {
      return `
        <circle cx="175" cy="150" r="55" fill="${fur}" opacity="0.95"/>
        <circle cx="425" cy="150" r="55" fill="${fur}" opacity="0.95"/>
        <circle cx="175" cy="150" r="30" fill="#ffffff" opacity="0.25"/>
        <circle cx="425" cy="150" r="30" fill="#ffffff" opacity="0.25"/>
      `;
    }
    if (ear === 'rabbit') {
      return `
        <path d="M215 80 C190 30, 230 15, 245 70 C250 95, 230 110, 215 80Z" fill="${fur}" opacity="0.95"/>
        <path d="M385 80 C410 30, 370 15, 355 70 C350 95, 370 110, 385 80Z" fill="${fur}" opacity="0.95"/>
        <path d="M225 78 C210 48, 232 40, 238 68 C242 85, 232 92, 225 78Z" fill="#ffffff" opacity="0.23"/>
        <path d="M375 78 C390 48, 368 40, 362 68 C358 85, 368 92, 375 78Z" fill="#ffffff" opacity="0.23"/>
      `;
    }
    // cat
    return `
      <path d="M190 170 L150 95 Q175 95 205 130 Z" fill="${fur}" opacity="0.95"/>
      <path d="M410 170 L450 95 Q425 95 395 130 Z" fill="${fur}" opacity="0.95"/>
      <path d="M190 165 L165 120 Q182 118 198 142 Z" fill="#ffffff" opacity="0.23"/>
      <path d="M410 165 L435 120 Q418 118 402 142 Z" fill="#ffffff" opacity="0.23"/>
    `;
  })();

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="50%" stop-color="${bg[1]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <radialGradient id="shine" cx="30%" cy="20%" r="70%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.25"/>
      </filter>
    </defs>

    <rect width="600" height="600" rx="52" fill="url(#bg)"/>
    ${stars}
    <circle cx="160" cy="120" r="190" fill="url(#shine)"/>

    <g filter="url(#shadow)">
      ${earSvg}
      <circle cx="300" cy="320" r="${faceR}" fill="${fur}" opacity="0.98"/>
      <circle cx="260" cy="280" r="40" fill="#ffffff" opacity="0.14"/>
      <circle cx="360" cy="280" r="55" fill="#ffffff" opacity="0.10"/>

      <g>
        <circle cx="235" cy="${eyeY}" r="22" fill="#0f172a"/>
        <circle cx="365" cy="${eyeY}" r="22" fill="#0f172a"/>
        <circle cx="228" cy="${eyeY - 6}" r="7" fill="#ffffff" opacity="0.95"/>
        <circle cx="358" cy="${eyeY - 6}" r="7" fill="#ffffff" opacity="0.95"/>
      </g>

      <g>
        <ellipse cx="215" cy="${cheekY}" rx="26" ry="18" fill="#fb7185" opacity="0.40"/>
        <ellipse cx="385" cy="${cheekY}" rx="26" ry="18" fill="#fb7185" opacity="0.40"/>
      </g>

      <g>
        <path d="M300 ${mouthY} C290 ${mouthY + 15}, 310 ${mouthY + 15}, 300 ${mouthY}" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
        <circle cx="300" cy="${mouthY - 14}" r="12" fill="#0f172a"/>
      </g>

      <g opacity="0.95">
        <path d="M300 390 C265 375, 240 395, 255 420 C270 445, 305 442, 300 412 C295 442, 330 445, 345 420 C360 395, 335 375, 300 390Z" fill="${accent}"/>
        <circle cx="300" cy="410" r="8" fill="#ffffff" opacity="0.6"/>
      </g>
    </g>

    <g opacity="0.9">
      <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.75">第 ${seed} 关</text>
    </g>
  </svg>
  `;
  return encodeSvgDataUri(svg);
}

function makeCuteRocketSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 1337 + n * 919) * 10000;
    return x - Math.floor(x);
  };
  const bg = [
    ['#0b1220', '#1e293b', '#0f172a'],
    ['#111827', '#312e81', '#1e293b'],
    ['#020617', '#0f766e', '#0f172a'],
  ][Math.floor(rand(1) * 3)];

  const rocketBody = ['#e2e8f0', '#f8fafc', '#fee2e2'][Math.floor(rand(2) * 3)];
  const accent = ['#fb7185', '#60a5fa', '#a78bfa', '#34d399', '#f59e0b'][Math.floor(rand(3) * 5)];
  const flame = ['#fb7185', '#f97316', '#facc15'][Math.floor(rand(4) * 3)];

  const stars = Array.from({ length: 28 }).map((_, i) => {
    const x = Math.floor(rand(10 + i) * 600);
    const y = Math.floor(rand(20 + i) * 600);
    const r = 1 + Math.floor(rand(30 + i) * 3);
    const o = 0.25 + rand(40 + i) * 0.6;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o.toFixed(2)}"/>`;
  }).join('');

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="50%" stop-color="${bg[1]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="20%" r="70%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#bg)"/>
    <circle cx="300" cy="120" r="240" fill="url(#glow)"/>
    ${stars}

    <g filter="url(#shadow)" transform="translate(0,10)">
      <path d="M300 110 C240 175, 230 265, 250 365 C270 475, 300 520, 300 520 C300 520, 330 475, 350 365 C370 265, 360 175, 300 110Z" fill="${rocketBody}"/>
      <path d="M300 130 C258 188, 255 258, 266 350 C283 470, 300 505, 300 505 C300 505, 317 470, 334 350 C345 258, 342 188, 300 130Z" fill="#ffffff" opacity="0.22"/>

      <path d="M250 320 L180 360 L250 420 Z" fill="${accent}" opacity="0.92"/>
      <path d="M350 320 L420 360 L350 420 Z" fill="${accent}" opacity="0.92"/>

      <circle cx="300" cy="265" r="54" fill="#0f172a" opacity="0.85"/>
      <circle cx="300" cy="265" r="42" fill="#93c5fd" opacity="0.85"/>
      <circle cx="282" cy="248" r="10" fill="#ffffff" opacity="0.9"/>

      <path d="M300 520 C275 520, 255 540, 255 566 C255 585, 272 595, 300 595 C328 595, 345 585, 345 566 C345 540, 325 520, 300 520Z" fill="#0f172a" opacity="0.75"/>
      <path d="M300 540 C286 540, 275 552, 275 567 C275 580, 287 590, 300 590 C313 590, 325 580, 325 567 C325 552, 314 540, 300 540Z" fill="${flame}" opacity="0.95"/>
      <path d="M300 552 C292 552, 286 559, 286 567 C286 575, 292 580, 300 580 C308 580, 314 575, 314 567 C314 559, 308 552, 300 552Z" fill="#fde68a" opacity="0.9"/>
    </g>

    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#ffffff" opacity="0.85">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteUnderwaterSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 2027 + n * 431) * 10000;
    return x - Math.floor(x);
  };
  const waters = [
    ['#0ea5e9', '#0284c7', '#0f172a'],
    ['#22c55e', '#0ea5e9', '#0f172a'],
    ['#60a5fa', '#34d399', '#0b1220'],
  ][Math.floor(rand(1) * 3)];
  const fish = ['#fb7185', '#f59e0b', '#a78bfa', '#f97316', '#34d399'][Math.floor(rand(2) * 5)];
  const fish2 = ['#60a5fa', '#fbbf24', '#22c55e', '#fb7185', '#a78bfa'][Math.floor(rand(3) * 5)];

  const bubbles = Array.from({ length: 18 }).map((_, i) => {
    const x = 50 + Math.floor(rand(10 + i) * 500);
    const y = 80 + Math.floor(rand(20 + i) * 420);
    const r = 6 + Math.floor(rand(30 + i) * 16);
    const o = 0.10 + rand(40 + i) * 0.18;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${o.toFixed(2)}"/>`;
  }).join('');

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${waters[0]}"/>
        <stop offset="55%" stop-color="${waters[1]}"/>
        <stop offset="100%" stop-color="${waters[2]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#00111f" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#sea)"/>
    ${bubbles}
    <path d="M0 460 C140 420, 240 520, 360 470 C470 430, 520 500, 600 470 L600 600 L0 600 Z" fill="rgba(2,132,199,0.35)"/>
    <g filter="url(#shadow)">
      <g transform="translate(70,160)">
        <ellipse cx="180" cy="180" rx="150" ry="95" fill="${fish}"/>
        <polygon points="40,180 0,140 0,220" fill="${fish}" opacity="0.95"/>
        <circle cx="235" cy="160" r="16" fill="#0f172a"/>
        <circle cx="230" cy="155" r="6" fill="#fff" opacity="0.9"/>
        <path d="M205 205 C220 220, 240 220, 252 205" stroke="#0f172a" stroke-width="8" stroke-linecap="round" fill="none"/>
        <circle cx="235" cy="240" r="22" fill="#fff" opacity="0.18"/>
      </g>
      <g transform="translate(260,60) scale(0.85)">
        <ellipse cx="180" cy="180" rx="140" ry="88" fill="${fish2}"/>
        <polygon points="45,180 0,145 0,215" fill="${fish2}" opacity="0.95"/>
        <circle cx="230" cy="160" r="15" fill="#0f172a"/>
        <circle cx="226" cy="156" r="6" fill="#fff" opacity="0.9"/>
        <path d="M205 200 C220 212, 238 212, 250 200" stroke="#0f172a" stroke-width="8" stroke-linecap="round" fill="none"/>
      </g>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#ffffff" opacity="0.85">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteFruitSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 1723 + n * 613) * 10000;
    return x - Math.floor(x);
  };
  const bg = [
    ['#fff7ed', '#fde68a', '#fce7f3'],
    ['#ecfeff', '#a7f3d0', '#e0e7ff'],
    ['#fdf2f8', '#fecaca', '#e9d5ff'],
  ][Math.floor(rand(1) * 3)];
  const fruits = ['#fb7185', '#f59e0b', '#22c55e', '#60a5fa', '#a78bfa', '#f97316'];
  const f1 = fruits[Math.floor(rand(2) * fruits.length)];
  const f2 = fruits[Math.floor(rand(3) * fruits.length)];
  const f3 = fruits[Math.floor(rand(4) * fruits.length)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="55%" stop-color="${bg[1]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#bg)"/>
    <g filter="url(#shadow)">
      <rect x="110" y="340" width="380" height="170" rx="32" fill="rgba(15,23,42,0.12)"/>
      <rect x="120" y="350" width="360" height="150" rx="28" fill="#ffffff" opacity="0.28"/>

      <g transform="translate(170,170)">
        <circle cx="90" cy="160" r="90" fill="${f1}"/>
        <circle cx="55" cy="130" r="18" fill="#fff" opacity="0.22"/>
        <path d="M90 70 C80 40, 95 25, 120 40" stroke="#16a34a" stroke-width="10" stroke-linecap="round" fill="none"/>
        <path d="M120 40 C150 45, 165 70, 145 90 C132 104, 112 88, 120 40Z" fill="#22c55e" opacity="0.9"/>
        <circle cx="60" cy="155" r="14" fill="#0f172a"/>
        <circle cx="120" cy="155" r="14" fill="#0f172a"/>
        <path d="M78 185 C90 200, 110 200, 122 185" stroke="#0f172a" stroke-width="8" stroke-linecap="round" fill="none"/>
      </g>

      <g transform="translate(310,180)">
        <ellipse cx="90" cy="150" rx="80" ry="95" fill="${f2}"/>
        <circle cx="60" cy="140" r="14" fill="#0f172a"/>
        <circle cx="120" cy="140" r="14" fill="#0f172a"/>
        <path d="M76 170 C90 185, 110 185, 124 170" stroke="#0f172a" stroke-width="8" stroke-linecap="round" fill="none"/>
        <path d="M90 52 C70 30, 85 15, 110 32" stroke="#16a34a" stroke-width="10" stroke-linecap="round" fill="none"/>
        <circle cx="55" cy="110" r="16" fill="#fff" opacity="0.18"/>
      </g>

      <g transform="translate(245,260)">
        <circle cx="55" cy="80" r="55" fill="${f3}"/>
        <path d="M55 25 C45 10, 60 5, 75 15" stroke="#16a34a" stroke-width="10" stroke-linecap="round" fill="none"/>
        <circle cx="40" cy="75" r="10" fill="#0f172a"/>
        <circle cx="70" cy="75" r="10" fill="#0f172a"/>
        <path d="M45 92 C55 105, 65 105, 75 92" stroke="#0f172a" stroke-width="7" stroke-linecap="round" fill="none"/>
      </g>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.7">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteCarSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 2447 + n * 271) * 10000;
    return x - Math.floor(x);
  };
  const sky = ['#dbeafe', '#e0e7ff', '#cffafe'][Math.floor(rand(1) * 3)];
  const road = ['#0f172a', '#1f2937', '#111827'][Math.floor(rand(2) * 3)];
  const car = ['#fb7185', '#60a5fa', '#a78bfa', '#34d399', '#f59e0b'][Math.floor(rand(3) * 5)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${sky}"/>
    <circle cx="110" cy="110" r="50" fill="#fde68a" opacity="0.95"/>
    <path d="M0 420 H600 V600 H0 Z" fill="${road}"/>
    <path d="M0 470 H600" stroke="#ffffff" stroke-opacity="0.25" stroke-width="10" stroke-dasharray="40 30"/>
    <g filter="url(#shadow)" transform="translate(0,0)">
      <path d="M160 365 C190 310, 260 290, 340 290 C425 290, 480 315, 500 365 L515 410 C520 430, 505 450, 485 450 H140 C120 450, 105 430, 110 410 Z" fill="${car}"/>
      <path d="M215 330 C245 308, 285 300, 340 300 C388 300, 420 312, 445 330 L445 365 H215 Z" fill="#0f172a" opacity="0.22"/>
      <path d="M235 334 C260 320, 292 315, 338 315 C375 315, 400 322, 420 334 L420 362 H235 Z" fill="#93c5fd" opacity="0.55"/>
      <circle cx="195" cy="450" r="42" fill="#0f172a"/>
      <circle cx="195" cy="450" r="22" fill="#94a3b8"/>
      <circle cx="425" cy="450" r="42" fill="#0f172a"/>
      <circle cx="425" cy="450" r="22" fill="#94a3b8"/>
      <circle cx="485" cy="390" r="16" fill="#fde68a" opacity="0.9"/>
      <circle cx="140" cy="390" r="16" fill="#fca5a5" opacity="0.9"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteDinoSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 3119 + n * 557) * 10000;
    return x - Math.floor(x);
  };
  const bg = [
    ['#dcfce7', '#bbf7d0', '#fef9c3'],
    ['#e9d5ff', '#ddd6fe', '#dcfce7'],
    ['#ffe4e6', '#fecaca', '#fde68a'],
  ][Math.floor(rand(1) * 3)];
  const dino = ['#22c55e', '#34d399', '#a3e635'][Math.floor(rand(2) * 3)];
  const spikes = ['#60a5fa', '#a78bfa', '#f59e0b'][Math.floor(rand(3) * 3)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="55%" stop-color="${bg[1]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#bg)"/>
    <path d="M0 470 C120 430, 260 530, 380 470 C480 420, 530 500, 600 470 L600 600 L0 600 Z" fill="rgba(34,197,94,0.18)"/>
    <g filter="url(#shadow)">
      <path d="M210 420 C190 350, 220 270, 300 250 C330 190, 410 185, 450 240 C510 325, 485 430, 390 450 C315 465, 250 455, 210 420Z" fill="${dino}"/>
      <circle cx="392" cy="265" r="20" fill="#0f172a"/>
      <circle cx="386" cy="258" r="7" fill="#fff" opacity="0.9"/>
      <path d="M360 300 C380 320, 410 320, 430 300" stroke="#0f172a" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M285 250 L300 210 L315 250 Z" fill="${spikes}"/>
      <path d="M315 248 L335 205 L355 248 Z" fill="${spikes}"/>
      <path d="M350 255 L375 215 L400 255 Z" fill="${spikes}"/>
      <path d="M250 430 C260 480, 320 500, 360 470" stroke="#0f172a" stroke-opacity="0.22" stroke-width="12" stroke-linecap="round" fill="none"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteRobotSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 4241 + n * 911) * 10000;
    return x - Math.floor(x);
  };
  const bg = [
    ['#e0f2fe', '#dbeafe', '#f5f3ff'],
    ['#ecfccb', '#dcfce7', '#cffafe'],
    ['#fce7f3', '#ffe4e6', '#fef9c3'],
  ][Math.floor(rand(1) * 3)];
  const body = ['#94a3b8', '#e2e8f0', '#cbd5e1'][Math.floor(rand(2) * 3)];
  const accent = ['#60a5fa', '#fb7185', '#a78bfa', '#34d399', '#f59e0b'][Math.floor(rand(3) * 5)];
  const eye = ['#0f172a', '#111827'][Math.floor(rand(4) * 2)];
  const antennaX = 250 + Math.floor(rand(5) * 100);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="55%" stop-color="${bg[1]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#bg)"/>
    <g filter="url(#shadow)">
      <rect x="155" y="150" width="290" height="240" rx="44" fill="${body}"/>
      <rect x="185" y="185" width="230" height="120" rx="26" fill="#0f172a" opacity="0.15"/>
      <rect x="195" y="195" width="210" height="100" rx="22" fill="#ffffff" opacity="0.25"/>
      <circle cx="250" cy="245" r="22" fill="${eye}"/>
      <circle cx="350" cy="245" r="22" fill="${eye}"/>
      <circle cx="242" cy="238" r="7" fill="#fff" opacity="0.9"/>
      <circle cx="342" cy="238" r="7" fill="#fff" opacity="0.9"/>
      <path d="M260 295 C290 325, 310 325, 340 295" stroke="#0f172a" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.8"/>
      <rect x="190" y="330" width="220" height="40" rx="20" fill="${accent}" opacity="0.95"/>
      <circle cx="235" cy="350" r="8" fill="#fff" opacity="0.9"/>
      <circle cx="300" cy="350" r="8" fill="#fff" opacity="0.9"/>
      <circle cx="365" cy="350" r="8" fill="#fff" opacity="0.9"/>

      <rect x="210" y="390" width="180" height="70" rx="30" fill="${body}"/>
      <rect x="155" y="250" width="45" height="120" rx="22" fill="${body}"/>
      <rect x="400" y="250" width="45" height="120" rx="22" fill="${body}"/>

      <path d="M${antennaX} 150 L${antennaX - 20} 95" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="${antennaX - 22}" cy="92" r="14" fill="${accent}"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteRainbowSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 5039 + n * 503) * 10000;
    return x - Math.floor(x);
  };
  const sky = ['#dbeafe', '#cffafe', '#e0e7ff'][Math.floor(rand(1) * 3)];
  const cloud = ['#ffffff', '#f8fafc'][Math.floor(rand(2) * 2)];
  const y = 220 + Math.floor(rand(3) * 40);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${sky}"/>
    <g filter="url(#shadow)">
      <path d="M120 ${y + 180} C140 ${y - 40}, 460 ${y - 40}, 480 ${y + 180}" stroke="#ef4444" stroke-width="46" fill="none" stroke-linecap="round"/>
      <path d="M150 ${y + 180} C168 ${y - 8}, 432 ${y - 8}, 450 ${y + 180}" stroke="#f59e0b" stroke-width="40" fill="none" stroke-linecap="round"/>
      <path d="M178 ${y + 180} C195 ${y + 18}, 405 ${y + 18}, 422 ${y + 180}" stroke="#facc15" stroke-width="34" fill="none" stroke-linecap="round"/>
      <path d="M205 ${y + 180} C220 ${y + 42}, 380 ${y + 42}, 395 ${y + 180}" stroke="#22c55e" stroke-width="28" fill="none" stroke-linecap="round"/>
      <path d="M232 ${y + 180} C245 ${y + 66}, 355 ${y + 66}, 368 ${y + 180}" stroke="#3b82f6" stroke-width="22" fill="none" stroke-linecap="round"/>
      <path d="M260 ${y + 180} C270 ${y + 90}, 330 ${y + 90}, 340 ${y + 180}" stroke="#a78bfa" stroke-width="18" fill="none" stroke-linecap="round"/>

      <g opacity="0.95">
        <ellipse cx="140" cy="${y + 210}" rx="78" ry="44" fill="${cloud}"/>
        <ellipse cx="200" cy="${y + 205}" rx="62" ry="38" fill="${cloud}"/>
        <ellipse cx="460" cy="${y + 210}" rx="78" ry="44" fill="${cloud}"/>
        <ellipse cx="400" cy="${y + 205}" rx="62" ry="38" fill="${cloud}"/>
      </g>
      <circle cx="90" cy="110" r="46" fill="#fde68a" opacity="0.95"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteBalloonSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 7013 + n * 313) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#fdf2f8', '#ecfeff', '#f5f3ff'][Math.floor(rand(1) * 3)];
  const colors = ['#fb7185', '#60a5fa', '#a78bfa', '#34d399', '#f59e0b', '#f97316'];
  const balloons = Array.from({ length: 6 }).map((_, i) => {
    const x = 110 + Math.floor(rand(10 + i) * 380);
    const y = 120 + Math.floor(rand(20 + i) * 220);
    const r = 44 + Math.floor(rand(30 + i) * 22);
    const c = colors[Math.floor(rand(40 + i) * colors.length)];
    return `
      <g>
        <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${Math.floor(r * 1.18)}" fill="${c}"/>
        <circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${Math.max(10, r * 0.18)}" fill="#fff" opacity="0.22"/>
        <path d="M${x} ${y + r * 1.25} L${x - 10} ${y + r * 1.25 + 16} L${x + 10} ${y + r * 1.25 + 16} Z" fill="${c}" opacity="0.9"/>
        <path d="M${x} ${y + r * 1.25 + 16} C${x - 30} ${y + r * 1.25 + 90}, ${x + 30} ${y + r * 1.25 + 140}, ${x} ${y + r * 1.25 + 220}" stroke="rgba(15,23,42,0.35)" stroke-width="4" fill="none"/>
      </g>
    `;
  }).join('');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.16"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${bg}"/>
    <g filter="url(#shadow)">${balloons}</g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteIceCreamSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 8191 + n * 271) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#fff7ed', '#ecfeff', '#fdf2f8'][Math.floor(rand(1) * 3)];
  const scoop1 = ['#fb7185', '#60a5fa', '#a78bfa', '#34d399', '#f59e0b'][Math.floor(rand(2) * 5)];
  const scoop2 = ['#f97316', '#22c55e', '#38bdf8', '#facc15', '#fb7185'][Math.floor(rand(3) * 5)];
  const cone = ['#fbbf24', '#f59e0b'][Math.floor(rand(4) * 2)];
  const sprinkles = Array.from({ length: 22 }).map((_, i) => {
    const x = 230 + Math.floor(rand(10 + i) * 140);
    const y = 160 + Math.floor(rand(20 + i) * 140);
    const w = 10 + Math.floor(rand(30 + i) * 10);
    const h = 4 + Math.floor(rand(40 + i) * 3);
    const rot = Math.floor(rand(50 + i) * 50) - 25;
    const c = ['#fff', '#0ea5e9', '#ef4444', '#22c55e', '#f59e0b'][Math.floor(rand(60 + i) * 5)];
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c}" opacity="0.8" transform="rotate(${rot} ${x} ${y})"/>`;
  }).join('');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${bg}"/>
    <g filter="url(#shadow)">
      <path d="M300 520 L220 320 H380 Z" fill="${cone}"/>
      <path d="M300 520 L250 350 H350 Z" fill="#ffffff" opacity="0.18"/>
      <circle cx="300" cy="250" r="110" fill="${scoop1}"/>
      <circle cx="300" cy="175" r="88" fill="${scoop2}"/>
      <circle cx="265" cy="230" r="22" fill="#fff" opacity="0.18"/>
      ${sprinkles}
      <circle cx="265" cy="200" r="14" fill="#0f172a"/>
      <circle cx="335" cy="200" r="14" fill="#0f172a"/>
      <path d="M280 235 C295 250, 305 250, 320 235" stroke="#0f172a" stroke-width="10" stroke-linecap="round" fill="none"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCutePlanetSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 9281 + n * 449) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#020617', '#0b1220', '#111827'][Math.floor(rand(1) * 3)];
  const planet = ['#60a5fa', '#a78bfa', '#34d399', '#f59e0b', '#fb7185'][Math.floor(rand(2) * 5)];
  const ring = ['#e2e8f0', '#cbd5e1', '#fef3c7'][Math.floor(rand(3) * 3)];
  const stars = Array.from({ length: 40 }).map((_, i) => {
    const x = Math.floor(rand(10 + i) * 600);
    const y = Math.floor(rand(20 + i) * 600);
    const r = 1 + Math.floor(rand(30 + i) * 3);
    const o = 0.25 + rand(40 + i) * 0.6;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o.toFixed(2)}"/>`;
  }).join('');
  const px = 280 + Math.floor(rand(4) * 40);
  const py = 290 + Math.floor(rand(5) * 40);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <radialGradient id="glow" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stop-color="${planet}" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="${planet}" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${bg}"/>
    ${stars}
    <circle cx="300" cy="140" r="230" fill="url(#glow)"/>
    <g filter="url(#shadow)">
      <ellipse cx="${px}" cy="${py}" rx="150" ry="150" fill="${planet}"/>
      <ellipse cx="${px - 45}" cy="${py - 35}" rx="42" ry="30" fill="#fff" opacity="0.18"/>
      <path d="M${px - 210} ${py} C${px - 120} ${py - 80}, ${px + 140} ${py - 80}, ${px + 230} ${py} C${px + 140} ${py + 80}, ${px - 120} ${py + 80}, ${px - 210} ${py} Z" fill="${ring}" opacity="0.55"/>
      <path d="M${px - 190} ${py} C${px - 110} ${py - 64}, ${px + 120} ${py - 64}, ${px + 210} ${py} C${px + 120} ${py + 64}, ${px - 110} ${py + 64}, ${px - 190} ${py} Z" fill="#0f172a" opacity="0.20"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#ffffff" opacity="0.85">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteHouseSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 10007 + n * 173) * 10000;
    return x - Math.floor(x);
  };
  const sky = ['#dbeafe', '#cffafe', '#e0e7ff'][Math.floor(rand(1) * 3)];
  const grass = ['#22c55e', '#34d399', '#84cc16'][Math.floor(rand(2) * 3)];
  const house = ['#fb7185', '#f59e0b', '#a78bfa', '#60a5fa'][Math.floor(rand(3) * 4)];
  const roof = ['#0f172a', '#1f2937'][Math.floor(rand(4) * 2)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${sky}"/>
    <path d="M0 430 C120 400, 240 520, 360 450 C480 390, 520 500, 600 450 L600 600 L0 600 Z" fill="${grass}" opacity="0.35"/>
    <g filter="url(#shadow)">
      <rect x="190" y="260" width="220" height="210" rx="26" fill="${house}"/>
      <polygon points="300,170 150,280 450,280" fill="${roof}"/>
      <rect x="235" y="310" width="60" height="60" rx="12" fill="#93c5fd" opacity="0.65"/>
      <rect x="305" y="310" width="60" height="60" rx="12" fill="#93c5fd" opacity="0.65"/>
      <rect x="275" y="360" width="50" height="110" rx="18" fill="#0f172a" opacity="0.22"/>
      <rect x="285" y="370" width="30" height="90" rx="14" fill="#ffffff" opacity="0.25"/>
      <circle cx="150" cy="210" r="40" fill="#fde68a" opacity="0.95"/>
      <ellipse cx="470" cy="210" rx="64" ry="38" fill="#fff" opacity="0.9"/>
      <ellipse cx="430" cy="220" rx="52" ry="32" fill="#fff" opacity="0.9"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteTrainSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 11213 + n * 313) * 10000;
    return x - Math.floor(x);
  };
  const sky = ['#e0f2fe', '#dbeafe', '#ecfeff'][Math.floor(rand(1) * 3)];
  const track = ['#0f172a', '#111827'][Math.floor(rand(2) * 2)];
  const train = ['#60a5fa', '#fb7185', '#34d399', '#f59e0b', '#a78bfa'][Math.floor(rand(3) * 5)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${sky}"/>
    <path d="M0 460 H600" stroke="${track}" stroke-width="18" stroke-opacity="0.55"/>
    <path d="M0 500 H600" stroke="${track}" stroke-width="18" stroke-opacity="0.55"/>
    ${Array.from({ length: 10 }).map((_, i) => `<rect x="${40 + i * 60}" y="455" width="30" height="55" rx="10" fill="#64748b" opacity="0.55"/>`).join('')}
    <g filter="url(#shadow)">
      <rect x="140" y="300" width="320" height="130" rx="30" fill="${train}"/>
      <rect x="180" y="260" width="160" height="80" rx="28" fill="${train}" opacity="0.95"/>
      <rect x="205" y="280" width="45" height="45" rx="12" fill="#93c5fd" opacity="0.75"/>
      <rect x="260" y="280" width="45" height="45" rx="12" fill="#93c5fd" opacity="0.75"/>
      <rect x="350" y="330" width="80" height="60" rx="18" fill="#0f172a" opacity="0.18"/>
      <circle cx="205" cy="440" r="34" fill="#0f172a"/>
      <circle cx="205" cy="440" r="18" fill="#94a3b8"/>
      <circle cx="320" cy="440" r="34" fill="#0f172a"/>
      <circle cx="320" cy="440" r="18" fill="#94a3b8"/>
      <circle cx="430" cy="440" r="34" fill="#0f172a"/>
      <circle cx="430" cy="440" r="18" fill="#94a3b8"/>
      <path d="M160 300 C150 260, 160 230, 190 220" stroke="#64748b" stroke-width="12" stroke-linecap="round" opacity="0.7"/>
      <circle cx="195" cy="215" r="14" fill="#64748b" opacity="0.9"/>
      <path d="M160 240 C140 210, 150 180, 190 170" stroke="#cbd5e1" stroke-width="12" stroke-linecap="round" opacity="0.55"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteFlowerGardenSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 12289 + n * 739) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#f0fdf4', '#ecfeff', '#fdf2f8'][Math.floor(rand(1) * 3)];
  const petals = ['#fb7185', '#a78bfa', '#60a5fa', '#f59e0b', '#34d399'];
  const flowers = Array.from({ length: 10 }).map((_, i) => {
    const x = 60 + Math.floor(rand(10 + i) * 480);
    const y = 260 + Math.floor(rand(20 + i) * 260);
    const p = petals[Math.floor(rand(30 + i) * petals.length)];
    const r = 20 + Math.floor(rand(40 + i) * 18);
    return `
      <g>
        <path d="M${x} ${y} C${x - 10} ${y - 30}, ${x + 10} ${y - 30}, ${x} ${y - 70}" stroke="#16a34a" stroke-width="8" stroke-linecap="round"/>
        ${Array.from({ length: 6 }).map((__, k) => {
          const ang = (k / 6) * Math.PI * 2;
          const px = x + Math.cos(ang) * (r + 10);
          const py = y - 70 + Math.sin(ang) * (r + 10);
          return `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(r * 0.62).toFixed(1)}" ry="${(r * 0.42).toFixed(1)}" fill="${p}" opacity="0.92"/>`;
        }).join('')}
        <circle cx="${x}" cy="${y - 70}" r="${(r * 0.36).toFixed(1)}" fill="#fde68a" opacity="0.95"/>
      </g>
    `;
  }).join('');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.12"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${bg}"/>
    <path d="M0 430 C120 400, 260 520, 380 460 C480 420, 520 500, 600 460 L600 600 L0 600 Z" fill="rgba(34,197,94,0.18)"/>
    <g filter="url(#shadow)">${flowers}</g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

function makeCuteBoatSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 13513 + n * 337) * 10000;
    return x - Math.floor(x);
  };
  const sky = ['#dbeafe', '#cffafe', '#e0f2fe'][Math.floor(rand(1) * 3)];
  const sea = ['#0ea5e9', '#0284c7', '#60a5fa'][Math.floor(rand(2) * 3)];
  const boat = ['#fb7185', '#f59e0b', '#a78bfa', '#34d399'][Math.floor(rand(3) * 4)];
  const sail = ['#ffffff', '#f8fafc'][Math.floor(rand(4) * 2)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${sky}"/>
    <path d="M0 360 C110 330, 230 410, 350 360 C470 310, 520 390, 600 360 L600 600 L0 600 Z" fill="${sea}" opacity="0.75"/>
    <path d="M0 420 C120 390, 260 470, 380 420 C480 380, 520 450, 600 420" stroke="#ffffff" stroke-opacity="0.28" stroke-width="16" fill="none"/>
    <g filter="url(#shadow)">
      <path d="M210 410 H390 L355 470 H245 Z" fill="${boat}"/>
      <rect x="295" y="250" width="10" height="170" rx="5" fill="#0f172a" opacity="0.35"/>
      <path d="M300 260 L300 400 L210 400 Z" fill="${sail}" opacity="0.95"/>
      <path d="M305 275 L390 400 L305 400 Z" fill="${sail}" opacity="0.8"/>
      <circle cx="250" cy="445" r="10" fill="#ffffff" opacity="0.7"/>
      <circle cx="350" cy="445" r="10" fill="#ffffff" opacity="0.7"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题1: 可爱熊猫
function makeCutePandaSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 56789 + n * 123) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#dcfce7', '#fef9c3', '#e0e7ff'][Math.floor(rand(1) * 3)];
  const bamboo = ['#22c55e', '#16a34a', '#15803d'][Math.floor(rand(2) * 3)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#bg)"/>
    <g filter="url(#shadow)">
      <!-- Ears -->
      <circle cx="200" cy="200" r="50" fill="#1f2937"/>
      <circle cx="400" cy="200" r="50" fill="#1f2937"/>
      <!-- Face -->
      <ellipse cx="300" cy="330" rx="140" ry="120" fill="#ffffff"/>
      <!-- Eye patches -->
      <ellipse cx="240" cy="290" rx="40" ry="45" fill="#1f2937" transform="rotate(-15 240 290)"/>
      <ellipse cx="360" cy="290" rx="40" ry="45" fill="#1f2937" transform="rotate(15 360 290)"/>
      <!-- Eyes -->
      <circle cx="245" cy="285" r="16" fill="#ffffff"/>
      <circle cx="355" cy="285" r="16" fill="#ffffff"/>
      <circle cx="248" cy="282" r="8" fill="#1f2937"/>
      <circle cx="358" cy="282" r="8" fill="#1f2937"/>
      <!-- Nose -->
      <ellipse cx="300" cy="340" rx="20" ry="14" fill="#1f2937"/>
      <!-- Mouth -->
      <path d="M280 365 Q300 385 320 365" stroke="#1f2937" stroke-width="6" fill="none" stroke-linecap="round"/>
      <!-- Bamboo -->
      <rect x="420" y="380" width="18" height="140" rx="9" fill="${bamboo[0]}"/>
      <rect x="445" y="350" width="18" height="170" rx="9" fill="${bamboo[1]}"/>
      <ellipse cx="429" cy="375" rx="12" ry="8" fill="${bamboo[2]}" transform="rotate(-20 429 375)"/>
      <ellipse cx="454" cy="345" rx="12" ry="8" fill="${bamboo[2]}" transform="rotate(15 454 345)"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题2: 可爱企鹅
function makeCutePenguinSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 98765 + n * 456) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#e0f2fe', '#bae6fd', '#cffafe'][Math.floor(rand(1) * 3)];
  const belly = ['#fef3c7', '#fffbeb', '#fde68a'][Math.floor(rand(2) * 3)];
  const scarf = ['#fb7185', '#f97316', '#f59e0b'][Math.floor(rand(3) * 3)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="ice" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#ice)"/>
    <!-- Snow ground -->
    <ellipse cx="300" cy="520" rx="250" ry="60" fill="rgba(255,255,255,0.6)"/>
    <g filter="url(#shadow)">
      <!-- Body -->
      <ellipse cx="300" cy="340" rx="110" ry="150" fill="#1e293b"/>
      <!-- Belly -->
      <ellipse cx="300" cy="360" rx="75" ry="115" fill="${belly[0]}"/>
      <!-- Eyes -->
      <circle cx="268" cy="270" r="18" fill="#1e293b"/>
      <circle cx="332" cy="270" r="18" fill="#1e293b"/>
      <circle cx="272" cy="266" r="7" fill="#ffffff"/>
      <circle cx="336" cy="266" r="7" fill="#ffffff"/>
      <!-- Beak -->
      <polygon points="300,295 285,315 315,315" fill="#fb923c"/>
      <!-- Scarf -->
      <path d="M235 370 Q300 395 365 370" stroke="${scarf[0]}" stroke-width="22" fill="none" stroke-linecap="round"/>
      <path d="M340 380 Q360 420 350 450" stroke="${scarf[0]}" stroke-width="18" fill="none" stroke-linecap="round"/>
      <!-- Feet -->
      <ellipse cx="255" cy="480" rx="30" ry="15" fill="#fb923c"/>
      <ellipse cx="345" cy="480" rx="30" ry="15" fill="#fb923c"/>
      <!-- Wings -->
      <ellipse cx="185" cy="360" rx="25" ry="65" fill="#1e293b" transform="rotate(15 185 360)"/>
      <ellipse cx="415" cy="360" rx="25" ry="65" fill="#1e293b" transform="rotate(-15 415 360)"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题3: 可爱独角兽
function makeCuteUnicornSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 13579 + n * 789) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#fce7f3', '#fdf2f8', '#fff1f2'][Math.floor(rand(1) * 3)];
  const body = ['#e9d5ff', '#ddd6fe', '#c4b5fd'][Math.floor(rand(2) * 3)];
  const mane = ['#f9a8d4', '#f472b6', '#ec4899'][Math.floor(rand(3) * 3)];
  const tail = ['#a78bfa', '#8b5cf6', '#7c3aed'][Math.floor(rand(4) * 3)];
  const stars = Array.from({ length: 20 }).map((_, i) => {
    const x = 40 + Math.floor(rand(10 + i) * 520);
    const y = 40 + Math.floor(rand(20 + i) * 400);
    const r = 2 + Math.floor(rand(30 + i) * 4);
    const o = 0.3 + rand(40 + i) * 0.5;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${o.toFixed(2)}"/>`;
  }).join('');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="magic" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.15"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#magic)"/>
    ${stars}
    <g filter="url(#shadow)">
      <!-- Body -->
      <ellipse cx="300" cy="360" rx="120" ry="80" fill="${body[0]}"/>
      <!-- Legs -->
      <rect x="220" y="410" width="28" height="90" rx="14" fill="${body[1]}"/>
      <rect x="352" y="410" width="28" height="90" rx="14" fill="${body[1]}"/>
      <!-- Neck and Head -->
      <path d="M380 320 Q430 260 420 190 Q400 160 360 180 Q340 220 350 280" fill="${body[0]}"/>
      <!-- Horn -->
      <polygon points="420,175 410,130 432,165" fill="#fde68a"/>
      <polygon points="415,155 410,130 425,148" fill="#fef3c7"/>
      <!-- Mane -->
      <path d="M360 185 Q340 200 345 230 Q335 250 340 280 Q330 300 338 320" stroke="${mane[0]}" stroke-width="18" fill="none" stroke-linecap="round"/>
      <!-- Eye -->
      <circle cx="390" cy="205" r="14" fill="#1f2937"/>
      <circle cx="393" cy="201" r="5" fill="#ffffff"/>
      <!-- Tail -->
      <path d="M180 360 Q140 340 130 380 Q145 410 175 390" fill="${tail[0]}"/>
      <path d="M175 365 Q145 355 140 385 Q152 405 172 388" fill="${tail[1]}"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题4: 可爱蛋糕
function makeCuteCakeSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 24680 + n * 246) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#fef3c7', '#fee2e2', '#fce7f3'][Math.floor(rand(1) * 3)];
  const cake = ['#fb7185', '#f472b6', '#a78bfa', '#60a5fa'][Math.floor(rand(2) * 4)];
  const cream = ['#fef3c7', '#fffbeb', '#fef9c3'][Math.floor(rand(3) * 3)];
  const cherry = ['#ef4444', '#dc2626', '#f87171'][Math.floor(rand(4) * 3)];
  const candles = Array.from({ length: 5 + Math.floor(rand(5) * 4) }).map((_, i) => {
    const x = 210 + i * 45;
    const h = 35 + Math.floor(rand(10 + i) * 25);
    const colors = ['#fbbf24', '#60a5fa', '#34d399', '#f472b6', '#a78bfa'];
    const c = colors[i % colors.length];
    return `
      <rect x="${x}" y="${260 - h}" width="10" height="${h}" rx="5" fill="${c}"/>
      <ellipse cx="${x + 5}" cy="${260 - h - 8}" rx="6" ry="10" fill="#facc15" opacity="0.9"/>
    `;
  }).join('');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.15"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${bg[0]}"/>
    <g filter="url(#shadow)">
      <!-- Plate -->
      <ellipse cx="300" cy="470" rx="160" ry="30" fill="#e5e7eb"/>
      <ellipse cx="300" cy="465" rx="145" ry="25" fill="#f3f4f6"/>
      <!-- Cake base -->
      <rect x="160" y="340" width="280" height="125" rx="15" fill="${cake[0]}"/>
      <rect x="155" y="335" width="290" height="20" rx="10" fill="${cream[0]}"/>
      <!-- Drips -->
      ${Array.from({ length: 12 }).map((_, i) => {
        const x = 165 + i * 24;
        const h = 15 + Math.floor(rand(20 + i) * 20);
        return `<path d="M${x} 355 Q${x} ${355 + h} ${x + 8} ${355 + h}" fill="${cream[0]}" opacity="0.9"/>`;
      }).join('')}
      <!-- Middle layer -->
      <rect x="175" y="270" width="250" height="70" rx="12" fill="${cake[Math.floor(rand(21) * cake.length)]}"/>
      <rect x="170" y="265" width="260" height="18" rx="9" fill="${cream[1]}"/>
      <!-- Candles -->
      ${candles}
      <!-- Cherries on top -->
      ${Array.from({ length: 3 }).map((_, i) => {
        const x = 230 + i * 70;
        return `
          <circle cx="${x}" cy="248" r="14" fill="${cherry[i % cherry.length]}"/>
          <path d="M${x} 236 Q${x + 5} 220 ${x + 15} 225" stroke="#16a34a" stroke-width="3" fill="none"/>
        `;
      }).join('')}
      <!-- Sprinkles -->
      ${Array.from({ length: 25 }).map((_, i) => {
        const x = 170 + Math.floor(rand(30 + i) * 260);
        const y = 275 + Math.floor(rand(31 + i) * 55);
        const colors = ['#fbbf24', '#60a5fa', '#34d399', '#f472b6'];
        const c = colors[Math.floor(rand(32 + i) * colors.length)];
        const rot = Math.floor(rand(33 + i) * 360);
        return `<rect x="${x}" y="${y}" width="12" height="5" rx="2.5" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`;
      }).join('')}
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题5: 可爱城堡
function makeCuteCastleSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 11223 + n * 445) * 10000;
    return x - Math.floor(x);
  };
  const sky = ['#dbeafe', '#e0e7ff', '#cffafe'][Math.floor(rand(1) * 3)];
  const castle = ['#f3f4f6', '#e5e7eb', '#d1d5db'][Math.floor(rand(2) * 3)];
  const roof = ['#ef4444', '#dc2626', '#f87171'][Math.floor(rand(3) * 3)];
  const flag = ['#fbbf24', '#60a5fa', '#34d399'][Math.floor(rand(4) * 3)];
  const clouds = Array.from({ length: 6 }).map((_, i) => {
    const x = 50 + Math.floor(rand(10 + i) * 500);
    const y = 80 + Math.floor(rand(20 + i) * 120);
    return `
      <ellipse cx="${x}" cy="${y}" rx="50" ry="25" fill="white" opacity="0.7"/>
      <ellipse cx="${x + 35}" cy="${y + 5}" rx="40" ry="22" fill="white" opacity="0.7"/>
      <ellipse cx="${x - 30}" cy="${y + 5}" rx="35" ry="20" fill="white" opacity="0.7"/>
    `;
  }).join('');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.15"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${sky[0]}"/>
    ${clouds}
    <!-- Ground -->
    <rect x="0" y="480" width="600" height="120" fill="#86efac" opacity="0.5"/>
    <g filter="url(#shadow)">
      <!-- Main tower -->
      <rect x="220" y="250" width="160" height="230" fill="${castle[0]}"/>
      <polygon points="220,250 300,170 380,250" fill="${roof[0]}"/>
      <rect x="290" y="140" width="20" height="40" fill="${castle[1]}"/>
      <polygon points="290,140 300,115 310,140" fill="${flag[0]}"/>
      <!-- Left tower -->
      <rect x="140" y="320" width="80" height="160" fill="${castle[1]}"/>
      <polygon points="140,320 180,260 220,320" fill="${roof[1]}"/>
      <rect x="170" y="240" width="12" height="30" fill="${castle[2]}"/>
      <polygon points="170,240 176,220 182,240" fill="${flag[1]}"/>
      <!-- Right tower -->
      <rect x="380" y="320" width="80" height="160" fill="${castle[1]}"/>
      <polygon points="380,320 420,260 460,320" fill="${roof[1]}"/>
      <rect x="410" y="240" width="12" height="30" fill="${castle[2]}"/>
      <polygon points="410,240 416,220 422,240" fill="${flag[2]}"/>
      <!-- Door -->
      <path d="M270 480 L270 400 Q300 370 330 400 L330 480 Z" fill="#92400e"/>
      <circle cx="310" cy="445" r="6" fill="#fbbf24"/>
      <!-- Windows -->
      <circle cx="300" cy="310" r="22" fill="#93c5fd" opacity="0.8"/>
      <line x1="300" y1="288" x2="300" y2="332" stroke="${castle[0]}" stroke-width="4"/>
      <line x1="278" y1="310" x2="322" y2="310" stroke="${castle[0]}" stroke-width="4"/>
      <circle cx="180" cy="370" r="14" fill="#93c5fd" opacity="0.8"/>
      <circle cx="420" cy="370" r="14" fill="#93c5bd" opacity="0.8"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题6: 可热气球
function makeCuteHotAirBalloonSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 33445 + n * 667) * 10000;
    return x - Math.floor(x);
  };
  const sky = ['#fef3c7', '#fed7aa', '#fecaca'][Math.floor(rand(1) * 3)];
  const balloon = ['#fb7185', '#f472b6', '#a78bfa', '#60a5fa', '#34d399'][Math.floor(rand(2) * 5)];
  const balloon2 = ['#f97316', '#f59e0b', '#eab308', '#84cc16', '#06b6d4'][Math.floor(rand(3) * 5)];
  const basket = ['#92400e', '#78350f', '#713f12'][Math.floor(rand(4) * 3)];
  const clouds = Array.from({ length: 5 }).map((_, i) => {
    const x = 30 + Math.floor(rand(10 + i) * 540);
    const y = 100 + Math.floor(rand(20 + i) * 150);
    return `
      <ellipse cx="${x}" cy="${y}" rx="55" ry="28" fill="white" opacity="0.6"/>
      <ellipse cx="${x + 40}" cy="${y + 6}" rx="42" ry="24" fill="white" opacity="0.6"/>
      <ellipse cx="${x - 35}" cy="${y + 6}" rx="38" ry="21" fill="white" opacity="0.6"/>
    `;
  }).join('');
  const stripes = Array.from({ length: 8 }).map((_, i) => {
    const color = i % 2 === 0 ? balloon[i % balloon.length] : balloon2[i % balloon2.length];
    return `<path d="M${220 + i * 20} 200 Q${220 + i * 20 + 10} 280 ${260 + i * 15} 340 Q${240 + i * 15} 280 ${240 + i * 20} 200Z" fill="${color}" opacity="0.9"/>`;
  }).join('');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.15"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${sky[0]}"/>
    ${clouds}
    <g filter="url(#shadow)" transform="translate(0, 20)">
      <!-- Balloon envelope -->
      <path d="M220 200 Q220 120 300 100 Q380 120 380 200 Q380 300 340 350 Q300 370 260 350 Q220 300 220 200Z" fill="${balloon[0]}" opacity="0.3"/>
      ${stripes}
      <!-- Basket ropes -->
      <line x1="260" y1="350" x2="270" y2="420" stroke="#78350f" stroke-width="3"/>
      <line x1="340" y1="350" x2="330" y2="420" stroke="#78350f" stroke-width="3"/>
      <line x1="300" y1="362" x2="300" y2="420" stroke="#78350f" stroke-width="3"/>
      <!-- Basket -->
      <rect x="265" y="420" width="70" height="50" rx="8" fill="${basket[0]}"/>
      <line x1="270" y1="435" x2="330" y2="435" stroke="${basket[1]}" stroke-width="2"/>
      <line x1="270" y1="450" x2="330" y2="450" stroke="${basket[1]}" stroke-width="2"/>
      <!-- Burner flame -->
      <path d="M295 415 Q300 395 305 415 Q300 420 295 415Z" fill="#f97316" opacity="0.9"/>
      <path d="M297 412 Q300 400 303 412 Q300 415 297 412Z" fill="#fbbf24"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题7: 可爱猫咪
function makeCuteCatSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 55667 + n * 889) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#fef3c7', '#fce7f3', '#e0e7ff'][Math.floor(rand(1) * 3)];
  const fur = ['#fbbf24', '#fb923c', '#f97316', '#d97706'][Math.floor(rand(2) * 4)];
  const eyes = ['#22c55e', '#059669', '#047857'][Math.floor(rand(3) * 3)];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="catbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg[0]}"/>
        <stop offset="100%" stop-color="${bg[2]}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.15"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="url(#catbg)"/>
    <g filter="url(#shadow)">
      <!-- Ears -->
      <path d="M195 220 L165 140 Q185 135 205 180Z" fill="${fur[0]}"/>
      <path d="M405 220 L435 140 Q415 135 395 180Z" fill="${fur[0]}"/>
      <path d="M198 210 L178 155 Q192 152 204 185Z" fill="#ffffff" opacity="0.3"/>
      <path d="M402 210 L422 155 Q408 152 396 185Z" fill="#ffffff" opacity="0.3"/>
      <!-- Face -->
      <ellipse cx="300" cy="330" rx="145" ry="125" fill="${fur[0]}"/>
      <!-- Eyes -->
      <ellipse cx="245" cy="295" rx="28" ry="35" fill="${eyes[0]}"/>
      <ellipse cx="355" cy="295" rx="28" ry="35" fill="${eyes[0]}"/>
      <ellipse cx="245" cy="290" rx="12" ry="18" fill="#000000"/>
      <ellipse cx="355" cy="290" rx="12" ry="18" fill="#000000"/>
      <circle cx="249" cy="284" r="6" fill="#ffffff"/>
      <circle cx="359" cy="284" r="6" fill="#ffffff"/>
      <!-- Nose -->
      <polygon points="300,340 290,355 310,355" fill="#fb7185"/>
      <!-- Mouth -->
      <path d="M300 355 L285 372 M300 355 L315 372" stroke="#000000" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- Whiskers -->
      <line x1="180" y1="330" x2="230" y2="340" stroke="#000000" stroke-width="2" opacity="0.4"/>
      <line x1="175" y1="350" x2="228" y2="352" stroke="#000000" stroke-width="2" opacity="0.4"/>
      <line x1="420" y1="330" x2="370" y2="340" stroke="#000000" stroke-width="2" opacity="0.4"/>
      <line x1="425" y1="350" x2="372" y2="352" stroke="#000000" stroke-width="2" opacity="0.4"/>
      <!-- Body -->
      <ellipse cx="300" cy="470" rx="130" ry="80" fill="${fur[1] || fur[0]}"/>
      <!-- Stripes on forehead -->
      <path d="M285 230 L290 260 M300 225 L300 258 M315 230 L310 260" stroke="${fur[2] || fur[0]}" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <!-- Tail -->
      <path d="M430 470 Q480 440 470 390 Q465 360 445 365" stroke="${fur[0]}" stroke-width="25" fill="none" stroke-linecap="round"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题8: 可爱冰淇淋
function makeCuteIceCreamSundaeSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 77889 + n * 223) * 10000;
    return x - Math.floor(x);
  };
  const bg = ['#fef3c7', '#fce7f3', '#e0f2fe'][Math.floor(rand(1) * 3)];
  const flavors = [
    { main: '#fb7185', light: '#fecdd3' },
    { main: '#a78bfa', light: '#ede9fe' },
    { main: '#60a5fa', light: '#bfdbfe' },
    { main: '#34d399', light: '#bbf7d0' },
    { main: '#fbbf24', light: '#fef9c3' },
  ];
  const f1 = flavors[Math.floor(rand(2) * flavors.length)];
  const f2 = flavors[Math.floor(rand(3) * flavors.length)];
  const f3 = flavors[Math.floor(rand(4) * flavors.length)];
  const toppings = ['#fbbf24', '#fb7185', '#22c55e', '#a78bfa'];
  const sprinkles = Array.from({ length: 20 }).map((_, i) => {
    const x = 200 + Math.floor(rand(10 + i) * 200);
    const y = 220 + Math.floor(rand(20 + i) * 120);
    const c = toppings[Math.floor(rand(30 + i) * toppings.length)];
    const angle = Math.floor(rand(31 + i) * 360);
    return `<rect x="${x}" y="${y}" width="10" height="4" rx="2" fill="${c}" transform="rotate(${angle} ${x} ${y})"/>`;
  }).join('');
  const cherry = `
    <circle cx="300" cy="185" r="18" fill="#ef4444"/>
    <circle cx="296" cy="179" r="6" fill="#fca5a5"/>
    <path d="M300 167 Q315 150 325 160" stroke="#16a34a" stroke-width="4" fill="none" stroke-linecap="round"/>
  `;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.12"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${bg[0]}"/>
    <g filter="url(#shadow)">
      <!-- Bowl -->
      <path d="M200 380 Q200 480 300 480 Q400 480 400 380Z" fill="#d4d4d8"/>
      <ellipse cx="300" cy="380" rx="100" ry="25" fill="#e4e4e7"/>
      <!-- Ice cream scoops -->
      <circle cx="260" cy="320" r="65" fill="${f1.main}"/>
      <circle cx="340" cy="320" r="65" fill="${f2.main}"/>
      <circle cx="300" cy="260" r="62" fill="${f3.main}"/>
      <!-- Highlights -->
      <circle cx="235" cy="295" r="18" fill="white" opacity="0.35"/>
      <circle cx="315" cy="295" r="18" fill="white" opacity="0.35"/>
      <circle cx="275" cy="238" r="16" fill="white" opacity="0.35"/>
      <!-- Dripping ice cream -->
      <path d="M215 365 Q210 390 222 395Q218 375 228 368" fill="${f1.light}" opacity="0.8"/>
      <path d="M385 365 Q390 390 378 395Q382 375 372 368" fill="${f2.light}" opacity="0.8"/>
      <!-- Sprinkles -->
      ${sprinkles}
      <!-- Cherry on top -->
      ${cherry}
      <!-- Wafer stick -->
      <rect x="285" y="440" width="30" height="50" rx="5" fill="#fbbf24" transform="rotate(15 300 465)"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题9: 可爱太空人
function makeCuteAstronautSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 88901 + n * 334) * 10000;
    return x - Math.floor(x);
  };
  const spaceBg = ['#0f172a', '#1e293b', '#020617'][Math.floor(rand(1) * 3)];
  const suit = ['#e2e8f0', '#f1f5f9', '#cbd5e1'][Math.floor(rand(2) * 3)];
  const visor = ['#60a5fa', '#3b82f6', '#2563eb'][Math.floor(rand(3) * 3)];
  const stars = Array.from({ length: 35 }).map((_, i) => {
    const x = Math.floor(rand(10 + i) * 600);
    const y = Math.floor(rand(20 + i) * 600);
    const r = 1 + Math.floor(rand(30 + i) * 3);
    const o = 0.3 + rand(40 + i) * 0.7;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${o.toFixed(2)}"/>`;
  }).join('');
  const planets = Array.from({ length: 2 }).map((_, i) => {
    const x = 80 + i * 420;
    const y = 100 + Math.floor(rand(50 + i) * 150);
    const r = 25 + Math.floor(rand(51 + i) * 30);
    const colors = ['#fb7185', '#f59e0b', '#a78bfa', '#34d399'];
    const c = colors[Math.floor(r % colors.length)];
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.6"/>`;
  }).join('');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <radialGradient id="spaceglow" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stop-color="${visor[0]}" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="${visor[0]}" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${spaceBg[0]}"/>
    ${stars}
    ${planets}
    <circle cx="300" cy="280" r="220" fill="url(#spaceglow)"/>
    <g filter="url(#shadow)">
      <!-- Backpack -->
      <rect x="210" y="330" width="180" height="120" rx="20" fill="${suit[1]}"/>
      <rect x="225" y="345" width="150" height="90" rx="12" fill="${suit[0]}" opacity="0.5"/>
      <!-- Helmet -->
      <circle cx="300" cy="250" r="95" fill="${suit[0]}"/>
      <circle cx="300" cy="250" r="75" fill="${visor[0]}"/>
      <circle cx="300" cy="250" r="65" fill="#0ea5e9" opacity="0.4"/>
      <!-- Visor reflection -->
      <ellipse cx="275" cy="225" rx="25" ry="18" fill="white" opacity="0.25" transform="rotate(-20 275 225)"/>
      <!-- Body suit -->
      <ellipse cx="300" cy="390" rx="90" ry="100" fill="${suit[0]}"/>
      <!-- Control panel -->
      <rect x="265" y="360" width="70" height="50" rx="8" fill="${suit[2]}"/>
      <circle cx="280" cy="375" r="6" fill="#22c55e"/>
      <circle cx="300" cy="375" r="6" fill="#fbbf24"/>
      <circle cx="320" cy="375" r="6" fill="#ef4444"/>
      <rect x="275" y="390" width="50" height="8" rx="4" fill="#94a3b8"/>
      <!-- Arms -->
      <ellipse cx="195" cy="380" rx="28" ry="55" fill="${suit[1]}" transform="rotate(20 195 380)"/>
      <ellipse cx="405" cy="380" rx="28" ry="55" fill="${suit[1]}" transform="rotate(-20 405 380)"/>
      <!-- Gloves -->
      <circle cx="178" cy="418" r="22" fill="#ffffff" opacity="0.9"/>
      <circle cx="422" cy="418" r="22" fill="#ffffff" opacity="0.9"/>
      <!-- Legs -->
      <ellipse cx="265" cy="485" rx="30" ry="45" fill="${suit[1]}"/>
      <ellipse cx="335" cy="485" rx="30" ry="45" fill="${suit[1]}"/>
      <!-- Boots -->
      <ellipse cx="265" cy="522" rx="35" ry="22" fill="#1f2937"/>
      <ellipse cx="335" cy="522" rx="35" ry="22" fill="#1f2937"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#ffffff" opacity="0.85">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题10: 可爱蘑菇屋
function makeCuteMushroomHouseSvg(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 99011 + n * 556) * 10000;
    return x - Math.floor(x);
  };
  const sky = ['#dcfce7', '#fef9c3', '#e0e7ff'][Math.floor(rand(1) * 3)];
  const cap = ['#fb7185', '#f472b6', '#ef4444'][Math.floor(rand(2) * 3)];
  const house = ['#fef3c7', '#fffbeb', '#fde68a'][Math.floor(rand(3) * 3)];
  const door = ['#92400e', '#78350f', '#713f12'][Math.floor(rand(4) * 3)];
  const grass = Array.from({ length: 15 }).map((_, i) => {
    const x = 50 + Math.floor(rand(10 + i) * 500);
    const h = 15 + Math.floor(rand(20 + i) * 25);
    return `<path d="M${x} 480 L${x - 5} ${480 - h} L${x + 5} ${480 - h}Z" fill="#22c55e" opacity="0.7"/>`;
  }).join('');
  const spots = Array.from({ length: 8 }).map((_, i) => {
    const angle = (i / 8) * Math.PI * 2 + 0.3;
    const dist = 60 + Math.floor(rand(10 + i) * 50);
    const x = 300 + Math.cos(angle) * dist;
    const y = 220 + Math.sin(angle) * dist * 0.6;
    const r = 12 + Math.floor(rand(20 + i) * 15);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="white" opacity="0.85"/>`;
  }).join('');
  const window = `
    <circle cx="230" cy="380" r="22" fill="#93c5fd" opacity="0.85"/>
    <line x1="230" y1="358" x2="230" y2="402" stroke="${house[0]}" stroke-width="4"/>
    <line x1="208" y1="380" x2="252" y2="380" stroke="${house[0]}" stroke-width="4"/>
    <circle cx="370" cy="380" r="22" fill="#93c5fd" opacity="0.85"/>
    <line x1="370" y1="358" x2="370" y2="402" stroke="${house[0]}" stroke-width="4"/>
    <line x1="348" y1="380" x2="392" y2="380" stroke="${house[0]}" stroke-width="4"/>
  `;
  const chimney = `
    <rect x="340" y="220" width="30" height="70" rx="5" fill="${cap[0]}"/>
    <ellipse cx="355" cy="215" rx="22" ry="10" fill="#fca5a5" opacity="0.6"/>
    <path d="M348 210 Q355 195 362 210" fill="none" stroke="#d1d5db" stroke-width="3" opacity="0.5"/>
  `;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.12"/>
      </filter>
    </defs>
    <rect width="600" height="600" rx="54" fill="${sky[0]}"/>
    <!-- Sun -->
    <circle cx="500" cy="100" r="45" fill="#fbbf24" opacity="0.9"/>
    ${Array.from({ length: 12 }).map((_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const x1 = 500 + Math.cos(angle) * 55;
      const y1 = 100 + Math.sin(angle) * 55;
      const x2 = 500 + Math.cos(angle) * 72;
      const y2 = 100 + Math.sin(angle) * 72;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>`;
    }).join('')}
    <!-- Ground -->
    <rect x="0" y="470" width="600" height="130" fill="#86efac" opacity="0.5"/>
    ${grass}
    <g filter="url(#shadow)">
      <!-- House body -->
      <rect x="190" y="310" width="220" height="170" rx="15" fill="${house[0]}"/>
      <!-- Mushroom cap -->
      <path d="M140 310 Q300 120 460 310Z" fill="${cap[0]}"/>
      ${spots}
      <!-- Door -->
      <path d="M270 480 L270 400 Q300 370 330 400 L330 480Z" fill="${door[0]}"/>
      <circle cx="315" cy="442" r="6" fill="#fbbf24"/>
      ${window}
      ${chimney}
      <!-- Fence -->
      ${Array.from({ length: 6 }).map((_, i) => {
        const x = 120 + i * 65;
        return `
          <rect x="${x}" y="445" width="12" height="30" rx="3" fill="#fbbf24" opacity="0.8"/>
          <rect x="${x - 8}" y="455" width="28" height="6" rx="2" fill="#fbbf24" opacity="0.8"/>
        `;
      }).join('')}
      <!-- Path -->
      <path d="M270 480 Q300 510 330 480L340 530L260 530Z" fill="#d4d4d8" opacity="0.6"/>
    </g>
    <text x="300" y="560" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="900" fill="#0f172a" opacity="0.65">第 ${seed} 关</text>
  </svg>`;
  return encodeSvgDataUri(svg);
}

// 新增主题11-20: 更多多样化主题
function makeCuteWhaleSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 22334 + n * 667) * 10000; return x - Math.floor(x); };
  const sea = ['#0ea5e9', '#0284c7', '#0369a1'][Math.floor(rand(1) * 3)];
  const whale = ['#60a5fa', '#3b82f6', '#2563eb'][Math.floor(rand(2) * 3)];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sea[0]}"/><stop offset="100%" stop-color="${sea[2]}"/></linearGradient></defs><rect width="600" height="600" rx="54" fill="url(#ocean)"/><g><ellipse cx="280" cy="320" rx="160" ry="95" fill="${whale[0]}"/><circle cx="210" cy="295" r="18" fill="#1f293b"/><ellipse cx="195" cy="325" rx="20" ry="14" fill="#fb7185" opacity="0.35"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" opacity="0.85">第 ${seed} 关</text></svg>`);
}

function makeCuteButterflyGardenSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 44556 + n * 889) * 10000; return x - Math.floor(x); };
  const bg = ['#fef3c7', '#fce7f3'][Math.floor(rand(1) * 2)];
  const wc = ['#fb7185', '#a78bfa', '#60a5fa'];
  const w1 = wc[Math.floor(rand(2) * 3)], w2 = wc[Math.floor(rand(3) * 3)];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="54" fill="${bg[0]}"/><g transform="translate(0,-30)"><path d="M300 260 Q220 180 170 220 Q140 260 180 300 Q220 320 300 275Z" fill="${w1}" opacity="0.9"/><path d="M300 260 Q380 180 430 220 Q460 260 420 300 Q380 320 300 275Z" fill="${w1}" opacity="0.9"/><path d="M300 280 Q230 320 190 370 Q200 410 250 395 Q285 370 300 290Z" fill="${w2}" opacity="0.85"/><path d="M300 280 Q370 320 410 370 Q400 410 350 395 Q315 370 300 290Z" fill="${w2}" opacity="0.85"/><ellipse cx="300" cy="290" rx="14" ry="75" fill="#374151"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900">第 ${seed} 关</text></svg>`);
}

function makeCuteMoonNightSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 88899 + n * 444) * 10000; return x - Math.floor(x); };
  const nightBg = ['#0f172a', '#1e1b4b'][Math.floor(rand(1) * 2)];
  const moonFace = ['#fef3c7', '#fde68a'][Math.floor(rand(2) * 2)];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="54" fill="${nightBg[0]}"/><g><circle cx="300" cy="250" r="120" fill="${moonFace[0]}"/><circle cx="260" cy="220" r="18" fill="#1f2937"/><circle cx="340" cy="220" r="18" fill="#1f2937"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" opacity="0.85">第 ${seed} 关</text></svg>`);
}

function makeCuteHeartsSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 33333 + n * 777) * 10000; return x - Math.floor(x); };
  const bg = ['#fce7f3', '#fdf2f8'][Math.floor(rand(1) * 2)];
  const hc = ['#ef4444', '#fb7185', '#f472b6'];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="54" fill="${bg[0]}"/><g transform="translate(300,280) scale(2)"><path d="M0 -10 C-15 -25 -30 -10 -30 5 C-30 20 0 40 0 45 C0 40 30 20 30 5 C30 -10 15 -25 0 -10Z" fill="${hc[Math.floor(rand(2) * 3)]}" opacity="0.9"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900">第 ${seed} 关</text></svg>`);
}

function makeCuteStarSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 55555 + n * 222) * 10000; return x - Math.floor(x); };
  const bg = ['#fef3c7', '#e0f2fe', '#dcfce7'][Math.floor(rand(1) * 3)];
  const starColor = ['#fbbf24', '#fb923c', '#f59e0b'][Math.floor(rand(2) * 3)];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="54" fill="${bg[0]}"/><g filter="url(#shadow)" transform="translate(300,280)"><polygon points="0,-120 28,-38 115,-35 48,18 68,105 0,65 -68,105 -52,18 -115,-35 -28,-38" fill="${starColor[0]}" opacity="0.95"/><polygon points="0,-90 21,-28 86,-26 36,14 51,79 0,49 -51,79 -39,14 -86,-26 -21,-28" fill="#fff" opacity="0.25"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900">第 ${seed} 关</text></svg>`);
}

function makeCuteCloudSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 77777 + n * 555) * 10000; return x - Math.floor(x); };
  const sky = ['#dbeafe', '#e0f2fe', '#cffafe'][Math.floor(rand(1) * 3)];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="54" fill="${sky[0]}"/><g><ellipse cx="240" cy="280" rx="80" ry="55" fill="#fff" opacity="0.95"/><ellipse cx="310" cy="260" rx="90" ry="62" fill="#fff" opacity="0.95"/><ellipse cx="380" cy="285" rx="75" ry="52" fill="#fff" opacity="0.95"/><ellipse cx="270" cy="305" rx="100" ry="50" fill="#fff" opacity="0.9"/><ellipse cx="350" cy="308" rx="85" ry="48" fill="#fff" opacity="0.9"/><ellipse cx="245" cy="268" rx="35" ry="25" fill="#fff" opacity="0.6"/><ellipse cx="365" cy="255" rx="32" ry="23" fill="#fff" opacity="0.6"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900">第 ${seed} 关</text></svg>`);
}

function makeCuteTreeSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 99999 + n * 333) * 10000; return x - Math.floor(x); };
  const bg = ['#dcfce7', '#d1fae5', '#ecfdf5'][Math.floor(rand(1) * 3)];
  const tree = ['#22c55e', '#16a34a', '#15803d'][Math.floor(rand(2) * 3)];
  const trunk = ['#92400e', '#78350f'][Math.floor(rand(3) * 2)];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="54" fill="${bg[0]}"/><g><rect x="275" y="360" width="50" height="130" rx="8" fill="${trunk[0]}"/><polygon points="300,140 220,280 380,280" fill="${tree[0]}" opacity="0.95"/><polygon points="300,190 235,310 365,310" fill="${tree[1]}" opacity="0.9"/><polygon points="300,240 250,340 350,340" fill="${tree[2]}" opacity="0.85"/><circle cx="280" cy="260" r="12" fill="#fb7185" opacity="0.7"/><circle cx="320" cy="280" r="10" fill="#fbbf24" opacity="0.7"/><circle cx="295" cy="295" r="8" fill="#ef4444" opacity="0.7"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900">第 ${seed} 关</text></svg>`);
}

function makeCuteFishBowlSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 11111 + n * 999) * 10000; return x - Math.floor(x); };
  const bg = ['#fef3c7', '#fce7f3', '#e0f2fe'][Math.floor(rand(1) * 3)];
  const fish = ['#fb7185', '#f59e0b', '#60a5fa'][Math.floor(rand(2) * 3)];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="54" fill="${bg[0]}"/><g><ellipse cx="300" cy="330" rx="150" ry="125" fill="#bfdbfe" opacity="0.4" stroke="#94a3b8" stroke-width="4"/><ellipse cx="300" cy="340" rx="135" ry="110" fill="#7dd3fc" opacity="0.3"/><ellipse cx="260" cy="310" rx="50" ry="35" fill="${fish[0]}" opacity="0.9"/><polygon points="210,310 175,285 185,310 175,335" fill="${fish[0]}" opacity="0.85"/><circle cx="245" cy="302" r="7" fill="#1f2937"/><circle cx="247" cy="299" r="3" fill="#fff"/><ellipse cx="230" cy="318" rx="8" ry="5" fill="#fb7185" opacity="0.5"/><circle cx="340" cy="360" rx="25" ry="18" fill="${fish[1] || fish[0]}" opacity="0.8"/><circle cx="332" cy="355" r="5" fill="#1f2937"/><circle cx="333" cy="353" r="2" fill="#fff"/><path d="M270 400 Q285 415 300 405 Q315 415 330 400" stroke="#16a34a" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/><circle cx="285" cy="395" r="10" fill="#22c55e" opacity="0.5"/><circle cx="315" cy="398" r="8" fill="#22c55e" opacity="0.5"/><rect x="280" y="450" width="40" height="25" rx="5" fill="#d4d4d8"/><rect x="270" y="445" width="60" height="10" rx="5" fill="#a1a1aa"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900">第 ${seed} 关</text></svg>`);
}

function makeCuteGiftBoxSvg(seed: number) {
  const rand = (n: number) => { const x = Math.sin(seed * 22222 + n * 888) * 10000; return x - Math.floor(x); };
  const bg = ['#fef3c7', '#fce7f3', '#dcfce7'][Math.floor(rand(1) * 3)];
  const box = ['#ef4444', '#3b82f6', '#22c55e', '#a78bfa'][Math.floor(rand(2) * 4)];
  const ribbon = ['#fbbf24', '#fb7185', '#60a5fa'][Math.floor(rand(3) * 3)];
  return encodeSvgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="54" fill="${bg[0]}"/><g><rect x="170" y="280" width="260" height="200" rx="12" fill="${box[0]}" opacity="0.9"/><rect x="165" y="270" width="270" height="25" rx="8" fill="${box[0]}" opacity="0.85"/><rect x="285" y="270" width="30" height="210" fill="${ribbon[0]}" opacity="0.95"/><rect x="170" y="360" width="260" height="20" fill="${ribbon[0]}" opacity="0.9"/><path d="M300 270 C270 230 230 240 240 275 C250 290 280 280 300 270Z" fill="${ribbon[1] || ribbon[0]}" opacity="0.9"/><path d="M300 270 C330 230 370 240 360 275 C350 290 320 280 300 270Z" fill="${ribbon[1] || ribbon[0]}" opacity="0.9"/><circle cx="270" cy="250" r="8" fill="#fbbf24" opacity="0.7"/><circle cx="330" cy="245" r="6" fill="#fb7185" opacity="0.7"/><circle cx="295" cy="235" r="5" fill="#60a5fa" opacity="0.7"/><circle cx="310" cy="255" r="7" fill="#22c55e" opacity="0.7"/></g><text x="300" y="560" text-anchor="middle" font-size="34" font-weight="900">第 ${seed} 关</text></svg>`);
}

// 更新后的关卡生成函数，使用35个不同主题
function makeLevelImage(seed: number) {
  const themes = [
    // 原有15个主题
    makeCuteAnimalSvg,
    makeCuteRocketSvg,
    makeCuteUnderwaterSvg,
    makeCuteFruitSvg,
    makeCuteCarSvg,
    makeCuteDinoSvg,
    makeCuteRobotSvg,
    makeCuteRainbowSvg,
    makeCuteBalloonSvg,
    makeCuteIceCreamSvg,
    makeCutePlanetSvg,
    makeCuteHouseSvg,
    makeCuteTrainSvg,
    makeCuteFlowerGardenSvg,
    makeCuteBoatSvg,
    // 新增20个主题
    makeCutePandaSvg,
    makeCutePenguinSvg,
    makeCuteUnicornSvg,
    makeCuteCakeSvg,
    makeCuteCastleSvg,
    makeCuteHotAirBalloonSvg,
    makeCuteCatSvg,
    makeCuteIceCreamSundaeSvg,
    makeCuteAstronautSvg,
    makeCuteMushroomHouseSvg,
    makeCuteWhaleSvg,
    makeCuteButterflyGardenSvg,
    makeCuteMoonNightSvg,
    makeCuteHeartsSvg,
    makeCuteStarSvg,
    makeCuteCloudSvg,
    makeCuteTreeSvg,
    makeCuteFishBowlSvg,
    makeCuteGiftBoxSvg,
  ];
  // 使用更好的哈希算法确保分布均匀，50关内尽量不重复
  const h = (seed * 2654435761 >>> 0) ^ (seed * 1449694597 >>> 0);
  const idx = h % themes.length;
  const themeFn = themes[idx];
  // 防御性检查：如果主题函数不存在或不是函数，使用默认主题
  if (typeof themeFn !== 'function') {
    console.warn(`Theme function at index ${idx} is not a function, using fallback`);
    return makeCuteAnimalSvg(seed);
  }
  return themeFn(seed);
}

function buildLevels(): LevelDef[] {
  return Array.from({ length: TOTAL_LEVELS }).map((_, idx) => {
    const id = idx + 1;
    return {
      id,
      title: `关卡 ${id}`,
      imageDataUri: makeLevelImage(id),
    };
  });
}

function loadProgress(): { completed: number[]; currentLevel: number } {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return { completed: [], currentLevel: 1 };
    const parsed = JSON.parse(raw);
    const completed = Array.isArray(parsed?.completed) ? parsed.completed : [];
    const normalized = completed
      .map((n: any) => Number(n))
      .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= TOTAL_LEVELS) as number[];
    const currentLevel = clamp(Number(parsed?.currentLevel || 1), 1, TOTAL_LEVELS);
    return { completed: Array.from(new Set(normalized)).sort((a, b) => a - b), currentLevel };
  } catch {
    return { completed: [], currentLevel: 1 };
  }
}

function saveProgress(state: { completed: number[]; currentLevel?: number }) {
  const current = loadProgress();
  localStorage.setItem(
    GAME_STORAGE_KEY,
    JSON.stringify({
      completed: state.completed,
      currentLevel: state.currentLevel ?? current.currentLevel ?? 1,
    })
  );
}

function isSolvable3x3(tiles: number[]) {
  // 3x3 solvable iff inversions is even (ignoring 0)
  let inv = 0;
  const flat = tiles.filter((t) => t !== 0);
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i] > flat[j]) inv++;
    }
  }
  return inv % 2 === 0;
}

function shuffledSolvable(): number[] {
  const total = GRID_SIZE * GRID_SIZE; // 9
  const target = [...Array(total).keys()].map((i) => (i === total - 1 ? 0 : i + 1)); // [1..8,0]
  const shuffle = (arr: number[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let tiles: number[];
  do {
    tiles = shuffle(target);
  } while (!isSolvable3x3(tiles) || tiles.join(',') === target.join(','));
  return tiles;
}

export const ImageSlidePuzzleGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

  const levels = useMemo(() => buildLevels(), []);
  const imgCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());

  const initial = useMemo(() => loadProgress(), []);
  const [levelId, setLevelId] = useState(initial.currentLevel || 1);
  const [completedLevels, setCompletedLevels] = useState<number[]>(() => initial.completed);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [completed, setCompleted] = useState(false);
  const isMobile = Math.min(width, height) <= 600;

  const tilesRef = useRef<number[]>([]);
  const emptyRef = useRef(8);
  const movesRef = useRef(0);
  const animatingRef = useRef<{ fromIdx: number; toIdx: number; progress: number } | null>(null);
  const tileCanvasCacheRef = useRef<HTMLCanvasElement[]>([]);

  const maxCompleted = completedLevels.length ? completedLevels[completedLevels.length - 1] : 0;
  const maxUnlocked = Math.max(FREE_SWITCH_LEVELS, clamp(maxCompleted + 1, 1, TOTAL_LEVELS));

  const isUnlocked = useCallback((id: number) => {
    if (id <= FREE_SWITCH_LEVELS) return true;
    if (completedLevels.includes(id)) return true;
    return id <= maxUnlocked;
  }, [completedLevels, maxUnlocked]);

  const ensureImageLoaded = useCallback((id: number) => {
    if (imgCacheRef.current.has(id)) return;
    const def = levels[id - 1];
    if (!def) return;
    const img = new Image();
    img.src = def.imageDataUri;
    imgCacheRef.current.set(id, img);
  }, [levels]);

  const initGame = useCallback((newLevelId: number) => {
    // 确保关卡ID在有效范围内
    const safeLevelId = clamp(newLevelId, 1, TOTAL_LEVELS);
    ensureImageLoaded(safeLevelId);
    // 立即同步保存到localStorage，防止刷新后丢失
    saveProgress({ completed: loadProgress().completed, currentLevel: safeLevelId });
    tilesRef.current = shuffledSolvable();
    emptyRef.current = tilesRef.current.indexOf(0);
    movesRef.current = 0;
    animatingRef.current = null;
    setCompleted(false);
    tileCanvasCacheRef.current = [];
    // 延迟构建tile缓存，确保图片已加载
    setTimeout(() => buildTileCache(safeLevelId), 100);
  }, [ensureImageLoaded]);

  const buildTileCache = useCallback((lvl: number) => {
    const padding = Math.max(14, width * 0.02);
    const previewSize = clamp(Math.floor(Math.min(width, height) * (isMobile ? 0.14 : 0.16)), 52, 110);
    const headerY = isMobile ? (padding + previewSize + 26) : Math.max(86, height * 0.11);
    const topOffset = headerY;
    const availSize = Math.min(width - padding * 2, (height - topOffset - height * (isMobile ? 0.08 : 0.12)));
    const cellSize = availSize / GRID_SIZE;
    const gap = 5;
    const w = cellSize - gap * 2;

    const img = imgCacheRef.current.get(lvl);
    const ready = img && img.complete && img.naturalWidth > 0;
    const srcCell = Math.floor(Math.min(img?.naturalWidth || 300, img?.naturalHeight || 300) / GRID_SIZE);
    const srcX0 = Math.floor(((img?.naturalWidth || 300) - srcCell * GRID_SIZE) / 2);
    const srcY0 = Math.floor(((img?.naturalHeight || 300) - srcCell * GRID_SIZE) / 2);

    const caches: HTMLCanvasElement[] = [];
    for (let idx = 0; idx < 9; idx++) {
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = w * 2;
      tileCanvas.height = w * 2;
      const tctx = tileCanvas.getContext('2d');
      if (!tctx) { caches.push(tileCanvas); continue; }
      tctx.scale(2, 2);

      if (idx === 8) {
        tctx.fillStyle = 'rgba(0,0,0,0.25)';
        tctx.beginPath();
        tctx.roundRect(0, 0, w, w, 14);
        tctx.fill();
        tctx.strokeStyle = 'rgba(255,255,255,0.18)';
        tctx.lineWidth = 2;
        tctx.stroke();

        const label = 9;
        const badgeSize = Math.max(18, w * 0.28);
        tctx.fillStyle = 'rgba(255,255,255,0.12)';
        tctx.beginPath();
        tctx.arc(w - badgeSize / 2 - 6, w - badgeSize / 2 - 6, badgeSize / 2, 0, Math.PI * 2);
        tctx.fill();
        tctx.fillStyle = 'rgba(255,255,255,0.55)';
        tctx.font = `900 ${Math.max(12, badgeSize * 0.48)}px ui-sans-serif, system-ui, -apple-system`;
        tctx.textAlign = 'center';
        tctx.textBaseline = 'middle';
        tctx.fillText(String(label), w - badgeSize / 2 - 6, w - badgeSize / 2 - 6);
      } else {
        tctx.save();
        tctx.beginPath();
        tctx.roundRect(0, 0, w, w, 14);
        tctx.clip();

        if (ready) {
          const val = idx + 1;
          const sr = Math.floor((val - 1) / GRID_SIZE);
          const sc = (val - 1) % GRID_SIZE;
          const sx = srcX0 + sc * srcCell;
          const sy = srcY0 + sr * srcCell;
          tctx.drawImage(img, sx, sy, srcCell, srcCell, 0, 0, w, w);
        } else {
          tctx.fillStyle = 'rgba(255,255,255,0.18)';
          tctx.fillRect(0, 0, w, w);
          tctx.fillStyle = 'rgba(255,255,255,0.65)';
          tctx.font = `800 ${Math.max(18, w * 0.28)}px ui-sans-serif, system-ui, -apple-system`;
          tctx.textAlign = 'center';
          tctx.textBaseline = 'middle';
          tctx.fillText(String(idx + 1), w / 2, w / 2);
        }
        tctx.restore();

        tctx.strokeStyle = 'rgba(255,255,255,0.28)';
        tctx.lineWidth = 2;
        tctx.beginPath();
        tctx.roundRect(0, 0, w, w, 14);
        tctx.stroke();

        const label = idx + 1;
        const badgeSize = Math.max(18, w * 0.28);
        tctx.fillStyle = 'rgba(0,0,0,0.35)';
        tctx.beginPath();
        tctx.arc(w - badgeSize / 2 - 6, w - badgeSize / 2 - 6, badgeSize / 2, 0, Math.PI * 2);
        tctx.fill();
        tctx.fillStyle = 'rgba(255,255,255,0.95)';
        tctx.font = `900 ${Math.max(12, badgeSize * 0.48)}px ui-sans-serif, system-ui, -apple-system`;
        tctx.textAlign = 'center';
        tctx.textBaseline = 'middle';
        tctx.fillText(String(label), w - badgeSize / 2 - 6, w - badgeSize / 2 - 6);
      }

      caches.push(tileCanvas);
    }
    tileCanvasCacheRef.current = caches;
  }, [width, height, isMobile]);

  useEffect(() => {
    if (!isPlaying) return;
    initGame(levelId);
  }, [isPlaying, levelId, initGame]);

  const markLevelCompleted = useCallback((id: number) => {
    setCompletedLevels((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].sort((a, b) => a - b);
      saveProgress({ completed: next });
      return next;
    });
  }, []);

  const tryMoveAtIndex = useCallback((clickedIdx: number) => {
    if (!isPlaying || completed || animatingRef.current) return;
    const emptyIdx = emptyRef.current;
    const r = Math.floor(clickedIdx / GRID_SIZE);
    const c = clickedIdx % GRID_SIZE;
    const er = Math.floor(emptyIdx / GRID_SIZE);
    const ec = emptyIdx % GRID_SIZE;
    const adjacent = (Math.abs(r - er) + Math.abs(c - ec)) === 1;
    if (!adjacent) return;

    animatingRef.current = { fromIdx: clickedIdx, toIdx: emptyIdx, progress: 0 };
    const newTiles = [...tilesRef.current];
    [newTiles[clickedIdx], newTiles[emptyIdx]] = [newTiles[emptyIdx], newTiles[clickedIdx]];
    tilesRef.current = newTiles;
    emptyRef.current = clickedIdx;
    movesRef.current++;
    playSound('shoot');

    const target = [...Array(9).keys()].map((i) => (i === 8 ? 0 : i + 1));
    const won = newTiles.every((t, i) => t === target[i]);
    if (won) {
      setTimeout(() => {
        setCompleted(true);
        markLevelCompleted(levelId);
        playSound('correct');
        onScore(80 + Math.max(0, 40 - movesRef.current));
      }, 220);
    }
  }, [isPlaying, completed, levelId, markLevelCompleted, onScore]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying) return;
    // When completed, tap anywhere to continue
    if (completed) {
      const next = clamp(levelId + 1, 1, TOTAL_LEVELS);
      if (isUnlocked(next)) {
        setLevelId(next);
        initGame(next);
      } else {
        setShowLevelSelect(true);
      }
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = Math.max(14, width * 0.02);
    const previewSize = clamp(Math.floor(Math.min(width, height) * (isMobile ? 0.14 : 0.16)), 52, 110);
    const headerY = isMobile ? (padding + previewSize + 26) : Math.max(86, height * 0.11);
    const topOffset = headerY;
    const availSize = Math.min(width - padding * 2, (height - topOffset - height * (isMobile ? 0.08 : 0.12)));
    const cellSize = availSize / GRID_SIZE;
    const gridX = (width - availSize) / 2;
    const gridY = topOffset;

    const col = Math.floor((x - gridX) / cellSize);
    const row = Math.floor((y - gridY) / cellSize);
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return;

    const clickedIdx = row * GRID_SIZE + col;
    tryMoveAtIndex(clickedIdx);
  }, [width, height, isPlaying, completed, tryMoveAtIndex, isMobile, levelId, initGame, isUnlocked]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    if (animatingRef.current) {
      animatingRef.current.progress += 0.16;
      if (animatingRef.current.progress >= 1) animatingRef.current = null;
    }

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);

    const padding = Math.max(14, width * 0.02);
    const previewSize = clamp(Math.floor(Math.min(width, height) * (isMobile ? 0.14 : 0.16)), 52, 110);
    const headerY = isMobile ? (padding + previewSize + 26) : Math.max(86, height * 0.11);
    const topOffset = headerY;
    const availSize = Math.min(width - padding * 2, (height - topOffset - height * (isMobile ? 0.08 : 0.12)));
    const cellSize = availSize / GRID_SIZE;
    const gridX = (width - availSize) / 2;
    const gridY = topOffset;
    const gap = 5;

    // Header
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.min(24, width * 0.028)}px ui-sans-serif, system-ui, -apple-system`;
    ctx.textAlign = 'center';
    ctx.fillText(`第${levelId}关  |  步数: ${movesRef.current}`, width / 2, topOffset - 18);

    // Full image preview (place just left of the board on mobile/compact)
    const img = imgCacheRef.current.get(levelId);
    const ready = img && img.complete && img.naturalWidth > 0;
    const srcCell = Math.floor(Math.min(img?.naturalWidth || 300, img?.naturalHeight || 300) / GRID_SIZE);
    const srcX0 = Math.floor(((img?.naturalWidth || 300) - srcCell * GRID_SIZE) / 2);
    const srcY0 = Math.floor(((img?.naturalHeight || 300) - srcCell * GRID_SIZE) / 2);
    const idealPreviewX = gridX - previewSize - 10;
    const previewX = idealPreviewX >= padding ? idealPreviewX : padding;
    const previewY = idealPreviewX >= padding ? gridY : padding;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.roundRect(previewX, previewY, previewSize, previewSize, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(previewX, previewY, previewSize, previewSize, 14);
    ctx.clip();
    if (ready) {
      const srcSizePreview = Math.min(img.naturalWidth, img.naturalHeight);
      const srcX0Preview = Math.floor((img.naturalWidth - srcSizePreview) / 2);
      const srcY0Preview = Math.floor((img.naturalHeight - srcSizePreview) / 2);
      ctx.drawImage(img, srcX0Preview, srcY0Preview, srcSizePreview, srcSizePreview, previewX, previewY, previewSize, previewSize);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(previewX, previewY, previewSize, previewSize);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `900 ${Math.max(14, previewSize * 0.22)}px ui-sans-serif, system-ui, -apple-system`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('预览', previewX + previewSize / 2, previewY + previewSize / 2);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(previewX, previewY, previewSize, previewSize, 14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `800 ${Math.max(11, previewSize * 0.14)}px ui-sans-serif, system-ui, -apple-system`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('完整图', previewX + 8, previewY + Math.max(16, previewSize * 0.18));

    // Board background
    ctx.fillStyle = 'rgba(15,23,42,0.25)';
    ctx.beginPath();
    ctx.roundRect(gridX - 10, gridY - 10, availSize + 20, availSize + 20, 18);
    ctx.fill();

    const w = cellSize - gap * 2;
    const caches = tileCanvasCacheRef.current;
    const useCache = caches.length === 9;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const idx = r * GRID_SIZE + c;
        const val = tilesRef.current[idx];

        let drawX = gridX + c * cellSize + gap;
        let drawY = gridY + r * cellSize + gap;
        if (animatingRef.current && animatingRef.current.toIdx === idx) {
          const fromC = animatingRef.current.fromIdx % GRID_SIZE;
          const fromR = Math.floor(animatingRef.current.fromIdx / GRID_SIZE);
          const p = animatingRef.current.progress;
          drawX = gridX + (fromC + (c - fromC) * p) * cellSize + gap;
          drawY = gridY + (fromR + (r - fromR) * p) * cellSize + gap;
        }

        if (useCache) {
          const cacheIdx = val === 0 ? 8 : val - 1;
          if (caches[cacheIdx]) {
            ctx.drawImage(caches[cacheIdx], drawX, drawY, w, w);
          }
        } else {
          if (val === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.roundRect(drawX, drawY, w, w, 14);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 2;
            ctx.stroke();

            const label = 9;
            const badgeSize = Math.max(18, w * 0.28);
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.arc(drawX + w - badgeSize / 2 - 6, drawY + w - badgeSize / 2 - 6, badgeSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = `900 ${Math.max(12, badgeSize * 0.48)}px ui-sans-serif, system-ui, -apple-system`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(label), drawX + w - badgeSize / 2 - 6, drawY + w - badgeSize / 2 - 6);
            ctx.restore();
            continue;
          }

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(drawX, drawY, w, w, 14);
          ctx.clip();

          if (ready) {
            const srcIndex = val - 1;
            const sr = Math.floor(srcIndex / GRID_SIZE);
            const sc = srcIndex % GRID_SIZE;
            const sx = srcX0 + sc * srcCell;
            const sy = srcY0 + sr * srcCell;
            ctx.drawImage(img, sx, sy, srcCell, srcCell, drawX, drawY, w, w);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(drawX, drawY, w, w);
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.font = `800 ${Math.max(18, w * 0.28)}px ui-sans-serif, system-ui, -apple-system`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(val), drawX + w / 2, drawY + w / 2);
          }

          ctx.restore();

          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(drawX, drawY, w, w, 14);
          ctx.stroke();

          const label = val;
          const badgeSize = Math.max(18, w * 0.28);
          const bx = drawX + w - badgeSize / 2 - 6;
          const by = drawY + w - badgeSize / 2 - 6;
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.arc(bx, by, badgeSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.font = `900 ${Math.max(12, badgeSize * 0.48)}px ui-sans-serif, system-ui, -apple-system`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(label), bx, by);
          ctx.restore();
        }
      }
    }

    // Completed overlay
    if (completed) {
      const emptyIdx = emptyRef.current;
      const er = Math.floor(emptyIdx / GRID_SIZE);
      const ec = emptyIdx % GRID_SIZE;
      const w = cellSize - gap * 2;
      const fx = gridX + ec * cellSize + gap;
      const fy = gridY + er * cellSize + gap;

      if (useCache && caches[8]) {
        ctx.drawImage(caches[8], fx, fy, w, w);
      } else if (ready) {
        const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
        const srcX0 = Math.floor((img.naturalWidth - srcSize) / 2);
        const srcY0 = Math.floor((img.naturalHeight - srcSize) / 2);
        const srcCell = srcSize / GRID_SIZE;
        const srcIndex = 8;
        const sr = Math.floor(srcIndex / GRID_SIZE);
        const sc = srcIndex % GRID_SIZE;
        const sx = srcX0 + sc * srcCell;
        const sy = srcY0 + sr * srcCell;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(fx, fy, w, w, 14);
        ctx.clip();
        ctx.drawImage(img, sx, sy, srcCell, srcCell, fx, fy, w, w);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(fx, fy, w, w, 14);
        ctx.stroke();
      }

      // A small translucent card behind the message (not full-screen)
      const cardW = Math.min(width * 0.78, 520);
      const cardH = Math.min(height * 0.20, 150);
      const cardX = (width - cardW) / 2;
      const cardY = height / 2 - cardH / 2 - 8;
      ctx.save();
      ctx.fillStyle = 'rgba(15,23,42,0.35)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 22);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.font = `900 ${Math.min(54, width * 0.06)}px ui-sans-serif, system-ui, -apple-system`;
      ctx.fillText(`完成第 ${levelId} 关！`, width / 2, cardY + cardH * 0.44);
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.min(24, width * 0.03)}px ui-sans-serif, system-ui, -apple-system`;
      ctx.fillText(`用了 ${movesRef.current} 步`, width / 2, cardY + cardH * 0.70);
      ctx.font = `700 ${Math.min(18, width * 0.022)}px ui-sans-serif, system-ui, -apple-system`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText('轻触屏幕进入下一关', width / 2, cardY + cardH * 0.90);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, levelId, completed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  }, [width, height]);

  useEffect(() => {
    if (isPlaying) requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animate]);

  // preload a few upcoming images
  useEffect(() => {
    ensureImageLoaded(levelId);
    for (let i = 1; i <= 3; i++) ensureImageLoaded(clamp(levelId + i, 1, TOTAL_LEVELS));
  }, [levelId, ensureImageLoaded]);

  const goNext = useCallback(() => {
    const next = clamp(levelId + 1, 1, TOTAL_LEVELS);
    if (!isUnlocked(next)) return;
    // 先更新状态和存储，确保同步
    setLevelId(next);
    // 使用setTimeout确保状态更新后再初始化游戏
    setTimeout(() => {
      saveProgress({ completed: loadProgress().completed, currentLevel: next });
      initGame(next);
    }, 0);
  }, [levelId, initGame, isUnlocked]);

  const selectLevel = useCallback((id: number) => {
    if (!isUnlocked(id)) return;
    setShowLevelSelect(false);
    setLevelId(id);
    // 确保关卡选择后立即同步
    setTimeout(() => {
      saveProgress({ completed: loadProgress().completed, currentLevel: id });
      initGame(id);
    }, 0);
  }, [initGame, isUnlocked]);

  const progressText = `${completedLevels.length}/${TOTAL_LEVELS}`;

  return (
    <div className="relative w-full h-full select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="block touch-none cursor-pointer"
      />

      {/* HUD (mobile: only show level select to avoid overlap) */}
      <div className="absolute top-16 md:top-20 right-12 md:right-28 z-10 pointer-events-auto flex items-center gap-2">
        {!isMobile && (
          <div className="px-3 py-1.5 rounded-full bg-black/35 text-white text-xs md:text-sm font-semibold backdrop-blur">
            已通关: {progressText}
          </div>
        )}
        <button
          onClick={() => setShowLevelSelect((v) => !v)}
          className="px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-slate-800 text-xs md:text-sm font-black shadow"
        >
          选关
        </button>
      </div>

      {/* Level Select Panel */}
      {showLevelSelect && (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="text-lg md:text-xl font-black text-slate-800">图片华容道 - 关卡选择</div>
                <div className="text-xs md:text-sm text-slate-500">
                  前 {FREE_SWITCH_LEVELS} 关可自由切换；后续需通关前一关解锁
                </div>
              </div>
              <button
                onClick={() => setShowLevelSelect(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                关闭
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {levels.map((lv) => {
                  const done = completedLevels.includes(lv.id);
                  const unlocked = isUnlocked(lv.id);
                  const active = lv.id === levelId;
                  return (
                    <button
                      key={lv.id}
                      onClick={() => selectLevel(lv.id)}
                      disabled={!unlocked}
                      className={[
                        'h-10 rounded-xl font-extrabold text-sm shadow-sm transition',
                        active ? 'bg-brand-blue text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700',
                        unlocked ? 'hover:scale-[1.02] hover:shadow' : 'opacity-40 cursor-not-allowed',
                      ].join(' ')}
                      title={unlocked ? (done ? '已通关' : '未通关') : '未解锁'}
                    >
                      {lv.id}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 text-xs text-slate-500">
                已通关 {completedLevels.length} 关；当前已解锁到第 {maxUnlocked} 关
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

