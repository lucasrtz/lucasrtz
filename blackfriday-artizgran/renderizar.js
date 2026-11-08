// Renderiza video.html quadro a quadro e monta o MP4 com a trilha.
// Uso: node renderizar.js [--page video3d.html] [--whats "(00) 00000-0000"] [--endereco "Rua X, 123 - Cidade"] [--fps 30] [--blur 2] [--hits 1.35,11.25] [--trilha gerar_trilha_upbeat.py] [--out saida.mp4] [--stills] [--continuar]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FPS = +opt('fps', 30);
const DIR = __dirname;
const OUT = path.resolve(opt('out', path.join(DIR, 'saida', 'artizgran-black-friday.mp4')));
const FRAMES = opt('frames', path.join(DIR, 'saida', 'frames'));
const STILLS = args.includes('--stills');
const PAGE = opt('page', 'video.html');
const TIMES = opt('times', '');
const HITS = opt('hits', '');
const SUB = +opt('blur', 1); // >1: renderiza subquadros e mistura (desfoque de movimento)
const http = require('http');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };

(async () => {
  fs.mkdirSync(FRAMES, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const q = new URLSearchParams({ render: '1', whats: opt('whats', ''), endereco: opt('endereco', '') });
  // servidor local (módulos ES e texturas WebGL não funcionam via file://)
  const server = http.createServer((req, res) => {
    const f = path.join(DIR, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(DIR) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/${PAGE}?${q}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.render && (!document.getElementById('gl') || window.ready3d));
  await page.evaluate(() => window.ready3d);
  await page.evaluate(() => window.logoReady);
  await page.waitForTimeout(300);
  const DUR = await page.evaluate(() => window.DUR);

  const times = STILLS ? (TIMES ? TIMES.split(',').map(Number) : [2.6, 5.8, 9.4, 11.6, 13.4, 15.2, 17.0, 20.2, 24.0]) : null;
  const total = STILLS ? times.length : Math.round(DUR * FPS * SUB);
  for (let f = 0; f < total; f++) {
    const t = STILLS ? times[f] : f / (FPS * SUB);
    const file = path.join(FRAMES, `f${String(f).padStart(5, '0')}.jpg`);
    if (!STILLS && args.includes('--continuar') && fs.existsSync(file)) continue;
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: file, type: 'jpeg', quality: 95 });
    if (f % 60 === 0) process.stdout.write(`\rquadro ${f}/${total}`);
  }
  await browser.close();
  server.close();
  console.log('\nquadros prontos');
  if (STILLS) return;

  execFileSync('python3', [path.join(DIR, opt('trilha', 'gerar_trilha.py')), String(DUR), ...(HITS ? [HITS] : [])], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS * SUB), '-i', path.join(FRAMES, 'f%05d.jpg'),
    '-i', path.join(DIR, 'assets', 'trilha.wav'),
    ...(SUB > 1 ? ['-vf', `tmix=frames=${SUB},fps=${FPS}`] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log('vídeo:', OUT);
})();
