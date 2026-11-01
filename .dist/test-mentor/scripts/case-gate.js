#!/usr/bin/env node
// 用例质量门禁：站在生成器下游，对 AI 生成的用例做五维检查 → 覆盖率评分 → 遗漏场景补全 → 风险分级
const fs = require('fs');
const path = require('path');

const PRIORITY = ['P0', 'P1', 'P2', 'P3'];
const METHODS = ['等价类划分', '边界值', '错误推测', '判定表', '因果图', '正交表', '场景法', '状态图', '大纲法'];
const REQUIRED = ['id', 'module', 'title', 'precondition', 'steps', 'data', 'expected', 'actual', 'priority', 'type', 'method'];
const NEGATIVE = /非法|异常|错误|超长|空值|为空|null|负数|特殊字符|重复提交|越界|不支持|截断|报错|失败|拒绝/;
const BOUNDARY = /等于|略大|略小|上限|下限|边界|最大|最小|超一|不足|三位置/;

function loadCases(input) {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.cases)) return input.cases;
  if (input && Array.isArray(input.data)) return input.data;
  throw new Error('无法识别用例结构：期望 JSON 数组或 { "cases": [...] }');
}

function text(c) {
  return [c.title, c.type, c.data, c.precondition, c.expected, c.actual, (c.steps || []).join(' ')].join(' ').toLowerCase();
}

function isNegative(c) {
  return NEGATIVE.test([c.title, c.data, c.type].join(' '));
}

const CHECKS = [
  // 功能覆盖
  { id: 'F1', dim: '功能覆盖', weight: 1, name: '主流程正向用例', test: cs => cs.some(c => !isNegative(c) && ['P0', 'P1'].includes(c.priority)), suggest: '补一条 P0/P1 主流程正向用例，覆盖用户最常走的那条路径' },
  { id: 'F2', dim: '功能覆盖', weight: 1.5, critical: true, name: '负例与边界占比 ≥ 40%', test: cs => cs.filter(c => isNegative(c) || c.method === '边界值').length / Math.max(1, cs.length) >= 0.4, suggest: '负例与边界用例不足 40%：按「非法输入、空值、超长、越界、重复提交」各补一条' },
  { id: 'F3', dim: '功能覆盖', weight: 1, name: '权限与角色分支', test: cs => cs.some(c => /权限|角色|越权|未登录|登录态|鉴权|管理员|普通用户/.test(text(c))), suggest: '补权限用例：未登录、越权访问、不同角色可见范围' },
  { id: 'F4', dim: '功能覆盖', weight: 1, name: '状态与连续操作', test: cs => cs.some(c => /状态|连续|重复|中断|恢复|回滚|重试|并发/.test(text(c))), suggest: '补状态类用例：重复提交、操作中断后恢复、回滚' },
  { id: 'F5', dim: '功能覆盖', weight: 1, name: '模块覆盖 ≥ 2', test: cs => new Set(cs.map(c => c.module).filter(Boolean)).size >= 2, suggest: '用例集中在单一模块：确认是否漏了关联模块，或显式声明本期只测该模块' },

  // 数据设计
  { id: 'D1', dim: '数据设计', weight: 1.5, critical: true, name: '边界值取三位置', test: cs => cs.some(c => c.method === '边界值' && BOUNDARY.test(text(c))), suggest: '边界值未落三位置：至少给「等于 / 略大 / 略小」三组数据，标在 data 字段里' },
  { id: 'D2', dim: '数据设计', weight: 1, name: '空值与 null', test: cs => cs.some(c => /空值|为空|不填|null|空字符串/.test(text(c))), suggest: '补空值用例：字段不填、传空字符串、传 null 三种情况' },
  { id: 'D3', dim: '数据设计', weight: 1, name: '超长与特殊字符', test: cs => cs.some(c => /超长|特殊字符|emoji|中文|空格|xss|sql|注入/.test(text(c))), suggest: '补超长与特殊字符：边界长度+1、emoji、引号与 SQL/XSS 片段' },
  { id: 'D4', dim: '数据设计', weight: 1, name: '类型与格式非法', test: cs => cs.some(c => /非法|格式|类型|非数字|负数|小数|超出范围/.test(text(c))), suggest: '补类型/格式非法用例：字符串塞进数字字段、错误日期格式、超范围数值' },
  { id: 'D5', dim: '数据设计', weight: 1, name: '数据可构造', test: cs => cs.filter(c => c.data && String(c.data).trim() && !/^(任意|随便|随机|无)$/.test(String(c.data).trim())).length / Math.max(1, cs.length) >= 0.8, suggest: '部分用例 data 写「任意/随便」，执行时无法复现：改成具体取值' },

  // 可执行性
  { id: 'E1', dim: '可执行性', weight: 1, name: '前置条件明确', test: cs => cs.filter(c => c.precondition && String(c.precondition).trim()).length / Math.max(1, cs.length) >= 0.8, suggest: '前置条件缺失：写清账号状态、数据准备、环境与版本' },
  { id: 'E2', dim: '可执行性', weight: 1.5, critical: true, name: '一步一个操作', test: cs => { const all = cs.flatMap(c => c.steps || []); return all.length > 0 && all.filter(s => /并且|然后|同时|接着/.test(s)).length / all.length <= 0.1; }, suggest: '存在多动作合并的步骤：拆成一步一个操作，否则失败时无法定位是哪一步' },
  { id: 'E3', dim: '可执行性', weight: 1.5, critical: true, name: '预期结果可判定', test: cs => cs.filter(c => judgeable(c.expected)).length / Math.max(1, cs.length) >= 0.8, suggest: '预期结果不可判定：把「正常/正确/符合预期」改成可观察的断言（具体文案、状态码、字段值）' },
  { id: 'E4', dim: '可执行性', weight: 0.5, name: '用例相互独立', test: cs => !cs.some(c => /见用例|依赖上一条|上一用例|承接/.test(text(c))), suggest: '存在用例间依赖：改成自带前置条件的独立用例，否则无法单独重跑' },
  { id: 'E5', dim: '可执行性', weight: 0.5, name: '编号与标题唯一', test: cs => new Set(cs.map(c => c.id)).size === cs.length && new Set(cs.map(c => c.title)).size === cs.length, suggest: '存在重复编号或重复标题：去重后再提交评审' },

  // 集成与契约
  { id: 'I1', dim: '集成与契约', weight: 1, name: '错误码与 message 校验', test: cs => cs.some(c => /错误码|状态码|error|message|4\d\d|5\d\d/.test(text(c))), suggest: '补接口契约用例：校验错误码与 message 文案，不只校验「失败」' },
  { id: 'I2', dim: '集成与契约', weight: 1, name: '幂等与重试', test: cs => cs.some(c => /幂等|重试|重复提交|重复请求/.test(text(c))), suggest: '补幂等用例：同一请求重复提交两次，验证只生效一次' },
  { id: 'I3', dim: '集成与契约', weight: 1, name: '超时、限流与降级', test: cs => cs.some(c => /超时|限流|熔断|降级|并发/.test(text(c))), suggest: '补超时与限流用例：下游超时、触发限流、降级后的表现' },
  { id: 'I4', dim: '集成与契约', weight: 1, name: '上下游联动', test: cs => cs.some(c => /联动|前台|下游|上游|同步|回调|通知/.test(text(c))), suggest: '补联动验证：本模块操作后，下游/前台是否同步可见' },

  // 非功能
  { id: 'N1', dim: '非功能', weight: 1, name: '性能与并发', test: cs => cs.some(c => /性能|并发|压测|响应时间|qps|tps/.test(text(c))), suggest: '补性能用例：给出响应时间目标与并发量，并说明观测方式' },
  { id: 'N2', dim: '非功能', weight: 1, name: '安全', test: cs => cs.some(c => /安全|越权|注入|xss|sql|鉴权|脱敏|敏感/.test(text(c))), suggest: '补安全用例：越权、注入、敏感信息脱敏' },
  { id: 'N3', dim: '非功能', weight: 1, name: '兼容性', test: cs => cs.some(c => /兼容|浏览器|分辨率|机型|版本|ios|android/.test(text(c))), suggest: '补兼容用例：目标浏览器/机型/版本矩阵各一条' },
  { id: 'N4', dim: '非功能', weight: 1, name: '可观测性', test: cs => cs.some(c => /日志|埋点|监控|告警|trace|链路/.test(text(c))), suggest: '补可观测性验证：失败时日志是否有可定位信息、是否触发告警' }
];

function judgeable(expected) {
  const e = String(expected || '').trim();
  if (e.length < 6) return false;
  return !/^(正常|正确|成功|符合预期|无异常|没问题|显示正常)[。.!！]?$/.test(e);
}

function stats(cases) {
  const allSteps = cases.flatMap(c => c.steps || []);
  const negative = cases.filter(isNegative);
  const boundary = cases.filter(c => c.method === '边界值');
  const both = cases.filter(c => isNegative(c) || c.method === '边界值');
  return {
    total: cases.length,
    modules: [...new Set(cases.map(c => c.module).filter(Boolean))],
    negativeCount: negative.length,
    boundaryCount: boundary.length,
    negativeOrBoundaryRatio: Math.round((both.length / Math.max(1, cases.length)) * 100) / 100,
    avgSteps: Math.round((allSteps.length / Math.max(1, cases.length)) * 10) / 10,
    multiActionSteps: allSteps.filter(s => /并且|然后|同时|接着/.test(s)).length,
    priorityDist: PRIORITY.reduce((m, p) => (m[p] = cases.filter(c => c.priority === p).length, m), {}),
    methodsUsed: [...new Set(cases.map(c => c.method).filter(Boolean))]
  };
}

function review(cases, minScore = 70) {
  const s = stats(cases);
  const checks = CHECKS.map(c => {
    const hit = Boolean(c.test(cases));
    return { id: c.id, dimension: c.dim, name: c.name, weight: c.weight, critical: Boolean(c.critical), hit, suggest: c.suggest };
  });
  const totalWeight = checks.reduce((a, c) => a + c.weight, 0);
  const hitWeight = checks.filter(c => c.hit).reduce((a, c) => a + c.weight, 0);
  const score = Math.round((hitWeight / totalWeight) * 100);

  const dims = {};
  for (const c of checks) {
    const d = dims[c.dimension] || (dims[c.dimension] = { weight: 0, hit: 0 });
    d.weight += c.weight;
    if (c.hit) d.hit += c.weight;
  }
  const coverage = Object.entries(dims).map(([name, d]) => ({ dimension: name, score: Math.round((d.hit / d.weight) * 100) }));

  const failedCritical = checks.filter(c => c.critical && !c.hit);
  let risk = '低';
  if (score < 50 || failedCritical.some(c => c.id === 'F2') || failedCritical.length >= 2) risk = '高';
  else if (score < 75 || failedCritical.length >= 1) risk = '中';

  const gaps = checks.filter(c => !c.hit).map(c => ({ dimension: c.dimension, check: `${c.id} ${c.name}`, suggestion: c.suggest }));
  const verdict = score >= minScore && failedCritical.length === 0 ? 'pass' : 'fail';

  return {
    verdict,
    score,
    risk,
    minScore,
    totalCases: cases.length,
    coverage,
    criticalFailed: failedCritical.map(c => `${c.id} ${c.name}`),
    checks,
    gaps,
    missingScenarios: gaps.map(g => g.suggestion),
    nextActions: gaps.slice(0, 3).map(g => g.suggestion),
    stats: s
  };
}

function fieldIssues(cases) {
  const issues = [];
  cases.forEach((c, i) => {
    const id = c.id || `#${i + 1}`;
    REQUIRED.forEach(f => {
      if (c[f] === undefined || c[f] === null) issues.push({ id, field: f, issue: '缺失' });
      else if (f === 'steps' && (!Array.isArray(c[f]) || !c[f].length)) issues.push({ id, field: f, issue: '步骤为空' });
      else if (!['actual', 'precondition'].includes(f) && c[f] === '') issues.push({ id, field: f, issue: '空字符串' });
    });
    if (c.priority && !PRIORITY.includes(String(c.priority).toUpperCase())) issues.push({ id, field: 'priority', issue: `非法取值 ${c.priority}` });
    if (c.method && !METHODS.includes(c.method)) issues.push({ id, field: 'method', issue: `非法取值 ${c.method}` });
  });
  return issues;
}

function printReport(r, issues) {
  console.log('\n===== 用例质量门禁 =====');
  console.log(`结论：${r.verdict === 'pass' ? '通过' : '不通过'}｜覆盖率评分 ${r.score}/100（阈值 ${r.minScore}）｜风险 ${r.risk}`);
  console.log(`用例数 ${r.totalCases}｜模块 ${r.stats.modules.join('、') || '未标注'}｜负例+边界占比 ${Math.round(r.stats.negativeOrBoundaryRatio * 100)}%｜平均步骤 ${r.stats.avgSteps}`);

  console.log('\n五维覆盖率');
  for (const c of r.coverage) console.log(`  ${c.dimension}：${c.score}`);

  if (r.criticalFailed.length) {
    console.log('\n关键项未通过（直接阻断）');
    r.criticalFailed.forEach(c => console.log(`- ${c}`));
  }
  if (r.gaps.length) {
    console.log('\n遗漏场景补全建议');
    r.gaps.forEach((g, i) => console.log(`${i + 1}. [${g.dimension}] ${g.suggestion}`));
  } else {
    console.log('\n未发现缺口。');
  }
  if (issues.length) {
    console.log('\n字段问题（前 10 条）');
    issues.slice(0, 10).forEach(i => console.log(`- ${i.id} ${i.field}: ${i.issue}`));
  }
}

function markdown(r, issues) {
  const lines = [];
  lines.push('# 用例质量评审报告');
  lines.push('');
  lines.push(`- 结论：**${r.verdict === 'pass' ? '通过' : '不通过'}**`);
  lines.push(`- 覆盖率评分：**${r.score} / 100**（阈值 ${r.minScore}）`);
  lines.push(`- 风险等级：**${r.risk}**`);
  lines.push(`- 用例数：${r.totalCases}｜负例+边界占比：${Math.round(r.stats.negativeOrBoundaryRatio * 100)}%｜平均步骤：${r.stats.avgSteps}`);
  lines.push('');
  lines.push('## 五维覆盖率');
  lines.push('| 维度 | 得分 |');
  lines.push('| :--- | ---: |');
  r.coverage.forEach(c => lines.push(`| ${c.dimension} | ${c.score} |`));
  lines.push('');
  if (r.criticalFailed.length) {
    lines.push('## 关键项阻断');
    r.criticalFailed.forEach(c => lines.push(`- ${c}`));
    lines.push('');
  }
  lines.push('## 遗漏场景补全建议');
  if (r.gaps.length) r.gaps.forEach((g, i) => lines.push(`${i + 1}. **${g.dimension}**｜${g.suggestion}`));
  else lines.push('未发现缺口。');
  lines.push('');
  lines.push('## 逐项检查');
  lines.push('| 检查项 | 维度 | 权重 | 结果 |');
  lines.push('| :--- | :--- | ---: | :--- |');
  r.checks.forEach(c => lines.push(`| ${c.id} ${c.name}${c.critical ? '（关键）' : ''} | ${c.dimension} | ${c.weight} | ${c.hit ? '通过' : '未通过'} |`));
  if (issues.length) {
    lines.push('');
    lines.push('## 字段问题');
    issues.slice(0, 20).forEach(i => lines.push(`- ${i.id} \`${i.field}\`：${i.issue}`));
  }
  return lines.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const get = (flag, def) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
  };
  const file = get('--file');
  const json = argv.includes('--json');
  const md = argv.includes('--md');
  const min = Number(get('--min', 70));
  let raw;
  if (file) raw = fs.readFileSync(path.resolve(file), 'utf8');
  else if (argv.length && !argv[0].startsWith('--')) raw = argv[0];
  else raw = fs.readFileSync(0, 'utf8');

  const input = JSON.parse(raw);
  const cases = loadCases(input);
  const issues = fieldIssues(cases);
  const result = review(cases, min);
  result.fieldIssues = issues;

  if (json) console.log(JSON.stringify(result, null, 2));
  else if (md) console.log(markdown(result, issues));
  else printReport(result, issues);

  if (result.verdict !== 'pass') process.exit(1);
}

try {
  main();
} catch (e) {
  console.error('执行失败：', e.message);
  process.exit(2);
}