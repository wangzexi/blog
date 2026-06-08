# 日常发布请直接 push 到 main，由 GitHub Actions 自动完成。
# 以下命令仅供本地调试或应急场景使用。

preview:
	./.agent/skills/blog/dev-preview.sh

sync-sidebar:
	python3 .agent/skills/blog/gen_sidebar.py

publish:
	@echo "日常发布请 push 到 main 分支，GitHub Actions 会自动部署。"
	@echo "如需应急手动同步，请直接运行：sh .agent/skills/blog/deploy-blog.sh"
	./.agent/skills/blog/deploy-blog.sh
