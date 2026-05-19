"""
One-off: clean the user's raw app-icon art into transparent-bg PNGs that
match the site set (rounded-square icon floating on transparent).

Keeps the icon (chrome frame + art) intact and only removes everything
OUTSIDE the rounded square — never keys the interior (that destroys
translucent art, per the AI-Brain connected-component learning).

Outputs *_clean.png for visual review; promotion to the real filename
is a separate explicit copy after eyeballing.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

SRC = {
    "trubel": "icon trubel raw.png",
    "myloo": "myloo icon raw.png",
}
OUT_SIZE = 1024


def luminance(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def detect_bbox(rgb, kind):
    lum = luminance(rgb)
    if kind == "myloo":
        # canvas is near-black; the periwinkle icon is everything else
        mask = lum > 18
        lbl, n = ndimage.label(mask)
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
        ys, xs = np.where(lbl == (np.argmax(sizes) + 1))
        return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    # trubel: the chrome frame is the brightest thing and the OUTERMOST
    # bright structure. Take the bbox of all bright pixels (after removing
    # isolated halftone speckle) — that is the frame's outer rectangle.
    mask = lum > 178
    mask = ndimage.binary_opening(mask, iterations=3)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise SystemExit(f"{kind}: no bright frame found")
    # 0.2nd/99.8th percentile to shrug off any surviving stray dots
    return (
        int(np.percentile(xs, 0.2)),
        int(np.percentile(ys, 0.2)),
        int(np.percentile(xs, 99.8)) + 1,
        int(np.percentile(ys, 99.8)) + 1,
    )


def rounded_mask(w, h, radius, scale=4):
    """anti-aliased rounded-rect alpha via supersampling"""
    m = Image.new("L", (w * scale, h * scale), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle(
        [0, 0, w * scale - 1, h * scale - 1],
        radius=radius * scale,
        fill=255,
    )
    return m.resize((w, h), Image.LANCZOS)


def process(kind, fname):
    im = Image.open(fname).convert("RGBA")
    rgb = np.array(im)[..., :3].astype(np.float32)
    x0, y0, x1, y1 = detect_bbox(rgb, kind)
    # square the bbox around its center (icons are square)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = max(x1 - x0, y1 - y0)
    half = side / 2
    L = int(max(0, cx - half))
    T = int(max(0, cy - half))
    R = int(min(im.width, cx + half))
    B = int(min(im.height, cy + half))
    crop = im.crop((L, T, R, B))
    w, h = crop.size
    # iOS-ish corner radius
    radius = int(round(min(w, h) * 0.225))
    mask = rounded_mask(w, h, radius)
    # feather 1px so the cut edge isn't hard
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    out = crop.copy()
    out.putalpha(mask)
    out = out.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    dst = f"{kind}_clean.png"
    out.save(dst)
    a = np.array(out)[..., 3]
    print(
        f"{kind}: bbox=({x0},{y0},{x1},{y1}) crop={w}x{h} r={radius} "
        f"-> {dst} alpha[min={a.min()} max={a.max()} "
        f"transparent_frac={(a < 8).mean():.2f}]"
    )


if __name__ == "__main__":
    for k, f in SRC.items():
        process(k, f)
