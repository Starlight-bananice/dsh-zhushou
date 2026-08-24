/**
 * 冒烟测试：验证激活管线（assembleAssistantContext / rebuildActivatedRequest）。
 * 运行：cd dsh-assistant-panel && node scripts/smoke-activate.mjs
 * 通过标准：全部输出 PASS；任一断言失败输出 FAIL 并以非零码退出。
 */
import assert from 'node:assert'
import { createUserMessage, createAssistantMessage } from '@deepseek-ai/dsh-llm'
import {
  assembleAssistantContext,
  buildActivationVars,
  formatElapsed,
  rebuildActivatedRequest,
  truncateMessages,
  injectMessages,
} from '../lib/activate.js'

let pass = 0
let fail = 0
function check(name, fn) {
  try {
    fn()
    pass++
    console.log('PASS ' + name)
  } catch (e) {
    fail++
    console.log('FAIL ' + name + ' — ' + e.message)
  }
}

// ── 夹具 ──
const NOW = Date.now()
const TWO_HOURS_AGO = NOW - 2 * 3600_000
const runtime = {
  ctx: {},
  profile: { userName: 'tester', locale: 'zh', timezone: 'Asia/Shanghai', dataDir: '/tmp' },
  lastRoute: { provider: 'llm-deepseek', model: 'deepseek-chat' },
  defaultRoute: { provider: 'llm-deepseek', model: 'deepseek-chat' },
}

function makeAssistant(overrides = {}) {
  return {
    id: 'asst_smoke',
    profile: { id: 'asst_smoke', name: '冒烟助手', avatar: '', tags: ['test'], workspace: '', createdAt: NOW, updatedAt: NOW },
    modelParams: {
      provider: null, model: '', temperature: 1.0, topP: 1.0,
      reasoningEffort: 'auto', maxTokens: null, stream: true, contextLimit: 20,
    },
    systemPrompt: {
      template: '你是 {{assistant_name}}，今天是 {{cur_date}}，现在 {{cur_time}}。{{last_chat_time}}{{elapsed_since_last}}',
      customVariables: {},
    },
    quickReplies: [],
    injections: [
      { id: 'i1', role: 'system', position: 'before', trigger: 'always', keywords: [], enabled: true, content: '[设定] 你是一个严谨的助手。' },
    ],
    worldbook: [
      { id: 'w1', keys: ['宇宙'], content: '世界书：宇宙大爆炸于 138 亿年前。', priority: 1, position: 'before', enabled: true },
    ],
    skills: [
      { id: 's1', name: 'research', description: '联网调研', enabled: true },
    ],
    memory: { enabled: false, globalMemory: false, useChatHistory: false, timeAwareness: true },
    ...overrides,
  }
}

const messages = [
  createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '什么是宇宙？' }] }),
]

// ── 1. formatElapsed ──
check('formatElapsed 刚刚', () => {
  assert.strictEqual(formatElapsed(NOW - 5_000, NOW), '刚刚')
})
check('formatElapsed 分钟', () => {
  assert.strictEqual(formatElapsed(NOW - 45 * 60_000, NOW), '45 分钟')
})
check('formatElapsed 小时分', () => {
  assert.strictEqual(formatElapsed(NOW - (3 * 3600_000 + 20 * 60_000), NOW), '3 小时 20 分钟')
})
check('formatElapsed 整小时', () => {
  assert.strictEqual(formatElapsed(NOW - 3 * 3600_000, NOW), '3 小时')
})

// ── 2. 变量表（last_chat_time / elapsed_since_last）──
check('变量表 last_chat_time 有值', () => {
  const vars = buildActivationVars({ runtime, assistant: makeAssistant(), lastChatTs: TWO_HOURS_AGO, messages })
  assert.match(vars.last_chat_time, /^\d{2}:\d{2}$/)
  assert.strictEqual(vars.elapsed_since_last, '2 小时')
})
check('变量表 lastChatTs null → 未知', () => {
  const vars = buildActivationVars({ runtime, assistant: makeAssistant(), lastChatTs: null, messages })
  assert.strictEqual(vars.last_chat_time, '未知')
  assert.strictEqual(vars.elapsed_since_last, '未知')
})

// ── 3. assembleAssistantContext：时间感知行 ──
check('时间感知开 → 含自然时间上下文行（无 [时间提醒]）', () => {
  const ctx = assembleAssistantContext(makeAssistant(), runtime, TWO_HOURS_AGO, { messages })
  assert.ok(ctx.includes('（当前时间：'), '应含当前时间行')
  assert.ok(ctx.includes('用户上次对话：'), '应含上次对话')
  assert.ok(ctx.includes('约 2 小时 前'), '应含间隔' + ctx)
  assert.ok(!ctx.includes('[时间提醒]'), '不应有 [时间提醒] 前缀')
  assert.ok(ctx.includes('冒烟助手'), '模板变量 assistant_name 应替换')
  assert.ok(ctx.includes('世界书：宇宙大爆炸'), '世界书应合并进 system')
  assert.ok(ctx.includes('- research: 联网调研'), 'skill 说明应存在')
})
check('时间感知关 → 无时间上下文行', () => {
  const ctx = assembleAssistantContext(makeAssistant({ memory: { enabled: false, globalMemory: false, useChatHistory: false, timeAwareness: false } }), runtime, TWO_HOURS_AGO, { messages })
  assert.ok(!ctx.includes('当前时间'), '不应含当前时间:' + ctx)
})
check('lastChatTs null → 时间感知行为 未知', () => {
  const ctx = assembleAssistantContext(makeAssistant(), runtime, null, { messages })
  assert.ok(ctx.includes('用户上次对话：未知'), ctx)
  assert.ok(ctx.includes('约 未知 前'), ctx)
})

// ── 4. rebuildActivatedRequest：模型覆盖 + system 追加 + 注入 ──
check('rebuild：system 追加 + 时间行', () => {
  const options = {
    provider: 'llm-deepseek',
    model: 'deepseek-chat',
    messages,
    system: '[官方 system]',
    sessionId: 'sess-1',
  }
  const rebuilt = rebuildActivatedRequest({
    options: options,
    assistant: makeAssistant(),
    runtime,
    lastChatTs: TWO_HOURS_AGO,
    memories: [],
  })
  assert.ok(rebuilt.system.startsWith('[官方 system]'), '官方 system 保留在前')
  assert.ok(rebuilt.system.includes('（当前时间：'), '追加时间上下文')
  assert.ok(rebuilt.messages.length >= messages.length, '消息保留')
})
check('rebuild：模型覆盖（provider/model 非空）', () => {
  const options = { provider: 'a', model: 'b', messages, sessionId: 'sess-2' }
  const rebuilt = rebuildActivatedRequest({
    options,
    assistant: makeAssistant({ modelParams: { provider: 'llm-x', model: 'model-y', temperature: 0.7, topP: 0.9, reasoningEffort: 'medium', maxTokens: 512, stream: true, contextLimit: 0 } }),
    runtime,
    lastChatTs: null,
    memories: [],
  })
  assert.strictEqual(rebuilt.provider, 'llm-x')
  assert.strictEqual(rebuilt.model, 'model-y')
  assert.strictEqual(rebuilt.temperature, 0.7)
  assert.strictEqual(String(rebuilt.reasoningEffort), 'low') // medium → low
  assert.strictEqual(rebuilt.maxTokens, 512)
})
check('rebuild：reasoningEffort auto 省略 / temperature 1.0 不覆盖 / maxTokens null 不传', () => {
  const options = { provider: 'a', model: 'b', messages, sessionId: 'sess-3' }
  const rebuilt = rebuildActivatedRequest({
    options,
    assistant: makeAssistant({ modelParams: { provider: 'llm-x', model: 'model-y', temperature: 1.0, topP: 0.9, reasoningEffort: 'auto', maxTokens: null, stream: true, contextLimit: 0 } }),
    runtime,
    lastChatTs: null,
    memories: [],
  })
  assert.strictEqual(rebuilt.reasoningEffort, undefined)
  assert.strictEqual(rebuilt.temperature, undefined)
  assert.strictEqual(rebuilt.maxTokens, undefined)
})

// ── 5. truncateMessages / injectMessages（pair 约束）──
check('truncate：不裁掉最新 user', () => {
  const msgs = [
    createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'a' }] }),
    createAssistantMessage({ content: [{ type: 'text', text: 'b' }], source: { provider: 'p', model: 'm' } }),
    createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'c' }] }),
  ]
  const out = truncateMessages(msgs, 2)
  // 截断后 [assistant(b), user(c)] → 首条 assistant（配对 user 被裁）→ 前移 → [user(c)]
  assert.strictEqual(out.length, 1)
  assert.strictEqual(out[0].role, 'user')
  assert.strictEqual(out[0].content[0].text, 'c')
})
check('inject：user 注入块围绕最新 user', () => {
  const msgs = [
    createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '你好' }] }),
  ]
  const assistant = makeAssistant({
    injections: [
      { id: 'u1', role: 'user', position: 'before', trigger: 'always', keywords: [], enabled: true, content: '前缀注入' },
      { id: 'u2', role: 'user', position: 'after', trigger: 'always', keywords: [], enabled: true, content: '后缀注入' },
    ],
  })
  const vars = buildActivationVars({ runtime, assistant, lastChatTs: null, messages: msgs })
  const out = injectMessages(assistant, msgs, vars)
  assert.strictEqual(out.length, 3)
  assert.strictEqual(out[0].role, 'user')
  assert.match(messageTextOf(out[0]), /前缀注入/)
  assert.match(messageTextOf(out[2]), /后缀注入/)
})

function messageTextOf(m) {
  return m.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
}

console.log('\n== smoke result: ' + pass + ' pass, ' + fail + ' fail ==')
process.exit(fail > 0 ? 1 : 0)
