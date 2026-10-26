import LightningFS from '@isomorphic-git/lightning-fs'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'

export const REPO_CONSTANTS = {
    WORKSPACE_CONFIG: 'restfox.json',
    GITIGNORE_CONTENT: '_collapsed\n*.responses.json\n*.messages.json\n.env\n*.secrets.json\n',
}

const REPO_DIR = '/repo'
const FS_NAME = 'restfox-git-repo'

let fsInstance: LightningFS | null = null

function getFs() {
    if (!fsInstance) {
        fsInstance = new LightningFS(FS_NAME)
    }
    return fsInstance
}

function pfs() {
    return getFs().promises
}

export function getRepoDir() {
    return REPO_DIR
}

export function getGitFs() {
    return getFs()
}

async function ensureDir(path: string) {
    const parts = path.split('/').filter(Boolean)
    let current = ''
    for (const part of parts) {
        current += `/${part}`
        try {
            await pfs().mkdir(current)
        } catch (error: any) {
            if (error?.code !== 'EEXIST') {
                throw error
            }
        }
    }
}

async function pathExists(path: string) {
    try {
        await pfs().stat(path)
        return true
    } catch {
        return false
    }
}

function onAuth(token: string) {
    return () => ({
        username: token,
        password: 'x-oauth-basic',
    })
}

export async function hasLocalRepo() {
    return pathExists(`${REPO_DIR}/.git`)
}

export async function cloneOrFetchRepo(options: {
    cloneUrl: string
    token: string
    onProgress?: (phase: string) => void
}) {
    const { cloneUrl, token, onProgress } = options
    await ensureDir(REPO_DIR)

    if (await hasLocalRepo()) {
        onProgress?.('Fetching')
        await git.fetch({
            fs: getFs(),
            http,
            dir: REPO_DIR,
            onAuth: onAuth(token),
            prune: true,
        })
        try {
            await git.checkout({
                fs: getFs(),
                dir: REPO_DIR,
                ref: 'main',
                force: true,
            })
        } catch {
            try {
                await git.checkout({
                    fs: getFs(),
                    dir: REPO_DIR,
                    ref: 'master',
                    force: true,
                })
            } catch {
                // empty or unusual default branch; leave as-is
            }
        }
        return { cloned: false }
    }

    onProgress?.('Cloning')
    // wipe any partial dir
    try {
        const entries = await pfs().readdir(REPO_DIR)
        for (const entry of entries) {
            await removeRecursive(`${REPO_DIR}/${entry}`)
        }
    } catch {
        // empty
    }

    await git.clone({
        fs: getFs(),
        http,
        dir: REPO_DIR,
        url: cloneUrl,
        singleBranch: true,
        depth: 1,
        onAuth: onAuth(token),
    })
    return { cloned: true }
}

async function removeRecursive(path: string) {
    const stat = await pfs().stat(path)
    if (stat.isDirectory()) {
        const entries = await pfs().readdir(path)
        for (const entry of entries) {
            await removeRecursive(`${path}/${entry}`)
        }
        await pfs().rmdir(path)
    } else {
        await pfs().unlink(path)
    }
}

export async function wipeLocalRepo() {
    if (await pathExists(REPO_DIR)) {
        await removeRecursive(REPO_DIR)
    }
    // recreate empty mount point
    await ensureDir(REPO_DIR)
}

export interface SyncStatus {
    dirty: boolean
    ahead: number
    behind: number
    branch: string
    fileCount: number
}

export async function getSyncStatus(): Promise<SyncStatus> {
    if (!(await hasLocalRepo())) {
        return { dirty: false, ahead: 0, behind: 0, branch: 'main', fileCount: 0 }
    }

    let branch = 'main'
    try {
        branch = await git.currentBranch({ fs: getFs(), dir: REPO_DIR, fullname: false }) || 'main'
    } catch {
        // ignore
    }

    const matrix = await git.statusMatrix({ fs: getFs(), dir: REPO_DIR })
    const dirty = matrix.some(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1))
    const fileCount = matrix.filter(([, , workdir]) => workdir === 1).length

    let ahead = 0
    let behind = 0
    try {
        const localOid = await git.resolveRef({ fs: getFs(), dir: REPO_DIR, ref: 'HEAD' })
        const remoteRef = `refs/remotes/origin/${branch}`
        const remoteOid = await git.resolveRef({ fs: getFs(), dir: REPO_DIR, ref: remoteRef })
        if (localOid !== remoteOid) {
            const commits = await git.log({ fs: getFs(), dir: REPO_DIR, ref: 'HEAD', depth: 50 })
            ahead = commits.findIndex(c => c.oid === remoteOid)
            if (ahead < 0) {
                ahead = 1
            }
            const remoteLog = await git.log({ fs: getFs(), dir: REPO_DIR, ref: remoteRef, depth: 50 })
            behind = remoteLog.findIndex(c => c.oid === localOid)
            if (behind < 0) {
                behind = 1
            }
        }
    } catch {
        // no remote tracking yet
    }

    return { dirty, ahead, behind, branch, fileCount }
}

export async function pullFromRemote(token: string) {
    await git.pull({
        fs: getFs(),
        http,
        dir: REPO_DIR,
        onAuth: onAuth(token),
        author: {
            name: 'Restfox',
            email: 'restfox@users.noreply.github.com',
        },
    })
}

export async function commitAndPush(options: {
    token: string
    message?: string
    name?: string
    email?: string
}) {
    const { token, message = 'Sync from Restfox', name = 'Restfox', email = 'restfox@users.noreply.github.com' } = options

    const matrix = await git.statusMatrix({ fs: getFs(), dir: REPO_DIR })
    const dirtyPaths = matrix
        .filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1))
        .map(([filepath]) => filepath)

    if (dirtyPaths.length > 0) {
        for (const filepath of dirtyPaths) {
            const [row] = matrix.filter(([f]) => f === filepath)
            const workdir = row?.[2]
            if (workdir === 0) {
                await git.remove({ fs: getFs(), dir: REPO_DIR, filepath })
            } else {
                await git.add({ fs: getFs(), dir: REPO_DIR, filepath })
            }
        }
        await git.commit({
            fs: getFs(),
            dir: REPO_DIR,
            message,
            author: { name, email },
        })
    }

    await git.push({
        fs: getFs(),
        http,
        dir: REPO_DIR,
        onAuth: onAuth(token),
    })
}

export async function writeTextFile(relativePath: string, content: string) {
    const full = `${REPO_DIR}/${relativePath}`.replace(/\/+/g, '/')
    await ensureDir(full.split('/').slice(0, -1).join('/') || '/')
    await pfs().writeFile(full, content, 'utf8')
}

export async function readTextFile(relativePath: string) {
    const full = `${REPO_DIR}/${relativePath}`.replace(/\/+/g, '/')
    return await pfs().readFile(full, 'utf8') as string
}

export async function listWorkspaceSlugs(): Promise<string[]> {
    const workspacesDir = `${REPO_DIR}/workspaces`
    if (!(await pathExists(workspacesDir))) {
        return []
    }
    const entries = await pfs().readdir(workspacesDir)
    const slugs: string[] = []
    for (const entry of entries) {
        if (await pathExists(`${workspacesDir}/${entry}/${REPO_CONSTANTS.WORKSPACE_CONFIG}`)) {
            slugs.push(entry)
        }
    }
    return slugs.sort()
}

export async function ensureRepoScaffold() {
    await writeTextFile('restfox-repo.json', JSON.stringify({ version: 1, app: 'restfox' }, null, 4) + '\n')
    await writeTextFile('.gitignore', REPO_CONSTANTS.GITIGNORE_CONTENT)
    await ensureDir(`${REPO_DIR}/workspaces`)
}

export async function removeWorkspaceDir(slug: string) {
    const path = `${REPO_DIR}/workspaces/${slug}`
    if (await pathExists(path)) {
        await removeRecursive(path)
    }
}

export async function listAllWorkspaceDirs(): Promise<string[]> {
    const workspacesDir = `${REPO_DIR}/workspaces`
    if (!(await pathExists(workspacesDir))) {
        return []
    }
    return (await pfs().readdir(workspacesDir)).sort()
}
