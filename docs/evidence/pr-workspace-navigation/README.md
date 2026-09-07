# 主工作台导航验收证据

来源：`CAPTURE_NAV_EVIDENCE=1 CI=1 npm run test:e2e`，最终冻结源码的 68 项用例一次通过，无重试。8 张图由真实浏览器生成，不是设计稿；桌面1440×1000、手机390×844。仅使用全新测试浏览器项目与内置配置，不包含用户数据或密钥。

| 页面 | 桌面 | 手机 |
|---|---|---|
| 评测任务 / 运行记录 | [查看](result-desktop.png) | [查看](result-mobile.png) |
| 评测集 / 数据工作区 | [查看](dataset-desktop.png) | [查看](dataset-mobile.png) |
| 评测对象 / 对象与接口 | [查看](access-desktop.png) | [查看](access-mobile.png) |
| 管理中心 / 外部接入 | [查看](integrations-desktop.png) | [查看](integrations-mobile.png) |

测试直接通过真实页面的链接、按钮与浏览器返回导航操作，校验草稿保留、旧导入链接、不自动调用模型、缺失批次提示、h1唯一与axe。初轮失败包括图标按钮缺少可访问名称、旧导航测试假设、快速刷新保存窗口以及空状态低对比度，均修复后重新跑完整门禁；失败产物不计为通过证据。

该节点不是整站 Langfuse Fork，也没有实现 PRD 中尚缺的版本化 Dataset/RunSpec/Baseline。详情见 [规格](../../features/F-UI-001/spec.md)。
