#!/usr/bin/env python3
from __future__ import annotations

import os
import pathlib


def _blog_root() -> pathlib.Path:
    env_root = os.environ.get("BLOG_ROOT")
    if env_root:
        return pathlib.Path(env_root).resolve()

    here = pathlib.Path(__file__).resolve().parent
    for candidate in (here, *here.parents):
        if (candidate / ".git").exists():
            return candidate
    # Fallback to repo-level parent of skills dir if .git is unavailable.
    return here.parent.parent


ROOT = _blog_root()
TARGET = ROOT / "_sidebar.md"


def article_title(dir_path: pathlib.Path) -> str:
    readme = dir_path / "README.md"
    if not readme.exists():
        return dir_path.name
    try:
        with readme.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("# "):
                    return line[2:].strip()
    except OSError:
        return dir_path.name
    return dir_path.name


def visible_dir(path: pathlib.Path) -> bool:
    return (
        path.is_dir()
        and not path.name.startswith(".")
        and path.name not in {"assets", "repos", ".github", ".agent", "node_modules"}
        and not path.name.startswith("_")
        and (path / "README.md").exists()
    )


def main() -> int:
    dirs = sorted(
        (d for d in ROOT.iterdir() if visible_dir(d)),
        key=lambda p: p.name.lower(),
    )

    lines = ["- [首页](/)"]
    for folder in dirs:
        title = article_title(folder)
        link = f"{folder.name}/README.md".replace(" ", "%20")
        lines.append(f"- [{title}]({link})")

    TARGET.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
