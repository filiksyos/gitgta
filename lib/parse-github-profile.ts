const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const GITHUB_REPO = /^[A-Za-z0-9._-]+$/

export type GitHubProfileInput = {
  login: string
}

export type GitHubRepoInput = {
  owner: string
  repo: string
}

export function parseGitHubProfileInput(raw: string): GitHubProfileInput | null {
  const value = raw.trim()
  if (!value) return null

  const normalizedAt = value.startsWith('@') ? value.slice(1) : value

  try {
    const url =
      normalizedAt.includes('://') ||
      normalizedAt.startsWith('github.com') ||
      normalizedAt.startsWith('www.github.com')
        ? new URL(
            normalizedAt.startsWith('http')
              ? normalizedAt
              : `https://${normalizedAt}`
          )
        : null

    if (url) {
      const host = url.hostname.replace(/^www\./, '')
      if (host === 'github.com' || host === 'gitgta.com') {
        const parts = url.pathname.split('/').filter(Boolean)
        if (parts.length < 1) return null
        const login = normalizeProfileSegment(parts[0] ?? '')
        return isValidGitHubProfileLogin(login) ? { login } : null
      }
    }
  } catch {
    // Fall through to plain @username / username parsing.
  }

  const slash = normalizedAt.indexOf('/')
  if (slash > 0) {
    const login = normalizeProfileSegment(normalizedAt.slice(0, slash))
    return isValidGitHubProfileLogin(login) ? { login } : null
  }

  if (normalizedAt.includes(' ')) {
    return null
  }

  const login = normalizeProfileSegment(normalizedAt)
  return isValidGitHubProfileLogin(login) ? { login } : null
}

export function parseGitHubRepoSegment(raw: string): string | null {
  const value = decodeURIComponent(raw).trim()
  if (!value || value.includes('..') || !GITHUB_REPO.test(value)) return null
  return value
}

export function parseGitHubOwnerRepoInput(raw: string): GitHubRepoInput | null {
  const profile = parseGitHubProfileInput(raw)
  if (!profile) return null

  try {
    const value = raw.trim()
    const url =
      value.includes('://') || value.startsWith('github.com')
        ? new URL(value.startsWith('http') ? value : `https://${value}`)
        : null
    if (url) {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        const repo = parseGitHubRepoSegment(parts[1] ?? '')
        if (repo) return { owner: profile.login, repo }
      }
    }
  } catch {
    // ignore
  }

  const parts = raw.trim().replace(/^@/, '').split('/').filter(Boolean)
  if (parts.length >= 2) {
    const repo = parseGitHubRepoSegment(parts[1] ?? '')
    if (repo) return { owner: profile.login, repo }
  }

  return null
}

export function normalizeProfileSegment(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\/+$/, '')
}

export function isValidGitHubProfileLogin(login: string): boolean {
  const value = normalizeProfileSegment(login)
  if (!value || value.includes('..')) return false
  return GITHUB_LOGIN.test(value)
}
