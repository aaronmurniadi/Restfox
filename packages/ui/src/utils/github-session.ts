import { fetchSession, logoutSession, type GitHubSession, type AuthState } from '@/utils/github-auth'
import { cloneOrFetchRepo, getSyncStatus, commitAndPush, pullFromRemote, wipeLocalRepo, type SyncStatus } from '@/utils/git-local'
import { exportWorkspacesToLocalRepo, importWorkspacesFromLocalRepo } from '@/utils/github-sync'
import constants from '@/constants'

let currentSession: GitHubSession | null = null
let syncTimer: ReturnType<typeof setInterval> | null = null

export function getCurrentGitHubSession() {
    return currentSession
}

export function isGitHubAuthenticated() {
    return currentSession !== null
}

export async function initGitHubSession(onProgress?: (message: string) => void): Promise<AuthState> {
    const state = await fetchSession()
    if (!state.authenticated) {
        currentSession = null
        stopPeriodicSync()
        return state
    }

    currentSession = state
    onProgress?.('Preparing local repository cache…')
    await cloneOrFetchRepo({
        cloneUrl: state.repo.cloneUrl,
        token: state.accessToken,
        onProgress: phase => onProgress?.(phase),
    })
    onProgress?.('Loading workspaces…')
    await importWorkspacesFromLocalRepo()
    startPeriodicSyncFromSettings()
    return state
}

export async function logoutGitHub(options: { wipeLocal?: boolean } = {}) {
    stopPeriodicSync()
    await logoutSession()
    currentSession = null
    if (options.wipeLocal) {
        await wipeLocalRepo()
    }
}

export async function refreshSyncStatus(): Promise<SyncStatus> {
    if (currentSession) {
        // Mirror Dexie into the local git FS so dirty/ahead reflect unsynced edits
        await exportWorkspacesToLocalRepo()
    }
    return getSyncStatus()
}

export async function syncToGitHub(message?: string) {
    if (!currentSession) {
        throw new Error('Not signed in')
    }
    await exportWorkspacesToLocalRepo()
    await commitAndPush({
        token: currentSession.accessToken,
        message: message || `Sync from Restfox ${new Date().toISOString()}`,
        name: currentSession.user.name || currentSession.user.login,
        email: `${currentSession.user.login}@users.noreply.github.com`,
    })
}

export async function pullFromGitHub() {
    if (!currentSession) {
        throw new Error('Not signed in')
    }
    await pullFromRemote(currentSession.accessToken)
    await importWorkspacesFromLocalRepo()
}

export function getSyncIntervalMinutes() {
    const raw = localStorage.getItem(constants.LOCAL_STORAGE_KEY.GITHUB_SYNC_INTERVAL_MINUTES)
    if (raw === null || raw === '') {
        return 0
    }
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : 0
}

export function setSyncIntervalMinutes(minutes: number) {
    localStorage.setItem(constants.LOCAL_STORAGE_KEY.GITHUB_SYNC_INTERVAL_MINUTES, String(Math.max(0, Math.floor(minutes))))
    startPeriodicSyncFromSettings()
}

export function startPeriodicSyncFromSettings() {
    stopPeriodicSync()
    const minutes = getSyncIntervalMinutes()
    if (!currentSession || minutes <= 0) {
        return
    }
    syncTimer = setInterval(async() => {
        try {
            const status = await getSyncStatus()
            if (status.dirty || status.ahead > 0) {
                await syncToGitHub()
            }
        } catch (error) {
            console.error('Periodic GitHub sync failed:', error)
        }
    }, minutes * 60 * 1000)
}

export function stopPeriodicSync() {
    if (syncTimer) {
        clearInterval(syncTimer)
        syncTimer = null
    }
}
