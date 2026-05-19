"""
Round-3 icon pass:
 - trubel/myloo: glassify from the raw art (drop the opaque interior so the
   body reads as see-through glass like wavelength/yarnstash) + add a
   transparent margin so their on-page size matches the other icons.
 - kelva/moto: remove the dark residue baked into the rounded corners
   (clean rounded-rect alpha mask, no interior touch).

Outputs *_v2.png for visual review; promotion is a separate explicit copy.
Raw sources are kept untouched.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ICONS = r"C:\Users\Alain Kessler\klar\public\icons"
OUT = 1024              # match wavelength/yarnstash
CONTENT_FRAC = 0.72     # every icon spans exactly this much of the canvas


def lum(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def rounded_mask(w, h, r, ss=4):
    m = Image.new("L", (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, w * ss - 1, h * ss - 1], radius=r * ss, fill=255
    )
    return np.array(m.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255.0


def square_bbox(mask):
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = max(x1 - x0, y1 - y0) / 2
    return int(cx - half), int(cy - half), int(cx + half), int(cy + half)


def bright_frame_bbox(im):
    """square bbox of the bright chrome frame (excludes any dark canvas
    border) — the frame is the brightest, outermost structure."""
    L = lum(np.array(im)[..., :3].astype(np.float32))
    b = ndimage.binary_opening(L > 175, iterations=3)
    ys, xs = np.where(b)
    x0 = np.percentile(xs, 0.2)
    y0 = np.percentile(ys, 0.2)
    x1 = np.percentile(xs, 99.8)
    y1 = np.percentile(ys, 99.8)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = max(x1 - x0, y1 - y0) / 2
    return (
        int(max(0, cx - half)),
        int(max(0, cy - half)),
        int(min(im.width, cx + half)),
        int(min(im.height, cy + half)),
    )


def fit_canvas(rgba):
    """scale the tight content into a transparent OUT canvas at CONTENT_FRAC"""
    a = np.array(rgba)
    ys, xs = np.where(a[..., 3] > 8)
    crop = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    target = int(OUT * CONTENT_FRAC)
    w, h = crop.size
    s = target / max(w, h)
    crop = crop.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (OUT, OUT), (0, 0, 0, 0))
    canvas.paste(
        crop, ((OUT - crop.width) // 2, (OUT - crop.height) // 2), crop
    )
    return canvas


def smooth(v, lo, hi):
    t = np.clip((v - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def glassify_trubel():
    im = Image.open(f"{ICONS}/icon trubel raw.png").convert("RGBA")
    rgb = np.array(im)[..., :3].astype(np.float32)
    L = lum(rgb)
    bright = ndimage.binary_opening(L > 178, iterations=3)
    ys, xs = np.where(bright)
    x0 = int(np.percentile(xs, 0.2))
    y0 = int(np.percentile(ys, 0.2))
    x1 = int(np.percentile(xs, 99.8))
    y1 = int(np.percentile(ys, 99.8))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = max(x1 - x0, y1 - y0) / 2
    L0 = int(max(0, cx - half))
    T0 = int(max(0, cy - half))
    R0 = int(min(im.width, cx + half))
    B0 = int(min(im.height, cy + half))
    crop = im.crop((L0, T0, R0, B0))
    cr = np.array(crop).astype(np.float32)
    Lc = lum(cr[..., :3])
    # dark collage -> see-through; bright frame/glasses/text -> kept
    glass = smooth(Lc, 55, 135)
    rm = rounded_mask(crop.width, crop.height, int(crop.width * 0.225))
    out = cr.copy()
    out[..., 3] = np.clip(glass * 238, 0, 255) * rm
    res = Image.fromarray(out.astype(np.uint8), "RGBA")
    res = res.filter(ImageFilter.GaussianBlur(0.4))
    fit_canvas(res).save(f"{ICONS}/trubel_v2.png")
    print("trubel_v2: glassified (luminance alpha)")


def glassify_myloo():
    im = Image.open(f"{ICONS}/myloo icon raw.png").convert("RGBA")
    x0, y0, x1, y1 = bright_frame_bbox(im)
    crop = im.crop((x0, y0, x1, y1))
    cr = np.array(crop).astype(np.float32)
    rgbf = cr[..., :3]
    h, w = rgbf.shape[:2]
    # periwinkle bg = pure interior just below the top frame, ABOVE the blob
    # (the blob sits centre-lower, so a top band is reliably pure bg)
    band = rgbf[int(h * 0.10):int(h * 0.17), int(w * 0.32):int(w * 0.68)]
    bg = np.median(band.reshape(-1, 3), axis=0)
    dist = np.sqrt(((rgbf - bg) ** 2).sum(-1))
    # near bg -> transparent; far (chrome / eyes / glass highlights) -> kept
    keep = smooth(dist, 30, 78)
    rm = rounded_mask(crop.width, crop.height, int(crop.width * 0.225))
    out = cr.copy()
    out[..., 3] = np.clip(keep * 245, 0, 255) * rm
    res = Image.fromarray(out.astype(np.uint8), "RGBA")
    res = res.filter(ImageFilter.GaussianBlur(0.4))
    fit_canvas(res).save(f"{ICONS}/myloo_v2.png")
    print(f"myloo_v2: glassified (periwinkle key bg={bg.astype(int).tolist()})")


def refine_framed(name):
    """kelva/moto: kill corner residue AND the subtle dark frame rim, then
    size-match (fit into CONTENT_FRAC like the glass set)."""
    im = Image.open(f"{ICONS}/{name}.png").convert("RGBA")
    a = np.array(im).astype(np.float32)
    al = a[..., 3]
    L = lum(a[..., :3])
    ys, xs = np.where(al > 32)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    w, h = im.size
    side = max(x1 - x0, y1 - y0)
    rm = rounded_mask(w, h, int(min(w, h) * 0.205))
    box = np.zeros((h, w), np.float32)
    box[y0:y1, x0:x1] = 1.0
    newa = al * rm * box
    # trim the outermost ring (the dark frame outline that reads as a
    # subtle black border): erode the shape by ~1.4% of the icon size
    inset = max(6, int(round(side * 0.014)))
    solid = (newa > 40).astype(np.uint8)
    dist = ndimage.distance_transform_edt(solid)
    edge = dist < inset
    newa[edge] = 0.0
    # and any remaining dark low-alpha speckle
    newa[(newa < 110) & (L < 70)] = 0.0
    a[..., 3] = np.clip(newa, 0, 255)
    res = Image.fromarray(a.astype(np.uint8), "RGBA")
    res = res.filter(ImageFilter.GaussianBlur(0.5))
    fit_canvas(res).save(f"{ICONS}/{name}_v2.png")
    print(f"{name}_v2: rim trimmed (inset {inset}px) + size-matched")


def refit(name):
    """wavelength/yarnstash are already clean glass — just normalise their
    on-canvas size to the shared CONTENT_FRAC so all 6 match exactly."""
    im = Image.open(f"{ICONS}/{name}.png").convert("RGBA")
    fit_canvas(im).save(f"{ICONS}/{name}_v2.png")
    print(f"{name}_v2: size-normalised")


if __name__ == "__main__":
    glassify_trubel()
    glassify_myloo()
    refine_framed("kelva")
    refine_framed("moto")
    refit("wavelength")
    refit("yarnstash")
