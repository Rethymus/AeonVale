#!/usr/bin/env python3
"""Compose full project logo + favicon from the AI emblem (no AI text — real fonts only).
Inputs:  /tmp/logo-emblem-raw.png (AI emblem, transparent bg)
Outputs: assets/logo/logo-emblem.png (512 sq, trimmed)
         assets/logo/logo-full.png   (lockup: emblem + 永恒山谷 / 大道之歌 / AEON VALE)
         assets/logo/favicon-64.png, favicon-32.png
Palette: ink #1A1028 + spirit-gold #E8D5A3 (transparent bg; gold text reads on dark/void).
"""
from PIL import Image, ImageDraw, ImageFont
import os

INK = (26, 16, 40, 255)          # #1A1028
GOLD = (232, 213, 163, 255)      # #E8D5A3
GOLD_DIM = (210, 188, 130, 220)
SERIF_CJK = "/usr/share/fonts/adobe-source-han-serif/SourceHanSerifCN-Bold.otf"
SERIF_LAT = "/usr/share/fonts/gnu-free/FreeSerifBold.otf"
os.makedirs("assets/logo", exist_ok=True)

# 1) emblem: trim to content, square pad, 512
em = Image.open("/tmp/logo-emblem-raw.png").convert("RGBA")
bb = em.getbbox()
em = em.crop(bb)
s = max(em.size)
sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
sq.paste(em, ((s - em.width) // 2, (s - em.height) // 2), em)
emblem = sq.resize((512, 512), Image.LANCZOS)
emblem.save("assets/logo/logo-emblem.png")

# 2) full lockup: emblem + CJK title + subtitle + Latin wordmark
W = 1024
H = 1180
canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
em_sz = 560
emblem_big = emblem.resize((em_sz, em_sz), Image.LANCZOS)
canvas.alpha_composite(emblem_big, ((W - em_sz) // 2, 40))

draw = ImageDraw.Draw(canvas)
f_title = ImageFont.truetype(SERIF_CJK, 124)
f_sub = ImageFont.truetype(SERIF_CJK, 60)
f_lat = ImageFont.truetype(SERIF_LAT, 40)

def center(text, font, fill, y):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((W - w) // 2, y), text, font=font, fill=fill)
    return y + (bbox[3] - bbox[1])

y = 40 + em_sz + 30
y = center("永恒山谷", f_title, GOLD, y)
y = center("大道之歌", f_sub, GOLD_DIM, y + 16)
# letter-spaced latin
lat = "A E O N   V A L E"
bbox = draw.textbbox((0, 0), lat, font=f_lat)
lw = bbox[2] - bbox[0]
draw.text(((W - lw) // 2, y + 24), lat, font=f_lat, fill=GOLD_DIM)
canvas.save("assets/logo/logo-full.png")

# 3) favicons from emblem (opaque-on-transparent; also a dark-matted version for visibility)
for sz in (64, 32):
    favicon = emblem.resize((sz, sz), Image.LANCZOS)
    favicon.save(f"assets/logo/favicon-{sz}.png")

print("wrote: logo-emblem.png, logo-full.png, favicon-64.png, favicon-32.png")
