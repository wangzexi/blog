---
name: ui-distill
description: 渐进式 UI 蒸馏：把运行中的 RN/React Native 页面按固定画布截图，用单节点品红探针逐层测量，把布局、盒子和文字收敛到 HTML。
---

# UI Distill

这个技能用于把源页面 `../rn-new/src/App.tsx` 蒸馏到 HTML 目标页 `pages/app.html`。

`ui-distill-workbench` 是蒸馏工程。`../rn-new` 只是当前源页面夹具，以后可以换成任何能热更新并截图的源工程。

## 文件

- 源页面：`../rn-new/src/App.tsx`
- 预览入口：`index.html`
- HTML 目标页：`pages/app.html`
- 完整手册：`references/distill-guide.md`
- 子代理单节点微调手册：`references/worker-node-tuning.md`
- 渲染对经验库：`references/render-pairs/`
- HTML 无头截图：`scripts/capture-html.mjs`
- 底层品红测量：`scripts/measure.py`
- 盒模型 checker：`scripts/check-box.py`
- 字体 checker：`scripts/check-text.py`

## 渲染对经验库

通用流程解决“怎么蒸馏”，渲染对经验库解决“这个源渲染器和目标渲染器之间有什么特殊误差”。

开始任务时先识别当前 renderer pair，并加载对应文档：

- `macOS Chrome HTML -> iOS RN`：`references/render-pairs/macos-chrome-to-ios-rn.md`

如果没有匹配文档，就只用通用流程，并把本次稳定复现的经验沉淀为新的 render pair 文档。

## 核心流程

不要靠肉眼整体调页面。每次只测一个节点。

1. 先把源页面直接转写成 HTML 初稿。
2. 转写时给关键结构节点加 `<!-- distill: ... -->` 注释。
3. 显式指定字体栈，不依赖浏览器默认字体。
4. 启动源工程，并保持热更新可用。
5. 按广度优先 BFS 从最外层开始选择当前节点：先父级，再同层兄弟，再进入下一层子节点。
6. 当前节点在源端和 HTML 端都涂成固定品红 `#FF00FF`。
7. 非目标视觉不参与品红测量，但默认保留布局树，用透明度或透明颜色隐藏。
8. 等源端热更新 3 秒。
9. 截源端，截 HTML。
10. 盒模型用 `check-box.py`，文字用 `check-text.py`。
11. 只修改 HTML 当前节点相关参数。
12. 当前节点收敛后恢复真色，重新计算全局 diff。
13. 只有真色全局 diff 下降，才保留该节点改动；否则回滚到当前节点前。
14. 进入下一个 BFS 节点。
15. 全节点完成后，进入全局 loss 巡检，按最大误差 cluster 做误差驱动迭代。

## 转写约定

HTML 初稿给关键结构节点加 `<!-- distill: ... -->` 注释。注释来自源端结构语义，不来自临时视觉位置。

```html
<!-- distill: hero -->
<section class="hero">
  <h1 class="hero-title">RN 到 HTML 对齐</h1>
  <p class="hero-subtitle">...</p>
</section>
```

- 注释要稳定：优先用源端结构语义，例如 `hero`、`order-card`、`restaurant-0`。
- 注释只放关键结构节点，不要给每个叶子文本都加标记。
- 重复结构用 index 或业务含义区分，例如 `restaurant-0`、`restaurant-1`。
- 派单到叶子节点时，用注释上下文 + class/text 描述，例如 `hero > .hero-title`。
- CSS 不依赖注释。
- `data-distill` 是可选降级方案，只在后续脚本必须自动 `elementFromPoint().closest(...)` 归因时少量使用；默认不要铺满 DOM。
- 字体栈必须显式指定；如果 checker 提示像字体 fallback 差异，先检查字体来源，再继续改字号或 weight。

## 探针收敛

当前节点探针收敛时：

1. 主代理设置源端和 HTML 端品红。
2. 修改 RN 探针后等待 3 秒，让热更新生效。
3. HTML 截图不依赖热更新，但同一轮也在等待后执行，保持流程一致。
4. worker 先读 checker 的核心数值和建议，再决定下一步。
5. 每次实验只保留 probe checker 更好的局部候选；变差就回滚。
6. worker 连续两次没有改善，就回到当前最好结果并停止。
7. 当前节点完成后，立即恢复真色并跑全局 diff。
8. 如果真色全局 diff 变差，回滚当前节点候选，再处理下一个节点。

暂不做双帧稳定检测。后续如果页面有动画、异步数据或字体加载抖动，再升级截图稳定检测。

checker 的建议不是必须执行的命令。checker 只根据当前两张 probe 截图给局部启发，可能因为 probe 污染、祖先/兄弟透明规则错误、字体 fallback、渲染器差异或全局布局上下文而给出不适合的方向。

执行前必须先判断：

- probe 是否正确：目标唯一品红，祖先保留，兄弟和子级透明。
- 核心数值是否支持该建议。
- 建议是否会破坏父子布局、兄弟布局或全局 diff。
- 是否存在更符合结构的改法，例如先修容器而不是直接 transform。

当建议和结构判断冲突时，优先相信结构判断和全局 diff，并在汇报里说明为什么没有执行 checker 建议。

局部 checker 是“候选生成器”，不是最终验收器。盒模型或文字 probe 中的 XOR、IoU、bbox 变好，只说明该隔离状态下更像；恢复真色后，真实颜色、抗锯齿、阴影、相邻节点和父级裁剪可能让全局 loss 反而变差。每个节点必须经过“恢复真色 -> 全局 diff”验收，负收益直接回滚。

## 文本节点

文本节点不要一开始就靠 `transform` 对齐。

推荐顺序：

1. 先确认文本的祖先和布局容器都存在，并且没有被 `opacity: 0` 隐掉。
2. 先调文本节点所在的布局容器：父容器 padding、alignItems、margin、固定高度、line-height、行内/块级占位。
3. 再调文本自身排版参数：font-size、line-height、font-weight、font-family、letter-spacing。
4. 最后才用 `transform` 做亚像素级微补。

文字不要默认使用 `text-shadow`、`-webkit-text-stroke`、`filter` 这类补偿手段。它们可能降低 diff，但属于渲染补偿，不适合作为标准蒸馏路径。只有用户明确允许“补偿/拟合”时才考虑。

正常 CSS 参数优先级：

1. 字体来源：显式指定 `font-family`，先验证是否真的是源端对应字体。
2. 字体平滑：不要默认加 `-webkit-font-smoothing: antialiased`；它可能让 Chrome 字体比 React Native/CoreText 更细。先用浏览器默认字体平滑跑全局 diff。
3. 字号和行高：用 0.5px 到 1px 的小步长验证。
4. 字距：中文和数字文本都可能需要单独 `letter-spacing`，尤其是价格、标题、标签。
5. 字重：可以测试，但如果 `800 -> 900` 全局 diff 没变化，说明当前字体/浏览器字重档位不响应，不要继续追。

文本 background probe 是辅助步骤，不是最终标准。需要拆分时：

- text box probe：当前文本元素 `background: #FF00FF; color: transparent;`，用来确认文本布局占位和锚点。
- text glyph probe：恢复背景，文字 `color: #FF00FF`，用来对齐最终字形。

不同渲染器的文本 background 容器不保证完全一致；它只用于分离“布局容器错位”和“字形渲染差异”。最终验收仍以 glyph probe 和全局 diff 为准。

只有当文本 bbox 已接近，例如 `abs(dx) <= 1`、`abs(dy) <= 1`、`abs(dw) <= 1`、`abs(dh) <= 1` 时，才允许用 `transform` 作为最后补偿。更大的偏差必须优先回到容器、line-height、padding、font 参数排查。

## 坐标规则

- 默认不要删除节点；除非明确测空壳尺寸，否则保留完整布局树。
- 兄弟节点和子节点优先隐藏视觉，不要 `display: none`。
- 如果目标是子节点，不要对它的祖先直接 `opacity: 0`，否则目标也会一起不可见；改用透明背景、透明文字、透明边框。
- 页面里只能有一个可见品红目标；隐藏节点里已有的品红不会污染截图。
- 每次临时改源端后，测完要恢复或切换到下一个探针，不把探针当最终源码。

## 误差驱动迭代

完成 BFS 节点蒸馏后，进入全局 diff 巡检。这个阶段不是重新 DFS 遍历整棵树，而是按当前真实视觉误差贡献排序修复。

1. 截当前 React Native 基准图和 HTML 还原图。
2. 对两张图应用同一组 ignore mask：把非评价区域 fill 成同一种颜色，不裁剪图片。
3. 在原始坐标系里计算 diff。
4. 对明显差异像素做聚类，按差异强度或贡献度排序。
5. 取 cluster 中心点，只在 HTML 侧用 `elementFromPoint` 命中 DOM。
6. 结合命中 DOM 的 class/text 和最近的 `distill` 注释上下文，把 cluster loss 累计到对应结构节点。
7. 多个 cluster 命中同一个节点时，loss 累加。
8. 选择累计 loss 最大的节点派单。
9. 源端不要依赖 hit 能力；按注释命名、DOM class/text 和结构映射，在源代码里定位对应节点。
10. 主代理设置该节点的单节点 probe。
11. 用 checker 微调 HTML。
12. 恢复真色后重新计算全局 diff。
13. 只有当全局 panel diff 或目标元素整体 diff 下降时，才保留改动。
14. 对高贡献文字节点，可以做小范围参数搜索：每次只改一个正常 CSS 参数，按真色全局 diff 排序；单点下降后再做组合验证。
15. 如果组合收益来自多个节点，逐个落地并复测，避免一个局部收益被另一个节点抵消。
16. 接近极限时，把搜索范围从字体参数扩大到相关布局参数，例如 `margin-top`、`width`、`height`、`border-radius`。这些仍然属于正常 CSS 蒸馏。
17. `transform` 只作为最后的局部亚像素补偿；它不影响文档流，适合在 margin/line-height 已经收敛后微调单个文本块。
18. 颜色也可以作为正常 CSS 参数测试，但如果只降低 strong、同时提高 MAE，通常是阈值投机，不应保留。
19. 极限阶段先搜索 section 级 `translateY`，再搜索文字级微缩放。0.3px-1px 的 y 偏移常常比继续调字号收益更大。
20. 文字 `scaleX/scaleY` 只能作为最后 0.5%-1% 级别的微调。它属于形变补偿，必须先证明 `font-size`、`line-height`、`letter-spacing`、`font-weight`、字体栈、容器尺寸和 y 对齐都已经压不动。
21. 微缩放不要靠单点结果直接落地；先单项搜索，再组合验证，最后恢复真色跑全局 diff。组合后变差的微缩放必须丢弃。

ignore mask 示例：

```json
{
  "ignoreRects": [
    { "x": 0, "y": 0, "width": 393, "height": 64, "reason": "source debug marker" }
  ],
  "fill": "#ffffff"
}
```

使用 fill rect 而不是裁剪，是为了保持 cluster bbox、cluster center、`elementFromPoint` 和设备坐标都在同一个坐标系里。

cluster 只负责选目标，不能作为最终测量标准。真正测量仍然使用截图像素里的品红 bbox。

## 回滚分工

- worker 负责局部节点回滚：基于 `check-box.py` 或 `check-text.py`，只保留当前节点 checker 更好的小步改动。
- 主代理负责全局回滚：如果局部变好但真色全局 diff 变差，或新增高差异 cluster 远离当前节点，回滚该节点改动。
- 连续两次小步实验没有改善时，停止当前节点，不继续猜。

## 渲染上限

脚本只给数值和建议，不判断“已经不可优化”。是否接近渲染上限由 AI 结合上下文判断。

可以认为接近上限的信号：

- bbox 已经接近。
- ink area 或 density 已经接近。
- 连续两次小步实验不能降低 checker loss 或全局 diff。
- 高贡献节点周围的正常 CSS 邻域搜索已经覆盖 `font-size`、`line-height`、`letter-spacing`，没有候选能继续降低真色全局 diff。
- 误差主要在文字抗锯齿、圆角边缘、阴影渐变边缘。
- 继续调参会污染兄弟节点或整体布局。

遇到这些信号时，停止当前节点，把原因记录到汇报里，不要继续追逐单像素 XOR。

极限判断必须区分“正常蒸馏极限”和“补偿拟合极限”。正常蒸馏只使用字体、字号、字重、字距、行高、盒模型、圆角、颜色等标准参数；`text-shadow` 和描边即使能降 diff，也不算正常蒸馏结果。

实践记录：

- `font-weight` 不响应时不要继续调 weight；改用字号、字距、行高做正常收敛。
- 高贡献文字节点的局部 checker 变好后，仍然必须恢复真色跑全局 diff；真实颜色和相邻文本会改变结论。
- 当 strong 和 MAE 给出不同最优点时，先明确当前目标。如果目标是整体像素强度 loss，优先 MAE；如果目标是阈值差异面积，优先 strong。不要只为了几十个 strong 像素牺牲明显的 MAE。
- 大收益经常来自布局参数，而不只是字体参数。例如标题 `margin-top` 或按钮 `height` 的 1-3px 调整可能比继续追字号更有效。
- 不要假设手动拆行一定更接近源端。先用临时版本验证；如果自然换行的整体 diff 更低，保留自然文本流，不要为了单行可调性破坏行距和字形关系。
- 大量剩余差异看起来像文字抗锯齿时，不要马上判定为字体上限。先检查高层 section 是否存在 0.3px-1px 的整体 y 误差；这种误差会在多个文字 cluster 上表现为“全页面字体都不对”。
- 最后阶段可以做小范围枚举搜索，但必须保留两个口径：原始可比口径和内容口径。内容口径应 mask 掉源端状态栏、调试浮层、home indicator 等非页面区域，而不是裁剪图片。
- 字体颜色小步搜索容易出现 strong 降、MAE 升的阈值投机。除非当前明确优化 strong 面积，否则优先保留 strong 和 MAE 同时下降的候选。
- 补偿拟合要和正常蒸馏分开记录。`text-shadow`、描边、opacity、filter 可能压低某些指标，但如果 MAE 没明显下降，或视觉变成“把错误变淡”，不要把它混入正常结果。

## 执行策略

默认使用“主代理编排 mask，worker 单节点微调”。

- 主代理维护节点清单，决定当前节点，设置源端和 HTML 端的 mask 状态。
- 主代理确认截图里只有一个可见品红目标后，再派 worker。
- worker 只读 `references/worker-node-tuning.md` 和当前任务输入，只负责当前节点的盒模型或文字微调。
- worker 不决定下一个节点，不扩大范围，不改源端探针。
- worker 完成后，主代理验收 checker 的核心指标、建议和全局 diff，再决定进入下一个节点。

如果让 worker 独占整页，必须给硬性节点清单和汇总格式；否则容易提前停在“框架已对齐”。

## 常用命令

启动 HTML 预览：

```bash
npm run dev
```

截图 HTML 页面：

```bash
node .agents/skills/ui-distill/scripts/capture-html.mjs \
  --page pages/app.html \
  --width 1179 \
  --height 2556 \
  --output .tmp/app.png
```

截图 iOS 模拟器源页面：

```bash
cd ../rn-new
xcrun simctl io booted screenshot .tmp/rn-current.png
```

底层品红测量：

```bash
python3 .agents/skills/ui-distill/scripts/measure.py <rn-mask.png> <html-mask.png>
```

盒模型 checker：

```bash
python3 .agents/skills/ui-distill/scripts/check-box.py <rn-mask.png> <html-mask.png>
```

字体 checker：

```bash
python3 .agents/skills/ui-distill/scripts/check-text.py <rn-mask.png> <html-mask.png>
```

## 停止条件

遇到以下情况先停下，不要继续猜：

- 源端截图不是当前源文件。
- HTML 截图不是当前 `pages/app.html`。
- 任一截图不是 `1179 x 2556`。
- 截图里有多个可见品红区域。
- checker 的 bbox 明显来自污染区域或旧截图。
- 连续两次小步调参都让误差变差。
