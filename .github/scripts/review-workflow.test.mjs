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
const notReviewed = "steps.previous.outputs.reviewed != 'true'"
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
    // Without a status function GitHub keeps the implicit success().
    const condition = review.steps[index(review.steps, 'Publish review')].if
    assert.equal(condition, notReviewed)
  },
  'review: an already reviewed commit skips the limit, the model and publishing'() {
    const first = index(review.steps, 'Check previous review')
    assert.equal(first, 0)
    assert.equal(review.steps[first].id, 'previous')
    assert.match(review.steps[first].run, /GITHUB_RUN_ATTEMPT" = 1/)
    for (const step of review.steps.slice(1)) {
      if (step.name === 'Reserve agent run') continue
      assert.equal(step.if, notReviewed, `step "${step.name}" runs for an already reviewed commit`)
    }
    // A skipped limit check never reserves a run.
    assert.match(review.steps[index(review.steps, 'Reserve agent run')].if, /steps\.limit\.outcome == 'success'/)
    const publish = review.steps[index(review.steps, 'Publish review')].run
    assert.ok(publish.includes('<!-- opencode-review:$HEAD_SHA -->'))
    assert.ok(review.steps[first].run.includes('<!-- opencode-review:$HEAD_SHA -->'))
  },
  'review: the prompt is built by the default-branch script before the model is called'() {
    const prepare = index(review.steps, 'Prepare review prompt')
    assert.ok(prepare < index(review.steps, 'Run review'))
    assert.match(review.steps[prepare].run, /limit\/\.github\/scripts[\s\S]*prepare-review\.sh/)
  },
  'review: project instructions and skills are not loaded on top of the prompt'() {
    const { env } = review.steps[index(review.steps, 'Run review')]
    assert.equal(env.OPENCODE_DISABLE_PROJECT_CONFIG, '1')
    assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, '1')
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
