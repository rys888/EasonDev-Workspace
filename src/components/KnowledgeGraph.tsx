import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import {
  blogArticles,
  blogGraph,
  blogSections,
  getArticle,
  getSection,
} from '../data/blogContent'
import type { BlogArticle, BlogSectionId } from '../data/blogContent'

type Props = {
  pageRef: RefObject<HTMLElement | null>
  onBack: () => void
  onOpen: (article: BlogArticle) => void
}

type GraphNode = {
  id: string
  kind: 'article' | 'directory'
  label: string
  sectionId: BlogSectionId
  x: number
  y: number
  vx: number
  vy: number
  anchorX: number
  anchorY: number
  radius: number
  degree: number
  article?: BlogArticle
  directoryDepth: number
}

type Camera = { x: number; y: number; scale: number }
type DragState = {
  pointerId: number
  kind: 'node' | 'pan'
  nodeId?: string
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  moved: boolean
}

type SectionField = {
  sectionId: BlogSectionId
  label: string
  color: string
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
}

const SECTION_COLORS = ['#9a7045', '#a36f5b', '#77816f', '#7c6858']
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MIN_SCALE = 0.24
const MAX_SCALE = 2.8

function hashNumber(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function addNeighbor(adjacency: Map<string, Set<string>>, source: string, target: string) {
  if (!adjacency.has(source)) adjacency.set(source, new Set())
  adjacency.get(source)?.add(target)
}

function buildLayout() {
  const sectionCenters = new Map<string, { x: number; y: number }>()
  const columns = Math.min(2, Math.max(1, blogSections.length))
  const rows = Math.ceil(blogSections.length / columns)

  blogSections.forEach((section, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    sectionCenters.set(section.id, {
      x: (column - (columns - 1) / 2) * 610,
      y: (row - (rows - 1) / 2) * 430,
    })
  })

  const nodes: GraphNode[] = []
  const byId = new Map<string, GraphNode>()
  const adjacency = new Map<string, Set<string>>()
  const wikilinkDegree = new Map<string, number>()
  const directories = [...blogGraph.directoryNodes].sort((left, right) => left.path.length - right.path.length)

  for (const directory of directories) {
    const center = sectionCenters.get(directory.sectionId) ?? { x: 0, y: 0 }
    const parent = directory.parentId ? byId.get(directory.parentId) : undefined
    const seed = hashNumber(directory.id)
    const angle = (seed % 6283) / 1000
    const distance = directory.path.length === 0 ? 0 : 76 + directory.path.length * 16
    const x = parent ? parent.x + Math.cos(angle) * distance : center.x
    const y = parent ? parent.y + Math.sin(angle) * distance * 0.78 : center.y
    const node: GraphNode = {
      id: directory.id,
      kind: 'directory',
      label: directory.path.length === 0
        ? (getSection(directory.sectionId)?.title ?? directory.label)
        : directory.label,
      sectionId: directory.sectionId,
      x,
      y,
      vx: 0,
      vy: 0,
      anchorX: x,
      anchorY: y,
      radius: directory.path.length === 0 ? 10 : 6.5,
      degree: 0,
      directoryDepth: directory.path.length,
    }
    nodes.push(node)
    byId.set(node.id, node)
  }

  const articlesByDirectory = new Map<string, typeof blogGraph.articleNodes>()
  for (const membership of blogGraph.articleNodes) {
    articlesByDirectory.set(membership.directoryId, [
      ...(articlesByDirectory.get(membership.directoryId) ?? []),
      membership,
    ])
  }

  for (const [directoryId, memberships] of articlesByDirectory) {
    const directory = byId.get(directoryId)
    if (!directory) continue
    memberships.forEach((membership, index) => {
      const article = getArticle(membership.id)
      if (!article) return
      const angle = index * GOLDEN_ANGLE + (hashNumber(directoryId) % 360) * Math.PI / 180
      const distance = 30 + Math.sqrt(index + 1) * 15
      const x = directory.x + Math.cos(angle) * distance
      const y = directory.y + Math.sin(angle) * distance
      const node: GraphNode = {
        id: article.id,
        kind: 'article',
        label: article.title,
        sectionId: article.sectionId,
        x,
        y,
        vx: 0,
        vy: 0,
        anchorX: x,
        anchorY: y,
        radius: 3.4,
        degree: 0,
        article,
        directoryDepth: article.categoryPath.length,
      }
      nodes.push(node)
      byId.set(node.id, node)
    })
  }

  for (const edge of blogGraph.directoryEdges) {
    addNeighbor(adjacency, edge.source, edge.target)
    addNeighbor(adjacency, edge.target, edge.source)
  }
  for (const edge of blogGraph.wikilinkEdges) {
    addNeighbor(adjacency, edge.source, edge.target)
    addNeighbor(adjacency, edge.target, edge.source)
    wikilinkDegree.set(edge.source, (wikilinkDegree.get(edge.source) ?? 0) + 1)
    wikilinkDegree.set(edge.target, (wikilinkDegree.get(edge.target) ?? 0) + 1)
  }

  for (const node of nodes) {
    node.degree = adjacency.get(node.id)?.size ?? 0
    if (node.kind === 'article') {
      node.radius = Math.min(8.2, 3.25 + Math.sqrt(wikilinkDegree.get(node.id) ?? 0) * 1.08)
    } else {
      node.radius = Math.min(12, 5.4 + Math.sqrt(node.degree) * 0.85 + (node.directoryDepth === 0 ? 1.8 : 0))
    }
  }

  // Akasha settles its force engine before interaction. This deterministic 2D solve follows
  // the same finite-lifecycle principle while keeping the existing Canvas renderer and data.
  const iterations = 210
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const cooling = 0.22 + (1 - iteration / iterations) * 0.78

    for (const node of nodes) {
      const center = sectionCenters.get(node.sectionId) ?? { x: 0, y: 0 }
      const anchorStrength = node.kind === 'directory'
        ? (node.directoryDepth === 0 ? 0.2 : 0.014)
        : 0.0035
      node.vx += (center.x - node.x) * anchorStrength * cooling
      node.vy += (center.y - node.y) * anchorStrength * cooling
    }

    for (const edge of blogGraph.directoryEdges) {
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      if (!source || !target) continue
      const deltaX = target.x - source.x
      const deltaY = target.y - source.y
      const distance = Math.hypot(deltaX, deltaY) || 0.001
      const desired = target.kind === 'article' ? 38 : 72
      const force = (distance - desired) * 0.018 * cooling
      const offsetX = deltaX / distance * force
      const offsetY = deltaY / distance * force
      source.vx += offsetX
      source.vy += offsetY
      target.vx -= offsetX
      target.vy -= offsetY
    }

    for (const edge of blogGraph.wikilinkEdges) {
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      if (!source || !target) continue
      const deltaX = target.x - source.x
      const deltaY = target.y - source.y
      const distance = Math.hypot(deltaX, deltaY) || 0.001
      const desired = source.sectionId === target.sectionId ? 86 : 150
      const weight = Math.min(2.1, 1 + Math.log2(Math.max(1, edge.occurrences)) * 0.28)
      const force = (distance - desired) * 0.01 * weight * cooling
      const offsetX = deltaX / distance * force
      const offsetY = deltaY / distance * force
      source.vx += offsetX
      source.vy += offsetY
      target.vx -= offsetX
      target.vy -= offsetY
    }

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      const left = nodes[leftIndex]
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const right = nodes[rightIndex]
        let deltaX = right.x - left.x
        let deltaY = right.y - left.y
        let distanceSquared = deltaX * deltaX + deltaY * deltaY
        if (distanceSquared < 0.01) {
          const angle = ((hashNumber(`${left.id}:${right.id}`) % 6283) / 1000)
          deltaX = Math.cos(angle) * 0.1
          deltaY = Math.sin(angle) * 0.1
          distanceSquared = 0.01
        }
        if (distanceSquared > 240 * 240) continue
        const distance = Math.sqrt(distanceSquared)
        const differentSection = left.sectionId !== right.sectionId
        const repulsion = (differentSection ? 420 : 250) * cooling / Math.max(85, distanceSquared)
        const repelX = deltaX / distance * repulsion
        const repelY = deltaY / distance * repulsion
        left.vx -= repelX
        left.vy -= repelY
        right.vx += repelX
        right.vy += repelY

        const padding = left.kind === 'article' && right.kind === 'article' ? 7 : 11
        const minimum = left.radius + right.radius + padding
        if (distance < minimum) {
          const collision = (minimum - distance) * 0.16 * cooling
          const collisionX = deltaX / distance * collision
          const collisionY = deltaY / distance * collision
          left.vx -= collisionX
          left.vy -= collisionY
          right.vx += collisionX
          right.vy += collisionY
        }
      }
    }

    for (const node of nodes) {
      const center = sectionCenters.get(node.sectionId) ?? { x: 0, y: 0 }
      if (node.kind === 'directory' && node.directoryDepth === 0) {
        node.x = center.x
        node.y = center.y
        node.vx = 0
        node.vy = 0
        continue
      }
      node.vx *= 0.76
      node.vy *= 0.76
      node.x += node.vx
      node.y += node.vy
    }
  }

  for (const node of nodes) {
    node.vx = 0
    node.vy = 0
    node.anchorX = node.x
    node.anchorY = node.y
  }

  const sectionFields: SectionField[] = blogSections.map((section, sectionIndex) => {
    const group = nodes.filter((node) => node.sectionId === section.id)
    const bounds = group.reduce((result, node) => ({
      minX: Math.min(result.minX, node.x),
      maxX: Math.max(result.maxX, node.x),
      minY: Math.min(result.minY, node.y),
      maxY: Math.max(result.maxY, node.y),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
    return {
      sectionId: section.id,
      label: section.title,
      color: SECTION_COLORS[sectionIndex % SECTION_COLORS.length],
      centerX: (bounds.minX + bounds.maxX) / 2,
      centerY: (bounds.minY + bounds.maxY) / 2,
      radiusX: Math.max(110, (bounds.maxX - bounds.minX) / 2 + 45),
      radiusY: Math.max(95, (bounds.maxY - bounds.minY) / 2 + 40),
    }
  })

  return { nodes, byId, adjacency, sectionFields }
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  const red = value >> 16
  const green = (value >> 8) & 255
  const blue = value & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function KnowledgeGraph({ pageRef, onBack, onOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const fitFrameRef = useRef(0)
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<DragState | null>(null)
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const renderStateRef = useRef<{
    hoveredId?: string
    selectedId?: string
    visibleIds: Set<string>
    visibleNodes: GraphNode[]
  }>({ visibleIds: new Set(), visibleNodes: [] })
  const layout = useMemo(() => buildLayout(), [])
  const [sectionFilter, setSectionFilter] = useState<BlogSectionId | 'all'>('all')
  const [query, setQuery] = useState('')
  const [hoveredId, setHoveredId] = useState<string>()
  const [selectedId, setSelectedId] = useState<string>()

  const visibleNodes = useMemo(
    () => layout.nodes.filter((node) => sectionFilter === 'all' || node.sectionId === sectionFilter),
    [layout.nodes, sectionFilter],
  )
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return []
    return blogArticles
      .filter((article) => sectionFilter === 'all' || article.sectionId === sectionFilter)
      .filter((article) => [article.title, article.categoryPath.join(' ')].join(' ').toLocaleLowerCase().includes(normalizedQuery))
      .slice(0, 7)
  }, [normalizedQuery, sectionFilter])

  const drawNow = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const { width, height, dpr } = sizeRef.current
    const camera = cameraRef.current
    if (!width || !height) return

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)
    context.save()
    context.translate(width / 2 + camera.x, height / 2 + camera.y)
    context.scale(camera.scale, camera.scale)

    const {
      hoveredId: currentHoveredId,
      selectedId: currentSelectedId,
      visibleIds: currentVisibleIds,
      visibleNodes: currentVisibleNodes,
    } = renderStateRef.current
    const activeId = currentHoveredId ?? currentSelectedId
    const neighboringIds = new Set<string>(activeId ? [activeId] : [])
    if (activeId) {
      for (const id of layout.adjacency.get(activeId) ?? []) {
        if (currentVisibleIds.has(id)) neighboringIds.add(id)
      }
    }
    const activeNode = activeId ? layout.byId.get(activeId) : undefined

    for (const field of layout.sectionFields) {
      if (sectionFilter !== 'all' && sectionFilter !== field.sectionId) continue
      const muted = Boolean(activeNode && activeNode.sectionId !== field.sectionId)
      context.beginPath()
      context.ellipse(field.centerX, field.centerY, field.radiusX, field.radiusY, 0, 0, Math.PI * 2)
      context.fillStyle = hexToRgba(field.color, muted ? 0.012 : 0.032)
      context.fill()
      if (!activeId || activeNode?.sectionId === field.sectionId) {
        context.font = `500 ${10 / camera.scale}px Georgia, serif`
        context.textAlign = 'left'
        context.textBaseline = 'middle'
        context.fillStyle = hexToRgba(field.color, 0.48)
        context.fillText(field.label, field.centerX - field.radiusX + 18 / camera.scale, field.centerY - field.radiusY + 20 / camera.scale)
      }
    }

    const edgeIsActive = (source: string, target: string) => Boolean(
      activeId && (source === activeId || target === activeId),
    )
    context.lineCap = 'round'
    for (const edge of blogGraph.directoryEdges) {
      if (!currentVisibleIds.has(edge.source) || !currentVisibleIds.has(edge.target)) continue
      const source = layout.byId.get(edge.source)
      const target = layout.byId.get(edge.target)
      if (!source || !target) continue
      const emphasized = edgeIsActive(edge.source, edge.target)
      context.beginPath()
      context.moveTo(source.x, source.y)
      context.lineTo(target.x, target.y)
      context.setLineDash([2.2 / camera.scale, 5.5 / camera.scale])
      context.lineWidth = (emphasized ? 1.25 : 0.62) / camera.scale
      context.strokeStyle = emphasized
        ? 'rgba(111, 79, 55, .66)'
        : activeId ? 'rgba(111, 79, 55, .045)' : 'rgba(111, 79, 55, .14)'
      context.stroke()
    }

    context.setLineDash([])
    for (const edge of blogGraph.wikilinkEdges) {
      if (!currentVisibleIds.has(edge.source) || !currentVisibleIds.has(edge.target)) continue
      const source = layout.byId.get(edge.source)
      const target = layout.byId.get(edge.target)
      if (!source || !target) continue
      const emphasized = edgeIsActive(edge.source, edge.target)
      context.beginPath()
      context.moveTo(source.x, source.y)
      context.lineTo(target.x, target.y)
      context.lineWidth = (emphasized ? Math.min(2.15, 1.35 + edge.occurrences * 0.12) : 0.7) / camera.scale
      context.strokeStyle = emphasized
        ? 'rgba(145, 86, 38, .82)'
        : activeId ? 'rgba(145, 86, 38, .055)' : 'rgba(145, 86, 38, .22)'
      context.stroke()
    }

    const orderedNodes = [...currentVisibleNodes].sort((left, right) => Number(left.id === activeId) - Number(right.id === activeId))
    for (const node of orderedNodes) {
      const sectionIndex = Math.max(0, blogSections.findIndex((section) => section.id === node.sectionId))
      const color = SECTION_COLORS[sectionIndex % SECTION_COLORS.length]
      const active = node.id === activeId
      const selected = node.id === currentSelectedId
      const muted = Boolean(activeId && !neighboringIds.has(node.id))
      context.globalAlpha = muted ? 0.11 : 1

      if (active || selected) {
        context.beginPath()
        context.arc(node.x, node.y, node.radius + (active ? 6 : 4) / camera.scale, 0, Math.PI * 2)
        context.lineWidth = (active ? 1.5 : 1) / camera.scale
        context.strokeStyle = hexToRgba(color, active ? 0.72 : 0.46)
        context.stroke()
      }

      context.beginPath()
      context.arc(node.x, node.y, node.radius + (active ? 1.4 / camera.scale : 0), 0, Math.PI * 2)
      context.fillStyle = node.kind === 'directory' ? 'rgba(249, 244, 234, .94)' : color
      context.fill()
      context.lineWidth = (node.kind === 'directory' ? 1.3 : 0.72) / camera.scale
      context.strokeStyle = node.kind === 'directory' ? color : 'rgba(255, 249, 237, .92)'
      context.stroke()

      if (node.kind === 'directory' && node.directoryDepth === 0) {
        context.beginPath()
        context.arc(node.x, node.y, Math.max(2, node.radius - 3.7 / camera.scale), 0, Math.PI * 2)
        context.fillStyle = hexToRgba(color, 0.82)
        context.fill()
      }
    }
    context.globalAlpha = 1

    const labelCandidates: GraphNode[] = []
    const labelIds = new Set<string>()
    const addLabel = (node: GraphNode | undefined) => {
      if (!node || !currentVisibleIds.has(node.id) || labelIds.has(node.id)) return
      labelIds.add(node.id)
      labelCandidates.push(node)
    }
    addLabel(activeNode)
    if (activeId) {
      const neighbors = Array.from(layout.adjacency.get(activeId) ?? [])
        .map((id) => layout.byId.get(id))
        .filter((node): node is GraphNode => Boolean(node && currentVisibleIds.has(node.id)))
        .sort((left, right) => right.degree - left.degree)
        .slice(0, 14)
      neighbors.forEach(addLabel)
    }
    addLabel(currentSelectedId ? layout.byId.get(currentSelectedId) : undefined)
    if (!activeId && camera.scale >= 0.9) {
      currentVisibleNodes
        .filter((node) => (node.kind === 'directory' && node.directoryDepth === 1) || (node.kind === 'article' && node.degree >= 7))
        .sort((left, right) => right.degree - left.degree)
        .slice(0, 18)
        .forEach(addLabel)
    }

    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = []
    for (const node of labelCandidates) {
      const forced = node.id === activeId || node.id === currentSelectedId
      const fontSize = forced ? 12 : node.kind === 'directory' ? 10.5 : 10
      const fontFamily = node.kind === 'directory' ? 'Georgia, serif' : 'Avenir, sans-serif'
      context.font = `${forced || node.kind === 'directory' ? '500' : '400'} ${fontSize / camera.scale}px ${fontFamily}`
      const maximumWidth = (forced ? 220 : 165) / camera.scale
      const measured = Math.min(context.measureText(node.label).width, maximumWidth)
      const top = node.y + node.radius + 5 / camera.scale
      const box = {
        left: node.x - measured / 2 - 5 / camera.scale,
        right: node.x + measured / 2 + 5 / camera.scale,
        top,
        bottom: top + (fontSize + 6) / camera.scale,
      }
      const overlaps = occupied.some((candidate) => !(
        box.right < candidate.left || box.left > candidate.right || box.bottom < candidate.top || box.top > candidate.bottom
      ))
      if (overlaps && !forced) continue
      occupied.push(box)
      context.textAlign = 'center'
      context.textBaseline = 'top'
      context.lineJoin = 'round'
      context.lineWidth = 3.8 / camera.scale
      context.strokeStyle = 'rgba(248, 242, 230, .9)'
      context.strokeText(node.label, node.x, top, maximumWidth)
      context.fillStyle = forced ? 'rgba(67, 42, 29, .96)' : 'rgba(83, 59, 42, .78)'
      context.fillText(node.label, node.x, top, maximumWidth)
    }

    context.restore()
  }, [layout, sectionFilter])

  const scheduleDraw = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      drawNow()
    })
  }, [drawNow])

  const animateCamera = useCallback((target: Camera, animate: boolean) => {
    if (fitFrameRef.current) cancelAnimationFrame(fitFrameRef.current)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animate || reducedMotion) {
      fitFrameRef.current = 0
      cameraRef.current = target
      scheduleDraw()
      return
    }
    const start = { ...cameraRef.current }
    const started = performance.now()
    const duration = 520
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 4)
      cameraRef.current = {
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        scale: start.scale + (target.scale - start.scale) * eased,
      }
      scheduleDraw()
      if (progress < 1) fitFrameRef.current = requestAnimationFrame(tick)
      else fitFrameRef.current = 0
    }
    fitFrameRef.current = requestAnimationFrame(tick)
  }, [scheduleDraw])

  const fitVisible = useCallback((animate = false, nodes = renderStateRef.current.visibleNodes, focused = false) => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return
    const { width, height } = sizeRef.current
    const bounds = nodes.reduce((result, node) => ({
      minX: Math.min(result.minX, node.x - node.radius),
      maxX: Math.max(result.maxX, node.x + node.radius),
      minY: Math.min(result.minY, node.y - node.radius),
      maxY: Math.max(result.maxY, node.y + node.radius),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
    const compact = width < 700
    const horizontalPadding = focused ? (compact ? 90 : 190) : (compact ? 110 : 170)
    const verticalPadding = focused ? (compact ? 230 : 180) : (compact ? 210 : 160)
    const contentWidth = Math.max(110, bounds.maxX - bounds.minX + horizontalPadding)
    const contentHeight = Math.max(100, bounds.maxY - bounds.minY + verticalPadding)
    const maximum = focused ? (compact ? 1.35 : 1.72) : 1.32
    const scale = Math.max(MIN_SCALE, Math.min(maximum, Math.min(width / contentWidth, height / contentHeight)))
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    animateCamera({
      scale,
      x: -centerX * scale,
      y: -centerY * scale + (compact ? 24 : 8),
    }, animate)
  }, [animateCamera])

  const focusNode = useCallback((node: GraphNode) => {
    const nodes = [node]
    for (const id of layout.adjacency.get(node.id) ?? []) {
      if (!visibleIds.has(id)) continue
      const neighbor = layout.byId.get(id)
      if (neighbor) nodes.push(neighbor)
    }
    fitVisible(true, nodes, true)
  }, [fitVisible, layout, visibleIds])

  useLayoutEffect(() => {
    renderStateRef.current = { hoveredId, selectedId, visibleIds, visibleNodes }
    scheduleDraw()
  }, [hoveredId, scheduleDraw, selectedId, visibleIds, visibleNodes])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const width = Math.round(bounds.width)
      const height = Math.round(bounds.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = { width, height, dpr }
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      fitVisible(false)
      drawNow()
    }
    const observer = new ResizeObserver(resize)
    resize()
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      if (fitFrameRef.current) cancelAnimationFrame(fitFrameRef.current)
      frameRef.current = 0
      fitFrameRef.current = 0
    }
  }, [drawNow, fitVisible])

  useEffect(() => {
    fitVisible(true, visibleNodes)
  }, [fitVisible, visibleNodes])

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const bounds = canvas.getBoundingClientRect()
    const camera = cameraRef.current
    return {
      x: (clientX - bounds.left - bounds.width / 2 - camera.x) / camera.scale,
      y: (clientY - bounds.top - bounds.height / 2 - camera.y) / camera.scale,
    }
  }, [])

  const findNode = useCallback((clientX: number, clientY: number) => {
    const point = screenToWorld(clientX, clientY)
    const camera = cameraRef.current
    for (let index = visibleNodes.length - 1; index >= 0; index -= 1) {
      const node = visibleNodes[index]
      const hitRadius = Math.max(node.radius + 5 / camera.scale, 8 / camera.scale)
      if (Math.hypot(point.x - node.x, point.y - node.y) <= hitRadius) return node
    }
    return undefined
  }, [screenToWorld, visibleNodes])

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const node = findNode(event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      kind: node ? 'node' : 'pan',
      nodeId: node?.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node?.x ?? cameraRef.current.x,
      startY: node?.y ?? cameraRef.current.y,
      moved: false,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      setHoveredId(findNode(event.clientX, event.clientY)?.id)
      return
    }
    const deltaX = event.clientX - drag.startClientX
    const deltaY = event.clientY - drag.startClientY
    if (Math.hypot(deltaX, deltaY) > 3) drag.moved = true
    if (drag.kind === 'node' && drag.nodeId) {
      const node = layout.byId.get(drag.nodeId)
      if (node) {
        node.x = drag.startX + deltaX / cameraRef.current.scale
        node.y = drag.startY + deltaY / cameraRef.current.scale
      }
    } else {
      cameraRef.current.x = drag.startX + deltaX
      cameraRef.current.y = drag.startY + deltaY
    }
    scheduleDraw()
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.pointerId !== event.pointerId || drag.moved || !drag.nodeId) return
    const node = layout.byId.get(drag.nodeId)
    if (!node) return
    setSelectedId(node.id)
    focusNode(node)
  }

  const zoomAtCenter = (factor: number) => {
    cameraRef.current.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cameraRef.current.scale * factor))
    scheduleDraw()
  }

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const camera = cameraRef.current
    const before = screenToWorld(event.clientX, event.clientY)
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * bounds.height
        : event.deltaY
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, camera.scale * Math.exp(-delta * 0.0012)))
    camera.scale = nextScale
    camera.x = event.clientX - bounds.left - bounds.width / 2 - before.x * nextScale
    camera.y = event.clientY - bounds.top - bounds.height / 2 - before.y * nextScale
    scheduleDraw()
  }, [scheduleDraw, screenToWorld])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const focusArticle = (article: BlogArticle) => {
    const node = layout.byId.get(article.id)
    if (!node) return
    if (sectionFilter !== 'all' && article.sectionId !== sectionFilter) setSectionFilter('all')
    setSelectedId(article.id)
    setQuery('')
    focusNode(node)
  }

  const selectedNode = selectedId ? layout.byId.get(selectedId) : undefined
  const selectedArticle = selectedNode?.article
  const selectedConnections = selectedNode
    ? Array.from(layout.adjacency.get(selectedNode.id) ?? []).filter((id) => visibleIds.has(id)).length
    : 0
  const visibleWikilinks = blogGraph.wikilinkEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).length

  return (
    <main ref={pageRef} className="blog-page blog-graph" aria-label="Knowledge graph">
      <button className="blog-category__back" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span>
        Back to blog
      </button>

      <header className="blog-graph__heading">
        <div>
          <p>Obsidian knowledge archive</p>
          <h1>Knowledge Graph</h1>
        </div>
        <p>{visibleNodes.filter((node) => node.kind === 'article').length} notes · {visibleWikilinks} wikilinks</p>
      </header>

      <section className="blog-graph__frame" aria-labelledby="knowledge-map-title">
        <h2 className="sr-only" id="knowledge-map-title">Interactive knowledge map</h2>
        <div className="blog-graph__toolbar">
          <label className="blog-graph__search">
            <span className="sr-only">Search graph notes</span>
            <input
              type="search"
              value={query}
              placeholder="Find a note in the graph"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="blog-graph__filter">
            <span className="sr-only">Filter by knowledge section</span>
            <select
              value={sectionFilter}
              onChange={(event) => {
                setHoveredId(undefined)
                setSelectedId(undefined)
                setSectionFilter(event.target.value)
              }}
            >
              <option value="all">All knowledge</option>
              {blogSections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
          </label>
          <div className="blog-graph__zoom" aria-label="Graph zoom controls">
            <button type="button" aria-label="Zoom out" onClick={() => zoomAtCenter(0.82)}>−</button>
            <button type="button" onClick={() => fitVisible(true)}>Reset</button>
            <button type="button" aria-label="Zoom in" onClick={() => zoomAtCenter(1.22)}>+</button>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="blog-graph__results" aria-label="Graph search results">
            {searchResults.map((article) => (
              <button key={article.id} type="button" onClick={() => focusArticle(article)}>
                <span>{article.title}</span>
                <small>{getSection(article.sectionId)?.title}</small>
              </button>
            ))}
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`blog-graph__canvas${hoveredId ? ' is-node-hovered' : ''}`}
          aria-label="Knowledge graph. Drag nodes, drag empty space to pan, use the mouse wheel or controls to zoom, and select a note to focus its connections."
          role="img"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredId(undefined)}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { dragRef.current = null }}
        />

        <div className="blog-graph__legend" aria-label="Graph legend">
          <span><i className="is-directory" /> Directory</span>
          <span><i className="is-note" /> Note</span>
          <span><b className="is-directory-edge" /> Directory relation</span>
          <span><b className="is-wikilink-edge" /> Wikilink</span>
        </div>

        <p className="blog-graph__instructions">Select to focus · drag nodes · pan empty space · scroll to zoom</p>

        {selectedNode && (
          <aside className="blog-graph__selection" aria-live="polite">
            <span>{getSection(selectedNode.sectionId)?.title} · {selectedConnections} connections</span>
            <strong>{selectedNode.label}</strong>
            {selectedArticle
              ? <button type="button" onClick={() => onOpen(selectedArticle)}>Open note <span aria-hidden="true">↗</span></button>
              : <small>Directory cluster</small>}
          </aside>
        )}
      </section>
    </main>
  )
}
