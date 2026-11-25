// Tests of the review extraction from `opencode run --format json` events. Part of `mise run check`.
import assert from 'node:assert/strict'
import { extractReview } from './review-output.mjs'

const text = (value, id = 'prt_1') =>
  JSON.stringify({ type: 'text', sessionID: 's', part: { id, type: 'text', text: value } })
const event = (type, extra = {}) => JSON.stringify({ type, sessionID: 's', ...extra })
// OpenCode 2.x session error shape: { type, message }.
const error = (type, message) => event('error', { error: { type, message } })

const cases = [
  [
    'block between markers, earlier text and tool events ignored',
    [text('Читаю файлы, ответ будет между ===REVIEW-START=== и ===REVIEW-END===', 'prt_a'), event('tool_use'),
      text('===REVIEW-START===\n**Итог:** ок\n===REVIEW-END===', 'prt_b')].join('\n'),
    { code: 0, review: '**Итог:** ок' },
  ],
  ['answer without markers is used whole', text('**Итог:** замечаний нет'), { code: 0, review: '**Итог:** замечаний нет' }],
  [
    'deltas of one text part are joined without separators',
    [text('===REVIEW-START===\nИт', 'prt_1'), text('ог: ок\n===REVIEW-END===', 'prt_1')].join('\n'),
    { code: 0, review: 'Итог: ок' },
  ],
  ['diagnostic lines are never the review', ['permission requested: shell (*); auto-rejecting', event('step_finish')].join('\n'), { code: 2 }],
  ['no text events: explicit reason with event types', [event('step_start'), event('tool_use'), event('step_finish')].join('\n'), { code: 2 }],
  ['whitespace-only block is empty', text('===REVIEW-START===\n  \n===REVIEW-END==='), { code: 2 }],
  [
    'free model quota exhausted (provider.free-limit)',
    error('provider.free-limit', 'Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.'),
    { code: 3, message: /Free usage limit reached/ },
  ],
  ['other quota refusal (provider.quota)', error('provider.quota', 'Insufficient quota'), { code: 3 }],
  ['other error fails with its type and message', [text('частично'), error('provider.auth', 'Invalid API key')].join('\n'), { code: 1, message: /provider\.auth: Invalid API key/ }],
  ['legacy error shape', event('error', { error: { name: 'APIError', data: { message: 'boom' } } }), { code: 1, message: /boom/ }],
  ['markers in backticks, CRLF', text('`===REVIEW-START===`\r\nИтог\r\n`===REVIEW-END===`'), { code: 0, review: 'Итог' }],
]

let failed = 0
for (const [name, input, want] of cases) {
  const got = extractReview(input)
  try {
    assert.equal(got.code, want.code)
    if (want.review !== undefined) assert.equal(got.review, want.review)
    if (want.message) assert.match(got.message, want.message)
    if (want.code === 2 && name.startsWith('no text')) assert.match(got.message, /tool_use: 1/)
    console.log(`ok   ${name}`)
  } catch (e) {
    failed++
    console.log(`FAIL ${name}: ${e.message}`)
  }
}
if (failed) {
  console.log(`${failed} review output test(s) failed`)
  process.exit(1)
}
console.log('All review output tests passed')
