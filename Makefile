preview:
	python3 -m http.server 4173

sync-sidebar:
	python3 .agent/skills/blog/gen_sidebar.py

publish:
	./.agent/skills/blog/deploy-blog.sh
