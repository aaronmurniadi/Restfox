export type EnvironmentRow = {
    key: string
    value: string
    // the JSON value this row was loaded from, so an unedited row saves the same type
    stored?: unknown
}

export function displayEnvironmentValue(value: unknown) {
    if (typeof value === 'string') {
        return value
    }

    if (value === undefined) {
        return ''
    }

    return JSON.stringify(value)
}

export function rowsFromEnvironment(object: unknown): EnvironmentRow[] {
    if (object === null || typeof object !== 'object' || Array.isArray(object)) {
        return []
    }

    return Object.entries(object).map(([key, value]) => ({
        key,
        value: displayEnvironmentValue(value),
        stored: value,
    }))
}

// a value the user typed stays a string, unless it is a JSON object or array.
// an unedited row keeps the value it was loaded with, including numbers and booleans
export function environmentValueFromText(text: string, stored?: unknown) {
    if (stored !== undefined && displayEnvironmentValue(stored) === text) {
        return stored
    }

    const trimmed = text.trim()
    const looksLikeJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
    if (looksLikeJson) {
        try {
            const parsed = JSON.parse(trimmed)
            if (parsed !== null && typeof parsed === 'object') {
                return parsed
            }
        } catch {
            // the text only looks like JSON
        }
    }

    return text
}

export function environmentFromRows(rows: EnvironmentRow[]) {
    const object: Record<string, unknown> = {}

    for (const row of rows) {
        if (row.key.trim() === '') {
            continue
        }

        object[row.key] = environmentValueFromText(row.value, row.stored)
    }

    return object
}
