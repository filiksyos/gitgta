import { ImageResponse } from 'next/og'
import { getGitHubCity } from '@/lib/github-client'
import { isValidGitHubProfileLogin } from '@/lib/parse-github-profile'

export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(request: Request, { params }: { params: Promise<{ owner: string }> }) {
  const { owner } = await params
  if (!isValidGitHubProfileLogin(owner)) return new Response('Invalid GitHub login', { status: 400 })
  // The card still works during a GitHub outage, without inventing contribution stats.
  const city = await getGitHubCity(owner).catch(() => null)
  const repo = new URL(request.url).searchParams.get('repo')?.slice(0, 100)
  const days = city?.days.slice(-84) ?? []
  const maximum = Math.max(1, ...days.map(day => day.count))
  const bars = Array.from({ length: 42 }, (_, i) => {
    const count = days[i * 2]?.count ?? 0
    return { height: city ? 18 + Math.round(count / maximum * 150) : 30 + ((i * 37 + owner.length * 11) % 140), count }
  })
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '54px 64px', background: 'linear-gradient(135deg, #180f2d, #663066)', color: '#fff1ed', fontFamily: 'sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ffb8dc', fontSize: 20, letterSpacing: 4 }}><span>WELCOME TO VICE CITY</span><span>GITGTA</span></div>
      <div style={{ display: 'flex', marginTop: 28, fontSize: 78, fontWeight: 900, letterSpacing: -4 }}>GTA VI <span style={{ color: '#ffacd4', marginLeft: 20 }}>For Devs</span></div>
      <div style={{ display: 'flex', fontSize: 32, marginTop: 12, color: '#ffe3f3', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 1072 }}>@{owner}{repo ? ` / ${repo}` : ''}</div>
      <div style={{ display: 'flex', position: 'absolute', left: 64, right: 64, bottom: 124, height: 184, alignItems: 'flex-end', gap: 5 }}>
        {bars.map((bar, i) => <div key={i} style={{ display: 'flex', width: 21, height: bar.height, background: i % 3 === 0 ? '#ffa8c6' : i % 3 === 1 ? '#c185eb' : '#e58ccf', borderTop: '3px solid #ffd6ed', boxShadow: '5px 0 0 #261532' }} />)}
      </div>
      <div style={{ display: 'flex', position: 'absolute', left: 64, right: 64, bottom: 45, flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', fontSize: 26 }}>Your contribution graph turned into a city.</div>
        <div style={{ display: 'flex', fontSize: 19, color: '#e0b7db', justifyContent: 'space-between' }}><span>{city ? `${city.totalContributions.toLocaleString('en-US')} contributions · ${city.repos.length} repositories` : 'A GitHub city. A new place to play.'}</span><span>PLAY MY CITY ↗</span></div>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600', ...(new URL(request.url).searchParams.has('download') ? { 'Content-Disposition': `attachment; filename="${owner}-gitgta.png"` } : {}) } },
  )
}
