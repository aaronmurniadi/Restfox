import sharedConstants from '../../shared/constants.js'

const GITHUB_API = 'https://api.github.com'
const GITHUB_AUTH = 'https://github.com/login/oauth'

export function githubAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'repo',
        state,
    })
    return `${GITHUB_AUTH}/authorize?${params}`
}

export async function exchangeCodeForToken({ clientId, clientSecret, code, redirectUri }) {
    const response = await fetch(`${GITHUB_AUTH}/access_token`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
        }),
    })
    const body = await response.json()
    if (!response.ok || body.error || !body.access_token) {
        throw new Error(body.error_description || body.error || 'GitHub token exchange failed')
    }
    return body.access_token
}

async function githubFetch(token, path, options = {}) {
    const response = await fetch(`${GITHUB_API}${path}`, {
        ...options,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    })
    const text = await response.text()
    const body = text ? JSON.parse(text) : null
    if (!response.ok) {
        const message = body?.message || `${response.status} ${response.statusText}`
        const error = new Error(message)
        error.status = response.status
        error.body = body
        throw error
    }
    return body
}

export async function getAuthenticatedUser(token) {
    return githubFetch(token, '/user')
}

export async function getRepo(token, owner, name) {
    try {
        return await githubFetch(token, `/repos/${owner}/${name}`)
    } catch (error) {
        if (error.status === 404) {
            return null
        }
        throw error
    }
}

async function createRepo(token, name) {
    return githubFetch(token, '/user/repos', {
        method: 'POST',
        body: JSON.stringify({
            name,
            private: true,
            description: 'Restfox collections (managed by Restfox)',
            auto_init: false,
            has_issues: false,
            has_projects: false,
            has_wiki: false,
        }),
    })
}

function utf8ToBase64(text) {
    return Buffer.from(text, 'utf8').toString('base64')
}

async function putFile(token, owner, repo, path, content, message) {
    return githubFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify({
            message,
            content: utf8ToBase64(content),
        }),
    })
}

const DEFAULT_GITIGNORE = sharedConstants.GITIGNORE_CONTENT
const REPO_MANIFEST = JSON.stringify({ version: 1, app: 'restfox' }, null, 4) + '\n'
const DEFAULT_WORKSPACE = JSON.stringify({
    version: 1,
    name: 'My Collection',
    currentEnvironment: sharedConstants.DEFAULT_ENVIRONMENT,
    environments: [{ name: sharedConstants.DEFAULT_ENVIRONMENT, environment: {} }],
}, null, 4) + '\n'

export async function ensurePrivateRestfoxRepo(token, login) {
    const preferredNames = ['restfox', `restfox-${login}`.toLowerCase().replace(/[^a-z0-9-_]/g, '-')]

    for (const name of preferredNames) {
        const existing = await getRepo(token, login, name)
        if (existing) {
            if (!existing.private) {
                throw new Error(`Repository ${existing.full_name} exists but is not private`)
            }
            if (existing.owner?.login !== login) {
                throw new Error(`Repository ${existing.full_name} is not owned by you`)
            }
            return {
                fullName: existing.full_name,
                owner: existing.owner.login,
                name: existing.name,
                cloneUrl: existing.clone_url,
                htmlUrl: existing.html_url,
                created: false,
            }
        }
    }

    let created = null
    let lastError = null
    for (const name of preferredNames) {
        try {
            created = await createRepo(token, name)
            break
        } catch (error) {
            lastError = error
            if (error.status !== 422) {
                throw error
            }
        }
    }
    if (!created) {
        throw lastError || new Error('Could not create a private Restfox repository')
    }

    const owner = created.owner.login
    const repo = created.name

    await putFile(token, owner, repo, 'restfox-repo.json', REPO_MANIFEST, 'Initialize Restfox repository')
    await putFile(token, owner, repo, '.gitignore', DEFAULT_GITIGNORE, 'Add Restfox gitignore')
    await putFile(token, owner, repo, 'workspaces/my-collection/restfox.json', DEFAULT_WORKSPACE, 'Add default workspace')

    return {
        fullName: created.full_name,
        owner,
        name: repo,
        cloneUrl: created.clone_url,
        htmlUrl: created.html_url,
        created: true,
    }
}
