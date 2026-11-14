#!/usr/bin/env node
// Gera o banner do README no estilo Arti'z Gran: pedra escura com veios dourados.
// Uso: node granito/banner.js [--out assets/banner.svg]
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'assets/banner.svg';

const C = { dark: '#1C1916', deep: '#12100E', cream: '#F2EDE4', gold: '#D1B06B', muted: '#BDB4A6' };
const W = 1200, H = 300;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => +n.toFixed(1);
const r = rng(2026);

// textura da pedra
let grains = '';
for (let i = 0; i < 260; i++) {
  const c = ['#2a2622', '#35302a', '#0b0a09', '#4a433b', '#5d554b'][Math.floor(r() * 5)];
  grains += `<circle cx="${f(r() * 120)}" cy="${f(r() * 120)}" r="${f(0.3 + r() * r() * 2)}" fill="${c}" opacity="${f(0.5 + r() * 0.5)}"/>`;
}

// veios dourados
function vein(y0, amp, width, op) {
  let d = `M -20 ${f(y0)}`;
  let y = y0;
  for (let x = 0; x <= W + 40; x += 120) {
    const ny = y + (r() - 0.5) * amp;
    d += ` S ${f(x + 60)} ${f(ny + (r() - 0.5) * amp)} ${f(x + 120)} ${f(ny)}`;
    y = ny;
  }
  return `<path d="${d}" fill="none" stroke="url(#goldVein)" stroke-width="${width}" stroke-linecap="round" opacity="${op}" filter="url(#rough)"/>`;
}
const veins = [vein(40, 90, 1.2, 0.55), vein(250, 110, 2.4, 0.7), vein(140, 140, 0.8, 0.4), vein(290, 60, 1, 0.45), vein(-10, 70, 1.6, 0.5)].join('\n');

const logoBuf = fs.readFileSync(path.join(__dirname, 'logo-ag.png'));
const logo = 'data:image/png;base64,' + logoBuf.toString('base64');
const ratio = logoBuf.readUInt32BE(16) / logoBuf.readUInt32BE(20);
const LH = 104, LW = f(LH * ratio);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Lucas Artiz · Arti'z Gran">
<defs>
  <pattern id="stone" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" fill="${C.dark}"/>${grains}</pattern>
  <linearGradient id="goldVein" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${C.gold}" stop-opacity=".35"/>
    <stop offset=".5" stop-color="#F3DFA8"><animate attributeName="offset" values="-.2;1.2" dur="7s" repeatCount="indefinite"/></stop>
    <stop offset="1" stop-color="${C.gold}" stop-opacity=".35"/>
  </linearGradient>
  <radialGradient id="glow" cx=".3" cy=".4" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
  <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="14"/></filter>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="url(#stone)"/>
  ${veins}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${C.gold}" stroke-opacity=".35"/>
<image href="${logo}" x="64" y="${(H - LH) / 2}" width="${LW}" height="${LH}"/>
<line x1="${64 + LW + 34}" y1="78" x2="${64 + LW + 34}" y2="222" stroke="${C.gold}" stroke-opacity=".45"/>
<g transform="translate(${64 + LW + 68} 0)" font-family="Georgia,'Times New Roman',serif">
  <text y="104" font-family="'Segoe UI',-apple-system,Helvetica,Arial,sans-serif" font-size="14" font-weight="600" letter-spacing="4" fill="${C.gold}">ARTI'Z GRAN · MÁRMORES · GRANITOS · QUARTZITOS</text>
  <text y="170" font-size="50" fill="${C.cream}">Olá, eu sou o <tspan font-style="italic" fill="${C.gold}">Lucas Artiz</tspan></text>
  <text y="214" font-family="'Segoe UI',-apple-system,Helvetica,Arial,sans-serif" font-size="19" fill="${C.muted}">Pedra sob medida e tecnologia, em São Paulo.</text>
</g>
</svg>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(`✔ ${OUT} (${(svg.length / 1024).toFixed(0)} KB)`);
