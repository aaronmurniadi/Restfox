<template>
    <div class="github-login-gate">
        <div class="panel">
            <img src="/pwa-192x192.png" width="64" height="64" alt="Restfox" />
            <h1>Restfox</h1>
            <p class="lede">
                Sign in with GitHub to use Restfox. Your collections live in a
                private GitHub repository, with a local browser cache you sync
                when you choose.
            </p>
            <p v-if="error" class="error">{{ error }}</p>
            <p v-if="status" class="status">{{ status }}</p>
            <button
                class="button primary"
                type="button"
                :disabled="busy"
                @click="signIn"
            >
                {{ busy ? 'Working…' : 'Sign in with GitHub' }}
            </button>
        </div>
    </div>
</template>

<script>
import { getGitHubLoginUrl } from '@/utils/github-auth'

export default {
    props: {
        error: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            default: '',
        },
        busy: {
            type: Boolean,
            default: false,
        },
    },
    methods: {
        signIn() {
            window.location.href = getGitHubLoginUrl()
        },
    },
}
</script>

<style scoped>
.github-login-gate {
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-color, #f6f7f9);
    padding: 2rem;
}
.panel {
    max-width: 28rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
}
h1 {
    margin: 0;
    font-size: 1.75rem;
}
.lede {
    margin: 0;
    line-height: 1.45;
    opacity: 0.85;
}
.error {
    color: var(--base-color-error, #c0392b);
    margin: 0;
}
.status {
    margin: 0;
    opacity: 0.75;
    font-size: 0.9rem;
}
.button.primary {
    margin-top: 0.5rem;
    padding: 0.6rem 1.2rem;
    font-size: 1rem;
}
</style>
