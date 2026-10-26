import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { githubAuthorizeUrl, ensurePrivateRestfoxRepo } from './github.js'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

test('githubAuthorizeUrl includes repo scope and state', () => {
    const url = githubAuthorizeUrl({
        clientId: 'abc',
        redirectUri: 'http://localhost/callback',
        state: 'xyz',
    })
    const parsed = new URL(url)
    assert.equal(parsed.origin, 'https://github.com')
    assert.equal(parsed.searchParams.get('client_id'), 'abc')
    assert.equal(parsed.searchParams.get('scope'), 'repo')
    assert.equal(parsed.searchParams.get('state'), 'xyz')
})

function mockFetchSequence(handlers) {
    let i = 0
    globalThis.fetch = async (url, options = {}) => {
        const handler = handlers[i++]
        if (!handler) {
            throw new Error(`Unexpected fetch: ${url} ${options.method || 'GET'}`)
        }
        return handler(String(url), options)
    }
}

function jsonResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        text: async () => JSON.stringify(body),
        json: async () => body,
    }
}

test('ensurePrivateRestfoxRepo reuses an existing private restfox repo', async () => {
    mockFetchSequence([
        () => jsonResponse(200, {
            private: true,
            full_name: 'alice/restfox',
            name: 'restfox',
            owner: { login: 'alice' },
            clone_url: 'https://github.com/alice/restfox.git',
            html_url: 'https://github.com/alice/restfox',
        }),
    ])

    const repo = await ensurePrivateRestfoxRepo('token', 'alice')
    assert.equal(repo.fullName, 'alice/restfox')
    assert.equal(repo.created, false)
})

test('ensurePrivateRestfoxRepo rejects a public existing repo', async () => {
    mockFetchSequence([
        () => jsonResponse(200, {
            private: false,
            full_name: 'alice/restfox',
            name: 'restfox',
            owner: { login: 'alice' },
        }),
    ])

    await assert.rejects(
        () => ensurePrivateRestfoxRepo('token', 'alice'),
        /not private/,
    )
})

test('ensurePrivateRestfoxRepo creates private repo and seeds files', async () => {
    const putPaths = []
    mockFetchSequence([
        () => jsonResponse(404, { message: 'Not Found' }),
        () => jsonResponse(404, { message: 'Not Found' }),
        () => jsonResponse(201, {
            private: true,
            full_name: 'alice/restfox',
            name: 'restfox',
            owner: { login: 'alice' },
            clone_url: 'https://github.com/alice/restfox.git',
            html_url: 'https://github.com/alice/restfox',
        }),
        (url) => {
            putPaths.push(url)
            return jsonResponse(201, { content: {} })
        },
        (url) => {
            putPaths.push(url)
            return jsonResponse(201, { content: {} })
        },
        (url) => {
            putPaths.push(url)
            return jsonResponse(201, { content: {} })
        },
    ])

    const repo = await ensurePrivateRestfoxRepo('token', 'alice')
    assert.equal(repo.created, true)
    assert.equal(repo.name, 'restfox')
    assert.equal(putPaths.length, 3)
    assert.ok(putPaths.some(p => p.includes('restfox-repo.json')))
    assert.ok(putPaths.some(p => p.includes('.gitignore')))
    assert.ok(putPaths.some(p => p.includes('workspaces/my-collection/restfox.json')))
})
