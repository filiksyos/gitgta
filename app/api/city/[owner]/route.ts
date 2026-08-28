import { NextResponse } from 'next/server'
import { GitHubNotFoundError, getGitHubCity } from '@/lib/github-client'
import { isValidGitHubProfileLogin } from '@/lib/parse-github-profile'

export const revalidate = 3600

type RouteContext = {
  params: Promise<{ owner: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { owner: ownerRaw } = await context.params
  const owner = decodeURIComponent(ownerRaw)

  if (!isValidGitHubProfileLogin(owner)) {
    return NextResponse.json({ error: 'Invalid GitHub login.' }, { status: 400 })
  }

  try {
    const city = await getGitHubCity(owner)
    return NextResponse.json(city)
  } catch (error) {
    if (error instanceof GitHubNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    const message = error instanceof Error ? error.message : 'Failed to load GitHub city.'
    const status = message.includes('GITHUB_TOKEN') ? 500 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
