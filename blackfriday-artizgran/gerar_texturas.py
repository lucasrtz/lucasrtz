"""Gera texturas procedurais de pedras (mármores e quartzitos) em alta resolução.

Uso: python3 gerar_texturas.py
Saída: assets/*.jpg (1400x2480, maior que o quadro para permitir movimento de câmera)
"""
import os
import numpy as np
from PIL import Image, ImageFilter

W, H = 1400, 2480
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(OUT, exist_ok=True)


def value_noise(w, h, cell, rng):
    gw, gh = w // cell + 3, h // cell + 3
    grid = rng.random((gh, gw)).astype(np.float32)
    ys = np.arange(h, dtype=np.float32) / cell
    xs = np.arange(w, dtype=np.float32) / cell
    y0 = ys.astype(int); x0 = xs.astype(int)
    fy = ys - y0; fx = xs - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = grid[y0][:, x0]; b = grid[y0][:, x0 + 1]
    c = grid[y0 + 1][:, x0]; d = grid[y0 + 1][:, x0 + 1]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def fbm(w, h, base, octaves, rng, gain=0.5):
    out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0; cell = base
    for _ in range(octaves):
        out += amp * value_noise(w, h, max(2, int(cell)), rng)
        tot += amp; amp *= gain; cell /= 2.0
    return out / tot


def veins(w, h, rng, angle, freq, warp, sharp, base=420, octaves=7):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = np.deg2rad(angle)
    coord = xx * np.cos(t) + yy * np.sin(t)
    n = fbm(w, h, base, octaves, rng)
    v = np.sin(coord * freq + n * warp)
    return np.clip(1 - np.abs(v), 0, 1) ** sharp


def colorize(mask_list, base_rgb, base_var, rng, grain=0.03):
    h, w = mask_list[0][0].shape
    cloud = fbm(w, h, 600, 6, rng)
    img = np.ones((h, w, 3), np.float32) * np.array(base_rgb, np.float32)
    img += (cloud[..., None] - 0.5) * np.array(base_var, np.float32)
    for mask, rgb, strength in mask_list:
        m = (mask * strength)[..., None]
        img = img * (1 - m) + np.array(rgb, np.float32) * m
    img += (rng.random((h, w, 1)).astype(np.float32) - 0.5) * grain * 255
    return np.clip(img, 0, 255).astype(np.uint8)


def save(arr, name, blur=0.6):
    im = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(blur))
    im.save(os.path.join(OUT, name), quality=93)
    print("ok", name)


def nero(seed=1):
    """Mármore negro com veios brancos e dourados (abertura Black Friday)."""
    rng = np.random.default_rng(seed)
    v1 = veins(W, H, rng, 58, 0.0022, 3.2, 40, base=900, octaves=8)
    v2 = veins(W, H, rng, 52, 0.006, 2.6, 70, base=700, octaves=8)
    v3 = veins(W, H, rng, 64, 0.0016, 3.8, 90, base=1000, octaves=8)
    haze = veins(W, H, rng, 58, 0.0022, 3.2, 4, base=900, octaves=5)
    arr = colorize([(haze, (40, 38, 36), 0.6), (v2, (150, 148, 142), 0.5),
                    (v1, (232, 228, 220), 0.9), (v3, (205, 168, 98), 0.95)],
                   (12, 12, 13), (16, 15, 14), rng, 0.02)
    save(arr, "nero.jpg")


def carrara(seed=2):
    """Mármore branco clássico com veios cinza."""
    rng = np.random.default_rng(seed)
    haze = veins(W, H, rng, 35, 0.0025, 3.0, 3, base=900, octaves=5)
    v1 = veins(W, H, rng, 35, 0.0025, 3.0, 30, base=900, octaves=8)
    v2 = veins(W, H, rng, 28, 0.007, 2.4, 60, base=600, octaves=8)
    arr = colorize([(haze, (200, 201, 204), 0.5), (v2, (160, 162, 168), 0.55),
                    (v1, (105, 108, 116), 0.85)], (240, 239, 236), (14, 14, 16), rng)
    save(arr, "marmore.jpg")


def parana(seed=3):
    """Mármore Paraná: fundo claro acinzentado com veios suaves e nebulosos."""
    rng = np.random.default_rng(seed)
    haze = veins(W, H, rng, 80, 0.004, 2.6, 2.5, base=800, octaves=5)
    v1 = veins(W, H, rng, 80, 0.004, 2.6, 14, base=800, octaves=8)
    v2 = veins(W, H, rng, 95, 0.009, 2.2, 45, base=500, octaves=8)
    arr = colorize([(haze, (196, 198, 194), 0.55), (v2, (150, 153, 150), 0.5),
                    (v1, (118, 122, 120), 0.7)], (226, 225, 219), (22, 22, 18), rng)
    save(arr, "marmore_parana.jpg", blur=1.0)


def taj(seed=4):
    """Quartzito tom creme/areia com veios dourados e caramelo."""
    rng = np.random.default_rng(seed)
    haze = veins(W, H, rng, 62, 0.002, 3.4, 3, base=1000, octaves=5)
    v1 = veins(W, H, rng, 62, 0.002, 3.4, 18, base=1000, octaves=8)
    v2 = veins(W, H, rng, 66, 0.005, 2.8, 50, base=700, octaves=8)
    arr = colorize([(haze, (220, 200, 168), 0.55), (v1, (186, 146, 96), 0.75),
                    (v2, (150, 108, 62), 0.7)], (240, 233, 218), (20, 18, 12), rng)
    save(arr, "quartzito.jpg")


def patagonia(seed=5):
    """Quartzito escuro esverdeado/acinzentado com veios cristalinos (estilo exótico)."""
    rng = np.random.default_rng(seed)
    haze = veins(W, H, rng, -40, 0.003, 3.6, 2.5, base=900, octaves=5)
    v1 = veins(W, H, rng, -40, 0.003, 3.6, 22, base=900, octaves=8)
    v2 = veins(W, H, rng, -35, 0.008, 3.0, 55, base=500, octaves=8)
    arr = colorize([(haze, (70, 82, 80), 0.6), (v2, (170, 176, 170), 0.55),
                    (v1, (236, 236, 228), 0.85)], (38, 46, 46), (26, 30, 28), rng)
    save(arr, "quartzito_exotico.jpg", blur=0.8)


def crystal_mint(seed=6):
    """Quartzito Crystal Mint: verde-menta translúcido com faixas verdes e veios cristalinos brancos."""
    rng = np.random.default_rng(seed)
    band = veins(W, H, rng, 70, 0.0018, 3.2, 1.6, base=1000, octaves=6)
    deep = veins(W, H, rng, 66, 0.0035, 3.0, 8, base=800, octaves=8)
    v1 = veins(W, H, rng, 72, 0.0026, 3.4, 40, base=900, octaves=8)
    v2 = veins(W, H, rng, 62, 0.007, 2.6, 70, base=600, octaves=8)
    spark = np.clip((rng.random((H, W)) - 0.9965) * 300, 0, 1).astype(np.float32)
    arr = colorize([(band, (128, 182, 160), 0.7), (deep, (70, 138, 118), 0.65),
                    (v2, (214, 236, 226), 0.55), (v1, (246, 252, 248), 0.9), (spark, (255, 255, 255), 0.6)],
                   (182, 214, 198), (30, 34, 30), rng)
    save(arr, "crystal_mint.jpg")


def imperador(seed=7):
    """Mármore Marrom Imperador: café/chocolate com rede de veios claros."""
    rng = np.random.default_rng(seed)
    haze = veins(W, H, rng, 50, 0.003, 3.0, 2.5, base=800, octaves=5)
    v1 = veins(W, H, rng, 50, 0.004, 3.4, 26, base=700, octaves=8)
    v2 = veins(W, H, rng, -35, 0.009, 3.0, 50, base=400, octaves=8)
    v3 = veins(W, H, rng, 15, 0.014, 2.6, 80, base=300, octaves=8)
    arr = colorize([(haze, (70, 46, 32), 0.6), (v3, (150, 118, 90), 0.5),
                    (v2, (190, 160, 128), 0.65), (v1, (226, 206, 178), 0.85)],
                   (98, 66, 46), (30, 20, 14), rng, 0.025)
    save(arr, "marmore_imperador.jpg")


def parana_branco(seed=8):
    """Mármore Paraná branco: fundo branco luminoso com veios cinza suaves."""
    rng = np.random.default_rng(seed)
    haze = veins(W, H, rng, 80, 0.004, 2.6, 3, base=800, octaves=5)
    v1 = veins(W, H, rng, 80, 0.004, 2.6, 22, base=800, octaves=8)
    v2 = veins(W, H, rng, 95, 0.009, 2.2, 55, base=500, octaves=8)
    arr = colorize([(haze, (226, 227, 226), 0.5), (v2, (178, 181, 182), 0.45),
                    (v1, (150, 154, 156), 0.6)], (246, 245, 241), (10, 10, 9), rng, 0.02)
    save(arr, "marmore_parana.jpg", blur=0.9)


def sao_gabriel(seed=9):
    """Granito Preto São Gabriel: preto com grãos finos cinza e pontos brilhantes."""
    rng = np.random.default_rng(seed)
    g1 = np.clip((value_noise(W, H, 4, rng) - 0.78) * 6, 0, 1)
    g2 = np.clip((value_noise(W, H, 3, rng) - 0.86) * 9, 0, 1)
    g3 = np.clip((value_noise(W, H, 7, rng) - 0.82) * 5, 0, 1)
    spark = np.clip((rng.random((H, W)) - 0.997) * 300, 0, 1).astype(np.float32)
    arr = colorize([(g3, (66, 66, 68), 0.85), (g1, (110, 110, 112), 0.8),
                    (g2, (170, 170, 172), 0.75), (spark, (235, 235, 238), 0.9)],
                   (30, 30, 33), (14, 14, 14), rng, 0.035)
    save(arr, "granito_sao_gabriel.jpg", blur=0.5)


if __name__ == "__main__":
    nero(); carrara(); parana(); taj(); patagonia()
    crystal_mint(); imperador(); parana_branco(); sao_gabriel()
