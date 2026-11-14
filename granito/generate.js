#!/usr/bin/env node
// Chapa de Granito — transforma o gráfico de contribuições do GitHub numa chapa
// de granito: uma politriz passa pela pedra bruta e os dias com commit ficam
// polidos, cada nível com um granito diferente.
//
// Uso:
//   GITHUB_TOKEN=xxx node generate.js --user seu-usuario [--out dist/granito.svg] [--title ARTIZGRAN]
//   node generate.js --demo            (dados aleatórios, sem token)

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const USER = opt('user', process.env.GITHUB_USER || process.env.GITHUB_REPOSITORY_OWNER);
const OUT = opt('out', 'dist/granito.svg');
const TITLE = opt('title', "Arti'zGran");
const SUBTITLE = opt('subtitle', 'Mármores e Granitos');
const LOGO = opt('logo', path.join(__dirname, 'logo-ag.png'));
const DEMO = args.includes('--demo');
const TOKEN = process.env.GITHUB_TOKEN;

// ---------- pedras ----------
// nível 0 = pedra bruta; 1..4 = granitos polidos, do mais claro ao mais escuro
const STONES = [
  { id: 'bruto', name: 'Bruto', base: '#857b6e', dots: ['#6c6357', '#9d9385', '#5a5248', '#a9a091'], density: 170, rMin: 0.3, rMax: 1.0 },
  { id: 'itaunas', name: 'Branco Itaúnas', base: '#e8e0d0', dots: ['#b5a790', '#8c8273', '#d6cab3', '#6a6357', '#c8a676'], density: 95, rMin: 0.4, rMax: 1.8 },
  { id: 'andorinha', name: 'Cinza Andorinha', base: '#a6a6a2', dots: ['#2b2b2b', '#dcdcd6', '#686865', '#f4f4f0', '#3f3f3d'], density: 120, rMin: 0.3, rMax: 1.4 },
  { id: 'ubatuba', name: 'Verde Ubatuba', base: '#1d2920', dots: ['#3b5741', '#0b110d', '#8a7845', '#52705a', '#c4a35c'], density: 120, rMin: 0.4, rMax: 1.7 },
  { id: 'saogabriel', name: 'Preto São Gabriel', base: '#141414', dots: ['#292929', '#383836', '#070707', '#55554f', '#909088'], density: 85, rMin: 0.3, rMax: 1.3 },
];
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

// gerador pseudo-aleatório com semente (textura igual a cada execução)
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => +n.toFixed(2);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- dados ----------
async function fetchCalendar(user, token) {
  const query = `query($login:String!){user(login:$login){
    contributionsCollection{totalCommitContributions totalPullRequestContributions totalIssueContributions restrictedContributionsCount
      contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel weekday}}}}
    repositories(ownerAffiliations:OWNER, isFork:false, first:100){totalCount
      nodes{stargazerCount languages(first:10, orderBy:{field:SIZE, direction:DESC}){edges{size node{name color}}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'chapa-de-granito' },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  const json = await res.json();
  if (json.errors || !json.data?.user) throw new Error('Erro na API do GitHub: ' + JSON.stringify(json.errors || json));
  const u = json.data.user;
  const cc = u.contributionsCollection;
  const cal = cc.contributionCalendar;
  const langs = {};
  u.repositories.nodes.forEach((r) => r.languages.edges.forEach((e) => {
    langs[e.node.name] = langs[e.node.name] || { size: 0, color: e.node.color || '#857C70' };
    langs[e.node.name].size += e.size;
  }));
  return {
    total: cal.totalContributions,
    stats: {
      commits: cc.totalCommitContributions,
      prs: cc.totalPullRequestContributions,
      issues: cc.totalIssueContributions,
      privateCount: cc.restrictedContributionsCount,
      repos: u.repositories.totalCount,
      stars: u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
      langs: Object.entries(langs).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.size - a.size),
    },
    weeks: cal.weeks.map((w) => w.contributionDays.map((d) => ({ weekday: d.weekday, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0 }))),
  };
}

function demoCalendar() {
  const r = rng(42);
  let total = 0;
  const weeks = [];
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      if (w === 52 && d > 3) break;
      const busy = Math.sin(w / 6) * 0.3 + 0.45;
      const level = r() > busy ? 0 : 1 + Math.floor(r() * r() * 4);
      const count = level ? level * 3 + Math.floor(r() * 3) : 0;
      total += count;
      days.push({ weekday: d, count, level });
    }
    weeks.push(days);
  }
  const stats = {
    commits: 980, prs: 42, issues: 17, privateCount: 120, repos: 14, stars: 9,
    langs: [['TypeScript', 52, '#3178c6'], ['JavaScript', 21, '#f1e05a'], ['Rust', 12, '#dea584'], ['CSS', 9, '#663399'], ['HTML', 6, '#e34c26']].map(([name, size, color]) => ({ name, size, color })),
  };
  return { total, weeks, stats };
}

// ---------- SVG ----------
function stonePattern(s, seed) {
  const r = rng(seed);
  const tile = 72;
  let dots = '';
  for (let i = 0; i < s.density; i++) {
    const x = r() * tile, y = r() * tile;
    const rad = s.rMin + r() * r() * (s.rMax - s.rMin) * 2;
    const c = s.dots[Math.floor(r() * s.dots.length)];
    const o = 0.55 + r() * 0.45;
    if (r() < 0.35) {
      // grão irregular (cristal)
      const pts = [];
      const n = 4 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r() * 0.6;
        const rr = rad * (0.7 + r() * 0.8);
        pts.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`);
      }
      dots += `<polygon points="${pts.join(' ')}" fill="${c}" opacity="${f(o)}"/>`;
    } else {
      dots += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="${c}" opacity="${f(o)}"/>`;
    }
  }
  return `<pattern id="p-${s.id}" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse"><rect width="${tile}" height="${tile}" fill="${s.base}"/>${dots}</pattern>`;
}

function render({ total, weeks }, user) {
  const CELL = 13, GAP = 3, PITCH = CELL + GAP;
  const PAD = 22, TOP = 60, BOTTOM = 40;
  const nW = weeks.length;
  const gridW = nW * PITCH - GAP, gridH = 7 * PITCH - GAP;
  const W = PAD * 2 + gridW, H = TOP + gridH + BOTTOM;
  const gx = PAD, gy = TOP;

  // linha do tempo (segundos)
  const T = 16, ENTER = 0.5, POLISH = 11, SHINE_START = 12, SHINE_END = 13.4, HOLD_END = 14.6, FADE_END = 15.4;
  const pct = (s) => f((s / T) * 100);
  const colDur = POLISH / nW;
  const cellTime = (k, wd) => {
    const frac = k % 2 === 0 ? wd / 6 : (6 - wd) / 6; // vai e volta (serpentina)
    return ENTER + k * colDur + frac * colDur * 0.85;
  };

  let rough = '', polished = '', clip = '', css = '';
  weeks.forEach((days, k) => {
    days.forEach((d) => {
      const x = gx + k * PITCH, y = gy + d.weekday * PITCH;
      rough += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"/>`;
      if (!d.level) return;
      const id = `c${k}_${d.weekday}`;
      const p = pct(cellTime(k, d.weekday));
      css += `@keyframes ${id}{0%,${p}%{opacity:0}${f(p + 0.8)}%,${pct(HOLD_END)}%{opacity:1}${pct(FADE_END)}%,100%{opacity:0}}.${id}{animation:${id} ${T}s linear infinite}`;
      polished += `<g class="${id}"><rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="url(#p-${STONES[d.level].id})"/><rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="url(#gloss)"/><title>${d.count} contribuições</title></g>`;
      clip += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"/>`;
    });
  });

  // trajeto da politriz
  const cx = (k) => gx + k * PITCH + CELL / 2;
  const cy = (wd) => gy + wd * PITCH + CELL / 2;
  const frames = [`0%{transform:translate(${f(cx(0) - 40)}px,${f(cy(0))}px)}`];
  for (let k = 0; k < nW; k++) {
    const down = k % 2 === 0;
    const t0 = ENTER + k * colDur;
    frames.push(`${pct(t0)}%{transform:translate(${f(cx(k))}px,${f(cy(down ? 0 : 6))}px)}`);
    frames.push(`${pct(t0 + colDur * 0.85)}%{transform:translate(${f(cx(k))}px,${f(cy(down ? 6 : 0))}px)}`);
  }
  const lastY = cy(nW % 2 === 1 ? 6 : 0);
  frames.push(`${pct(ENTER + POLISH + 0.5)}%,100%{transform:translate(${f(cx(nW - 1) + 50)}px,${f(lastY)}px)}`);
  css += `@keyframes path{${frames.join('')}}.disc{animation:path ${T}s linear infinite}`;
  css += `@keyframes discfade{0%{opacity:0}${pct(ENTER * 0.8)}%,${pct(ENTER + POLISH)}%{opacity:1}${pct(ENTER + POLISH + 0.4)}%,100%{opacity:0}}.discwrap{animation:discfade ${T}s linear infinite}`;
  css += `@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .35s linear infinite}`;
  css += `@keyframes shine{0%,${pct(SHINE_START)}%{transform:translateX(${-160}px)}${pct(SHINE_END)}%,100%{transform:translateX(${W + 60}px)}}.shine{animation:shine ${T}s ease-in-out infinite}`;

  // legenda
  let legend = '';
  const ly = gy + gridH + 20;
  let lx = gx;
  STONES.forEach((s) => {
    legend += `<rect x="${lx}" y="${ly}" width="11" height="11" rx="2" fill="url(#p-${s.id})" stroke="#00000055" stroke-width=".5"/>`;
    if (s.id !== 'bruto') legend += `<rect x="${lx}" y="${ly}" width="11" height="11" rx="2" fill="url(#gloss)"/>`;
    legend += `<text x="${lx + 16}" y="${ly + 9.5}" class="lg">${esc(s.name)}</text>`;
    lx += 16 + s.name.length * 6.1 + 16;
  });

  // logo embutido (imagens externas não carregam em SVG no GitHub)
  let logo = null, logoRatio = 1;
  if (LOGO && fs.existsSync(LOGO)) {
    const buf = fs.readFileSync(LOGO);
    logo = 'data:image/png;base64,' + buf.toString('base64');
    logoRatio = buf.readUInt32BE(16) / buf.readUInt32BE(20); // largura/altura do PNG
  }
  const stats = `${total.toLocaleString('pt-BR')} contribuições no último ano`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chapa de granito: ${esc(stats)}">
<title>Chapa de granito — ${esc(stats)}</title>
<defs>
${STONES.map((s, i) => stonePattern(s, 1000 + i * 77)).join('\n')}
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".45" stop-color="#fff" stop-opacity=".04"/>
  <stop offset=".75" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/>
</linearGradient>
<linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".08" stop-color="#fff" stop-opacity="0"/>
  <stop offset=".92" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/>
</linearGradient>
<linearGradient id="shineg" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<radialGradient id="metal" cx=".35" cy=".3" r=".8">
  <stop offset="0" stop-color="#f2f2f2"/><stop offset=".55" stop-color="#9aa0a6"/><stop offset="1" stop-color="#4b5056"/>
</radialGradient>
<radialGradient id="water" cx=".5" cy=".5" r=".5">
  <stop offset=".55" stop-color="#cfe9ff" stop-opacity=".45"/><stop offset="1" stop-color="#cfe9ff" stop-opacity="0"/>
</radialGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/>
  <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 -.2"/>
</filter>
<filter id="shadow" x="-5%" y="-10%" width="110%" height="130%">
  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".35"/>
</filter>
<clipPath id="polishedClip">${clip}</clipPath>
</defs>
<style>
.ttl{font:700 21px Georgia,'Times New Roman',serif;letter-spacing:1px}
.tsub{font:400 10px 'Segoe UI',-apple-system,Helvetica,Arial,sans-serif;letter-spacing:2.5px}
.sub{font:600 11px 'Segoe UI',-apple-system,Helvetica,Arial,sans-serif;letter-spacing:.5px}
.lg{font:500 10px 'Segoe UI',-apple-system,Helvetica,Arial,sans-serif;fill:#2e2a24}
${css}
</style>
<!-- chapa -->
<g filter="url(#shadow)">
  <rect x="1" y="1" width="${W - 2}" height="${H - 6}" rx="6" fill="url(#p-bruto)"/>
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 6}" rx="6" filter="url(#grain)" opacity=".5"/>
<rect x="1" y="1" width="${W - 2}" height="${H - 6}" rx="6" fill="url(#edge)" stroke="#00000040"/>
<!-- logo + título gravado -->
${logo ? `<image href="${logo}" x="${gx - 2}" y="11" width="${f(36 * logoRatio)}" height="36"/>` : ''}
<g transform="translate(${logo ? f(gx - 2 + 36 * logoRatio + 10) : gx} 0)">
  <text x="0" y="30" class="ttl" fill="#c9bfae" opacity=".5" transform="translate(0 1)">${esc(TITLE)}</text>
  <text x="0" y="30" class="ttl" fill="#3f332e">${esc(TITLE)}</text>
  <text x="1" y="44" class="tsub" fill="#3f332e" opacity=".8">${esc(SUBTITLE)}</text>
</g>
<text x="${W - PAD}" y="${gy - 15}" class="sub" fill="#3a352d" text-anchor="end">${user ? '@' + esc(user) + ' · ' : ''}${esc(stats)}</text>
<!-- rejunte + pedra bruta -->
<rect x="${gx - 4}" y="${gy - 4}" width="${gridW + 8}" height="${gridH + 8}" rx="4" fill="#3a342c"/>
<g fill="url(#p-bruto)">${rough}</g>
<g filter="url(#grain)" opacity=".35">${rough}</g>
<!-- granito polido -->
${polished}
<g clip-path="url(#polishedClip)"><g class="shine"><rect x="0" y="0" width="90" height="${H}" fill="url(#shineg)" transform="skewX(-22)"/></g></g>
<!-- politriz -->
<g class="discwrap"><g class="disc">
  <circle r="17" fill="url(#water)"/>
  <circle r="11" fill="url(#metal)" stroke="#2b2f33" stroke-width="1"/>
  <g class="spin">
    ${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="-1.4" y="-10" width="2.8" height="5" rx="1" fill="#3b3f44" transform="rotate(${a})"/>`).join('')}
    <circle r="3.2" fill="#d9dde1" stroke="#2b2f33" stroke-width=".8"/>
  </g>
</g></g>
<!-- legenda -->
${legend}
</svg>
`;
}

// ---------- card de estatísticas (cores do site Arti'z Gran) ----------
function renderStats({ total, stats }, user) {
  const C = { dark: '#1C1916', cream: '#F2EDE4', gold: '#D1B06B', muted: '#BDB4A6', line: '#3A332B' };
  const W = 889, H = 190;
  const sans = "'Segoe UI',-apple-system,Helvetica,Arial,sans-serif";
  const items = [
    ['Contribuições no ano', total],
    ['Commits', stats.commits + stats.privateCount],
    ['Pull requests', stats.prs],
    ['Repositórios', stats.repos],
  ];
  let nums = '';
  items.forEach(([label, v], i) => {
    const x = 36 + (i % 2) * 190, y = 92 + Math.floor(i / 2) * 62;
    nums += `<text x="${x}" y="${y}" font-family="Georgia,'Times New Roman',serif" font-size="30" fill="${C.cream}">${Number(v).toLocaleString('pt-BR')}</text>`;
    nums += `<text x="${x}" y="${y + 20}" font-family="${sans}" font-size="11" letter-spacing="1.5" fill="${C.muted}">${esc(label.toUpperCase())}</text>`;
  });

  // linguagens: barra única + legenda
  const top = stats.langs.slice(0, 6);
  const sum = top.reduce((s, l) => s + l.size, 0) || 1;
  const bx = 470, bw = W - bx - 36, by = 74;
  let bar = '', leg = '', acc = 0;
  top.forEach((l, i) => {
    const w = (l.size / sum) * bw;
    bar += `<rect x="${f(bx + acc)}" y="${by}" width="${f(Math.max(w - 2, 1))}" height="10" fill="${l.color}"/>`;
    acc += w;
    const lx = bx + (i % 2) * (bw / 2), ly = by + 40 + Math.floor(i / 2) * 24;
    leg += `<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${l.color}"/><text x="${lx + 16}" y="${ly}" font-family="${sans}" font-size="13" fill="${C.cream}">${esc(l.name)} <tspan fill="${C.muted}">${((l.size / sum) * 100).toFixed(1).replace('.', ',')}%</tspan></text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estatísticas do GitHub de ${esc(user)}">
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="${C.dark}" stroke="${C.gold}" stroke-opacity=".35"/>
<text x="36" y="40" font-family="${sans}" font-size="12" font-weight="600" letter-spacing="3" fill="${C.gold}">EM NÚMEROS · ÚLTIMO ANO</text>
${nums}
<line x1="${bx - 34}" y1="30" x2="${bx - 34}" y2="${H - 30}" stroke="${C.line}"/>
<text x="${bx}" y="40" font-family="${sans}" font-size="12" font-weight="600" letter-spacing="3" fill="${C.gold}">LINGUAGENS</text>
<clipPath id="barclip"><rect x="${bx}" y="${by}" width="${bw}" height="10" rx="5"/></clipPath>
<g clip-path="url(#barclip)">${bar}</g>
${leg}
</svg>
`;
}

(async () => {
  let cal;
  if (DEMO) cal = demoCalendar();
  else {
    if (!USER || !TOKEN) {
      console.error('Defina --user e a variável GITHUB_TOKEN (ou use --demo).');
      process.exit(1);
    }
    cal = await fetchCalendar(USER, TOKEN);
  }
  const svg = render(cal, DEMO ? 'demo' : USER);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, svg);
  console.log(`✔ ${OUT} gerado (${cal.total} contribuições, ${(svg.length / 1024).toFixed(0)} KB)`);
  const statsOut = path.join(path.dirname(OUT), 'stats.svg');
  fs.writeFileSync(statsOut, renderStats(cal, DEMO ? 'demo' : USER));
  console.log(`✔ ${statsOut} gerado`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
