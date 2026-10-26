import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { fetchSession, getGitHubLoginUrl, getApiBaseUrl } from '@/utils/github-auth'

describe('github-auth', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    test('getApiBaseUrl strips trailing slash', () => {
        expect(getApiBaseUrl().endsWith('/')).toBe(false)
    })

    test('getGitHubLoginUrl points at API OAuth start', () => {
        expect(getGitHubLoginUrl()).toBe(`${getApiBaseUrl()}/auth/github`)
    })

    test('fetchSession returns unauthenticated on 401', async () => {
        ; (fetch as any).mockResolvedValue({ status: 401, ok: false })
        await expect(fetchSession()).resolves.toEqual({ authenticated: false })
    })

    test('fetchSession returns session payload when authenticated', async () => {
        const payload = {
            authenticated: true,
            user: { id: 1, login: 'alice', name: 'Alice', avatarUrl: '' },
            repo: {
                fullName: 'alice/restfox',
                owner: 'alice',
                name: 'restfox',
                cloneUrl: 'https://github.com/alice/restfox.git',
                htmlUrl: 'https://github.com/alice/restfox',
                created: false,
            },
            accessToken: 'token',
        }
            ; (fetch as any).mockResolvedValue({
                status: 200,
                ok: true,
                json: async () => payload,
            })
        await expect(fetchSession()).resolves.toEqual(payload)
    })

    test('fetchSession returns unauthenticated when the API is unreachable', async () => {
        ; (fetch as any).mockRejectedValue(new Error('network'))
        await expect(fetchSession()).resolves.toEqual({ authenticated: false })
    })
})
