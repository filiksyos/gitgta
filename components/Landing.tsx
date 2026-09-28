'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  parseGitHubOwnerRepoInput,
  parseGitHubProfileInput,
} from '@/lib/parse-github-profile'

export function Landing() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (!coarse) inputRef.current?.focus()
  }, [])

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
    <main className="flex min-h-dvh flex-col items-center justify-center overflow-x-clip bg-[#120c14] pt-[max(2rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] text-[#f6ead2] sm:px-6 sm:py-16">
      <div className="w-full max-w-xl border-[3px] border-[#f0c14a] bg-[#14100ce8] px-4 py-7 text-center shadow-[6px_6px_0_#0008] sm:px-8 sm:py-10 sm:shadow-[8px_8px_0_#0008]">
        <p className="text-[11px] font-bold uppercase leading-relaxed tracking-[0.16em] text-[#f0c14a] sm:text-xs sm:tracking-[0.28em]">
          Replace hub with gta
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-[0.08em] sm:text-6xl sm:tracking-[0.12em]">
          GitGTA
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#ddd4c6]">
          Any GitHub profile becomes a city you can drive. Commits raise the
          skyline. Paste a username, or swap <span className="text-[#f0c14a]">hub</span> for{' '}
          <span className="text-[#f0c14a]">gta</span> in any GitHub URL.
        </p>
        <form
          className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            go()
          }}
        >
          <input
            ref={inputRef}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            name="owner"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="gaearon  ·  github.com/torvalds"
            className="min-h-12 w-full min-w-0 flex-1 border-2 border-[#f0c14a] bg-[#0a0808] px-3 text-base text-[#f6ead2] outline-none placeholder:text-[#8a7a6a] sm:px-4"
          />
          <button
            type="submit"
            className="min-h-12 cursor-pointer border-2 border-[#111] bg-[#e23b2e] px-6 text-sm font-extrabold uppercase tracking-[0.12em] text-white touch-manipulation hover:bg-[#ff4d3d]"
          >
            Enter city
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-[#ff6b5a]">{error}</p> : null}
        <p className="mt-6 text-[11px] uppercase leading-relaxed tracking-[0.12em] text-[#8a7a6a] sm:text-xs sm:tracking-[0.18em]">
          github.com/you → gitgta.com/you
        </p>
      </div>
    </main>
  )
}
