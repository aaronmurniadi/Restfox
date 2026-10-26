// @vitest-environment node

import { afterEach, describe, expect, test } from 'vitest'
import {
    SECRET_KDF_ITERATIONS,
    copySecretValues,
    createSecretSession,
    isEncryptedSecrets,
    lockSecretSession,
    openEncryptedSecrets,
    revealedSecretValues,
    sealSecretValues,
    unlockSecretSession,
    type EncryptedSecrets,
} from '@/utils/secret-encryption'

afterEach(() => {
    lockSecretSession()
})

describe('secret encryption', () => {
    test('a password encrypts values into JSON and the same password reads them back', async () => {
        expect(SECRET_KDF_ITERATIONS).toBe(600_000)
        await createSecretSession('correct horse', 1_000)

        const sealed = await sealSecretValues({
            token: 'super-secret-value',
            retries: 2,
            nested: { id: 1 },
        })

        expect(isEncryptedSecrets(sealed)).toBe(true)
        expect(JSON.parse(JSON.stringify(sealed))).toEqual(sealed)
        const encrypted = sealed as EncryptedSecrets
        expect(encrypted.values.token.ct).not.toContain('super-secret-value')
        expect(JSON.stringify(encrypted)).not.toContain('super-secret-value')

        lockSecretSession()
        expect(revealedSecretValues(encrypted)).toBeUndefined()
        expect(await unlockSecretSession('wrong password', encrypted)).toBe(false)
        expect(await unlockSecretSession('correct horse', encrypted)).toBe(true)
        expect(revealedSecretValues(encrypted)).toEqual({
            token: 'super-secret-value',
            retries: 2,
            nested: { id: 1 },
        })
    })

    test('a changed ciphertext or a swapped value does not open', async () => {
        await createSecretSession('correct horse', 1_000)
        const sealed = await sealSecretValues({ token: 'one', other: 'two' }) as EncryptedSecrets
        const opened = copySecretValues(sealed.values) as EncryptedSecrets['values']

        const tampered: EncryptedSecrets = {
            ...sealed,
            values: {
                ...sealed.values,
                token: { ...sealed.values.token, ct: `${sealed.values.token.ct.slice(0, -2)}aa` },
            },
        }
        expect(await openEncryptedSecrets(tampered)).toBeUndefined()

        const swapped: EncryptedSecrets = {
            ...sealed,
            values: {
                token: opened.other,
                other: opened.token,
            },
        }
        expect(await openEncryptedSecrets(swapped)).toBeUndefined()
    })

    test('without a password the values stay plain JSON', async () => {
        const plain = { token: 'super-secret-value' }
        expect(await sealSecretValues(plain)).toBe(plain)
        expect(revealedSecretValues(plain)).toEqual(plain)
    })
})
