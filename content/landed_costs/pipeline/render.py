"""Frame renderer for @landed_costs Reels: fast kinetic motion graphics + the
recurring mascot "Cargo" (a talking shipping container).

Everything is drawn in code with Pillow, so it's free, offline and fully
automatable. Each scene type below is one function; the episode JSON picks the
type and fills in its fields.
"""
import glob
import math
import os
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30

# Brand palette
BG = (11, 16, 32)
BG2 = (22, 30, 58)
ORANGE = (255, 106, 26)   # Cargo's paint
YELLOW = (255, 210, 63)
MINT = (46, 230, 166)
RED = (255, 59, 92)
BLUE = (64, 140, 255)
WHITE = (255, 255, 255)
GREY = (150, 160, 190)
BLACK = (0, 0, 0)
ACCENTS = [ORANGE, MINT, BLUE, YELLOW, RED]

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "..", "fonts")
FALLBACK_FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def _font_path():
    # Drop a heavy display font (e.g. Anton, Bebas Neue, Montserrat Black) into ../fonts/
    custom = sorted(glob.glob(os.path.join(FONT_DIR, "*.ttf")) + glob.glob(os.path.join(FONT_DIR, "*.otf")))
    for p in custom + FALLBACK_FONTS:
        if os.path.exists(p):
            return p
    raise SystemExit("No bold font found. Put a .ttf file in content/landed_costs/fonts/")


FONT_PATH = _font_path()


@lru_cache(maxsize=512)
def font(size):
    return ImageFont.truetype(FONT_PATH, max(8, int(size)))


# ---------- easing ----------

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_back(x, s=2.2):
    x = clamp(x)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


def pop(t, start, length=0.28):
    """0 before start, overshoots to ~1.1 then settles at 1."""
    return ease_back((t - start) / length) if t >= start else 0.0


def lerp(a, b, x):
    return a + (b - a) * x


# ---------- text helpers ----------

def text_size(text, size):
    l, t, r, b = font(size).getbbox(text)
    return r - l, b - t


def fit_size(text, size, max_w):
    while size > 20 and text_size(text, size)[0] > max_w:
        size -= 4
    return size


def draw_text(img, text, cx, cy, size, fill=WHITE, stroke=10, stroke_fill=BLACK, scale=1.0,
              angle=0.0, alpha=1.0, max_w=W - 120, box=None, box_pad=24):
    """Centered text with outline. scale/angle/alpha are animated per frame."""
    if scale <= 0.02 or alpha <= 0.02:
        return
    size = fit_size(text, size, max_w) * scale
    f = font(size)
    s = max(1, int(stroke * scale))
    l, t, r, b = f.getbbox(text, stroke_width=s)
    tw, th = r - l, b - t
    pad = int(box_pad * scale) if box else 0
    layer = Image.new("RGBA", (tw + 2 * pad + 4, th + 2 * pad + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if box:
        d.rounded_rectangle([0, 0, layer.width - 1, layer.height - 1], radius=int(18 * scale), fill=box)
    d.text((pad - l + 2, pad - t + 2), text, font=f, fill=fill, stroke_width=s if not box else 0,
           stroke_fill=stroke_fill)
    if angle:
        layer = layer.rotate(angle, expand=True, resample=Image.BICUBIC)
    if alpha < 1:
        a = layer.getchannel("A").point(lambda v: int(v * alpha))
        layer.putalpha(a)
    img.paste(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)), layer)


def fmt_num(v, decimals=0):
    return f"{v:,.{decimals}f}"


# ---------- background ----------

@lru_cache(maxsize=8)
def _gradient(top, bottom):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(0, H, 4):
        c = tuple(int(lerp(top[i], bottom[i], y / H)) for i in range(3))
        d.rectangle([0, y, W, y + 4], fill=c)
    return img


def background(t, accent):
    img = _gradient(BG2, BG).copy()
    d = ImageDraw.Draw(img, "RGBA")
    # drifting grid = constant motion even on "static" moments
    off = (t * 60) % 120
    for x in range(-120, W + 120, 120):
        d.line([(x + off, 0), (x + off, H)], fill=(255, 255, 255, 14), width=2)
    for y in range(-120, H + 120, 120):
        d.line([(0, y + off), (W, y + off)], fill=(255, 255, 255, 14), width=2)
    # glowing accent blob
    r = 520 + 40 * math.sin(t * 2)
    cx, cy = W / 2 + 160 * math.sin(t * 0.7), 760 + 120 * math.cos(t * 0.9)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=accent + (26,))
    return img


# ---------- Cargo the container ----------

def draw_cargo(img, cx, cy, scale, t, mouth, mood="smug", look=(0, 0), wave=0.0):
    """Cargo: an orange shipping container with a face. mouth in 0..1."""
    d = ImageDraw.Draw(img, "RGBA")
    w, h = 560 * scale, 380 * scale
    bob = math.sin(t * 6) * 10 * scale
    squash = 1 + mouth * 0.04
    x0, y0 = cx - w / 2 * squash, cy - h / 2 / squash + bob
    x1, y1 = cx + w / 2 * squash, cy + h / 2 / squash + bob
    # shadow
    d.ellipse([cx - w * 0.45, y1 + 30 * scale, cx + w * 0.45, y1 + 70 * scale], fill=(0, 0, 0, 90))
    # body + corrugation
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(22 * scale), fill=ORANGE, outline=BLACK,
                        width=max(2, int(10 * scale)))
    n = 9
    for i in range(1, n):
        x = lerp(x0, x1, i / n)
        d.line([(x, y0 + 26 * scale), (x, y1 - 26 * scale)], fill=(200, 70, 10, 255), width=max(1, int(8 * scale)))
    # corner castings
    for (ax, ay) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        s = 34 * scale
        d.rectangle([ax - s / 2, ay - s / 2, ax + s / 2, ay + s / 2], fill=(60, 60, 70), outline=BLACK,
                    width=max(1, int(4 * scale)))
    # face panel
    fx0, fy0, fx1, fy1 = cx - w * 0.36, y0 + h * 0.14, cx + w * 0.36, y1 - h * 0.12
    d.rounded_rectangle([fx0, fy0, fx1, fy1], radius=int(30 * scale), fill=(255, 140, 70))
    # eyes (blink every ~3.5s)
    blink = 0.12 if (t % 3.5) < 0.12 else 1.0
    ey = fy0 + (fy1 - fy0) * 0.36
    shocked = mood == "shocked"
    er = (62 if shocked else 52) * scale
    for side in (-1, 1):
        ex = cx + side * w * 0.17
        d.ellipse([ex - er, ey - er * blink, ex + er, ey + er * blink], fill=WHITE, outline=BLACK,
                  width=max(1, int(6 * scale)))
        pr = er * (0.38 if shocked else 0.48)
        px, py = ex + look[0] * er * 0.35, ey + look[1] * er * 0.35 * blink
        d.ellipse([px - pr, py - pr * blink, px + pr, py + pr * blink], fill=BLACK)
        # brows
        by = ey - er - 22 * scale
        tilt = (-14 if shocked else 10) * scale * side * (-1 if mood == "smug" and side == 1 else 1)
        d.line([(ex - er, by + tilt), (ex + er, by - tilt)], fill=BLACK, width=max(2, int(12 * scale)))
    # mouth
    my = fy0 + (fy1 - fy0) * 0.74
    mw = (120 if shocked else 140) * scale
    mh = (12 + 70 * mouth + (25 if shocked else 0)) * scale
    if mouth < 0.08 and not shocked:
        # closed smirk
        d.arc([cx - mw / 2, my - 30 * scale, cx + mw / 2, my + 30 * scale], 20, 160, fill=BLACK,
              width=max(2, int(10 * scale)))
    else:
        d.rounded_rectangle([cx - mw / 2, my - mh / 2, cx + mw / 2, my + mh / 2], radius=int(mh / 2),
                            fill=(60, 10, 20), outline=BLACK, width=max(2, int(7 * scale)))
        if mh > 40 * scale:
            d.ellipse([cx - mw * 0.25, my + mh * 0.05, cx + mw * 0.25, my + mh / 2 - 4], fill=(255, 90, 110))
    # waving arm on outro
    if wave:
        ang = math.sin(t * 10) * 0.5
        ax, ay = x1 - 10 * scale, y0 + h * 0.4
        hx, hy = ax + math.cos(-0.9 + ang) * 170 * scale, ay + math.sin(-0.9 + ang) * 170 * scale
        d.line([(ax, ay), (hx, hy)], fill=BLACK, width=int(18 * scale))
        d.ellipse([hx - 30 * scale, hy - 30 * scale, hx + 30 * scale, hy + 30 * scale], fill=WHITE,
                  outline=BLACK, width=int(6 * scale))


def mini_box(d, cx, cy, s, color=ORANGE):
    d.rounded_rectangle([cx - s, cy - s * 0.6, cx + s, cy + s * 0.6], radius=int(s * 0.12), fill=color,
                        outline=BLACK, width=max(2, int(s * 0.1)))
    for i in range(1, 5):
        x = cx - s + 2 * s * i / 5
        d.line([(x, cy - s * 0.45), (x, cy + s * 0.45)], fill=BLACK, width=max(1, int(s * 0.05)))


# ---------- scene templates ----------
# Each gets (img, sc, t, dur, ctx). t = seconds into the scene.
# Content lives between y≈250 and y≈1200; captions sit below that.

def scene_hook(img, sc, t, dur, ctx):
    lines = sc.get("lines", [])
    accent = sc.get("accent", "")
    n = len(lines)
    gap = min(0.45, dur * 0.5 / max(1, n))
    for i, line in enumerate(lines):
        s = pop(t, i * gap, 0.3)
        if s <= 0:
            continue
        s = lerp(2.4, 1.0, ease_out((t - i * gap) / 0.18)) if t - i * gap < 0.18 else s
        y = 640 + (i - (n - 1) / 2) * 250
        hot = accent and accent in line
        draw_text(img, line, W / 2, y, 210, fill=BLACK if hot else WHITE, scale=s,
                  box=YELLOW if hot else None, angle=-3 if hot else 0)
    ctx["shake"] = max(ctx.get("shake", 0), max((0.25 - (t - i * gap)) * 120 for i in range(n)) if n else 0)


def scene_cargo(img, sc, t, dur, ctx):
    draw_text(img, sc.get("text", ""), W / 2, 360, 150, fill=YELLOW, scale=pop(t, 0.05))
    draw_cargo(img, W / 2, 840, 1.25 * pop(t, 0.0, 0.35), t, ctx["mouth"], sc.get("mood", "smug"),
               look=(math.sin(t * 1.3), 0.2))


def scene_number(img, sc, t, dur, ctx):
    v = sc["value"] * ease_in_out(t / max(0.4, dur * 0.65))
    txt = sc.get("prefix", "") + fmt_num(v, sc.get("decimals", 0)) + sc.get("suffix", "")
    d = ImageDraw.Draw(img, "RGBA")
    # spinning progress ring
    r = 400
    d.ellipse([W / 2 - r, 720 - r, W / 2 + r, 720 + r], outline=(255, 255, 255, 30), width=26)
    d.arc([W / 2 - r, 720 - r, W / 2 + r, 720 + r], -90, -90 + 360 * ease_in_out(t / max(0.4, dur * 0.65)),
          fill=MINT, width=26)
    final = t > dur * 0.65
    draw_text(img, txt, W / 2, 700, 230, fill=YELLOW, scale=pop(t, 0) * (1 + (0.08 if final and t < dur * 0.65 + 0.12 else 0)),
              max_w=680)
    draw_text(img, sc.get("label", ""), W / 2, 960, 64, fill=WHITE, scale=pop(t, 0.2), stroke=6, max_w=700)


def scene_bars(img, sc, t, dur, ctx):
    items = sc["items"]
    vmax = max(i["value"] for i in items)
    d = ImageDraw.Draw(img, "RGBA")
    step = dur * 0.75 / len(items)
    top = 640 - (len(items) - 1) * 130
    for k, it in enumerate(items):
        y = top + k * 260
        g = ease_out((t - k * step) / 0.5)
        if g <= 0:
            continue
        d.text((110, y - 110), it["label"], font=font(62), fill=WHITE, stroke_width=6, stroke_fill=BLACK)
        bw = (W - 220) * (it["value"] / vmax) * g
        col = ACCENTS[k % len(ACCENTS)]
        d.rounded_rectangle([110, y - 30, 110 + max(30, bw), y + 70], radius=20, fill=col, outline=BLACK, width=6)
        val = sc.get("prefix", "") + fmt_num(it["value"] * g) + sc.get("suffix", "")
        vw = text_size(val, 64)[0]
        if bw > vw + 60:
            d.text((110 + 24, y + 20), val, font=font(64), anchor="lm", fill=BLACK if col in (YELLOW, MINT) else WHITE)
        else:
            d.text((110 + max(30, bw) + 24, y + 20), val, font=font(64), anchor="lm", fill=WHITE,
                   stroke_width=6, stroke_fill=BLACK)


def scene_stack(img, sc, t, dur, ctx):
    layers = sc["layers"]
    total = sum(l["amount"] for l in layers)
    d = ImageDraw.Draw(img, "RGBA")
    base, maxh = 1170, 690
    step = dur * 0.78 / len(layers)
    y = base
    running = 0.0
    for k, ly in enumerate(layers):
        h = 90 + (maxh - 90 * len(layers)) * ly["amount"] / total
        g = ease_back((t - k * step) / 0.35, 1.6)
        if t < k * step:
            break
        running += ly["amount"] * clamp((t - k * step) / 0.35)
        drop = (1 - clamp(g)) * -500
        col = ACCENTS[k % len(ACCENTS)]
        x0, x1 = 170, W - 170
        d.rounded_rectangle([x0, y - h + drop, x1, y + drop], radius=18, fill=col, outline=BLACK, width=8)
        dark = col in (YELLOW, MINT)
        cy = y - h / 2 + drop
        lf = font(min(64, h * 0.55))
        d.text((x0 + 30, cy), ly["label"], font=lf, anchor="lm", fill=BLACK if dark else WHITE)
        amt = sc.get("prefix", "") + fmt_num(ly["amount"], 2 if ly["amount"] % 1 else 0)
        d.text((x1 - 30, cy), amt, font=lf, anchor="rm", fill=BLACK if dark else WHITE)
        y -= h
        if k == 0:
            ctx["shake"] = max(ctx.get("shake", 0), (0.2 - (t - k * step)) * 60)
    decimals = 2 if any(l["amount"] % 1 for l in layers) else 0
    draw_text(img, "TOTAL " + sc.get("prefix", "") + fmt_num(running, decimals), W / 2, 300, 120,
              fill=YELLOW, scale=pop(t, 0))


def scene_route(img, sc, t, dur, ctx):
    stops = sc["stops"]
    n = len(stops)
    d = ImageDraw.Draw(img, "RGBA")
    pts = []
    for i in range(n):
        y = lerp(300, 1150, i / max(1, n - 1))
        x = W / 2 + (260 if i % 2 else -260) * (1 if n > 1 else 0)
        pts.append((x, y))
    travel = clamp(t / max(0.5, dur * 0.85))
    seg = travel * (n - 1)
    # dashed full route
    for i in range(n - 1):
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        for k in range(14):
            if k % 2 == 0:
                d.line([(lerp(ax, bx, k / 14), lerp(ay, by, k / 14)), (lerp(ax, bx, (k + 1) / 14),
                        lerp(ay, by, (k + 1) / 14))], fill=(255, 255, 255, 70), width=10)
    # travelled part
    for i in range(min(n - 1, int(seg) + 1)):
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        f = clamp(seg - i)
        d.line([(ax, ay), (lerp(ax, bx, f), lerp(ay, by, f))], fill=MINT, width=14)
    for i, (x, y) in enumerate(pts):
        reached = seg >= i - 0.02
        s = pop(t, i * dur * 0.85 / max(1, n - 1) - 0.05) if reached else 0.6
        r = 34 * max(0.6, s)
        d.ellipse([x - r, y - r, x + r, y + r], fill=MINT if reached else (255, 255, 255, 60),
                  outline=BLACK, width=6)
        side = -1 if x > W / 2 else 1
        label_x = x + side * 60
        d.text((label_x, y), stops[i], font=font(58 * (1 if reached else 0.85)),
               anchor="lm" if side > 0 else "rm", fill=WHITE if reached else GREY,
               stroke_width=6, stroke_fill=BLACK)
    i = min(n - 2, int(seg)) if n > 1 else 0
    f = clamp(seg - i)
    (ax, ay), (bx, by) = pts[i], pts[min(i + 1, n - 1)]
    mini_box(d, lerp(ax, bx, f), lerp(ay, by, f) - 70, 62)


def scene_versus(img, sc, t, dur, ctx):
    d = ImageDraw.Draw(img, "RGBA")
    sl = ease_out(t / 0.35)
    lw = W / 2
    d.rectangle([-lw + lw * sl, 260, lw * sl, 1200], fill=RED + (200,))
    d.rectangle([W - lw * sl, 260, W + lw - lw * sl, 1200], fill=MINT + (200,))
    for side, key, cx in ((-1, "left", W * 0.25), (1, "right", W * 0.75)):
        it = sc[key]
        delay = 0.15 if side < 0 else max(0.4, dur * 0.45)
        draw_text(img, it["label"], cx, 480, 72, scale=pop(t, delay), stroke=6, max_w=460)
        draw_text(img, it["value"], cx, 900, 150, fill=YELLOW, scale=pop(t, delay + 0.1), max_w=400)
    s = pop(t, 0.3)
    r = 110 * s
    d.ellipse([W / 2 - r, 730 - r, W / 2 + r, 730 + r], fill=BLACK, outline=WHITE, width=8)
    draw_text(img, "VS", W / 2, 730, 100, scale=s, stroke=0)


def scene_stamp(img, sc, t, dur, ctx):
    word = sc.get("word", "")
    hit = 0.2
    s = lerp(3.2, 1.0, ease_in_out(t / hit)) if t < hit else 1.0
    alpha = clamp(t / hit)
    if t >= hit:
        ctx["shake"] = max(ctx.get("shake", 0), (0.3 - (t - hit)) * 140)
    # stamp: text inside a thick red frame, rotated
    size = fit_size(word, 200, 820)
    tw, th = text_size(word, size)
    layer = Image.new("RGBA", (tw + 140, th + 150), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([8, 8, layer.width - 8, layer.height - 8], radius=30, outline=RED, width=22)
    d.text((layer.width / 2, layer.height / 2), word, font=font(size), anchor="mm", fill=RED)
    layer = layer.resize((max(1, int(layer.width * s)), max(1, int(layer.height * s))), Image.BICUBIC)
    layer = layer.rotate(-9, expand=True, resample=Image.BICUBIC)
    if alpha < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    img.paste(layer, (int(W / 2 - layer.width / 2), int(560 - layer.height / 2)), layer)
    if t > hit:
        draw_cargo(img, W / 2, 1010, 0.55 * pop(t, hit + 0.1), t, ctx["mouth"], "shocked")


def scene_list(img, sc, t, dur, ctx):
    items = sc["items"]
    n = len(items)
    step = dur * 0.8 / n
    d = ImageDraw.Draw(img, "RGBA")
    top = 720 - (n - 1) * 95
    for k, it in enumerate(items):
        s = pop(t, k * step)
        if s <= 0:
            continue
        y = top + k * 190
        x = lerp(-400, 0, ease_out((t - k * step) / 0.25))
        col = ACCENTS[k % len(ACCENTS)]
        d.rounded_rectangle([90 + x, y - 70, W - 90 + x, y + 70], radius=26, fill=(255, 255, 255, 235),
                            outline=BLACK, width=6)
        d.ellipse([120 + x, y - 44, 208 + x, y + 44], fill=col, outline=BLACK, width=5)
        d.text((164 + x, y), str(k + 1), font=font(56), anchor="mm", fill=BLACK)
        fs = fit_size(it, 66, W - 380)
        d.text((240 + x, y), it, font=font(fs), anchor="lm", fill=BLACK)


def scene_outro(img, sc, t, dur, ctx):
    draw_cargo(img, W / 2, 640, 1.05 * pop(t, 0, 0.35), t, ctx["mouth"], "smug", look=(0, 0.3), wave=1)
    pulse = 1 + 0.05 * math.sin(t * 9)
    draw_text(img, sc.get("text", "FOLLOW"), W / 2, 1060, 96, fill=WHITE, scale=pop(t, 0.2) * pulse,
              box=RED, stroke=0, max_w=900)


SCENES = {
    "hook": scene_hook, "cargo": scene_cargo, "number": scene_number, "bars": scene_bars,
    "stack": scene_stack, "route": scene_route, "versus": scene_versus, "stamp": scene_stamp,
    "list": scene_list, "outro": scene_outro,
}


# ---------- captions ----------

def caption_chunks(words, max_words=3, max_chars=16):
    """Group words into short chunks that flash on screen."""
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        text = " ".join(x["w"] for x in cur)
        if len(cur) >= max_words or len(text) >= max_chars or w["w"][-1] in ".?!,":
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def draw_captions(img, chunks, t):
    for ch in chunks:
        if ch[0]["t0"] - 0.05 <= t < ch[-1]["t1"] + 0.12:
            words = [w["w"].upper().strip() for w in ch]
            size = fit_size(" ".join(words), 92, W - 220)
            space = size * 0.42
            widths = [text_size(w, size)[0] + 24 for w in words]  # + outline
            x = W / 2 - (sum(widths) + space * (len(words) - 1)) / 2
            s = pop(t, ch[0]["t0"] - 0.05, 0.16)
            spoken = [i for i, info in enumerate(ch) if info["t0"] - 0.03 <= t]
            current = spoken[-1] if spoken else -1
            for k, (w, wd) in enumerate(zip(words, widths)):
                active = k == current
                draw_text(img, w, x + wd / 2, 1330, size, fill=YELLOW if active else WHITE, stroke=12,
                          scale=s * (1.1 if active else 1.0), max_w=W)
                x += wd + space
            return


# ---------- frame composition ----------

def render_frame(scene, t, dur, ctx, global_t, total, note=None):
    accent = ACCENTS[ctx["index"] % len(ACCENTS)]
    img = background(global_t, accent)
    ctx["shake"] = 0
    SCENES[scene["type"]](img, scene, t, dur, ctx)
    draw_captions(img, ctx["chunks"], t)
    d = ImageDraw.Draw(img, "RGBA")
    if note:
        d.text((W / 2, 1470), note.upper(), font=font(30), anchor="mm", fill=(255, 255, 255, 110))
    # progress bar keeps people watching to the end
    d.rectangle([0, 0, W * global_t / total, 12], fill=YELLOW)
    # transition: zoom punch + flash on every cut
    zoom = 1 + 0.14 * (1 - ease_out(t / 0.22))
    sh = ctx["shake"]
    if zoom > 1.001 or sh > 0.5:
        dx = math.sin(global_t * 91) * sh * 0.25
        dy = math.cos(global_t * 77) * sh * 0.25
        zw, zh = int(W * zoom), int(H * zoom)
        big = img.resize((zw, zh), Image.BILINEAR)
        ox, oy = int((zw - W) / 2 + dx), int((zh - H) / 2 + dy)
        img = big.crop((ox, oy, ox + W, oy + H))
    if t < 0.07 and ctx["index"] > 0:
        img = Image.blend(img, Image.new("RGB", (W, H), WHITE), 0.55)
    return img
