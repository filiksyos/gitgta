'use client'

import { useEffect, useRef } from 'react'
import { Screens } from '@/game/ui/screens'
import type { CityPayload } from '@/lib/city-from-github'
import '@/game/style.css'

type GameCanvasProps = {
  owner: string
  repo?: string
}

export function GameCanvas({ owner, repo }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const touchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const hud = hudRef.current
    const overlay = overlayRef.current
    const touch = touchRef.current
    if (!canvas || !hud || !overlay || !touch) return

    const screens = new Screens(overlay)
    screens.loading(owner)

    let cancelled = false
    let stop: (() => void) | undefined

    const run = async () => {
      try {
        const response = await fetch(`/api/city/${encodeURIComponent(owner)}`)
        const body = (await response.json().catch(() => ({}))) as CityPayload & {
          error?: string
        }
        if (cancelled) return
        if (!response.ok) {
          screens.error(body.error || 'Could not raise this skyline.', '/')
          return
        }
        const [{ buildDistrictFromGitHub }, { startGame }] = await Promise.all([
          import('@/game/world/district'),
          import('@/game/boot'),
        ])
        if (cancelled) return
        const district = buildDistrictFromGitHub(body, repo)
        stop = startGame({ canvas, hud, overlay, touch, district })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Could not boot the district.'
        screens.error(message, '/')
      }
    }

    void run()

    return () => {
      cancelled = true
      stop?.()
    }
  }, [owner, repo])

  return (
    <div id="game-root">
      <canvas id="game-canvas" ref={canvasRef} />
      <div id="hud" className="hidden" ref={hudRef} />
      <div id="touch" className="hidden" ref={touchRef} />
      <div id="overlay" ref={overlayRef} />
    </div>
  )
}
