import { describe, expect, test } from 'vitest'
import { REPO_CONSTANTS, getRepoDir } from '@/utils/git-local'

describe('git-local constants', () => {
    test('repo layout matches Restfox file workspace conventions', () => {
        expect(REPO_CONSTANTS.WORKSPACE_CONFIG).toBe('restfox.json')
        expect(REPO_CONSTANTS.GITIGNORE_CONTENT).toContain('*.secrets.json')
        expect(REPO_CONSTANTS.GITIGNORE_CONTENT).toContain('*.responses.json')
        expect(getRepoDir()).toBe('/repo')
    })
})
