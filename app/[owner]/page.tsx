import { cityMetadata } from '@/lib/city-metadata'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GameCanvas } from '@/components/GameCanvas'
import { isValidGitHubProfileLogin } from '@/lib/parse-github-profile'

type PageProps = {
  params: Promise<{ owner: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { owner: ownerRaw } = await params
  const owner = decodeURIComponent(ownerRaw)
  return cityMetadata(owner)
}

export default async function OwnerPage({ params }: PageProps) {
  const { owner: ownerRaw } = await params
  const owner = decodeURIComponent(ownerRaw)
  if (!isValidGitHubProfileLogin(owner)) notFound()
  return <GameCanvas owner={owner} />
}
