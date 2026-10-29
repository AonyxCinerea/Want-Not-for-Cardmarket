"""Renders the extension icons (icons/icon-{16,32,48,128}.png). Requires Pillow."""
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
S = 1024

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# card
cx0, cy0, cx1, cy1 = 150, 60, 690, 860
d.rounded_rectangle((cx0, cy0, cx1, cy1), radius=70, fill=(31, 42, 68, 255))
d.rounded_rectangle((cx0 + 55, cy0 + 70, cx1 - 55, cy0 + 390), radius=28, fill=(92, 132, 190, 255))
for i, w in enumerate((0.75, 0.6, 0.7)):
    y = cy0 + 460 + i * 95
    d.rounded_rectangle((cx0 + 60, y, cx0 + 60 + (cx1 - cx0 - 120) * w, y + 42), radius=21, fill=(214, 222, 236, 255))

# "not" badge
bx, by, r = 730, 760, 235
red = (214, 69, 69, 255)
d.ellipse((bx - r, by - r, bx + r, by + r), fill=(255, 255, 255, 255))
r2 = r - 28
d.ellipse((bx - r2, by - r2, bx + r2, by + r2), fill=red)
r3 = r2 - 62
d.ellipse((bx - r3, by - r3, bx + r3, by + r3), fill=(255, 255, 255, 255))
dx = dy = math.cos(math.radians(45)) * r3
d.line((bx - dx, by - dy, bx + dx, by + dy), fill=red, width=62)

OUT.mkdir(exist_ok=True)
for s in (16, 32, 48, 128):
    img.resize((s, s), Image.LANCZOS).save(OUT / f"icon-{s}.png", optimize=True)
print("icons written to", OUT)
