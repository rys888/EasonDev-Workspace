import { useEffect, useRef } from 'react'

type Props = {
  active: boolean
}

const FRAME_STEP = 1 / 30
const BASE = [244, 240, 232] as const
const HIGHLIGHT = [255, 249, 237] as const
const SHALLOW = [232, 220, 201] as const
const DEEP = [213, 193, 166] as const

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function BlogWaterSurface({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) {
      if (canvas) canvas.dataset.state = 'idle'
      return
    }

    const interactionTarget = canvas.parentElement
    if (!interactionTarget) return

    const context = canvas.getContext('2d', { alpha: false, desynchronized: true })
    if (!context) return

    const simulation = document.createElement('canvas')
    const simulationContext = simulation.getContext('2d', { alpha: false })
    if (!simulationContext) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motion.matches
    let disposed = false
    let animationFrame = 0
    let width = 0
    let height = 0
    let gridWidth = 0
    let gridHeight = 0
    let current = new Float32Array(0)
    let previous = new Float32Array(0)
    let imageData: ImageData | null = null
    let elapsed = 0
    let accumulator = 0
    let previousTime = 0
    let ambientDelay = 1.4
    let stepCount = 0
    let renderedFrames = 0
    let pointerMoves = 0
    let clicks = 0
    let lastPointer: { x: number; y: number } | null = null

    const inject = (cx: number, cy: number, strength: number, radius: number) => {
      const radiusCeil = Math.ceil(radius)
      const radiusSquared = radius * radius

      for (let offsetY = -radiusCeil; offsetY <= radiusCeil; offsetY += 1) {
        for (let offsetX = -radiusCeil; offsetX <= radiusCeil; offsetX += 1) {
          const x = Math.round(cx + offsetX)
          const y = Math.round(cy + offsetY)
          if (x < 1 || y < 1 || x >= gridWidth - 1 || y >= gridHeight - 1) continue

          const distanceSquared = offsetX * offsetX + offsetY * offsetY
          if (distanceSquared > radiusSquared) continue

          const falloff = 0.5 + 0.5 * Math.cos(Math.PI * Math.sqrt(distanceSquared / radiusSquared))
          current[y * gridWidth + x] += strength * falloff
        }
      }
    }

    const render = () => {
      if (!imageData || !width || !height) return
      const pixels = imageData.data

      for (let y = 0; y < gridHeight; y += 1) {
        const yAbove = y > 0 ? y - 1 : y
        const yBelow = y < gridHeight - 1 ? y + 1 : y

        for (let x = 0; x < gridWidth; x += 1) {
          const index = y * gridWidth + x
          const xLeft = x > 0 ? index - 1 : index
          const xRight = x < gridWidth - 1 ? index + 1 : index
          const gradientX = current[xLeft] - current[xRight]
          const gradientY = current[yAbove * gridWidth + x] - current[yBelow * gridWidth + x]
          const light = gradientX * 0.66 + gradientY * 0.92
          const pixel = index * 4

          if (light >= 0) {
            const amount = clamp(light * 7.2, 0, 0.52)
            pixels[pixel] = BASE[0] + (HIGHLIGHT[0] - BASE[0]) * amount
            pixels[pixel + 1] = BASE[1] + (HIGHLIGHT[1] - BASE[1]) * amount
            pixels[pixel + 2] = BASE[2] + (HIGHLIGHT[2] - BASE[2]) * amount
          } else {
            const depth = clamp(-light * 6.4, 0, 1)
            const shallowAmount = Math.min(0.42, depth * 0.58)
            const deepAmount = Math.max(0, depth - 0.7) * 0.32
            const red = BASE[0] + (SHALLOW[0] - BASE[0]) * shallowAmount
            const green = BASE[1] + (SHALLOW[1] - BASE[1]) * shallowAmount
            const blue = BASE[2] + (SHALLOW[2] - BASE[2]) * shallowAmount
            pixels[pixel] = red + (DEEP[0] - red) * deepAmount
            pixels[pixel + 1] = green + (DEEP[1] - green) * deepAmount
            pixels[pixel + 2] = blue + (DEEP[2] - blue) * deepAmount
          }

          pixels[pixel + 3] = 255
        }
      }

      simulationContext.putImageData(imageData, 0, 0)
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(simulation, 0, 0, canvas.width, canvas.height)

      renderedFrames += 1
      if (renderedFrames % 15 === 0) canvas.dataset.frames = String(renderedFrames)
    }

    const step = () => {
      elapsed += FRAME_STEP

      for (let y = 1; y < gridHeight - 1; y += 1) {
        let index = y * gridWidth + 1
        for (let x = 1; x < gridWidth - 1; x += 1, index += 1) {
          previous[index] = (
            (current[index - 1] + current[index + 1] + current[index - gridWidth] + current[index + gridWidth]) * 0.5
            - previous[index]
          ) * 0.9872
        }
      }

      const swap = current
      current = previous
      previous = swap
      stepCount += 1

      if (stepCount % 4 === 0) {
        const sourceX = gridWidth * (0.5 + Math.sin(elapsed * 0.17 + 0.8) * 0.31)
        const sourceY = gridHeight * (0.5 + Math.sin(elapsed * 0.113 + 2.1) * 0.27)
        inject(sourceX, sourceY, 0.0085, 3.4)

        const secondX = gridWidth * (0.5 + Math.sin(elapsed * 0.097 + 4.2) * 0.38)
        const secondY = gridHeight * (0.5 + Math.sin(elapsed * 0.139 + 1.4) * 0.32)
        inject(secondX, secondY, -0.0065, 4.2)
      }

      ambientDelay -= FRAME_STEP
      if (ambientDelay <= 0) {
        ambientDelay = 1.8 + Math.random() * 2.8
        inject(
          3 + Math.random() * Math.max(1, gridWidth - 6),
          3 + Math.random() * Math.max(1, gridHeight - 6),
          0.035 + Math.random() * 0.045,
          2.6 + Math.random() * 1.5,
        )
      }
    }

    const build = () => {
      const bounds = canvas.getBoundingClientRect()
      width = Math.round(bounds.width)
      height = Math.round(bounds.height)
      if (width < 2 || height < 2) return false

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      gridWidth = Math.min(280, Math.max(130, Math.round(width / 4)))
      gridHeight = Math.max(90, Math.round(gridWidth * height / width))
      simulation.width = gridWidth
      simulation.height = gridHeight
      current = new Float32Array(gridWidth * gridHeight)
      previous = new Float32Array(gridWidth * gridHeight)
      imageData = simulationContext.createImageData(gridWidth, gridHeight)
      accumulator = 0
      previousTime = 0
      elapsed = 0
      stepCount = 0
      lastPointer = null

      for (let y = 0; y < gridHeight; y += 1) {
        for (let x = 0; x < gridWidth; x += 1) {
          const value = (
            Math.sin(x * 0.047 + y * 0.019 + 0.7) * 0.080
            + Math.sin(x * -0.021 + y * 0.039 + 2.4) * 0.055
          )
          current[y * gridWidth + x] = value
          previous[y * gridWidth + x] = value
        }
      }

      canvas.dataset.simulation = `${gridWidth}x${gridHeight}`
      render()
      return true
    }

    const pause = (state = 'paused') => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      animationFrame = 0
      previousTime = 0
      canvas.dataset.state = state
    }

    const loop = (time: number) => {
      animationFrame = 0
      if (disposed || reducedMotion || document.hidden) return

      if (!previousTime) previousTime = time
      accumulator += Math.min(0.08, (time - previousTime) / 1000)
      previousTime = time
      let updates = 0

      while (accumulator >= FRAME_STEP && updates < 2) {
        step()
        accumulator -= FRAME_STEP
        updates += 1
      }

      if (updates) render()
      animationFrame = window.requestAnimationFrame(loop)
    }

    const play = () => {
      if (disposed || reducedMotion || document.hidden || animationFrame) return
      canvas.dataset.state = 'running'
      animationFrame = window.requestAnimationFrame(loop)
    }

    const toSimulationPoint = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return null
      return {
        x: (event.clientX - bounds.left) / bounds.width * gridWidth,
        y: (event.clientY - bounds.top) / bounds.height * gridHeight,
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotion || document.hidden) return
      const point = toSimulationPoint(event)
      if (!point) return
      pointerMoves += 1
      canvas.dataset.pointerMoves = String(pointerMoves)

      if (!lastPointer) {
        lastPointer = point
        inject(point.x, point.y, 0.028, 1.7)
        return
      }

      const deltaX = point.x - lastPointer.x
      const deltaY = point.y - lastPointer.y
      const distance = Math.hypot(deltaX, deltaY)
      if (distance < 1.05) return

      const samples = Math.min(6, Math.ceil(distance / 1.7))
      const strength = clamp(0.024 + distance * 0.006, 0.024, 0.11)
      for (let sample = 1; sample <= samples; sample += 1) {
        inject(
          lastPointer.x + deltaX * sample / samples,
          lastPointer.y + deltaY * sample / samples,
          strength,
          1.8,
        )
      }
      lastPointer = point
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (reducedMotion || document.hidden || event.button !== 0) return
      const target = event.target
      if (
        target instanceof Element
        && target.closest('button, a, input, textarea, select, [role="dialog"], .blog-reader-notice')
      ) return
      const point = toSimulationPoint(event)
      if (!point) return
      clicks += 1
      canvas.dataset.clicks = String(clicks)
      inject(point.x, point.y, 0.82, 2.7)
      inject(point.x, point.y, -0.24, 5.1)
      lastPointer = point
    }

    const clearPointer = () => {
      lastPointer = null
    }

    const handleVisibility = () => {
      if (document.hidden) pause('paused-hidden')
      else play()
    }

    const handleMotionChange = () => {
      reducedMotion = motion.matches
      canvas.dataset.reducedMotion = String(reducedMotion)
      if (reducedMotion) {
        pause('static')
        build()
      } else {
        build()
        play()
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!build()) return
      if (reducedMotion) canvas.dataset.state = 'static'
      else play()
    })

    interactionTarget.addEventListener('pointermove', handlePointerMove, { passive: true })
    interactionTarget.addEventListener('pointerdown', handlePointerDown, { passive: true })
    interactionTarget.addEventListener('pointerleave', clearPointer)
    interactionTarget.addEventListener('pointercancel', clearPointer)
    document.addEventListener('visibilitychange', handleVisibility)
    motion.addEventListener('change', handleMotionChange)
    resizeObserver.observe(canvas)

    canvas.dataset.pointerMoves = '0'
    canvas.dataset.clicks = '0'
    canvas.dataset.frames = '0'
    canvas.dataset.reducedMotion = String(reducedMotion)
    build()
    if (reducedMotion) canvas.dataset.state = 'static'
    else play()

    return () => {
      disposed = true
      pause('disposed')
      resizeObserver.disconnect()
      interactionTarget.removeEventListener('pointermove', handlePointerMove)
      interactionTarget.removeEventListener('pointerdown', handlePointerDown)
      interactionTarget.removeEventListener('pointerleave', clearPointer)
      interactionTarget.removeEventListener('pointercancel', clearPointer)
      document.removeEventListener('visibilitychange', handleVisibility)
      motion.removeEventListener('change', handleMotionChange)
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      className="blog-water"
      aria-hidden="true"
      data-state={active ? 'starting' : 'idle'}
    />
  )
}
