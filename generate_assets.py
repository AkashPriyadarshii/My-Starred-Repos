#!/usr/bin/env python3
"""Generate icons, favicon, og-image, and manifest from the site's design tokens.

Design matches style.css: bg #09090b, accent #34d399, text #fafafa, emerald star.
Re-run any time the brand changes.
"""
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "icons"
SEGOE_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
SEGOE_SEMI = r"C:\Windows\Fonts\seguisb.ttf"

BG = (9, 9, 11)
ACCENT = (52, 211, 153)
TEXT = (250, 250, 250)
MUTED = (161, 161, 170)
RADIUS = 0.22  # corner radius as fraction of size


def star_points(cx, cy, R, n=5):
    r = R * 0.381966  # inner radius for a regular 5-point star
    pts = []
    for i in range(2 * n):
        ang = -math.pi / 2 + i * math.pi / n
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def render_square(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * RADIUS), fill=BG)
    d.polygon(star_points(size / 2, size / 2, size * 0.3), fill=ACCENT)
    return img


def render_og():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # accent star, top-left area
    star_r = 150
    d.polygon(star_points(210, 235, star_r), fill=ACCENT)
    # title + subtitle
    title = ImageFont.truetype(SEGOE_BOLD, 88)
    sub = ImageFont.truetype(SEGOE_SEMI, 40)
    # count comes from current data
    import json as _json
    data = _json.load(open(ROOT / "repos_output.json", encoding="utf-8"))
    count = data.get("total_repos", 0)
    title_txt = "STARRED REPOS"
    sub_txt = f"{count} curated GitHub repositories — auto-updated daily"
    d.text((420, 185), title_txt, font=title, fill=TEXT)
    d.text((420, 310), sub_txt, font=sub, fill=MUTED)
    return img


MANIFEST = {
    "name": "Starred Repos — Akash Priyadarshi",
    "short_name": "Starred Repos",
    "description": "Curated GitHub starred repositories by Akash Priyadarshi, organized by topic and auto-updated daily.",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#09090b",
    "theme_color": "#09090b",
    "icons": [
        {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
    ],
}


def main():
    ICONS.mkdir(exist_ok=True)
    render_square(192).save(ICONS / "icon-192.png")
    render_square(512).save(ICONS / "icon-512.png")
    # favicon: multi-size ICO
    icon = render_square(64)
    icon.save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    render_og().save(ICONS / "og-image.png")
    (ROOT / "manifest.webmanifest").write_text(
        json.dumps(MANIFEST, indent=2), encoding="utf-8"
    )

    # self-check
    from PIL import Image as I
    for p in [ICONS / "icon-192.png", ICONS / "icon-512.png", ICONS / "og-image.png"]:
        im = I.open(p)
        want = (1200, 630) if p.name == "og-image.png" else (im.size[0], im.size[0])
        assert im.size == want, f"{p.name}: {im.size} != {want}"
        print(f"{p.name}: {im.size}, {p.stat().st_size // 1024}KB")
    ico = I.open(ROOT / "favicon.ico")
    assert ico.format == "ICO"
    print(f"favicon.ico: {ico.size}, {len(ico.info.get('sizes', []))} sizes")
    print("manifest.webmanifest written")


if __name__ == "__main__":
    main()
