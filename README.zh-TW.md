# prism-qa · AI 測試工程師成長夥伴

[简体中文](README.md) | [繁體中文](README.zh-TW.md) | [English](README.en.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

> 幫正在從傳統測試轉型 AI 測試的工程師：先看清自己差在哪，再拿到一條能當天開練的路線。

2026 華為開發者大賽 · 小紅書 Skill 創新賽參賽作品。

## 為什麼做它

手動測試需求在收縮、AI 測試職位在擴張，但市場上缺一條系統的轉型路徑：面試題庫是靜態內容，用例產生器只解決單點。本 Skill 把 **診斷 → 學習 → 實踐 → 驗證** 串成一條鏈——四個環節對應四個可執行腳本，不是四個並列工具。

判定、評分、比對、連通性檢查全部由腳本真跑，模型只負責解釋。腳本只輸出事實，不替腳本編結果。

## 能力邊界

- **做**：AI 測試五層能力診斷與學習路徑；AI 生成用例的品質關卡；缺陷模式識別與知識沉澱；Agent / Skill 執行期除錯（行為漂移、跨引擎不一致、MCP 呼叫失敗、死迴圈）。
- **不做**：應用程式卡死、JS/C++ 崩潰、記憶體洩漏、效能火焰圖等**應用層**故障分析，交給鴻蒙 DFX Skills，本 Skill 只做**基礎設施層**，互補而非競爭。

## 目錄結構

```
prism-qa/
├── SKILL.md                 # 主檔案：路由 + 硬約束
├── data/
│   ├── questions.json       # 247 題：五層 50 + 基礎設施 72 + 基本功 125
│   ├── capabilities.json    # 五層權重、等級、取樣閾值
│   ├── learning-paths.json  # 按層 × 水準段的學習動作與資源
│   ├── defect-patterns.json # 15 個缺陷模式
│   └── defects.jsonl        # 缺陷知識庫（追加寫入）
├── scripts/
│   ├── diagnose.js          # 五層能力診斷、雷達、學習路徑、能力名片
│   ├── case-gate.js         # 用例品質關卡（23 項 / 五維評分）
│   ├── defect-kb.js         # 缺陷模式比對與知識沉澱
│   └── agent-diag.js        # 執行期除錯：漂移 / 跨引擎 / MCP / 死迴圈
├── references/              # 模型細節：五層模型、關卡口徑、除錯取證
├── schema/                  # 用例、評審報告、診斷報告、缺陷記錄、除錯報告
├── examples/                # 可直接跑通的驗收範例
└── versions/
    ├── xiaohongshu/SKILL.md # 小紅書精簡版（純 Markdown ≤500 行）
    └── edu/SKILL.md         # 高校教育版
```

## 快速開始

依賴 Node.js（無第三方依賴，`node scripts/*.js` 直接執行）。

```bash
# 一、能力診斷（五層各 6 題，預設 30 題）
node scripts/diagnose.js
node scripts/diagnose.js --layer skill          # 單層專項
node scripts/diagnose.js --level 2 --n 5        # 限定難度與題量
node scripts/diagnose.js --card card.md         # 匯出可分享能力名片

# 二、用例品質關卡（評審 AI 生成的用例）
node scripts/case-gate.js --file cases.json
node scripts/case-gate.js --file cases.json --min 80 --md

# 三、缺陷知識沉澱
node scripts/defect-kb.js match  --file bug.json   # 模式 + 歷史相似 Bug
node scripts/defect-kb.js record --file bug.json   # 校驗 + 報告 + 入庫

# 四、Agent / Skill 執行期除錯
node scripts/agent-diag.js drift  --baseline a.json --current b.json
node scripts/agent-diag.js engine --a engine-a.json --b engine-b.json
node scripts/agent-diag.js mcp    --config mcp.json --timeout 2000
node scripts/agent-diag.js loop   --trace trace.jsonl --max-steps 40 --repeat 3
```

## 快速驗收（評審可複製執行）

```bash
node scripts/diagnose.js --answers examples/answers-demo.json --no-save
node scripts/case-gate.js --file examples/cases-pass.json        # 預期通過
node scripts/case-gate.js --file examples/cases-audit.json       # 預期不通過，退出碼 1
node scripts/agent-diag.js drift --baseline examples/skill-run-baseline.json --current examples/skill-run-current.json
node scripts/agent-diag.js loop --trace examples/agent-trace.jsonl
node scripts/defect-kb.js match --file examples/bug.json
```

## 多平台版本

| 版本 | 位置 | 形態 | 面向 |
| :--- | :--- | :--- | :--- |
| 華為完整版 | 根目錄 | SKILL.md + scripts + references 三件套，含可執行腳本 | 華為開發者大賽智能體創新賽 |
| 小紅書精簡版 | `versions/xiaohongshu/SKILL.md` | 純 Markdown ≤500 行，無腳本 | 小紅書 Skill 創新賽 |
| 高校教育版 | `versions/edu/SKILL.md` | 零門檻、側重學習路徑 | 鴻蒙高校創新賽 |

三版共用同一套五層模型、檢查清單與缺陷模式庫，差異只在外層形態。

## 三條硬約束

1. **真實執行**：分數、相似度、埠狀態、判分結果全部來自腳本輸出，模型只做解釋。
2. **不編造**：不虛構資源、不虛構歷史 Bug、不虛構測試結果；資料不足就標「待確認」。
3. **安全與版權**：憑據不寫進設定與報告，輸出脫敏；題庫、模式庫全部原創，不搬運大廠真題。

## 發布標籤

`#小红书Skill创新赛 #2026华为开发者大赛`

## 聲明

本倉庫為參賽原創作品。診斷與關卡的 `--json` 輸出可作為 AgentArts 自動化評估的指標輸入，除錯報告可作為全鏈路觀測事件接入；本倉庫不包含、也未聲稱已部署 AgentArts 服務端整合。