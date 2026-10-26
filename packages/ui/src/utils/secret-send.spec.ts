// @vitest-environment edge-runtime

import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CollectionItem, Workspace } from '@/global'
import { emitter } from '@/event-bus'
import { createSecretSession, lockSecretSession, revealedSecretValues, sealSecretValues } from '@/utils/secret-encryption'
import { unlockSecretsForSend } from '@/utils/secret-send'

const request = {
    _id: 'request-id',
    _type: 'request',
    name: 'Users',
    parentId: null,
    workspaceId: 'workspace-id',
    method: 'GET',
    url: 'https://example.com/{{token}}',
} as CollectionItem

afterEach(() => {
    lockSecretSession()
    delete (window as any).createPrompt
})

async function encryptedToken(password = 'correct horse') {
    await createSecretSession(password, 1_000)
    const globalSecrets = await sealSecretValues({ token: 'super-secret-value' })
    lockSecretSession()
    return globalSecrets
}

function workspace(globalSecrets: unknown, extra: Partial<Workspace> = {}): Workspace {
    return {
        _id: 'workspace-id',
        name: 'Workspace',
        globalSecrets,
        environment: {},
        environments: [{ name: 'Default', environment: {} }],
        currentEnvironment: 'Default',
        ...extra,
    } as Workspace
}

describe('unlockSecretsForSend', () => {
    test('a send that does not read a locked secret does not ask', async () => {
        const createPrompt = vi.fn()
            ; (window as any).createPrompt = createPrompt
        const globalSecrets = await encryptedToken()

        const allowed = await unlockSecretsForSend(workspace(globalSecrets), [], { ...request, url: 'https://example.com/users' }, [])

        expect(allowed).toBe(true)
        expect(createPrompt).not.toHaveBeenCalled()
        expect(revealedSecretValues(globalSecrets)).toBeUndefined()
    })

    test('a later plain value of the same name does not ask', async () => {
        const createPrompt = vi.fn()
            ; (window as any).createPrompt = createPrompt
        const globalSecrets = await encryptedToken()

        const allowed = await unlockSecretsForSend(workspace(globalSecrets, {
            environment: { token: 'plain' },
            environments: [{ name: 'Default', environment: { token: 'plain' } }],
        }), [], request, [])

        expect(allowed).toBe(true)
        expect(createPrompt).not.toHaveBeenCalled()
    })

    test('cancel leaves the secret locked and the send does not go on', async () => {
        const createPrompt = vi.fn(async () => null)
            ; (window as any).createPrompt = createPrompt
        const globalSecrets = await encryptedToken()

        const allowed = await unlockSecretsForSend(workspace(globalSecrets), [], request, [])

        expect(allowed).toBe(false)
        expect(createPrompt).toHaveBeenCalledTimes(1)
        expect(revealedSecretValues(globalSecrets)).toBeUndefined()
    })

    test('the password opens the secret, and a wrong one asks again', async () => {
        const createPrompt = vi.fn()
            .mockResolvedValueOnce('nope')
            .mockResolvedValueOnce('correct horse')
            ; (window as any).createPrompt = createPrompt
        const errors: unknown[] = []
        const onError = (message: unknown) => {
            errors.push(message)
        }
        emitter.on('error', onError)
        const globalSecrets = await encryptedToken()
        const onUnlocked = vi.fn()

        const allowed = await unlockSecretsForSend(workspace(globalSecrets), [], request, [], [], onUnlocked)

        emitter.off('error', onError)
        expect(allowed).toBe(true)
        expect(errors).toEqual(['Wrong password'])
        expect(onUnlocked).toHaveBeenCalledTimes(1)
        expect(revealedSecretValues(globalSecrets)).toEqual({ token: 'super-secret-value' })
    })

    test('a variable whose value uses the secret asks too', async () => {
        const createPrompt = vi.fn(async () => null)
            ; (window as any).createPrompt = createPrompt
        const globalSecrets = await encryptedToken()

        const allowed = await unlockSecretsForSend(workspace(globalSecrets, {
            globals: { url: 'https://example.com?token={{token}}' },
        }), [], { ...request, url: '{{url}}' }, [])

        expect(allowed).toBe(false)
        expect(createPrompt).toHaveBeenCalledTimes(1)
    })
})
