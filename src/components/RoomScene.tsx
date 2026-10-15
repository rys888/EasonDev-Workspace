import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { gsap } from 'gsap'
import { AmbientLayer } from './AmbientLayer'
import { AboutTransition } from './AboutTransition'
import { BlogTransition } from './BlogTransition'
import { IdeaStartup } from './IdeaStartup'
import { ResearchTransition } from './ResearchTransition'
import { SourceProjectsWorkspace } from './SourceProjectsWorkspace'
import { usePointerParallax } from '../hooks/usePointerParallax'
import { useDepthRenderer } from '../hooks/useDepthRenderer'
import { useSceneTransition } from '../hooks/useSceneTransition'

const RoomWelcome = lazy(async () => {
  const module = await import('./RoomWelcome')
  return { default: module.RoomWelcome }
})

const navItems = [
  { label: 'Room', target: 'room' },
  { label: 'Projects', target: 'projects' },
  { label: 'Blogs', target: 'blog' },
  { label: 'Research', target: 'research' },
  { label: 'About Me', target: 'about' },
] as const

type NavTarget = (typeof navItems)[number]['target']

type RoomSceneProps = {
  welcomeActive: boolean
  onWelcomeComplete: () => void
}
const DESKTOP_NOTEBOOK_PATH = 'M246 706Q246 698 256 691L260 683L371 642Q382 638 394 642L506 658Q513 660 510 671L545 670Q551 670 549 678L547 688L432 745L423 751L258 725Q244 722 246 706Z'
const MOBILE_NOTEBOOK_PATH = 'M0 1144L72 1144L154 1157Q160 1159 157 1166L152 1181L169 1185L172 1193L172 1206L177 1210L175 1218L86 1270L0 1255Z'
const DESKTOP_RESEARCH_NOTEBOOK_PATH = 'M443 738L630 701Q650 697 671 709L914 718Q928 719 926 735L911 849Q909 866 892 871L682 854Q665 852 650 865L623 883Q614 889 598 885L456 858Q443 855 441 842Z'
const MOBILE_RESEARCH_NOTEBOOK_PATH = 'M126 1241L282 1205Q300 1201 315 1211L405 1222Q417 1223 428 1219L579 1228Q593 1229 593 1243L583 1351Q581 1365 566 1368L429 1361Q412 1360 399 1372L386 1382Q378 1388 364 1385L130 1348Q118 1346 119 1333Z'
const DESKTOP_FIGURINE_PATH = 'M536 403C519 404 507 414 505 431C502 443 506 451 511 458L507 477C506 485 511 491 519 491H557C566 491 570 485 568 477L563 458C569 451 572 441 569 429C566 413 553 403 536 403Z'
const MOBILE_FIGURINE_PATH = 'M190 779C173 780 162 790 160 807C158 820 162 829 168 836L164 856C163 864 168 870 176 870H213C222 870 226 864 224 856L219 836C225 829 228 819 225 806C222 790 208 779 190 779Z'
const PHONE_PROGRESS_GEOMETRY = {
  desktop: {
    start: { x: 1160, y: 590.5 },
    end: { x: 1215, y: 594 },
  },
  mobile: {
    start: { x: 701, y: 1083.5 },
    end: { x: 751, y: 1087 },
  },
} as const

type ScenePictureProps = {
  decorative?: boolean
}

function ScenePicture({ decorative = false }: ScenePictureProps) {
  return (
    <picture>
      <source
        media="(max-width: 700px)"
        srcSet="/assets/eason-room-hero-mobile-v2.webp"
      />
      <img
        src="/assets/eason-room-hero-desktop-v2.webp"
        alt={
          decorative
            ? ''
            : 'Eason 的夜间书房，窗外是江南水乡，桌上放着电脑、Java 咖啡杯、笔记本与音乐播放器'
        }
        fetchPriority={decorative ? 'auto' : 'high'}
        decoding="async"
      />
    </picture>
  )
}

type InteractionMapProps = {
  variant: 'desktop' | 'mobile'
  screenRef: RefObject<SVGPathElement | null>
  onActivate: (anchor: SVGGraphicsElement) => void
}

function InteractionMap({ variant, screenRef, onActivate }: InteractionMapProps) {
  const isDesktop = variant === 'desktop'
  const activate = (target: SVGGraphicsElement) => onActivate(target)
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate(event.currentTarget)
    }
  }

  return (
    <svg
      className={`scene-layer interaction-map interaction-map--${variant}`}
      viewBox={isDesktop ? '0 0 1672 941' : '0 0 941 1672'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="false"
    >
      <g
        className="computer-hotspot"
        role="button"
        tabIndex={0}
        aria-label="打开 Projects"
        onClick={(event) => activate(event.currentTarget)}
        onKeyDown={handleKeyDown}
      >
        <path
          className="computer-hit-area"
          d={isDesktop
            ? 'M710 370Q700 370 698 382L681 600L634 659Q631 669 637 674L1090 674Q1097 672 1093 660L1059 601L1055 381Q1055 370 1043 370Z'
            : 'M295 839Q282 839 280 854L267 1072L242 1128Q238 1140 252 1145L689 1145Q702 1141 697 1128L670 1072L665 854Q664 839 651 839Z'}
        />
        <path
          ref={screenRef}
          className="computer-screen-outline"
          d={isDesktop
            ? 'M713 381H1043L1049 592H698L707 391Q708 381 713 381Z'
            : 'M296 853H632Q639 853 640 862L642 1062H286L292 863Q293 853 296 853Z'}
          vectorEffect="non-scaling-stroke"
        />
        <g className="computer-hint" aria-hidden="true">
          <rect
            x={isDesktop ? 786 : 374}
            y={isDesktop ? 342 : 809}
            width={isDesktop ? 180 : 200}
            height={isDesktop ? 30 : 34}
            rx={isDesktop ? 15 : 17}
          />
          <text
            x={isDesktop ? 876 : 474}
            y={isDesktop ? 362 : 832}
            textAnchor="middle"
          >
            Open Projects
          </text>
        </g>
      </g>
    </svg>
  )
}

type NotebookInteractionMapProps = {
  variant: 'desktop' | 'mobile'
  bookRef: RefObject<SVGPathElement | null>
  onActivate: (anchor: SVGGraphicsElement) => void
}

function NotebookInteractionMap({
  variant,
  bookRef,
  onActivate,
}: NotebookInteractionMapProps) {
  const isDesktop = variant === 'desktop'
  const activate = (target: SVGGraphicsElement) => onActivate(target)
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate(event.currentTarget)
    }
  }
  const bookPath = isDesktop ? DESKTOP_NOTEBOOK_PATH : MOBILE_NOTEBOOK_PATH

  return (
    <svg
      className={`scene-layer notebook-map notebook-map--${variant}`}
      viewBox={isDesktop ? '0 0 1672 941' : '0 0 941 1672'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="false"
    >
      <g
        className="notebook-hotspot"
        role="button"
        tabIndex={0}
        aria-label="Blog"
        onClick={(event) => activate(event.currentTarget)}
        onKeyDown={handleKeyDown}
      >
        <path ref={bookRef} className="notebook-hit-area" d={bookPath} />
        <g className="notebook-hint" aria-hidden="true">
          <rect x={isDesktop ? 357 : 38} y={isDesktop ? 598 : 1100} width="76" height="30" rx="15" />
          <text x={isDesktop ? 395 : 76} y={isDesktop ? 618 : 1120} textAnchor="middle">Blog</text>
        </g>
      </g>
    </svg>
  )
}

type ResearchNotebookInteractionMapProps = {
  variant: 'desktop' | 'mobile'
  notebookRef: RefObject<SVGPathElement | null>
  onActivate: (anchor: SVGGraphicsElement) => void
}

function ResearchNotebookInteractionMap({
  variant,
  notebookRef,
  onActivate,
}: ResearchNotebookInteractionMapProps) {
  const isDesktop = variant === 'desktop'
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate(event.currentTarget)
    }
  }

  return (
    <svg
      className={`scene-layer research-notebook-map research-notebook-map--${variant}`}
      viewBox={isDesktop ? '0 0 1672 941' : '0 0 941 1672'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="false"
    >
      <g
        className="research-notebook-hotspot"
        role="button"
        tabIndex={0}
        aria-label="打开 Research Workspace"
        onClick={(event) => onActivate(event.currentTarget)}
        onKeyDown={handleKeyDown}
      >
        <path
          ref={notebookRef}
          className="research-notebook-hit-area"
          d={isDesktop ? DESKTOP_RESEARCH_NOTEBOOK_PATH : MOBILE_RESEARCH_NOTEBOOK_PATH}
        />
        <g className="computer-hint research-notebook-hint" aria-hidden="true">
          <rect
            x={isDesktop ? 592 : 256}
            y={isDesktop ? 674 : 1165}
            width={isDesktop ? 180 : 200}
            height={isDesktop ? 30 : 34}
            rx={isDesktop ? 15 : 17}
          />
          <text
            x={isDesktop ? 682 : 356}
            y={isDesktop ? 694 : 1188}
            textAnchor="middle"
          >
            Open Research
          </text>
        </g>
      </g>
    </svg>
  )
}

type AboutInteractionMapProps = {
  variant: 'desktop' | 'mobile'
  figurineRef: RefObject<SVGPathElement | null>
  onActivate: (anchor: SVGGraphicsElement) => void
}

function AboutInteractionMap({ variant, figurineRef, onActivate }: AboutInteractionMapProps) {
  const isDesktop = variant === 'desktop'
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate(event.currentTarget)
    }
  }

  return (
    <svg
      className={`scene-layer about-map about-map--${variant}`}
      viewBox={isDesktop ? '0 0 1672 941' : '0 0 941 1672'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="false"
    >
      <g
        className="about-hotspot"
        role="button"
        tabIndex={0}
        aria-label="About Me"
        onClick={(event) => onActivate(event.currentTarget)}
        onKeyDown={handleKeyDown}
      >
        <path
          ref={figurineRef}
          className="about-hit-area"
          d={isDesktop ? DESKTOP_FIGURINE_PATH : MOBILE_FIGURINE_PATH}
        />
        <g className="computer-hint about-hint" aria-hidden="true">
          <rect
            x={isDesktop ? 487 : 139}
            y={isDesktop ? 366 : 738}
            width={isDesktop ? 100 : 104}
            height={isDesktop ? 30 : 34}
            rx={isDesktop ? 15 : 17}
          />
          <text
            x={isDesktop ? 537 : 191}
            y={isDesktop ? 386 : 761}
            textAnchor="middle"
          >
            About Me
          </text>
        </g>
      </g>
    </svg>
  )
}

type PhoneInteractionMapProps = {
  variant: 'desktop' | 'mobile'
  isPlaying: boolean
  onToggle: () => void
  portraitRef: RefObject<SVGGElement | null>
  progressFillRef: RefObject<SVGLineElement | null>
  progressIndicatorRef: RefObject<SVGCircleElement | null>
  onSeekStart: (progress: number) => boolean
  onSeekMove: (progress: number) => void
  onSeekCommit: (progress: number) => void
  onSeekCancel: () => void
}

function PhoneInteractionMap({
  variant,
  isPlaying,
  onToggle,
  portraitRef,
  progressFillRef,
  progressIndicatorRef,
  onSeekStart,
  onSeekMove,
  onSeekCommit,
  onSeekCancel,
}: PhoneInteractionMapProps) {
  const activeSeekPointerRef = useRef<number | null>(null)
  const isDesktop = variant === 'desktop'
  const playControl = isDesktop
    ? { x: 1183.5, y: 610.5, radius: 11 }
    : { x: 723.5, y: 1101.5, radius: 12 }
  const portrait = isDesktop
    ? { x: 1194, y: 546.2, radius: 27, innerRadius: 28 }
    : { x: 724, y: 1043.2, radius: 29, innerRadius: 30 }
  const portraitClipId = `phone-portrait-clip-${variant}`
  const portraitSource = isDesktop
    ? '/assets/eason-room-hero-desktop-v2.webp'
    : '/assets/eason-room-hero-mobile-v2.webp'
  const sourceSize = isDesktop
    ? { width: 1672, height: 941 }
    : { width: 941, height: 1672 }
  const progress = PHONE_PROGRESS_GEOMETRY[variant]

  const getSeekProgress = (event: ReactPointerEvent<SVGLineElement>) => {
    const svg = event.currentTarget.ownerSVGElement
    const screenTransform = svg?.getScreenCTM()
    if (!svg || !screenTransform) return null

    const pointer = svg.createSVGPoint()
    pointer.x = event.clientX
    pointer.y = event.clientY

    let localPointer: DOMPoint
    try {
      localPointer = pointer.matrixTransform(screenTransform.inverse())
    } catch {
      return null
    }

    const deltaX = progress.end.x - progress.start.x
    const deltaY = progress.end.y - progress.start.y
    const lengthSquared = deltaX * deltaX + deltaY * deltaY
    const projected = (
      (localPointer.x - progress.start.x) * deltaX
      + (localPointer.y - progress.start.y) * deltaY
    ) / lengthSquared

    return Math.min(1, Math.max(0, projected))
  }

  const handleSeekPointerDown = (event: ReactPointerEvent<SVGLineElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const nextProgress = getSeekProgress(event)
    if (nextProgress === null || !onSeekStart(nextProgress)) return

    event.preventDefault()
    activeSeekPointerRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSeekPointerMove = (event: ReactPointerEvent<SVGLineElement>) => {
    if (activeSeekPointerRef.current !== event.pointerId) return

    const nextProgress = getSeekProgress(event)
    if (nextProgress !== null) {
      event.preventDefault()
      onSeekMove(nextProgress)
    }
  }

  const handleSeekPointerUp = (event: ReactPointerEvent<SVGLineElement>) => {
    if (activeSeekPointerRef.current !== event.pointerId) return

    const nextProgress = getSeekProgress(event)
    activeSeekPointerRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (nextProgress === null) {
      onSeekCancel()
    } else {
      event.preventDefault()
      onSeekCommit(nextProgress)
    }
  }

  const handleSeekPointerCancel = (event: ReactPointerEvent<SVGLineElement>) => {
    if (activeSeekPointerRef.current !== event.pointerId) return

    activeSeekPointerRef.current = null
    onSeekCancel()
  }

  const togglePlayback = () => {
    onToggle()
  }
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      togglePlayback()
    }
  }

  return (
    <svg
      className={`scene-layer phone-map phone-map--${variant}`}
      viewBox={isDesktop ? '0 0 1672 941' : '0 0 941 1672'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="false"
    >
      <defs>
        <clipPath id={portraitClipId} clipPathUnits="userSpaceOnUse">
          <circle
            cx="0"
            cy="0"
            r={portrait.innerRadius}
          />
        </clipPath>
      </defs>
      <g
        className="phone-portrait-shell"
        transform={`translate(${portrait.x} ${portrait.y})`}
        aria-hidden="true"
      >
        <g
          className="phone-portrait-window"
          clipPath={`url(#${portraitClipId})`}
        >
          <g ref={portraitRef} className="phone-portrait-rotor">
            <image
              className="phone-portrait-image"
              href={portraitSource}
              x={-portrait.x}
              y={-portrait.y}
              width={sourceSize.width}
              height={sourceSize.height}
              preserveAspectRatio="none"
            />
          </g>
        </g>
      </g>
      <circle
        className="phone-portrait-region"
        data-phone-region="portrait"
        cx={portrait.x}
        cy={portrait.y}
        r={portrait.radius}
        aria-hidden="true"
      />
      <g className="phone-progress">
        <line
          className="phone-progress-mask"
          x1={progress.start.x}
          y1={progress.start.y}
          x2={progress.end.x}
          y2={progress.end.y}
        />
        <line
          className="phone-progress-track"
          x1={progress.start.x}
          y1={progress.start.y}
          x2={progress.end.x}
          y2={progress.end.y}
        />
        <line
          ref={progressFillRef}
          className="phone-progress-fill"
          x1={progress.start.x}
          y1={progress.start.y}
          x2={progress.start.x}
          y2={progress.start.y}
        />
        <circle
          ref={progressIndicatorRef}
          className="phone-progress-indicator"
          cx={progress.start.x}
          cy={progress.start.y}
          r="1.9"
        />
        <line
          className="phone-progress-hit-area"
          x1={progress.start.x}
          y1={progress.start.y}
          x2={progress.end.x}
          y2={progress.end.y}
          aria-hidden="true"
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          onPointerCancel={handleSeekPointerCancel}
          onLostPointerCapture={handleSeekPointerCancel}
        />
      </g>
      <g
        className="phone-play-hotspot"
        data-phone-control="play-pause"
        data-phone-state={isPlaying ? 'pause' : 'play'}
        role="button"
        tabIndex={0}
        aria-label={isPlaying ? '暂停《exile》' : '播放《exile》'}
        onClick={togglePlayback}
        onKeyDown={handleKeyDown}
      >
        <circle
          className="phone-play-hit-area"
          cx={playControl.x}
          cy={playControl.y}
          r={playControl.radius}
        />
        <circle
          className="phone-control-glyph-mask"
          cx={playControl.x}
          cy={playControl.y}
          r="6.15"
          aria-hidden="true"
        />
        <g
          className="phone-control-glyph"
          aria-hidden="true"
          transform={`rotate(7 ${playControl.x} ${playControl.y})`}
        >
          {isPlaying ? (
            <>
              <rect
                x={playControl.x - 3.4}
                y={playControl.y - 4.6}
                width="2.1"
                height="9.2"
                rx="0.65"
              />
              <rect
                x={playControl.x + 1.3}
                y={playControl.y - 4.6}
                width="2.1"
                height="9.2"
                rx="0.65"
              />
            </>
          ) : (
            <path d={`M${playControl.x - 2.8} ${playControl.y - 4.7}L${playControl.x + 4.6} ${playControl.y}L${playControl.x - 2.8} ${playControl.y + 4.7}Z`} />
          )}
        </g>
      </g>
    </svg>
  )
}

export function RoomScene({ welcomeActive, onWelcomeComplete }: RoomSceneProps) {
  const sceneRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const desktopScreenRef = useRef<SVGPathElement>(null)
  const mobileScreenRef = useRef<SVGPathElement>(null)
  const desktopBookRef = useRef<SVGPathElement>(null)
  const mobileBookRef = useRef<SVGPathElement>(null)
  const desktopResearchNotebookRef = useRef<SVGPathElement>(null)
  const mobileResearchNotebookRef = useRef<SVGPathElement>(null)
  const desktopFigurineRef = useRef<SVGPathElement>(null)
  const mobileFigurineRef = useRef<SVGPathElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const notebookBackButtonRef = useRef<HTMLButtonElement>(null)
  const researchBackButtonRef = useRef<HTMLButtonElement>(null)
  const aboutBackButtonRef = useRef<HTMLButtonElement>(null)
  const phoneAudioRef = useRef<HTMLAudioElement>(null)
  const phonePlayRequestRef = useRef<Promise<void> | null>(null)
  const desktopPhonePortraitRef = useRef<SVGGElement>(null)
  const mobilePhonePortraitRef = useRef<SVGGElement>(null)
  const desktopPhoneProgressFillRef = useRef<SVGLineElement>(null)
  const desktopPhoneProgressIndicatorRef = useRef<SVGCircleElement>(null)
  const mobilePhoneProgressFillRef = useRef<SVGLineElement>(null)
  const mobilePhoneProgressIndicatorRef = useRef<SVGCircleElement>(null)
  const phoneProgressDraggingRef = useRef(false)
  const phoneProgressPreviewRef = useRef(0)
  const renderPhoneProgressRef = useRef<(() => void) | null>(null)
  const phonePortraitTweenRef = useRef<gsap.core.Tween | null>(null)
  const pendingNavigationRef = useRef<Exclude<NavTarget, 'room'> | null>(null)
  const navigationLockedRef = useRef(false)
  const [phoneIsPlaying, setPhoneIsPlaying] = useState(false)
  const [phoneMotionReduced, setPhoneMotionReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const frameRef = useDepthRenderer(canvasRef)
  const transition = useSceneTransition(sceneRef)
  const {
    enterAbout: enterAboutFromNav,
    enterNotebook: enterNotebookFromNav,
    enterProjects: enterProjectsFromNav,
    enterResearch: enterResearchFromNav,
  } = transition
  usePointerParallax(
    sceneRef,
    frameRef,
    welcomeActive
      ? false
      : transition.blogFlowActive || transition.researchFlowActive || transition.aboutFlowActive
      ? 'frozen'
      : transition.roomIsInteractive,
  )

  useEffect(() => {
    if (transition.projectsAreInteractive) {
      backButtonRef.current?.focus()
    } else if (transition.blogIsInteractive) {
      notebookBackButtonRef.current?.focus({ preventScroll: true })
    } else if (transition.researchIsInteractive) {
      researchBackButtonRef.current?.focus({ preventScroll: true })
    } else if (transition.aboutIsInteractive) {
      aboutBackButtonRef.current?.focus({ preventScroll: true })
    }
  }, [
    transition.blogIsInteractive,
    transition.projectsAreInteractive,
    transition.researchIsInteractive,
    transition.aboutIsInteractive,
  ])

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotionPreference = () => setPhoneMotionReduced(motionPreference.matches)

    motionPreference.addEventListener('change', syncMotionPreference)
    return () => motionPreference.removeEventListener('change', syncMotionPreference)
  }, [])

  useLayoutEffect(() => {
    const portraits = [desktopPhonePortraitRef.current, mobilePhonePortraitRef.current]
      .filter((portrait): portrait is SVGGElement => portrait !== null)
    if (portraits.length === 0) return

    const tween = gsap.to(portraits, {
      rotation: '+=360',
      duration: 14,
      ease: 'none',
      repeat: -1,
      paused: true,
      svgOrigin: '0 0',
    })
    phonePortraitTweenRef.current = tween

    return () => {
      tween.kill()
      if (phonePortraitTweenRef.current === tween) {
        phonePortraitTweenRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const tween = phonePortraitTweenRef.current
    if (!tween) return

    if (phoneIsPlaying && !phoneMotionReduced) {
      tween.play()
    } else {
      tween.pause()
    }
  }, [phoneIsPlaying, phoneMotionReduced])

  useEffect(() => {
    const audio = phoneAudioRef.current
    if (!audio) return

    let animationFrame: number | null = null
    const progressElements = [
      {
        fill: desktopPhoneProgressFillRef.current,
        indicator: desktopPhoneProgressIndicatorRef.current,
        geometry: PHONE_PROGRESS_GEOMETRY.desktop,
      },
      {
        fill: mobilePhoneProgressFillRef.current,
        indicator: mobilePhoneProgressIndicatorRef.current,
        geometry: PHONE_PROGRESS_GEOMETRY.mobile,
      },
    ]

    const renderProgress = () => {
      const durationIsUsable = Number.isFinite(audio.duration) && audio.duration > 0
      const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
      const progress = phoneProgressDraggingRef.current
        ? phoneProgressPreviewRef.current
        : durationIsUsable
          ? Math.min(1, Math.max(0, currentTime / audio.duration))
          : 0

      progressElements.forEach(({ fill, indicator, geometry }) => {
        if (!fill || !indicator) return

        const x = geometry.start.x + (geometry.end.x - geometry.start.x) * progress
        const y = geometry.start.y + (geometry.end.y - geometry.start.y) * progress
        fill.setAttribute('x2', String(x))
        fill.setAttribute('y2', String(y))
        indicator.setAttribute('cx', String(x))
        indicator.setAttribute('cy', String(y))
      })
    }

    const stopProgressAnimation = () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
      renderProgress()
    }

    const animateProgress = () => {
      renderProgress()
      animationFrame = requestAnimationFrame(animateProgress)
    }

    const startProgressAnimation = () => {
      if (animationFrame === null) {
        animateProgress()
      }
    }

    const resetProgress = () => {
      phoneProgressDraggingRef.current = false
      phoneProgressPreviewRef.current = 0
      stopProgressAnimation()
      progressElements.forEach(({ fill, indicator, geometry }) => {
        fill?.setAttribute('x2', String(geometry.start.x))
        fill?.setAttribute('y2', String(geometry.start.y))
        indicator?.setAttribute('cx', String(geometry.start.x))
        indicator?.setAttribute('cy', String(geometry.start.y))
      })
    }

    renderPhoneProgressRef.current = renderProgress

    audio.addEventListener('playing', startProgressAnimation)
    audio.addEventListener('pause', stopProgressAnimation)
    audio.addEventListener('ended', stopProgressAnimation)
    audio.addEventListener('timeupdate', renderProgress)
    audio.addEventListener('loadedmetadata', renderProgress)
    audio.addEventListener('durationchange', renderProgress)
    audio.addEventListener('seeked', renderProgress)
    audio.addEventListener('emptied', resetProgress)
    audio.addEventListener('error', resetProgress)

    renderProgress()
    if (!audio.paused && !audio.ended) {
      startProgressAnimation()
    }

    return () => {
      phoneProgressDraggingRef.current = false
      renderPhoneProgressRef.current = null
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
      }
      audio.removeEventListener('playing', startProgressAnimation)
      audio.removeEventListener('pause', stopProgressAnimation)
      audio.removeEventListener('ended', stopProgressAnimation)
      audio.removeEventListener('timeupdate', renderProgress)
      audio.removeEventListener('loadedmetadata', renderProgress)
      audio.removeEventListener('durationchange', renderProgress)
      audio.removeEventListener('seeked', renderProgress)
      audio.removeEventListener('emptied', resetProgress)
      audio.removeEventListener('error', resetProgress)
    }
  }, [])

  const startPhoneSeek = (progress: number) => {
    const audio = phoneAudioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return false
    }

    phoneProgressDraggingRef.current = true
    phoneProgressPreviewRef.current = Math.min(1, Math.max(0, progress))
    renderPhoneProgressRef.current?.()
    return true
  }

  const movePhoneSeek = (progress: number) => {
    if (!phoneProgressDraggingRef.current) return

    phoneProgressPreviewRef.current = Math.min(1, Math.max(0, progress))
    renderPhoneProgressRef.current?.()
  }

  const commitPhoneSeek = (progress: number) => {
    const audio = phoneAudioRef.current
    const durationIsUsable = Boolean(
      audio && Number.isFinite(audio.duration) && audio.duration > 0,
    )

    phoneProgressDraggingRef.current = false
    if (audio && durationIsUsable) {
      audio.currentTime = Math.min(1, Math.max(0, progress)) * audio.duration
    }
    renderPhoneProgressRef.current?.()
  }

  const cancelPhoneSeek = () => {
    if (!phoneProgressDraggingRef.current) return

    phoneProgressDraggingRef.current = false
    renderPhoneProgressRef.current?.()
  }

  useEffect(() => {
    const audio = phoneAudioRef.current
    if (!audio) return

    let active = true
    let recoveryArmed = false

    const removePlaybackRecovery = () => {
      if (!recoveryArmed) return
      recoveryArmed = false
      window.removeEventListener('pointerdown', recoverPlayback, true)
      window.removeEventListener('keydown', recoverPlayback, true)
    }

    const recoverPlayback = (event: PointerEvent | globalThis.KeyboardEvent) => {
      removePlaybackRecovery()

      const target = event.target
      if (
        sceneRef.current?.dataset.phase !== 'room'
        || (target instanceof Element
          && target.closest('[data-phone-control="play-pause"], .phone-progress-hit-area'))
      ) {
        return
      }

      requestPlayback(false)
    }

    const armPlaybackRecovery = () => {
      if (!active || recoveryArmed) return
      recoveryArmed = true
      window.addEventListener('pointerdown', recoverPlayback, true)
      window.addEventListener('keydown', recoverPlayback, true)
    }

    const requestPlayback = (recoverOnInteraction: boolean) => {
      if (!active || phonePlayRequestRef.current || (!audio.paused && !audio.ended)) return

      const playRequest = audio.play()
      phonePlayRequestRef.current = playRequest

      void playRequest
        .catch(() => {
          if (!active) return
          audio.pause()
          setPhoneIsPlaying(false)
          if (recoverOnInteraction) armPlaybackRecovery()
        })
        .finally(() => {
          if (phonePlayRequestRef.current === playRequest) {
            phonePlayRequestRef.current = null
          }
        })
    }

    requestPlayback(true)

    return () => {
      active = false
      removePlaybackRecovery()
      audio.pause()
      phonePlayRequestRef.current = null
    }
  }, [])

  const syncPhonePlaybackState = () => {
    const audio = phoneAudioRef.current
    setPhoneIsPlaying(Boolean(audio && !audio.paused && !audio.ended))
  }

  const handlePhoneAudioError = () => {
    const audio = phoneAudioRef.current
    audio?.pause()
    setPhoneIsPlaying(false)
  }

  const togglePhonePlayback = () => {
    const audio = phoneAudioRef.current
    if (!audio) {
      setPhoneIsPlaying(false)
      return
    }

    if (!audio.paused && !audio.ended) {
      audio.pause()
      return
    }

    if (phonePlayRequestRef.current) return

    const playRequest = audio.play()
    phonePlayRequestRef.current = playRequest
    void playRequest
      .catch(() => {
        if (phoneAudioRef.current === audio) {
          audio.pause()
          setPhoneIsPlaying(false)
        }
      })
      .finally(() => {
        if (phonePlayRequestRef.current === playRequest) {
          phonePlayRequestRef.current = null
        }
      })
  }

  const enterProjects = (target: SVGGraphicsElement) => {
    const screen = window.matchMedia('(max-width: 700px)').matches
      ? mobileScreenRef.current
      : desktopScreenRef.current

    transition.enterProjects(screen ?? target, target)
  }

  const enterNotebook = (target: SVGGraphicsElement) => {
    const book = window.matchMedia('(max-width: 700px)').matches
      ? mobileBookRef.current
      : desktopBookRef.current

    transition.enterNotebook(book ?? target, target)
  }

  const enterResearch = (target: SVGGraphicsElement) => {
    const notebook = window.matchMedia('(max-width: 700px)').matches
      ? mobileResearchNotebookRef.current
      : desktopResearchNotebookRef.current

    transition.enterResearch(notebook ?? target, target)
  }

  const enterAbout = (target: SVGGraphicsElement) => {
    const figurine = window.matchMedia('(max-width: 700px)').matches
      ? mobileFigurineRef.current
      : desktopFigurineRef.current

    transition.enterAbout(figurine ?? target, target)
  }

  const activeNavTarget: NavTarget = transition.phase === 'projects'
    ? 'projects'
    : transition.phase === 'blog'
      ? 'blog'
      : transition.phase === 'research'
        ? 'research'
        : transition.phase === 'about'
          ? 'about'
          : 'room'

  const activateNavTarget = useCallback((target: Exclude<NavTarget, 'room'>) => {
    if (target === 'projects' && desktopScreenRef.current) {
      enterProjectsFromNav(desktopScreenRef.current)
    } else if (target === 'blog' && desktopBookRef.current) {
      enterNotebookFromNav(desktopBookRef.current)
    } else if (target === 'research' && desktopResearchNotebookRef.current) {
      enterResearchFromNav(desktopResearchNotebookRef.current)
    } else if (target === 'about' && desktopFigurineRef.current) {
      enterAboutFromNav(desktopFigurineRef.current)
    } else {
      navigationLockedRef.current = false
    }
  }, [
    enterAboutFromNav,
    enterNotebookFromNav,
    enterProjectsFromNav,
    enterResearchFromNav,
  ])

  const handleNavClick = (target: NavTarget) => {
    if (navigationLockedRef.current || target === activeNavTarget) return

    navigationLockedRef.current = true
    if (target === 'room') {
      pendingNavigationRef.current = null
      transition.exit()
      return
    }

    if (transition.phase === 'room') {
      activateNavTarget(target)
      return
    }

    pendingNavigationRef.current = target
    transition.exit()
  }

  useEffect(() => {
    const pendingTarget = pendingNavigationRef.current

    if (transition.phase === 'room' && pendingTarget) {
      pendingNavigationRef.current = null
      const frame = window.requestAnimationFrame(() => activateNavTarget(pendingTarget))
      return () => window.cancelAnimationFrame(frame)
    }

    if (
      transition.phase === 'room'
      || transition.phase === 'projects'
      || transition.phase === 'blog'
      || transition.phase === 'research'
      || transition.phase === 'about'
    ) {
      navigationLockedRef.current = false
    }
  }, [activateNavTarget, transition.phase])

  return (
    <section
      ref={sceneRef}
      className="room"
      id="room"
      data-phase={transition.phase}
      data-welcome-active={welcomeActive || undefined}
      aria-labelledby="room-title"
      aria-describedby="room-description"
    >
      <h1 className="sr-only" id="room-title">Eason's Room</h1>
      <p className="sr-only" id="room-description">
        一间有生活气息的夜间书房。暖色灯光照着代码屏幕、Java 咖啡杯、技术书、吉他与音乐角落，窗外是有白墙黛瓦、石桥、灯笼和乌篷船的江南河道。
      </p>

      <div
        className="scene-world"
        aria-hidden={
          welcomeActive
          || transition.phase === 'projects'
          || transition.blogFlowActive
          || transition.researchFlowActive
          || transition.aboutFlowActive
        }
        inert={welcomeActive || transition.blogFlowActive || transition.researchFlowActive || transition.aboutFlowActive || undefined}
      >
        <figure
          className="scene-layer scene-still"
          data-scene-layer="accepted-artwork-fallback"
        >
          <ScenePicture />
        </figure>
        <canvas
          ref={canvasRef}
          className="scene-layer scene-depth"
          data-scene-layer="source-registered-depth-planes"
          aria-hidden="true"
        />
        <AmbientLayer />

        <div
          className="scene-layer scene-layer--light"
          data-scene-layer="light-and-depth"
          data-depth="fixed"
          aria-hidden="true"
        />
        <div
          className="scene-layer scene-layer--grain"
          data-scene-layer="material-grain"
          data-depth="fixed"
          aria-hidden="true"
        />
        <IdeaStartup />
        <InteractionMap
          variant="desktop"
          screenRef={desktopScreenRef}
          onActivate={enterProjects}
        />
        <InteractionMap
          variant="mobile"
          screenRef={mobileScreenRef}
          onActivate={enterProjects}
        />
        <NotebookInteractionMap
          variant="desktop"
          bookRef={desktopBookRef}
          onActivate={enterNotebook}
        />
        <ResearchNotebookInteractionMap
          variant="desktop"
          notebookRef={desktopResearchNotebookRef}
          onActivate={enterResearch}
        />
        <AboutInteractionMap
          variant="desktop"
          figurineRef={desktopFigurineRef}
          onActivate={enterAbout}
        />
        <AboutInteractionMap
          variant="mobile"
          figurineRef={mobileFigurineRef}
          onActivate={enterAbout}
        />
        <ResearchNotebookInteractionMap
          variant="mobile"
          notebookRef={mobileResearchNotebookRef}
          onActivate={enterResearch}
        />
        <NotebookInteractionMap
          variant="mobile"
          bookRef={mobileBookRef}
          onActivate={enterNotebook}
        />
        <PhoneInteractionMap
          variant="desktop"
          isPlaying={phoneIsPlaying}
          onToggle={togglePhonePlayback}
          portraitRef={desktopPhonePortraitRef}
          progressFillRef={desktopPhoneProgressFillRef}
          progressIndicatorRef={desktopPhoneProgressIndicatorRef}
          onSeekStart={startPhoneSeek}
          onSeekMove={movePhoneSeek}
          onSeekCommit={commitPhoneSeek}
          onSeekCancel={cancelPhoneSeek}
        />
        <PhoneInteractionMap
          variant="mobile"
          isPlaying={phoneIsPlaying}
          onToggle={togglePhonePlayback}
          portraitRef={mobilePhonePortraitRef}
          progressFillRef={mobilePhoneProgressFillRef}
          progressIndicatorRef={mobilePhoneProgressIndicatorRef}
          onSeekStart={startPhoneSeek}
          onSeekMove={movePhoneSeek}
          onSeekCommit={commitPhoneSeek}
          onSeekCancel={cancelPhoneSeek}
        />
      </div>

      <audio
        ref={phoneAudioRef}
        src="/assets/audio/exile.mp3?v=20261014-full"
        preload="auto"
        loop
        aria-hidden="true"
        onPlay={syncPhonePlaybackState}
        onPause={syncPhonePlaybackState}
        onEnded={syncPhonePlaybackState}
        onError={handlePhoneAudioError}
      />

      <BlogTransition
        backButtonRef={notebookBackButtonRef}
        interactive={transition.blogIsInteractive}
        onBack={transition.exit}
        onEntered={transition.finishBlogEntry}
        onReturned={transition.finishBlogReturn}
        phase={transition.phase}
        sceneRef={sceneRef}
      />

      <ResearchTransition
        backButtonRef={researchBackButtonRef}
        interactive={transition.researchIsInteractive}
        onBack={transition.exit}
        onEntered={transition.finishResearchEntry}
        onReturned={transition.finishResearchReturn}
        phase={transition.phase}
        sceneRef={sceneRef}
      />

      <AboutTransition
        backButtonRef={aboutBackButtonRef}
        interactive={transition.aboutIsInteractive}
        onBack={transition.exit}
        onEntered={transition.finishAboutEntry}
        onReturned={transition.finishAboutReturn}
        phase={transition.phase}
        sceneRef={sceneRef}
      />

      <header
        className="topbar"
        data-scene-layer="interface"
        data-depth="fixed"
        inert={welcomeActive || undefined}
      >
        <div className="brand" aria-label="Eason">Eason<span>.</span></div>
        <nav aria-label="Primary navigation">
          <ul>
            {navItems.map((item) => (
              <li className={item.target === activeNavTarget ? 'is-current' : ''} key={item.target}>
                <button
                  type="button"
                  aria-current={item.target === activeNavTarget ? 'page' : undefined}
                  onClick={() => handleNavClick(item.target)}
                >
                  <span className="nav-mark" aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="room-index" aria-hidden="true">
          <span>ROOM</span>
          <i />
          <b>01</b>
        </div>
      </header>
      <SourceProjectsWorkspace
        backButtonRef={backButtonRef}
        interactive={transition.projectsAreInteractive}
        onBack={transition.exit}
      />
      <Suspense fallback={null}>
        {welcomeActive && <RoomWelcome onComplete={onWelcomeComplete} />}
      </Suspense>
    </section>
  )
}
