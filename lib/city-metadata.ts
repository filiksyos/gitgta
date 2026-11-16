import type { Metadata } from 'next'

export function cityMetadata(owner: string, repo?: string): Metadata {
  const path = `/${encodeURIComponent(owner)}${repo ? `/${encodeURIComponent(repo)}` : ''}`
  const url = `https://www.gitgta.com${path}`
  const image = `https://www.gitgta.com/api/share/${encodeURIComponent(owner)}${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`
  const title = `${repo ? `${owner}/${repo}` : owner}'s city — GTA VI For Devs`
  const description = 'Your contribution graph turned into a city. Jump in and play this GitHub city.'
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: 'website', images: [{ url: image, width: 1200, height: 630, alt: `${owner}'s GitGTA city card` }] }, twitter: { card: 'summary_large_image', title, description, images: [image] } }
}
