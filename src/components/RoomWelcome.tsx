import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
import { gsap } from 'gsap'

const droplets = [
  { className: 'room-welcome__drop--one', drift: 18, travel: 310 },
  { className: 'room-welcome__drop--two', drift: -12, travel: 390 },
  { className: 'room-welcome__drop--three', drift: 10, travel: 280 },
  { className: 'room-welcome__drop--four', drift: -16, travel: 350 },
] as const

type RoomWelcomeProps = {
  onComplete: () => void
}

export function RoomWelcome({ onComplete }: RoomWelcomeProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const exitTweenRef = useRef<gsap.core.Tween | null>(null)
  const finishingRef = useRef(false)
  const clipPathId = `room-welcome-title-${useId().replaceAll(':', '')}`
  const [motionReduced, setMotionReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const finish = useCallback(() => {
    if (finishingRef.current) return
    finishingRef.current = true
    onComplete()
  }, [onComplete])

  const skip = useCallback(() => {
    const root = rootRef.current
    if (!root || finishingRef.current) return

    finishingRef.current = true
    timelineRef.current?.kill()
    exitTweenRef.current?.kill()
    exitTweenRef.current = gsap.to(root, {
      opacity: 0,
      duration: motionReduced ? 0.01 : 0.28,
      ease: 'power2.out',
      onComplete,
    })
  }, [motionReduced, onComplete])

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setMotionReduced(motionPreference.matches)

    motionPreference.addEventListener('change', updateMotionPreference)
    return () => motionPreference.removeEventListener('change', updateMotionPreference)
  }, [])

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault()
      } else if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        skip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [skip])

  useLayoutEffect(() => {
    const root = rootRef.current
    const glass = glassRef.current
    const copy = copyRef.current
    if (!root || !glass || !copy) return

    const dropElements = gsap.utils.toArray<HTMLElement>('.room-welcome__drop', root)
    const context = gsap.context(() => {
      gsap.set(root, { opacity: 1 })
      gsap.set(glass, { opacity: 0 })
      gsap.set(copy, { opacity: 0, y: motionReduced ? 0 : 16 })
      gsap.set(dropElements, { opacity: 0 })

      if (motionReduced) {
        timelineRef.current = gsap.timeline({ onComplete: finish })
          .to(glass, { opacity: 0.82, duration: 0.12, ease: 'none' })
          .to(copy, { opacity: 1, duration: 0.12, ease: 'none' }, 0.08)
          .to(copy, { opacity: 0, duration: 0.14, ease: 'none' }, 0.72)
          .to(root, { opacity: 0, duration: 0.18, ease: 'none' }, 0.78)
        return
      }

      dropElements.forEach((drop, index) => {
        const config = droplets[index]
        gsap.set(drop, { y: -64 - index * 24, x: 0, scale: 0.94 })
        gsap.to(drop, {
          y: `+=${config.travel}`,
          x: config.drift,
          rotation: index % 2 === 0 ? 4 : -5,
          duration: 3.45 + index * 0.12,
          ease: 'sine.inOut',
          delay: 0.72 + index * 0.08,
        })
      })

      timelineRef.current = gsap.timeline({ onComplete: finish })
        .to(glass, { opacity: 1, duration: 0.72, ease: 'power1.inOut' }, 0.16)
        .to(dropElements, {
          opacity: 0.88,
          scale: 1,
          duration: 0.42,
          stagger: 0.08,
          ease: 'power1.out',
        }, 0.68)
        .to(copy, { opacity: 1, y: 0, duration: 0.78, ease: 'power2.out' }, 1.08)
        .to(copy, { opacity: 0, y: -8, duration: 0.52, ease: 'power2.in' }, 3.55)
        .to(dropElements, { opacity: 0, duration: 0.46, ease: 'power1.in' }, 3.72)
        .to(glass, { opacity: 0, duration: 0.78, ease: 'power1.inOut' }, 3.88)
        .to(root, { opacity: 0, duration: 0.18, ease: 'none' }, 4.5)
    }, root)

    return () => {
      timelineRef.current?.kill()
      timelineRef.current = null
      exitTweenRef.current?.kill()
      exitTweenRef.current = null
      context.revert()
    }
  }, [finish, motionReduced])

  return (
    <div
      ref={rootRef}
      className="room-welcome"
      role="dialog"
      aria-label="Welcome to Eason's Room"
      aria-modal="true"
      tabIndex={-1}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        skip()
      }}
    >
      <div ref={glassRef} className="room-welcome__glass" aria-hidden="true" />

      <div className="room-welcome__drops" aria-hidden="true">
        {droplets.map((drop) => (
          <span className={`room-welcome__drop ${drop.className}`} key={drop.className} />
        ))}
      </div>

      <div ref={copyRef} className="room-welcome__copy">
        <h2 className="sr-only">Welcome to Eason's Room.</h2>
        <svg
          className="room-welcome__title-art"
          viewBox="0 0 1200 190"
          role="presentation"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipPathId}>
              <text className="room-welcome__title-mask" x="600" y="124" textAnchor="middle">
                Welcome to Eason's Room.
              </text>
            </clipPath>
          </defs>
          <text className="room-welcome__title-base" x="600" y="124" textAnchor="middle">
            Welcome to Eason's Room.
          </text>
          <foreignObject width="1200" height="190" clipPath={`url(#${clipPathId})`}>
            <MeshGradient
              className="room-welcome__shader"
              colors={['#6f431f', '#d9a85d', '#fff0bd', '#b97934', '#f5d58b']}
              distortion={0.62}
              swirl={0.38}
              speed={motionReduced ? 0 : 0.13}
              grainMixer={0.05}
              grainOverlay={0.03}
              minPixelRatio={1}
              maxPixelCount={240_000}
            />
          </foreignObject>
          <text className="room-welcome__title-edge" x="600" y="124" textAnchor="middle">
            Welcome to Eason's Room.
          </text>
        </svg>
        <p>Explore the objects. Discover my world.</p>
      </div>
    </div>
  )
}

