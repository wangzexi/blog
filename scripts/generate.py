#!/usr/bin/env python3
"""Generate static blog content: sidebar, posts.json, home.md.

Called during Docker build and local dev (dev.sh).
"""
from __future__ import annotations

import json
import pathlib
import re
import sys


def _parse_frontmatter_date(readme: pathlib.Path, key: str) -> str:
    with readme.open("r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(rf"^{key}:\s*\"?([^\"]+)\"?", content, re.MULTILINE)
    return match.group(1).strip() if match else ""


def _article_dirs(root: pathlib.Path) -> list[pathlib.Path]:
    visible_names = {
        "assets", "repos", ".github", ".agent", "node_modules", "scripts",
    }
    return [
        d for d in root.iterdir()
        if d.is_dir()
        and not d.name.startswith(".")
        and d.name not in visible_names
        and not d.name.startswith("_")
        and (d / "README.md").exists()
    ]


def _parse_frontmatter_title(readme: pathlib.Path) -> str:
    with readme.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("# "):
                return line[2:].strip()
    return readme.parent.name


def generate_sidebar(root: pathlib.Path) -> None:
    (root / "_sidebar.md").write_text("- [首页](/)", encoding="utf-8")
    print("  _sidebar.md generated")


def generate_posts_json(root: pathlib.Path) -> list[dict]:
    dirs = _article_dirs(root)
    posts = []
    for folder in dirs:
        readme = folder / "README.md"
        title = _parse_frontmatter_title(readme)
        created_at = _parse_frontmatter_date(readme, "created_at")
        updated_at = _parse_frontmatter_date(readme, "updated_at") or created_at
        posts.append({
            "title": title,
            "path": f"{folder.name}/README.md",
            "created_at": created_at,
            "updated_at": updated_at,
        })

    posts.sort(key=lambda p: p["updated_at"], reverse=True)

    (root / "posts.json").write_text(
        json.dumps(posts, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"  posts.json generated ({len(posts)} posts)")
    return posts


def _fmt_date(date_str: str) -> str:
    return date_str[:10] if len(date_str) >= 10 else date_str


def _url_path(path: str) -> str:
    return path.replace(" ", "%20")


def _read_root_readme(root: pathlib.Path) -> str:
    """Read root README.md and return content after the first title line."""
    readme_path = root / "README.md"
    if not readme_path.exists():
        return ""
    content = readme_path.read_text(encoding="utf-8")
    # strip the first "# Title" line
    parts = content.split("\n", 1)
    return parts[1].strip() + "\n" if len(parts) > 1 else ""


def generate_home_page(root: pathlib.Path, posts: list[dict]) -> None:
    lines = ["# Zexi's Blog\n"]
    lines.append(_read_root_readme(root))

    year_groups: dict[str, list[dict]] = {}
    for p in posts:
        year = p["updated_at"][:4]
        year_groups.setdefault(year, []).append(p)

    for year in sorted(year_groups.keys(), reverse=True):
        lines.append(f"\n## {year} 年\n")
        items = year_groups[year]

        month_groups: dict[str, list[dict]] = {}
        for p in items:
            m = p["updated_at"][5:7]
            month_groups.setdefault(m, []).append(p)

        for month in sorted(month_groups.keys(), reverse=True):
            lines.append(f"\n### {int(month)} 月\n")
            for p in month_groups[month]:
                date = _fmt_date(p["updated_at"])
                link = _url_path(p["path"])
                lines.append(
                    f'- <span class="tl-date">{date}</span>  [{p["title"]}]({link})'
                )

    lines.append("")
    (root / "home.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"  home.md generated ({len(posts)} posts)")


def main() -> None:
    root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.cwd()
    print(f"Generating blog content in {root}...")
    generate_sidebar(root)
    posts = generate_posts_json(root)
    generate_home_page(root, posts)
    print("Done.")


if __name__ == "__main__":
    main()
