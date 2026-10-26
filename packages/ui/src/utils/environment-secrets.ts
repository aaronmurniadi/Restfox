import { toRaw } from 'vue'
import { revealedSecretValues } from '@/utils/secret-encryption'

// Secret paths live beside the resolved environment, not inside it, so a script that lists the keys never sees them
// and JSON copies of the environment, such as an export, cannot carry the values away. Vue keeps that object behind
// a proxy once it is on the store, so the path set is keyed by the underlying object
const secretPathsByEnvironment = new WeakMap<object, Set<string>>()

function environmentRecord(environment: object) {
    return toRaw(environment)
}

export function attachSecretPaths(environment: object, secretPaths: Set<string>) {
    const record = environmentRecord(environment)
    if (secretPaths.size > 0) {
        secretPathsByEnvironment.set(record, secretPaths)
    } else {
        secretPathsByEnvironment.delete(record)
    }
}

export function secretPathsOf(environment: object | null | undefined): Set<string> {
    if (environment === null || environment === undefined) {
        return new Set()
    }
    return secretPathsByEnvironment.get(environmentRecord(environment)) ?? new Set()
}

// a secret object makes every path under it secret, the same paths variable substitution walks
export function isSecretPath(objectPath: string, secretPaths: Set<string>) {
    if (secretPaths.has(objectPath)) {
        return true
    }

    for (const secretPath of secretPaths) {
        if (objectPath.startsWith(`${secretPath}.`) || objectPath.startsWith(`${secretPath}[`)) {
            return true
        }
    }

    return false
}

function collectPaths(object: any, paths: string[] = [], parent = ''): string[] {
    if (object === null || typeof object !== 'object') {
        return paths
    }

    const isArray = Array.isArray(object)

    for (const key of Object.keys(object)) {
        const path = parent === '' ? key : isArray ? `${parent}[${key}]` : `${parent}.${key}`
        paths.push(path)
        collectPaths(object[key], paths, path)
    }

    return paths
}

export function secretPathsIn(secrets: any): string[] {
    return collectPaths(revealedSecretValues(secrets))
}

// a later public layer with the same name wins, and the name stops being secret
export function applyPublicLayer(environment: Record<string, any>, layer: Record<string, any> | undefined, secretPaths: Set<string>) {
    if (!layer) {
        return
    }

    for (const key of Object.keys(layer)) {
        for (const secretPath of [...secretPaths]) {
            if (secretPath === key || secretPath.startsWith(`${key}.`) || secretPath.startsWith(`${key}[`)) {
                secretPaths.delete(secretPath)
            }
        }
    }

    Object.assign(environment, layer)
}

export function applySecretLayer(environment: Record<string, any>, secrets: Record<string, any> | undefined, secretPaths: Set<string>) {
    const values = revealedSecretValues(secrets)
    if (!values) {
        return
    }

    for (const path of collectPaths(values)) {
        secretPaths.add(path)
    }

    Object.assign(environment, values)
}

export function activeSecrets(scope: { environments?: { name?: string, secrets?: Record<string, any> }[], currentEnvironment?: any } | null | undefined) {
    if (!scope?.environments) {
        return undefined
    }

    const name = typeof scope.currentEnvironment === 'string' && scope.currentEnvironment !== '' ? scope.currentEnvironment : 'Default'
    return scope.environments.find(environment => environment.name === name)?.secrets
}

// a script that sets a name already kept as a secret updates that secret, so the value stays masked
export function ownsSecretKey(secrets: Record<string, any> | undefined, objectPath: string) {
    const values = revealedSecretValues(secrets)
    if (!values) {
        return false
    }

    if (Object.prototype.hasOwnProperty.call(values, objectPath)) {
        return true
    }

    const topLevelKey = objectPath.split('.')[0].split('[')[0]
    return topLevelKey !== '' && Object.prototype.hasOwnProperty.call(values, topLevelKey)
}

export function environmentsForExport(environments: any[] | undefined) {
    if (!environments) {
        return environments
    }

    return environments.map(environment => {
        const exported = { ...environment }
        delete exported.secrets
        return exported
    })
}

// later layers win: globals, then the workspace environment, then each folder from the root down. A secret is masked
// wherever it still wins. substitute resolves {{ }} inside a layer, including a global used by the environment, and
// leaves prompt tags for the send
export async function buildResolvedEnvironment(
    workspace: { _type?: string, environment?: any, environments?: any[], currentEnvironment?: any, globals?: any, globalSecrets?: any, dotEnv?: Record<string, string> },
    parents: { environment?: any, environments?: any[], currentEnvironment?: any }[],
    substitute: (environment: any, text: string) => Promise<string>,
) {
    const secretPaths = new Set<string>()
    const environment: Record<string, any> = {}

    const resolveLayer = async (layer: any) => {
        if (layer === null || layer === undefined || typeof layer !== 'object') {
            return {}
        }

        const clone = JSON.parse(JSON.stringify(layer))

        if (Object.keys(clone).length === 0) {
            return {}
        }

        return JSON.parse(await substitute({ ...environment, ...clone }, JSON.stringify(clone)))
    }

    applyPublicLayer(environment, await resolveLayer(workspace.globals), secretPaths)
    applySecretLayer(environment, await resolveLayer(revealedSecretValues(workspace.globalSecrets)), secretPaths)

    const dotEnv = workspace.dotEnv
    if (workspace._type === 'file' && dotEnv) {
        Object.keys(dotEnv).forEach(key => {
            // this varName array join trick is needed as vite build changes all strings that match process.env to {}
            const varName = ['process', 'env', key].join('.')
            environment[varName] = dotEnv[key]
        })
    }

    applyPublicLayer(environment, await resolveLayer(workspace.environment), secretPaths)
    applySecretLayer(environment, await resolveLayer(revealedSecretValues(activeSecrets(workspace))), secretPaths)

    for (const parent of parents) {
        applyPublicLayer(environment, await resolveLayer(parent.environment), secretPaths)
        applySecretLayer(environment, await resolveLayer(revealedSecretValues(activeSecrets(parent))), secretPaths)
    }

    attachSecretPaths(environment, secretPaths)
    return environment
}
