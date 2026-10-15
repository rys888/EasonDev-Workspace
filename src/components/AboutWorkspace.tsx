import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'

type Props = {
  active: boolean
  backButtonRef: RefObject<HTMLButtonElement | null>
  onBack: () => void
}

const clamp = (value: number) => Math.min(1, Math.max(-1, value))

const softenAxis = (value: number) =>
  Math.sign(value) * Math.pow(Math.abs(value), 1.12)

export function AboutWorkspace({ active, backButtonRef, onBack }: Props) {
  const portraitRef = useRef<HTMLDivElement>(null)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const characterRef = useRef<HTMLImageElement>(null)
  const rearAuraRef = useRef<HTMLDivElement>(null)
  const frontAuraRef = useRef<HTMLDivElement>(null)
  const speedLinesRef = useRef<HTMLDivElement>(null)
  const redNoteRef = useRef<HTMLDivElement>(null)
  const redNotePopoverRef = useRef<HTMLDivElement>(null)
  const [redNoteOpen, setRedNoteOpen] = useState(false)

  useLayoutEffect(() => {
    const portrait = portraitRef.current
    const background = backgroundRef.current
    const character = characterRef.current
    const rearAura = rearAuraRef.current
    const frontAura = frontAuraRef.current
    const speedLines = speedLinesRef.current

    if (
      !active || !portrait || !background || !character
      || !rearAura || !frontAura || !speedLines
    ) return

    const media = gsap.matchMedia()

    media.add(
      {
        finePointer: '(min-width: 801px) and (hover: hover) and (pointer: fine)',
        reducedMotion: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { finePointer, reducedMotion } = context.conditions ?? {}

        if (!finePointer || reducedMotion) return

        let bounds = portrait.getBoundingClientRect()

        gsap.set(character, {
          force3D: true,
          transformOrigin: '50% 100%',
          transformPerspective: 1200,
        })
        gsap.set(background, { force3D: true })
        const auraLayers = [rearAura, frontAura]
        const auraGlyphs = auraLayers.flatMap((layer) =>
          Array.from(layer.querySelectorAll<HTMLElement>('.about-portrait__glyph')),
        )

        gsap.set([...auraLayers, speedLines], {
          force3D: true,
          opacity: 0,
          visibility: 'visible',
        })

        const auraCycle = gsap.timeline({
          paused: true,
          repeat: -1,
          repeatDelay: 0.12,
        })

        auraGlyphs.forEach((glyph, index) => {
          const driftX = Number(glyph.dataset.driftX ?? 0)
          const driftY = Number(glyph.dataset.driftY ?? 0)
          const rotation = Number(glyph.dataset.rotation ?? 0)
          const turn = Number(glyph.dataset.turn ?? 0)
          const finalScale = Number(glyph.dataset.scale ?? 1.16)

          auraCycle.fromTo(
            glyph,
            {
              x: 0,
              y: 0,
              scale: 0.5,
              rotation: rotation - turn * 0.24,
              opacity: 0,
              visibility: 'visible',
            },
            {
              keyframes: [
                {
                  x: driftX * 0.2,
                  y: driftY * 0.2,
                  scale: 0.82,
                  rotation,
                  opacity: 0.98,
                  duration: 0.72,
                  ease: 'power2.out',
                },
                {
                  x: driftX * 0.62,
                  y: driftY * 0.62,
                  scale: 1,
                  rotation: rotation + turn * 0.58,
                  opacity: 0.9,
                  duration: 1.22,
                  ease: 'sine.out',
                },
                {
                  x: driftX,
                  y: driftY,
                  scale: finalScale,
                  rotation: rotation + turn,
                  opacity: 0,
                  duration: 1.18,
                  ease: 'power2.in',
                },
              ],
            },
            index * 0.52,
          )
        })

        const characterX = gsap.quickTo(character, 'x', {
          duration: 0.58,
          ease: 'power3.out',
        })
        const characterY = gsap.quickTo(character, 'y', {
          duration: 0.58,
          ease: 'power3.out',
        })
        const characterTiltX = gsap.quickTo(character, 'rotationX', {
          duration: 0.66,
          ease: 'power3.out',
        })
        const characterTiltY = gsap.quickTo(character, 'rotationY', {
          duration: 0.66,
          ease: 'power3.out',
        })
        const backgroundX = gsap.quickTo(background, 'x', {
          duration: 0.82,
          ease: 'power3.out',
        })
        const backgroundY = gsap.quickTo(background, 'y', {
          duration: 0.82,
          ease: 'power3.out',
        })
        const auraX = gsap.quickTo(auraLayers, 'x', {
          duration: 0.68,
          ease: 'power3.out',
        })
        const auraY = gsap.quickTo(auraLayers, 'y', {
          duration: 0.68,
          ease: 'power3.out',
        })
        const rearAuraOpacity = gsap.quickTo(rearAura, 'opacity', {
          duration: 0.42,
          ease: 'power2.out',
        })
        const frontAuraOpacity = gsap.quickTo(frontAura, 'opacity', {
          duration: 0.42,
          ease: 'power2.out',
        })
        const auraScaleX = gsap.quickTo(auraLayers, 'scaleX', {
          duration: 0.66,
          ease: 'power3.out',
        })
        const auraScaleY = gsap.quickTo(auraLayers, 'scaleY', {
          duration: 0.66,
          ease: 'power3.out',
        })
        const speedLinesX = gsap.quickTo(speedLines, 'x', {
          duration: 0.76,
          ease: 'power3.out',
        })
        const speedLinesY = gsap.quickTo(speedLines, 'y', {
          duration: 0.76,
          ease: 'power3.out',
        })
        const speedLinesOpacity = gsap.quickTo(speedLines, 'opacity', {
          duration: 0.36,
          ease: 'power2.out',
        })
        const speedLinesScaleX = gsap.quickTo(speedLines, 'scaleX', {
          duration: 0.64,
          ease: 'power3.out',
        })
        const speedLinesScaleY = gsap.quickTo(speedLines, 'scaleY', {
          duration: 0.64,
          ease: 'power3.out',
        })

        let auraActive = false
        let pauseAuraCall: gsap.core.Tween | null = null

        const reset = () => {
          auraActive = false
          characterX(0)
          characterY(0)
          characterTiltX(0)
          characterTiltY(0)
          backgroundX(0)
          backgroundY(0)
          auraX(0)
          auraY(0)
          rearAuraOpacity(0)
          frontAuraOpacity(0)
          auraScaleX(0.98)
          auraScaleY(0.98)
          speedLinesX(0)
          speedLinesY(0)
          speedLinesOpacity(0)
          speedLinesScaleX(0.96)
          speedLinesScaleY(0.96)

          pauseAuraCall?.kill()
          pauseAuraCall = gsap.delayedCall(0.46, () => {
            if (!auraActive) auraCycle.pause(0)
          })
        }

        const refreshBounds = () => {
          bounds = portrait.getBoundingClientRect()
        }

        const updatePointerResponse = (event: PointerEvent) => {
          if (event.pointerType === 'touch' || !bounds.width || !bounds.height) return

          const normalizedX = softenAxis(clamp(
            ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
          ))
          const normalizedY = softenAxis(clamp(
            ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
          ))

          characterX(normalizedX * 11)
          characterY(-Math.abs(normalizedY) * 5)
          characterTiltX(normalizedY * -1.5)
          characterTiltY(normalizedX * 2.2)
          backgroundX(normalizedX * -4)
          backgroundY(normalizedY * -3)

          const distance = Math.min(1, Math.hypot(normalizedX, normalizedY) / Math.SQRT2)
          const centerStrength = 1 - distance
          const lineStrength = Math.max(0, (centerStrength - 0.44) / 0.56)

          auraX(normalizedX * 15)
          auraY(normalizedY * 8)
          rearAuraOpacity(0.72 + centerStrength * 0.18)
          frontAuraOpacity(0.88 + centerStrength * 0.1)
          const auraDepthScale = 0.985 + centerStrength * 0.035
          auraScaleX(auraDepthScale)
          auraScaleY(auraDepthScale)
          speedLinesX(normalizedX * -7)
          speedLinesY(normalizedY * -5)
          speedLinesOpacity(lineStrength * 0.46)
          const speedLineDepthScale = 0.96 + lineStrength * 0.08
          speedLinesScaleX(speedLineDepthScale)
          speedLinesScaleY(speedLineDepthScale)
        }

        const handlePointerEnter = (event: PointerEvent) => {
          refreshBounds()
          auraActive = true
          pauseAuraCall?.kill()
          auraCycle.restart()
          updatePointerResponse(event)
        }

        const handleVisibility = () => {
          if (document.hidden) reset()
        }

        const resizeObserver = new ResizeObserver(refreshBounds)

        portrait.addEventListener('pointerenter', handlePointerEnter, { passive: true })
        portrait.addEventListener('pointermove', updatePointerResponse, { passive: true })
        portrait.addEventListener('pointerleave', reset)
        portrait.addEventListener('pointercancel', reset)
        window.addEventListener('blur', reset)
        document.addEventListener('visibilitychange', handleVisibility)
        resizeObserver.observe(portrait)

        return () => {
          resizeObserver.disconnect()
          portrait.removeEventListener('pointerenter', handlePointerEnter)
          portrait.removeEventListener('pointermove', updatePointerResponse)
          portrait.removeEventListener('pointerleave', reset)
          portrait.removeEventListener('pointercancel', reset)
          window.removeEventListener('blur', reset)
          document.removeEventListener('visibilitychange', handleVisibility)
          pauseAuraCall?.kill()
          auraCycle.kill()
          gsap.killTweensOf([
            background,
            character,
            ...auraLayers,
            speedLines,
            ...auraGlyphs,
          ])
        }
      },
    )

    return () => media.revert()
  }, [active])

  useLayoutEffect(() => {
    const popover = redNotePopoverRef.current
    if (!popover) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.killTweensOf(popover)

    if (!active || !redNoteOpen) {
      if (reducedMotion) {
        gsap.set(popover, { autoAlpha: 0, y: 0, scale: 1 })
      } else {
        gsap.to(popover, {
          autoAlpha: 0,
          y: 9,
          scale: 0.97,
          duration: 0.2,
          ease: 'power2.in',
          overwrite: true,
        })
      }
    } else if (reducedMotion) {
      gsap.set(popover, { autoAlpha: 1, y: 0, scale: 1 })
    } else {
      gsap.fromTo(
        popover,
        { autoAlpha: 0, y: 12, scale: 0.955 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.34,
          ease: 'power3.out',
          overwrite: true,
        },
      )
    }

    return () => gsap.killTweensOf(popover)
  }, [active, redNoteOpen])

  useEffect(() => {
    if (!redNoteOpen) return

    const closeFromOutside = (event: PointerEvent) => {
      if (!redNoteRef.current?.contains(event.target as Node)) {
        setRedNoteOpen(false)
      }
    }

    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setRedNoteOpen(false)
    }

    const closeFromWindowBlur = () => setRedNoteOpen(false)

    document.addEventListener('pointerdown', closeFromOutside, true)
    document.addEventListener('keydown', closeFromKeyboard, true)
    window.addEventListener('blur', closeFromWindowBlur)

    return () => {
      document.removeEventListener('pointerdown', closeFromOutside, true)
      document.removeEventListener('keydown', closeFromKeyboard, true)
      window.removeEventListener('blur', closeFromWindowBlur)
    }
  }, [redNoteOpen])

  const handleBack = () => {
    setRedNoteOpen(false)
    onBack()
  }

  return (
    <main className="about-workspace" aria-labelledby="about-title">
      <button
        ref={backButtonRef}
        className="about-workspace__back"
        type="button"
        onClick={handleBack}
      >
        <span aria-hidden="true">&#8592;</span>
        Back to Room
      </button>

      <section className="about-hero">
        <div ref={portraitRef} className="about-portrait" aria-label="Eason portrait">
          <div className="about-portrait__background" aria-hidden="true">
            <div ref={backgroundRef} className="about-portrait__background-art" />
          </div>
          <div className="about-portrait__effects about-portrait__effects--rear" aria-hidden="true">
            <div ref={speedLinesRef} className="about-portrait__speed-lines">
              <i /><i /><i /><i /><i /><i /><i /><i />
            </div>
            <div ref={rearAuraRef} className="about-portrait__aura about-portrait__aura--rear">
              <span className="about-portrait__glyph about-portrait__glyph--one" data-drift-x="-112" data-drift-y="-54" data-rotation="-13" data-turn="-7" data-scale="1.2">ゴゴゴ</span>
              <span className="about-portrait__glyph about-portrait__glyph--two" data-drift-x="108" data-drift-y="-48" data-rotation="11" data-turn="8" data-scale="1.14">ゴゴゴ</span>
              <span className="about-portrait__glyph about-portrait__glyph--three" data-drift-x="-124" data-drift-y="-12" data-rotation="-9" data-turn="-6" data-scale="1.18">ゴゴゴ</span>
              <span className="about-portrait__glyph about-portrait__glyph--four" data-drift-x="122" data-drift-y="8" data-rotation="13" data-turn="7" data-scale="1.12">ゴゴゴ</span>
            </div>
          </div>
          <img
            ref={characterRef}
            className="about-portrait__character"
            src="/assets/about/eason-character.png"
            alt="JOJO-inspired full-body portrait of Eason"
          />
          <div className="about-portrait__effects about-portrait__effects--front" aria-hidden="true">
            <div ref={frontAuraRef} className="about-portrait__aura about-portrait__aura--front">
              <span className="about-portrait__glyph about-portrait__glyph--five" data-drift-x="-84" data-drift-y="-30" data-rotation="-7" data-turn="-5" data-scale="1.14">ゴゴゴ</span>
              <span className="about-portrait__glyph about-portrait__glyph--six" data-drift-x="88" data-drift-y="-6" data-rotation="9" data-turn="6" data-scale="1.1">ゴゴゴ</span>
            </div>
          </div>
        </div>

        <article className="about-profile">
          <header className="about-profile__heading">
            <p className="about-profile__section">About me</p>
            <h1 id="about-title">Eason Ren</h1>
          </header>

          <div className="about-profile__rule" aria-hidden="true" />

          <div className="about-profile__roles">
            <p>Software Engineering Student</p>
            <p>Java Backend Developer</p>
          </div>

          <blockquote>
            <span aria-hidden="true">“</span>
            Still learning. Still building.
            <span aria-hidden="true">”</span>
          </blockquote>

          <nav className="about-profile__links" aria-label="Social profiles">
            <a
              href="https://github.com/rys888"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <i aria-hidden="true" />
            <div
              ref={redNoteRef}
              className="about-profile__red-note"
              onPointerEnter={(event) => {
                if (
                  event.pointerType !== 'touch'
                  && window.matchMedia('(hover: hover) and (pointer: fine)').matches
                ) setRedNoteOpen(true)
              }}
              onPointerLeave={(event) => {
                if (
                  event.pointerType !== 'touch'
                  && window.matchMedia(
                    '(min-width: 801px) and (hover: hover) and (pointer: fine)',
                  ).matches
                ) setRedNoteOpen(false)
              }}
              onFocusCapture={() => {
                if (
                  window.matchMedia(
                    '(min-width: 801px) and (hover: hover) and (pointer: fine)',
                  ).matches
                ) setRedNoteOpen(true)
              }}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setRedNoteOpen(false)
                }
              }}
            >
              <button
                className="about-profile__red-note-trigger"
                type="button"
                aria-expanded={redNoteOpen}
                aria-controls="about-red-note-qr"
                aria-haspopup="dialog"
                onClick={() => {
                  if (
                    window.matchMedia(
                      '(max-width: 800px), (hover: none), (pointer: coarse)',
                    ).matches
                  ) {
                    setRedNoteOpen((open) => !open)
                  } else {
                    setRedNoteOpen(true)
                  }
                }}
              >
                <span>Red Note</span>
                <small>eason</small>
              </button>

              <div
                ref={redNotePopoverRef}
                id="about-red-note-qr"
                className="about-profile__qr-popover"
                role="dialog"
                aria-label="Red Note QR code for eason"
                aria-hidden={!redNoteOpen}
              >
                <div className="about-profile__qr-heading">
                  <strong>Red Note</strong>
                  <span>@eason</span>
                </div>
                <div className="about-profile__qr-image-window" aria-hidden="true">
                  <img
                    src="/assets/about/red-note-eason-qr.jpg"
                    alt=""
                  />
                </div>
                <p>Scan to follow</p>
              </div>
            </div>
          </nav>
        </article>
      </section>
    </main>
  )
}
