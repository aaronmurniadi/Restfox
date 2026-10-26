import type { CollectionItem, Plugin, RequestFinalResponse, Workspace } from '@/global'
import {
    ensureRepoScaffold,
    listWorkspaceSlugs,
    listAllWorkspaceDirs,
    readTextFile,
    writeTextFile,
    removeWorkspaceDir,
    REPO_CONSTANTS,
} from '@/utils/git-local'
import {
    getAllWorkspaces,
    putWorkspace,
    getCollectionForWorkspace,
    createCollections,
    deleteCollectionsByWorkspaceId,
    getWorkspacePlugins,
    createPlugins,
    deletePluginsByWorkspace,
    deletePluginsByCollectionIds,
    getAllCollectionIdsForGivenWorkspace,
    deleteResponsesByCollectionIds,
    createResponse,
    getResponsesByCollectionId,
} from '@/db'

function slugify(name: string) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
    return slug || 'workspace'
}

async function uniqueSlug(base: string, used: Set<string>) {
    let slug = base
    let i = 2
    while (used.has(slug)) {
        slug = `${base}-${i}`
        i++
    }
    used.add(slug)
    return slug
}

async function writeWorkspaceToRepo(workspace: Workspace, slug: string) {
    const { collection } = await getCollectionForWorkspace(workspace._id)
    const plugins = await getWorkspacePlugins(workspace._id)

    const restfoxJson = {
        version: 1,
        name: workspace.name,
        environment: workspace.environment,
        environments: workspace.environments,
        currentEnvironment: workspace.currentEnvironment,
        globals: workspace.globals,
        // secrets stay out of committed files; gitignore also covers *.secrets.json
        globalSecrets: undefined,
    }
    await writeTextFile(`workspaces/${slug}/${REPO_CONSTANTS.WORKSPACE_CONFIG}`, JSON.stringify(restfoxJson, null, 4) + '\n')

    // Response history stays local (gitignored); do not push bodies
    void getResponsesByCollectionId

    const bundle = {
        _id: workspace._id,
        collection,
        plugins,
        responses: [] as RequestFinalResponse[],
        meta: {
            tabIds: workspace.tabIds,
            activeTabId: workspace.activeTabId,
            updatedAt: workspace.updatedAt,
            createdAt: workspace.createdAt,
        },
    }
    await writeTextFile(`workspaces/${slug}/restfox-data.json`, JSON.stringify(bundle, null, 2) + '\n')
}

export async function exportWorkspacesToLocalRepo() {
    await ensureRepoScaffold()
    const workspaces = (await getAllWorkspaces()).filter(item => item._type === 'github' || (item as any).githubSlug)
    const used = new Set<string>()

    for (const workspace of workspaces) {
        const base = (workspace as any).githubSlug || slugify(workspace.name)
        const slug = await uniqueSlug(base, used)
            ; (workspace as any).githubSlug = slug
        workspace._type = 'github'
        workspace.location = slug
        await putWorkspace(workspace)
        await writeWorkspaceToRepo(workspace, slug)
    }

    for (const dir of await listAllWorkspaceDirs()) {
        if (!used.has(dir)) {
            await removeWorkspaceDir(dir)
        }
    }
}

export async function persistWorkspaceToLocalRepo(workspace: Workspace) {
    await ensureRepoScaffold()
    const slug = (workspace as any).githubSlug || workspace.location || slugify(workspace.name)
        ; (workspace as any).githubSlug = slug
    workspace._type = 'github'
    workspace.location = slug
    await putWorkspace(workspace)
    await writeWorkspaceToRepo(workspace, slug)
}

export async function removeWorkspaceFromLocalRepo(workspace: Workspace) {
    const slug = (workspace as any).githubSlug || workspace.location
    if (slug) {
        await removeWorkspaceDir(slug)
    }
}

export async function importWorkspacesFromLocalRepo() {
    await ensureRepoScaffold()
    const slugs = await listWorkspaceSlugs()
    const imported: Workspace[] = []

    for (const slug of slugs) {
        let config: any
        try {
            config = JSON.parse(await readTextFile(`workspaces/${slug}/${REPO_CONSTANTS.WORKSPACE_CONFIG}`))
        } catch {
            continue
        }

        let data: any = null
        try {
            data = JSON.parse(await readTextFile(`workspaces/${slug}/restfox-data.json`))
        } catch {
            data = null
        }

        const workspaceId = data?._id || `gh-${slug}`
        const now = Date.now()
        const workspace: Workspace = {
            _id: workspaceId,
            name: config.name || slug,
            environment: config.environment,
            environments: config.environments,
            currentEnvironment: config.currentEnvironment,
            globals: config.globals,
            globalSecrets: config.globalSecrets,
            tabIds: data?.meta?.tabIds,
            activeTabId: data?.meta?.activeTabId,
            _type: 'github',
            location: slug,
            createdAt: data?.meta?.createdAt || now,
            updatedAt: data?.meta?.updatedAt || now,
        }
            ; (workspace as any).githubSlug = slug

        await putWorkspace(workspace)

        if (data?.collection) {
            const collectionIds = await getAllCollectionIdsForGivenWorkspace(workspaceId)
            if (collectionIds.length > 0) {
                await deleteResponsesByCollectionIds(workspaceId, collectionIds)
                await deletePluginsByCollectionIds(workspaceId, collectionIds)
                await deleteCollectionsByWorkspaceId(workspaceId)
            }
            await deletePluginsByWorkspace(workspaceId)

            const collection = (data.collection as CollectionItem[]).map(item => ({
                ...item,
                workspaceId,
            }))
            await createCollections(workspaceId, collection)

            if (data.plugins?.length) {
                await createPlugins(data.plugins.map((plugin: Plugin) => ({
                    ...plugin,
                    workspaceId,
                })), workspaceId)
            }

            if (data.responses?.length) {
                for (const response of data.responses as RequestFinalResponse[]) {
                    await createResponse(workspaceId, response)
                }
            }
        }

        imported.push(workspace)
    }

    return imported
}

export { isGitHubWorkspace } from '@/utils/github-workspace'
