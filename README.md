# Zexi's Blog

> 有价值的未必是我的结论，而是它们带给你思考的扰动。

## 阅读建议

每篇文章的 `README.md`，是我预先整理好的一条线性阅读路径，是一份默认视角下的“预制菜”。

文章文件夹内还会有一些“食材原料”，比如写作过程中的草稿、参考资料等。

推荐你用 AI 工具打开本文件夹，先读主线，再带着被启发出的问题，让 AI 基于整个文件夹为你“现炒”。通常会比“帮我总结全文”更有价值。

## 本地预览

直接启动静态服务即可预览：

```bash
make preview
```

服务会监听 `4173` 端口，访问 `http://localhost:4173/` 即可查看。

## 发布到 `blog.zexi.me`

仓库 `wangzexi/zexi-me` 里的 `services/blog.yaml` 定义了一个 Nginx + git clone 的最小部署，入口域名是 `blog.zexi.me`。执行：

```bash
cd /path/to/wangzexi/zexi-me/services
./deploy-blog.sh
```

即可在集群里创建 `blog` 命名空间、创建 Deployment/Service/Ingress。
