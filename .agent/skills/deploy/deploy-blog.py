#!/usr/bin/env python3
"""
Deploy blog content to Kubernetes.

日常发布请直接 push 到 main 分支，由 GitHub Actions 自动完成。
本脚本仅用于应急调试场景（kubectl 直连集群手动同步）。
"""
from __future__ import annotations

import io
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import time


def generate_sidebar(root: pathlib.Path) -> None:
    """Generate _sidebar.md from article directories."""
    visible_names = {
        "assets", "repos", ".github", ".agent", "node_modules",
    }

    dirs = sorted(
        (
            d for d in root.iterdir()
            if d.is_dir()
            and not d.name.startswith(".")
            and d.name not in visible_names
            and not d.name.startswith("_")
            and (d / "README.md").exists()
        ),
        key=lambda p: p.name.lower(),
    )

    lines = ["- [首页](/)"]
    for folder in dirs:
        readme = folder / "README.md"
        title = folder.name
        if readme.exists():
            with readme.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break
        link = f"{folder.name}/README.md".replace(" ", "%20")
        lines.append(f"- [{title}]({link})")

    (root / "_sidebar.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  Sidebar generated: {len(dirs)} articles")



def _blog_root() -> pathlib.Path:
    env_root = os.environ.get("BLOG_ROOT")
    if env_root:
        return pathlib.Path(env_root).resolve()

    here = pathlib.Path(__file__).resolve().parent
    for candidate in (here, *here.parents):
        if (candidate / ".git").exists():
            return candidate
    return here.parent.parent


ROOT = _blog_root()
SKILL_DIR = ROOT / ".agent" / "skills" / "deploy"
MANIFEST = pathlib.Path(os.environ.get("BLOG_MANIFEST", str(SKILL_DIR / "blog-deploy.yaml")))
KUBECTL = shutil.which(os.environ.get("KUBECTL_BIN", "kubectl"))
NAMESPACE = os.environ.get("TARGET_NAMESPACE", "blog")
POD_SELECTOR = os.environ.get("TARGET_POD_QUERY", "app=blog")
LOCAL_PATH = pathlib.Path(os.environ.get("LOCAL_BLOG_PATH", str(ROOT)))
RETRY_COUNT = 2
RETRY_DELAY = 3


def main() -> None:
    if not KUBECTL:
        print("kubectl not found. Set KUBECTL_BIN env or install kubectl.")
        sys.exit(1)

    if not MANIFEST.exists():
        print(f"Deploy manifest not found: {MANIFEST}")
        sys.exit(1)

    os.chdir(ROOT)
    print(f"  Root: {ROOT}")

    # 1. Generate sidebar
    print("  Generating sidebar...")
    generate_sidebar(ROOT)

    # 2. Apply K8s manifest
    print("  Applying manifest...")
    subprocess.run([KUBECTL, "apply", "-f", str(MANIFEST)], check=True)

    # 3. Wait for rollout
    print("  Waiting for rollout...")
    subprocess.run(
        [KUBECTL, "-n", NAMESPACE, "rollout", "status", "deploy/blog", "--timeout=120s"],
        check=True,
    )

    # 4. Find the blog pod
    result = subprocess.run(
        [KUBECTL, "-n", NAMESPACE, "get", "pod", "-l", POD_SELECTOR,
         "-o", "jsonpath={.items[0].metadata.name}"],
        capture_output=True, text=True, check=True,
    )
    pod = result.stdout.strip()
    if not pod:
        print(f"No blog pod found with selector: {POD_SELECTOR}")
        sys.exit(1)
    print(f"  Pod: {pod}")

    # 5. Sync content via tar pipe
    print("  Syncing content...")
    subprocess.run(
        [KUBECTL, "exec", "-i", "-n", NAMESPACE, pod, "--",
         "rm", "-rf", "/usr/share/nginx/html/*"],
        check=True,
    )

    for attempt in range(1, RETRY_COUNT + 1):
        print(f"  Sync attempt {attempt}...")
        try:
            _sync_via_tar(pod)
            print("  Sync succeeded")
            return
        except subprocess.CalledProcessError:
            if attempt == RETRY_COUNT:
                print("  Sync failed")
                sys.exit(1)
            time.sleep(RETRY_DELAY)


def _sync_via_tar(pod: str) -> None:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        for entry in sorted(LOCAL_PATH.iterdir()):
            if entry.name == ".git":
                continue
            tar.add(str(entry), arcname=entry.name)
    buf.seek(0)

    subprocess.run(
        [KUBECTL, "exec", "-i", "-n", NAMESPACE, pod, "--",
         "tar", "-xf", "-", "-C", "/usr/share/nginx/html"],
        input=buf.read(),
        check=True,
    )


if __name__ == "__main__":
    main()
