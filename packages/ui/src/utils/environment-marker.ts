// Shown in the emoji prompt. A click uses that emoji instead of the environment's color.
export const ENVIRONMENT_EMOJI_CHOICES = [
    '🟢', '🟡', '🔴', '🟠', '🔵', '🟣', '⚫', '⚪',
    '🚀', '🧪', '🔧', '🌱', '🔥', '💻', '🏠', '☁️',
    '⭐', '✨', '🐛', '🚧', '🔒', '📦', '🦄', '💎',
]

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

function graphemes(value: string) {
    if(segmenter) {
        return [...segmenter.segment(value)].map(part => part.segment)
    }

    return [...value]
}

// one pictograph or one flag, so a pasted sentence or markup cannot become the marker
export function isSingleEmoji(value: string) {
    const parts = graphemes(value)
    if(parts.length !== 1) {
        return false
    }

    const grapheme = parts[0]
    return /\p{Extended_Pictographic}/u.test(grapheme) || /^\p{Regional_Indicator}{2}$/u.test(grapheme)
}

export function environmentEmoji(environment: { emoji?: unknown } | null | undefined) {
    if(!environment || typeof environment.emoji !== 'string') {
        return undefined
    }

    const emoji = environment.emoji.trim()
    return isSingleEmoji(emoji) ? emoji : undefined
}

function escapeHtml(text: string) {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

// the menu row's marker: the emoji when the environment has one, otherwise the colored circle
export function environmentMarkerHtml(environment: { color?: string, emoji?: unknown } | null | undefined) {
    const emoji = environmentEmoji(environment)
    if(emoji) {
        return `<span class="environment-emoji" style="display:inline-block;width:1.1em;text-align:center;line-height:1;">${escapeHtml(emoji)}</span>`
    }

    const color = environment?.color || 'var(--text-color)'
    return `<i class="fa fa-circle" style="color:${escapeHtml(color)}"></i>`
}

export function environmentOptionLabel(environment: { name?: string, color?: string, emoji?: unknown }) {
    return `${environmentMarkerHtml(environment)}&nbsp;&nbsp;${escapeHtml(environment.name ?? '')}`
}
