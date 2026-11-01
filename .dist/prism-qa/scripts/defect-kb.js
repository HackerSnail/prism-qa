#!/usr/bin/env node
// 缺陷知识沉淀：模式识别 → 历史 Bug 关联 → 结构化报告 → 入库复用
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PATTERNS_FILE = path.join(ROOT, 'data', 'defect-patterns.json');
const DEFAULT_KB = path.join(ROOT, 'data', 'defects.jsonl');
const PATTERNS = JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8')).patterns;

const REQUIRED = ['title', 'module', 'version', 'severity', 'priority', 'environment', 'steps', 'actual', 'expected', 'frequency'];
const SEVERITY = ['致命', '严重', '一般', '轻微'];
const PRIORITY = ['高', '中', '低'];

const USAGE = `用法：
  node scripts/defect-kb.js match  --text "现象描述" | --file bug.json   匹配缺陷模式与历史相似 Bug
  node scripts/defect-kb.js record --file bug.json [--dry-run]          校验、识别、生成报告并入库
  node scripts/defect-kb.js stats [--top 5]                              看知识库沉淀情况
公共参数：--kb <path> 指定知识库；--json 只输出 JSON；--format md|jira`;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function normText(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '').trim().toLowerCase();
}

function bigrams(s) {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

function similarity(a, b) {
  const x = normText(a);
  const y = normText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const mx = bigrams(x);
  const my = bigrams(y);
  let inter = 0;
  for (const [g, n] of mx) inter += Math.min(n, my.get(g) || 0);
  return (2 * inter) / (x.length - 1 + y.length - 1);
}

function readKb(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function bugText(bug) {
  return [bug.title, bug.actual, bug.expected, bug.environment, (bug.steps || []).join(' ')].join(' ');
}

function matchPatterns(text) {
  const t = String(text || '').toLowerCase();
  return PATTERNS
    .map(p => {
      const hits = p.keywords.filter(k => t.includes(k.toLowerCase()));
      return { ...p, hits, score: hits.length };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function relatedBugs(text, kb, excludeId) {
  return kb
    .filter(b => b.id !== excludeId)
    .map(b => ({ ...b, similarity: Math.round(similarity(text, bugText(b)) * 100) / 100 }))
    .filter(b => b.similarity >= 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

function renderMarkdown(bug, patterns, related) {
  const lines = [];
  lines.push(`# [${bug.severity}] ${bug.title}`);
  lines.push('');
  lines.push(`- 模块 / 版本：${bug.module} / ${bug.version}`);
  lines.push(`- 严重程度 / 优先级：${bug.severity} / ${bug.priority}`);
  lines.push(`- 出现频率：${bug.frequency}`);
  lines.push(`- 环境与前置：${bug.environment}`);
  lines.push('');
  lines.push('## 复现步骤');
  bug.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('');
  lines.push('## 实际结果');
  lines.push(bug.actual);
  lines.push('');
  lines.push('## 期望结果');
  lines.push(bug.expected);
  lines.push('');
  lines.push('## 缺陷模式');
  if (patterns.length) {
    patterns.forEach(p => {
      lines.push(`- **${p.id} ${p.name}**（${p.category}）命中关键词：${p.hits.join('、')}`);
      lines.push(`  - 根因线索：${p.rootCause}`);
      lines.push(`  - 修复建议：${p.fix}`);
      lines.push(`  - 回归验证：${p.verify}`);
    });
  } else {
    lines.push('- 未命中已知模式，建议作为新模式候选补充进 data/defect-patterns.json');
  }
  lines.push('');
  lines.push('## 历史相似 Bug');
  if (related.length) related.forEach(b => lines.push(`- ${b.id} ${b.title}（${b.date}，相似度 ${b.similarity}）`));
  else lines.push('- 无');
  return lines.join('\n');
}

function renderJira(bug, patterns) {
  const lines = [];
  lines.push(`h1. [${bug.severity}] ${bug.title}`);
  lines.push(`||模块|${bug.module}|版本|${bug.version}||`);
  lines.push(`||严重程度|${bug.severity}|优先级|${bug.priority}||`);
  lines.push(`||出现频率|${bug.frequency}||`);
  lines.push(`h2. 环境与前置\n${bug.environment}`);
  lines.push('h2. 复现步骤');
  bug.steps.forEach((s, i) => lines.push(`# ${s}`));
  lines.push(`h2. 实际结果\n${bug.actual}`);
  lines.push(`h2. 期望结果\n${bug.expected}`);
  if (patterns.length) lines.push(`h2. 缺陷模式\n${patterns.map(p => `* ${p.id} ${p.name}：${p.rootCause}`).join('\n')}`);
  return lines.join('\n');
}

function cmdMatch() {
  const file = arg('--file');
  let text = arg('--text') || '';
  if (file) {
    const raw = fs.readFileSync(path.resolve(file), 'utf8');
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    text = parsed ? bugText(parsed) : raw;
  }
  if (!text) throw new Error('需要 --text 或 --file');
  const kb = readKb(path.resolve(arg('--kb', DEFAULT_KB)));
  const patterns = matchPatterns(text);
  const related = relatedBugs(text, kb);

  const out = {
    matched: patterns.slice(0, 3).map(p => ({ id: p.id, name: p.name, category: p.category, score: p.score, hits: p.hits, rootCause: p.rootCause, fix: p.fix, verify: p.verify })),
    related
  };
  if (process.argv.includes('--json')) return console.log(JSON.stringify(out, null, 2));

  console.log('\n===== 缺陷模式识别 =====');
  if (!out.matched.length) {
    console.log('未命中已知模式：建议作为新模式候选补充进 data/defect-patterns.json。');
  } else {
    out.matched.forEach((p, i) => {
      console.log(`${i + 1}. ${p.id} ${p.name}（${p.category}）命中 ${p.score} 个关键词：${p.hits.join('、')}`);
      console.log(`   根因线索：${p.rootCause}`);
      console.log(`   修复建议：${p.fix}`);
      console.log(`   回归验证：${p.verify}`);
    });
  }
  console.log('\n历史相似 Bug');
  if (out.related.length) out.related.forEach(b => console.log(`- ${b.id} ${b.title}（${b.date}，相似度 ${b.similarity}）`));
  else console.log('- 无');
}

function cmdRecord() {
  const file = arg('--file');
  if (!file) throw new Error('record 需要 --file bug.json');
  const bug = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const missing = REQUIRED.filter(f => {
    const v = bug[f];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  const problems = missing.map(f => `缺少字段 ${f}`);
  if (bug.steps !== undefined && !Array.isArray(bug.steps)) problems.push('steps 必须是字符串数组');
  if (bug.severity && !SEVERITY.includes(bug.severity)) problems.push(`severity 取值非法：${bug.severity}`);
  if (bug.priority && !PRIORITY.includes(bug.priority)) problems.push(`priority 取值非法：${bug.priority}`);
  if (problems.length) throw new Error(`Bug 记录不合规：\n- ${problems.join('\n- ')}`);

  const kbPath = path.resolve(arg('--kb', DEFAULT_KB));
  const kb = readKb(kbPath);
  const text = bugText(bug);
  const patterns = matchPatterns(text).slice(0, 2);
  const related = relatedBugs(text, kb);
  const today = new Date().toISOString().slice(0, 10);
  const seq = kb.filter(b => String(b.id || '').includes(today.replace(/-/g, ''))).length + 1;
  const id = bug.id || `BUG-${today.replace(/-/g, '')}-${String(seq).padStart(3, '0')}`;
  const record = {
    ...bug,
    id,
    patternIds: patterns.map(p => p.id),
    category: patterns[0] ? patterns[0].category : '未分类',
    date: today
  };
  record.steps = bug.steps;

  const format = arg('--format', 'md');
  const report = format === 'jira' ? renderJira(record, patterns) : renderMarkdown(record, patterns, related);
  const isJson = process.argv.includes('--json');
  const isDry = process.argv.includes('--dry-run');

  if (isJson) {
    console.log(JSON.stringify({ record, patterns, related, report, dryRun: isDry }, null, 2));
  } else {
    console.log('\n===== 缺陷记录 =====');
    console.log(`编号 ${id}｜模式 ${record.patternIds.join('、') || '未命中'}｜分类 ${record.category}`);
    console.log(report);
  }

  if (isDry) {
    if (!isJson) console.log('\n（dry-run：未写入知识库）');
    return;
  }
  fs.appendFileSync(kbPath, JSON.stringify(record) + '\n');
  if (!isJson) console.log(`\n已沉淀到知识库：${kbPath}`);
}

function cmdStats() {
  const kb = readKb(path.resolve(arg('--kb', DEFAULT_KB)));
  const top = Number(arg('--top', 5));
  const byCategory = {};
  const byPattern = {};
  const bySeverity = {};
  for (const b of kb) {
    byCategory[b.category || '未分类'] = (byCategory[b.category || '未分类'] || 0) + 1;
    bySeverity[b.severity || '未标注'] = (bySeverity[b.severity || '未标注'] || 0) + 1;
    for (const p of b.patternIds || []) byPattern[p] = (byPattern[p] || 0) + 1;
  }
  const nameOf = id => (PATTERNS.find(p => p.id === id) || {}).name || id;
  const topPatterns = Object.entries(byPattern).sort((a, b) => b[1] - a[1]).slice(0, top);

  if (process.argv.includes('--json')) {
    return console.log(JSON.stringify({ total: kb.length, byCategory, bySeverity, topPatterns: topPatterns.map(([id, n]) => ({ id, name: nameOf(id), count: n })) }, null, 2));
  }

  console.log('\n===== 缺陷知识库 =====');
  console.log(`累计记录 ${kb.length} 条｜模式库 ${PATTERNS.length} 个`);
  if (!kb.length) return console.log('还没有记录，用 record 沉淀第一条。');
  console.log(`\n高频缺陷模式（Top ${top}）`);
  topPatterns.forEach(([id, n]) => console.log(`  ${id} ${nameOf(id)}：${n} 次`));
  console.log('\n按分类');
  Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}：${v}`));
  console.log('\n按严重程度');
  Object.entries(bySeverity).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}：${v}`));
  console.log('\n最近记录');
  kb.slice(-3).forEach(b => console.log(`  ${b.id} ${b.title}（${b.date}）`));
}

function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === '--help') return console.log(USAGE);
  if (cmd === 'match') return cmdMatch();
  if (cmd === 'record') return cmdRecord();
  if (cmd === 'stats') return cmdStats();
  console.log(USAGE);
  process.exit(2);
}

try {
  main();
} catch (e) {
  console.error('执行失败：', e.message);
  process.exit(2);
}
