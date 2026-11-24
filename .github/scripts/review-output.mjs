// Extracts the review from `opencode run --format json` events (one JSON object per line).
// Only completed text parts of the answer ("type": "text") become the review: tool output, errors and
// diagnostics never do. Exit codes: 0 review printed to stdout, 1 OpenCode reported an error,
// 2 the answer has no text (or only whitespace). Used by .github/workflows/opencode-review.yml.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const START = '===REVIEW-START==='
const END = '===REVIEW-END==='

export function extractReview(eventsText) {
  const texts = []
  const errors = []
  const counts = {}
  for (const line of eventsText.split(/\r?\n/)) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue // not an event: never part of the review
    }
    counts[event.type] = (counts[event.type] ?? 0) + 1
    if (event.type === 'text' && typeof event.part?.text === 'string') texts.push(event.part.text)
    if (event.type === 'error') {
      const error = event.error ?? {}
      errors.push(String(error.data?.message ?? error.message ?? error.name ?? 'unknown error'))
    }
  }

  if (errors.length) return { code: 1, message: `OpenCode reported an error: ${errors.join('; ')}` }

  const answer = texts.join('\n\n')
  // The last START ... END block wins: earlier text may only mention the markers.
  const lines = answer.split(/\r?\n/)
  let block = null
  let current = null
  for (const line of lines) {
    const marker = line.trim().replace(/^[`*]+|[`*]+$/g, '')
    if (marker === START) current = []
    else if (marker === END && current) {
      block = current
      current = null
    } else if (current) current.push(line)
  }
  const review = (block ?? lines).join('\n').trim()
  if (!review) {
    const seen = Object.entries(counts).map(([type, n]) => `${type}: ${n}`).join(', ') || 'none'
    return { code: 2, message: `OpenCode finished without a text answer (events: ${seen}).` }
  }
  return { code: 0, review }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = extractReview(readFileSync(process.argv[2], 'utf8'))
  if (result.code === 0) process.stdout.write(result.review + '\n')
  else console.error(result.message)
  process.exit(result.code)
}
