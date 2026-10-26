import { toRaw } from 'vue'

// A secrets file stays JSON. Each value is AES-256-GCM ciphertext, and the password is turned into a key with
// PBKDF2 so the password itself is never written. The key stays in memory for this page and is dropped on lock.
export const SECRET_KDF_ITERATIONS = 600_000

const VERIFIER_TEXT = 'restfox-secrets-v1'
const VERIFIER_AAD = 'restfox-secrets-verifier'
const SALT_BYTES = 16
const IV_BYTES = 12
const MAX_KDF_ITERATIONS = 1_000_000

export type SecretCiphertext = {
    iv: string
    ct: string
}

export type EncryptedSecrets = {
    restfoxEncryptedSecrets: 1
    kdf: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
    verifier: SecretCiphertext
    values: Record<string, SecretCiphertext>
}

type Session = {
    key: CryptoKey
    salt: string
    iterations: number
    generation: number
}

type OpenedSecrets = {
    generation: number
    values: Record<string, unknown>
}

let session: Session | null = null
const openedSecrets = new WeakMap<object, OpenedSecrets>()

function secretsRecord(secrets: object) {
    return toRaw(secrets)
}

function isCiphertext(value: unknown): value is SecretCiphertext {
    if (value === null || typeof value !== 'object') {
        return false
    }

    const ciphertext = value as SecretCiphertext
    return typeof ciphertext.iv === 'string' && ciphertext.iv !== '' && typeof ciphertext.ct === 'string' && ciphertext.ct !== ''
}

export function isEncryptedSecrets(value: unknown): value is EncryptedSecrets {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }

    const encrypted = value as EncryptedSecrets
    return encrypted.restfoxEncryptedSecrets === 1
        && encrypted.kdf === 'PBKDF2'
        && encrypted.hash === 'SHA-256'
        && Number.isInteger(encrypted.iterations)
        && encrypted.iterations >= 1
        && encrypted.iterations <= MAX_KDF_ITERATIONS
        && typeof encrypted.salt === 'string'
        && encrypted.salt !== ''
        && isCiphertext(encrypted.verifier)
        && encrypted.values !== null
        && typeof encrypted.values === 'object'
        && !Array.isArray(encrypted.values)
}

export function secretsUnlocked() {
    return session !== null
}

export function lockSecretSession() {
    session = null
}

function bytesToBase64(bytes: Uint8Array) {
    let binary = ''
    for (const byte of bytes) {
        binary += String.fromCharCode(byte)
    }
    return btoa(binary)
}

function base64ToBytes(value: string) {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index)
    }
    return bytes
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
    const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey'],
    )

    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    )
}

async function encryptBytes(key: CryptoKey, bytes: Uint8Array, aad: string): Promise<SecretCiphertext> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
        key,
        bytes,
    )

    return {
        iv: bytesToBase64(iv),
        ct: bytesToBase64(new Uint8Array(encrypted)),
    }
}

async function decryptBytes(key: CryptoKey, ciphertext: SecretCiphertext, aad: string) {
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(ciphertext.iv), additionalData: new TextEncoder().encode(aad) },
        key,
        base64ToBytes(ciphertext.ct),
    )

    return new Uint8Array(decrypted)
}

function remember(encrypted: EncryptedSecrets, values: Record<string, unknown>) {
    if (session === null) {
        return
    }

    openedSecrets.set(secretsRecord(encrypted), {
        generation: session.generation,
        values,
    })
}

async function openWithSession(encrypted: EncryptedSecrets) {
    if (session === null || encrypted.salt !== session.salt || encrypted.iterations !== session.iterations) {
        return undefined
    }

    const verifier = new TextDecoder().decode(await decryptBytes(session.key, encrypted.verifier, VERIFIER_AAD))
    if (verifier !== VERIFIER_TEXT) {
        return undefined
    }

    const values: Record<string, unknown> = {}
    for (const [name, ciphertext] of Object.entries(encrypted.values)) {
        if (!isCiphertext(ciphertext)) {
            return undefined
        }

        const json = new TextDecoder().decode(await decryptBytes(session.key, ciphertext, name))
        values[name] = JSON.parse(json)
    }

    remember(encrypted, values)
    return values
}

export async function createSecretSession(password: string, iterations = SECRET_KDF_ITERATIONS) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const key = await deriveKey(password, salt, iterations)
    session = {
        key,
        salt: bytesToBase64(salt),
        iterations,
        generation: (session?.generation ?? 0) + 1,
    }
}

// The verifier is authenticated ciphertext, so a wrong password fails closed without a stored password hash
export async function unlockSecretSession(password: string, encrypted: EncryptedSecrets) {
    if (!isEncryptedSecrets(encrypted)) {
        return false
    }

    try {
        const key = await deriveKey(password, base64ToBytes(encrypted.salt), encrypted.iterations)
        const verifier = new TextDecoder().decode(await decryptBytes(key, encrypted.verifier, VERIFIER_AAD))
        if (verifier !== VERIFIER_TEXT) {
            return false
        }

        session = {
            key,
            salt: encrypted.salt,
            iterations: encrypted.iterations,
            generation: (session?.generation ?? 0) + 1,
        }
        const values = await openWithSession(encrypted)
        if (values === undefined) {
            session = null
            return false
        }

        return true
    } catch {
        session = null
        return false
    }
}

export async function openEncryptedSecrets(encrypted: EncryptedSecrets) {
    if (!isEncryptedSecrets(encrypted) || session === null) {
        return undefined
    }

    try {
        return await openWithSession(encrypted)
    } catch {
        return undefined
    }
}

export function revealedSecretValues(secrets: unknown): Record<string, unknown> | undefined {
    if (secrets === null || secrets === undefined || typeof secrets !== 'object' || Array.isArray(secrets)) {
        return undefined
    }

    if (!isEncryptedSecrets(secrets)) {
        return secrets as Record<string, unknown>
    }

    const opened = openedSecrets.get(secretsRecord(secrets))
    if (session === null || opened === undefined || opened.generation !== session.generation) {
        return undefined
    }

    return opened.values
}

export async function sealSecretValues(plaintext: Record<string, unknown>) {
    if (session === null) {
        return plaintext
    }

    const values: Record<string, SecretCiphertext> = {}
    for (const [name, value] of Object.entries(plaintext)) {
        if (value === undefined) {
            continue
        }

        values[name] = await encryptBytes(session.key, new TextEncoder().encode(JSON.stringify(value)), name)
    }

    const encrypted: EncryptedSecrets = {
        restfoxEncryptedSecrets: 1,
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations: session.iterations,
        salt: session.salt,
        verifier: await encryptBytes(session.key, new TextEncoder().encode(VERIFIER_TEXT), VERIFIER_AAD),
        values,
    }

    remember(encrypted, plaintext)
    return encrypted
}

export function copySecretValues(values: Record<string, unknown>) {
    return JSON.parse(JSON.stringify(values)) as Record<string, unknown>
}

// Incoming keys are merged into the open values. A locked bag is left untouched.
export async function mergedSecretValues(existing: unknown, incoming: Record<string, unknown>): Promise<Record<string, unknown> | 'locked'> {
    if (isEncryptedSecrets(existing)) {
        const plain = revealedSecretValues(existing)
        if (plain === undefined) {
            return 'locked'
        }

        return sealSecretValues({ ...plain, ...incoming })
    }

    const base = existing !== null && typeof existing === 'object' && !Array.isArray(existing)
        ? existing as Record<string, unknown>
        : {}
    return sealSecretValues({ ...base, ...incoming })
}
