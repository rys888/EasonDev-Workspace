import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { BlogExperience } from './BlogExperience'
import { BlogWaterSurface } from './BlogWaterSurface'
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

const BRIDGE_BROWN = '#2d1b16'
const BLOG_PARCHMENT = '#f4f0e8'

export function BlogTransition({
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
  const waterIsActive = ['notebook-entering', 'blog', 'notebook-returning'].includes(phase)

  useLayoutEffect(() => {
    const layer = layerRef.current
    const content = contentRef.current
    const water = layer?.querySelector<HTMLElement>('.blog-water')
    const sceneWorld = sceneRef.current?.querySelector<HTMLElement>('.scene-world')

    if (!layer || !content || !water || !sceneWorld) return

    let completionFrame = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (phase === 'room') {
      gsap.set(layer, { autoAlpha: 0, backgroundColor: BRIDGE_BROWN })
      gsap.set(content, { opacity: 0 })
      gsap.set(water, { opacity: 0 })
      gsap.set(sceneWorld, { opacity: 1 })
      return
    }

    if (phase === 'blog') {
      gsap.set(layer, { autoAlpha: 1, backgroundColor: BLOG_PARCHMENT })
      gsap.set(content, { opacity: 1 })
      gsap.set(water, { opacity: 1 })
      gsap.set(sceneWorld, { opacity: 0 })
      return
    }

    if (phase === 'notebook-entering') {
      if (reducedMotion) {
        gsap.set(layer, { autoAlpha: 1, backgroundColor: BLOG_PARCHMENT })
        gsap.set(content, { opacity: 1 })
        gsap.set(water, { opacity: 1 })
        gsap.set(sceneWorld, { opacity: 0 })
        completionFrame = window.requestAnimationFrame(onEntered)
        return () => window.cancelAnimationFrame(completionFrame)
      }

      gsap.set(layer, { autoAlpha: 0, backgroundColor: BRIDGE_BROWN })
      gsap.set(content, { opacity: 0 })
      gsap.set(water, { opacity: 0 })
      gsap.set(sceneWorld, { opacity: 1 })

      const timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: onEntered,
      })

      timeline
        .set(layer, { visibility: 'visible' }, 0.56)
        .to(layer, { opacity: 1, duration: 0.66, ease: 'power2.inOut' }, 0.56)
        .to(sceneWorld, { opacity: 0, duration: 0.72, ease: 'power2.inOut' }, 0.64)
        .to(layer, { backgroundColor: BLOG_PARCHMENT, duration: 0.84, ease: 'power2.inOut' }, 1.02)
        .to(water, { opacity: 1, duration: 0.62, ease: 'power2.inOut' }, 1.12)
        .to(content, { opacity: 1, duration: 0.38, ease: 'power1.out' }, 1.48)

      return () => timeline.kill()
    }

    if (phase === 'notebook-returning') {
      if (reducedMotion) {
        gsap.set(content, { opacity: 0 })
        gsap.set(water, { opacity: 0 })
        gsap.set(layer, { autoAlpha: 0, backgroundColor: BRIDGE_BROWN })
        gsap.set(sceneWorld, { opacity: 1 })
        completionFrame = window.requestAnimationFrame(onReturned)
        return () => window.cancelAnimationFrame(completionFrame)
      }

      const timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: onReturned,
      })

      timeline
        .to(content, { opacity: 0, duration: 0.2, ease: 'power1.in' }, 0)
        .to(water, { opacity: 0, duration: 0.46, ease: 'power2.inOut' }, 0.02)
        .to(layer, { backgroundColor: BRIDGE_BROWN, duration: 0.54, ease: 'power2.inOut' }, 0.08)
        .to(sceneWorld, { opacity: 1, duration: 0.5, ease: 'power2.inOut' }, 0.18)
        .to(layer, { opacity: 0, duration: 0.64, ease: 'power2.inOut' }, 0.42)
        .set(layer, { visibility: 'hidden' })

      return () => timeline.kill()
    }
  }, [onEntered, onReturned, phase, sceneRef])

  return (
    <section
      ref={layerRef}
      className="blog-transition"
      aria-hidden={!interactive}
      aria-labelledby="blog-title"
      inert={!interactive || undefined}
    >
      <BlogWaterSurface active={waterIsActive} />
      <div ref={contentRef} className="blog-transition__content">
        <BlogExperience
          backButtonRef={backButtonRef}
          interactive={interactive}
          onBack={onBack}
        />
      </div>
    </section>
  )
}
