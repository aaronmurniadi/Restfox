import { describe, expect, test } from 'vitest'
import { environmentFromRows, rowsFromEnvironment } from '@/utils/environment-rows'

describe('environment key value rows', () => {
    test('an unedited row saves the original JSON value', () => {
        const rows = rowsFromEnvironment({
            host: 'https://example.com',
            port: 4000,
            on: true,
            user: { id: 1 },
            empty: '',
        })

        expect(environmentFromRows(rows)).toEqual({
            host: 'https://example.com',
            port: 4000,
            on: true,
            user: { id: 1 },
            empty: '',
        })
    })

    test('a typed value is a string, and a typed object is saved as JSON', () => {
        const rows = rowsFromEnvironment({ port: 4000 })
        rows[0].value = '4001'
        rows.push({ key: 'user', value: '{"id":2}', stored: undefined })
        rows.push({ key: 'note', value: '{not json', stored: undefined })
        rows.push({ key: '  ', value: 'ignored', stored: undefined })

        expect(environmentFromRows(rows)).toEqual({
            port: '4001',
            user: { id: 2 },
            note: '{not json',
        })
    })
})