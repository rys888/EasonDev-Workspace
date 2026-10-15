import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { DepthFrame } from './useDepthRenderer'

type Point = {
  x: number
  y: number
}

const TRAVEL = {
  far: { x: 1.8, y: 1.2 },
  mid: { x: 6.5, y: 4.2 },
  near: { x: 10.5, y: 6.5 },
} as const

const SETTLE_THRESHOLD = 0.0007
const RESPONSE_MS = 118

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const softenAxis = (value: number) =>
  Math.sign(value) * Math.pow(Math.abs(value), 1.16)

export function usePointerParallax(
  sceneRef: RefObject<HTMLElement | null>,
  frameRef: RefObject<DepthFrame>,
  active: boolean | 'frozen' = true,
) {
  const positionRef = useRef<Point>({ x: 0, y: 0 })

  useEffect(() => {
    const scene = sceneRef.current

    // Keep the clicked scene pose throughout notebook entry AND return.
    // Projects still uses false and retains its existing neutral reset.
    if (!scene || active === 'frozen') {
      return
    }

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const desktopViewport = window.matchMedia('(min-width: 701px)')

    let enabled =
      active && finePointer.matches && desktopViewport.matches && !reducedMotion.matches
    let frameId = 0
    let previousTime = 0
    let intensity = clamp(scene.clientWidth / 1440, 0.55, 1.15)
    const current = positionRef.current
    const target: Point = { ...current }

    const setDepthVariables = () => {
      scene.style.setProperty('--far-x', `${(-current.x * TRAVEL.far.x * intensity).toFixed(3)}px`)
      scene.style.setProperty('--far-y', `${(-current.y * TRAVEL.far.y * intensity).toFixed(3)}px`)
      scene.style.setProperty('--mid-x', `${(-current.x * TRAVEL.mid.x * intensity).toFixed(3)}px`)
      scene.style.setProperty('--mid-y', `${(-current.y * TRAVEL.mid.y * intensity).toFixed(3)}px`)
      scene.style.setProperty('--near-x', `${(-current.x * TRAVEL.near.x * intensity).toFixed(3)}px`)
      scene.style.setProperty('--near-y', `${(-current.y * TRAVEL.near.y * intensity).toFixed(3)}px`)
      frameRef.current?.({
        far: { x: -current.x * TRAVEL.far.x * intensity, y: -current.y * TRAVEL.far.y * intensity },
        mid: { x: -current.x * TRAVEL.mid.x * intensity, y: -current.y * TRAVEL.mid.y * intensity },
        near: { x: -current.x * TRAVEL.near.x * intensity, y: -current.y * TRAVEL.near.y * intensity },
      })
    }

    const resetImmediately = () => {
      target.x = 0
      target.y = 0
      current.x = 0
      current.y = 0
      previousTime = 0

      if (frameId) {
        window.cancelAnimationFrame(frameId)
        frameId = 0
      }

      setDepthVariables()
      scene.dataset.parallaxState = 'idle'
    }

    const renderFrame = (time: number) => {
      const delta = previousTime ? Math.min(time - previousTime, 48) : 16.67
      previousTime = time

      const blend = 1 - Math.exp(-delta / RESPONSE_MS)
      current.x += (target.x - current.x) * blend
      current.y += (target.y - current.y) * blend
      setDepthVariables()

      const distance =
        Math.abs(target.x - current.x) + Math.abs(target.y - current.y)
      const atNeutral = target.x === 0 && target.y === 0

      if (distance <= SETTLE_THRESHOLD) {
        current.x = target.x
        current.y = target.y
        setDepthVariables()
        frameId = 0
        previousTime = 0
        scene.dataset.parallaxState = atNeutral ? 'idle' : 'settled'
        return
      }

      frameId = window.requestAnimationFrame(renderFrame)
    }

    const requestRender = () => {
      if (!frameId) {
        frameId = window.requestAnimationFrame(renderFrame)
      }
    }

    const returnToNeutral = () => {
      if (!enabled) {
        resetImmediately()
        return
      }

      target.x = 0
      target.y = 0
      scene.dataset.parallaxState = 'returning'
      requestRender()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!enabled || event.pointerType === 'touch') {
        return
      }

      const bounds = scene.getBoundingClientRect()
      const normalizedX = clamp(
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        -1,
        1,
      )
      const normalizedY = clamp(
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
        -1,
        1,
      )

      target.x = softenAxis(normalizedX)
      target.y = softenAxis(normalizedY)
      scene.dataset.parallaxState = 'active'
      requestRender()
    }

    const handleMotionPreference = () => {
      enabled =
        active && finePointer.matches && desktopViewport.matches && !reducedMotion.matches

      if (!enabled) {
        resetImmediately()
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        resetImmediately()
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      intensity = clamp(scene.clientWidth / 1440, 0.55, 1.15)
      setDepthVariables()
    })

    scene.dataset.parallaxState = 'idle'
    if (active) {
      setDepthVariables()
    } else {
      resetImmediately()
    }

    scene.addEventListener('pointermove', handlePointerMove, { passive: true })
    scene.addEventListener('pointerleave', returnToNeutral)
    scene.addEventListener('pointercancel', returnToNeutral)
    window.addEventListener('blur', returnToNeutral)
    document.addEventListener('visibilitychange', handleVisibility)
    finePointer.addEventListener('change', handleMotionPreference)
    reducedMotion.addEventListener('change', handleMotionPreference)
    desktopViewport.addEventListener('change', handleMotionPreference)
    resizeObserver.observe(scene)

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }

      resizeObserver.disconnect()
      scene.removeEventListener('pointermove', handlePointerMove)
      scene.removeEventListener('pointerleave', returnToNeutral)
      scene.removeEventListener('pointercancel', returnToNeutral)
      window.removeEventListener('blur', returnToNeutral)
      document.removeEventListener('visibilitychange', handleVisibility)
      finePointer.removeEventListener('change', handleMotionPreference)
      reducedMotion.removeEventListener('change', handleMotionPreference)
      desktopViewport.removeEventListener('change', handleMotionPreference)
    }
  }, [sceneRef, frameRef, active])
}
