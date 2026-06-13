# Zexi's Blog

> 有价值的未必是我的结论，而是它们带给你思考的扰动。

## 阅读建议

每篇文章的 `README.md`，是我预先整理好的一条线性阅读路径，是一份默认视角下的“预制菜”。

文章文件夹内还会有一些“食材原料”，比如写作过程中的草稿、参考资料等。

推荐你用 AI 工具打开本文件夹，先读主线，再带着被启发出的问题，让 AI 基于整个文件夹为你“现炒”。通常会比“帮我总结全文”更有价值。

## 本地调试（强烈推荐）

先改完本地看效果，不要每次都等部署。

```bash
# 1）启动本地站点
cd /Users/zexi/workspace/wangzexi/blog
./scripts/dev.sh

# 或自定义端口
./scripts/dev.sh 4174

# 2）本地访问
open http://127.0.0.1:4173/
```

### 用 agent-browser 看实际渲染（可选）

```bash
cd /Users/zexi/workspace/wangzexi/notes/技能/agent-browser  # 或你本地 agent-browser 脚本目录
scripts/ab-open http://127.0.0.1:4173
# 然后用 run-page-js 检查样式:
scripts/run-page-js.sh --page-url http://127.0.0.1:4173 --js-file <你的脚本>
```

本地核验通过后，再推到 `main` 触发线上部署。

