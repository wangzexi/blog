# macOS Chrome HTML -> iOS RN

这个文档记录当前项目验证过的渲染对经验。

## Renderer Pair

目标是用 macOS 上的 Chrome/Playwright 无头截图渲染 `pages/app.html`，逼近 iOS 模拟器中 RN/React Native 页面的截图。

这不是通用 HTML 与 React Native 的误差结论，而是这个具体 pair：

- HTML 端：macOS Chrome / Playwright / 系统字体。
- 源端：iOS 模拟器 / RN / React Native / CoreText。
- 当前画布：`1179 x 2556`。
- 内容口径 mask：状态栏、RN 调试浮层、home indicator 等非页面区域用同色 fill 掉，不裁剪。

macOS Chrome、Linux Chrome、Safari、Android RN 的结论不能直接复用。换系统、Chrome 版本、iOS 版本、系统字体版本后，要重新校准。

## 先验

- 主要上限来自文字字形边缘和 CoreText/Chrome 栅格差异，不是明显盒模型错位。
- 先修 section 级 0.3px-1px 的 y 对齐，再处理文字。大面积 y 偏差会伪装成“整页字体都不对”。
- 字体来源必须显式指定。根字体可优先测试 `PingFangSC-Regular`，它在本 pair 中比只写 `PingFang SC` 更接近。
- 不要默认加 `-webkit-font-smoothing: antialiased`。它会让 Chrome 字体偏细，通常变差。
- `font-weight` 很多时候不响应；如果 `600/700/800/900` 指标完全一样，不要继续追 weight。
- 数字或英文不一定应该单独换字体。本轮把混排数字包成 span 并强行使用 Arial/System/Helvetica 明显变差。
- 局部字体栈可以按节点验证。本轮有效例子包括餐厅名使用 Arial 栈，部分单字块使用系统栈。
- 文字 `scaleX/scaleY` 只作为极限阶段 0.5%-1% 的微调，必须单项验证再组合验证。
- 颜色搜索以 MAE 为主时，要警惕 strong 降但 MAE 升的阈值投机。

## 推荐搜索顺序

1. 正常 BFS 单节点 probe，先把盒模型和文字基本对齐。
2. 全局 diff cluster 归因，找最大贡献节点。
3. 先检查 section 级 `translateY`、margin、height、padding。
4. 检查根字体和关键节点字体栈。
5. 对高贡献文字节点小范围搜索 `font-size`、`line-height`、`letter-spacing`。
6. 如果 weight 不响应，停止 weight 搜索。
7. 接近极限后再尝试文字 `scaleX/scaleY`。
8. 最后做颜色小步搜索，但只保留 MAE 和 strong 都合理的候选。
9. 补偿拟合只做探针量化，不混入正常结果。

## 已验证结论

本轮真实题目实践的正常蒸馏结果：

- 内容口径：`MAE ~= 3.52`，`strong ~= 104k`。
- 旧口径因为包含非页面区域，数值更高，只用于历史可比。

已覆盖的正常搜索：

- 全局坐标和 scale。
- `deviceScaleFactor=3` 截图。
- 主要盒模型尺寸和圆角。
- section 级亚像素 y。
- 文本字号、字距、行高、weight。
- 字体族和 PostScript 字体名。
- 局部颜色。
- 文本 `scaleX/scaleY`。
- 主要色块颜色。

无效或收益很小的方向：

- `393 CSS px + deviceScaleFactor 3 + scale(1/3)` 截图没有改善。
- `text-rendering: geometricPrecision` 和 `-webkit-font-smoothing: antialiased` 明显变差。
- 全局 filter、brightness、contrast 是阈值投机，MAE 变差。
- 手动拆行不一定更好；本轮 hero 标题自然换行更优。

补偿拟合探针：

- `text-shadow`、`-webkit-text-stroke`、opacity、filter 都单独量化过。
- 最好 MAE 约 `3.50`，仍然达不到 `3.0`。
- 这些属于补偿拟合，不算正常蒸馏。

## 上限判断

在相同 macOS Chrome HTML -> iOS RN 条件下，如果已经完成上述搜索，且剩余 cluster 主要集中在文字抗锯齿和字形边缘，可以把 `MAE ~= 3.52` 视为当前页面的正常蒸馏上限基准。

要继续接近 `3.0`，需要换策略：

- 允许文字补偿拟合。
- 按 glyph 做局部覆盖。
- 换更接近 RN/CoreText 的渲染承载。
