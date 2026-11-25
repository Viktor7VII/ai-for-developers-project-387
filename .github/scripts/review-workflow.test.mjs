// Structural tests of the agent workflows: the run limit relies on step order, step names and the
// "Reserve agent run" conditions, and the reviewer on its read-only permissions. Part of `mise run check`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { parse } = createRequire(resolve(root, 'contracts/package.json'))('yaml')
const load = (file) => parse(readFileSync(resolve(root, file), 'utf8'))

const review = load('.github/workflows/opencode-review.yml').jobs.review
const oc = load('.github/workflows/opencode.yml').jobs.opencode
const index = (steps, name) => {
  const i = steps.findIndex((step) => step.name === name)
  assert.notEqual(i, -1, `step "${name}" is missing`)
  return i
}

const checks = {
  'review: limit is checked before the model is called'() {
    assert.ok(index(review.steps, 'Check agent run limit') < index(review.steps, 'Run review'))
  },
  'review: run is reserved after the review attempt and before publishing'() {
    const reserve = index(review.steps, 'Reserve agent run')
    assert.ok(index(review.steps, 'Run review') < reserve)
    assert.ok(reserve < index(review.steps, 'Publish review'))
  },
  'review: reservation also covers failures, timeouts and cancellations'() {
    const condition = review.steps[index(review.steps, 'Reserve agent run')].if
    assert.match(condition, /always\(\)/)
    assert.match(condition, /steps\.limit\.outcome == 'success'/)
    assert.match(condition, /steps\.review\.outcome != 'skipped'/)
  },
  'review: only a confirmed exhausted free quota skips the reservation'() {
    const condition = review.steps[index(review.steps, 'Reserve agent run')].if
    assert.match(condition, /steps\.review\.outputs\.quota-exceeded != 'true'/)
    assert.equal(review.steps[index(review.steps, 'Run review')].id, 'review')
    assert.equal(review.steps[index(review.steps, 'Check agent run limit')].id, 'limit')
  },
  'review: publishing only after a successful review'() {
    assert.equal(review.steps[index(review.steps, 'Publish review')].if, undefined)
  },
  'review: read-only OpenCode permissions'() {
    const { permissions } = JSON.parse(review.steps[index(review.steps, 'Run review')].env.OPENCODE_CONFIG_CONTENT)
    assert.deepEqual(permissions[0], { action: '*', resource: '*', effect: 'deny' })
    const allowed = permissions.filter((rule) => rule.effect === 'allow').map((rule) => rule.action).sort()
    assert.deepEqual(allowed, ['glob', 'grep', 'read'])
    assert.deepEqual(permissions.at(-1), { action: 'external_directory', resource: '*', effect: 'deny' })
  },
  'review: OpenCode CLI version is pinned to 2.x'() {
    const env = load('.github/workflows/opencode-review.yml').env
    assert.match(String(env.OPENCODE_VERSION), /^2\.\d+\.\d+$/)
  },
  '/oc: run is reserved before the agent is called'() {
    assert.ok(index(oc.steps, 'Check agent run limit') < index(oc.steps, 'Reserve agent run'))
    assert.ok(index(oc.steps, 'Reserve agent run') < index(oc.steps, 'Run OpenCode'))
  },
  'both: job names match the run limit action'() {
    assert.equal(review.name, 'Review pull request')
    assert.equal(oc.name, 'Run OpenCode')
  },
}

let failed = 0
for (const [name, check] of Object.entries(checks)) {
  try {
    check()
    console.log(`ok   ${name}`)
  } catch (e) {
    failed++
    console.log(`FAIL ${name}: ${e.message}`)
  }
}
if (failed) {
  console.log(`${failed} review workflow test(s) failed`)
  process.exit(1)
}
console.log('All review workflow tests passed')
