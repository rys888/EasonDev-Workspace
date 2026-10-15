import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { AboutWorkspace } from './AboutWorkspace'
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

const ROOM_BRIDGE = '#211b1a'
const ABOUT_BACKGROUND = '#f2eadf'

export function AboutTransition({
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
    const scene = sceneRef.current
    const sceneWorld = scene?.querySelector<HTMLElement>('.scene-world')

    if (!layer || !content || !scene || !sceneWorld) return

    let completionFrame = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cameraX = Number.parseFloat(scene.style.getPropertyValue('--camera-x')) || 0
    const cameraY = Number.parseFloat(scene.style.getPropertyValue('--camera-y')) || 0
    const cameraScale = Number.parseFloat(scene.style.getPropertyValue('--camera-scale')) || 1

    if (phase === 'room') {
      gsap.set(sceneWorld, { clearProps: 'transform,transformOrigin,opacity,transition' })
      gsap.set(layer, { autoAlpha: 0, backgroundColor: ROOM_BRIDGE })
      gsap.set(content, { opacity: 0, y: 0 })
      return
    }

    if (phase === 'about') {
      gsap.set(layer, { autoAlpha: 1, backgroundColor: ABOUT_BACKGROUND })
      gsap.set(content, { opacity: 1 })
      gsap.set(sceneWorld, {
        x: cameraX,
        y: cameraY,
        scale: cameraScale,
        transformOrigin: '0 0',
        opacity: 0,
        transition: 'none',
      })
      return
    }

    if (phase === 'about-entering') {
      if (reducedMotion) {
        gsap.set(sceneWorld, {
          x: cameraX,
          y: cameraY,
          scale: cameraScale,
          transformOrigin: '0 0',
          opacity: 0,
          transition: 'none',
        })
        gsap.set(layer, { autoAlpha: 1, backgroundColor: ABOUT_BACKGROUND })
        gsap.set(content, { opacity: 1 })
        completionFrame = window.requestAnimationFrame(onEntered)
        return () => window.cancelAnimationFrame(completionFrame)
      }

      gsap.set(layer, { autoAlpha: 0, backgroundColor: ROOM_BRIDGE })
      gsap.set(content, { opacity: 0, y: 12 })
      gsap.set(sceneWorld, {
        x: 0,
        y: 0,
        scale: 1,
        transformOrigin: '0 0',
        opacity: 1,
        transition: 'none',
      })

      const timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: onEntered,
      })

      timeline
        .to(sceneWorld, {
          x: cameraX,
          y: cameraY,
          scale: cameraScale,
          duration: 1.16,
          ease: 'power3.inOut',
        }, 0)
        .set(layer, { visibility: 'visible' }, 1.16)
        .to(layer, { opacity: 1, duration: 0.56, ease: 'power2.inOut' }, 1.16)
        .to(sceneWorld, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 1.16)
        .to(layer, { backgroundColor: ABOUT_BACKGROUND, duration: 0.58, ease: 'power2.inOut' }, 1.36)
        .to(content, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 1.72)

      return () => timeline.kill()
    }

    if (phase === 'about-returning') {
      if (reducedMotion) {
        gsap.set(content, { opacity: 0 })
        gsap.set(layer, { autoAlpha: 0, backgroundColor: ROOM_BRIDGE })
        gsap.set(sceneWorld, { x: 0, y: 0, scale: 1, opacity: 1, transition: 'none' })
        completionFrame = window.requestAnimationFrame(onReturned)
        return () => window.cancelAnimationFrame(completionFrame)
      }

      const timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: onReturned,
      })

      gsap.set(sceneWorld, { transition: 'none' })

      timeline
        .to(content, { opacity: 0, y: 12, duration: 0.24, ease: 'power1.in' }, 0)
        .to(layer, { backgroundColor: ROOM_BRIDGE, duration: 0.48, ease: 'power2.inOut' }, 0.08)
        .to(sceneWorld, { opacity: 1, duration: 0.54, ease: 'power2.inOut' }, 0.2)
        .to(layer, { opacity: 0, duration: 0.62, ease: 'power2.inOut' }, 0.4)
        .to(sceneWorld, { x: 0, y: 0, scale: 1, duration: 0.98, ease: 'power3.inOut' }, 0.38)
        .set(layer, { visibility: 'hidden' })

      return () => timeline.kill()
    }
  }, [onEntered, onReturned, phase, sceneRef])

  return (
    <section
      ref={layerRef}
      className="about-transition"
      aria-hidden={!interactive}
      inert={!interactive || undefined}
    >
      <div ref={contentRef} className="about-transition__content">
        <AboutWorkspace
          active={interactive}
          backButtonRef={backButtonRef}
          onBack={onBack}
        />
      </div>
    </section>
  )
}
