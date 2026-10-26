import { describe, expect, test } from 'vitest'
import { isGitHubWorkspace } from '@/utils/github-workspace'
import type { Workspace } from '@/global'

describe('isGitHubWorkspace', () => {
    test('detects _type github', () => {
        expect(isGitHubWorkspace({ _type: 'github' } as Workspace)).toBe(true)
    })

    test('detects githubSlug', () => {
        expect(isGitHubWorkspace({ githubSlug: 'my-collection' } as any)).toBe(true)
    })

    test('is false for local and file workspaces', () => {
        expect(isGitHubWorkspace({ _type: 'file' } as Workspace)).toBe(false)
        expect(isGitHubWorkspace({} as Workspace)).toBe(false)
        expect(isGitHubWorkspace(null)).toBe(false)
    })
})
