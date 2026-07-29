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


def build_suggestions(delta: dict[str, float | int], overlap: dict[str, float | int], suggestion: dict[str, float]) -> list[dict[str, object]]:
    dx = float(delta["dx"])
    dy = float(delta["dy"])
    dw = int(delta["dw"])
    dh = int(delta["dh"])
    xor_ratio = float(overlap["xorRatio"])
    iou = float(overlap["iou"])
    suggestions: list[dict[str, object]] = []

    if abs(dx) >= 0.5 or abs(dy) >= 0.5:
        action_parts = []
        if abs(dx) >= 0.5:
            action_parts.append(f"translateX {suggestion['translateX']}px")
        if abs(dy) >= 0.5:
            action_parts.append(f"translateY {suggestion['translateY']}px")
        add_suggestion(
            suggestions,
            ", ".join(action_parts),
            "candidate bbox center is offset from target",
            0.85 if dw == 0 and dh == 0 else 0.7,
        )

    if dw != 0 or dh != 0:
        if dw != 0:
            add_suggestion(
                suggestions,
                f"adjust width by {suggestion['width']} CSS px at DPR 3",
                "candidate bbox width differs from target",
                0.75,
            )
        if dh != 0:
            add_suggestion(
                suggestions,
                f"adjust height by {suggestion['height']} CSS px at DPR 3",
                "candidate bbox height differs from target",
                0.75,
            )
        add_suggestion(
            suggestions,
            "if size is content-driven, inspect padding, line-height, and child layout before using transform",
            "box dimensions may be produced by inner layout",
            0.62,
        )

    if dw == 0 and dh == 0 and (abs(dx) >= 0.5 or abs(dy) >= 0.5):
        add_suggestion(
            suggestions,
            "move only; do not change width or height",
            "size already matches",
            0.9,
        )

    if abs(dx) < 0.5 and abs(dy) < 0.5 and dw == 0 and dh == 0:
        if xor_ratio <= 0.001:
            add_suggestion(
                suggestions,
                "stop box tuning",
                "bbox and overlap are already effectively aligned",
                0.95,
            )
        else:
            add_suggestion(
                suggestions,
                "inspect border-radius or antialiasing; avoid moving the box first",
                "bbox is aligned but XOR remains",
                0.75,
            )

    if iou < 0.7 and (abs(dx) > 3 or abs(dy) > 3):
        add_suggestion(
            suggestions,
            "check whether ancestors/siblings were removed or hidden with display:none",
            "large offset often means layout context changed",
            0.7,
        )

    return suggestions


def core_payload(delta: dict[str, float | int], overlap: dict[str, float | int]) -> dict[str, object]:
    return {
        "delta": {
            "dx": delta["dx"],
            "dy": delta["dy"],
            "dw": delta["dw"],
            "dh": delta["dh"],
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
        print("usage: check-box.py <target-rn-mask.png> <candidate-html-mask.png>", file=sys.stderr)
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
    core = core_payload(delta, overlap)
    suggestions = build_suggestions(delta, overlap, suggestion)
    print(
        "\n".join(
            [
                "CHECK box",
                "",
                "core:",
                f"- delta: dx={core['delta']['dx']}, dy={core['delta']['dy']}, dw={core['delta']['dw']}, dh={core['delta']['dh']}",
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
