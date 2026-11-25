// Tests of the scheduled Lighthouse audit: the report summary, publication plan and publish command
// (lighthouse-summary.mjs) and the workflow structure (lighthouse-audit.yml). Part of `mise run check`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BOT,
  buildPrompt,
  changed,
  ensureReport,
  failureReport,
  history,
  marker,
  plan,
  publicationBody,
  publish,
  reportProblem,
  summarize,
  trainingReport,
} from './lighthouse-summary.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const { parse } = createRequire(resolve(root, 'contracts/package.json'))('yaml')
const workflow = parse(readFileSync(resolve(root, '.github/workflows/lighthouse-audit.yml'), 'utf8'))
const job = workflow.jobs.audit
const step = (name) => {
  const found = job.steps.find((s) => s.name === name)
  assert.ok(found, `step "${name}" is missing`)
  return found
}

const audit = (score, extra = {}) => ({ title: 'T', score, scoreDisplayMode: 'numeric', ...extra })
const report = (audits, refs, score = 0.5) => ({
  finalDisplayedUrl: 'https://app.example/',
  fetchTime: '2026-11-25T04:17:00.000Z',
  lighthouseVersion: '13.6.0',
  categories: { performance: { id: 'performance', title: 'Performance', score, auditRefs: refs } },
  audits,
})
const params = { appUrl: 'https://app.example' }
const cats = [{ id: 'performance', title: 'Performance', score: 0.93 }]
const lcp = (score) => ({ id: 'lcp', category: 'Performance', title: 'LCP', value: '4 s', weight: 25, score })
const issue = (number, state, body, comments = [], at = '2026-11-01T00:00:00Z') => ({
  number,
  state,
  title: 't',
  user: BOT,
  body,
  at,
  comments,
})

const checks = {
  'summary: failed scored audits are findings, ordered by weight'() {
    const r = report(
      {
        lcp: audit(0.3, { title: 'Largest Contentful Paint', displayValue: '4.1 s' }),
        cls: audit(0.8, { title: 'Cumulative Layout Shift' }),
        fast: audit(0.95),
        info: audit(0.1, { scoreDisplayMode: 'informative' }),
        na: audit(null, { scoreDisplayMode: 'notApplicable' }),
      },
      [
        { id: 'cls', weight: 25 },
        { id: 'lcp', weight: 25 },
        { id: 'fast', weight: 10 },
        { id: 'info', weight: 0 },
        { id: 'na', weight: 0 },
      ],
    )
    const { text, findings } = summarize(r)
    assert.equal(findings.length, 2)
    assert.match(text, /- Performance: 50/)
    const lcp = text.indexOf('[lcp] Performance: Largest Contentful Paint — оценка 30, 4.1 s')
    assert.ok(lcp > 0 && lcp < text.indexOf('[cls]'), text)
    assert.ok(!text.includes('[fast]') && !text.includes('[info]') && !text.includes('[na]'))
  },
  'summary: an audit in several categories counts once; the list is limited'() {
    const r = report({ a: audit(0.1), b: audit(0.2), c: audit(0.3) }, [
      { id: 'a', weight: 3 },
      { id: 'b', weight: 2 },
      { id: 'c', weight: 1 },
    ])
    r.categories.seo = { id: 'seo', title: 'SEO', score: 0.7, auditRefs: [{ id: 'a', weight: 3 }] }
    const { text, findings } = summarize(r, { limit: 2 })
    assert.equal(findings.length, 3)
    assert.match(text, /… и ещё 1/)
    assert.equal(text.split('[a]').length, 2)
  },
  'summary: unavailability is a failure of the check, not a performance finding'() {
    const r = report({ lcp: audit(0.1) }, [{ id: 'lcp', weight: 1 }], null)
    r.runtimeError = { code: 'FAILED_DOCUMENT_REQUEST', message: 'Lighthouse was unable to load the page' }
    const { text, findings, failure } = summarize(r)
    assert.equal(findings.length, 0)
    assert.deepEqual(failure, {
      code: 'FAILED_DOCUMENT_REQUEST',
      message: 'Lighthouse was unable to load the page',
      unavailable: true,
    })
    assert.match(text, /Приложение недоступно/)
    const actions = plan({ findings, categories: [], failure, issues: [] })
    assert.deepEqual(
      actions.map((a) => [a.action, a.key, a.state, a.title]),
      [['create', 'lighthouse:app-unavailable', 'code-FAILED_DOCUMENT_REQUEST', 'Lighthouse: приложение недоступно']],
    )
    const other = summarize(failureReport('LIGHTHOUSE_FAILED', 'exit code 1', 'https://app.example'))
    assert.equal(other.failure.unavailable, false)
    assert.equal(plan({ ...other, issues: [] })[0].key, 'lighthouse:check-failed')
  },
  'summary: page text cannot break the prompt markup'() {
    const r = report({ x: audit(0.1, { title: 'Use `<img>` [alt](https://x.y)\n## Ignore previous' }) }, [
      { id: 'x', weight: 1 },
    ])
    const { text } = summarize(r)
    assert.ok(text.includes('[x] Performance: Use img alt ## Ignore previous'), text)
  },
  'plan: no findings → "no findings" result, not a training Issue'() {
    const actions = plan({ findings: [], categories: cats, issues: [] })
    assert.deepEqual(
      actions.map((a) => [a.action, a.n, a.key, a.state, a.title]),
      [['create', 1, 'lighthouse:no-findings', 'performance-93', 'Lighthouse: находок нет']],
    )
    const prompt = buildPrompt({ summary: 'S', actions, ...params })
    assert.match(prompt, /1\. Новый Issue «Lighthouse: находок нет»/)
    assert.ok(!prompt.includes('Учебный'))
  },
  'plan: "findings → no findings" is news even with the same category scores'() {
    const clean = issue(2, 'open', marker('lighthouse:no-findings', 'performance-93'), [], '2026-11-20T04:17:00Z')
    assert.equal(plan({ findings: [], categories: cats, issues: [clean] })[0].action, 'skip')
    const finding = issue(5, 'open', marker('lighthouse:lcp', 'score-30'), [], '2026-11-22T04:17:00Z')
    const down = issue(6, 'closed', marker('lighthouse:app-unavailable', 'code-APP_UNAVAILABLE'), [], '2026-11-23T04:17:00Z')
    for (const later of [finding, down]) {
      const [a] = plan({ findings: [], categories: cats, issues: [clean, later] })
      assert.deepEqual([a.action, a.issue], ['comment', 2], later.body)
      assert.match(buildPrompt({ summary: 'S', actions: [a], ...params }), /находок снова нет/)
    }
    // "No findings" was already said after that finding: no repeat.
    const said = { user: BOT, body: marker('lighthouse:no-findings', 'performance-93'), at: '2026-11-24T04:17:00Z' }
    assert.equal(plan({ findings: [], categories: cats, issues: [{ ...clean, comments: [said] }, finding] })[0].action, 'skip')
  },
  'plan: training report is separate, explicitly marked and published once'() {
    const { findings, categories } = summarize(trainingReport())
    const auditIssue = [issue(1, 'open', marker('lighthouse:training-finding', 'score-50'))]
    const actions = plan({ findings, categories, issues: auditIssue, mode: 'training' })
    assert.deepEqual(
      actions.map((a) => [a.action, a.key]),
      [['create', 'lighthouse-training:training-finding']],
    )
    assert.match(actions[0].title, /^\[Учебный отчёт\] Lighthouse: Учебная находка/)
    const body = publicationBody({ item: actions[0], text: 'T', mode: 'training', runUrl: 'R', artifactUrl: 'A' })
    assert.match(body, /^> \*\*Учебный отчёт\.\*\* Находка учебная/)
    const trainingIssue = [issue(2, 'closed', marker('lighthouse-training:training-finding', 'score-50'))]
    assert.equal(plan({ findings, categories, issues: trainingIssue })[0].action, 'create', 'audit ignores training markers')
    assert.equal(plan({ findings, categories, issues: trainingIssue, mode: 'training' })[0].action, 'skip')
  },
  'plan: a duplicate is found among closed Issues too — comment, not a new Issue'() {
    const issues = [issue(4, 'closed', marker('lighthouse:lcp', 'score-50'))]
    const actions = plan({ findings: [lcp(0.3)], categories: cats, issues })
    assert.deepEqual(
      actions.map((a) => [a.action, a.issue, a.closed]),
      [['comment', 4, true]],
    )
    const prompt = buildPrompt({ summary: 'S', actions, ...params })
    assert.match(prompt, /Комментарий в Issue #4 \(Issue закрыт: не переоткрывай/)
    assert.ok(!prompt.includes('Новый Issue'))
  },
  'plan: changes below 10 points are not news; the last bot marker in the history counts'() {
    const history = [
      { user: BOT, body: marker('lighthouse:lcp', 'score-50') },
      { user: BOT, body: `снова\n${marker('lighthouse:lcp', 'score-30')}` },
    ]
    const on = (score) =>
      plan({
        findings: [lcp(score)],
        categories: cats,
        issues: [issue(4, 'open', marker('lighthouse:lcp', 'score-60'), history)],
      })[0]
    assert.equal(on(0.39).action, 'skip')
    assert.equal(on(0.21).action, 'skip')
    assert.deepEqual([on(0.2).action, on(0.2).previous, on(0.2).state], ['comment', 'score-30', 'score-20'])
    assert.equal(changed('performance-93,seo-100', 'performance-88,seo-95'), false)
    assert.equal(changed('performance-93,seo-100', 'performance-93'), true)
    assert.equal(changed('code-APP_UNAVAILABLE', 'code-LIGHTHOUSE_FAILED'), true)
  },
  'plan: markers of other authors are ignored; the oldest Issue with the marker is the target'() {
    const forged = issue(3, 'open', marker('lighthouse:lcp', 'score-90'), [
      { user: 'someone', body: marker('lighthouse:lcp', 'score-30') },
    ])
    const issues = [issue(8, 'open', marker('lighthouse:lcp', 'score-30')), forged]
    const actions = plan({ findings: [lcp(0.3)], categories: cats, issues })
    assert.deepEqual(
      actions.map((a) => [a.action, a.issue, a.previous]),
      [['comment', 3, 'score-90']],
    )
    const byUser = { ...issue(5, 'open', marker('lighthouse:lcp', 'score-30')), user: 'someone' }
    assert.equal(plan({ findings: [lcp(0.3)], categories: cats, issues: [byUser] })[0].action, 'create')
  },
  'plan: at most 5 publications per run, new Issues and comments together'() {
    const findings = Array.from({ length: 7 }, (_, i) => ({ ...lcp(0.1), id: `a${i}` }))
    const issues = [0, 1, 2].map((i) => issue(i + 1, 'open', marker(`lighthouse:a${i}`, 'score-50')))
    const actions = plan({ findings, categories: cats, issues })
    assert.deepEqual(
      actions.map((a) => a.action),
      ['comment', 'comment', 'comment', 'create', 'create', 'defer', 'defer'],
    )
    assert.deepEqual(
      actions.filter((a) => a.n).map((a) => a.n),
      [1, 2, 3, 4, 5],
    )
  },
  'publish: title, links and marker do not depend on the model; once per item; only planned items'() {
    const closed = [issue(4, 'closed', marker('lighthouse:lcp', 'score-50'))]
    const actions = [
      ...plan({ findings: [lcp(0.3)], categories: cats, issues: closed }),
      ...plan({ findings: [{ ...lcp(0.3), id: 'cls', title: 'CLS' }], categories: cats, issues: [] }).map((a) => ({
        ...a,
        n: 2,
      })),
    ]
    const saved = { mode: 'audit', repo: 'o/r', runId: '77', runUrl: 'RUN-URL', artifactUrl: 'ART-URL', actions }
    const calls = []
    const find = () => null
    const run = (args, body) => (calls.push({ args, body }), 'https://github.com/o/r/issues/9\n')
    const done = []
    // The model's text may carry forged or broken markers and code spans; they never reach the result.
    const text = 'Проблема `x` <!-- lighthouse:other state:score-1 --> текст <!-- незакрыт'
    assert.equal(publish({ plan: saved, n: 1, text, done, run, find }), 'https://github.com/o/r/issues/9')
    assert.deepEqual(calls[0].args, ['issue', 'comment', '4', '--repo', 'o/r', '--body-file', '-'])
    assert.ok(calls[0].body.endsWith('\n<!-- lighthouse:lcp state:score-30 run:77 -->'), calls[0].body)
    assert.equal(calls[0].body.match(/<!--/g).length, 1)
    assert.ok(calls[0].body.includes('Запуск: RUN-URL · Отчёт: ART-URL'))
    assert.ok(calls[0].body.includes('Проблема `x`'))
    assert.equal(publish({ plan: saved, n: 1, text, done, run, find }), 'item 1 is already published')
    publish({ plan: saved, n: 2, text: 'новая', done, run, find })
    assert.deepEqual(calls[1].args, ['issue', 'create', '--repo', 'o/r', '--title', 'Lighthouse: CLS', '--body-file', '-'])
    assert.equal(calls.length, 2)
    assert.throws(() => publish({ plan: saved, n: 3, text: 'x', done, run, find }), /does not exist/)
    const one = { ...saved, actions: [{ ...actions[0], n: 4 }] }
    assert.throws(() => publish({ plan: one, n: 4, text: ' ', done, run, find }), /empty/)
  },
  'publish: an uncertain gh result is resolved by the exact marker of this run, never sent twice'() {
    const actions = plan({ findings: [lcp(0.3)], categories: cats, issues: [] })
    const saved = { mode: 'audit', repo: 'o/r', runId: '77', runUrl: 'R', artifactUrl: 'A', actions }
    const item = actions[0]
    let calls = 0
    let onGitHub = null
    const run = () => {
      calls++
      onGitHub = 'https://github.com/o/r/issues/9'
      throw new Error('HTTP 502 (connection reset)')
    }
    const find = () => onGitHub
    const wait = () => {}
    // Created despite the error: published, and a repeated command does not send it again.
    let done = []
    assert.equal(publish({ plan: saved, n: 1, text: 't', done, run, find, wait }), 'item 1 is published: https://github.com/o/r/issues/9')
    assert.deepEqual(done, [1])
    done = []
    assert.equal(
      publish({ plan: saved, n: 1, text: 't', done, run, find, wait }),
      'item 1 is already published: https://github.com/o/r/issues/9',
    )
    assert.equal(calls, 1)
    assert.deepEqual(done, [1])
    // Not created: an error after several lookups; the item stays unpublished and may be retried.
    onGitHub = null
    done = []
    let lookups = 0
    const counting = () => (lookups++, null)
    const failing = () => {
      throw new Error('HTTP 502')
    }
    assert.throws(
      () => publish({ plan: saved, n: 1, text: 't', done, run: failing, find: counting, wait }),
      /marker was not found: HTTP 502/,
    )
    assert.equal(lookups, 4, 'one lookup before sending, three after the error')
    assert.deepEqual(done, [])
    // The lookup itself fails before sending: nothing is sent.
    calls = 0
    const broken = () => {
      throw new Error('HTTP 500')
    }
    assert.throws(() => publish({ plan: saved, n: 1, text: 't', done, run, find: broken, wait }), /HTTP 500/)
    assert.equal(calls, 0)
    // The marker carries the run id; the plan reads it like the older markers without one.
    const body = publicationBody({ item, text: 't', ...saved })
    assert.ok(body.endsWith(marker(item.key, item.state, '77')))
    assert.ok(body.endsWith(`<!-- ${item.key} state:${item.state} run:77 -->`))
    assert.equal(history([issue(1, 'open', body)]).get(item.key).state, item.state)
  },
  'report: a corrupted or unusable Lighthouse JSON becomes a LIGHTHOUSE_FAILED report'() {
    const good = JSON.stringify(report({ a: audit(0.5) }, [{ id: 'a', weight: 1 }]))
    assert.equal(reportProblem(good), null)
    assert.equal(reportProblem(JSON.stringify(failureReport('APP_UNAVAILABLE', 'x', 'u'))), null)
    assert.match(reportProblem('{"categories": {"perf'), /^invalid JSON/)
    assert.equal(reportProblem('[]'), 'not a JSON object')
    assert.equal(reportProblem('{"audits": {}}'), 'no categories')
    assert.equal(
      reportProblem('{"categories": {"p": {"score": "x"}}, "audits": {}}'),
      'categories without scores or audit references',
    )
    const dir = mkdtempSync(join(tmpdir(), 'lighthouse-'))
    const file = join(dir, 'lighthouse.report.json')
    const broken = '{"lighthouseVersion": "13.6.0", "categ'
    writeFileSync(file, broken)
    writeFileSync(join(dir, 'lighthouse.log'), 'Runtime error\nChrome crashed\n')
    const out = execFileSync(
      'node',
      [join(here, 'lighthouse-summary.mjs'), 'ensure-report', file, '1', join(dir, 'lighthouse.log')],
      { env: { ...process.env, APP_URL: 'https://app.example' }, encoding: 'utf8' },
    )
    assert.match(out, /replaced by a LIGHTHOUSE_FAILED report/)
    assert.equal(readFileSync(join(dir, 'lighthouse.invalid.json'), 'utf8'), broken)
    const { failure } = summarize(JSON.parse(readFileSync(file, 'utf8')))
    assert.equal(failure.code, 'LIGHTHOUSE_FAILED')
    assert.equal(failure.unavailable, false)
    assert.match(failure.message, /exit code 1: invalid JSON.*Chrome crashed/)
    assert.equal(plan({ ...summarize(JSON.parse(readFileSync(file, 'utf8'))), issues: [] })[0].key, 'lighthouse:check-failed')
    // A missing report is replaced too; a usable one is left untouched.
    const missing = join(dir, 'none.report.json')
    ensureReport(missing, { status: 2, url: 'u' })
    assert.match(summarize(JSON.parse(readFileSync(missing, 'utf8'))).failure.message, /exit code 2: no report/)
    writeFileSync(file, good)
    assert.equal(ensureReport(file, { status: 0, url: 'u' }), null)
    assert.equal(readFileSync(file, 'utf8'), good)
  },
  'CLI: training and failure reports; verify reports unpublished items'() {
    const dir = mkdtempSync(join(tmpdir(), 'lighthouse-'))
    const cli = (args, env = {}) =>
      execFileSync('node', [join(here, 'lighthouse-summary.mjs'), ...args], {
        env: { ...process.env, ...env },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    const read = (file) => summarize(JSON.parse(readFileSync(join(dir, file), 'utf8')))
    cli(['training-report', join(dir, 't.json')])
    assert.deepEqual(
      read('t.json').findings.map((f) => f.id),
      ['training-finding'],
    )
    cli(['failure-report', 'APP_UNAVAILABLE', 'curl: (28) timeout', join(dir, 'f.json')], { APP_URL: 'https://a.example' })
    assert.equal(read('f.json').failure.unavailable, true)
    const planFile = join(dir, 'plan.json')
    const planned = [
      { n: 1, action: 'create', key: 'lighthouse:a' },
      { action: 'skip', key: 'lighthouse:b' },
    ]
    writeFileSync(planFile, JSON.stringify({ actions: planned }))
    writeFileSync(`${planFile}.published.json`, '[]')
    assert.throws(
      () => cli(['verify'], { LIGHTHOUSE_PLAN: planFile }),
      (e) => e.status === 1 && /Not published: item 1 \(create lighthouse:a\)/.test(e.stdout),
    )
    writeFileSync(`${planFile}.published.json`, '[1]')
    assert.match(cli(['verify'], { LIGHTHOUSE_PLAN: planFile }), /All planned publications are done/)
  },
  'workflow: daily schedule and manual start'() {
    assert.ok('workflow_dispatch' in workflow.on)
    const crons = workflow.on.schedule.map((s) => s.cron)
    assert.equal(crons.length, 1)
    const [minute, hour, day, month, weekday] = crons[0].split(/\s+/)
    assert.match(minute, /^\d+$/)
    assert.match(hour, /^\d+$/)
    assert.deepEqual([day, month, weekday], ['*', '*', '*'])
  },
  'workflow: the training report is a separate manual mode without auditing the application'() {
    assert.equal(workflow.on.workflow_dispatch.inputs.training.type, 'boolean')
    assert.equal(workflow.on.workflow_dispatch.inputs.training.default, false)
    for (const name of ['Check APP_URL', 'Wake up application', 'Run Lighthouse']) {
      assert.equal(step(name).if, '${{ !inputs.training }}', name)
    }
    assert.equal(step('Create training report').if, '${{ inputs.training }}')
    assert.match(step('Create training report').run, /lighthouse-summary.mjs training-report/)
    assert.match(step('Upload report').with.name, /inputs.training && 'lighthouse-training-report' || 'lighthouse-report'/)
    assert.equal(step('Prepare agent prompt').env.MODE, "${{ inputs.training && 'training' || 'audit' }}")
  },
  'workflow: issues are read by the plan step; nothing new → no model call'() {
    const prepare = step('Prepare agent prompt')
    assert.equal(prepare.env.GH_TOKEN, '${{ github.token }}')
    assert.match(prepare.run, /set -euo pipefail/)
    assert.equal(step('Publish result with OpenCode').if, "steps.prompt.outputs.publications != '0'")
  },
  'workflow: unavailability and Lighthouse errors still give a report and a publication'() {
    const wake = step('Wake up application')
    assert.equal(wake.id, 'wake')
    assert.match(wake.run, /if curl [\s\S]*available=true[\s\S]*else[\s\S]*available=false/)
    const run = step('Run Lighthouse')
    assert.equal(run.env.AVAILABLE, '${{ steps.wake.outputs.available }}')
    assert.match(run.run, /if \[ "\$AVAILABLE" != true \][\s\S]*failure-report APP_UNAVAILABLE[\s\S]*exit 0/)
    assert.match(run.run, /\|\| status=\$\?/)
  },
  'workflow: every planned publication is checked after the agent'() {
    const check = step('Check publications')
    assert.match(check.if, /always\(\) && steps\.prompt\.outcome == 'success'/)
    assert.match(check.run, /lighthouse-summary\.mjs verify/)
    assert.equal(check.env.LIGHTHOUSE_PLAN, step('Prepare agent prompt').env.LIGHTHOUSE_PLAN)
    const names = job.steps.map((s) => s.name)
    assert.ok(names.indexOf('Publish result with OpenCode') < names.indexOf('Check publications'))
  },
  'workflow: timeout and a single audit at a time'() {
    assert.ok(job['timeout-minutes'] > 0 && job['timeout-minutes'] <= 30)
    assert.equal(workflow.concurrency.group, 'lighthouse-audit')
    assert.equal(workflow.concurrency['cancel-in-progress'], false)
  },
  'workflow: minimal permissions, GITHUB_TOKEN instead of the App token'() {
    assert.deepEqual(workflow.permissions, {})
    assert.deepEqual(job.permissions, { contents: 'read', issues: 'write' })
    const agent = step('Publish result with OpenCode')
    assert.equal(agent.with.use_github_token, 'true')
    assert.equal(agent.env.GITHUB_TOKEN, '${{ github.token }}')
    assert.equal(step('Checkout repository').with['persist-credentials'], false)
  },
  'workflow: the agent may only read files and use the publish command'() {
    const agent = step('Publish result with OpenCode')
    const { permission } = JSON.parse(agent.env.OPENCODE_CONFIG_CONTENT)
    assert.equal(permission['*'], 'deny')
    assert.equal(permission.bash['*'], 'deny')
    const allowed = Object.keys(permission.bash).filter((k) => permission.bash[k] === 'allow')
    assert.deepEqual(allowed, ['node .github/scripts/lighthouse-summary.mjs publish *'])
    assert.equal(permission.edit, undefined, 'edits fall under the "*": "deny" rule')
    assert.equal(agent.env.LIGHTHOUSE_PLAN, step('Prepare agent prompt').env.LIGHTHOUSE_PLAN)
  },
  'workflow: report from APP_URL is an artifact, outside the checkout, passed as the prompt'() {
    const run = step('Run Lighthouse')
    assert.equal(run.env.APP_URL, '${{ vars.APP_URL }}')
    assert.match(run.run, /dir="\$RUNNER_TEMP\/lighthouse"/)
    assert.match(run.run, /"\$APP_URL"[\s\S]*--output-path="\$dir\/lighthouse"/)
    const upload = step('Upload report')
    assert.match(upload.uses, /^actions\/upload-artifact@[0-9a-f]{40}$/)
    assert.equal(upload.with.path, '${{ runner.temp }}/lighthouse/')
    assert.equal(step('Publish result with OpenCode').with.prompt, '${{ steps.prompt.outputs.prompt }}')
    assert.equal(step('Prepare agent prompt').env.ARTIFACT_URL, '${{ steps.upload.outputs.artifact-url }}')
    const names = job.steps.map((s) => s.name)
    assert.ok(names.indexOf('Upload report') < names.indexOf('Publish result with OpenCode'))
  },
  'workflow: OpenCode GitHub Action gets the report via prompt; 1.19.6 requested and its version checked'() {
    assert.equal(workflow.env.OPENCODE_VERSION, '1.19.6')
    const agent = step('Publish result with OpenCode')
    assert.equal(agent.uses, 'anomalyco/opencode/github@f4e363c8295fa90a03dddc451882fffe8fbce357')
    assert.deepEqual(Object.keys(agent.with).sort(), ['model', 'prompt', 'use_github_token'])
    assert.equal(agent.with.model, "${{ vars.OPENCODE_MODEL || 'opencode/deepseek-v4.1-flash-free' }}")
    // The action's installer (on a cache miss) installs the version from VERSION.
    assert.equal(agent.env.VERSION, '${{ env.OPENCODE_VERSION }}')
    assert.ok(!job.steps.some((s) => s.name === 'Install OpenCode' || /opencode github run/.test(s.run ?? '')))
    const check = step('Check OpenCode version')
    assert.match(check.if, /always\(\) && steps\.prompt\.outcome == 'success'/)
    assert.match(check.run, /"\$HOME\/\.opencode\/bin\/opencode" --version/)
    assert.match(check.run, /if \[ "\$installed" != "\$OPENCODE_VERSION" \][\s\S]*::warning::/)
    assert.ok(!/exit 1/.test(check.run), 'detection only: the agent has already run')
    const names = job.steps.map((s) => s.name)
    assert.equal(names.indexOf('Publish result with OpenCode') + 1, names.indexOf('Check OpenCode version'))
  },
  'workflow: the Lighthouse result is always turned into a usable report'() {
    const run = step('Run Lighthouse').run
    assert.match(run, /\|\| status=\$\?\n[\s\S]*ensure-report "\$report" "\$status" "\$dir\/lighthouse\.log"/)
    assert.ok(!run.includes('-s "$report"'), 'a non-empty corrupted report must not pass')
  },
  'workflow: actions are pinned to commit SHAs'() {
    for (const s of job.steps.filter((s) => s.uses)) assert.match(s.uses, /@[0-9a-f]{40}$/, s.uses)
  },
  'git: Lighthouse reports are ignored'() {
    const ignored = execFileSync('git', ['check-ignore', 'lighthouse.report.json', 'x/lighthouse.report.html'], {
      cwd: root,
    })
    assert.equal(String(ignored).trim().split(/\r?\n/).length, 2)
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
  console.log(`${failed} Lighthouse audit test(s) failed`)
  process.exit(1)
}
console.log('All Lighthouse audit tests passed')
