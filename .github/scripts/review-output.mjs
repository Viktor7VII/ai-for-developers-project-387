// Extracts the review from `opencode run --format json` events (one JSON object per line, OpenCode 2.x).
// Only text parts of the answer ("type": "text") become the review: tool output, errors and diagnostics
// never do. Text of one part may arrive in several events (deltas); they are joined by part id.
// Exit codes: 0 review printed to stdout, 1 OpenCode reported an error, 2 the answer has no text,
// 3 the free model quota is exhausted (the request was refused before the model ran).
// Used by .github/scripts/run-review.sh.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const START = '===REVIEW-START==='
const END = '===REVIEW-END==='
// OpenCode 2.x classifies OpenCode Zen free-tier and quota refusals as these session error types.
const QUOTA_ERROR_TYPES = new Set(['provider.free-limit', 'provider.quota'])

function errorOf(event) {
  const error = event.error ?? {}
  return {
    type: String(error.type ?? error.name ?? 'unknown'),
    message: String(error.message ?? error.data?.message ?? error.name ?? 'unknown error'),
  }
}

export function extractReview(eventsText) {
  const parts = new Map() // part id -> text, in order of first appearance
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
    if (event.type === 'text' && typeof event.part?.text === 'string') {
      const id = event.part.id ?? `part-${parts.size}`
      parts.set(id, (parts.get(id) ?? '') + event.part.text)
    }
    if (event.type === 'error' || (event.type === 'retry' && QUOTA_ERROR_TYPES.has(errorOf(event).type))) {
      errors.push(errorOf(event))
    }
  }

  const quota = errors.find((error) => QUOTA_ERROR_TYPES.has(error.type))
  if (quota) return { code: 3, message: `Free model quota exhausted: ${quota.message}` }
  if (errors.length) {
    return { code: 1, message: `OpenCode reported an error: ${errors.map((e) => `${e.type}: ${e.message}`).join('; ')}` }
  }

  const answer = [...parts.values()].join('\n\n')
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
