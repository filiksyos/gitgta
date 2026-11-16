'use client'

import { useRef, useState } from 'react'

export function ShareCity({ owner, repo }: { owner: string; repo?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [opened, setOpened] = useState(false)
  const [status, setStatus] = useState('')
  const path = `/${encodeURIComponent(owner)}${repo ? `/${encodeURIComponent(repo)}` : ''}`
  const url = `https://www.gitgta.com${path}`
  const image = `/api/share/${encodeURIComponent(owner)}${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`
  const text = `My contribution graph turned into a city. Come play ${owner}'s city in GTA VI For Devs!`

  async function copy(value: string, message: string) {
    try { await navigator.clipboard.writeText(value); setStatus(message) }
    catch { setStatus('Copy the city link below to share it.') }
  }

  return <>
    <button className="city-share-trigger" type="button" onClick={() => {
      setStatus('')
      setOpened(true)
      if (document.pointerLockElement) document.exitPointerLock()
      dialog.current?.showModal()
    }}>Share city ↗</button>
    <dialog className="city-share-dialog" ref={dialog} aria-labelledby="share-title" onClick={event => {
      if (event.target === event.currentTarget) dialog.current?.close()
    }}>
      <div className="city-share-body">
        <button className="city-share-close" type="button" aria-label="Close sharing" onClick={() => dialog.current?.close()}>×</button>
        <p className="city-share-eyebrow">Invite the crew</p>
        <h2 id="share-title">Your city. Their next ride.</h2>
        {/* A generated, downloadable image is also used by social link previews. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={opened ? image : undefined} width="1200" height="630" alt={`Pink and purple city card for ${owner}`} />
        <div className="city-share-actions">
          <a href={`https://x.com/intent/tweet?${new URLSearchParams({ text, url })}`} target="_blank" rel="noopener noreferrer">Share on X ↗</a>
          <a href={`https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
          <button type="button" onClick={() => void copy(url, 'City link copied.')}>Copy link</button>
          <a href={`${image}${image.includes('?') ? '&' : '?'}download=1`} download={`${owner}-gitgta.png`}>Save card ↓</a>
        </div>
        <input className="city-share-url" aria-label="Playable city link" value={url} readOnly onFocus={event => event.target.select()} />
        <button className="city-share-copy-post" type="button" onClick={() => void copy(`${text}\n${url}`, 'Post text copied.')}>Copy post text</button>
        <p className="city-share-note">Share the link to let anyone play. Save the card to attach it to your post.</p>
        <p className="city-share-status" role="status">{status}</p>
      </div>
    </dialog>
  </>
}
