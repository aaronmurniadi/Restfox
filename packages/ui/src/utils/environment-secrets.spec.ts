// @vitest-environment edge-runtime

import { describe, expect, test } from 'vitest'
import { reactive } from 'vue'
import { SendResolver, substituteEnvironmentVariables } from '@/helpers'
import { attachSecretPaths, buildResolvedEnvironment, isSecretPath, secretPathsOf } from '@/utils/environment-secrets'

const substitute = (environment: any, text: string) => substituteEnvironmentVariables(environment, text, { resolvePromptTags: false })

describe('buildResolvedEnvironment', () => {
    test('a workspace value can use a global, and a later folder overrides both', async () => {
        const environment = await buildResolvedEnvironment(
            { globals: { host: 'https://global.example' }, environment: { url: '{{host}}/v1' } },
            [{ environment: { url: 'https://folder.example/v1' } }],
            substitute,
        )

        expect(environment.url).toBe('https://folder.example/v1')
        expect(environment.host).toBe('https://global.example')
    })

    test('a file workspace still resolves a .env value inside the environment', async () => {
        const environment = await buildResolvedEnvironment(
            { _type: 'file', dotEnv: { HOST: 'localhost' }, environment: { url: 'http://{{process.env.HOST}}:4004' } },
            [],
            substitute,
        )

        expect(environment.url).toBe('http://localhost:4004')
    })

    test('a secret is marked until a later plain value of the same name overrides it', async () => {
        const secret = await buildResolvedEnvironment(
            { globalSecrets: { token: 'secret' }, environment: {} },
            [],
            substitute,
        )
        expect(secret.token).toBe('secret')
        expect(isSecretPath('token', secretPathsOf(secret))).toBe(true)

        const overridden = await buildResolvedEnvironment(
            { globalSecrets: { token: 'secret' }, environment: { token: 'plain' } },
            [],
            substitute,
        )
        expect(overridden.token).toBe('plain')
        expect(isSecretPath('token', secretPathsOf(overridden))).toBe(false)
    })

    test('a secret stays marked after Vue wraps the resolved environment', async () => {
        const environment = reactive(await buildResolvedEnvironment(
            { globals: { host: 'https://example.com' }, globalSecrets: { token: 'super-secret-value' } },
            [],
            substitute,
        ))

        expect(isSecretPath('token', secretPathsOf(environment))).toBe(true)
        expect(await substituteEnvironmentVariables(environment, '{{host}}/users?token={{token}}', { maskSecrets: true, tagTrigger: false })).toBe('https://example.com/users?token=******')
    })
})

describe('secret values while substituting', () => {
    test('a preview hides a secret and a send keeps it for the request but not for what is saved', async () => {
        const environment = { host: 'example.test', token: 'super-secret' }
        attachSecretPaths(environment, new Set(['token']))

        expect(await substituteEnvironmentVariables(environment, 'https://{{host}}/{{token}}', { maskSecrets: true })).toBe('https://example.test/******')

        const send = new SendResolver('w')
        const { textResolved, textResolvedMasked } = await send.resolveWithMasked(environment, 'https://example.test/{{token}}', 'url')
        expect(textResolved).toBe('https://example.test/super-secret')
        expect(textResolvedMasked).toBe('https://example.test/******')
        expect(send.maskedPromptOmitted).toMatchObject({ reason: 'masked-field', headerNames: [], body: false })
    })
})
