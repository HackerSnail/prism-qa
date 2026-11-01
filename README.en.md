# test-mentor · AI Test Engineer Growth Companion

[简体中文](README.md) | [繁體中文](README.zh-TW.md) | [English](README.en.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

> For engineers moving from manual testing to AI testing: first see exactly where you fall short, then get a learning path you can start the same day.

Entry for the 2026 Huawei Developer Competition · Xiaohongshu Skill Innovation Competition.

## Why this exists

Demand for manual testing is shrinking while AI testing roles are expanding, yet the market lacks a systematic transition path: interview question banks are static content, and test-case generators solve only isolated points. This Skill chains **diagnosis → learning → practice → validation** into one pipeline — four stages mapped to four executable scripts, not four parallel tools.

Judgement, scoring, comparison and connectivity checks all really run in scripts; the model only explains. Scripts emit facts only; never let the model invent results on their behalf.

## Scope

- **Does**: five-layer AI testing capability diagnosis and learning paths; a quality gate for AI-generated test cases; defect pattern recognition and knowledge capture; Agent / Skill runtime troubleshooting (behavior drift, cross-engine inconsistency, MCP call failures, infinite loops).
- **Does not**: **application-layer** fault analysis such as app hangs, JS/C++ crashes, memory leaks and performance flame graphs — those belong to HarmonyOS DFX Skills. This Skill covers the **infrastructure layer** only, complementing rather than competing.

## Directory layout

```
test-mentor/
├── SKILL.md                 # Main file: routing + hard constraints
├── data/
│   ├── questions.json       # 247 questions: 50 five-layer + 72 infrastructure + 125 fundamentals
│   ├── capabilities.json    # Five-layer weights, levels, sampling thresholds
│   ├── learning-paths.json  # Learning actions and resources by layer × level band
│   ├── defect-patterns.json # 15 defect patterns
│   └── defects.jsonl        # Defect knowledge base (append-only)
├── scripts/
│   ├── diagnose.js          # Five-layer diagnosis, radar, learning path, capability card
│   ├── case-gate.js         # Test-case quality gate (23 checks / five dimensions)
│   ├── defect-kb.js         # Defect pattern matching and knowledge capture
│   └── agent-diag.js        # Runtime triage: drift / cross-engine / MCP / infinite loop
├── references/              # Model details: five-layer model, gate rules, triage evidence
├── schema/                  # Test cases, review reports, diagnosis reports, defect records, triage reports
├── examples/                # Runnable acceptance samples
└── versions/
    ├── xiaohongshu/SKILL.md # Xiaohongshu slim edition (pure Markdown, ≤500 lines)
    └── edu/SKILL.md         # Higher-education edition
```

## Quick start

Requires Node.js (no third-party dependencies; `node scripts/*.js` runs directly).

```bash
# 1. Capability diagnosis (6 questions per layer, 30 by default)
node scripts/diagnose.js
node scripts/diagnose.js --layer skill          # single-layer focus
node scripts/diagnose.js --level 2 --n 5        # restrict difficulty and item count
node scripts/diagnose.js --card card.md         # export a shareable capability card

# 2. Test-case quality gate (review AI-generated cases)
node scripts/case-gate.js --file cases.json
node scripts/case-gate.js --file cases.json --min 80 --md

# 3. Defect knowledge capture
node scripts/defect-kb.js match  --file bug.json   # pattern + similar historical bugs
node scripts/defect-kb.js record --file bug.json   # validate + report + persist

# 4. Agent / Skill runtime troubleshooting
node scripts/agent-diag.js drift  --baseline a.json --current b.json
node scripts/agent-diag.js engine --a engine-a.json --b engine-b.json
node scripts/agent-diag.js mcp    --config mcp.json --timeout 2000
node scripts/agent-diag.js loop   --trace trace.jsonl --max-steps 40 --repeat 3
```

## Quick acceptance (reviewers can copy and run)

```bash
node scripts/diagnose.js --answers examples/answers-demo.json --no-save
node scripts/case-gate.js --file examples/cases-pass.json        # expected to pass
node scripts/case-gate.js --file examples/cases-audit.json       # expected to fail, exit code 1
node scripts/agent-diag.js drift --baseline examples/skill-run-baseline.json --current examples/skill-run-current.json
node scripts/agent-diag.js loop --trace examples/agent-trace.jsonl
node scripts/defect-kb.js match --file examples/bug.json
```

## Multi-platform editions

| Edition | Location | Form | For |
| :--- | :--- | :--- | :--- |
| Huawei full edition | repository root | SKILL.md + scripts + references trio, with executable scripts | Huawei Developer Competition · Agent Innovation |
| Xiaohongshu slim edition | `versions/xiaohongshu/SKILL.md` | pure Markdown ≤500 lines, no scripts | Xiaohongshu Skill Innovation Competition |
| Higher-education edition | `versions/edu/SKILL.md` | zero bar to entry, learning-path focused | HarmonyOS University Innovation Competition |

All three editions share the same five-layer model, checklists and defect pattern library; only the outer form differs.

## Three hard constraints

1. **Real execution**: scores, similarity, port status and grading results all come from script output; the model only explains.
2. **No fabrication**: no invented resources, historical bugs or test results; mark "to be confirmed" when data is insufficient.
3. **Security and copyright**: credentials never go into configs or reports, and output is redacted; the question bank and pattern library are entirely original, not copied from big-tech interview questions.

## Publication tags

`#小红书Skill创新赛 #2026华为开发者大赛`

## Notice

This repository is an original entry for the competition. The `--json` output of diagnosis and the gate can serve as metric input for AgentArts automated evaluation, and triage reports can be connected as full-chain observability events; this repository does not contain, nor claim to have deployed, any AgentArts server-side integration.