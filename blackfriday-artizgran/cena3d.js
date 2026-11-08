// Chapas 3D caindo e girando (three.js). Controlado por window.render3d(t).
import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1080, 1920, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.1, 100);
camera.position.set(0, 0, 6);

const key = new THREE.DirectionalLight(0xfff1d6, 1.4); key.position.set(2.5, 3, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0xd4ae62, 1.2); rim.position.set(-3, -1, -2); scene.add(rim);
// luz que "varre" a superfície polida (reflexo dourado)
const sweep = new THREE.PointLight(0xffe2a8, 0, 6, 1.6); scene.add(sweep);

const loader = new THREE.TextureLoader();
const load = src => new Promise(res => loader.load(src, tx => {
  tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = renderer.capabilities.getMaxAnisotropy(); res(tx);
}));

const H = 1.6, W = H * 1400 / 2480, D = 0.055;
function makeSlab(tx, tint = 0xffffff) {
  const face = new THREE.MeshPhysicalMaterial({ map: tx, color: tint, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.55 });
  const edgeTx = tx.clone(); edgeTx.repeat.set(0.04, 1); edgeTx.needsUpdate = true;
  const edge = new THREE.MeshStandardMaterial({ map: edgeTx, color: new THREE.Color(tint).multiplyScalar(0.8), roughness: 0.45, envMapIntensity: 0.4 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [edge, edge, edge, edge, face, face]);
  m.visible = false; scene.add(m); return m;
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = (x, s = 1.25) => { x = clamp(x) - 1; return x * x * ((s + 1) * x + s) + 1; };

// pose de uma chapa: entra caindo e girando, pousa, flutua, e sai caindo
function pose(m, t, { start, land, exit, rest, dir = 1, turns = 1.25, from = 4.2, ry = 0, rx = 0 }) {
  const out = exit != null ? prog(t, exit, exit + 0.5) : 0;
  if (t < start || out >= 1) { m.visible = false; return; }
  m.visible = true;
  const p = prog(t, start, land);
  const k = 1 - eOut(p);
  const idle = Math.max(0, t - land);
  m.position.set(rest.x + dir * 0.6 * k, rest.y + from * (1 - backOut(p)) + 0.015 * Math.sin(idle * 2.2) - 5 * out * out, rest.z + 1.2 * out);
  m.rotation.set(rx + 0.95 * k - 0.6 * out * out + 0.025 * Math.sin(idle * 1.3),
                 dir * (ry + Math.PI * 2 * turns * k + 2.4 * out * out) + 0.1 * Math.sin(idle * 0.9) * (1 - k),
                 dir * 0.4 * k + dir * 0.3 * out);
}

const slabs = {};
window.ready3d = (async () => {
  const [nero, q, m, pr, ex] = await Promise.all(['assets/nero.jpg', 'assets/crystal_mint.jpg', 'assets/marmore_imperador.jpg',
    'assets/marmore_parana.jpg', 'assets/granito_sao_gabriel.jpg'].map(load));
  slabs.nero = makeSlab(nero, 0x9a9a9a);
  slabs.nero2 = makeSlab(nero, 0x9a9a9a);
  slabs.s = [q, m, pr, ex].map(tx => makeSlab(tx));
  return true;
})();

window.render3d = t => {
  if (!slabs.s) return;
  const big = { x: 0, y: 0, z: 2.25 };
  // abertura: chapa negra cai girando e fica atrás dos textos até 10,3s
  pose(slabs.nero, t, { start: 0.15, land: 1.35, exit: 10.15, rest: big, dir: 1, turns: 1.5, from: 3.2 });
  // pedras: 4 x 1,8s
  const a0 = 10.6, sd = 1.8;
  slabs.s.forEach((s, i) => {
    const a = a0 + i * sd;
    pose(s, t, { start: a - 0.15, land: a + 0.65, exit: a + sd - 0.3, rest: { x: 0, y: 0.28, z: 0.8 }, dir: i % 2 ? -1 : 1, turns: 1.25, ry: 0.28, rx: -0.06 });
  });
  // volta a chapa negra para showroom + CTA
  pose(slabs.nero2, t, { start: 17.5, land: 18.45, rest: big, dir: -1, turns: 1.5, from: 3.2 });
  // reflexo dourado varrendo após cada pouso
  const lands = [1.35, 11.25, 13.05, 14.85, 16.65, 18.45];
  let sw = 0, sx = 0;
  for (const L of lands) { const p = prog(t, L, L + 1.1); if (p > 0 && p < 1) { sw = Math.sin(p * Math.PI) * 2.6; sx = -1.5 + 3 * p; } }
  sweep.intensity = sw; sweep.position.set(sx, sx * 0.6, 3.2);
  renderer.render(scene, camera);
};

// pré-visualização em tempo real ao abrir no navegador
const P = new URLSearchParams(location.search);
if (!P.has('render')) window.ready3d.then(() => {
  const t0 = performance.now();
  (function loop() { window.render(((performance.now() - t0) / 1000) % window.DUR); requestAnimationFrame(loop); })();
});
