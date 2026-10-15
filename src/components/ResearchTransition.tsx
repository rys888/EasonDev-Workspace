import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { ResearchWorkspace } from './ResearchWorkspace'
import type { ScenePhase } from '../hooks/useSceneTransition'

type Props = {
  backButtonRef: RefObject<HTMLButtonElement | null>
  interactive: boolean
  onBack: () => void
  onEntered: () => void
  onReturned: () => void
  phase: ScenePhase
  sceneRef: RefObject<HTMLElement | null>
}

const ROOM_BRIDGE = '#34241d'
const PAPER = '#eee5d3'

export function ResearchTransition({
  backButtonRef,
  interactive,
  onBack,
  onEntered,
  onReturned,
  phase,
  sceneRef,
}: Props) {
  const layerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const layer = layerRef.current
    const content = contentRef.current
    const sceneWorld = sceneRef.current?.querySelector<HTMLElement>('.scene-world')

    if (!layer || !content || !sceneWorld) return

    let completionFrame = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (phase === 'room') {
      gsap.set(layer, { autoAlpha: 0, backgroundColor: ROOM_BRIDGE })
      gsap.set(content, { opacity: 0 })
      return
    }

    if (phase === 'research') {
      gsap.set(layer, { autoAlpha: 1, backgroundColor: PAPER })
      gsap.set(content, { opacity: 1 })
      gsap.set(sceneWorld, { opacity: 0 })
      return
    }

    if (phase === 'research-entering') {
      if (reducedMotion) {
        gsap.set(layer, { autoAlpha: 1, backgroundColor: PAPER })
        gsap.set(content, { opacity: 1 })
        gsap.set(sceneWorld, { opacity: 0 })
        completionFrame = window.requestAnimationFrame(onEntered)
        return () => window.cancelAnimationFrame(completionFrame)
      }

      gsap.set(layer, { autoAlpha: 0, backgroundColor: ROOM_BRIDGE })
      gsap.set(content, { opacity: 0 })
      gsap.set(sceneWorld, { opacity: 1 })

      const timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: onEntered,
      })

      timeline
        .set(layer, { visibility: 'visible' }, 0.52)
        .to(layer, { opacity: 1, duration: 0.64, ease: 'power2.inOut' }, 0.52)
        .to(sceneWorld, { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, 0.62)
        .to(layer, { backgroundColor: PAPER, duration: 0.82, ease: 'power2.inOut' }, 0.9)
        .to(content, { opacity: 1, duration: 0.42, ease: 'power1.out' }, 1.38)

      return () => timeline.kill()
    }

    if (phase === 'research-returning') {
      if (reducedMotion) {
        gsap.set(content, { opacity: 0 })
        gsap.set(layer, { autoAlpha: 0, backgroundColor: ROOM_BRIDGE })
        gsap.set(sceneWorld, { opacity: 1 })
        completionFrame = window.requestAnimationFrame(onReturned)
        return () => window.cancelAnimationFrame(completionFrame)
      }

      const timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: onReturned,
      })

      timeline
        .to(content, { opacity: 0, duration: 0.24, ease: 'power1.in' }, 0)
        .to(layer, { backgroundColor: ROOM_BRIDGE, duration: 0.5, ease: 'power2.inOut' }, 0.06)
        .to(sceneWorld, { opacity: 1, duration: 0.54, ease: 'power2.inOut' }, 0.18)
        .to(layer, { opacity: 0, duration: 0.62, ease: 'power2.inOut' }, 0.4)
        .set(layer, { visibility: 'hidden' })

      return () => timeline.kill()
    }
  }, [onEntered, onReturned, phase, sceneRef])

  return (
    <section
      ref={layerRef}
      className="research-transition"
      aria-hidden={!interactive}
      inert={!interactive || undefined}
    >
      <div ref={contentRef} className="research-transition__content">
        <ResearchWorkspace backButtonRef={backButtonRef} onBack={onBack} />
      </div>
    </section>
  )
}
