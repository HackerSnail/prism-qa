---
name: prism-qa
description: AI 测试工程师成长伴侣。用于正在从传统测试转型 AI 测试的工程师：想做能力诊断、摸底自测，要补 Prompt 工程与 Agent 理解，要学 Skill 封装与 MCP 协议，要评审 AI 生成的用例并拿到覆盖率评分，要识别缺陷模式并沉淀 Bug 知识库，要排查 Skill 行为漂移、跨引擎不一致、MCP 调用失败、Agent 死循环时使用。只做 Agent 与 Skill 基础设施层排障，应用崩溃与内存泄漏等问题交给鸿蒙 DFX Skills（互补）。触发词：AI 测试转型、Skill 工程师、MCP 协议、Agent 排障、Skill 漂移、用例评审、用例质量门禁、缺陷沉淀、能力雷达、自测。发布标签：#小红书Skill创新赛 #2026华为开发者大赛
argument-hint: <自测 | 评审 用例.json | 排障 配置/轨迹 | 记录 bug.json>
---

# AI 测试工程师成长伴侣

一条链路，四个环节，不是四个并列工具：

```
诊断差在哪  →  学习补什么  →  实践练什么  →  验证跑没跑通
diagnose.js   learning-paths   case-gate.js    agent-diag.js
                            └ defect-kb.js
```

判分、评分、比对、连通性检查由脚本真跑，语义分析与讲解由模型负责。脚本只输出事实，模型不得替脚本编结果。

主文件只放路由与硬约束；模型细节见 `references/capability-model.md`，门禁口径见 `references/case-gate-rules.md`，排障取证见 `references/runtime-triage.md`。

## 能力边界（先读）

- **做**：AI 测试五层能力诊断与学习路径；AI 生成用例的质量门禁；缺陷模式识别与知识沉淀；Agent / Skill 运行时排障（行为漂移、跨引擎不一致、MCP 调用失败、死循环）。
- **不做**：应用卡死、JS/C++ 崩溃、内存泄漏、性能火焰图等**应用层**故障分析。这些问题与鸿蒙 DFX Skills v1.3.0 的八大故障分析能力重叠，本 Skill 明确让位、只做**基础设施层**，形成互补而非竞争。
- **不替用户执行**：`actual`、真实结果只填实际跑过的事实，没跑就留空，不推测、不代填。

## 入口路由

| 用户说什么                                                     | 走哪条         | 命令                          | 输出物                                    |
| :------------------------------------------------------------- | :------------- | :---------------------------- | :---------------------------------------- |
| 自测、摸底、我该补什么、能力诊断                               | 一、诊断       | `node scripts/diagnose.js`    | 五层雷达 + 差距分析 + 学习路径 + 能力名片 |
| 下一步学什么、给条路线                                         | 二、学习       | 读 `data/learning-paths.json` | 按 band 给出的动作与资源                  |
| 评审这份用例、能不能提测、覆盖率多少                           | 三、用例门禁   | `node scripts/case-gate.js`   | 评分 + 五维覆盖 + 遗漏补全 + 风险分级     |
| 写 Bug、这属于什么缺陷、以前出过吗                             | 四、缺陷沉淀   | `node scripts/defect-kb.js`   | 结构化 Bug + 模式 + 历史关联              |
| Skill 升级后不对了、两个引擎结果不一样、MCP 连不上、Agent 卡住 | 五、运行时排障 | `node scripts/agent-diag.js`  | 分类 + 根因 + 修复建议 + 回归步骤         |

## 一、诊断：五层能力雷达

```bash
node scripts/diagnose.js                       # 五层各 6 题，默认 30 题
node scripts/diagnose.js --layer skill         # 单层专项
node scripts/diagnose.js --level 2 --n 5       # 限定难度与每层题数
node scripts/diagnose.js --with-infra          # 追加基础设施层前置检查（不计入雷达）
node scripts/diagnose.js --basics              # 传统基本功回练，不计入雷达
node scripts/diagnose.js --answers a.json --json   # 程序判分（自动化）
node scripts/diagnose.js --card card.md        # 导出可分享能力名片
node scripts/diagnose.js --history             # 历史趋势
```

**五层模型**（`data/capabilities.json`）：Prompt 工程 20%、Agent 理解 20%、Skill 封装 25%、MCP 协议 15%、AI 测试专项 20%。总分按权重合成，分 L1 起步 / L2 上手机 / L3 实战期 / L4 可交付。

**题型三类**：场景模拟（给情境做判断）、代码实操（给做法/命令）、Prompt 调试（改写法）。基础设施层 72 道 Linux 题为前置检查，基本功 125 题为面试回练，都不进雷达。

**判分**：`must` 关键词全中且 `accept` 任一命中才算对；同义表述允许，拿不准按保守计。错题按四类归因：记不牢 / 概念不清 / 流程说不清 / 会说不做，下一轮优先复练错题。

**输出物**：终端雷达 + 差距分析 + 按短板排序的学习路径（含实践任务与资源）+ 可晒能力名片（`#AI测试转型 #测试人成长 #Skill工程师`）。题库按月随 JD 与高频面试题更新，旧题只修订不删除，保证历史成绩可比。

## 二、学习路径：只用数据里的资源

读完诊断后按 `result.paths` 讲：`band` 为 low（<40）/ mid（40–69）/ high（≥70），每层给出 focus、actions、resources。**不得自行编造课程、链接或题库之外的知识点**；用户要更细的计划时，只能把 actions 拆成周计划，资源仍取 `data/learning-paths.json`。

## 三、实践一：用例质量门禁

定位是生成器的**下游关卡**：不改写用例，只评审 AI 生成的用例能不能进执行。

```bash
node scripts/case-gate.js --file cases.json            # 默认阈值 70
node scripts/case-gate.js --file cases.json --min 80   # 更严
node scripts/case-gate.js --file cases.json --md       # Markdown 评审报告
node scripts/case-gate.js --file cases.json --json     # 机器可读，符合 schema/review-report.schema.json
```

输入是 `schema/testcase.schema.json` 的数组或 `{ "cases": [...] }`。检查共 **23 项、五大维度**：

| 维度       | 检查点                                                        | 关键项（未过即阻断）   |
| :--------- | :------------------------------------------------------------ | :--------------------- |
| 功能覆盖   | 主流程、负例+边界 ≥40%、权限角色、状态连续、模块覆盖          | 负例+边界 ≥40%         |
| 数据设计   | 边界三位置、空值 null、超长特殊字符、类型格式非法、数据可构造 | 边界三位置             |
| 可执行性   | 前置条件、一步一操作、预期可判定、用例独立、编号标题唯一      | 一步一操作、预期可判定 |
| 集成与契约 | 错误码 message、幂等重试、超时限流、上下游联动                | —                      |
| 非功能     | 性能并发、安全、兼容、可观测性                                | —                      |

**判定**：评分 = 命中权重 / 总权重 × 100；评分 ≥ `--min` **且** 关键项全过才 `pass`，退出码 0，否则退出码 1（可接 CI）。风险分级：评分 <50、负例边界不足、或 ≥2 个关键项未过 → 高风险。

**话术约束**：先给结论与评分，再列关键项阻断，最后按 `gaps` 给可执行的补全建议；建议必须落到具体场景（补哪条、用什么数据），禁止只说「覆盖不足」。旧版硬指标（负例+边界 40%、边界三位置、一步一操作）现在从「生成时自律」变成「评审时判据」。

## 四、实践二：缺陷知识沉淀

```bash
node scripts/defect-kb.js match  --file bug.json       # 模式 + 历史相似 Bug
node scripts/defect-kb.js record --file bug.json       # 校验 + 生成报告 + 入库
node scripts/defect-kb.js record --file bug.json --format jira
node scripts/defect-kb.js record --file bug.json --dry-run
node scripts/defect-kb.js stats --top 5                # 知识库沉淀情况
```

- 必填：title、module、version、severity、priority、environment、steps、actual、expected、frequency（`schema/defect-record.schema.json`）。缺字段直接报错，不生成半成品。
- 模式库 `data/defect-patterns.json` 现有 15 个模式，覆盖输入校验、状态与幂等、并发时序、集成协议、数据一致性、资源性能、安全、模型输出八类；`record` 自动写入 `patternIds` 与分类。
- 每次记录会关联 `data/defects.jsonl` 里的历史相似 Bug（相似度 ≥0.3），实现「运行即沉淀」。输出同时适配 GitHub Issues（Markdown）与 Jira（`--format jira`），可直接复制。
- 没命中模式时，明确说「建议作为新模式候选」，不硬套。

## 五、验证：Agent 与 Skill 运行时排障

```bash
node scripts/agent-diag.js drift  --baseline a.json --current b.json
node scripts/agent-diag.js engine --a engine-a.json --b engine-b.json
node scripts/agent-diag.js mcp    --config mcp.json --timeout 2000
node scripts/agent-diag.js loop   --trace trace.jsonl --max-steps 40 --repeat 3
```

| 模式   | 输入                                    | 真跑什么                                                             | 判定                  |
| :----- | :-------------------------------------- | :------------------------------------------------------------------- | :-------------------- |
| drift  | 两版 Skill 运行结果（cases: id/output） | 字符 bigram 相似度、缺失用例                                         | 相似度 <0.85 记为漂移 |
| engine | 两个引擎的 pass/output/toolCalls        | 判定差异、输出差异、工具选择差异                                     | 任一项不一致即报告    |
| mcp    | `mcpServers` 配置                       | 启动命令是否存在、`${VAR}` 是否注入、远程端口 TCP 可达、明文凭据扫描 | 失败/告警分级         |
| loop   | JSONL 轨迹（step/tool/args/output）     | 步数、同工具同参数重复、A→B→A→B、输出无进展、错误重试                | 命中即报告            |

输出固定四段：**问题分类 → 根因定位 → 修复建议 → 回归验证步骤**，可用 `--json` 接入流水线；退出码 0 无问题、1 有问题。所有结论必须附证据（步骤号、相似度、端口、变量名），不凭感觉下判断。

与 skill-up 的分工：skill-up 负责 YAML 定义用例、多引擎执行与 CI 集成；本脚本负责结果比对、漂移与循环判定、报告输出。两者可串起来用：skill-up 跑完把结果导出成上面的 JSON 格式，再交给 agent-diag。

## 数据与脚本

| 文件                             | 作用                                         |
| :------------------------------- | :------------------------------------------- |
| `data/questions.json`            | 247 题：五层 50 + 基础设施 72 + 基本功 125   |
| `data/capabilities.json`         | 五层权重、等级、采样与阈值                   |
| `data/learning-paths.json`       | 按层 × band 的学习动作与资源                 |
| `data/defect-patterns.json`      | 15 个缺陷模式                                |
| `data/defects.jsonl`             | 缺陷知识库（追加写入）                       |
| `data/progress.json`             | 诊断历史与错题池（运行时生成）               |
| `scripts/diagnose.js`            | 诊断、雷达、路径、能力名片                   |
| `scripts/case-gate.js`           | 用例质量门禁                                 |
| `scripts/agent-diag.js`          | 四类运行时排障                               |
| `scripts/defect-kb.js`           | 缺陷沉淀与关联                               |
| `references/capability-model.md` | 五层模型、判分口径、月度更新 SOP             |
| `references/case-gate-rules.md`  | 23 项检查的判定口径与反例                    |
| `references/runtime-triage.md`   | 四类排障的取证与误判说明                     |
| `schema/*.json`                  | 用例、评审报告、诊断报告、缺陷记录、排障报告 |

## 快速验收（评审可复制执行）

```bash
node scripts/diagnose.js --answers examples/answers-demo.json --no-save
node scripts/case-gate.js --file examples/cases-pass.json
node scripts/case-gate.js --file examples/cases-audit.json      # 预期不通过，退出码 1
node scripts/agent-diag.js drift --baseline examples/skill-run-baseline.json --current examples/skill-run-current.json
node scripts/agent-diag.js loop --trace examples/agent-trace.jsonl
node scripts/defect-kb.js match --file examples/bug.json
node scripts/defect-kb.js record --file examples/bug.json --dry-run
```

## 三条硬约束

1. **真实执行**：分数、相似度、端口状态、判分结果全部来自脚本输出，模型只做解释。
2. **不编造**：不虚构资源、不虚构历史 Bug、不虚构测试结果；数据不足就标「待确认」。
3. **安全与版权**：凭据不写进配置与报告，输出脱敏；题库、模式库全部原创，不搬运大厂真题。

## 发布与提交

根目录是**华为完整版**（SKILL.md + scripts + references 三件套结构），保留全部工程能力；另外两版按平台约束裁剪：

| 版本         | 位置                            | 形态                                 | 面向                                |
| :----------- | :------------------------------ | :----------------------------------- | :---------------------------------- |
| 华为完整版   | 根目录                          | 三件套 + 可执行脚本                  | 华为开发者大赛智能体创新赛          |
| 小红书精简版 | `versions/xiaohongshu/SKILL.md` | 纯 Markdown ≤500 行、无 YAML、无脚本 | 小红书 Skill 创新赛（安全审核赛道） |
| 高校教育版   | `versions/edu/SKILL.md`         | 零门槛、侧重学习路径、砍企业级排障   | 鸿蒙高校创新赛                      |

三版共用同一套五层模型、检查清单与缺陷模式库；差异只在外层形态。发布标签固定 `#小红书Skill创新赛 #2026华为开发者大赛`。

生态对接声明（只写可验证的事实）：诊断与门禁的 `--json` 输出可作为 AgentArts 自动化评估的指标输入，排障报告可作为全链路观测事件接入；本仓库不包含也未声称已部署 AgentArts 服务端集成。
