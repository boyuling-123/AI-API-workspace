# F-DEMO-001 实施计划

1. Planner：核对 N10、已合并 PR51、现有三页导航和归档自动索引读取行为，避免导览承诺失真。
2. Developer：用纯章节模型生成页面与 Markdown；复用现有 Link、Ant Design Button/ConfigProvider 和中文蓝色工具主题；提取轻量共享导航，不重绘整站。
3. Tester：真实模型函数单测、下载与路由用户路径、入口无默认调用、归档隐私/错误/恢复、键盘/390px/axe/截图，完整质量门禁。
4. 发布：来源与边界、产品讲解 MD、矩阵/台账/纪实/下一 Ready 更新；正常 commit/push/PR，最终 head CI 通过后合并。

UI/UX Skill 的内容优先/清晰层级/可访问性建议适用；其通用自然风格、繁体 Web 字体与 React Native 模板不适合本项目，明确保留既有 Next/React、简体中文、Ant Design 6.6.2 和本机字体，不下载外部字体或引入新组件库。
