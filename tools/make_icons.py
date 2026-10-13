"""Generate every app icon from one definition.

    python tools/make_icons.py

Writes into ``app/assets/images``:

    icon.png                     1024  full-bleed, for iOS / store listings
    favicon.png                   180  rounded corners, transparent outside
    splash-icon.png               512  the mark alone, transparent
    android-icon-foreground.png   512  mark only, inside the adaptive safe zone
    android-icon-background.png   512  full-bleed gradient
    android-icon-monochrome.png   432  pure white silhouette, transparent

Run it again after changing the colours or the glyph geometry. Pillow is needed
only by this script (``pip install Pillow``); it is not an API dependency.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import NamedTuple

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "assets" / "images"

# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------
TOP = (167, 139, 255)  # #A78BFF
BOTTOM = (75, 36, 217)  # #4B24D9
MARK = (255, 255, 255)

SUPERSAMPLE = 4

# ---------------------------------------------------------------------------
# Glyph geometry, in a 0..1 canvas: a pair of beamed eighth notes.
# ---------------------------------------------------------------------------
HEAD_RX = 0.112  # note head half-width
HEAD_RY = 0.086  # note head half-height
HEAD_TILT = -21  # degrees; real engraving tilts note heads

LEFT_HEAD = (0.395, 0.668)
RIGHT_HEAD = (0.700, 0.612)

STEM_W = 0.043
LEFT_STEM_TOP = 0.243
RIGHT_STEM_TOP = 0.188

BEAM_THICKNESS = 0.060


def rotated_half_extents() -> tuple[float, float]:
    """Bounds of a tilted ellipse (a tilted head sticks out further)."""
    angle = math.radians(abs(HEAD_TILT))
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    half_w = math.hypot(HEAD_RX * cos_a, HEAD_RY * sin_a)
    half_h = math.hypot(HEAD_RX * sin_a, HEAD_RY * cos_a)
    return half_w, half_h


class Glyph(NamedTuple):
    left: tuple[float, float]
    right: tuple[float, float]
    beam: list[tuple[float, float]]

    def beam_top_at(self, x: float) -> float:
        """Y of the beam's top edge at `x`, so stems can meet it flush.

        Derived from the beam's own (already centred) corners so the result is
        always in the same coordinate space as the caller.
        """
        x_left, y_left = self.beam[0]
        x_right, y_right = self.beam[1]
        slope = (y_right - y_left) / (x_right - x_left)
        return y_left + slope * (x - x_left)

    def stem_bottom(self, head: tuple[float, float]) -> float:
        """Y of the widest point of a tilted head — where its stem should stop.

        A head tilted anticlockwise is higher on its right side, so stopping the
        stem at the head's centre would leave its bottom-right corner poking out.
        """
        return head[1] + HEAD_RX * math.sin(math.radians(HEAD_TILT))


def glyph_geometry() -> Glyph:
    """The glyph, shifted so its bounding box is centred on (0.5, 0.5)."""
    left_x, left_y = LEFT_HEAD
    right_x, right_y = RIGHT_HEAD

    left_stem_x0 = left_x + HEAD_RX - STEM_W
    right_stem_x1 = right_x + HEAD_RX

    beam = [
        (left_stem_x0, LEFT_STEM_TOP),
        (right_stem_x1, RIGHT_STEM_TOP),
        (right_stem_x1, RIGHT_STEM_TOP + BEAM_THICKNESS),
        (left_stem_x0, LEFT_STEM_TOP + BEAM_THICKNESS),
    ]

    half_w, half_h = rotated_half_extents()
    xs = [left_x - half_w, left_x + half_w, right_x - half_w, right_x + half_w] + [
        p[0] for p in beam
    ]
    ys = [left_y - half_h, left_y + half_h, right_y - half_h, right_y + half_h] + [
        p[1] for p in beam
    ]

    dx = 0.5 - (min(xs) + max(xs)) / 2
    dy = 0.5 - (min(ys) + max(ys)) / 2

    return Glyph(
        left=(left_x + dx, left_y + dy),
        right=(right_x + dx, right_y + dy),
        beam=[(x + dx, y + dy) for x, y in beam],
    )


def _mark_layer(size: int, scale: float, colour) -> Image.Image:
    """Render the glyph at `size`, supersampled then downscaled for smooth edges."""
    big = size * SUPERSAMPLE
    layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    glyph = glyph_geometry()

    def to_px(x: float, y: float) -> tuple[float, float]:
        return (
            big / 2 + (x - 0.5) * big * scale,
            big / 2 + (y - 0.5) * big * scale,
        )

    # --- note heads: draw upright on a tile, rotate, then stamp -------------
    head_w = HEAD_RX * 2 * big * scale
    head_h = HEAD_RY * 2 * big * scale
    pad = int(max(head_w, head_h)) + 8
    for head in (glyph.left, glyph.right):
        tile = Image.new("RGBA", (pad * 2, pad * 2), (0, 0, 0, 0))
        ImageDraw.Draw(tile).ellipse(
            (pad - head_w / 2, pad - head_h / 2, pad + head_w / 2, pad + head_h / 2),
            fill=colour,
        )
        tile = tile.rotate(HEAD_TILT, resample=Image.BICUBIC, center=(pad, pad))
        x, y = to_px(*head)
        layer.alpha_composite(tile, (int(x - pad), int(y - pad)))

    # --- stems: top flush with the beam, bottom inside the head ------------
    # The beam's top edge slopes, so a stem only avoids poking through it when
    # its top matches the beam height at the stem's *left* edge (the lowest point
    # across the stem's width).
    for head in (glyph.left, glyph.right):
        right_edge_x = head[0] + HEAD_RX
        stem_left_x = right_edge_x - STEM_W
        x0, y0 = to_px(stem_left_x, glyph.beam_top_at(stem_left_x))
        x1, y1 = to_px(right_edge_x, glyph.stem_bottom(head))
        draw.rectangle((x0, y0, x1, y1), fill=colour)

    # --- beam -------------------------------------------------------------
    draw.polygon([to_px(x, y) for x, y in glyph.beam], fill=colour)

    return layer.resize((size, size), Image.LANCZOS)


def _gradient(size: int) -> Image.Image:
    """Diagonal TOP -> BOTTOM gradient, built small then upscaled smoothly."""
    steps = 64
    small = Image.new("RGB", (steps, steps))
    pixels = small.load()
    for y in range(steps):
        for x in range(steps):
            t = ((x + y) / (2 * (steps - 1))) ** 0.85
            pixels[x, y] = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
    return small.resize((size, size), Image.BICUBIC)


def _rounded_mask(size: int, radius_ratio: float = 0.22) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=int(size * radius_ratio), fill=255
    )
    return mask


def build_colour(size: int, *, rounded: bool = False, scale: float = 1.0) -> Image.Image:
    base = _gradient(size).convert("RGBA")
    base.alpha_composite(_mark_layer(size, scale, MARK))
    if rounded:
        base.putalpha(_rounded_mask(size))
    return base


def build_flat(size: int, colour, scale: float = 1.0) -> Image.Image:
    return _mark_layer(size, scale, colour)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    targets = [
        ("icon.png", lambda: build_colour(1024)),
        ("favicon.png", lambda: build_colour(180, rounded=True)),
        ("splash-icon.png", lambda: build_flat(512, MARK, 0.86)),
        ("android-icon-foreground.png", lambda: build_flat(512, MARK, 0.62)),
        ("android-icon-background.png", lambda: build_colour(512)),
        ("android-icon-monochrome.png", lambda: build_flat(432, MARK, 0.60)),
    ]

    for name, factory in targets:
        image = factory()
        path = OUT / name
        image.save(path, "PNG", optimize=True)
        print(
            f"  {name:32} {image.size[0]}x{image.size[1]}  "
            f"{path.stat().st_size / 1024:.1f} KB"
        )


if __name__ == "__main__":
    print(f"Writing icons to {OUT}")
    main()
