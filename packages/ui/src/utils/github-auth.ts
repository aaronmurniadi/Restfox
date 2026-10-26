export interface GitHubUser {
    id: number
    login: string
    name: string | null
    avatarUrl: string
}

export interface GitHubRepo {
    fullName: string
    owner: string
    name: string
    cloneUrl: string
    htmlUrl: string
    created: boolean
}

export interface GitHubSession {
    authenticated: true
    user: GitHubUser
    repo: GitHubRepo
    accessToken: string
}

export type AuthState = GitHubSession | { authenticated: false }

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4010'

export function getApiBaseUrl() {
    return API_BASE.replace(/\/$/, '')
}

export function getGitHubLoginUrl() {
    return `${getApiBaseUrl()}/auth/github`
}

export async function fetchSession(): Promise<AuthState> {
    try {
        const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
            credentials: 'include',
        })
        if (response.status === 401) {
            return { authenticated: false }
        }
        if (!response.ok) {
            throw new Error(`Session check failed: ${response.status}`)
        }
        return await response.json()
    } catch {
        return { authenticated: false }
    }
}

export async function logoutSession() {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
    })
}
