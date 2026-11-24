// Tests of the review extraction from `opencode run --format json` events. Part of `mise run check`.
import assert from 'node:assert/strict'
import { extractReview } from './review-output.mjs'

const text = (value) => JSON.stringify({ type: 'text', sessionID: 's', part: { type: 'text', text: value } })
const event = (type, extra = {}) => JSON.stringify({ type, sessionID: 's', ...extra })

const cases = [
  [
    'block between markers, earlier text and tool events ignored',
    [text('Читаю файлы, ответ будет между ===REVIEW-START=== и ===REVIEW-END==='), event('tool_use'),
      text('===REVIEW-START===\n**Итог:** ок\n===REVIEW-END===')].join('\n'),
    { code: 0, review: '**Итог:** ок' },
  ],
  ['answer without markers is used whole', text('**Итог:** замечаний нет'), { code: 0, review: '**Итог:** замечаний нет' }],
  ['diagnostic lines are never the review', ['permission requested: bash (*); auto-rejecting', event('step_finish')].join('\n'), { code: 2 }],
  ['no text events: explicit reason with event types', [event('step_start'), event('tool_use'), event('step_finish')].join('\n'), { code: 2 }],
  ['whitespace-only block is empty', text('===REVIEW-START===\n  \n===REVIEW-END==='), { code: 2 }],
  ['error event fails with its message', [text('частично'), event('error', { error: { name: 'APIError', data: { message: 'Free usage limit reached' } } })].join('\n'), { code: 1 }],
  ['markers in backticks, CRLF', text('`===REVIEW-START===`\r\nИтог\r\n`===REVIEW-END===`'), { code: 0, review: 'Итог' }],
]

let failed = 0
for (const [name, input, want] of cases) {
  const got = extractReview(input)
  try {
    assert.equal(got.code, want.code)
    if (want.review !== undefined) assert.equal(got.review, want.review)
    if (want.code === 1) assert.match(got.message, /Free usage limit reached/)
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
