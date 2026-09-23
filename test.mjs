import assert from 'node:assert/strict';
import { parseJsonl, buildSession, loadFile } from './web/parse.js';

const lines = [
  { type: 'queue-operation', operation: 'x' },
  { type: 'user', timestamp: '2026-09-07T10:00:00Z', cwd: 'G:\claudewant', gitBranch: 'main', version: '2.0', sessionId: 's1',
    message: { role: 'user', content: 'hi there<system-reminder>ignore me</system-reminder>' } },
  { type: 'assistant', timestamp: '2026-09-07T10:00:05Z', message: { role: 'assistant', model: 'claude-opus-5',
    usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 500, cache_creation_input_tokens: 5 },
    content: [ { type: 'thinking', thinking: 'hmm' }, { type: 'text', text: 'ok' },
               { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } } ] } },
  { type: 'user', timestamp: '2026-09-07T10:00:06Z', isSidechain: true,
    message: { role: 'user', content: [ { type: 'tool_result', tool_use_id: 't1', content: 'a\nb', is_error: false } ] } },
  '{ broken json',
].map(o => typeof o === 'string' ? o : JSON.stringify(o)).join('\n') + '\n\n';

const rows = parseJsonl(lines);
assert.equal(rows.length, 4, 'corrupt line skipped, blanks skipped');

const s = buildSession(rows, 'demo.jsonl');
assert.equal(s.turns.length, 2, 'pure tool-result turn is folded away, noise dropped');
assert.deepEqual(s.turns[0].blocks.map(b => b.kind), ['text', 'fold']);
assert.equal(s.turns[0].blocks[1].label, '系统提示');
assert.equal(s.turns[0].blocks[0].text, 'hi there', 'system-reminder stripped from visible text');
assert.deepEqual(s.turns[1].blocks.map(b => b.kind), ['thinking', 'text', 'tool']);
assert.equal(s.turns[1].blocks[2].result.text, 'a\nb', 'tool result attached to its call');
assert.deepEqual(s.usage, { input: 10, output: 20, cacheWrite: 5, cacheRead: 500 });
assert.deepEqual(s.tools, [['Bash', 1]]);
assert.deepEqual(s.models, ['claude-opus-5']);
assert.equal(s.cwd, 'G:\claudewant');
assert.equal(s.start, '2026-09-07T10:00:00Z');
assert.equal(s.end, '2026-09-07T10:00:06Z');

// content-as-array on a user row, and a string tool_result
const s2 = buildSession(parseJsonl(JSON.stringify({ type: 'user', message: { role: 'user',
  content: [{ type: 'text', text: 'plain' }] } })));
assert.equal(s2.turns[0].blocks[0].text, 'plain');

console.log('all good');

// --- 账号标记（只在 bridge-session 这类行上） ---
{
  const jsonl = [
    { type: 'bridge-session', ownerAccountUuid: 'feb17124-e379-4fbb', ownerOrganizationUuid: '9d047128' },
    { type: 'user', timestamp: '2026-09-07T10:00:00Z', cwd: 'G:/x', message: { role: 'user', content: '你好' } },
  ].map(o => JSON.stringify(o)).join('\n');
  const [s] = loadFile(jsonl, 'a.jsonl');
  assert.equal(s.account, 'feb17124-e379-4fbb', 'NOISE 过滤前先捞账号');
  assert.equal(s.source, 'Claude Code');

  const [s2] = loadFile(JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }));
  assert.equal(s2.account, null, '没标记就是 null');
}

// --- claude.ai 导出：一个文件多条对话 ---
{
  const exp = [
    {
      uuid: 'c1', name: '重构计划', created_at: '2026-01-01T00:00:00Z',
      account: { uuid: '615b4b89-aaaa' }, project_uuid: 'proj-1',
      chat_messages: [
        { sender: 'human', created_at: '2026-01-01T00:00:00Z', text: '帮我看看',
          attachments: [{ file_name: 'a.md', extracted_content: '文件正文' }] },
        { sender: 'assistant', created_at: '2026-01-01T00:01:00Z', content: [
          { type: 'thinking', thinking: '想一下' },
          { type: 'text', text: '好的' },
          { type: 'tool_use', name: 'repl', input: { code: '1+1' } },
          { type: 'tool_result', content: '2' },
        ] },
      ],
    },
    { uuid: 'c2', name: '', chat_messages: [{ sender: 'human', text: '第二条', created_at: '2026-01-02T00:00:00Z' }] },
    { uuid: 'c3', name: '空的', chat_messages: [] },
  ];
  const out = loadFile(JSON.stringify(exp), 'conversations.json');
  assert.equal(out.length, 2, '空对话被丢掉');
  const [a, b] = out;
  assert.equal(a.name, '重构计划');
  assert.equal(a.source, 'claude.ai');
  assert.equal(a.account, '615b4b89-aaaa');
  assert.equal(a.project, 'proj-1');
  assert.deepEqual(a.turns.map(t => t.role), ['user', 'assistant']);
  assert.deepEqual(a.turns[0].blocks.map(x => x.kind), ['text', 'fold']);
  assert.equal(a.turns[0].blocks[1].label, '附件 a.md');
  assert.deepEqual(a.turns[1].blocks.map(x => x.kind), ['thinking', 'text', 'tool']);
  assert.equal(a.turns[1].blocks[2].result.text, '2', 'tool_result 折进前一个 tool_use');
  assert.deepEqual(a.usage, { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
  assert.equal(a.start, '2026-01-01T00:00:00Z');
  assert.equal(b.name, '(未命名对话)');
}

// --- 格式判定：普通 jsonl 不能被误认成导出包 ---
{
  assert.equal(loadFile('[]').length, 0, '空数组不是会话');
  assert.equal(loadFile('不是 json 也不是 jsonl').length, 0);
}

console.log('扩展用例也通过');

// --- 导出改动 ---
{
  const { exportEdits } = await import('./web/parse.js');
  const mk = (name, input, isError) => ({ kind: 'tool', name, input, result: isError ? { text: 'x', isError: true } : null });
  const s = {
    name: 'demo.jsonl', cwd: 'G:/x', start: '2026-09-07T10:00:00Z',
    turns: [
      { ts: '2026-09-07T10:00:00Z', blocks: [{ kind: 'text', text: '改一下' }] },
      { ts: '2026-09-07T10:01:00Z', blocks: [
        mk('Edit', { file_path: 'G:/x/a.js', old_string: 'let a=1', new_string: 'const a = 1' }),
        mk('Edit', { file_path: 'G:/x/b.js', old_string: '失败的', new_string: '不算', }, true),
        mk('Write', { file_path: 'G:/x/c.md', content: '# 新文件' }),
        mk('Read', { file_path: 'G:/x/d.js' }),
        mk('MultiEdit', { file_path: 'G:/x/a.js', edits: [{ old_string: 'x', new_string: 'y' }, { old_string: 'p', new_string: 'q' }] }),
      ] },
    ],
  };
  const md = exportEdits(s);
  assert.match(md, /# 会话改动：demo\.jsonl/);
  assert.match(md, /2 个文件 · 4 次改动/, 'Read 不算、失败的 Edit 不算、MultiEdit 拆成 2 条');
  assert.ok(!md.includes('b.js'), '失败的改动完全不出现');
  assert.ok(!md.includes('d.js'), 'Read 不是改动');
  assert.match(md, /-let a=1\n\+const a = 1/, '旧行 - 新行 +');
  assert.match(md, /整文件写入/);
  assert.match(md, /\+# 新文件/);
  assert.match(md, /\| `G:\/x\/a\.js` \| 3 \|/, '同一文件的改动归到一起');

  // 内容里有 ``` 时围栏要更长
  const s2 = { name: 'f', turns: [{ blocks: [mk('Write', { file_path: 'r.md', content: '```js\ncode\n```' })] }] };
  const md2 = exportEdits(s2);
  assert.ok(md2.includes('````diff'), '围栏加长到 4 个反引号');

  const empty = exportEdits({ name: 'n', turns: [{ blocks: [{ kind: 'text', text: 'hi' }] }] });
  assert.match(empty, /没有落盘的改动/);
}

console.log('导出用例通过');

// seedOf: 稳定、非零、与轮数无关
{
  const { seedOf } = await import('./web/parse.js');
  const a = { sessionId: 's1', start: '2026-09-07T10:00:00Z', turns: [1] };
  assert.equal(seedOf(a), seedOf({ ...a, turns: [1, 2, 3] }), 'growing session keeps its world');
  assert.notEqual(seedOf(a), seedOf({ ...a, sessionId: 's2' }));
  assert.ok(seedOf(a) > 0 && seedOf(a) < 2 ** 31);
}

// worldOf: 把会话折成游戏参数
{
  const { worldOf } = await import('./web/parse.js');
  const w = worldOf(s);
  assert.equal(w.see, 1, 'Bash 里跑 ls 算观看');
  assert.equal(w.think, 1);
  assert.equal(w.talk, 1);
  assert.deepEqual(w.said, ['hi there'], 'system-reminder 不会被念出来');
  assert.equal(w.min, 0);
}

// 其他家 agent 的记录：每种一个最小样例
{
  const { worldOf } = await import('./web/parse.js');
  const jl = rows => rows.map(r => JSON.stringify(r)).join('\n');
  const one = (text, name) => { const ss = loadFile(text, name); assert.equal(ss.length, 1, name); return ss[0]; };

  const codex = one(jl([
    { type: 'session_meta', timestamp: '2026-09-22T12:00:00Z', payload: { id: 'cx1', cwd: 'C:/p', cli_version: '0.1' } },
    { type: 'turn_context', payload: { model: 'gpt-6' } },
    { type: 'response_item', timestamp: '2026-09-22T12:00:01Z', payload: { type: 'message', role: 'user',
      content: [{ type: 'input_text', text: '# AGENTS.md instructions' }, { type: 'input_text', text: '修一下' }],
      internal_chat_message_metadata_passthrough: { content_item_kinds: ['agents_md.instructions', 'user.text'] } } },
    { type: 'response_item', payload: { type: 'reasoning', summary: [] } },
    { type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'c1', name: 'exec', input: 'tools.exec_command({cmd:"Get-Content a.txt"})' } },
    { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'c1', output: [{ type: 'input_text', text: 'Exit code: 1' }] } },
    { type: 'response_item', payload: { type: 'function_call', call_id: 'c2', name: 'apply_patch', arguments: '{"patch":"x"}' } },
    { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 7 } } } },
  ]), 'rollout.jsonl');
  assert.equal(codex.source, 'Codex');
  assert.deepEqual(codex.models, ['gpt-6']);
  assert.deepEqual(codex.turns[0].blocks.map(b => b.kind), ['fold', 'text'], 'AGENTS.md 折叠，人话留下');
  const cw = worldOf(codex);
  assert.deepEqual([cw.see, cw.make, cw.errs, cw.talk, cw.out], [1, 1, 1, 1, 7], 'exec 里读文件算观看，apply_patch 算改写');

  const kimi = one(jl([
    { role: '_system_prompt', content: 'You are Kimi Code CLI' },
    { role: 'user', content: '配置坏了' },
    { role: 'assistant', content: [{ type: 'think', think: '嗯' }], tool_calls: [{ id: 't1', function: { name: 'Shell', arguments: '{"command":"nginx -t"}' } }] },
    { role: 'tool', tool_call_id: 't1', content: '<system>ERROR: Command failed with exit code 1</system>' },
  ]), 'context.jsonl');
  assert.equal(kimi.source, 'Kimi Code');
  assert.equal(kimi.name, '配置坏了', '通用文件名换成第一句话');
  const kw = worldOf(kimi);
  assert.deepEqual([kw.act, kw.think, kw.errs], [1, 1, 1]);

  const ag = one(jl([
    { step_index: 0, type: 'USER_INPUT', created_at: '2026-09-04T11:05:09Z', content: '<USER_REQUEST>\n看这个文件\n</USER_REQUEST>\n<ADDITIONAL_METADATA>x</ADDITIONAL_METADATA>' },
    { step_index: 1, type: 'PLANNER_RESPONSE', thinking: '先找', tool_calls: [{ name: 'view_file', args: { AbsolutePath: '"a.md"' } }, { name: 'write_to_file', args: {} }] },
    { step_index: 2, type: 'GENERIC', content: 'ok' },
    { step_index: 3, type: 'GENERIC', content: 'Exit code: 2' },
  ]), 'transcript.jsonl');
  assert.equal(ag.turns[0].blocks[0].text, '看这个文件');
  assert.equal(ag.turns[1].blocks[1].input.AbsolutePath, 'a.md', '参数解开一层 JSON');
  const aw = worldOf(ag);
  assert.deepEqual([aw.see, aw.make, aw.errs, aw.talk], [1, 1, 1, 1], '输出按顺序挂回调用');

  const gpt = loadFile(JSON.stringify([{ title: '问问', conversation_id: 'g1', current_node: 'c', mapping: {
    a: { message: null, parent: null },
    b: { parent: 'a', message: { author: { role: 'user' }, content: { content_type: 'text', parts: ['你好'] }, create_time: 1790000000 } },
    x: { parent: 'b', message: { author: { role: 'assistant' }, content: { content_type: 'text', parts: ['被丢掉的分支'] } } },
    p: { parent: 'b', message: { author: { role: 'assistant' }, recipient: 'python', content: { content_type: 'code', text: 'print(1)' } } },
    q: { parent: 'p', message: { author: { role: 'tool' }, content: { content_type: 'execution_output', text: '1' } } },
    c: { parent: 'q', message: { author: { role: 'assistant' }, metadata: { model_slug: 'gpt-5' }, content: { content_type: 'text', parts: ['好'] } } },
  } }]), 'conversations.json');
  assert.equal(gpt.length, 1);
  assert.equal(gpt[0].source, 'ChatGPT');
  assert.ok(!JSON.stringify(gpt[0].turns).includes('被丢掉的分支'), '只走 current_node 那条分支');
  assert.equal(gpt[0].turns[1].blocks[0].result.text, '1');
  assert.deepEqual(gpt[0].models, ['gpt-5']);
  console.log('其他家格式通过');
}

// pathOf：会话画成的曲线
{
  const { pathOf, worldOf, PATH_LEN } = await import('./web/parse.js');
  const p = pathOf(s);
  assert.deepEqual(p[0], [0, 0, 'u'], '从落点出发');
  assert.deepEqual(pathOf(s), p, '同一段会话永远同一条线');
  const long = { turns: Array.from({ length: 3000 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', blocks: [{ kind: 'text', text: 'x'.repeat(i % 50) }] })) };
  const lp = pathOf(long);
  assert.ok(lp.length <= 401, '最多 400 段');
  const length = lp.slice(1).reduce((v, q, i) => v + Math.hypot(q[0] - lp[i][0], q[1] - lp[i][1]), 0);
  assert.ok(Math.abs(length - PATH_LEN) < PATH_LEN * .05, `整条约 ${PATH_LEN} 格，实际 ${Math.round(length)}`);
  const err = { turns: [{ role: 'assistant', blocks: [{ kind: 'tool', name: 'Bash', input: { command: 'x' }, result: { isError: true } }] }] };
  assert.deepEqual(pathOf(err).slice(1).map(q => q[2]), ['e', 'e', 'e'], '出错走锯齿');
  assert.ok(Array.isArray(worldOf(s).path));
  console.log('足迹曲线通过');
}

// shapeOf / project：四维曲线往不同平面投影成不同图案
{
  const { shapeOf, project, pathOf } = await import('./web/parse.js');
  const sh = shapeOf(s);
  assert.ok(sh.every(q => q.length === 5), '四维顶点 [x,y,z,w,类型]');
  assert.deepEqual(sh[0], [0, 0, 0, 0, 'u']);
  const long = { turns: Array.from({ length: 800 }, (_, i) => ({ role: i % 3 ? 'assistant' : 'user', blocks: i % 3 === 1 ? [{ kind: 'tool', name: ['Read', 'Bash', 'Edit'][(i / 3 | 0) % 3], input: {}, result: {} }] : [{ kind: 'text', text: 'y'.repeat(i % 40) }] })) };
  const L4 = shapeOf(long), xy = project(L4), zw = project(L4, [0, 0, 1, 0], [0, 0, 0, 1]);
  assert.ok(L4.some(q => Math.abs(q[2]) > 1) && L4.some(q => Math.abs(q[3]) > 1), '真的走进了 z、w 方向');
  assert.notDeepEqual(xy.map(q => q.slice(0, 2)), zw.map(q => q.slice(0, 2)), '不同平面的影子不一样');
  assert.deepEqual(pathOf(long, L4), pathOf(long), '纸上的路就是 x-y 面的影子');
  console.log('四维投影通过');
}
