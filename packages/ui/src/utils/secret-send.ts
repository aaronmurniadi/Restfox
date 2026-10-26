import { emitter } from '@/event-bus'
import { substituteEnvironmentVariables } from '@/helpers'
import type { CollectionItem, Plugin, Workspace } from '@/global'
import { activeSecrets, buildResolvedEnvironment } from '@/utils/environment-secrets'
import {
    isEncryptedSecrets,
    openEncryptedSecrets,
    revealedSecretValues,
    unlockSecretSession,
    type EncryptedSecrets,
} from '@/utils/secret-encryption'

const VARIABLE_REFERENCE = /\{\{\s*(?:_\.)?([^}\s.[\]]+)/g
const SCRIPT_READ = /\b(?:getEnvVar|getEnvironmentVariable)\(\s*['"]([^'"]+)['"]/g

function parentsOf(collection: CollectionItem[], item: CollectionItem) {
    const parents: CollectionItem[] = []
    const seen = new Set<string>()
    let parentId = item.parentId

    while (parentId && !seen.has(parentId)) {
        seen.add(parentId)
        const parent = collection.find(entry => entry._id === parentId)
        if (!parent) {
            break
        }
        parents.push(parent)
        parentId = parent.parentId
    }

    return parents.reverse()
}

function clearLocked(locked: Set<string>, layer: unknown) {
    if (layer === null || typeof layer !== 'object') {
        return
    }

    for (const key of Object.keys(layer)) {
        locked.delete(key)
    }
}

function addLocked(locked: Set<string>, secrets: unknown) {
    if (!isEncryptedSecrets(secrets) || revealedSecretValues(secrets)) {
        return
    }

    for (const key of Object.keys(secrets.values)) {
        locked.add(key)
    }
}

// names still secret after later public values win, and only while their ciphertext is locked
export function lockedSecretKeys(workspace: { _type?: string, environment?: any, environments?: any[], currentEnvironment?: any, globals?: any, globalSecrets?: any, dotEnv?: Record<string, string> }, parents: { environment?: any, environments?: any[], currentEnvironment?: any }[]) {
    const locked = new Set<string>()

    clearLocked(locked, workspace.globals)
    addLocked(locked, workspace.globalSecrets)

    if (workspace._type === 'file' && workspace.dotEnv) {
        for (const key of Object.keys(workspace.dotEnv)) {
            locked.delete(['process', 'env', key].join('.'))
        }
    }

    clearLocked(locked, workspace.environment)
    addLocked(locked, activeSecrets(workspace))

    for (const parent of parents) {
        clearLocked(locked, parent.environment)
        addLocked(locked, activeSecrets(parent))
    }

    return locked
}

function rootsIn(text: string) {
    const roots: string[] = []

    for (const match of text.matchAll(VARIABLE_REFERENCE)) {
        roots.push(match[1])
    }

    for (const match of text.matchAll(SCRIPT_READ)) {
        const root = match[1].split('.')[0].split('[')[0]
        if (root !== '') {
            roots.push(root)
        }
    }

    return roots
}

function pushString(texts: string[], value: unknown) {
    if (typeof value === 'string' && value !== '') {
        texts.push(value)
    }
}

function pushParams(texts: string[], params: { name?: string, value?: string, disabled?: boolean }[] | undefined) {
    for (const param of params ?? []) {
        if (param.disabled) {
            continue
        }
        pushString(texts, param.name)
        pushString(texts, param.value)
    }
}

export function textsUsedByRequest(item: CollectionItem, parents: CollectionItem[], plugins: Plugin[]) {
    const texts: string[] = []
    pushString(texts, item.url)
    pushParams(texts, item.headers)
    pushParams(texts, item.parameters)
    pushParams(texts, item.pathParameters)
    pushString(texts, item.body?.text)
    pushString(texts, item.body?.mimeType)
    pushParams(texts, item.body?.params)
    pushString(texts, item.grpc?.service)
    pushString(texts, item.grpc?.method)

    if (item.authentication) {
        for (const value of Object.values(item.authentication)) {
            pushString(texts, value)
        }
    }

    for (const parent of parents) {
        pushParams(texts, parent.headers)
        if (parent.authentication && parent.authentication.disabled !== true) {
            for (const value of Object.values(parent.authentication)) {
                pushString(texts, value)
            }
        }
    }

    const collectionIds = new Set([item._id, ...parents.map(parent => parent._id)])
    for (const plugin of plugins) {
        if (plugin.enabled === false) {
            continue
        }
        if (plugin.collectionId !== null && !collectionIds.has(plugin.collectionId)) {
            continue
        }
        if (typeof plugin.code === 'string') {
            pushString(texts, plugin.code)
        } else if (plugin.code) {
            pushString(texts, plugin.code.pre_request)
            pushString(texts, plugin.code.post_request)
        }
    }

    return texts
}

// a referenced value can itself reference a secret, so follow those until a locked name shows up
export function usesLockedSecret(texts: string[], environment: Record<string, unknown>, locked: Set<string>) {
    if (locked.size === 0) {
        return false
    }

    const seen = new Set<string>()
    const queue = [...texts]

    while (queue.length > 0) {
        const text = queue.pop()
        if (text === undefined) {
            continue
        }

        for (const root of rootsIn(text)) {
            if (locked.has(root)) {
                return true
            }
            if (seen.has(root)) {
                continue
            }
            seen.add(root)

            const value = environment[root]
            if (typeof value === 'string') {
                queue.push(value)
            } else if (value !== null && typeof value === 'object') {
                queue.push(JSON.stringify(value))
            }
        }
    }

    return false
}

function encryptedBags(workspace: Workspace, collection: CollectionItem[]) {
    const bags: EncryptedSecrets[] = []
    const visit = (secrets: unknown) => {
        if (isEncryptedSecrets(secrets)) {
            bags.push(secrets)
        }
    }

    visit(workspace.globalSecrets)
    for (const environment of workspace.environments ?? []) {
        visit(environment.secrets)
    }
    for (const item of collection) {
        for (const environment of (item.environments ?? []) as { secrets?: unknown }[]) {
            visit(environment.secrets)
        }
    }

    return bags
}

// true when a locked secret could apply to this request. The send can skip asking entirely when this is false,
// without waiting, so a call still shows the moment Send is pressed
export function mayUseLockedSecret(workspace: Workspace, collection: CollectionItem[], item: CollectionItem) {
    return lockedSecretKeys(workspace, parentsOf(collection, item)).size > 0
}

// asks only when this send would read a locked secret. Cancel leaves the secrets locked and the send does not start
export async function unlockSecretsForSend(workspace: Workspace, collection: CollectionItem[], item: CollectionItem, plugins: Plugin[], extraTexts: string[] = [], onUnlocked?: () => void) {
    const parents = parentsOf(collection, item)
    const locked = lockedSecretKeys(workspace, parents)
    if (locked.size === 0) {
        return true
    }

    const environment = await buildResolvedEnvironment(workspace, parents, (layer, text) => substituteEnvironmentVariables(layer, text, { resolvePromptTags: false }))
    const texts = textsUsedByRequest(item, parents, plugins)
    texts.push(...extraTexts.filter(text => text !== ''))
    if (!usesLockedSecret(texts, environment, locked)) {
        return true
    }

    const bags = encryptedBags(workspace, collection)
    const sample = bags.find(bag => !revealedSecretValues(bag) && Object.keys(bag.values).some(key => locked.has(key)))
    if (!sample) {
        return true
    }

    while (true) {
        const password = await window.createPrompt('This request uses an encrypted secret', '', [], { label: 'Password', mask: true })
        if (password === null || password === undefined) {
            return false
        }
        if (password === '') {
            continue
        }

        const unlocked = await unlockSecretSession(password, sample)
        if (!unlocked) {
            emitter.emit('error', 'Wrong password')
            continue
        }

        for (const bag of bags) {
            if (!revealedSecretValues(bag)) {
                await openEncryptedSecrets(bag)
            }
        }

        onUnlocked?.()
        return true
    }
}
