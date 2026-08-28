'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  parseGitHubOwnerRepoInput,
  parseGitHubProfileInput,
} from '@/lib/parse-github-profile'

export function Landing() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const go = () => {
    const repo = parseGitHubOwnerRepoInput(value)
    if (repo) {
      setError('')
      router.push(`/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`)
      return
    }
    const profile = parseGitHubProfileInput(value)
    if (!profile) {
      setError('Enter a GitHub username or paste a github.com URL.')
      return
    }
    setError('')
    router.push(`/${encodeURIComponent(profile.login)}`)
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#120c14] px-6 py-16 text-[#f6ead2]">
      <div className="w-full max-w-xl border-[3px] border-[#f0c14a] bg-[#14100ce8] px-8 py-10 text-center shadow-[8px_8px_0_#0008]">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#f0c14a]">
          Replace hub with gta
        </p>
        <h1 className="mt-2 text-5xl font-black uppercase tracking-[0.12em] sm:text-6xl">
          GitGTA
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#ddd4c6]">
          Any GitHub profile becomes a city you can drive. Commits raise the
          skyline. Paste a username, or swap <span className="text-[#f0c14a]">hub</span> for{' '}
          <span className="text-[#f0c14a]">gta</span> in any GitHub URL.
        </p>
        <form
          className="mt-8 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            go()
          }}
        >
          <input
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            name="owner"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="gaearon  ·  github.com/torvalds"
            className="min-h-12 flex-1 border-2 border-[#f0c14a] bg-[#0a0808] px-4 text-[#f6ead2] outline-none placeholder:text-[#8a7a6a]"
          />
          <button
            type="submit"
            className="min-h-12 cursor-pointer border-2 border-[#111] bg-[#e23b2e] px-6 text-sm font-extrabold uppercase tracking-[0.12em] text-white hover:bg-[#ff4d3d]"
          >
            Enter city
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-[#ff6b5a]">{error}</p> : null}
        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-[#8a7a6a]">
          github.com/you → gitgta.com/you
        </p>
      </div>
    </main>
  )
}
