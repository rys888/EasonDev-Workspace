import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from 'react'
import sourceSnapshots from '../data/sourceSnapshots.json'
import { projects } from '../data/projects'
import type { ProjectId, ProjectOverview, ReadmeBlock, ReadmeInline } from '../data/projects'

type Props = {
  backButtonRef: RefObject<HTMLButtonElement | null>
  interactive: boolean
  onBack: () => void
}

type SourceLanguage = 'java' | 'xml' | 'lua' | 'markdown'

type WorkspaceFile = {
  id: string
  projectId: ProjectId
  path: string
  name: string
  language: SourceLanguage
  content: string
  available: boolean
  githubUrl: string
  kind: 'readme' | 'source'
}

type SnapshotFile = Omit<WorkspaceFile, 'id' | 'kind'>
type TreeNode = { name: string; path: string; type: 'folder' | 'file'; file?: WorkspaceFile; children: TreeNode[] }
type TerminalLine = { id: number; type: 'command' | 'output' | 'error' | 'system'; text: string; directory?: string }
type ResizeAxis = 'explorer' | 'terminal'
type PanelSizes = { explorerWidth: number; terminalHeight: number }

const PANEL_SIZE_STORAGE_KEY = 'eason-room:idea-panel-sizes'
const EXPLORER_MIN_WIDTH = 190
const EXPLORER_MAX_WIDTH = 420
const EDITOR_MIN_WIDTH = 360
const TERMINAL_MIN_HEIGHT = 112
const TERMINAL_MAX_HEIGHT = 360
const EDITOR_MIN_HEIGHT = 200
const RESIZE_KEYBOARD_STEP = 12

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDefaultPanelSizes(): PanelSizes {
  if (typeof window === 'undefined') return { explorerWidth: 258, terminalHeight: 190 }
  if (window.innerWidth <= 700) return { explorerWidth: 258, terminalHeight: 190 }
  const compactDesktop = window.innerWidth <= 1050 && window.innerWidth > 700
  const explorerWidth = compactDesktop
    ? 208
    : clamp(Math.round(window.innerWidth * 0.19), 218, 276)
  const terminalHeight = window.innerWidth > 700 && window.innerHeight <= 700
    ? 137
    : clamp(Math.round(window.innerHeight * 0.22), 148, 202)
  const railWidth = compactDesktop ? 38 : 42

  return {
    explorerWidth: clamp(
      explorerWidth,
      EXPLORER_MIN_WIDTH,
      Math.max(EXPLORER_MIN_WIDTH, Math.min(EXPLORER_MAX_WIDTH, window.innerWidth - railWidth - EDITOR_MIN_WIDTH)),
    ),
    terminalHeight: clamp(
      terminalHeight,
      TERMINAL_MIN_HEIGHT,
      Math.max(TERMINAL_MIN_HEIGHT, Math.min(TERMINAL_MAX_HEIGHT, window.innerHeight - 72 - EDITOR_MIN_HEIGHT)),
    ),
  }
}

function getInitialPanelSizes(): PanelSizes {
  const defaults = getDefaultPanelSizes()
  if (typeof window === 'undefined') return defaults

  try {
    const stored = JSON.parse(window.localStorage.getItem(PANEL_SIZE_STORAGE_KEY) ?? '') as Partial<PanelSizes>
    return {
      explorerWidth: Number.isFinite(stored.explorerWidth)
        ? clamp(stored.explorerWidth as number, EXPLORER_MIN_WIDTH, EXPLORER_MAX_WIDTH)
        : defaults.explorerWidth,
      terminalHeight: Number.isFinite(stored.terminalHeight)
        ? clamp(stored.terminalHeight as number, TERMINAL_MIN_HEIGHT, TERMINAL_MAX_HEIGHT)
        : defaults.terminalHeight,
    }
  } catch {
    return defaults
  }
}

function getPanelBounds(workbench: HTMLDivElement, explorer: HTMLElement | null, axis: ResizeAxis) {
  const workbenchRect = workbench.getBoundingClientRect()
  if (axis === 'explorer') {
    const explorerStart = explorer
      ? explorer.getBoundingClientRect().left - workbenchRect.left
      : 42
    return {
      min: EXPLORER_MIN_WIDTH,
      max: Math.max(
        EXPLORER_MIN_WIDTH,
        Math.min(EXPLORER_MAX_WIDTH, workbenchRect.width - explorerStart - EDITOR_MIN_WIDTH),
      ),
    }
  }

  return {
    min: TERMINAL_MIN_HEIGHT,
    max: Math.max(
      TERMINAL_MIN_HEIGHT,
      Math.min(TERMINAL_MAX_HEIGHT, workbenchRect.height - EDITOR_MIN_HEIGHT),
    ),
  }
}

const snapshots = sourceSnapshots as SnapshotFile[]
const readmeFiles: WorkspaceFile[] = projects.map((project) => ({
  id: `${project.id}:README.md`,
  projectId: project.id,
  path: 'README.md',
  name: 'README.md',
  language: 'markdown',
  content: snapshots.find((file) => file.projectId === project.id && file.path === 'README.md')?.content ?? '',
  available: true,
  githubUrl: `https://github.com/${project.repository}/blob/${project.branch}/README.md`,
  kind: 'readme',
}))
const workspaceFiles: WorkspaceFile[] = [
  ...readmeFiles,
  ...snapshots.filter((file) => file.path !== 'README.md').map((file) => ({ ...file, id: `${file.projectId}:${file.path}`, kind: 'source' as const })),
]
const filesById = new Map(workspaceFiles.map((file) => [file.id, file]))
const initialTerminalLines: TerminalLine[] = [{
  id: 1,
  type: 'system',
  text: 'Eason Projects Console — read-only source snapshot. Type help to list commands.',
}]

function ChevronIcon({ expanded = false }: { expanded?: boolean }) {
  return <svg className={expanded ? 'is-expanded' : ''} viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
}

function FolderIcon({ open = false }: { open?: boolean }) {
  return <svg viewBox="0 0 18 16" aria-hidden="true"><path d={open ? 'M2 5h14l-1.4 8H3.4zM2.4 5V3h4l1.4 2' : 'M2 4h5l1.3 2H16v7H2z'} /></svg>
}

function FileIcon({ file }: { file: WorkspaceFile }) {
  const extension = file.name.split('.').at(-1)?.toLowerCase()
  const label = extension === 'java' ? 'J' : extension === 'xml' ? '<>' : extension === 'lua' ? 'Lu' : 'M↓'
  return <span className={`idea-file-icon idea-file-icon--${extension ?? 'file'}${file.available ? '' : ' is-linked'}`}>{label}</span>
}

function InlineContent({ content }: { content: ReadmeInline[] }) {
  return content.map((item, index) => {
    const node = item.code ? <code>{item.text}</code> : item.text
    return item.strong ? <strong key={`${item.text}-${index}`}>{node}</strong> : <Fragment key={`${item.text}-${index}`}>{node}</Fragment>
  })
}

function MarkdownBlock({ block }: { block: ReadmeBlock }) {
  if (block.type === 'heading') return block.level === 2 ? <h2>{block.text}</h2> : <h3>{block.text}</h3>
  if (block.type === 'paragraph') return <p><InlineContent content={block.content} /></p>
  if (block.type === 'quote') return <blockquote><InlineContent content={block.content} /></blockquote>
  if (block.type === 'list') return <ul>{block.items.map((item, index) => <li key={index}><InlineContent content={item} /></li>)}</ul>
  if (block.type === 'table') {
    return (
      <div className="idea-markdown-table-wrap"><table>
        <thead><tr>{block.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineContent content={cell} /></td>)}</tr>)}</tbody>
      </table></div>
    )
  }
  if (block.type === 'code') return <div className="idea-code-block"><span>{block.language}</span><pre><code>{block.code}</code></pre></div>
  return <figure className="idea-readme-image"><img src={block.src} alt={block.alt} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
}

function ReadmeDocument({ project }: { project: ProjectOverview }) {
  return (
    <article className="idea-markdown" aria-labelledby={`readme-title-${project.id}`}>
      <div className="idea-readme-path"><span>{project.id}</span><i>/</i><span>README.md</span></div>
      <h1 id={`readme-title-${project.id}`}>{project.name}</h1>
      <p className="idea-readme-subtitle">{project.subtitle}</p>
      {project.readme.map((block, index) => <MarkdownBlock key={`${block.type}-${index}`} block={block} />)}
    </article>
  )
}

const keywordPattern = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|record|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null|and|or|not|local|function|then|end|elseif)\b/
const codePattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*|--.*|\/\*.*|\*\/|@[A-Za-z_]\w*|\b\d+(?:\.\d+)?\b|\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|record|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null|and|or|not|local|function|then|end|elseif)\b)/g

function tokenClass(token: string) {
  if (token.startsWith('//') || token.startsWith('--') || token.startsWith('/*') || token === '*/') return 'comment'
  if (token.startsWith('"') || token.startsWith("'")) return 'string'
  if (token.startsWith('@')) return 'annotation'
  if (/^\d/.test(token)) return 'number'
  if (keywordPattern.test(token)) return 'keyword'
  return undefined
}

function highlightLine(line: string, language: SourceLanguage): ReactNode[] {
  if (language === 'xml') {
    return line.split(/(<!--.*?-->|<\/?[A-Za-z_:][^>]*>|&[A-Za-z]+;)/g).map((token, index) => {
      const className = token.startsWith('<!--') ? 'comment' : token.startsWith('<') ? 'tag' : token.startsWith('&') ? 'entity' : undefined
      return <span className={className} key={index}>{token}</span>
    })
  }
  return line.split(codePattern).filter(Boolean).map((token, index) => <span className={tokenClass(token)} key={index}>{token}</span>)
}

function SourceDocument({ file }: { file: WorkspaceFile }) {
  if (!file.available) {
    return (
      <div className="idea-source-unavailable">
        <span className="idea-source-unavailable__icon">↗</span>
        <div><h2>Source snapshot not included</h2><p><code>{file.path}</code> exists in the original repository, but its contents are not embedded in this portfolio snapshot.</p><a href={file.githubUrl} target="_blank" rel="noreferrer">View this file on GitHub</a></div>
      </div>
    )
  }
  const parts = file.path.split('/')
  const lines = file.content.replace(/\n$/, '').split('\n')
  return (
    <div className="idea-source" aria-label={`${file.name} source code`}>
      <div className="idea-source-breadcrumb">{parts.map((part, index) => <Fragment key={`${part}-${index}`}><span>{part}</span>{index < parts.length - 1 && <i>/</i>}</Fragment>)}</div>
      <pre className={`idea-source-code language-${file.language}`}><code>{lines.map((line, index) => (
        <span className="idea-code-line" key={index}><span className="idea-line-number" aria-hidden="true">{index + 1}</span><span className="idea-line-content">{highlightLine(line, file.language)}{'\n'}</span></span>
      ))}</code></pre>
    </div>
  )
}

function buildTree(projectId: ProjectId): TreeNode[] {
  const root: TreeNode[] = []
  for (const file of workspaceFiles.filter((item) => item.projectId === projectId)) {
    const parts = file.path.split('/')
    let level = root
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/')
      let node = level.find((item) => item.name === part)
      if (!node) {
        node = { name: part, path, type: index === parts.length - 1 ? 'file' : 'folder', children: [] }
        level.push(node)
      }
      if (index === parts.length - 1) node.file = file
      level = node.children
    })
  }
  const sort = (nodes: TreeNode[]) => nodes.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1).forEach((node) => sort(node.children))
  sort(root)
  return root
}

function normalizePath(base: string, target: string) {
  const raw = target.startsWith('/') ? target.replace(/^\/projects\/?/, '') : `${base}/${target}`
  const result: string[] = []
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') result.pop()
    else result.push(part)
  }
  return result.join('/')
}

function directoryLabel(directory: string) {
  return directory || 'eason-projects'
}

export function SourceProjectsWorkspace({ backButtonRef, interactive, onBack }: Props) {
  const [activeProjectId, setActiveProjectId] = useState<ProjectId>('yanyuetong')
  const [openFileIds, setOpenFileIds] = useState<string[]>(['yanyuetong:README.md'])
  const [activeFileId, setActiveFileId] = useState('yanyuetong:README.md')
  const [expandedProjects, setExpandedProjects] = useState<Record<ProjectId, boolean>>({ yanyuetong: true, caiyuntai: false })
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())
  const [terminalDirectory, setTerminalDirectory] = useState('')
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>(initialTerminalLines)
  const terminalBodyRef = useRef<HTMLDivElement>(null)
  const terminalInputRef = useRef<HTMLInputElement>(null)
  const workbenchRef = useRef<HTMLDivElement>(null)
  const explorerRef = useRef<HTMLElement>(null)
  const lineIdRef = useRef(initialTerminalLines.length + 1)
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(getInitialPanelSizes)
  const [resizeAxis, setResizeAxis] = useState<ResizeAxis | null>(null)
  const panelSizesRef = useRef(panelSizes)
  const resizeAxisRef = useRef<ResizeAxis | null>(null)
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  const activeFile = filesById.get(activeFileId) ?? readmeFiles[0]
  const openFiles = openFileIds.map((id) => filesById.get(id)).filter((file): file is WorkspaceFile => Boolean(file))
  const trees = useMemo(() => Object.fromEntries(projects.map((project) => [project.id, buildTree(project.id)])) as Record<ProjectId, TreeNode[]>, [])
  const directoryPaths = useMemo(() => {
    const paths = new Set<string>([''])
    projects.forEach((project) => paths.add(project.id))
    workspaceFiles.forEach((file) => {
      const parts = `${file.projectId}/${file.path}`.split('/')
      for (let index = 1; index < parts.length; index += 1) paths.add(parts.slice(0, index).join('/'))
    })
    return paths
  }, [])

  useEffect(() => { if (terminalBodyRef.current) terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight }, [terminalLines])

  useEffect(() => {
    panelSizesRef.current = panelSizes
    try {
      window.localStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(panelSizes))
    } catch {
      // The live component state still preserves sizes when storage is unavailable.
    }
  }, [panelSizes])

  useEffect(() => {
    const workbench = workbenchRef.current
    if (!workbench || typeof ResizeObserver === 'undefined') return

    const reconcilePanelSizes = () => {
      if (window.matchMedia('(max-width: 700px)').matches) return
      const explorerBounds = getPanelBounds(workbench, explorerRef.current, 'explorer')
      const terminalBounds = getPanelBounds(workbench, explorerRef.current, 'terminal')
      const current = panelSizesRef.current
      const next = {
        explorerWidth: clamp(current.explorerWidth, explorerBounds.min, explorerBounds.max),
        terminalHeight: clamp(current.terminalHeight, terminalBounds.min, terminalBounds.max),
      }
      workbench.style.setProperty('--idea-explorer-width', `${next.explorerWidth}px`)
      workbench.style.setProperty('--idea-terminal-height', `${next.terminalHeight}px`)
      panelSizesRef.current = next
      if (next.explorerWidth !== current.explorerWidth || next.terminalHeight !== current.terminalHeight) {
        setPanelSizes(next)
      }
    }

    const observer = new ResizeObserver(reconcilePanelSizes)
    observer.observe(workbench)
    reconcilePanelSizes()
    return () => observer.disconnect()
  }, [])

  const applyPanelSize = (axis: ResizeAxis, value: number) => {
    const workbench = workbenchRef.current
    if (!workbench) return panelSizesRef.current
    const bounds = getPanelBounds(workbench, explorerRef.current, axis)
    const nextValue = Math.round(clamp(value, bounds.min, bounds.max))
    const next = axis === 'explorer'
      ? { ...panelSizesRef.current, explorerWidth: nextValue }
      : { ...panelSizesRef.current, terminalHeight: nextValue }
    const property = axis === 'explorer' ? '--idea-explorer-width' : '--idea-terminal-height'
    workbench.style.setProperty(property, `${nextValue}px`)
    panelSizesRef.current = next
    return next
  }

  const resizeFromPointer = (axis: ResizeAxis, event: ReactPointerEvent<HTMLDivElement>) => {
    const workbench = workbenchRef.current
    if (!workbench || resizeAxisRef.current !== axis) return
    const value = axis === 'explorer'
      ? event.clientX - (explorerRef.current?.getBoundingClientRect().left ?? workbench.getBoundingClientRect().left)
      : workbench.getBoundingClientRect().bottom - event.clientY
    const next = applyPanelSize(axis, value)
    event.currentTarget.setAttribute(
      'aria-valuenow',
      String(axis === 'explorer' ? next.explorerWidth : next.terminalHeight),
    )
  }

  const beginResize = (axis: ResizeAxis, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || window.matchMedia('(max-width: 700px)').matches) return
    event.preventDefault()
    resizeAxisRef.current = axis
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizeAxis(axis)
  }

  const finishResize = (axis: ResizeAxis, event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeAxisRef.current !== axis) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resizeAxisRef.current = null
    setResizeAxis(null)
    setPanelSizes({ ...panelSizesRef.current })
  }

  const resizeFromKeyboard = (axis: ResizeAxis, event: ReactKeyboardEvent<HTMLDivElement>) => {
    const workbench = workbenchRef.current
    if (!workbench) return
    const bounds = getPanelBounds(workbench, explorerRef.current, axis)
    const current = axis === 'explorer'
      ? panelSizesRef.current.explorerWidth
      : panelSizesRef.current.terminalHeight
    let nextValue: number | undefined

    if (event.key === 'Home') nextValue = bounds.min
    else if (event.key === 'End') nextValue = bounds.max
    else if (axis === 'explorer' && event.key === 'ArrowLeft') nextValue = current - RESIZE_KEYBOARD_STEP
    else if (axis === 'explorer' && event.key === 'ArrowRight') nextValue = current + RESIZE_KEYBOARD_STEP
    else if (axis === 'terminal' && event.key === 'ArrowUp') nextValue = current + RESIZE_KEYBOARD_STEP
    else if (axis === 'terminal' && event.key === 'ArrowDown') nextValue = current - RESIZE_KEYBOARD_STEP

    if (nextValue === undefined) return
    event.preventDefault()
    const next = applyPanelSize(axis, nextValue)
    setPanelSizes({ ...next })
  }

  const appendTerminalLines = (lines: Omit<TerminalLine, 'id'>[]) => {
    setTerminalLines((current) => [...current, ...lines.map((line) => ({ ...line, id: lineIdRef.current++ }))])
  }

  const openFile = (file: WorkspaceFile, syncDirectory = false) => {
    setActiveProjectId(file.projectId)
    setExpandedProjects((current) => ({ ...current, [file.projectId]: true }))
    setExpandedFolders((current) => {
      const next = new Set(current)
      const parts = file.path.split('/').slice(0, -1)
      parts.forEach((_, index) => next.add(`${file.projectId}:${parts.slice(0, index + 1).join('/')}`))
      return next
    })
    setOpenFileIds((current) => current.includes(file.id) ? current : [...current, file.id])
    setActiveFileId(file.id)
    if (syncDirectory) {
      const parent = file.path.split('/').slice(0, -1).join('/')
      setTerminalDirectory(parent ? `${file.projectId}/${parent}` : file.projectId)
    }
  }

  const openProject = (projectId: ProjectId, syncDirectory = true) => {
    const readme = filesById.get(`${projectId}:README.md`)
    if (readme) openFile(readme)
    if (syncDirectory) setTerminalDirectory(projectId)
  }

  const closeTab = (fileId: string) => {
    const remaining = openFileIds.filter((id) => id !== fileId)
    if (!remaining.length) {
      const fallbackId = `${activeProjectId}:README.md`
      setOpenFileIds([fallbackId])
      setActiveFileId(fallbackId)
      return
    }
    setOpenFileIds(remaining)
    if (fileId === activeFileId) {
      const fallback = filesById.get(remaining.at(-1) ?? '') ?? readmeFiles[0]
      setActiveFileId(fallback.id)
      setActiveProjectId(fallback.projectId)
    }
  }

  const toggleFolder = (key: string) => setExpandedFolders((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const renderTreeNodes = (projectId: ProjectId, nodes: TreeNode[], depth = 0): ReactNode => nodes.map((node) => {
    const key = `${projectId}:${node.path}`
    const depthStyle = { '--tree-depth': depth } as CSSProperties
    if (node.type === 'folder') {
      const expanded = expandedFolders.has(key)
      return <Fragment key={key}><button className="idea-tree-file idea-tree-folder" type="button" role="treeitem" style={depthStyle} aria-expanded={expanded} onClick={() => toggleFolder(key)}><ChevronIcon expanded={expanded} /><FolderIcon open={expanded} /><span>{node.name}</span></button>{expanded && <div role="group">{renderTreeNodes(projectId, node.children, depth + 1)}</div>}</Fragment>
    }
    if (!node.file) return null
    return <button className={`idea-tree-file${activeFile.id === node.file.id ? ' is-open' : ''}${node.file.available ? '' : ' is-reference'}`} type="button" role="treeitem" style={depthStyle} onClick={() => openFile(node.file as WorkspaceFile)} key={key} title={node.file.available ? node.file.path : `${node.file.path} — GitHub reference only`}><FileIcon file={node.file} /><span>{node.name}</span>{!node.file.available && <small>↗</small>}</button>
  })

  const runTerminalCommand = (rawCommand: string) => {
    const commandLine = rawCommand.trim()
    if (!commandLine) return
    const [rawName, ...args] = commandLine.split(/\s+/)
    const command = rawName.toLowerCase()
    const target = args.join(' ').replace(/^['"]|['"]$/g, '')
    if (command === 'clear') { setTerminalLines([]); return }
    const output: Omit<TerminalLine, 'id'>[] = [{ type: 'command', text: commandLine, directory: terminalDirectory }]
    const resolved = normalizePath(terminalDirectory, target || '.')
    const relativeProjectPath = (file: WorkspaceFile) => `${file.projectId}/${file.path}`
    const targetFile = workspaceFiles.find((file) => relativeProjectPath(file) === resolved)

    if (command === 'help') output.push({ type: 'output', text: 'Available: ls [path]  cd <path>  pwd  cat <file>  open <file>  help  clear' })
    else if (command === 'pwd') output.push({ type: 'output', text: `/projects${terminalDirectory ? `/${terminalDirectory}` : ''}` })
    else if (command === 'ls') {
      if (!directoryPaths.has(resolved)) output.push({ type: 'error', text: `ls: no such directory: ${target || '.'}` })
      else {
        const prefix = resolved ? `${resolved}/` : ''
        const names = new Map<string, boolean>()
        directoryPaths.forEach((directory) => {
          if (directory.startsWith(prefix) && directory !== resolved) {
            const rest = directory.slice(prefix.length)
            if (rest && !rest.includes('/')) names.set(rest, true)
          }
        })
        workspaceFiles.forEach((file) => {
          const fullPath = relativeProjectPath(file)
          if (fullPath.startsWith(prefix)) {
            const rest = fullPath.slice(prefix.length)
            if (rest && !rest.includes('/')) names.set(rest, false)
          }
        })
        output.push({ type: 'output', text: [...names.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, folder]) => `${name}${folder ? '/' : ''}`).join('    ') || '(empty)' })
      }
    } else if (command === 'cd') {
      const destination = !target || target === '~' || target === '/projects' ? '' : resolved
      if (directoryPaths.has(destination)) {
        setTerminalDirectory(destination)
        const projectId = destination.split('/')[0] as ProjectId
        if (projects.some((project) => project.id === projectId)) setActiveProjectId(projectId)
      } else output.push({ type: 'error', text: `cd: no such directory: ${target}` })
    } else if (command === 'cat') {
      if (!target) output.push({ type: 'error', text: 'cat: missing file path' })
      else if (!targetFile) output.push({ type: 'error', text: `cat: no such file: ${target}` })
      else if (!targetFile.available) output.push({ type: 'error', text: `cat: snapshot text unavailable; use open ${target}` })
      else output.push({ type: 'output', text: targetFile.content })
    } else if (command === 'open') {
      if (!target) output.push({ type: 'error', text: 'open: missing file path' })
      else if (!targetFile) output.push({ type: 'error', text: `open: no such file: ${target}` })
      else { openFile(targetFile, true); output.push({ type: 'output', text: `Opening ${resolved} …` }) }
    } else output.push({ type: 'error', text: `zsh: command not found: ${rawName}. Type help.` })
    appendTerminalLines(output)
  }

  const handleTerminalSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); runTerminalCommand(terminalInput); setTerminalInput('') }

  return (
    <section className="projects-view" data-project={activeProject.id} aria-hidden={!interactive} inert={!interactive} aria-label="IntelliJ IDEA Projects workspace">
      <div className="idea-window">
        <header className="idea-macos-bar" aria-label="Application menu">
          <div className="idea-macos-menu"><svg className="idea-apple" viewBox="0 0 18 20" aria-hidden="true"><path d="M12.7 10.4c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-1-3.3-.9C2.4 4.8.9 5.8 0 7.4c-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8s2.3-1.2 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-3.1-1.2-3.1-4.4ZM10.2 3.2c.7-.9 1.2-2.1 1.1-3.2-1.1 0-2.4.7-3.1 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.4-.6 3.1-1.5Z" /></svg><strong>IntelliJ IDEA</strong><span>File</span><span>Edit</span><span>View</span><span>Navigate</span><span>Code</span><span>Refactor</span><span>Build</span><span>Run</span><span>Tools</span><span>Git</span><span>Window</span><span>Help</span></div>
          <div className="idea-system-status" aria-hidden="true"><span>◉</span><span>⌁</span><span>▰</span><time>Sun Oct 11</time></div>
        </header>
        <div className="idea-toolbar">
          <div className="idea-window-controls"><button className="idea-window-close" type="button" onClick={onBack} disabled={!interactive} aria-label="Close IntelliJ IDEA and return to room" title="Close and return to room" /><span aria-hidden="true" /><span aria-hidden="true" /></div>
          <div className="idea-project-context"><span className="idea-product-mark">IJ</span><strong>eason-projects</strong><ChevronIcon expanded /><span className="idea-branch">⑂ {activeProject.branch}</span></div>
          <div className="idea-toolbar-actions"><span aria-hidden="true">⌕</span><span aria-hidden="true">⚙</span><span aria-hidden="true">▷</span><button ref={backButtonRef} className="idea-back-button" type="button" onClick={onBack} disabled={!interactive}><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M10.8 4.2 6 9l4.8 4.8M6.4 9H14" /></svg>Back to room</button></div>
        </div>
        <div
          ref={workbenchRef}
          className="idea-workbench"
          data-resizing={resizeAxis ?? undefined}
          style={{
            '--idea-explorer-width': `${panelSizes.explorerWidth}px`,
            '--idea-terminal-height': `${panelSizes.terminalHeight}px`,
          } as CSSProperties}
        >
          <nav className="idea-tool-rail" aria-label="Tool windows"><button className="is-active" type="button" aria-label="Project tool window"><span>▣</span><b>Project</b></button><button type="button" disabled aria-label="Structure"><span>⌘</span></button><button type="button" disabled aria-label="Database"><span>◫</span></button><i /><button type="button" disabled aria-label="More tools"><span>···</span></button></nav>
          <aside ref={explorerRef} className="idea-explorer" id="idea-project-explorer" aria-label="Project Explorer">
            <header className="idea-tool-window-header"><strong>Project</strong><span aria-hidden="true">⌄</span><i /><small>{workspaceFiles.filter((file) => file.available).length} snapshots</small></header>
            <div className="idea-tree" role="tree" aria-label="Backend source files">
              <div className="idea-tree-root" role="treeitem" aria-expanded="true"><ChevronIcon expanded /><FolderIcon open /><strong>eason-projects</strong><small>~/projects</small></div>
              <div role="group">{projects.map((project) => {
                const expanded = expandedProjects[project.id]
                const selected = activeProject.id === project.id
                return <div className="idea-tree-project" key={project.id}><div className={`idea-tree-project-row${selected ? ' is-selected' : ''}`}><button className="idea-tree-disclosure" type="button" onClick={() => setExpandedProjects((current) => ({ ...current, [project.id]: !current[project.id] }))} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${project.id}`} aria-expanded={expanded}><ChevronIcon expanded={expanded} /></button><button className="idea-tree-project-button" type="button" onClick={() => openProject(project.id)} aria-current={selected ? 'page' : undefined}><FolderIcon open={expanded} /><span>{project.id}</span><small>{project.name}</small></button></div>{expanded && <div className="idea-tree-files" role="group">{renderTreeNodes(project.id, trees[project.id])}</div>}</div>
              })}</div>
              <div className="idea-tree-library" role="treeitem"><ChevronIcon /><span>▤</span>External Libraries</div><div className="idea-tree-library" role="treeitem"><ChevronIcon /><span>◉</span>Scratches and Consoles</div>
            </div>
          </aside>
          <div
            className="idea-panel-resizer idea-panel-resizer--vertical"
            role="separator"
            tabIndex={interactive ? 0 : -1}
            aria-label="Resize Project Explorer"
            aria-orientation="vertical"
            aria-controls="idea-project-explorer idea-project-editor"
            aria-valuemin={EXPLORER_MIN_WIDTH}
            aria-valuemax={EXPLORER_MAX_WIDTH}
            aria-valuenow={panelSizes.explorerWidth}
            aria-disabled={!interactive}
            onPointerDown={(event) => beginResize('explorer', event)}
            onPointerMove={(event) => resizeFromPointer('explorer', event)}
            onPointerUp={(event) => finishResize('explorer', event)}
            onPointerCancel={(event) => finishResize('explorer', event)}
            onKeyDown={(event) => resizeFromKeyboard('explorer', event)}
          />
          <main className="idea-editor" id="idea-project-editor">
            <div className="idea-editor-tabs" role="tablist" aria-label="Open files">{openFiles.map((file) => <button className={`idea-editor-tab${activeFile.id === file.id ? ' is-active' : ''}`} type="button" role="tab" aria-selected={activeFile.id === file.id} onClick={() => openFile(file)} key={file.id}><FileIcon file={file} /><span>{file.name}</span><small>{file.projectId}</small><i role="button" tabIndex={0} aria-label={`Close ${file.name}`} onClick={(event) => { event.stopPropagation(); closeTab(file.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); closeTab(file.id) } }}>×</i></button>)}<span className="idea-editor-spacer" /><span aria-hidden="true">⌗</span><span aria-hidden="true">×</span></div>
            <div className="idea-editor-scroll" key={activeFile.id}>{activeFile.kind === 'readme' ? <ReadmeDocument project={activeProject} /> : <SourceDocument file={activeFile} />}</div>
            <footer className="idea-editor-status" aria-label="Editor status"><span>{activeFile.path}</span><i /><span>LF</span><span>UTF-8</span><span>{activeFile.language === 'markdown' ? 'Markdown' : activeFile.language.toUpperCase()}</span><span>⑂ {activeProject.branch}</span></footer>
          </main>
          <div
            className="idea-panel-resizer idea-panel-resizer--horizontal"
            role="separator"
            tabIndex={interactive ? 0 : -1}
            aria-label="Resize Terminal"
            aria-orientation="horizontal"
            aria-controls="idea-project-editor idea-project-terminal"
            aria-valuemin={TERMINAL_MIN_HEIGHT}
            aria-valuemax={TERMINAL_MAX_HEIGHT}
            aria-valuenow={panelSizes.terminalHeight}
            aria-disabled={!interactive}
            onPointerDown={(event) => beginResize('terminal', event)}
            onPointerMove={(event) => resizeFromPointer('terminal', event)}
            onPointerUp={(event) => finishResize('terminal', event)}
            onPointerCancel={(event) => finishResize('terminal', event)}
            onKeyDown={(event) => resizeFromKeyboard('terminal', event)}
          />
          <section className="idea-terminal" id="idea-project-terminal" aria-label="Read-only simulated terminal">
            <header className="idea-terminal-header"><strong>Terminal</strong><button className="is-active" type="button">Local</button><span aria-hidden="true">×</span><span aria-hidden="true">＋</span><i /><small>read-only simulation</small></header>
            <div ref={terminalBodyRef} className="idea-terminal-body" role="log" aria-live="polite" onClick={() => terminalInputRef.current?.focus()}>
              {terminalLines.map((line) => line.type === 'command' ? <div className="idea-terminal-line" key={line.id}><span className="idea-terminal-user">eason@MacBook-Pro</span>{' '}<span className="idea-terminal-path">{directoryLabel(line.directory ?? '')}</span>{' '}<span className="idea-terminal-prompt">%</span> {line.text}</div> : <div className={`idea-terminal-line is-${line.type}`} key={line.id}>{line.text}</div>)}
              <form className="idea-terminal-command" onSubmit={handleTerminalSubmit}><label className="sr-only" htmlFor="idea-terminal-input">Terminal command</label><span className="idea-terminal-user">eason@MacBook-Pro</span>{' '}<span className="idea-terminal-path">{directoryLabel(terminalDirectory)}</span>{' '}<span className="idea-terminal-prompt">%</span><input ref={terminalInputRef} id="idea-terminal-input" value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} autoCapitalize="off" autoComplete="off" spellCheck={false} disabled={!interactive} aria-describedby="idea-terminal-hint" /></form>
              <span className="sr-only" id="idea-terminal-hint">Supported commands: ls, cd, pwd, cat, open, help, clear.</span>
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
