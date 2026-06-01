#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

from measure import (
    collect_mask,
    delta_payload,
    overlap_payload,
    suggest_payload,
)


def add_suggestion(items: list[dict[str, object]], action: str, reason: str, confidence: float) -> None:
    items.append({"action": action, "reason": reason, "confidence": round(confidence, 2)})


def density(area: int, width: int, height: int) -> float:
    box_area = max(1, width * height)
    return area / box_area


def build_suggestions(
    delta: dict[str, float | int],
    overlap: dict[str, float | int],
    suggestion: dict[str, float],
    target_metrics: dict[str, float],
    candidate_metrics: dict[str, float],
) -> list[dict[str, object]]:
    dx = float(delta["dx"])
    dy = float(delta["dy"])
    dw = int(delta["dw"])
    dh = int(delta["dh"])
    area_delta = int(delta["area"])
    xor_ratio = float(overlap["xorRatio"])
    iou = float(overlap["iou"])
    density_delta = candidate_metrics["density"] - target_metrics["density"]
    suggestions: list[dict[str, object]] = []

    if abs(dx) >= 0.5 or abs(dy) >= 0.5:
        if abs(dx) <= 1 and abs(dy) <= 1 and abs(dw) <= 1 and abs(dh) <= 1:
            parts = []
            if abs(dx) >= 0.5:
                parts.append(f"translateX {suggestion['translateX']}px")
            if abs(dy) >= 0.5:
                parts.append(f"translateY {suggestion['translateY']}px")
            add_suggestion(
                suggestions,
                ", ".join(parts),
                "only a subpixel text offset remains; transform is acceptable as the final small correction",
                0.78,
            )
        else:
            add_suggestion(
                suggestions,
                "align the text container first: inspect parent padding, alignItems, margin, line-height, and block/inline layout before using transform",
                "text bbox center is offset beyond final-correction range",
                0.82,
            )

    mixed_size_signal = (dw > 0 and dh < 0) or (dw < 0 and dh > 0)
    if mixed_size_signal:
        add_suggestion(
            suggestions,
            "avoid font-size as the first move; try position/weight/font stack, then validate global diff",
            "width and height imply opposite font-size directions",
            0.7,
        )
    else:
        if dw < 0:
            add_suggestion(
                suggestions,
                "increase font-size by 0.05px to 0.2px, or slightly increase letter-spacing",
                "candidate text bbox is narrower than target",
                0.72,
            )
        elif dw > 0:
            add_suggestion(
                suggestions,
                "decrease font-size by 0.05px to 0.2px, or slightly reduce letter-spacing",
                "candidate text bbox is wider than target",
                0.72,
            )

        if dh < 0:
            add_suggestion(
                suggestions,
                "increase font-size slightly before changing line-height",
                "candidate text bbox is shorter than target",
                0.68,
            )
        elif dh > 0:
            add_suggestion(
                suggestions,
                "decrease font-size slightly; use line-height only if vertical placement changes",
                "candidate text bbox is taller than target",
                0.68,
            )

    if abs(dw) <= 1 and abs(dh) <= 1 and abs(dx) <= 1 and abs(dy) <= 1:
        if area_delta < -max(80, target_metrics["area"] * 0.04):
            add_suggestion(
                suggestions,
                "try font-weight +100, a closer font stack, or a very small text-shadow/stroke; keep bbox stable",
                "bbox is close but candidate has fewer magenta pixels",
                0.55,
            )
        elif area_delta > max(80, target_metrics["area"] * 0.04):
            add_suggestion(
                suggestions,
                "try font-weight -100 or reduce font-size by 0.05px; keep bbox stable",
                "bbox is close but candidate has more magenta pixels",
                0.55,
            )
        elif xor_ratio > 0.2:
            add_suggestion(
                suggestions,
                "treat remaining XOR as font rasterization/antialiasing unless global diff improves",
                "bbox and area are close but pixel overlap is still noisy",
                0.7,
            )

    if iou < 0.4 and abs(dx) <= 1 and abs(dy) <= 1:
        add_suggestion(
            suggestions,
            "do not chase XOR blindly; compare global panel diff after one small font-size/position experiment",
            "low text IoU with aligned centers often comes from glyph rasterization",
            0.72,
        )

    if not suggestions:
        add_suggestion(
            suggestions,
            "stop text tuning or run a single global-diff validation",
            "no strong directional signal",
            0.6,
        )

    return suggestions


def core_payload(
    delta: dict[str, float | int],
    overlap: dict[str, float | int],
    target_metrics: dict[str, float],
    candidate_metrics: dict[str, float],
) -> dict[str, object]:
    return {
        "delta": {
            "dx": delta["dx"],
            "dy": delta["dy"],
            "dw": delta["dw"],
            "dh": delta["dh"],
        },
        "ink": {
            "areaDelta": delta["area"],
            "densityDelta": round(candidate_metrics["density"] - target_metrics["density"], 6),
        },
        "overlap": {
            "iou": overlap["iou"],
            "xor": overlap["xor"],
        },
    }


def format_suggestions(suggestions: list[dict[str, object]]) -> str:
    if not suggestions:
        return "- none"

    lines = []
    for index, item in enumerate(suggestions, start=1):
        lines.append(f"{index}. {item['action']}")
        lines.append(f"   reason: {item['reason']}")
        lines.append(f"   confidence: {item['confidence']}")
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check-text.py <target-rn-mask.png> <candidate-html-mask.png>", file=sys.stderr)
        return 2

    target_path = Path(sys.argv[1])
    candidate_path = Path(sys.argv[2])
    target = Image.open(target_path).convert("RGBA")
    candidate = Image.open(candidate_path).convert("RGBA")
    target_box, target_mask = collect_mask(target)
    candidate_box, candidate_mask = collect_mask(candidate)
    if target_box is None or candidate_box is None:
        raise RuntimeError("no soft magenta mask component found")

    delta = delta_payload(target_box, candidate_box)
    suggestion = suggest_payload(target_box, candidate_box)
    overlap = overlap_payload(target_mask, candidate_mask)
    target_metrics = {
        "area": target_box.area,
        "density": density(target_box.area, target_box.width, target_box.height),
    }
    candidate_metrics = {
        "area": candidate_box.area,
        "density": density(candidate_box.area, candidate_box.width, candidate_box.height),
    }
    core = core_payload(delta, overlap, target_metrics, candidate_metrics)
    suggestions = build_suggestions(delta, overlap, suggestion, target_metrics, candidate_metrics)
    print(
        "\n".join(
            [
                "CHECK text",
                "",
                "core:",
                f"- delta: dx={core['delta']['dx']}, dy={core['delta']['dy']}, dw={core['delta']['dw']}, dh={core['delta']['dh']}",
                f"- ink: areaDelta={core['ink']['areaDelta']}, densityDelta={core['ink']['densityDelta']}",
                f"- overlap: iou={core['overlap']['iou']}, xor={core['overlap']['xor']}",
                "",
                "suggestions:",
                format_suggestions(suggestions),
                "",
                "validation:",
                "- treat this as a local probe candidate only",
                "- restore true colors and run global diff before keeping the change",
            ]
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
