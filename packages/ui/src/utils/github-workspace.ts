import type { Workspace } from '@/global'

export function isGitHubWorkspace(workspace: Workspace | null | undefined) {
    return workspace?._type === 'github' || Boolean((workspace as any)?.githubSlug)
}
