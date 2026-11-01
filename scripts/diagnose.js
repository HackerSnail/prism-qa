#!/usr/bin/env node
// AI 测试能力诊断引擎：抽题 → 判分 → 五层雷达 → 差距分析 → 学习路径 → 能力名片
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const BANK = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'));
const CAP = JSON.parse(fs.readFileSync(path.join(DATA, 'capabilities.json'), 'utf8'));
const PATHS = JSON.parse(fs.readFileSync(path.join(DATA, 'learning-paths.json'), 'utf8'));
const PROGRESS = path.join(DATA, 'progress.json');

const LAYERS = CAP.layers;
const LAYER_MAP = LAYERS.reduce((m, l) => (m[l.key] = l, m), {});
const BLIND = {
  command: '记不牢',
  concept: '概念不清',
  process: '流程说不清',
  apply: '会说不做'
};

// ---------- 题库 ----------
function flatQuestions() {
  const out = [];
  for (const [bank, list] of Object.entries(BANK.banks)) {
    for (const q of list) out.push({ ...q, _bank: bank, _layer: bank });
  }
  return out;
}
const ALL = flatQuestions();
const BY_ID = ALL.reduce((m, q) => (m[q.id] = q, m), {});

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '').trim();
}

function judge(q, given) {
  const g = norm(given);
  if (!g) return false;
  const must = q.must || [];
  if (must.length && !must.every(m => g.includes(norm(m)))) return false;
  const accept = q.accept || [];
  if (accept.length) return accept.some(a => g.includes(norm(a)));
  return must.length > 0;
}

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

function pick(layerKey, n, level, preferIds) {
  const bank = layerKey === 'basics' ? ['infra', 'basics'] : [layerKey];
  const pool = bank.flatMap(b => BANK.banks[b] || []).map(q => ({ ...q, _layer: layerKey, _bank: layerKey }));
  const typed = level ? pool.filter(q => String(q.level) === String(level)) : pool;
  const prefer = shuffle(typed.filter(q => preferIds.includes(q.id)));
  const rest = shuffle(typed.filter(q => !preferIds.includes(q.id)));
  return [...prefer, ...rest].slice(0, n);
}

// ---------- 参数 ----------
function parseArgs(argv) {
  const a = { n: CAP.sampling.defaultPerLayer, layer: null, level: null, grade: null, answersFile: null, withInfra: false, basics: false, card: null, json: false, history: false, save: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--n') a.n = Number(argv[++i]);
    else if (k === '--layer') a.layer = argv[++i];
    else if (k === '--level') a.level = argv[++i];
    else if (k === '--grade') a.grade = argv[++i];
    else if (k === '--answers') a.answersFile = argv[++i];
    else if (k === '--card') a.card = argv[++i];
    else if (k === '--with-infra') a.withInfra = true;
    else if (k === '--basics') a.basics = true;
    else if (k === '--json') a.json = true;
    else if (k === '--history') a.history = true;
    else if (k === '--no-save') a.save = false;
  }
  if (!a.layer && LAYER_MAP[argv[0]]) a.layer = argv[0];
  return a;
}

// ---------- 进度 ----------
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
  } catch {
    return { history: [], wrongIds: [] };
  }
}

function saveProgress(result) {
  const p = loadProgress();
  p.history = (p.history || []).slice(-99);
  p.history.push({
    date: result.date,
    total: result.total,
    correct: result.correct,
    accuracy: result.accuracy,
    overall: result.overall,
    layers: result.layers.reduce((m, l) => (m[l.key] = l.score, m), {})
  });
  p.wrongIds = result.wrong.map(w => w.id);
  fs.writeFileSync(PROGRESS, JSON.stringify(p, null, 2) + '\n');
}

// ---------- 判分与聚合 ----------
function grade(questions, answers) {
  const wrong = [];
  const dims = { command: 0, concept: 0, process: 0, apply: 0 };
  const stat = {};
  for (const q of questions) {
    const given = (answers.find(a => a.id === q.id) || {}).given || '';
    const s = stat[q._layer] || (stat[q._layer] = { correct: 0, total: 0 });
    s.total++;
    if (judge(q, given)) {
      s.correct++;
    } else {
      wrong.push({ id: q.id, q: q.q, given, ans: q.ans, blind: q.blind || 'concept' });
      dims[q.blind || 'concept'] = (dims[q.blind || 'concept'] || 0) + 1;
    }
  }
  return { wrong, dims, stat };
}

function levelOf(score) {
  return CAP.levels.find(l => score >= l.min) || CAP.levels[CAP.levels.length - 1];
}

function bandOf(score) {
  if (score < CAP.thresholds.weak) return 'low';
  if (score < CAP.thresholds.solid) return 'mid';
  return 'high';
}

function buildResult(questions, answers, args) {
  const { wrong, dims, stat } = grade(questions, answers);
  const total = questions.length;
  const correct = total - wrong.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  const layerStats = args.basics || args.layer === 'basics'
    ? []
    : LAYERS.filter(l => stat[l.key] && stat[l.key].total > 0).map(l => {
      const s = stat[l.key];
      const score = Math.round((s.correct / s.total) * 100);
      return { key: l.key, name: l.name, weight: l.weight, score, correct: s.correct, total: s.total, level: levelOf(score).code };
    });

  const weighted = layerStats.filter(l => l.weight > 0);
  const weightSum = weighted.reduce((s, l) => s + l.weight, 0);
  const overall = weightSum
    ? Math.round(weighted.reduce((s, l) => s + l.score * l.weight, 0) / weightSum)
    : accuracy;

  const infraStat = layerStats.length ? stat.infra : null;
  const infra = infraStat && infraStat.total
    ? { score: Math.round((infraStat.correct / infraStat.total) * 100), total: infraStat.total, correct: infraStat.correct, pass: infraStat.correct / infraStat.total >= 0.6 }
    : null;

  const ranked = [...layerStats].sort((a, b) => a.score - b.score);
  const weakest = ranked[0] || null;
  const strongest = ranked.length ? ranked[ranked.length - 1] : null;
  const gaps = ranked.filter(l => l.score < CAP.thresholds.solid).slice(0, 2);

  const result = {
    date: new Date().toISOString().slice(0, 10),
    mode: args.basics || args.layer === 'basics' ? 'basics' : args.layer || 'full',
    total,
    correct,
    accuracy,
    overall,
    level: levelOf(overall),
    layers: layerStats,
    infra,
    weakest,
    strongest,
    wrong,
    dims,
    paths: gaps.map(l => ({ layer: l.key, name: l.name, score: l.score, band: bandOf(l.score), ...PATHS.paths[l.key][bandOf(l.score)] })),
    nextActions: []
  };

  if (!result.paths.length && weakest) {
    result.paths.push({ layer: weakest.key, name: weakest.name, score: weakest.score, band: 'high', ...PATHS.paths[weakest.key].high });
  }
  result.nextActions = result.paths[0] ? result.paths[0].actions.slice(0, 3) : [];
  result.card = renderCard(result);
  return result;
}

// ---------- 渲染 ----------
function bar(score, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function dispWidth(s) {
  return [...s].reduce((w, ch) => w + (/[\u4e00-\u9fa5\uff00-\uffef]/.test(ch) ? 2 : 1), 0);
}

function padName(s, width) {
  return s + ' '.repeat(Math.max(1, width - dispWidth(s)));
}

function renderCard(r) {
  const lines = [];
  lines.push('## 我的 AI 测试能力雷达');
  lines.push('');
  lines.push(`> ${r.date} · 总评 ${r.level.code} ${r.level.label}（${r.overall} 分）`);
  lines.push('');
  if (r.layers.length) {
    lines.push('| 能力层 | 得分 | 分布 |');
    lines.push('| :--- | ---: | :--- |');
    for (const l of r.layers) lines.push(`| ${l.name} | ${l.score} | ${bar(l.score)} |`);
    lines.push('');
  }
  if (r.weakest) lines.push(`**最短板**：${r.weakest.name}（${r.weakest.score} 分）`);
  if (r.strongest) lines.push(`**最强项**：${r.strongest.name}（${r.strongest.score} 分）`);
  lines.push('');
  lines.push('**下一步**');
  r.nextActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  lines.push('');
  lines.push('#AI测试转型 #测试人成长 #Skill工程师');
  return lines.join('\n');
}

function printReport(r, opts = {}) {
  console.log('\n===== AI 测试能力诊断 =====');
  if (r.infra && !r.infra.pass) console.log(`! 基础设施层 ${r.infra.score} 分：先补日志/进程/端口/资源基本功，再做专项提升\n`);

  if (r.layers.length) {
    console.log('五层雷达（0-100）');
    for (const l of r.layers) console.log(`  ${padName(l.name, 14)}${bar(l.score)} ${String(l.score).padStart(3)}  (${l.correct}/${l.total})`);
    console.log('');
  }
  console.log(`总评：${r.overall} 分 · ${r.level.code} ${r.level.label} —— ${r.level.hint}`);
  if (r.infra) console.log(`基础设施层（前置项，不计入雷达）：${r.infra.score} 分 ${r.infra.pass ? '达标' : '未达标'}`);

  if (r.weakest) {
    console.log('\n差距分析');
    for (const l of r.layers.slice().sort((a, b) => a.score - b.score)) {
      if (l.score >= CAP.thresholds.solid) continue;
      const tag = l.score < CAP.thresholds.weak ? '高危' : '待补';
      console.log(`- ${l.name} ${l.score} 分（${tag}）：${LAYER_MAP[l.key].desc}`);
    }
    if (r.layers.every(l => l.score >= CAP.thresholds.solid)) console.log('- 五层均在 70 分以上，按最强项的进阶任务巩固');
  }

  if (r.paths.length) {
    console.log('\n学习路径（按优先级）');
    r.paths.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}（${p.score} 分 / ${p.band}）—— ${p.focus}`);
      p.actions.forEach(a => console.log(`   - 做：${a}`));
      console.log(`   - 学：${p.resources.join('；')}`);
    });
  }

  if (r.wrong.length) {
    console.log('\n错题（按归因）');
    for (const w of r.wrong) {
      console.log(`- [${w.id}] ${w.q}`);
      console.log(`  你答：${w.given || '（未作答）'}｜参考：${w.ans}｜${BLIND[w.blind] || w.blind}`);
    }
    const dims = Object.entries(r.dims).filter(([, v]) => v > 0);
    if (dims.length) console.log(`归因统计：${dims.map(([k, v]) => `${BLIND[k] || k} ${v}`).join('，')}`);
  }

  if (opts.card) {
    console.log('\n===== 能力名片（可直接复制发布） =====\n');
    console.log(r.card);
  }
}

function printHistory() {
  const p = loadProgress();
  const h = (p.history || []).slice(-10);
  if (!h.length) {
    console.log('暂无历史记录，先跑一次诊断。');
    return;
  }
  console.log('最近 %d 次诊断：', h.length);
  for (const it of h) {
    const weak = it.layers ? Object.entries(it.layers).sort((a, b) => a[1] - b[1])[0] : null;
    console.log(`  ${it.date}  总评 ${String(it.overall ?? it.accuracy).padStart(3)}  ${bar(it.overall ?? it.accuracy)}${weak ? `  最短板 ${LAYER_MAP[weak[0]] ? LAYER_MAP[weak[0]].name : weak[0]} ${weak[1]}` : ''}`);
  }
}

// ---------- 交互 ----------
async function ask(questions) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answers = [];
  const typeLabel = { scenario: '场景', code: '代码', prompt: 'Prompt 调试', recall: '基础问答' };
  const q = text => new Promise(res => rl.question(text, res));
  for (const item of questions) {
    const tag = typeLabel[item.type] || '基础问答';
    console.log(`\n[${item.id}·${tag}·L${item.level || 1}] ${item.q}`);
    const given = await q('你的答案：');
    answers.push({ id: item.id, given });
  }
  rl.close();
  return answers;
}

// ---------- 主流程 ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.history) return printHistory();

  const progress = loadProgress();
  const preferIds = progress.wrongIds || [];
  let questions = [];
  let answers = [];

  if (args.grade || args.answersFile) {
    const raw = args.grade || fs.readFileSync(path.resolve(args.answersFile), 'utf8');
    const payload = JSON.parse(raw);
    answers = Array.isArray(payload) ? payload : payload.answers || [];
    questions = answers.map(a => BY_ID[a.id]).filter(Boolean);
    if (!questions.length) throw new Error('没有匹配到题号，检查 --grade 里的 id');
  } else if (args.basics || args.layer === 'basics') {
    questions = pick('basics', args.n, args.level, preferIds);
    console.log(`基本功回练 ${questions.length} 题（不计入五层雷达）`);
    answers = await ask(questions);
  } else {
    const keys = args.layer ? [args.layer] : LAYERS.map(l => l.key);
    for (const k of keys) {
      if (!BANK.banks[k]) throw new Error(`未知层：${k}，可选 ${Object.keys(BANK.banks).join(' / ')}`);
      questions.push(...pick(k, args.n, args.level, preferIds));
    }
    if (args.withInfra) questions.push(...pick('infra', CAP.sampling.infraDefault, args.level, preferIds));
    questions = shuffle(questions);
    console.log(`抽 ${questions.length} 题${args.level ? `（难度 ${args.level}）` : ''}，逐题作答，答不出直接回车：`);
    answers = await ask(questions);
  }

  const result = buildResult(questions, answers, args);
  if (args.save) saveProgress(result);

  const writeCard = () => {
    const file = path.resolve(args.card);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, result.card + '\n');
    return file;
  };

  if (args.json) {
    if (args.card) writeCard();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printReport(result, { card: true });
  if (args.card) console.log(`\n能力名片已写入 ${writeCard()}`);
  console.log('\nJSON 结果可用 --json 输出；历史趋势用 --history。');
}

main().catch(e => {
  console.error('执行失败：', e.message);
  process.exit(1);
});
