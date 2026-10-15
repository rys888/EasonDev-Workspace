import { Fragment, useEffect, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import { projects } from '../data/projects'
import type {
  ProjectFile,
  ProjectId,
  ProjectOverview,
  ReadmeBlock,
  ReadmeInline,
} from '../data/projects'

type ProjectsWorkspaceProps = {
  backButtonRef: RefObject<HTMLButtonElement | null>
  interactive: boolean
  onBack: () => void
}

type TerminalDirectory = 'root' | ProjectId

type TerminalLine = {
  id: number
  type: 'command' | 'output' | 'error' | 'system'
  text: string
  directory?: TerminalDirectory
}

const initialTerminalLines: TerminalLine[] = [
  {
    id: 1,
    type: 'system',
    text: 'Eason Projects Console — safe read-only session. Type help to list commands.',
  },
]

function ChevronIcon({ expanded = false }: { expanded?: boolean }) {
  return (
    <svg className={expanded ? 'is-expanded' : ''} viewBox="0 0 16 16" aria-hidden="true">
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  )
}

function FolderIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 18 16" aria-hidden="true">
      <path d={open ? 'M2 5h14l-1.4 8H3.4zM2.4 5V3h4l1.4 2' : 'M2 4h5l1.3 2H16v7H2z'} />
    </svg>
  )
}

function FileIcon({ file }: { file: ProjectFile }) {
  if (file.kind === 'markdown') {
    return <span className="idea-file-icon idea-file-icon--markdown">M↓</span>
  }

  if (file.kind === 'maven') {
    return <span className="idea-file-icon idea-file-icon--maven">m</span>
  }

  if (file.kind === 'config') {
    return <span className="idea-file-icon idea-file-icon--config">⌁</span>
  }

  return <FolderIcon />
}

function InlineContent({ content }: { content: ReadmeInline[] }) {
  return content.map((item, index) => {
    const node = item.code ? <code>{item.text}</code> : item.text
    return item.strong
      ? <strong key={`${item.text}-${index}`}>{node}</strong>
      : <Fragment key={`${item.text}-${index}`}>{node}</Fragment>
  })
}

function MarkdownBlock({ block }: { block: ReadmeBlock }) {
  if (block.type === 'heading') {
    return block.level === 2
      ? <h2>{block.text}</h2>
      : <h3>{block.text}</h3>
  }

  if (block.type === 'paragraph') {
    return <p><InlineContent content={block.content} /></p>
  }

  if (block.type === 'quote') {
    return <blockquote><InlineContent content={block.content} /></blockquote>
  }

  if (block.type === 'list') {
    return (
      <ul>
        {block.items.map((item, index) => (
          <li key={index}><InlineContent content={item} /></li>
        ))}
      </ul>
    )
  }

  if (block.type === 'table') {
    return (
      <div className="idea-markdown-table-wrap">
        <table>
          <thead>
            <tr>{block.headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}><InlineContent content={cell} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (block.type === 'code') {
    return (
      <div className="idea-code-block">
        <span>{block.language}</span>
        <pre><code>{block.code}</code></pre>
      </div>
    )
  }

  return (
    <figure className="idea-readme-image">
      <img src={block.src} alt={block.alt} />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

function ReadmeDocument({ project }: { project: ProjectOverview }) {
  return (
    <article className="idea-markdown" aria-labelledby={`readme-title-${project.id}`}>
      <div className="idea-readme-path">
        <span>{project.id}</span>
        <i>/</i>
        <span>README.md</span>
      </div>
      <h1 id={`readme-title-${project.id}`}>{project.name}</h1>
      <p className="idea-readme-subtitle">{project.subtitle}</p>
      {project.readme.map((block, index) => (
        <MarkdownBlock key={`${block.type}-${index}`} block={block} />
      ))}
    </article>
  )
}

function directoryLabel(directory: TerminalDirectory) {
  return directory === 'root' ? 'eason-projects' : directory
}

export function ProjectsWorkspace({ backButtonRef, interactive, onBack }: ProjectsWorkspaceProps) {
  const [activeProjectId, setActiveProjectId] = useState<ProjectId>('yanyuetong')
  const [expandedProjects, setExpandedProjects] = useState<Record<ProjectId, boolean>>({
    yanyuetong: true,
    caiyuntai: false,
  })
  const [terminalDirectory, setTerminalDirectory] = useState<TerminalDirectory>('root')
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>(initialTerminalLines)
  const terminalBodyRef = useRef<HTMLDivElement>(null)
  const terminalInputRef = useRef<HTMLInputElement>(null)
  const lineIdRef = useRef(initialTerminalLines.length + 1)

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0]

  useEffect(() => {
    const body = terminalBodyRef.current
    if (body) {
      body.scrollTop = body.scrollHeight
    }
  }, [terminalLines])

  const appendTerminalLines = (lines: Omit<TerminalLine, 'id'>[]) => {
    setTerminalLines((current) => [
      ...current,
      ...lines.map((line) => ({ ...line, id: lineIdRef.current++ })),
    ])
  }

  const openProject = (projectId: ProjectId, syncDirectory = true) => {
    setActiveProjectId(projectId)
    setExpandedProjects((current) => ({ ...current, [projectId]: true }))
    if (syncDirectory) {
      setTerminalDirectory(projectId)
    }
  }

  const toggleProject = (projectId: ProjectId) => {
    setExpandedProjects((current) => ({ ...current, [projectId]: !current[projectId] }))
  }

  const runTerminalCommand = (rawCommand: string) => {
    const commandLine = rawCommand.trim()
    if (!commandLine) {
      return
    }

    const [rawName, ...args] = commandLine.split(/\s+/)
    const command = rawName.toLowerCase()
    const target = args.join(' ').replace(/^['"]|['"]$/g, '')
    const commandEntry: Omit<TerminalLine, 'id'> = {
      type: 'command',
      text: commandLine,
      directory: terminalDirectory,
    }

    if (command === 'clear') {
      setTerminalLines([])
      return
    }

    const output: Omit<TerminalLine, 'id'>[] = [commandEntry]

    if (command === 'help') {
      output.push({
        type: 'output',
        text: 'Available: ls  cd <project|..>  open <project|README.md>  help  clear',
      })
    } else if (command === 'ls') {
      const names = terminalDirectory === 'root'
        ? projects.map((project) => `${project.id}/`).join('    ')
        : (projects.find((project) => project.id === terminalDirectory)?.rootFiles ?? [])
            .map((file) => file.kind === 'folder' ? `${file.name}/` : file.name)
            .join('    ')
      output.push({ type: 'output', text: names })
    } else if (command === 'cd') {
      if (!target || target === '~' || target === '~/projects' || target === '/projects') {
        setTerminalDirectory('root')
      } else if (target === '..') {
        setTerminalDirectory('root')
      } else {
        const project = projects.find((item) => item.id === target.replace(/\/$/, ''))
        if (project) {
          openProject(project.id, true)
        } else {
          output.push({ type: 'error', text: `cd: no such directory: ${target}` })
        }
      }
    } else if (command === 'open') {
      const normalizedTarget = target.replace(/^\.\//, '').replace(/\/$/, '')
      const directProject = projects.find((item) => (
        normalizedTarget === item.id ||
        normalizedTarget === `${item.id}/README.md`
      ))
      const currentProject = terminalDirectory === 'root'
        ? undefined
        : projects.find((item) => item.id === terminalDirectory)
      const project = directProject ?? (normalizedTarget === 'README.md' ? currentProject : undefined)

      if (project) {
        openProject(project.id, true)
        output.push({ type: 'output', text: `Opening ${project.id}/README.md …` })
      } else if (!target) {
        output.push({ type: 'error', text: 'open: missing project or README.md' })
      } else {
        output.push({ type: 'error', text: `open: ${target}: README preview unavailable` })
      }
    } else {
      output.push({ type: 'error', text: `zsh: command not found: ${rawName}. Type help.` })
    }

    appendTerminalLines(output)
  }

  const handleTerminalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runTerminalCommand(terminalInput)
    setTerminalInput('')
  }

  return (
    <section
      className="projects-view"
      data-project={activeProject.id}
      aria-hidden={!interactive}
      inert={!interactive}
      aria-label="IntelliJ IDEA Projects workspace"
    >
      <div className="idea-window">
        <header className="idea-macos-bar" aria-label="Application menu">
          <div className="idea-macos-menu">
            <svg className="idea-apple" viewBox="0 0 18 20" aria-hidden="true">
              <path d="M12.7 10.4c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-1-3.3-.9C2.4 4.8.9 5.8 0 7.4c-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8s2.3-1.2 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-3.1-1.2-3.1-4.4ZM10.2 3.2c.7-.9 1.2-2.1 1.1-3.2-1.1 0-2.4.7-3.1 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.4-.6 3.1-1.5Z" />
            </svg>
            <strong>IntelliJ IDEA</strong>
            <span>File</span><span>Edit</span><span>View</span><span>Navigate</span>
            <span>Code</span><span>Refactor</span><span>Build</span><span>Run</span>
            <span>Tools</span><span>Git</span><span>Window</span><span>Help</span>
          </div>
          <div className="idea-system-status" aria-hidden="true">
            <span>◉</span><span>⌁</span><span>▰</span><time>Sun Oct 11</time>
          </div>
        </header>

        <div className="idea-toolbar">
          <div className="idea-window-controls">
            <button
              className="idea-window-close"
              type="button"
              onClick={onBack}
              disabled={!interactive}
              aria-label="Close IntelliJ IDEA and return to room"
              title="Close and return to room"
            />
            <span aria-hidden="true" /><span aria-hidden="true" />
          </div>
          <div className="idea-project-context">
            <span className="idea-product-mark">IJ</span>
            <strong>eason-projects</strong>
            <ChevronIcon expanded />
            <span className="idea-branch">⑂ {activeProject.branch}</span>
          </div>
          <div className="idea-toolbar-actions">
            <span aria-hidden="true">⌕</span><span aria-hidden="true">⚙</span><span aria-hidden="true">▷</span>
            <button
              ref={backButtonRef}
              className="idea-back-button"
              type="button"
              onClick={onBack}
              disabled={!interactive}
            >
              <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M10.8 4.2 6 9l4.8 4.8M6.4 9H14" /></svg>
              Back to room
            </button>
          </div>
        </div>

        <div className="idea-workbench">
          <nav className="idea-tool-rail" aria-label="Tool windows">
            <button className="is-active" type="button" aria-label="Project tool window">
              <span>▣</span><b>Project</b>
            </button>
            <button type="button" disabled aria-label="Structure available in Phase 3.3"><span>⌘</span></button>
            <button type="button" disabled aria-label="Database available in Phase 3.3"><span>◫</span></button>
            <i />
            <button type="button" disabled aria-label="More tools available later"><span>···</span></button>
          </nav>

          <aside className="idea-explorer" aria-label="Project Explorer">
            <header className="idea-tool-window-header">
              <strong>Project</strong>
              <span aria-hidden="true">⌄</span>
              <i />
              <button type="button" disabled aria-label="Project tree options">⌘</button>
            </header>
            <div className="idea-tree" role="tree" aria-label="Project files">
              <div className="idea-tree-root" role="treeitem" aria-expanded="true">
                <ChevronIcon expanded />
                <FolderIcon open />
                <strong>eason-projects</strong>
                <small>~/projects</small>
              </div>
              <div role="group">
                {projects.map((project) => {
                  const expanded = expandedProjects[project.id]
                  const selected = activeProject.id === project.id
                  return (
                    <div className="idea-tree-project" key={project.id}>
                      <div className={`idea-tree-project-row${selected ? ' is-selected' : ''}`}>
                        <button
                          className="idea-tree-disclosure"
                          type="button"
                          onClick={() => toggleProject(project.id)}
                          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${project.id}`}
                          aria-expanded={expanded}
                        >
                          <ChevronIcon expanded={expanded} />
                        </button>
                        <button
                          className="idea-tree-project-button"
                          type="button"
                          onClick={() => openProject(project.id)}
                          aria-current={selected ? 'page' : undefined}
                        >
                          <FolderIcon open={expanded} />
                          <span>{project.id}</span>
                          <small>{project.name}</small>
                        </button>
                      </div>
                      {expanded && (
                        <div className="idea-tree-files" role="group">
                          {project.rootFiles.map((file) => {
                            const isReadme = file.name === 'README.md'
                            return isReadme ? (
                              <button
                                key={file.name}
                                className={`idea-tree-file${selected ? ' is-open' : ''}`}
                                type="button"
                                role="treeitem"
                                onClick={() => openProject(project.id)}
                              >
                                <FileIcon file={file} /><span>{file.name}</span>
                              </button>
                            ) : (
                              <div className="idea-tree-file" role="treeitem" key={file.name}>
                                <FileIcon file={file} /><span>{file.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="idea-tree-library" role="treeitem"><ChevronIcon /><span>▤</span>External Libraries</div>
              <div className="idea-tree-library" role="treeitem"><ChevronIcon /><span>◉</span>Scratches and Consoles</div>
            </div>
          </aside>

          <main className="idea-editor">
            <div className="idea-editor-tabs" role="tablist" aria-label="Open files">
              <div className="idea-editor-tab is-active" role="tab" aria-selected="true">
                <span className="idea-file-icon idea-file-icon--markdown">M↓</span>
                <span>README.md</span>
                <small>{activeProject.id}</small>
                <i aria-hidden="true">×</i>
              </div>
              <span className="idea-editor-spacer" />
              <span aria-hidden="true">⌗</span><span aria-hidden="true">×</span>
            </div>
            <div className="idea-editor-scroll" key={activeProject.id}>
              <ReadmeDocument project={activeProject} />
            </div>
            <footer className="idea-editor-status" aria-label="Editor status">
              <span>README.md</span><i /><span>LF</span><span>UTF-8</span><span>Markdown</span><span>⑂ {activeProject.branch}</span>
            </footer>
          </main>

          <section className="idea-terminal" aria-label="Read-only simulated terminal">
            <header className="idea-terminal-header">
              <strong>Terminal</strong>
              <button className="is-active" type="button">Local</button>
              <span aria-hidden="true">×</span><span aria-hidden="true">＋</span><i />
              <small>read-only simulation</small>
            </header>
            <div
              ref={terminalBodyRef}
              className="idea-terminal-body"
              role="log"
              aria-live="polite"
              onClick={() => terminalInputRef.current?.focus()}
            >
              {terminalLines.map((line) => line.type === 'command' ? (
                <div className="idea-terminal-line" key={line.id}>
                  <span className="idea-terminal-user">eason@MacBook-Pro</span>{' '}
                  <span className="idea-terminal-path">{directoryLabel(line.directory ?? 'root')}</span>{' '}
                  <span className="idea-terminal-prompt">%</span> {line.text}
                </div>
              ) : (
                <div className={`idea-terminal-line is-${line.type}`} key={line.id}>{line.text}</div>
              ))}
              <form className="idea-terminal-command" onSubmit={handleTerminalSubmit}>
                <label className="sr-only" htmlFor="idea-terminal-input">Terminal command</label>
                <span className="idea-terminal-user">eason@MacBook-Pro</span>{' '}
                <span className="idea-terminal-path">{directoryLabel(terminalDirectory)}</span>{' '}
                <span className="idea-terminal-prompt">%</span>
                <input
                  ref={terminalInputRef}
                  id="idea-terminal-input"
                  value={terminalInput}
                  onChange={(event) => setTerminalInput(event.target.value)}
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!interactive}
                  aria-describedby="idea-terminal-hint"
                />
              </form>
              <span className="sr-only" id="idea-terminal-hint">Supported commands: ls, cd, open, help, clear.</span>
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
