import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// vercel's node runtime loads the function's dependencies with require(), and refuses a
// require() of an es module anywhere in the chain: jsdom 27's encoding sniffer did, and every
// call failed with ERR_REQUIRE_ESM. node 22 here would quietly allow it, so load each one in a
// child with require(esm) switched off, the way the runtime behaves.
describe('function dependencies', () => {
  it.each(['jsdom', '@mozilla/readability'])('%s loads with plain require()', (name) => {
    const run = () => execFileSync(process.execPath, ['--no-experimental-require-module', '-e', `require(${JSON.stringify(name)})`], { cwd: process.cwd(), stdio: 'pipe' })
    expect(run).not.toThrow()
  })
})
