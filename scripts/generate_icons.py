"""Generate PWA PNG icons for Судоку Дзен."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

FONTS = [
    Path(r"C:\Windows\Fonts\YuGothB.ttc"),
    Path(r"C:\Windows\Fonts\YuGothR.ttc"),
    Path(r"C:\Windows\Fonts\msyhbd.ttc"),
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\msgothic.ttc"),
    Path(r"C:\Windows\Fonts\simsun.ttc"),
    Path(r"C:\Windows\Fonts\malgunbd.ttf"),
    Path(r"C:\Windows\Fonts\malgun.ttf"),
    Path(r"C:\Windows\Fonts\seguiemj.ttf"),
]


def load_cjk_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONTS:
        if not path.exists():
            continue
        try:
            return ImageFont.truetype(str(path), size=size, index=0)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_arc(draw: ImageDraw.ImageDraw, bbox, start_deg: float, extent_deg: float, fill, width: int) -> None:
    draw.arc(bbox, start=start_deg, end=start_deg + extent_deg, fill=fill, width=width)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (10, 16, 13, 255))
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)

    # radial-ish glow in the upper-left
    glow_r = int(size * 0.72)
    glow = Image.new("RGBA", (glow_r * 2, glow_r * 2), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for i in range(glow_r, 0, -1):
        t = i / glow_r
        alpha = int(42 * (1 - t) ** 1.6)
        gdraw.ellipse((glow_r - i, glow_r - i, glow_r + i, glow_r + i), fill=(30, 58, 44, alpha))
    img.alpha_composite(glow, dest=(-int(size * 0.18), -int(size * 0.22)))

    gold = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g2 = ImageDraw.Draw(gold)
    gr = int(size * 0.55)
    gimg = Image.new("RGBA", (gr * 2, gr * 2), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gimg)
    for i in range(gr, 0, -1):
        t = i / gr
        alpha = int(36 * (1 - t) ** 2)
        gd.ellipse((gr - i, gr - i, gr + i, gr + i), fill=(217, 171, 85, alpha))
    gold.alpha_composite(gimg, dest=(int(size * 0.42), int(size * 0.48)))
    img.alpha_composite(gold)

    cx = cy = size / 2
    r = size * 0.234
    bbox = [cx - r, cy - r, cx + r, cy + r]
    w_outer = max(3, int(size * 0.082))
    w_mid = max(3, int(size * 0.066))
    w_hi = max(2, int(size * 0.02))

    draw_arc(odraw, bbox, -108, 300, (79, 191, 139, 48), w_outer + 8)
    draw_arc(odraw, bbox, -104, 298, (28, 74, 53, 255), w_outer)
    draw_arc(odraw, bbox, -108, 298, (92, 185, 140, 255), w_mid)
    draw_arc(odraw, bbox, -96, 108, (168, 230, 198, 150), w_hi)
    img.alpha_composite(overlay)

    draw = ImageDraw.Draw(img)
    kanji_font = load_cjk_font(int(size * 0.33))
    kanji = "禅"
    # vertical optical centering: CJK glyphs sit a bit low
    draw.text((cx, cy - size * 0.02), kanji, font=kanji_font, fill=(233, 220, 186, 245), anchor="mm")

    # gold seal with 和
    seal = int(size * 0.105)
    sx = int(size * 0.62)
    sy = int(size * 0.62)
    seal_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(seal_img)
    sd.rounded_rectangle((sx, sy, sx + seal, sy + seal), radius=max(4, seal // 5), fill=(201, 143, 58, 255))
    sd.rounded_rectangle(
        (sx, sy, sx + seal, sy + seal),
        radius=max(4, seal // 5),
        outline=(242, 212, 145, 180),
        width=max(1, seal // 18),
    )
    seal_font = load_cjk_font(int(seal * 0.72))
    sd.text((sx + seal / 2, sy + seal / 2 + 1), "和", font=seal_font, fill=(58, 39, 8, 255), anchor="mm")
    rotated = seal_img.rotate(-9, resample=Image.Resampling.BICUBIC, center=(sx + seal / 2, sy + seal / 2))
    img.alpha_composite(rotated)

    # small gold motes
    mote = max(2, int(size * 0.012))
    draw.ellipse((int(size * 0.36) - mote, int(size * 0.5) - mote, int(size * 0.36) + mote, int(size * 0.5) + mote), fill=(217, 171, 85, 230))
    mote2 = max(2, int(size * 0.01))
    draw.ellipse((int(size * 0.5) - mote2, int(size * 0.66) - mote2, int(size * 0.5) + mote2, int(size * 0.66) + mote2), fill=(217, 171, 85, 165))

    return img.filter(ImageFilter.SMOOTH)


def save(img: Image.Image, name: str, size: int) -> None:
    out = img.resize((size, size), Image.Resampling.LANCZOS).convert("RGB")
    path = OUT / name
    out.save(path, "PNG", optimize=True)
    print(f"wrote {path} ({size}x{size})")


def main() -> None:
    master = make_icon(1024)
    save(master, "icon-192.png", 192)
    save(master, "icon-512.png", 512)
    save(master, "icon-512-maskable.png", 512)
    save(master, "apple-touch-icon.png", 180)


if __name__ == "__main__":
    main()
