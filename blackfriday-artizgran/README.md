# ArtizGran · Black Friday (vídeo vertical 1080x1920, 25s)

Vídeo para Reels/Stories/Status: **10% de desconto em até 10x sem juros no cartão**, com chamada para o **WhatsApp** e para o **showroom**.

- Vídeo pronto: `saida/artizgran-black-friday.mp4`
- Texturas de pedra (quartzito, mármore, Mármore Paraná, exóticas, nero) e trilha sonora geradas do zero, sem direitos autorais de terceiros.

## Inserir WhatsApp e endereço do showroom

```bash
node renderizar.js --whats "(00) 00000-0000" --endereco "Rua Exemplo, 123 · Cidade/UF"
```

## Etapas

1. `python3 gerar_texturas.py`: gera as pedras em `assets/`
2. `python3 gerar_trilha.py 25`: gera a trilha `assets/trilha.wav`
3. `node renderizar.js`: renderiza `video.html` quadro a quadro (Playwright) e monta o MP4 (ffmpeg)

Para trocar por fotos reais das chapas, substitua os arquivos em `assets/` mantendo os nomes (proporção vertical, ~1400x2480).
Abra `video.html` no navegador para uma pré-visualização em tempo real.
