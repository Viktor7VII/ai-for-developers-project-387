import { describe, expect, it } from 'vitest'
import { formatDuration } from './datetime'
import { SLUG_PATTERN, slugify } from './slug'

describe('slugify', () => {
  it('transliterates Russian titles', () => {
    expect(slugify('Консультация')).toBe('konsultatsiya')
    expect(slugify('Щедрый ёжик')).toBe('schedryy-ezhik')
  })

  it('replaces separators and trims hyphens', () => {
    expect(slugify('  Intro Call: 15 min!  ')).toBe('intro-call-15-min')
    expect(slugify('---')).toBe('')
  })

  it('produces slugs accepted by the API pattern', () => {
    for (const title of ['Встреча №1', 'Обсуждение проекта (MVP)', 'a--b']) {
      expect(slugify(title)).toMatch(SLUG_PATTERN)
    }
  })

  it('limits length to 100 characters', () => {
    expect(slugify('a'.repeat(150))).toHaveLength(100)
  })
})

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(30)).toBe('30 мин')
    expect(formatDuration(60)).toBe('1 ч')
    expect(formatDuration(90)).toBe('1 ч 30 мин')
  })
})
