# test-mentor · AI 测试工程师成长伴侣

[简体中文](README.md) | [繁體中文](README.zh-TW.md) | [English](README.en.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

> 帮正在从传统测试转型 AI 测试的工程师：先看清自己差在哪，再拿到一条能当天开练的路线。

2026 华为开发者大赛 · 小红书 Skill 创新赛参赛作品。

## 为什么做它

手工测试需求在收缩、AI 测试岗位在扩张，但市场上缺一条系统的转型路径：面试题库是静态内容，用例生成器只解决单点。本 Skill 把 **诊断 → 学习 → 实践 → 验证** 串成一条链——四个环节对应四个可执行脚本，不是四个并列工具。

判定、评分、比对、连通性检查全部由脚本真跑，模型只负责解释。脚本只输出事实，不替脚本编结果。

## 能力边界

- **做**：AI 测试五层能力诊断与学习路径；AI 生成用例的质量门禁；缺陷模式识别与知识沉淀；Agent / Skill 运行时排障（行为漂移、跨引擎不一致、MCP 调用失败、死循环）。
- **不做**：应用卡死、JS/C++ 崩溃、内存泄漏、性能火焰图等**应用层**故障分析，交给鸿蒙 DFX Skills，本 Skill 只做**基础设施层**，互补而非竞争。

## 目录结构

```
test-mentor/
├── SKILL.md                 # 主文件：路由 + 硬约束
├── data/
│   ├── questions.json       # 247 题：五层 50 + 基础设施 72 + 基本功 125
│   ├── capabilities.json    # 五层权重、等级、采样阈值
│   ├── learning-paths.json  # 按层 × 水平段的学习动作与资源
│   ├── defect-patterns.json # 15 个缺陷模式
│   └── defects.jsonl        # 缺陷知识库（追加写入）
├── scripts/
│   ├── diagnose.js          # 五层能力诊断、雷达、学习路径、能力名片
│   ├── case-gate.js         # 用例质量门禁（23 项 / 五维评分）
│   ├── defect-kb.js         # 缺陷模式匹配与知识沉淀
│   └── agent-diag.js        # 运行时排障：漂移 / 跨引擎 / MCP / 死循环
├── references/              # 模型细节：五层模型、门禁口径、排障取证
├── schema/                  # 用例、评审报告、诊断报告、缺陷记录、排障报告
├── examples/                # 可直接跑通的验收样例
└── versions/
    ├── xiaohongshu/SKILL.md # 小红书精简版（纯 Markdown ≤500 行）
    └── edu/SKILL.md         # 高校教育版
```

## 快速开始

依赖 Node.js（无第三方依赖，`node scripts/*.js` 直接运行）。

```bash
# 一、能力诊断（五层各 6 题，默认 30 题）
node scripts/diagnose.js
node scripts/diagnose.js --layer skill          # 单层专项
node scripts/diagnose.js --level 2 --n 5        # 限定难度与题量
node scripts/diagnose.js --card card.md         # 导出可分享能力名片

# 二、用例质量门禁（评审 AI 生成的用例）
node scripts/case-gate.js --file cases.json
node scripts/case-gate.js --file cases.json --min 80 --md

# 三、缺陷知识沉淀
node scripts/defect-kb.js match  --file bug.json   # 模式 + 历史相似 Bug
node scripts/defect-kb.js record --file bug.json   # 校验 + 报告 + 入库

# 四、Agent / Skill 运行时排障
node scripts/agent-diag.js drift  --baseline a.json --current b.json
node scripts/agent-diag.js engine --a engine-a.json --b engine-b.json
node scripts/agent-diag.js mcp    --config mcp.json --timeout 2000
node scripts/agent-diag.js loop   --trace trace.jsonl --max-steps 40 --repeat 3
```

## 快速验收（评审可复制执行）

```bash
node scripts/diagnose.js --answers examples/answers-demo.json --no-save
node scripts/case-gate.js --file examples/cases-pass.json        # 预期通过
node scripts/case-gate.js --file examples/cases-audit.json       # 预期不通过，退出码 1
node scripts/agent-diag.js drift --baseline examples/skill-run-baseline.json --current examples/skill-run-current.json
node scripts/agent-diag.js loop --trace examples/agent-trace.jsonl
node scripts/defect-kb.js match --file examples/bug.json
```

## 多平台版本

| 版本 | 位置 | 形态 | 面向 |
| :--- | :--- | :--- | :--- |
| 华为完整版 | 根目录 | SKILL.md + scripts + references 三件套，含可执行脚本 | 华为开发者大赛智能体创新赛 |
| 小红书精简版 | `versions/xiaohongshu/SKILL.md` | 纯 Markdown ≤500 行，无脚本 | 小红书 Skill 创新赛 |
| 高校教育版 | `versions/edu/SKILL.md` | 零门槛、侧重学习路径 | 鸿蒙高校创新赛 |

三版共用同一套五层模型、检查清单与缺陷模式库，差异只在外层形态。

## 三条硬约束

1. **真实执行**：分数、相似度、端口状态、判分结果全部来自脚本输出，模型只做解释。
2. **不编造**：不虚构资源、不虚构历史 Bug、不虚构测试结果；数据不足就标「待确认」。
3. **安全与版权**：凭据不写进配置与报告，输出脱敏；题库、模式库全部原创，不搬运大厂真题。

## 发布标签

`#小红书Skill创新赛 #2026华为开发者大赛`

## 声明

本仓库为参赛原创作品。诊断与门禁的 `--json` 输出可作为 AgentArts 自动化评估的指标输入，排障报告可作为全链路观测事件接入；本仓库不包含、也未声称已部署 AgentArts 服务端集成。