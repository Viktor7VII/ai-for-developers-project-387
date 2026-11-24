import { spawnSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'

const contracts = resolve(root, 'contracts')
const backend = resolve(root, 'backend')
const frontend = resolve(root, 'frontend')
const sdkDir = resolve(frontend, 'src/shared/api/generated')
const npm = isWindows ? 'npm.cmd' : 'npm'
const mvn = isWindows ? 'mvn.cmd' : 'mvn'

// Committed artifacts generated from the contract (ADR-0003).
const generatedPaths = ['contracts/openapi', 'frontend/src/shared/api/generated']

function run(label, command, args, cwd, { capture = false } = {}) {
  console.log(`\n========== ${label} ==========\n`)

  const options = { cwd, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8' }
  const result = isWindows
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], options)
    : spawnSync(command, args, options)

  if (result.error) {
    console.error(result.error)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
  return result.stdout ?? ''
}

// The generator never removes stale files, so the SDK directory is cleared first
// (keeping the ignore file) and files dropped from the contract disappear.
function cleanSdk() {
  for (const entry of readdirSync(sdkDir)) {
    if (entry !== '.openapi-generator-ignore') {
      rmSync(join(sdkDir, entry), { recursive: true, force: true })
    }
  }
}

function generate() {
  run('Compile TypeSpec contract', npm, ['run', 'compile'], contracts)
  cleanSdk()
  run('Generate TypeScript SDK', npm, ['run', 'generate:sdk'], contracts)
  run('Generate server API interfaces', mvn, ['-q', 'generate-sources'], backend)
}

// Fails when committed generated files differ from a fresh generation: modified, deleted
// and new untracked files all show up in `git status --porcelain`. Runs only in CI, where
// the working tree must match the commit; locally uncommitted contract changes are expected.
function checkGeneratedFiles() {
  if (!process.env.CI) {
    console.log('\nSkipping generated files check (runs in CI only).')
    return
  }
  const status = run('Check generated files are up to date', 'git', ['status', '--porcelain', '--', ...generatedPaths], root, { capture: true })
  if (status.trim() !== '') {
    console.error(status)
    console.error('Generated files are out of date. Run `mise run generate` and commit the result.')
    process.exit(1)
  }
}

// Bash tests of the agent run limit GitHub action. On Windows the bash of Git for Windows is used:
// `bash` on PATH may be the WSL launcher.
function runAgentRunLimitTests() {
  console.log('\n========== Agent run limit tests ==========\n')
  let bash = 'bash'
  if (isWindows) {
    const execPath = spawnSync('git', ['--exec-path'], { encoding: 'utf8' }).stdout?.trim()
    if (execPath) {
      // <Git>/mingw64/libexec/git-core -> <Git>/bin/bash.exe
      bash = resolve(execPath, '..', '..', '..', 'bin', 'bash.exe')
    }
  }
  const result = spawnSync(bash, ['scripts/agent-run-limit.test.sh'], { cwd: root, stdio: 'inherit' })
  if (result.error) {
    console.error(result.error)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const command = process.argv[2] ?? 'check'

generate()

if (command === 'generate') {
  console.log('\nGeneration finished.')
  process.exit(0)
}

checkGeneratedFiles()

runAgentRunLimitTests()

run('Backend tests', mvn, ['test'], backend)

run('Frontend tests', npm, ['test'], frontend)

run('Frontend lint', npm, ['run', 'lint'], frontend)

run('Frontend build', npm, ['run', 'build'], frontend)

console.log('\nAll project checks passed!')
