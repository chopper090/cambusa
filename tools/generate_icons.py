"""Genera le icone PNG per il PWA a partire da un design embedded.
Esegui: python tools/generate_icons.py
Output: icons/icon-{192,512}.png + icons/icon-maskable-512.png + icons/apple-touch-icon.png
"""
from PIL import Image, ImageDraw, ImageFont
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(OUT, exist_ok=True)

def find_font(size):
    candidates = [
        'C:/Windows/Fonts/segoeuib.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
        '/System/Library/Fonts/HelveticaNeue.ttc',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]
    for p in candidates:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

def make_icon(size, maskable=False):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    d = ImageDraw.Draw(img)

    # safe zone per maskable: lasciamo padding ~10%
    if maskable:
        # fondo pieno fino ai bordi
        bg_pad = 0
        corner = 0
        content_inset = int(size*0.18)
    else:
        # fondo arrotondato con margine 0
        bg_pad = 0
        corner = int(size*0.19)
        content_inset = int(size*0.10)

    # rounded rect bg gradient (simulato con fill solido nero)
    if corner > 0:
        d.rounded_rectangle([bg_pad,bg_pad,size-bg_pad,size-bg_pad], radius=corner, fill=(25,25,24,255))
    else:
        d.rectangle([0,0,size,size], fill=(25,25,24,255))

    # chef hat - drawn as simple shapes
    cx = size//2
    hat_top_y = int(size*0.30)
    hat_w = int(size*0.50)
    hat_h = int(size*0.18)
    # tre "puff" del cappello
    r = hat_h
    d.ellipse([cx-hat_w//2, hat_top_y-r//2, cx-hat_w//2 + 2*r, hat_top_y + r + r//2], fill=(255,255,255,255))
    d.ellipse([cx-r, hat_top_y-r, cx+r, hat_top_y+r], fill=(255,255,255,255))
    d.ellipse([cx+hat_w//2 - 2*r, hat_top_y-r//2, cx+hat_w//2, hat_top_y + r + r//2], fill=(255,255,255,255))
    # base
    base_y = hat_top_y + hat_h
    base_h = int(size*0.06)
    d.rounded_rectangle([cx-hat_w//2, base_y, cx+hat_w//2, base_y+base_h], radius=int(size*0.01), fill=(255,255,255,255))

    # monogram "RM"
    f_big = find_font(int(size*0.20))
    txt = 'RM'
    bbox = d.textbbox((0,0), txt, font=f_big)
    tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
    d.text((cx-tw//2, int(size*0.55)), txt, font=f_big, fill=(255,255,255,255))

    # subtitle (only for big icons)
    if size >= 192 and not maskable:
        f_sub = find_font(int(size*0.045))
        sub = 'RESTAURANT'
        bbox = d.textbbox((0,0), sub, font=f_sub)
        sw = bbox[2]-bbox[0]
        d.text((cx-sw//2, int(size*0.82)), sub, font=f_sub, fill=(139,139,133,255))

    return img

def save(img, name):
    p = os.path.join(OUT, name)
    img.save(p, 'PNG', optimize=True)
    print(f"  {name}  {os.path.getsize(p)//1024} KB")

print("Genero icone in", OUT)
save(make_icon(192), 'icon-192.png')
save(make_icon(512), 'icon-512.png')
save(make_icon(512, maskable=True), 'icon-maskable-512.png')
save(make_icon(180), 'apple-touch-icon.png')
save(make_icon(32), 'favicon-32.png')
print("Done.")
