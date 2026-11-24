import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'

// The glass look lives in index.html: the limits and the count share one base under Mochi, and the bubbles are glass in their chat's ink.
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))

describe('glass capsule', () => {
  it('puts the limits and the count in one base, each still its own button', () => {
    expect(html).toMatch(/<div id="base">\s*<button id="limits"[^>]*><\/button>\s*<button id="agents"[^>]*><\/button>\s*<\/div>/)
  })

  it('hides the base where the count and the limits were hidden', () => {
    expect(css).toMatch(/\.peek #base, \.away #base/)
  })

  it('hides the base when neither button shows, a count turned off included', () => {
    expect(css).toContain('#base:not(:has(> #limits:not(:empty), > #agents:not(.empty):not([hidden]))) { display: none; }')
  })

  it('draws the bubbles as frosted glass lit in their ink', () => {
    const job = css.match(/\n\s*\.job \{[^}]*\}/)?.[0] ?? ''
    expect(job).toContain('backdrop-filter')
    expect(job).toContain('var(--ink')
  })

  it('adds no endless motion', () => {
    expect(css).not.toMatch(/infinite/)
  })
})
