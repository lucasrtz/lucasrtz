"""Trilha sonora original (sintetizada) — pad elegante, graves suaves, impactos nas transições.

Uso: python3 gerar_trilha.py [duracao_seg]
Saída: assets/trilha.wav
"""
import os, sys, wave
import numpy as np

SR = 48000
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 25.0
N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "trilha.wav")
rng = np.random.default_rng(7)
t = np.arange(N) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp_fast(x, cutoff, passes=2):
    # aproximação rápida: média móvel repetida
    k = max(1, int(SR / (cutoff * 2.2)))
    ker = np.ones(k) / k
    for _ in range(passes):
        x = np.convolve(x, ker, mode="same")
    return x


def env(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 2
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


L = np.zeros(N); R = np.zeros(N)


def add(sig, start, pan=0.0, gain=1.0):
    s = int(start * SR); e = min(N, s + len(sig)); sig = sig[: e - s] * gain
    L[s:e] += sig * np.sqrt(0.5 * (1 - pan)); R[s:e] += sig * np.sqrt(0.5 * (1 + pan))


# --- Pad: progressão Am9 – Fmaj7 – Cmaj9 – Em7(add11), 2 compassos cada a ~84 bpm
bar = 60 / 84 * 4
chords = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 62, 64], [52, 55, 59, 62, 69]]
pos = 0.0; ci = 0
while pos < DUR:
    length = min(bar * 2 + 0.8, DUR - pos)
    n = int(length * SR); tt = np.arange(n) / SR
    sig = np.zeros(n)
    for m in chords[ci % 4]:
        for det in (-0.07, 0.0, 0.06):
            f = hz(m + det)
            ph = rng.random() * 2 * np.pi
            # onda "suave": soma de poucos harmônicos
            sig += (np.sin(2 * np.pi * f * tt + ph) + 0.35 * np.sin(4 * np.pi * f * tt + ph)
                    + 0.12 * np.sin(6 * np.pi * f * tt + ph))
    sig *= env(n, 1.2, 1.0) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.2 * tt))
    add(sig / 30, pos, pan=-0.2 if ci % 2 else 0.2)
    # baixo
    f = hz(chords[ci % 4][0] - 12)
    b = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * env(n, 0.3, 1.0)
    add(b * 0.11, pos)
    pos += bar * 2; ci += 1

# --- Sinos/plucks cristalinos (arpejo) na seção das pedras e no final
arp = [76, 79, 83, 86, 83, 79, 81, 84]
step = 60 / 84 / 2
for k, start in enumerate(np.arange(10.6, 21.0, step)):
    m = arp[k % len(arp)]
    n = int(2.0 * SR); tt = np.arange(n) / SR
    f = hz(m)
    s = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.01 * tt) * np.exp(-tt * 6)
         + 0.15 * np.sin(2 * np.pi * f * 3.0 * tt) * np.exp(-tt * 9)) * np.exp(-tt * 3.2)
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    add(s * 0.05, start, pan=0.5 * np.sin(k * 1.3))

# --- Impactos (boom grave + brilho) nas viradas de cena
for hit in (0.15, 4.2, 7.4, 10.6, 17.8, 21.0):
    n = int(2.5 * SR); tt = np.arange(n) / SR
    f = 70 * np.exp(-tt * 1.6) + 38
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2)
    add(boom * 0.55, hit)
    noise = lp_fast(rng.standard_normal(n), 3000) * np.exp(-tt * 5)
    add(noise * 0.08, hit, pan=0.3)
    # "whoosh" ascendente antes do impacto
    wl = 0.9; nw = int(wl * SR); tw = np.arange(nw) / SR
    w = rng.standard_normal(nw)
    w = lp_fast(w, 1500) * (tw / wl) ** 3
    if hit - wl > 0:
        add(w * 0.12, hit - wl, pan=-0.3)

# --- Reverb simples por convolução (FFT)
ir_len = int(2.4 * SR); ti = np.arange(ir_len) / SR
irL = rng.standard_normal(ir_len) * np.exp(-ti * 2.6); irR = rng.standard_normal(ir_len) * np.exp(-ti * 2.6)
irL = lp_fast(irL, 5000, 1); irR = lp_fast(irR, 5000, 1)


def conv(x, ir):
    nfft = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]


wetL = conv(L, irL); wetR = conv(R, irR)
wetL /= np.max(np.abs(wetL)) + 1e-9; wetR /= np.max(np.abs(wetR)) + 1e-9
dryp = max(np.max(np.abs(L)), np.max(np.abs(R))) + 1e-9
L2 = L / dryp + 0.35 * wetL; R2 = R / dryp + 0.35 * wetR

# fade in/out e normalização com limitador suave
fade = np.ones(N); fi = int(0.05 * SR); fo = int(2.0 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
L2 *= fade; R2 *= fade
peak = max(np.max(np.abs(L2)), np.max(np.abs(R2)))
L2 = np.tanh(1.4 * L2 / peak) * 0.86; R2 = np.tanh(1.4 * R2 / peak) * 0.86

data = (np.stack([L2, R2], 1) * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print("ok", OUT)
