import { describe, expect, test } from 'vitest'
import { environmentEmoji, environmentMarkerHtml, environmentOptionLabel, isSingleEmoji } from '@/utils/environment-marker'

describe('environment emoji', () => {
    test('a single emoji is kept and anything else falls back to the color', () => {
        expect(isSingleEmoji('🚀')).toBe(true)
        expect(isSingleEmoji('🇺🇸')).toBe(true)
        expect(isSingleEmoji('👍🏻')).toBe(true)
        expect(isSingleEmoji('🚀🚀')).toBe(false)
        expect(isSingleEmoji('hello')).toBe(false)
        expect(isSingleEmoji('<img>')).toBe(false)

        expect(environmentEmoji({ emoji: '  🚀  ' })).toBe('🚀')
        expect(environmentEmoji({ emoji: 'nope' })).toBeUndefined()
        expect(environmentEmoji({})).toBeUndefined()
    })

    test('the menu shows the emoji, or the colored circle when there is none', () => {
        expect(environmentMarkerHtml({ emoji: '🚀', color: 'red' })).toContain('🚀')
        expect(environmentMarkerHtml({ emoji: '🚀', color: 'red' })).not.toContain('fa-circle')
        expect(environmentMarkerHtml({ color: 'red' })).toContain('fa-circle')
        expect(environmentMarkerHtml({ color: 'red' })).toContain('color:red')
        expect(environmentOptionLabel({ name: 'Prod <dev>', emoji: '🔥' })).toBe(
            '<span class="environment-emoji" style="display:inline-block;width:1.1em;text-align:center;line-height:1;">🔥</span>&nbsp;&nbsp;Prod &lt;dev&gt;',
        )
    })
})