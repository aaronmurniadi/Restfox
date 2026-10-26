import 'dotenv/config'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import cookieSession from 'cookie-session'
import {
    exchangeCodeForToken,
    githubAuthorizeUrl,
    getAuthenticatedUser,
    ensurePrivateRestfoxRepo,
} from './github.js'

const PORT = Number(process.env.PORT || 4010)
const UI_ORIGIN = process.env.UI_ORIGIN || 'http://localhost:5173'
const CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ''
const CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || `http://localhost:${PORT}/auth/github/callback`
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-me'

function requireConfig(res) {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        res.status(500).json({ error: 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set' })
        return false
    }
    return true
}

const app = express()
app.set('trust proxy', 1)

app.use(cors({
    origin: UI_ORIGIN,
    credentials: true,
}))
app.use(express.json())
app.use(cookieSession({
    name: 'restfox_session',
    keys: [SESSION_SECRET],
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
}))

app.get('/health', (_req, res) => {
    res.json({ ok: true })
})

app.get('/auth/github', (req, res) => {
    if (!requireConfig(res)) {
        return
    }
    const state = crypto.randomBytes(16).toString('hex')
    req.session.oauthState = state
    res.redirect(githubAuthorizeUrl({
        clientId: CLIENT_ID,
        redirectUri: CALLBACK_URL,
        state,
    }))
})

app.get('/auth/github/callback', async(req, res) => {
    try {
        if (!requireConfig(res)) {
            return
        }
        const { code, state } = req.query
        if (!code || typeof code !== 'string') {
            res.status(400).send('Missing code')
            return
        }
        if (!state || state !== req.session.oauthState) {
            res.status(400).send('Invalid OAuth state')
            return
        }
        delete req.session.oauthState

        const token = await exchangeCodeForToken({
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            code,
            redirectUri: CALLBACK_URL,
        })
        const user = await getAuthenticatedUser(token)
        const repo = await ensurePrivateRestfoxRepo(token, user.login)

        req.session.user = {
            id: user.id,
            login: user.login,
            name: user.name,
            avatarUrl: user.avatar_url,
        }
        req.session.repo = repo
        req.session.accessToken = token

        res.redirect(`${UI_ORIGIN}/?github=connected`)
    } catch (error) {
        console.error('OAuth callback failed:', error)
        res.redirect(`${UI_ORIGIN}/?github=error&message=${encodeURIComponent(error.message)}`)
    }
})

app.get('/auth/me', (req, res) => {
    if (!req.session?.user || !req.session?.accessToken || !req.session?.repo) {
        res.status(401).json({ authenticated: false })
        return
    }
    res.json({
        authenticated: true,
        user: req.session.user,
        repo: req.session.repo,
        accessToken: req.session.accessToken,
    })
})

app.post('/auth/logout', (req, res) => {
    req.session = null
    res.json({ ok: true })
})

app.listen(PORT, () => {
    console.log(`Restfox API listening on http://localhost:${PORT}`)
})
