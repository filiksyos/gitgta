import { cityMetadata } from '@/lib/city-metadata'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GameCanvas } from '@/components/GameCanvas'
import {
  isValidGitHubProfileLogin,
  parseGitHubRepoSegment,
} from '@/lib/parse-github-profile'

type PageProps = {
  params: Promise<{ owner: string; repo: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { owner: ownerRaw, repo: repoRaw } = await params
  const owner = decodeURIComponent(ownerRaw)
  const repo = decodeURIComponent(repoRaw)
  return cityMetadata(owner, repo)
}

export default async function OwnerRepoPage({ params }: PageProps) {
  const { owner: ownerRaw, repo: repoRaw } = await params
  const owner = decodeURIComponent(ownerRaw)
  const repo = parseGitHubRepoSegment(repoRaw)
  if (!isValidGitHubProfileLogin(owner) || !repo) notFound()
  return <GameCanvas owner={owner} repo={repo} />
}
