"""Trilha original upbeat (deep/tech house elegante, ~133 bpm) sincronizada com o vídeo 3D.

Uso: python3 gerar_trilha_upbeat.py [duracao_seg] [impactos_seg_separados_por_virgula]
Saída: assets/trilha.wav
- O "drop" acontece quando a primeira chapa pousa (1,35s); a batida fica alinhada às quedas das chapas.
- Respiro (break) antes da seção das pedras, com subida, e novo drop na primeira pedra.
"""
import os, sys, wave
import numpy as np

SR = 48000
EFEITOS = '--efeitos' in sys.argv  # só efeitos (sem música), para adicionar a música no app do Instagram
sys.argv = [a for a in sys.argv if a != '--efeitos']
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 25.0
HITS = [float(x) for x in sys.argv[2].split(',')] if len(sys.argv) > 2 else [1.35, 11.25, 13.05, 14.85, 16.65, 18.45]
N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "trilha_efeitos.wav" if EFEITOS else "trilha.wav")
rng = np.random.default_rng(11)

BEAT = 0.45                 # 133,3 bpm: as chapas pousam a cada 4 tempos (1,8s)
T0 = 1.35                   # primeiro tempo forte = pouso da chapa de abertura
DROP1, BREAK, DROP2, END = 1.35, 10.35, 11.25, DUR - 1.2


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, cutoff, passes=2):
    k = max(1, int(SR / (cutoff * 2.2)))
    ker = np.ones(k) / k
    for _ in range(passes):
        x = np.convolve(x, ker, mode="same")
    return x


def hp(x, cutoff):
    return x - lp(x, cutoff, 1)


def tt(sec):
    return np.arange(int(sec * SR)) / SR


L = np.zeros(N); R = np.zeros(N); SC = np.ones(N)  # SC = envelope de sidechain
KL = np.zeros(N); KR = np.zeros(N)  # bumbo e impactos fora do sidechain


def add(sig, start, pan=0.0, gain=1.0, bus=None):
    s = int(round(start * SR))
    if s >= N or s + len(sig) <= 0:
        return
    a = max(0, -s); s = max(0, s); e = min(N, s + len(sig) - a)
    seg = sig[a:a + e - s] * gain
    if bus is not None:
        bus[0][s:e] += seg * np.sqrt(0.5 * (1 - pan)); bus[1][s:e] += seg * np.sqrt(0.5 * (1 + pan))
    else:
        L[s:e] += seg * np.sqrt(0.5 * (1 - pan)); R[s:e] += seg * np.sqrt(0.5 * (1 + pan))


# ---------- sons
def kick():
    t = tt(0.42)
    f = 46 + 110 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 400) * 0.3
    return np.tanh(1.6 * (body + click))


def clap():
    t = tt(0.3); n = hp(rng.standard_normal(len(t)), 900)
    n = lp(n, 6000, 1)
    env = np.zeros(len(t))
    for d in (0.0, 0.011, 0.022):
        env += np.where(t >= d, np.exp(-(t - d) * 90), 0)
    env += np.exp(-t * 14) * 0.5
    return n * env * 0.6


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    n = hp(rng.standard_normal(len(t)), 7000)
    return n * np.exp(-t * (14 if open_ else 80))


def bass_note(m, length):
    t = tt(length); f = hz(m)
    s = sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 6))
    s = lp(s, 600, 1)
    env = np.minimum(1, t / 0.005) * np.exp(-t * 3)
    env[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return np.tanh(1.5 * s * env)


def stab(chord, length=0.32, bright=4000):
    t = tt(length); s = np.zeros(len(t))
    for m in chord:
        for det in (-0.08, 0.08):
            f = hz(m + det)
            s += sum(np.sin(2 * np.pi * f * k * t + rng.random() * 6) / k ** 1.3 for k in range(1, 7))
    s = lp(s, bright, 1)
    return s * np.minimum(1, t / 0.004) * np.exp(-t * 9) / len(chord)


def pluck(m):
    t = tt(0.35); f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 20) + 0.2 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 30)
    return s * np.minimum(1, t / 0.002) * np.exp(-t * 11)


def pad(chord, length):
    t = tt(length); s = np.zeros(len(t))
    for m in chord:
        for det in (-0.1, 0, 0.1):
            f = hz(m + det)
            s += np.sin(2 * np.pi * f * t + rng.random() * 6) + 0.3 * np.sin(4 * np.pi * f * t)
    e = np.minimum(1, t / 0.4) * np.minimum(1, (length - t) / 0.4)
    return s * e / (3 * len(chord))


def impact():
    t = tt(1.8)
    f = 80 * np.exp(-t * 2) + 34
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    sh = lp(hp(rng.standard_normal(len(t)), 2000), 9000, 1) * np.exp(-t * 6) * 0.25
    return boom + sh


def riser(length):
    t = tt(length); p = t / length
    n = rng.standard_normal(len(t))
    lo = lp(n, 900); hi = hp(n, 3000)
    s = (lo * (1 - p) + hi * p) * p ** 2
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1400 * p ** 2) / SR) * p ** 3 * 0.25
    return s * 0.8 + tone


# ---------- harmonia: Am9 – Fmaj9 – C(add9) – G6, 2 compassos cada
CH = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [48, 55, 60, 62, 64], [55, 59, 62, 64, 67]]
ROOT = [45, 41, 48, 43]
BAR = BEAT * 4


def chord_at(t):
    i = int(np.floor((t - T0) / (BAR * 2))) % 4
    return i


K = kick(); C = clap(); HC = hat(); HO = hat(True)

MUSICA = not EFEITOS
# introdução: pad filtrado + subida até o primeiro pouso
if MUSICA: add(lp(pad(CH[0], DROP1 + 0.4), 900), 0, gain=0.5)
add(riser(DROP1), 0, gain=0.35)

beats = np.arange(T0, END + 1e-6, BEAT) if MUSICA else []
for b in beats:
    in_break = BREAK <= b < DROP2
    n = int(round((b - T0) / BEAT))
    ci = chord_at(b)
    if not in_break:
        add(K, b, gain=0.95, bus=(KL, KR))
        s = int(b * SR); e = min(N, s + int(0.3 * SR))
        SC[s:e] = np.minimum(SC[s:e], 0.25 + 0.75 * (np.arange(e - s) / (0.3 * SR)) ** 0.6)
        if n % 2 == 1:
            add(C, b, gain=0.55, pan=0.05)
        # baixo no contratempo (estilo house)
        add(bass_note(ROOT[ci] + (12 if n % 4 == 3 else 0), BEAT * 0.45), b + BEAT / 2, gain=0.42)
        add(HO, b + BEAT / 2, gain=0.12, pan=0.25)
    # chimbal em semicolcheias com dinâmica
    for k in range(4):
        vel = [0.08, 0.04, 0.1, 0.05][k] * (0.5 if in_break else 1)
        add(HC, b + k * BEAT / 4, gain=vel, pan=-0.3)
    # stabs sincopados
    if not in_break and n % 4 in (0, 2):
        off = [0.75, 1.5][(n // 2) % 2] * BEAT
        add(stab(CH[ci]), b + off, gain=0.32, pan=0.2 if n % 8 < 4 else -0.2)

# pad contínuo (com sidechain) a partir do drop
pos = T0 if MUSICA else END
while pos < END:
    ci = chord_at(pos + 0.01); ln = min(BAR * 2, END + 1 - pos)
    add(pad(CH[ci], ln + 0.3), pos, gain=0.28, pan=0.0)
    pos += BAR * 2

# arpejo cristalino na seção das pedras e no final
for k, b in enumerate(np.arange(DROP2, END, BEAT / 2) if MUSICA else []):
    ci = chord_at(b); notes = [m + 12 for m in CH[ci][1:]]
    add(pluck(notes[k % len(notes)]), b, gain=0.07, pan=0.6 * np.sin(k * 0.9))

# break com subida antes das pedras
add(riser(DROP2 - BREAK), BREAK, gain=0.45)

# impactos nos pousos das chapas + final
for h in HITS:
    add(impact(), h, gain=0.55, bus=(KL, KR))
add(impact(), END, gain=0.7, bus=(KL, KR))
if MUSICA: add(pad(CH[0], 2.0), END, gain=0.35)

# aplica sidechain no mix (o bumbo e os impactos ficam de fora)
SC = lp(SC, 200, 1)
L *= 0.6 + 0.4 * SC; R *= 0.6 + 0.4 * SC
L += KL; R += KR

# reverb curto
ir = rng.standard_normal(int(1.2 * SR)) * np.exp(-tt(1.2) * 5)
ir = lp(ir, 6000, 1)


def conv(x):
    nfft = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]


wl, wr = conv(L), conv(R)
pk = max(np.abs(L).max(), np.abs(R).max())
wl *= pk / (np.abs(wl).max() + 1e-9) * 0.18; wr *= pk / (np.abs(wr).max() + 1e-9) * 0.18
L2, R2 = L + wl, R + wr
fade = np.ones(N); fo = int(1.0 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
L2 *= fade; R2 *= fade
pk = max(np.abs(L2).max(), np.abs(R2).max())
L2 = np.tanh(1.8 * L2 / pk) * 0.89; R2 = np.tanh(1.8 * R2 / pk) * 0.89

with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([L2, R2], 1) * 32767).astype(np.int16).tobytes())
print("ok", OUT)
