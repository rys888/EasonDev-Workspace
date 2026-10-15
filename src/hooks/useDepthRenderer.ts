import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { makeDepthPlanes, SOURCE_HEIGHT, SOURCE_WIDTH } from '../scene/depthPlanes'
import { steamShader, STEAM_BOUNDS } from '../scene/steamShader'
import { makeWaterMask, waterTownShader, WATER_TOWN_BOUNDS } from '../scene/waterTown'
import { indoorAmbientShader, INDOOR_REGIONS } from '../scene/indoorAmbient'

export type DepthOffsets = Record<'far' | 'mid' | 'near', { x: number; y: number }>
export type DepthFrame = ((offsets: DepthOffsets) => void) | null

const vertex = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D plane;
uniform vec2 viewport;
uniform vec2 offset;
uniform float steamTime;
uniform float isNear;
uniform float isFar;
${steamShader}
${waterTownShader}
${indoorAmbientShader}
void main() {
  vec2 source = vec2(1672., 941.);
  float scale = max(viewport.x / source.x, viewport.y / source.y) * 1.025;
  vec2 pixel = (vec2(uv.x, 1. - uv.y) - .5) * viewport;
  vec2 sampleUV = (pixel - offset) / (source * scale) + .5;
  gl_FragColor = texture2D(plane, sampleUV);
  if (isFar > .5) gl_FragColor = waterTown(sampleUV, steamTime);
  else {
    gl_FragColor = texture2D(plane, indoorUV(sampleUV, steamTime, isNear));
    gl_FragColor = indoorLight(gl_FragColor, sampleUV, steamTime, isNear);
  }
  if (isNear > .5) {
    vec3 mist = coffeeSteam(sampleUV * source, steamTime);
    gl_FragColor.rgb += mist * (1. - gl_FragColor.a);
  }
}
`

export function useDepthRenderer(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const frameRef = useRef<DepthFrame>(null)
  useEffect(() => {
    const canvas = canvasRef.current!
    const media = matchMedia('(min-width: 701px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    let dispose: (() => void) | undefined
    let cancelled = false
    let generation = 0
    const start = async () => {
      if (!media.matches || dispose) return
      const request = ++generation
      const image = new Image()
      const plate = new Image()
      const catPlate = new Image()
      const steamPlate = new Image()
      image.src = '/assets/eason-room-hero-desktop-v2.webp'
      plate.src = '/assets/eason-room-occlusion-plate.webp'
      catPlate.src = '/assets/cat-occlusion-p9.webp'
      steamPlate.src = '/assets/steam-clean-p10.webp'
      await Promise.all([image.decode(), plate.decode(), catPlate.decode(), steamPlate.decode()])
      if (cancelled || request !== generation || !media.matches || dispose) return
      // Retain pixels outside the scissored ambient patches between frames.
      const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true })
      if (!gl) return // The intact Phase 0 picture remains the fallback.
      const program = gl.createProgram()!
      const shaders = [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].map(([type, source]) => {
        const shader = gl.createShader(type as number)!
        gl.shaderSource(shader, source as string)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Scene shader failed')
        gl.attachShader(program, shader)
        return shader
      })
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Scene program failed')
      gl.useProgram(program)
      const buffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
      const location = gl.getAttribLocation(program, 'position')
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
      const textures = makeDepthPlanes(image, plate, catPlate, steamPlate, true).map((rgba) => {
        const texture = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SOURCE_WIDTH, SOURCE_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba)
        return texture
      })
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      const waterTexture = gl.createTexture()!
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, waterTexture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeWaterMask())
      gl.uniform1i(gl.getUniformLocation(program, 'waterMask'), 1)
      gl.activeTexture(gl.TEXTURE0)
      const viewport = gl.getUniformLocation(program, 'viewport')
      const offset = gl.getUniformLocation(program, 'offset')
      const steamTime = gl.getUniformLocation(program, 'steamTime')
      const isNear = gl.getUniformLocation(program, 'isNear')
      const isFar = gl.getUniformLocation(program, 'isFar')
      let animationId = 0
      let lastTick = 0
      let elapsed = 19.3 // Start with a developed plume; no empty startup period.
      let lastDraw = 0
      let current: DepthOffsets = { far: { x: 0, y: 0 }, mid: { x: 0, y: 0 }, near: { x: 0, y: 0 } }
      const draw = (offsets = current, ambientOnly = false) => {
        current = offsets
        if (!media.matches || gl.isContextLost()) return
        const width = canvas.clientWidth, height = canvas.clientHeight
        const ratio = Math.min(devicePixelRatio, 2)
        const w = Math.round(width * ratio), h = Math.round(height * ratio)
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
        gl.viewport(0, 0, w, h)
        const regions = ambientOnly
          ? [
            { bounds: STEAM_BOUNDS, shift: current.near },
            { bounds: WATER_TOWN_BOUNDS, shift: current.far },
            ...INDOOR_REGIONS.map(({ bounds, depth }) => ({ bounds, shift: current[depth] })),
          ]
          : [null]
        for (const region of regions) {
          if (region) {
            const { bounds, shift } = region
            const scale = Math.max(width / SOURCE_WIDTH, height / SOURCE_HEIGHT) * 1.025
            const left = width / 2 + (bounds.left - SOURCE_WIDTH / 2) * scale + shift.x
            const top = height / 2 + (bounds.top - SOURCE_HEIGHT / 2) * scale + shift.y
            const right = left + (bounds.right - bounds.left) * scale
            const bottom = top + (bounds.bottom - bounds.top) * scale
            const x0 = Math.max(0, Math.floor(left * w / width) - 2)
            const y0 = Math.max(0, Math.floor((height - bottom) * h / height) - 2)
            const x1 = Math.min(w, Math.ceil(right * w / width) + 2)
            const y1 = Math.min(h, Math.ceil((height - top) * h / height) + 2)
            gl.enable(gl.SCISSOR_TEST)
            gl.scissor(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0))
          }
          gl.clear(gl.COLOR_BUFFER_BIT)
          gl.uniform2f(viewport, width, height)
          gl.uniform1f(steamTime, elapsed)
          ;(['far', 'mid', 'near'] as const).forEach((depth, index) => {
            gl.bindTexture(gl.TEXTURE_2D, textures[index])
            gl.uniform2f(offset, offsets[depth].x, offsets[depth].y)
            gl.uniform1f(isNear, depth === 'near' ? 1 : 0)
            gl.uniform1f(isFar, depth === 'far' ? 1 : 0)
            gl.drawArrays(gl.TRIANGLES, 0, 6)
          })
          gl.disable(gl.SCISSOR_TEST)
        }
        lastDraw = performance.now()
      }
      // Recompose all three planes inside each ambient patch for correct occlusion.
      // Full redraws still occur immediately on the existing pointer/resize path.
      const animate = (now: number) => {
        if (lastTick) elapsed += Math.min(now - lastTick, 100) / 1000
        lastTick = now
        if (now - lastDraw >= 1000 / 30) draw(current, true)
        animationId = requestAnimationFrame(animate)
      }
      const visibility = () => {
        cancelAnimationFrame(animationId)
        lastTick = 0
        if (!document.hidden) animationId = requestAnimationFrame(animate)
      }
      const observer = new ResizeObserver(() => draw())
      observer.observe(canvas)
      frameRef.current = draw
      draw()
      canvas.dataset.ready = 'true'
      document.addEventListener('visibilitychange', visibility)
      visibility()
      dispose = () => {
        cancelAnimationFrame(animationId)
        document.removeEventListener('visibilitychange', visibility)
        observer.disconnect()
        frameRef.current = null
        delete canvas.dataset.ready
        textures.forEach((texture) => gl.deleteTexture(texture))
        gl.deleteTexture(waterTexture)
        shaders.forEach((shader) => gl.deleteShader(shader))
        gl.deleteBuffer(buffer)
        gl.deleteProgram(program)
      }
    }
    const change = () => {
      if (media.matches) void start().catch(() => { delete canvas.dataset.ready })
      else { generation++; dispose?.(); dispose = undefined }
    }
    const lost = (event: Event) => {
      event.preventDefault()
      dispose?.()
      dispose = undefined
    }
    media.addEventListener('change', change)
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', change)
    change()
    return () => {
      cancelled = true
      dispose?.()
      media.removeEventListener('change', change)
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', change)
    }
  }, [canvasRef])
  return frameRef
}
