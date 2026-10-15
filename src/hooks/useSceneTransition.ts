import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export type ScenePhase =
  | 'room'
  | 'booting'
  | 'projects'
  | 'exiting'
  | 'notebook-entering'
  | 'blog'
  | 'notebook-returning'
  | 'notebook-exiting'
  | 'research-entering'
  | 'research'
  | 'research-returning'
  | 'research-exiting'
  | 'about-entering'
  | 'about'
  | 'about-returning'
  | 'about-exiting'

const TRANSITION_MS = 920
const NOTEBOOK_EXIT_MS = 960
const RESEARCH_EXIT_MS = 980
const ABOUT_EXIT_MS = 40
const DEFAULT_BOOT_MS = 1650

function readDurationMs(value: string) {
  const duration = Number.parseFloat(value)

  if (!Number.isFinite(duration)) {
    return DEFAULT_BOOT_MS
  }

  return value.trim().endsWith('s') && !value.trim().endsWith('ms')
    ? duration * 1000
    : duration
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}

function cameraTimelineProgress(progress: number) {
  return progress * 0.45 + easeInOutCubic(progress) * 0.55
}

function rangeOpacity(progress: number, fadeIn: number, holdUntil: number, fadeOut: number) {
  if (progress <= fadeIn || progress >= fadeOut) {
    return 0
  }

  if (progress < holdUntil) {
    return Math.min(1, (progress - fadeIn) / 0.05)
  }

  return Math.min(1, (fadeOut - progress) / 0.06)
}

export function useSceneTransition(sceneRef: RefObject<HTMLElement | null>) {
  const [phase, setPhase] = useState<ScenePhase>('room')
  const timeoutRef = useRef<number>(0)
  const bootAnimationFrameRef = useRef<number>(0)
  const releaseCameraFrameRef = useRef<number>(0)
  const restoreFocusRef = useRef<SVGGraphicsElement | null>(null)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = 0
    }
  }, [])

  const clearBootAnimation = useCallback(() => {
    if (bootAnimationFrameRef.current) {
      window.cancelAnimationFrame(bootAnimationFrameRef.current)
      bootAnimationFrameRef.current = 0
    }

    if (releaseCameraFrameRef.current) {
      window.cancelAnimationFrame(releaseCameraFrameRef.current)
      releaseCameraFrameRef.current = 0
    }
  }, [])

  const enterProjects = useCallback((anchor: SVGGraphicsElement, trigger = anchor) => {
    const scene = sceneRef.current

    if (!scene || phase !== 'room') {
      return
    }

    const sceneBounds = scene.getBoundingClientRect()
    const anchorBounds = anchor.getBoundingClientRect()
    const anchorX = anchorBounds.left - sceneBounds.left + anchorBounds.width / 2
    const anchorY = anchorBounds.top - sceneBounds.top + anchorBounds.height / 2
    const isMobilePortrait = sceneBounds.width <= 700 && sceneBounds.height > sceneBounds.width
    const maximumCameraScale = sceneBounds.width <= 700 ? 4.6 : 3.4
    const viewportCoverScale = Math.max(
      sceneBounds.width / Math.max(anchorBounds.width * 0.94, 1),
      sceneBounds.height / Math.max(anchorBounds.height * 0.94, 1),
    )
    const scale = isMobilePortrait
      ? viewportCoverScale
      : Math.min(maximumCameraScale, viewportCoverScale)

    scene.style.setProperty('--camera-scale', scale.toFixed(4))
    scene.style.setProperty('--camera-x', `${(sceneBounds.width / 2 - anchorX * scale).toFixed(2)}px`)
    scene.style.setProperty('--camera-y', `${(sceneBounds.height / 2 - anchorY * scale).toFixed(2)}px`)
    scene.style.setProperty('--portal-left', `${Math.max(0, anchorBounds.left - sceneBounds.left).toFixed(2)}px`)
    scene.style.setProperty('--portal-top', `${Math.max(0, anchorBounds.top - sceneBounds.top).toFixed(2)}px`)
    scene.style.setProperty('--portal-right', `${Math.max(0, sceneBounds.right - anchorBounds.right).toFixed(2)}px`)
    scene.style.setProperty('--portal-bottom', `${Math.max(0, sceneBounds.bottom - anchorBounds.bottom).toFixed(2)}px`)

    restoreFocusRef.current = trigger
    clearTimer()
    clearBootAnimation()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      setPhase('projects')
      return
    }

    const sceneWorld = scene.querySelector<HTMLElement>('.scene-world')

    if (!sceneWorld) {
      setPhase('projects')
      return
    }

    const cameraX = Number.parseFloat(scene.style.getPropertyValue('--camera-x')) || 0
    const cameraY = Number.parseFloat(scene.style.getPropertyValue('--camera-y')) || 0
    const cameraScale = Number.parseFloat(scene.style.getPropertyValue('--camera-scale')) || 1
    const bootDuration = readDurationMs(
      window.getComputedStyle(scene).getPropertyValue('--boot-duration'),
    )
    let startedAt: number | null = null

    const renderBootFrame = (progress: number) => {
      const cameraProgress = cameraTimelineProgress(progress)
      const currentScale = 1 + (cameraScale - 1) * cameraProgress

      sceneWorld.style.transform = `translate3d(${cameraX * cameraProgress}px, ${cameraY * cameraProgress}px, 0) scale(${currentScale})`
      scene.style.setProperty('--boot-progress', cameraProgress.toFixed(5))
      scene.style.setProperty('--idea-status-one-opacity', rangeOpacity(cameraProgress, 0.04, 0.3, 0.36).toFixed(4))
      scene.style.setProperty('--idea-status-two-opacity', rangeOpacity(cameraProgress, 0.32, 0.65, 0.71).toFixed(4))
      scene.style.setProperty('--idea-status-three-opacity', Math.min(1, Math.max(0, (cameraProgress - 0.69) / 0.08)).toFixed(4))
    }

    const advanceBoot = (timestamp: number) => {
      startedAt ??= timestamp
      const progress = Math.min(1, (timestamp - startedAt) / bootDuration)

      renderBootFrame(progress)

      if (progress === 1) {
        bootAnimationFrameRef.current = 0
        setPhase((currentPhase) => currentPhase === 'booting' ? 'projects' : currentPhase)
        return
      }

      bootAnimationFrameRef.current = window.requestAnimationFrame(advanceBoot)
    }

    renderBootFrame(0)
    setPhase('booting')
    bootAnimationFrameRef.current = window.requestAnimationFrame(advanceBoot)
  }, [clearBootAnimation, clearTimer, phase, sceneRef])

  const enterNotebook = useCallback((anchor: SVGGraphicsElement, trigger = anchor) => {
    const scene = sceneRef.current

    if (!scene || phase !== 'room') {
      return
    }

    const sceneBounds = scene.getBoundingClientRect()
    const anchorBounds = anchor.getBoundingClientRect()
    const anchorX = anchorBounds.left - sceneBounds.left + anchorBounds.width / 2
    const anchorY = anchorBounds.top - sceneBounds.top + anchorBounds.height / 2
    const compact = sceneBounds.width <= 700
    const cameraScale = compact ? 2.72 : 2.42
    const desiredCameraX = sceneBounds.width / 2 - anchorX * cameraScale
    const desiredCameraY = sceneBounds.height / 2 - anchorY * cameraScale
    const cameraX = Math.min(0, Math.max(sceneBounds.width * (1 - cameraScale), desiredCameraX))
    const cameraY = Math.min(0, Math.max(sceneBounds.height * (1 - cameraScale), desiredCameraY))

    scene.style.setProperty('--camera-scale', cameraScale.toFixed(4))
    scene.style.setProperty('--camera-x', `${cameraX.toFixed(2)}px`)
    scene.style.setProperty('--camera-y', `${cameraY.toFixed(2)}px`)

    restoreFocusRef.current = trigger
    clearTimer()
    clearBootAnimation()

    setPhase('notebook-entering')
  }, [clearBootAnimation, clearTimer, phase, sceneRef])

  const finishBlogEntry = useCallback(() => {
    setPhase(currentPhase => currentPhase === 'notebook-entering' ? 'blog' : currentPhase)
  }, [])

  const finishBlogReturn = useCallback(() => {
    clearTimer()
    setPhase('notebook-exiting')
    timeoutRef.current = window.setTimeout(() => {
      setPhase('room')
      timeoutRef.current = 0
      window.requestAnimationFrame(() => restoreFocusRef.current?.focus())
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : NOTEBOOK_EXIT_MS)
  }, [clearTimer])

  const enterResearch = useCallback((anchor: SVGGraphicsElement, trigger = anchor) => {
    const scene = sceneRef.current

    if (!scene || phase !== 'room') {
      return
    }

    const sceneBounds = scene.getBoundingClientRect()
    const anchorBounds = anchor.getBoundingClientRect()
    const anchorX = anchorBounds.left - sceneBounds.left + anchorBounds.width / 2
    const anchorY = anchorBounds.top - sceneBounds.top + anchorBounds.height / 2
    const compact = sceneBounds.width <= 700
    const cameraScale = compact ? 2.9 : 2.58
    const desiredCameraX = sceneBounds.width / 2 - anchorX * cameraScale
    const desiredCameraY = sceneBounds.height / 2 - anchorY * cameraScale
    const cameraX = Math.min(0, Math.max(sceneBounds.width * (1 - cameraScale), desiredCameraX))
    const cameraY = Math.min(0, Math.max(sceneBounds.height * (1 - cameraScale), desiredCameraY))

    scene.style.setProperty('--camera-scale', cameraScale.toFixed(4))
    scene.style.setProperty('--camera-x', `${cameraX.toFixed(2)}px`)
    scene.style.setProperty('--camera-y', `${cameraY.toFixed(2)}px`)

    restoreFocusRef.current = trigger
    clearTimer()
    clearBootAnimation()
    setPhase('research-entering')
  }, [clearBootAnimation, clearTimer, phase, sceneRef])

  const finishResearchEntry = useCallback(() => {
    setPhase(currentPhase => currentPhase === 'research-entering' ? 'research' : currentPhase)
  }, [])

  const finishResearchReturn = useCallback(() => {
    clearTimer()
    setPhase('research-exiting')
    timeoutRef.current = window.setTimeout(() => {
      setPhase('room')
      timeoutRef.current = 0
      window.requestAnimationFrame(() => restoreFocusRef.current?.focus())
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : RESEARCH_EXIT_MS)
  }, [clearTimer])

  const enterAbout = useCallback((anchor: SVGGraphicsElement, trigger = anchor) => {
    const scene = sceneRef.current

    if (!scene || phase !== 'room') return

    const sceneBounds = scene.getBoundingClientRect()
    const anchorBounds = anchor.getBoundingClientRect()
    const anchorX = anchorBounds.left - sceneBounds.left + anchorBounds.width / 2
    const anchorY = anchorBounds.top - sceneBounds.top + anchorBounds.height / 2
    const compact = sceneBounds.width <= 700
    const cameraScale = compact ? 3.45 : 3.05
    const desiredCameraX = sceneBounds.width / 2 - anchorX * cameraScale
    const desiredCameraY = sceneBounds.height / 2 - anchorY * cameraScale
    const cameraX = Math.min(0, Math.max(sceneBounds.width * (1 - cameraScale), desiredCameraX))
    const cameraY = Math.min(0, Math.max(sceneBounds.height * (1 - cameraScale), desiredCameraY))

    scene.style.setProperty('--camera-scale', cameraScale.toFixed(4))
    scene.style.setProperty('--camera-x', `${cameraX.toFixed(2)}px`)
    scene.style.setProperty('--camera-y', `${cameraY.toFixed(2)}px`)

    restoreFocusRef.current = trigger
    clearTimer()
    clearBootAnimation()
    setPhase('about-entering')
  }, [clearBootAnimation, clearTimer, phase, sceneRef])

  const finishAboutEntry = useCallback(() => {
    setPhase(currentPhase => currentPhase === 'about-entering' ? 'about' : currentPhase)
  }, [])

  const finishAboutReturn = useCallback(() => {
    clearTimer()
    setPhase('about-exiting')
    timeoutRef.current = window.setTimeout(() => {
      setPhase('room')
      timeoutRef.current = 0
      window.requestAnimationFrame(() => restoreFocusRef.current?.focus())
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : ABOUT_EXIT_MS)
  }, [clearTimer])

  const exit = useCallback(() => {
    if (
      phase === 'room'
      || phase === 'exiting'
      || phase === 'notebook-entering'
      || phase === 'notebook-exiting'
      || phase === 'notebook-returning'
      || phase === 'research-entering'
      || phase === 'research-exiting'
      || phase === 'research-returning'
      || phase === 'about-entering'
      || phase === 'about-exiting'
      || phase === 'about-returning'
    ) {
      return
    }

    clearTimer()
    clearBootAnimation()
    const leavingNotebook = phase.startsWith('notebook')

    if (leavingNotebook || phase === 'blog') {
      setPhase('notebook-returning')
      return
    }

    if (phase.startsWith('research')) {
      setPhase('research-returning')
      return
    }

    if (phase.startsWith('about')) {
      setPhase('about-returning')
      return
    }

    const sceneWorld = sceneRef.current?.querySelector<HTMLElement>('.scene-world')

    if (sceneWorld) {
      const currentTransform = window.getComputedStyle(sceneWorld).transform
      sceneWorld.style.transition = 'none'
      sceneWorld.style.transform = currentTransform
    }

    setPhase('exiting')

    if (sceneWorld) {
      releaseCameraFrameRef.current = window.requestAnimationFrame(() => {
        releaseCameraFrameRef.current = 0
        sceneWorld.style.removeProperty('transition')
        void sceneWorld.offsetWidth
        sceneWorld.style.removeProperty('transform')
      })
    }

    timeoutRef.current = window.setTimeout(() => {
      setPhase('room')
      timeoutRef.current = 0
      window.requestAnimationFrame(() => restoreFocusRef.current?.focus())
    }, TRANSITION_MS)
  }, [clearBootAnimation, clearTimer, phase, sceneRef])

  useEffect(() => {
    if (phase === 'room') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exit, phase])

  useEffect(() => () => {
    clearTimer()
    clearBootAnimation()
  }, [clearBootAnimation, clearTimer])

  return {
    phase,
    enterProjects,
    enterNotebook,
    enterResearch,
    enterAbout,
    finishBlogEntry,
    finishBlogReturn,
    finishResearchEntry,
    finishResearchReturn,
    finishAboutEntry,
    finishAboutReturn,
    exit,
    roomIsInteractive: phase === 'room',
    projectsAreInteractive: phase === 'projects',
    blogIsInteractive: phase === 'blog',
    blogFlowActive: phase === 'blog' || phase.startsWith('notebook'),
    researchIsInteractive: phase === 'research',
    researchFlowActive: phase.startsWith('research'),
    aboutIsInteractive: phase === 'about',
    aboutFlowActive: phase.startsWith('about'),
  }
}
