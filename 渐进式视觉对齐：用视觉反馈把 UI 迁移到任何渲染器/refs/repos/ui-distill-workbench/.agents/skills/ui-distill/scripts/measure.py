#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops


@dataclass
class Box:
    left: int
    top: int
    right: int
    bottom: int
    area: int

    @property
    def width(self) -> int:
        return self.right - self.left + 1

    @property
    def height(self) -> int:
        return self.bottom - self.top + 1

    @property
    def cx(self) -> float:
        return (self.left + self.right) / 2

    @property
    def cy(self) -> float:
        return (self.top + self.bottom) / 2


def is_mask_pixel(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a > 200 and r > 180 and g < 120 and b > 180


def collect_mask(image: Image.Image) -> tuple[Box | None, set[tuple[int, int]]]:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    left = width
    right = -1
    top = height
    bottom = -1
    area = 0
    mask = set()

    for y in range(height):
        for x in range(width):
            if not is_mask_pixel(pixels[x, y]):
                continue

            mask.add((x, y))
            area += 1
            left = min(left, x)
            right = max(right, x)
            top = min(top, y)
            bottom = max(bottom, y)

    if area == 0:
        return None, mask

    return Box(left, top, right, bottom, area), mask


def box_payload(box: Box) -> dict[str, float | int]:
    return box.__dict__ | {"width": box.width, "height": box.height}


def delta_payload(target_box: Box, candidate_box: Box) -> dict[str, float | int]:
    return {
        "dx": round(candidate_box.cx - target_box.cx, 2),
        "dy": round(candidate_box.cy - target_box.cy, 2),
        "dw": candidate_box.width - target_box.width,
        "dh": candidate_box.height - target_box.height,
        "area": candidate_box.area - target_box.area,
    }


def suggest_payload(target_box: Box, candidate_box: Box) -> dict[str, float]:
    return {
        "translateX": round((target_box.cx - candidate_box.cx) / 3, 3),
        "translateY": round((target_box.cy - candidate_box.cy) / 3, 3),
        "width": round((target_box.width - candidate_box.width) / 3, 3),
        "height": round((target_box.height - candidate_box.height) / 3, 3),
    }


def overlap_payload(target_mask: set[tuple[int, int]], candidate_mask: set[tuple[int, int]]) -> dict[str, float | int]:
    intersection = len(target_mask & candidate_mask)
    union = len(target_mask | candidate_mask)
    xor = len(target_mask ^ candidate_mask)

    return {
        "intersection": intersection,
        "union": union,
        "xor": xor,
        "iou": round(intersection / union, 6) if union else 1,
        "xorRatio": round(xor / union, 6) if union else 0,
    }


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: measure.py <target-ios.png> <candidate-html.png>", file=sys.stderr)
        return 2

    target_path = Path(sys.argv[1])
    candidate_path = Path(sys.argv[2])
    target = Image.open(target_path).convert("RGBA")
    candidate = Image.open(candidate_path).convert("RGBA")

    target_box, target_mask = collect_mask(target)
    candidate_box, candidate_mask = collect_mask(candidate)
    if target_box is None or candidate_box is None:
        raise RuntimeError("no soft magenta mask component found")

    diff = ImageChops.difference(target, candidate)
    nonzero_pixels = 0
    for pixel in diff.getdata():
        if pixel[:3] != (0, 0, 0):
            nonzero_pixels += 1

    result = {
        "targetSize": target.size,
        "candidateSize": candidate.size,
        "mask": {
            "color": "#FF00FF",
            "target": box_payload(target_box),
            "candidate": box_payload(candidate_box),
            "delta": delta_payload(target_box, candidate_box),
            "suggestCssPxAtDpr3": suggest_payload(target_box, candidate_box),
            "overlap": overlap_payload(target_mask, candidate_mask),
        },
        "pixelDiff": {
            "nonzeroPixels": nonzero_pixels,
            "ratio": round(nonzero_pixels / (target.size[0] * target.size[1]), 6),
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
