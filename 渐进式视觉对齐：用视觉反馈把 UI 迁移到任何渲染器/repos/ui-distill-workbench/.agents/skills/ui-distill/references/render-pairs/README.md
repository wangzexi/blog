# 渲染对经验库

这里记录特定 renderer pair 的经验。

通用 `ui-distill` 流程保持不变：转写、BFS 单节点探针、checker、恢复真色全局 diff、cluster loss 巡检。渲染对文档只记录某一组源端和目标端之间的特殊先验。

## 已有文档

- `macos-chrome-to-ios-rn.md`：macOS Chrome/Playwright HTML 截图对 iOS 模拟器 RN/React Native 截图。

## 何时新增

当以下任一条件变化时，应新增或复核渲染对文档：

- HTML 截图环境变化，例如 macOS Chrome 换成 Linux Chrome、Safari、WebView。
- 源端渲染环境变化，例如 iOS RN 换成 Android RN、Flutter、原生 UIKit。
- Chrome、iOS、系统字体或截图方式升级后，原有经验不再稳定。

## 文档内容

每份渲染对文档至少记录：

- renderer pair 的定义。
- 截图坐标、DPR、mask、字体来源等环境假设。
- 高概率先验和推荐搜索顺序。
- 已验证无效或收益很小的方向。
- 正常蒸馏上限和补偿拟合上限，二者必须分开。
