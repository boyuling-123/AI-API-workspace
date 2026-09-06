# 中文观测实验演示包

这是2026-09-07 07:38至07:39实际采集的合成工程结果，不是模型Benchmark、真实业务数据或已认证的框架执行证明。打包仅包含本说明、4份JSON、采集Manifest与2张截图，不包含源项目、配置、真实归档或Playwright Trace。

## 如何演示

1. 在已有本地平台打开 http://127.0.0.1:3002/observability 。新电脑需先克隆并按仓库README安装启动；本ZIP不是平台安装包。
2. 选择本机JSON文件，先用`manual-observations.json`预览3条调用链/14步骤，再确认加载；随后可用`langgraph-observations.json`预览2条调用链/7步骤。
3. 点击失败重试行，解释“中间失败后恢复，最终成功不能抹去错误”。查看步骤与时间，不将单次人为等待耗时当性能排名。
4. 加载文件不会执行Agent、上传、调用模型或写入项目数据库。界面必须显示“外部文件回读，来源未认证”，不能证明现场执行。
5. 再下载时会保留未认证标记。包中两个`*-reopened-unverified.json`就是实际确认回读后下载的结果，可直接再回读。
6. 现场需要重新采集时，主动点击运行按钮：手工OTel3个Mock场景，或真实LangGraph2个固定Mock节点场景。后者访问一次本机接口，不接模型或LangSmith。

## 文件及界限

| 文件 | 内容 |
|---|---|
| [manual-observations.json](manual-observations.json) | 手工真实OTel埋点；顺序、重试、模拟并行协作，3链14步 |
| [langgraph-observations.json](langgraph-observations.json) | 真实LangGraph调度；固定Mock节点，2链7步 |
| [manual-reopened-unverified.json](manual-reopened-unverified.json) | 手工流程文件确认回读后的再导出 |
| [langgraph-reopened-unverified.json](langgraph-reopened-unverified.json) | 框架流程文件确认回读后的再导出 |
| [capture-manifest.json](capture-manifest.json) | 采集时间、运行代码SHA、版本、4份JSON大小/哈希、真实网页表格与请求数 |
| [manual-result.png](manual-result.png)、[langgraph-result.png](langgraph-result.png) | 本次实际运行后、回读前的中文页面截图 |

合计5链21步，2个故障注入步骤均恢复，模型调用0；Token/模型成本未测量。它不是5个已兼容框架，也不是十万条新测试结果。观测回读仅支持本平台的这两种格式，最多64KiB/14步，不用于全量业务数据迁移。

原文件与再导出只相差`provenance: { kind: "local-file", verification: "unverified" }`。SHA用于核对文件字节，不是来源数字签名。两张截图来自原始合成运行，不能与文件回读的未认证状态混为一谈。

项目和详细报告：https://github.com/boyuling-123/AI-API-workspace 。平台不要求模型密钥即可完成上述演示；首次安装依赖可能联网。本机既有历史归档另从平台历史页查看，不在本包中。
