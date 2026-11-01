#!/usr/bin/env node
// Agent 与 Skill 运行时排障：行为漂移 / 跨引擎不一致 / MCP 调用失败 / Agent 死循环
// 边界：只做 Agent 与 Skill 基础设施层排障，不涉及应用崩溃、内存泄漏等应用层故障分析（与鸿蒙 DFX Skills 互补）
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');

const USAGE = `用法：
  node scripts/agent-diag.js drift  --baseline a.json --current b.json [--threshold 0.85]
  node scripts/agent-diag.js engine --a engine-a.json --b engine-b.json [--threshold 0.85]
  node scripts/agent-diag.js mcp    --config mcp.json [--timeout 2000]
  node scripts/agent-diag.js loop   --trace trace.jsonl [--max-steps 40] [--repeat 3]
公共参数：--json 只输出 JSON；退出码 0 未发现问题，1 发现问题`;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function readJsonl(file) {
  return fs.readFileSync(path.resolve(file), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map((l, i) => {
      try { return JSON.parse(l); } catch { throw new Error(`第 ${i + 1} 行不是合法 JSON`); }
    });
}

function normText(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '').trim();
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
  if (x === y) return 1;
  if (!x || !y) return 0;
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0;
  const mx = bigrams(x);
  const my = bigrams(y);
  let inter = 0;
  for (const [g, n] of mx) inter += Math.min(n, my.get(g) || 0);
  return (2 * inter) / (x.length - 1 + y.length - 1);
}

function base(mode, category) {
  return { mode, verdict: 'pass', category, summary: '', findings: [], rootCause: [], fixes: [], regression: [] };
}

function finish(r) {
  r.verdict = r.findings.length ? 'fail' : 'pass';
  r.summary = r.findings.length
    ? `${r.category}：发现 ${r.findings.length} 处问题`
    : `${r.category}：未发现问题`;
  return r;
}

// ---------- 1. Skill 行为漂移 ----------
function runDrift() {
  const baseline = readJson(arg('--baseline'));
  const current = readJson(arg('--current'));
  const threshold = Number(arg('--threshold', 0.85));
  const r = base('drift', 'Skill 行为漂移');
  const baseCases = baseline.cases || [];
  const curMap = new Map((current.cases || []).map(c => [c.id, c]));
  const drifted = [];

  for (const b of baseCases) {
    const c = curMap.get(b.id);
    if (!c) {
      r.findings.push({ level: 'fail', title: `用例 ${b.id} 在当前版本缺失`, detail: '当前版本没有返回该用例结果，视为覆盖退化' });
      drifted.push(b.id);
      continue;
    }
    const sim = similarity(b.output, c.output);
    if (sim < threshold) {
      drifted.push(b.id);
      r.findings.push({
        level: 'fail',
        title: `用例 ${b.id} 输出漂移（相似度 ${sim.toFixed(2)} < ${threshold}）`,
        detail: `基线：${String(b.output || '').slice(0, 80)}…｜当前：${String(c.output || '').slice(0, 80)}…`
      });
    }
  }

  if (baseline.version && current.version && baseline.version !== current.version) {
    r.rootCause.push(`版本从 ${baseline.version} 变为 ${current.version}：优先核对本次版本的系统提示、工具描述与依赖变更`);
  }
  if (drifted.length === baseCases.length && baseCases.length) {
    r.rootCause.push('全部用例都漂移：怀疑全局性变更（模型版本、系统提示、默认参数），而不是个别分支');
  } else if (drifted.length) {
    r.rootCause.push(`仅 ${drifted.length}/${baseCases.length} 条用例漂移：检查这些用例覆盖的输入分支、工具与依赖数据`);
  }

  r.fixes.push('逐项对比两版系统提示、工具 description 与模型参数，一次只回滚一项做二分定位');
  r.fixes.push('给输出加结构校验（字段齐全、枚举合法），结构变化直接判失败，不靠肉眼');
  r.fixes.push('把漂移样本加入回归集，固定输入与参数，后续每次升级前后各跑一次');
  r.regression.push(`恢复基线配置重跑同一批用例，相似度应全部 ≥ ${threshold}`);
  r.regression.push('连续跑 3 次确认结果稳定，再重新发布');
  return finish(r);
}

// ---------- 2. 跨引擎不一致 ----------
function runEngine() {
  const a = readJson(arg('--a'));
  const b = readJson(arg('--b'));
  const threshold = Number(arg('--threshold', 0.85));
  const r = base('engine', '跨引擎不一致');
  const bMap = new Map((b.cases || []).map(c => [c.id, c]));

  for (const ca of a.cases || []) {
    const cb = bMap.get(ca.id);
    if (!cb) {
      r.findings.push({ level: 'fail', title: `用例 ${ca.id} 在引擎 ${b.engine || 'B'} 缺失`, detail: '一侧没有执行该用例，无法比较' });
      continue;
    }
    const sim = similarity(ca.output, cb.output);
    const toolA = (ca.toolCalls || []).join(',');
    const toolB = (cb.toolCalls || []).join(',');
    if (Boolean(ca.pass) !== Boolean(cb.pass)) {
      r.findings.push({ level: 'fail', title: `用例 ${ca.id} 判定不一致`, detail: `${a.engine || 'A'}=${ca.pass ? '通过' : '失败'}，${b.engine || 'B'}=${cb.pass ? '通过' : '失败'}，输出相似度 ${sim.toFixed(2)}` });
    } else if (sim < threshold) {
      r.findings.push({ level: 'fail', title: `用例 ${ca.id} 输出不一致（相似度 ${sim.toFixed(2)}）`, detail: `A：${String(ca.output || '').slice(0, 60)}…｜B：${String(cb.output || '').slice(0, 60)}…` });
    }
    if (toolA !== toolB) {
      r.findings.push({ level: 'warn', title: `用例 ${ca.id} 工具选择不同`, detail: `A=${toolA || '无'}｜B=${toolB || '无'}` });
    }
  }

  r.rootCause.push('同输出不同判定：两边判定脚本或阈值不一致，不是模型问题');
  r.rootCause.push('输出差异大：两引擎的默认采样参数、上下文窗口或工具描述不同');
  r.rootCause.push('工具选择不同：工具描述含糊或可见工具集不一致');
  r.fixes.push('统一判定脚本与阈值，两个引擎只负责产出，不各自判定');
  r.fixes.push('固定 temperature 等采样参数，统一工具清单与 description 文案');
  r.fixes.push('把不一致样本登记进跨引擎回归集，标注允许差异');
  r.regression.push('两引擎重跑同一批用例，差异项为 0 或已登记为允许差异');
  r.regression.push('新增用例必须双引擎各跑一次才能进主干');
  return finish(r);
}

// ---------- 3. MCP 调用失败 ----------
function which(cmd) {
  const bin = process.platform === 'win32' ? 'where' : 'which';
  const out = spawnSync(bin, [cmd], { encoding: 'utf8' });
  return out.status === 0 && String(out.stdout || '').trim().length > 0;
}

function tcpCheck(host, port, timeout) {
  return new Promise(resolve => {
    const socket = net.connect({ host, port });
    let done = false;
    const end = ok => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout, () => end(false));
    socket.once('connect', () => end(true));
    socket.once('error', () => end(false));
  });
}

function mask(v) {
  const s = String(v);
  return s.length <= 6 ? '***' : `${s.slice(0, 3)}***${s.slice(-2)}`;
}

async function runMcp() {
  const cfg = readJson(arg('--config'));
  const timeout = Number(arg('--timeout', 2000));
  const servers = cfg.mcpServers || cfg.servers || cfg;
  const r = base('mcp', 'MCP 调用失败');
  if (!servers || typeof servers !== 'object') throw new Error('配置里没有 mcpServers/servers 段');

  for (const [name, s] of Object.entries(servers)) {
    if (!s || typeof s !== 'object') continue;
    if (s.command) {
      if (!which(s.command)) {
        r.findings.push({ level: 'fail', title: `${name} 启动命令不存在：${s.command}`, detail: '客户端会直接启动失败，工具列表里看不到任何工具' });
      }
      for (const [k, v] of Object.entries(s.env || {})) {
        const refs = String(v).match(/\$\{([A-Z0-9_]+)\}/g) || [];
        for (const ref of refs) {
          const varName = ref.slice(2, -1);
          if (!process.env[varName]) {
            r.findings.push({ level: 'warn', title: `${name} 环境变量未注入：${varName}`, detail: `env.${k} 引用了 \${${varName}}，当前进程看不到它，握手或鉴权会失败` });
          }
        }
      }
    } else if (s.url) {
      let u;
      try { u = new URL(s.url); } catch { r.findings.push({ level: 'fail', title: `${name} 的 url 非法：${s.url}`, detail: '无法解析，客户端不会发起连接' }); continue; }
      const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
      const ok = await tcpCheck(u.hostname, port, timeout);
      if (!ok) r.findings.push({ level: 'fail', title: `${name} 端口不可达：${u.hostname}:${port}`, detail: `${timeout}ms 内未建立连接，先确认服务是否启动、网络与白名单是否放通` });
    } else {
      r.findings.push({ level: 'fail', title: `${name} 缺少 command 或 url`, detail: 'stdio 需要 command，远程需要 url' });
    }

    for (const [k, v] of Object.entries(s.headers || {})) {
      if (/^bearer\s+[a-z0-9._-]{8,}$/i.test(String(v)) || /sk-[a-z0-9]{8,}/i.test(String(v))) {
        r.findings.push({ level: 'warn', title: `${name} 配置中出现明文凭据：${k}=${mask(v)}`, detail: '配置文件会被提交与分享，凭据应走环境变量并轮换' });
      }
    }
    for (const [, v] of Object.entries(s.env || {})) {
      if (/sk-[a-z0-9]{8,}/i.test(String(v))) {
        r.findings.push({ level: 'warn', title: `${name} 的 env 中出现明文凭据`, detail: '改为引用环境变量，不要写进 Skill 或仓库' });
      }
    }
  }

  r.rootCause.push('命令/路径错误或未安装：stdio Server 起不来');
  r.rootCause.push('环境变量未注入：配置里的 ${VAR} 在客户端进程里不存在');
  r.rootCause.push('远程地址不可达：服务未启动、端口错、网络或白名单未放通');
  r.fixes.push('启动命令改用绝对路径或 npx -y，先在终端手动跑一次确认能起来');
  r.fixes.push('把变量注入客户端启动环境，改完重启客户端让配置生效');
  r.fixes.push('远程 Server 先查端口与健康检查接口，再查鉴权头');
  r.fixes.push('明文凭据移到环境变量，并轮换已经出现在配置里的值');
  r.regression.push('重跑 mcp 自检，所有 Server 状态为 ok');
  r.regression.push('调用一个只读工具，确认返回结构符合预期');
  return finish(r);
}

// ---------- 4. Agent 死循环 ----------
function keyOf(e) {
  return `${e.tool || e.action || 'unknown'}|${JSON.stringify(e.args || {})}`;
}

function runLoop() {
  const trace = readJsonl(arg('--trace'));
  const maxSteps = Number(arg('--max-steps', 40));
  const repeat = Number(arg('--repeat', 3));
  const r = base('loop', 'Agent 死循环');

  if (trace.length > maxSteps) {
    r.findings.push({ level: 'fail', title: `步数超限：${trace.length} > ${maxSteps}`, detail: `步骤样本：${trace.slice(0, 3).map(e => e.tool || e.action || '?').join(' → ')}…` });
  }

  const counts = new Map();
  for (const e of trace) {
    const k = keyOf(e);
    const item = counts.get(k) || { n: 0, steps: [] };
    item.n++;
    item.steps.push(e.step);
    counts.set(k, item);
  }
  for (const [k, v] of counts) {
    if (v.n >= repeat) {
      const [tool, args] = k.split('|');
      r.findings.push({ level: 'fail', title: `同工具同参数重复调用 ${v.n} 次：${tool}`, detail: `步骤 ${v.steps.join(',')} 参数 ${args}` });
    }
  }

  const keys = trace.map(keyOf);
  for (let i = 0; i + 4 <= keys.length; i++) {
    if (keys[i] === keys[i + 2] && keys[i + 1] === keys[i + 3] && keys[i] !== keys[i + 1]) {
      r.findings.push({ level: 'warn', title: `检测到往复循环：${keys[i].split('|')[0]} ⇄ ${keys[i + 1].split('|')[0]}`, detail: `从步骤 ${trace[i].step} 开始出现 A→B→A→B` });
      break;
    }
  }

  const outCount = new Map();
  for (const e of trace) {
    const o = normText(e.output);
    if (!o) continue;
    outCount.set(o, (outCount.get(o) || 0) + 1);
  }
  for (const [o, n] of outCount) {
    if (n >= repeat) {
      r.findings.push({ level: 'warn', title: `输出无进展：同一结果重复 ${n} 次`, detail: `重复内容：${o.slice(0, 60)}…` });
      break;
    }
  }

  const errors = trace.filter(e => e.error || /timeout|超时|失败|error/i.test(String(e.output || '')));
  if (errors.length >= repeat) {
    r.findings.push({ level: 'warn', title: `错误后原样重试 ${errors.length} 次`, detail: `步骤 ${errors.map(e => e.step).join(',')}：没有改变策略或参数` });
  }

  r.rootCause.push('缺少终止条件：提示层没写「何时停」，运行时也没设最大步数与超时');
  r.rootCause.push('工具返回无新增信息：同参数必然同结果，模型只能反复试');
  r.rootCause.push('错误处理缺失：失败后照原样重试，不换工具也不上报');
  r.fixes.push('提示层写终止规则，运行时再加最大步数、预算、超时三层保险');
  r.fixes.push('同工具同参数第二次失败后，强制换参数或换工具，仍失败则中止并回报');
  r.fixes.push('让工具返回带区分度的信息（如「无结果」要说明原因），避免模型无信息可判断');
  r.fixes.push('任务描述补成功标准与边界，减少反复确认');
  r.regression.push(`用同一轨迹重跑，同工具同参数调用次数应 ≤ 2，总步数 < ${maxSteps}`);
  r.regression.push('把该轨迹加入回归集，每次改提示词或工具后重跑');
  return finish(r);
}

// ---------- 输出 ----------
function printReport(r) {
  console.log(`\n===== Agent / Skill 运行时排障：${r.category} =====`);
  console.log(`结论：${r.verdict === 'pass' ? '正常' : '发现问题'}｜${r.summary}`);
  if (r.findings.length) {
    console.log('\n证据');
    r.findings.forEach((f, i) => console.log(`${i + 1}. [${f.level}] ${f.title}\n   ${f.detail || ''}`));
  }
  if (r.rootCause.length) {
    console.log('\n根因定位（按优先级）');
    r.rootCause.forEach(c => console.log(`- ${c}`));
  }
  if (r.fixes.length) {
    console.log('\n修复建议');
    r.fixes.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  }
  if (r.regression.length) {
    console.log('\n回归验证步骤');
    r.regression.forEach((s, i) => console.log(`${i + 1}. ${s}`));
  }
}

async function main() {
  const mode = process.argv[2];
  const modes = { drift: runDrift, engine: runEngine, mcp: runMcp, loop: runLoop };
  if (!modes[mode]) {
    console.log(USAGE);
    process.exit(mode ? 2 : 0);
  }
  const r = await modes[mode]();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else printReport(r);
  if (r.verdict !== 'pass') process.exit(1);
}

main().catch(e => {
  console.error('执行失败：', e.message);
  process.exit(2);
});
