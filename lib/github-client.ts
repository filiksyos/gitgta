import type { CityPayload, CityRepo, ContributionDay } from '@/lib/city-from-github'

const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql'

export class GitHubNotFoundError extends Error {
  constructor(login: string) {
    super(`GitHub profile "${login}" was not found.`)
    this.name = 'GitHubNotFoundError'
  }
}

type RepoNode = {
  name?: string
  nameWithOwner?: string
  description?: string | null
  url?: string
  stargazerCount?: number
  forkCount?: number
  primaryLanguage?: { name?: string } | null
}

type ContributionDayNode = {
  date?: string
  contributionCount?: number
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN?.trim()
  if (!token) {
    throw new Error('GITHUB_TOKEN is required to generate a GitGTA city.')
  }

  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'gitgta/0.1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function fetchGitHubGraphQl<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(GITHUB_GRAPHQL_API, {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  })

  const raw = (await response.json().catch(() => ({}))) as {
    data?: T
    errors?: Array<{ message?: string }>
  }

  if (!response.ok) {
    const message =
      raw.errors?.map((error) => error.message).filter(Boolean).join('; ') ||
      `GitHub GraphQL request failed with status ${response.status}.`
    throw new Error(message)
  }

  if (Array.isArray(raw.errors) && raw.errors.length > 0) {
    const message = raw.errors
      .map((error) => error.message)
      .filter(Boolean)
      .join('; ')
    throw new Error(message || 'GitHub GraphQL returned an error.')
  }

  if (!raw.data) {
    throw new Error('GitHub GraphQL returned no data.')
  }

  return raw.data
}

function isMissingUserError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('could not resolve to a user') ||
    lower.includes('could not resolve to user')
  )
}

function normalizeRepo(node: RepoNode | null | undefined, commitCount = 0): CityRepo | null {
  if (!node?.name || !node.nameWithOwner || !node.url) return null
  return {
    name: node.name,
    nameWithOwner: node.nameWithOwner,
    description: node.description?.trim() || null,
    url: node.url,
    stargazerCount: node.stargazerCount ?? 0,
    forkCount: node.forkCount ?? 0,
    primaryLanguage: node.primaryLanguage?.name?.trim() || null,
    commitCount,
  }
}

function uniqueRepos(repos: CityRepo[]): CityRepo[] {
  const seen = new Set<string>()
  const out: CityRepo[] = []
  for (const repo of repos) {
    const key = repo.nameWithOwner.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(repo)
  }
  return out
}

function flattenCalendar(
  weeks: Array<{ contributionDays?: ContributionDayNode[] | null } | null> | null | undefined
): ContributionDay[] {
  const days: ContributionDay[] = []
  for (const week of weeks ?? []) {
    for (const day of week?.contributionDays ?? []) {
      if (!day?.date) continue
      days.push({ date: day.date, count: day.contributionCount ?? 0 })
    }
  }
  return days
}

const REPO_FIELDS = `
  name
  nameWithOwner
  description
  url
  stargazerCount
  forkCount
  primaryLanguage { name }
`

export async function getGitHubCity(login: string): Promise<CityPayload> {
  const to = new Date()
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000)

  const userQuery = `
    query GitGtaUserCity($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        login
        name
        bio
        url
        avatarUrl
        followers { totalCount }
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
          commitContributionsByRepository(maxRepositories: 25) {
            contributions { totalCount }
            repository { ${REPO_FIELDS} }
          }
        }
        repositories(
          first: 12
          ownerAffiliations: OWNER
          privacy: PUBLIC
          isFork: false
          orderBy: { field: STARGAZERS, direction: DESC }
        ) {
          nodes { ${REPO_FIELDS} }
        }
      }
    }
  `

  try {
    const userData = await fetchGitHubGraphQl<{
      user?: {
        login?: string
        name?: string | null
        bio?: string | null
        url?: string
        avatarUrl?: string
        followers?: { totalCount?: number } | null
        contributionsCollection?: {
          contributionCalendar?: {
            totalContributions?: number
            weeks?: Array<{ contributionDays?: ContributionDayNode[] | null } | null> | null
          } | null
          commitContributionsByRepository?: Array<{
            contributions?: { totalCount?: number } | null
            repository?: RepoNode | null
          } | null> | null
        } | null
        repositories?: { nodes?: RepoNode[] | null } | null
      } | null
    }>(userQuery, {
      login,
      from: from.toISOString(),
      to: to.toISOString(),
    })

    const user = userData.user
    if (user?.login && user.url && user.avatarUrl) {
      const contribRepos = uniqueRepos(
        (user.contributionsCollection?.commitContributionsByRepository ?? [])
          .map((entry) =>
            normalizeRepo(entry?.repository, entry?.contributions?.totalCount ?? 0)
          )
          .filter((repo): repo is CityRepo => Boolean(repo))
      )
      const starRepos = uniqueRepos(
        (user.repositories?.nodes ?? [])
          .map((node) => normalizeRepo(node, 0))
          .filter((repo): repo is CityRepo => Boolean(repo))
      )
      const byName = new Map<string, CityRepo>()
      for (const repo of starRepos) byName.set(repo.nameWithOwner.toLowerCase(), repo)
      for (const repo of contribRepos) {
        const prev = byName.get(repo.nameWithOwner.toLowerCase())
        byName.set(repo.nameWithOwner.toLowerCase(), {
          ...repo,
          stargazerCount: Math.max(repo.stargazerCount, prev?.stargazerCount ?? 0),
          forkCount: Math.max(repo.forkCount, prev?.forkCount ?? 0),
          primaryLanguage: repo.primaryLanguage ?? prev?.primaryLanguage ?? null,
        })
      }
      const repos = [...byName.values()].sort((a, b) => {
        const score = (b.commitCount + b.stargazerCount) - (a.commitCount + a.stargazerCount)
        return score
      })

      return {
        login: user.login,
        displayName: user.name?.trim() || user.login,
        bio: user.bio?.trim() || null,
        avatarUrl: user.avatarUrl,
        profileUrl: user.url,
        followerCount: user.followers?.totalCount ?? null,
        isOrg: false,
        totalContributions: user.contributionsCollection?.contributionCalendar?.totalContributions ?? 0,
        days: flattenCalendar(user.contributionsCollection?.contributionCalendar?.weeks),
        repos,
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isMissingUserError(message)) throw error
  }

  const orgQuery = `
    query GitGtaOrgCity($login: String!) {
      organization(login: $login) {
        login
        name
        description
        url
        avatarUrl
        repositories(
          first: 24
          privacy: PUBLIC
          isFork: false
          orderBy: { field: STARGAZERS, direction: DESC }
        ) {
          nodes { ${REPO_FIELDS} }
        }
      }
    }
  `

  try {
    const orgData = await fetchGitHubGraphQl<{
      organization?: {
        login?: string
        name?: string | null
        description?: string | null
        url?: string
        avatarUrl?: string
        repositories?: { nodes?: RepoNode[] | null } | null
      } | null
    }>(orgQuery, { login })

    const org = orgData.organization
    if (!org?.login || !org.url || !org.avatarUrl) {
      throw new GitHubNotFoundError(login)
    }

    const repos = uniqueRepos(
      (org.repositories?.nodes ?? [])
        .map((node) =>
          normalizeRepo(node, (node?.stargazerCount ?? 0) + (node?.forkCount ?? 0) * 2)
        )
        .filter((repo): repo is CityRepo => Boolean(repo))
    )

    return {
      login: org.login,
      displayName: org.name?.trim() || org.login,
      bio: org.description?.trim() || null,
      avatarUrl: org.avatarUrl,
      profileUrl: org.url,
      followerCount: null,
      isOrg: true,
      totalContributions: repos.reduce((sum, repo) => sum + repo.commitCount, 0),
      days: [],
      repos,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.toLowerCase().includes('read:org') ||
      message.toLowerCase().includes('granted the required scopes')
    ) {
      throw new Error(
        'This token can read user profiles, but organization profiles need the GitHub `read:org` scope.'
      )
    }
    if (error instanceof GitHubNotFoundError) throw error
    if (isMissingUserError(message) || message.toLowerCase().includes('could not resolve')) {
      throw new GitHubNotFoundError(login)
    }
    throw error
  }
}
