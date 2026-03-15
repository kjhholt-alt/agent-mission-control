"""Script 45: Regenerate app icons at all sizes from source."""
import os, sys

try:
    from PIL import Image, ImageDraw, ImageFont
    import math
except ImportError:
    print("  pip install Pillow")
    sys.exit(1)

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "src-tauri", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

size = 1024
img = Image.new("RGBA", (size, size), (10, 10, 15, 255))
draw = ImageDraw.Draw(img)

# Hexagon
center = size // 2
r = 460
points = [(center + r * math.cos(math.pi/6 + i * math.pi/3),
           center + r * math.sin(math.pi/6 + i * math.pi/3)) for i in range(6)]
draw.polygon(points, fill=(15, 15, 25, 255), outline=(6, 182, 212, 180))

# Glow edge
for w in range(8, 0, -1):
    draw.polygon(points, outline=(6, 182, 212, int(30 * w)))

# Letter N
try:
    font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 520)
except Exception:
    font = ImageFont.load_default()

bbox = draw.textbbox((0, 0), "N", font=font)
tx = (size - (bbox[2] - bbox[0])) // 2
ty = (size - (bbox[3] - bbox[1])) // 2 - 30

for offset in range(15, 0, -1):
    draw.text((tx, ty), "N", fill=(6, 182, 212, int(15 * offset)), font=font)
draw.text((tx, ty), "N", fill=(6, 182, 212, 255), font=font)

# Save all sizes
SIZES = {"app-icon.png": 1024, "icon.png": 256, "128x128.png": 128, "32x32.png": 32}
for name, s in SIZES.items():
    img.resize((s, s), Image.Resampling.LANCZOS).save(os.path.join(OUT_DIR, name))

img.resize((256, 256), Image.Resampling.LANCZOS).save(os.path.join(OUT_DIR, "icon.ico"), format="ICO")

print(f"  Generated {len(SIZES) + 1} icons in {OUT_DIR}")
