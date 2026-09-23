// 各家 agent 的会话记录（Claude Code / claude.ai / Codex / Kimi 等 OpenAI 格式 / Antigravity / ChatGPT 导出）-> 可渲染的 turns。
// 无 DOM，无依赖。

const NOISE = new Set([
  'queue-operation', 'attachment', 'last-prompt', 'custom-title',
  'bridge-session', 'atis-latch', 'file-history-snapshot', 'summary',
]);

const EMPTY_USAGE = () => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });

export function parseJsonl(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { rows.push(JSON.parse(s)); } catch { /* truncated or corrupt line */ }
  }
  return rows;
}

const asText = (c) => {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(b => typeof b === 'string' ? b : (b?.text ?? `[${b?.type || 'block'}]`)).join('\n');
  if (c == null) return '';
  return JSON.stringify(c, null, 2);
};

// system-reminder 会淹掉人真正打的字
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
function splitReminders(text) {
  const hidden = text.match(REMINDER) || [];
  return { text: text.replace(REMINDER, '').trim(), hidden };
}

// 一个文件可能是一条 Claude Code 会话，也可能是一整包 claude.ai 导出（多条对话）。
// 所以统一返回数组。
export function loadFile(text, name = '') {
  let data = null;
  try { data = JSON.parse(text); } catch { /* 多半是 jsonl */ }
  const convs = Array.isArray(data) ? data : data?.conversations;
  if (Array.isArray(convs) && convs.some(c => c?.mapping))
    return convs.map(fromChatGPT).filter(s => s.turns.length);
  if (Array.isArray(convs) && convs.some(c => c?.chat_messages || c?.messages))
    return convs.map(fromClaudeAi).filter(s => s.turns.length);
  const msgs = Array.isArray(data) ? data : data?.messages;       // 整个文件就是一个 OpenAI messages 数组
  if (Array.isArray(msgs) && msgs.some(m => m?.role)) return keep(fromOpenAI(msgs, name));

  const rows = parseJsonl(text);
  if (rows.some(r => r?.type === 'session_meta' || r?.type === 'response_item')) return keep(fromCodex(rows, name));
  if (rows.some(r => r?.step_index != null && r?.type === 'USER_INPUT')) return keep(fromAntigravity(rows, name));
  if (rows.some(r => r?.role && !r.type && !r.message)) return keep(fromOpenAI(rows, name));
  return keep(buildSession(rows, name));
}
const keep = s => s.turns.length ? [s] : [];

// --- 其他家 agent 的记录 -------------------------------------------------------
// 都拼成和 buildSession 一样的形状：同一角色连续的块并进一轮，工具结果挂回调用上。
function acc(name, source) {
  const s = { name, source, turns: [], usage: EMPTY_USAGE(), start: null, end: null };
  const models = new Set(), tools = new Map();
  let cur = null;
  return {
    s, models,
    time(ts) { if (ts) { s.start = s.start ?? ts; s.end = ts; } },
    push(role, block, ts) {
      if (!cur || cur.role !== role) s.turns.push(cur = { role, ts, sidechain: false, blocks: [] });
      if (block.kind === 'tool') tools.set(block.name, (tools.get(block.name) || 0) + 1);
      cur.blocks.push(block);
      return block;
    },
    done() {
      // 文件名是 context.jsonl / transcript.jsonl 这种的，拿第一句人话当名字
      const first = s.turns.filter(t => t.role === 'user').flatMap(t => t.blocks).find(b => b.kind === 'text')?.text;
      if (first && /^(context|transcript|wire|messages)\.jsonl?$|^$/i.test(s.name)) s.name = first.replace(/\s+/g, ' ').slice(0, 40);
      return { ...s, models: [...models], tools: [...tools.entries()].sort((a, b) => b[1] - a[1]) };
    },
  };
}
const failed = t => /^(<system>)?ERROR\b|Exit code: [1-9]|exited with code [1-9]/m.test(String(t).slice(0, 3000));
const json = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
const args = v => { const o = json(v); return o && typeof o === 'object' ? o : { input: v ?? '' }; };
const parts = c => typeof c === 'string' ? [{ text: c }] : Array.isArray(c) ? c.map(b => typeof b === 'string' ? { text: b } : b || {}) : [];

// OpenAI Codex CLI / Codex Desktop：~/.codex/sessions/**/rollout-*.jsonl
function fromCodex(rows, name) {
  const a = acc(name, 'Codex'), calls = new Map();
  for (const r of rows) {
    const p = r.payload || {}, ts = r.timestamp;
    a.time(ts);
    if (r.type === 'session_meta') Object.assign(a.s, { sessionId: p.id, cwd: p.cwd, version: p.cli_version });
    else if (r.type === 'turn_context' && p.model) a.models.add(p.model);
    else if (r.type === 'event_msg' && p.type === 'token_count' && p.info?.total_token_usage) {
      const u = p.info.total_token_usage;                      // 累计值，取最后一条
      a.s.usage = { input: u.input_tokens - (u.cached_input_tokens || 0), output: u.output_tokens || 0,
        cacheWrite: u.cache_write_input_tokens || 0, cacheRead: u.cached_input_tokens || 0 };
    } else if (r.type !== 'response_item') continue;
    else if (p.type === 'message' && (p.role === 'user' || p.role === 'assistant')) {
      // 用户消息里混着 AGENTS.md、环境信息；有 kinds 就按 kinds 分，没有就看开头
      const kinds = p.internal_chat_message_metadata_passthrough?.content_item_kinds;
      (p.content || []).forEach((c, i) => {
        if (!c.text?.trim()) return;
        const injected = p.role === 'user' && (kinds?.length === p.content.length ? kinds[i] !== 'user.text' : /^(<|# AGENTS\.md)/.test(c.text));
        a.push(p.role, injected ? { kind: 'fold', label: '系统提示', text: c.text } : { kind: 'text', text: c.text }, ts);
      });
    } else if (p.type === 'reasoning') {
      a.push('assistant', { kind: 'thinking', text: (p.summary || []).map(x => x.text).join('\n') || '[加密的推理]' }, ts);
    } else if (/_call$/.test(p.type)) {
      calls.set(p.call_id, a.push('assistant', { kind: 'tool', name: p.name || p.type.replace(/_call$/, ''),
        input: args(p.arguments ?? p.input ?? p.action), result: null }, ts));
    } else if (/_output$/.test(p.type)) {
      const b = calls.get(p.call_id), t = asText(p.output);
      if (b) b.result = { text: t, isError: failed(t) };
    }
  }
  return a.done();
}

// OpenAI chat 格式的 messages（Kimi Code 的 context.jsonl、各种兼容 CLI）
function fromOpenAI(rows, name) {
  const sys = rows.find(m => /system/.test(m?.role || ''));
  const a = acc(name, /Kimi/.test(asText(sys?.content)) ? 'Kimi Code' : 'OpenAI 格式'), calls = new Map();
  for (const m of rows) {
    const ts = m?.timestamp || m?.created_at;
    a.time(ts);
    if (m?.role === 'user') {
      // Kimi 把压缩后的上文、当前焦点等塞成 <system> / <current_focus> 开头的用户消息
      for (const b of parts(m.content)) if (b.text?.trim())
        a.push('user', /^\s*<[\w-]+[\s>]/.test(b.text) ?{ kind: 'fold', label: '系统提示', text: b.text } : { kind: 'text', text: b.text }, ts);
    } else if (m?.role === 'assistant') {
      if (m.reasoning_content) a.push('assistant', { kind: 'thinking', text: m.reasoning_content }, ts);
      for (const b of parts(m.content)) {
        const th = b.think ?? b.thinking;
        if (th) a.push('assistant', { kind: 'thinking', text: th }, ts);
        else if (b.text?.trim()) a.push('assistant', { kind: 'text', text: b.text }, ts);
      }
      for (const c of m.tool_calls || [])
        calls.set(c.id, a.push('assistant', { kind: 'tool', name: c.function?.name || 'tool', input: args(c.function?.arguments), result: null }, ts));
    } else if (m?.role === 'tool') {
      const b = calls.get(m.tool_call_id), t = asText(m.content);
      if (b) b.result = { text: t, isError: failed(t) };
    }
  }
  return a.done();
}

// Google Antigravity：~/.gemini/antigravity/brain/<id>/.system_generated/logs/transcript.jsonl
function fromAntigravity(rows, name) {
  const a = acc(name, 'Antigravity'), pending = [];
  for (const r of rows) {
    const ts = r.created_at, c = r.content || '';
    a.time(ts);
    if (r.type === 'USER_INPUT') {
      const t = (/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/.exec(c)?.[1] ?? c).trim();
      if (t) a.push('user', { kind: 'text', text: t }, ts);
    } else if (r.type === 'PLANNER_RESPONSE') {
      if (r.thinking) a.push('assistant', { kind: 'thinking', text: r.thinking }, ts);
      if (c.trim()) a.push('assistant', { kind: 'text', text: c }, ts);
      // 参数值是被 JSON 编码过一次的字符串
      for (const t of r.tool_calls || [])
        pending.push(a.push('assistant', { kind: 'tool', name: t.name,
          input: Object.fromEntries(Object.entries(t.args || {}).map(([k, v]) => [k, json(v)])), result: null }, ts));
    } else if (r.type === 'GENERIC') {
      const b = pending.shift();                               // 输出按调用顺序一条条回来
      if (b) b.result = { text: c, isError: failed(c) };
    } else if (r.type === 'ERROR_MESSAGE') {
      a.push('assistant', { kind: 'fold', label: '错误', text: c }, ts);
    }
  }
  return a.done();
}

// ChatGPT 官方数据导出的 conversations.json：一棵树，只取 current_node 那条分支
function fromChatGPT(c) {
  const a = acc((c.title || '').trim() || '(未命名对话)', 'ChatGPT'), path = [];
  a.s.sessionId = c.conversation_id || c.id;
  for (let id = c.current_node, n = 0; id && c.mapping?.[id] && n < 1e5; id = c.mapping[id].parent, n++) path.unshift(c.mapping[id]);
  let pending = null;
  for (const { message: m } of path) {
    if (!m || m.metadata?.is_visually_hidden_from_conversation) continue;
    const role = m.author?.role, ct = m.content || {}, ts = m.create_time ? new Date(m.create_time * 1000).toISOString() : null;
    const text = (ct.parts || []).filter(p => typeof p === 'string').join('\n') || ct.text || '';
    a.time(ts);
    if (m.metadata?.model_slug) a.models.add(m.metadata.model_slug);
    if (role === 'user' && text.trim()) a.push('user', { kind: 'text', text }, ts);
    else if (role === 'assistant' && ct.content_type === 'thoughts')
      a.push('assistant', { kind: 'thinking', text: (ct.thoughts || []).map(t => t.content).join('\n') }, ts);
    else if (role === 'assistant' && m.recipient && m.recipient !== 'all')
      pending = a.push('assistant', { kind: 'tool', name: m.recipient, input: args(text), result: null }, ts);
    else if (role === 'assistant' && text.trim()) a.push('assistant', { kind: 'text', text }, ts);
    else if (role === 'tool' && pending) {
      pending.result = { text, isError: ct.content_type === 'system_error' || failed(text) };
      pending = null;
    }
  }
  return a.done();
}

// --- claude.ai 数据导出 ------------------------------------------------------
function fromClaudeAi(c) {
  const turns = [];
  let start = null, end = null;

  for (const m of (c.chat_messages || c.messages || [])) {
    const ts = m.created_at;
    if (ts) { start = start ?? ts; end = ts; }
    const blocks = [];

    if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b?.type === 'thinking' || b?.type === 'redacted_thinking') {
          blocks.push({ kind: 'thinking', text: b.thinking || '[redacted]' });
        } else if (b?.type === 'tool_use') {
          blocks.push({ kind: 'tool', name: b.name || 'tool', input: b.input || {}, result: null });
        } else if (b?.type === 'tool_result') {
          const call = [...blocks].reverse().find(x => x.kind === 'tool' && !x.result);
          const r = { text: asText(b.content), isError: !!b.is_error };
          if (call) call.result = r;
          else blocks.push({ kind: 'fold', label: '工具结果', text: r.text });
        } else {
          const t = asText(b?.text ?? b);
          if (t.trim()) blocks.push({ kind: 'text', text: t });
        }
      }
    } else if ((m.text || '').trim()) {
      blocks.push({ kind: 'text', text: m.text });
    }

    for (const a of (m.attachments || []))
      blocks.push({ kind: 'fold', label: ('附件 ' + (a.file_name || '')).trim(), text: a.extracted_content || JSON.stringify(a, null, 2) });
    for (const f of (m.files || []))
      blocks.push({ kind: 'fold', label: ('文件 ' + (f.file_name || '')).trim(), text: JSON.stringify(f, null, 2) });

    if (blocks.length) turns.push({ role: m.sender === 'assistant' ? 'assistant' : 'user', ts, blocks });
  }

  return {
    name: (c.name || '').trim() || '(未命名对话)',
    source: 'claude.ai',
    account: c.account?.uuid,
    project: c.project_uuid || c.project?.uuid,
    turns, models: [], tools: [], usage: EMPTY_USAGE(),
    start: start ?? c.created_at, end: end ?? c.updated_at,
  };
}

// --- Claude Code jsonl -------------------------------------------------------
export function buildSession(rows, name = '') {
  // pass 1: tool_use_id -> result
  const results = new Map();
  for (const r of rows) {
    const c = r?.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b?.type === 'tool_result') {
        results.set(b.tool_use_id, { text: asText(b.content), isError: !!b.is_error });
      }
    }
  }

  const turns = [];
  const tools = new Map();
  const models = new Set();
  const usage = EMPTY_USAGE();
  let start = null, end = null, meta = {}, account = null;

  for (const r of rows) {
    if (!r) continue;
    // 账号只写在 bridge-session 这类行上，所以要在 NOISE 过滤之前捞
    account = account ?? r.ownerAccountUuid ?? null;
    if (NOISE.has(r.type)) continue;
    if (r.timestamp) { start = start ?? r.timestamp; end = r.timestamp; }
    if (r.cwd) meta = { cwd: r.cwd, gitBranch: r.gitBranch, version: r.version, sessionId: r.sessionId };

    const m = r.message;
    if (!m || (r.type !== 'user' && r.type !== 'assistant')) continue;
    if (m.model) models.add(m.model);
    const u = m.usage;
    if (u) {
      usage.input += u.input_tokens || 0;
      usage.output += u.output_tokens || 0;
      usage.cacheWrite += u.cache_creation_input_tokens || 0;
      usage.cacheRead += u.cache_read_input_tokens || 0;
    }

    const content = Array.isArray(m.content) ? m.content : [{ type: 'text', text: asText(m.content) }];
    const blocks = [];
    for (const b of content) {
      if (b?.type === 'tool_result') continue;            // 折进它自己的 tool_use
      if (b?.type === 'thinking' || b?.type === 'redacted_thinking') {
        blocks.push({ kind: 'thinking', text: b.thinking || '[redacted]' });
      } else if (b?.type === 'tool_use') {
        tools.set(b.name, (tools.get(b.name) || 0) + 1);
        blocks.push({ kind: 'tool', name: b.name, input: b.input || {}, result: results.get(b.id) || null });
      } else {
        const t = asText(b?.text ?? b);
        if (!t.trim()) continue;
        if (r.type === 'user') {
          const { text, hidden } = splitReminders(t);
          if (text) blocks.push({ kind: 'text', text });
          if (hidden.length) blocks.push({ kind: 'fold', label: '系统提示', text: hidden.join('\n\n') });
        } else {
          blocks.push({ kind: 'text', text: t });
        }
      }
    }
    if (!blocks.length) continue;                          // 纯 tool-result 的那一轮
    turns.push({ role: r.type, ts: r.timestamp, sidechain: !!r.isSidechain, blocks });
  }

  return {
    name, source: 'Claude Code', account, ...meta, turns, models: [...models], usage, start, end,
    tools: [...tools.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// --- 游戏种子：同一条会话永远折出同一张纸（game.html?seed=） -----------------
// 不含轮数，否则还在进行的会话每刷新一次就换一个世界。
export function seedOf(s) {
  let src = `${s.sessionId || s.name}|${s.start}`;
  // Kimi 这种没 id 没时间戳、文件名又都一样的，靠第一句话区分
  if (!s.sessionId && !s.start) src += '|' + (s.turns[0]?.blocks[0]?.text || '').slice(0, 200);
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  return (h >>> 1) || 1;
}

// --- 这段对话落进二维世界后留下的东西（只存在本机 localStorage，不进 URL）----------
// 观看→水 动手→山 改写→森林 出错→裂缝 分身→投影 思考→理解 人说的话→居民
// 名字覆盖 Claude Code / Codex / Kimi / Antigravity / ChatGPT 的常见工具
const toolKind = n => /^(Agent|Task)$|spawn_agent|subagent/i.test(n) ? 'split'
  : /todo|plan/i.test(n) ? 'think'
  : /Edit|Write|Create|Update|patch|replace/i.test(n) ? 'make'
  : /Bash|Shell|Exec|Run|command|computer|click|^js$|^python/i.test(n) ? 'act' : 'see';

// Codex 什么都走 shell：再看一眼命令本身，读东西算观看，写文件算改写
const READ_CMD = /^\s*(cat|type|head|tail|less|ls|dir|tree|find|rg|grep|sed -n|wc|git (log|show|diff|status|blame)|Get-(Content|ChildItem|Item)|Select-String|Test-Path)\b/i;
const WRITE_CMD = /apply_patch|Set-Content|Out-File|Add-Content|New-Item|\btee\b|(^|[^2&])>\s*[\w./\\]/i;
function shellKind(input) {
  const cmd = input?.command || input?.cmd || /\bcmd\s*:\s*["'`]([^"'`]{1,300})/.exec(input?.input || '')?.[1] || '';
  return WRITE_CMD.test(cmd) ? 'make' : READ_CMD.test(cmd) ? 'see' : 'act';
}

export function worldOf(s) {
  const w = { seed: seedOf(s), see: 0, act: 0, make: 0, split: 0, think: 0, errs: 0, talk: 0, out: s.usage?.output || 0 };
  const said = [];
  for (const t of s.turns) for (const b of t.blocks) {
    if (b.kind === 'thinking') w.think++;
    else if (b.kind === 'tool') {
      const k = toolKind(b.name);
      w[k === 'act' ? shellKind(b.input) : k]++;
      if (b.result?.isError) w.errs++;
    }
    else if (b.kind === 'text' && t.role === 'user' && !t.sidechain) {
      const line = b.text.replace(/\s+/g, ' ').trim();
      if (line.length < 2 || /^[<[]/.test(line)) continue;   // 标签、[Image …] 占位
      w.talk++;
      said.push(line.length > 28 ? line.slice(0, 28) + '…' : line);
    }
  }
  w.min = s.start && s.end ? Math.round((new Date(s.end) - new Date(s.start)) / 6e4) : 0;
  const step = Math.max(1, said.length / 60);                // 最多留 60 句，均匀抽
  w.said = Array.from({ length: Math.min(60, said.length) }, (_, i) => said[Math.floor(i * step)]);
  return w;
}

// --- 导出改动：把一次会话里所有落盘的编辑抽成 markdown -------------------------
// 目的是筛小到能塞进模型上下文，人再粘给 Claude 去审。
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export function editsOf(session) {
  const out = [];
  session.turns.forEach((t, ti) => {
    for (const b of t.blocks) {
      if (b.kind !== 'tool' || !EDIT_TOOLS.has(b.name)) continue;
      if (b.result?.isError) continue;                    // 失败的改动没落盘
      const i = b.input || {};
      const at = { path: i.file_path || i.notebook_path || '(未知文件)', turn: ti, ts: t.ts };
      if (b.name === 'Write') out.push({ ...at, whole: i.content ?? '' });
      else if (b.name === 'NotebookEdit') out.push({ ...at, whole: i.new_source ?? '' });
      else if (Array.isArray(i.edits)) for (const e of i.edits) out.push({ ...at, old: e.old_string ?? '', new: e.new_string ?? '' });
      else out.push({ ...at, old: i.old_string ?? '', new: i.new_string ?? '' });
    }
  });
  return out;
}

// 内容里本来就有 ``` 的话，围栏要比它长
const fence = s => '`'.repeat(Math.max(3, ...(s.match(/`+/g) || ['']).map(m => m.length + 1)));
const prefix = (s, c) => s.split('\n').map(l => c + l).join('\n');

export function exportEdits(session, cap = 20000) {
  const items = editsOf(session);
  const byFile = new Map();
  for (const it of items) {
    if (!byFile.has(it.path)) byFile.set(it.path, []);
    byFile.get(it.path).push(it);
  }

  const clip = s => s.length > cap ? s.slice(0, cap) + `\n… 截断，共 ${s.length} 字` : s;
  const L = [`# 会话改动：${session.name || '未命名'}`];
  L.push([session.cwd, session.start && new Date(session.start).toLocaleString(),
          `${byFile.size} 个文件`, `${items.length} 次改动`].filter(Boolean).join(' · '), '');

  if (!items.length) return L.concat('（这个会话没有落盘的改动）').join('\n');

  L.push('| 文件 | 改动次数 |', '| --- | ---: |');
  for (const [p, list] of byFile) L.push(`| \`${p}\` | ${list.length} |`);
  L.push('');

  for (const [p, list] of byFile) {
    L.push(`## ${p}`, '');
    for (const it of list) {
      const body = it.whole != null ? prefix(clip(it.whole), '+')
                 : [it.old && prefix(clip(it.old), '-'), it.new && prefix(clip(it.new), '+')].filter(Boolean).join('\n');
      const f = fence(body);
      L.push(`### 第 ${it.turn + 1} 轮${it.ts ? ' · ' + new Date(it.ts).toLocaleTimeString() : ''}${it.whole != null ? ' · 整文件写入' : ''}`);
      L.push(f + 'diff', body, f, '');
    }
  }
  return L.join('\n');
}
