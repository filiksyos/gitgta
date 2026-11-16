'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { parseGitHubOwnerRepoInput, parseGitHubProfileInput } from '@/lib/parse-github-profile'

export function Landing() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) inputRef.current?.focus()
  }, [])
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
    <main className="vice-landing" aria-labelledby="hero-title">
      <Image src="/art/vice-hero.webp" alt="" fill priority sizes="100vw" className="hero-art" />
      <div className="hero-shade" />
      <div className="hero-content">
        <h1 id="hero-title">GTA VI <span>For Devs</span></h1>
        <p className="hero-description">Your contribution graph turned into a city.</p>
        <form className="city-form" onSubmit={(event) => { event.preventDefault(); go() }} noValidate>
          <label htmlFor="github-profile" className="sr-only">GitHub username or URL</label>
          <div className="city-input-row">
            <span className="input-prefix" aria-hidden="true">@</span>
            <input ref={inputRef} enterKeyHint="go" id="github-profile" autoCapitalize="none" autoCorrect="off" spellCheck={false} name="owner" value={value} onChange={(event) => { setValue(event.target.value); setError('') }} placeholder="GitHub username or URL" aria-invalid={!!error} aria-describedby={error ? 'city-error' : undefined} />
            <button type="submit">Enter <span aria-hidden="true">↗</span></button>
          </div>
          {error ? <p id="city-error" className="form-error" role="alert">{error}</p> : null}
        </form>
        <p className="city-examples">Try <Link href="/torvalds">torvalds</Link><span> · </span><Link href="/sindresorhus">sindresorhus</Link><span> · </span><button type="button" onClick={() => inputRef.current?.focus()}>or your own</button></p>
      </div>
    </main>
  )
}
