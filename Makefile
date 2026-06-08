preview:
	./.agent/skills/blog/dev-preview.sh

sync-sidebar:
	python3 .agent/skills/blog/gen_sidebar.py

publish:
	./.agent/skills/blog/deploy-blog.sh
