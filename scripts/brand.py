#!/usr/bin/env python3
"""ReadingDoppler visual identity generator.

Family-consistent with approach-retreat (same near-black BG, same text
palette, same diagrammatic-mark grammar, same Helvetica wordmark). The
only thing that differs is the glyph — because the behavioral model
differs:

  approach-retreat: AOI + three outcome paths (click / deferred / rejected)
  reading-doppler:  viewport frame + paragraphs colored by the band their
                    center falls in (top / mid / bot) — the Doppler
                    signature emerges as paragraphs shift bands on scroll

Generates:
  - favicon (32x32, 128x128, 512x512) + .ico
  - wordmark logo (1400x280)
  - social header (1200x630 — OG image standard)
  - brand mark alone (transparent PNG, 512x512)

All text verified >=8:1 contrast.

Usage: python3 scripts/brand.py
"""
import os
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).parent.parent / "assets/brand"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# --- Palette ---
# Background + text colors are EXACTLY approach-retreat's — the family shares
# the same editorial substrate. Only the semantic accent triad changes:
# where AR names outcomes (click/deferred/rejected), reading-doppler names
# spatial zones (top/mid/bot). The band accents are chosen for family-
# coherent warmth without colliding semantically with AR's outcome palette.
BG          = (10, 10, 12)
VIEWPORT    = (110, 175, 255)  # blue — the viewport frame (same as AR's AOI_BORDER)
BAND_TOP    = (120, 210, 230)  # cyan — where reading happens (brightest, like the AR CLICK position)
BAND_MID    = (220, 170, 50)   # amber — middle dwell (matches AR's DEFERRED — warm familial tie)
BAND_BOT    = (165, 180, 200)  # slate — bottom, scrolling past (receding, cool); 8.1:1
GUTTER      = (70, 70, 80)     # paragraph bars outside the viewport
THIRD_LINE  = (60, 60, 70)     # subtle dashed third-markers inside the viewport
TEXT        = (228, 228, 216)  # primary — 15.4:1
BRIGHT      = (210, 210, 200)  # tagline — ~13:1
BRIGHT_DIM  = (188, 188, 178)  # attribution — ~10:1
SUBTEXT     = (170, 170, 165)  # UI chrome — 8.5:1


def luminance(rgb):
    r, g, b = [c / 255.0 for c in rgb]
    r = r / 12.92 if r <= 0.03928 else ((r + 0.055) / 1.055) ** 2.4
    g = g / 12.92 if g <= 0.03928 else ((g + 0.055) / 1.055) ** 2.4
    b = b / 12.92 if b <= 0.03928 else ((b + 0.055) / 1.055) ** 2.4
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg, bg):
    l1, l2 = luminance(fg), luminance(bg)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


print("=== Contrast check (target 8:1+) ===")
for name, color in [
    ("VIEWPORT",   VIEWPORT),
    ("BAND_TOP",   BAND_TOP),
    ("BAND_MID",   BAND_MID),
    ("BAND_BOT",   BAND_BOT),
    ("TEXT",       TEXT),
    ("BRIGHT",     BRIGHT),
    ("BRIGHT_DIM", BRIGHT_DIM),
    ("SUBTEXT",    SUBTEXT),
]:
    r = contrast_ratio(color, BG)
    status = "OK " if r >= 8.0 else "FAIL"
    print(f"  [{status}] {name:11s} {r:5.1f}:1")
print()


FONT_PATHS = [
    '/System/Library/Fonts/Helvetica.ttc',
    '/System/Library/Fonts/SFCompact.ttf',
    '/Library/Fonts/Arial Bold.ttf',
]
FONT_PATH = next((f for f in FONT_PATHS if os.path.exists(f)), None)


def font(size, weight='regular'):
    if not FONT_PATH:
        return ImageFont.load_default()
    if FONT_PATH.endswith('.ttc'):
        idx = {'regular': 0, 'bold': 1, 'light': 2}.get(weight, 0)
        return ImageFont.truetype(FONT_PATH, size, index=idx)
    return ImageFont.truetype(FONT_PATH, size)


def _dashed_hline(draw, x0, x1, y, color, dash=4, gap=3, width=1):
    x = x0
    while x < x1:
        draw.line([(x, y), (min(x + dash, x1), y)], fill=color, width=width)
        x += dash + gap


def draw_brand_glyph(draw, cx, cy, scale=1.0, show_third_lines=True, show_gutter=True):
    """Draw the brand glyph.

    Coordinate system: (cx, cy) is the CENTER of the viewport frame.

    Composition (at scale=1):
      - Viewport frame: 140 wide x 100 tall, blue outline, rounded.
      - Inside: 4 paragraph bars stacked, one in each band zone:
          bar 0: TOP band, widest (currently being read)
          bar 1: MID band upper, narrower
          bar 2: MID band lower, narrower (same-paragraph wrapping)
          bar 3: BOT band, medium
        Each colored by the band their center falls in.
      - Two subtle dashed lines at y = cy - h/6 and y = cy + h/6 mark the
        third boundaries (scr_h/3 decomposition, literal).
      - Paragraph bars outside the viewport (above / below) in dim gutter
        gray, signalling the surrounding document that the viewport is
        clipping — the why-decompose-by-band visual argument.
    """
    # === Viewport frame ===
    vp_w = int(140 * scale)
    vp_h = int(100 * scale)
    vp_l = cx - vp_w // 2
    vp_t = cy - vp_h // 2
    vp_r = vp_l + vp_w
    vp_b = vp_t + vp_h
    radius = max(2, int(6 * scale))
    border_w = max(2, int(3 * scale))

    # === Gutter paragraphs (above & below the viewport) ===
    # These communicate "this is a viewport onto a longer document." Skip
    # when the composition is too small for them to read clearly.
    if show_gutter and scale >= 0.6:
        bar_h = max(3, int(5 * scale))
        bar_gap = max(2, int(5 * scale))
        # Above
        pad = max(4, int(8 * scale))
        widths_above = [0.70, 0.55, 0.80]
        y = vp_t - pad - bar_h
        for w_frac in reversed(widths_above):
            if y < 2: break
            w = int(vp_w * w_frac)
            x0 = vp_l + (vp_w - w) // 2
            draw.rectangle([x0, y, x0 + w, y + bar_h], fill=GUTTER)
            y -= (bar_h + bar_gap)
        # Below
        widths_below = [0.75, 0.45, 0.60]
        y = vp_b + pad
        for w_frac in widths_below:
            w = int(vp_w * w_frac)
            x0 = vp_l + (vp_w - w) // 2
            draw.rectangle([x0, y, x0 + w, y + bar_h], fill=GUTTER)
            y += (bar_h + bar_gap)

    # === Third lines (dashed) ===
    if show_third_lines and scale >= 1.0:
        third_y1 = vp_t + vp_h // 3
        third_y2 = vp_t + 2 * vp_h // 3
        inset = max(3, int(6 * scale))
        _dashed_hline(
            draw, vp_l + inset, vp_r - inset, third_y1,
            THIRD_LINE, dash=max(2, int(3 * scale)), gap=max(2, int(3 * scale)),
            width=max(1, int(1 * scale)),
        )
        _dashed_hline(
            draw, vp_l + inset, vp_r - inset, third_y2,
            THIRD_LINE, dash=max(2, int(3 * scale)), gap=max(2, int(3 * scale)),
            width=max(1, int(1 * scale)),
        )

    # === Paragraph bars inside the viewport ===
    # Vertical centers chosen so each bar lives cleanly in its intended band.
    # (Viewport thirds split at vp_h/3 and 2*vp_h/3.)
    bar_h_in = max(4, int(7 * scale))
    pad_x = max(5, int(10 * scale))
    inner_w = vp_w - 2 * pad_x

    # Centers as fractions of viewport height: top / mid-upper / mid-lower / bot.
    bar_specs = [
        # (center_frac, width_frac, color)
        (0.18, 0.90, BAND_TOP),  # top band, widest — "being read"
        (0.44, 0.70, BAND_MID),  # mid upper
        (0.58, 0.55, BAND_MID),  # mid lower (same-paragraph wrapping)
        (0.82, 0.75, BAND_BOT),  # bot band
    ]
    for cf, wf, color in bar_specs:
        by = vp_t + int(vp_h * cf) - bar_h_in // 2
        bw = int(inner_w * wf)
        bx = vp_l + pad_x + (inner_w - bw) // 2
        # Rounded-ish endpoints on larger scales
        if scale >= 1.5:
            r = max(1, bar_h_in // 2)
            try:
                draw.rounded_rectangle(
                    [bx, by, bx + bw, by + bar_h_in], radius=r, fill=color
                )
            except AttributeError:
                draw.rectangle([bx, by, bx + bw, by + bar_h_in], fill=color)
        else:
            draw.rectangle([bx, by, bx + bw, by + bar_h_in], fill=color)

    # === Viewport frame on top (so it overlaps gutter bars cleanly) ===
    try:
        draw.rounded_rectangle(
            [vp_l, vp_t, vp_r, vp_b], radius=radius, outline=VIEWPORT, width=border_w
        )
    except AttributeError:
        draw.rectangle([vp_l, vp_t, vp_r, vp_b], outline=VIEWPORT, width=border_w)

    # Return the full footprint (gutter-inclusive if gutter visible).
    left = vp_l - int(2 * scale)
    right = vp_r + int(2 * scale)
    if show_gutter and scale >= 0.6:
        top = vp_t - int(40 * scale)
        bottom = vp_b + int(40 * scale)
    else:
        top = vp_t - int(2 * scale)
        bottom = vp_b + int(2 * scale)
    return (left, top, right, bottom)


# === 1. Brand mark alone (512x512 transparent) ===
print("=== Brand mark (512x512 transparent) ===")
mark = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(mark)
draw_brand_glyph(draw, 256, 256, scale=2.6, show_third_lines=True, show_gutter=True)
mark.save(OUT_DIR / "brand-mark.png")
print("  -> brand-mark.png")


# === 2. Favicons (32, 128, 512) ===
print("=== Favicons (32, 128, 512) ===")
for size in [32, 128, 512]:
    fav = Image.new('RGB', (size, size), BG)
    draw = ImageDraw.Draw(fav)
    scale = size / 180
    # At 32px the gutter bars become illegible — drop them. Third lines
    # also too fine at small sizes.
    show_gutter = size >= 128
    show_thirds = size >= 128
    draw_brand_glyph(
        draw, size // 2, size // 2,
        scale=scale, show_third_lines=show_thirds, show_gutter=show_gutter,
    )
    fav.save(OUT_DIR / f"favicon-{size}.png")
    print(f"  -> favicon-{size}.png")

fav32 = Image.open(OUT_DIR / "favicon-32.png")
fav32.save(OUT_DIR / "favicon.ico", format='ICO', sizes=[(32, 32)])
print("  -> favicon.ico")


# === 3. Wordmark logo (1400x280) ===
print("=== Wordmark (1400x280) ===")
W, H = 1400, 280
wordmark = Image.new('RGB', (W, H), BG)
draw = ImageDraw.Draw(wordmark)

glyph_cx = 220
glyph_cy = H // 2
draw_brand_glyph(draw, glyph_cx, glyph_cy, scale=1.6, show_third_lines=True, show_gutter=True)

title_font = font(80, 'bold')
subtitle_font = font(28, 'regular')

title = "reading doppler"
tagline = "paragraph dwell, decomposed by viewport band"

title_x = 480
title_y = 82
draw.text((title_x, title_y), title, fill=TEXT, font=title_font)
bbox = draw.textbbox((title_x, title_y), title, font=title_font)
tagline_y = bbox[3] + 16
draw.text((title_x + 4, tagline_y), tagline, fill=SUBTEXT, font=subtitle_font)

wordmark.save(OUT_DIR / "wordmark.png")
print("  -> wordmark.png")


# === 4. Social header (1200x630 OG) ===
print("=== Social header (1200x630) ===")
W, H = 1200, 630
social = Image.new('RGB', (W, H), BG)
draw = ImageDraw.Draw(social)

GLYPH_SCALE = 1.9
GLYPH_CX = W // 2
GLYPH_CY = 200
draw_brand_glyph(
    draw, GLYPH_CX, GLYPH_CY, scale=GLYPH_SCALE,
    show_third_lines=True, show_gutter=True,
)

# Tiny band-legend row under the glyph — names the three bands so the
# OG reader doesn't have to infer the semantics from color alone.
legend_y = 370
legend_font = font(24, 'regular')
swatch_size = 14
item_gap = 28

def _legend_item(draw, x, y, swatch_color, label):
    draw.rectangle([x, y + 5, x + swatch_size, y + 5 + swatch_size], fill=swatch_color)
    draw.text((x + swatch_size + 8, y), label, fill=BRIGHT, font=legend_font)
    bbox = draw.textbbox((x + swatch_size + 8, y), label, font=legend_font)
    return bbox[2]

items = [(BAND_TOP, "top  rd_top_ms"), (BAND_MID, "mid  rd_mid_ms"), (BAND_BOT, "bot  rd_bot_ms")]
total_w = 0
for _, lbl in items:
    bbox = draw.textbbox((0, 0), lbl, font=legend_font)
    total_w += swatch_size + 8 + (bbox[2] - bbox[0]) + item_gap
total_w -= item_gap

x = (W - total_w) // 2
for color, lbl in items:
    end_x = _legend_item(draw, x, legend_y, color, lbl)
    x = end_x + item_gap

# Divider
DIVIDER_Y = 425
draw.line([(200, DIVIDER_Y), (W - 200, DIVIDER_Y)], fill=(40, 40, 45), width=1)

# Title block
title_font = font(72, 'bold')
subtitle_font = font(28, 'regular')
attribution_font = font(22, 'regular')

title = "reading doppler"
tagline = "paragraph dwell, decomposed by viewport band"
attribution = "a content-authoring signal for long-form prose  /  github.com/andyed/reading-doppler"

TITLE_Y = 460
bbox = draw.textbbox((0, 0), title, font=title_font)
title_w = bbox[2] - bbox[0]
title_h = bbox[3] - bbox[1]
draw.text(((W - title_w) // 2, TITLE_Y), title, fill=TEXT, font=title_font)

TAGLINE_Y = TITLE_Y + title_h + 14
bbox_s = draw.textbbox((0, 0), tagline, font=subtitle_font)
tag_w = bbox_s[2] - bbox_s[0]
draw.text(((W - tag_w) // 2, TAGLINE_Y), tagline, fill=BRIGHT, font=subtitle_font)

bbox_a = draw.textbbox((0, 0), attribution, font=attribution_font)
attr_w = bbox_a[2] - bbox_a[0]
draw.text(((W - attr_w) // 2, 597), attribution, fill=BRIGHT_DIM, font=attribution_font)

social.save(OUT_DIR / "social-header.png")
print("  -> social-header.png")

print()
print(f"All assets saved to {OUT_DIR}")
