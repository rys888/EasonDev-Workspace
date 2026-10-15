import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Element, Nodes, Root } from 'hast'
import type { Plugin } from 'unified'
import 'katex/dist/katex.min.css'
import type { BlogArticle } from '../data/blogContent'
import { getSection } from '../data/blogContent'
import { RelatedKnowledge } from './RelatedKnowledge'

type Heading = {
  depth: number
  text: string
  id: string
}

type ArticlePayload = {
  schemaVersion: number
  id: string
  sourcePath: string
  documentTitle: string
  markdown: string
  headings: Heading[]
  wordCount: number
  readingMinutes: number
}

type Props = {
  article: BlogArticle
  initialHeading?: string
  next?: BlogArticle
  pageRef: RefObject<HTMLElement | null>
  previous?: BlogArticle
  onBack: () => void
  onNavigate: (articleId: string, heading?: string) => void
}

const headingTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

function nodeText(node: Nodes): string {
  if (node.type === 'text') return node.value
  if ('children' in node) return node.children.map(nodeText).join('')
  return ''
}

function slugHeading(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section'
}

const rehypeHeadingIds: Plugin<[], Root> = () => (tree) => {
  const counts = new Map<string, number>()

  const visit = (node: Nodes) => {
    if (node.type === 'element' && headingTags.has(node.tagName)) {
      const heading = node as Element
      const base = slugHeading(nodeText(heading))
      const count = (counts.get(base) ?? 0) + 1
      counts.set(base, count)
      heading.properties = {
        ...heading.properties,
        id: count === 1 ? base : `${base}-${count}`,
      }
    }
    if ('children' in node) node.children.forEach(visit)
  }

  visit(tree)
}

const rehypeObsidianLinkLineBreaks: Plugin<[], Root> = () => (tree) => {
  const visit = (node: Nodes) => {
    if (node.type === 'element' && node.tagName === 'p') {
      const paragraph = node as Element
      const lines: Element['children'][] = [[]]

      paragraph.children.forEach((child) => {
        if (child.type !== 'text' || !child.value.includes('\n')) {
          lines.at(-1)?.push(child)
          return
        }

        child.value.split('\n').forEach((part, index) => {
          if (index > 0) lines.push([])
          if (part) lines.at(-1)?.push({ type: 'text', value: part })
        })
      })

      const isLinkOnlyLine = (line: Element['children']) => {
        const meaningfulChildren = line.filter((child) => (
          child.type !== 'text' || child.value.trim().length > 0
        ))
        return meaningfulChildren.length === 1
          && meaningfulChildren[0].type === 'element'
          && meaningfulChildren[0].tagName === 'a'
      }

      if (lines.filter(isLinkOnlyLine).length > 1) {
        paragraph.children = lines.flatMap((line, index) => (
          index < lines.length - 1
            ? [...line, { type: 'element' as const, tagName: 'br', properties: {}, children: [] }]
            : line
        ))
      }
    }
    if ('children' in node) node.children.forEach(visit)
  }

  visit(tree)
}

function parseArticleHref(href: string) {
  const match = href.match(/^\/blog\/n\/([^#?]+)(?:#(.+))?$/)
  if (!match) return null
  return {
    articleId: decodeURIComponent(match[1]),
    heading: match[2] ? decodeURIComponent(match[2]) : undefined,
  }
}

function ReaderArrow({ direction }: { direction: 'left' | 'right' }) {
  return <span aria-hidden="true">{direction === 'left' ? '←' : '→'}</span>
}

function LoadingArticle() {
  return (
    <div className="blog-reader__loading" role="status">
      <span aria-hidden="true" />
      <p>Opening note…</p>
    </div>
  )
}

export function BlogReader({
  article,
  initialHeading,
  next,
  pageRef,
  previous,
  onBack,
  onNavigate,
}: Props) {
  const articleRef = useRef<HTMLElement>(null)
  const [payload, setPayload] = useState<ArticlePayload | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const [activeHeading, setActiveHeading] = useState('')
  const section = getSection(article.sectionId)

  useEffect(() => {
    const controller = new AbortController()

    fetch(article.contentPath, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Local article resource returned ${response.status}`)
        return response.json() as Promise<ArticlePayload>
      })
      .then((content) => {
        if (content.id !== article.id) throw new Error('Local article resource does not match its index entry')
        setPayload(content)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(error instanceof Error ? error.message : 'The local article resource could not be opened')
      })

    return () => controller.abort()
  }, [article.contentPath, article.id, retryCount])

  const tableOfContents = useMemo(
    () => payload?.headings.filter((heading) => heading.depth >= 2 && heading.depth <= 4) ?? [],
    [payload],
  )

  const scrollToHeading = useCallback((headingId: string, animated = true) => {
    const target = document.getElementById(headingId)
    if (!target) return
    const scrollRoot = target.closest<HTMLElement>('.blog-transition')
    if (!scrollRoot) return
    const targetTop = scrollRoot.scrollTop
      + target.getBoundingClientRect().top
      - scrollRoot.getBoundingClientRect().top
      - 24
    scrollRoot.scrollTo({
      top: targetTop,
      behavior: animated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto',
    })
    setActiveHeading(headingId)
  }, [])

  useEffect(() => {
    if (!payload || !initialHeading) return
    const frame = requestAnimationFrame(() => scrollToHeading(initialHeading))
    return () => cancelAnimationFrame(frame)
  }, [initialHeading, payload, scrollToHeading])

  useEffect(() => {
    const articleElement = articleRef.current
    const scrollRoot = articleElement?.closest<HTMLElement>('.blog-transition')
    if (!articleElement || !scrollRoot || !payload) return
    let frame = 0

    const update = () => {
      frame = 0
      const maximum = scrollRoot.scrollHeight - scrollRoot.clientHeight
      setProgress(maximum > 0 ? Math.min(1, Math.max(0, scrollRoot.scrollTop / maximum)) : 1)

      const rootTop = scrollRoot.getBoundingClientRect().top
      let current = tableOfContents[0]?.id ?? ''
      for (const heading of tableOfContents) {
        const element = document.getElementById(heading.id)
        if (element && element.getBoundingClientRect().top <= rootTop + 150) current = heading.id
        else if (element) break
      }
      setActiveHeading(current)
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    scrollRoot.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      scrollRoot.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [payload, tableOfContents])

  const handleLink = useCallback((event: ReactMouseEvent<HTMLAnchorElement>, href?: string) => {
    const resolvedHref = event.currentTarget.getAttribute('href') ?? href
    if (!resolvedHref) return
    const internal = parseArticleHref(resolvedHref)
    if (!internal) return
    event.preventDefault()
    if (internal.articleId === article.id && internal.heading) {
      window.setTimeout(() => scrollToHeading(internal.heading ?? ''), 0)
      return
    }
    onNavigate(internal.articleId, internal.heading)
  }, [article.id, onNavigate, scrollToHeading])

  const markdownComponents = useMemo(() => ({
    a: ({ href, children }: { href?: string; children?: ReactNode }) => {
      const external = Boolean(href && /^(?:https?:)?\/\//.test(href))
      const headingTarget = href?.startsWith('#') ? decodeURIComponent(href.slice(1)) : undefined
      return (
        <a
          href={href}
          onClick={(event) => {
            if (headingTarget) {
              event.preventDefault()
              scrollToHeading(headingTarget, false)
              return
            }
            handleLink(event, href)
          }}
          {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
        >
          {children}
        </a>
      )
    },
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      if (!src) return null
      const url = new URL(src, window.location.origin)
      const width = Number(url.searchParams.get('width'))
      return (
        <img
          src={`${url.pathname}${url.search}`}
          alt={alt ?? ''}
          loading="lazy"
          decoding="async"
          style={Number.isFinite(width) && width > 0 ? { maxWidth: `${width}px` } : undefined}
        />
      )
    },
    pre: ({ children }: { children?: ReactNode }) => <pre tabIndex={0}>{children}</pre>,
    table: ({ children }: { children?: ReactNode }) => (
      <div className="blog-prose__table" tabIndex={0}><table>{children}</table></div>
    ),
  }), [handleLink, scrollToHeading])

  const toc = tableOfContents.length > 0 ? (
    <nav className="blog-reader-toc" aria-label="Table of contents">
      <span>On this page</span>
      <ol>
        {tableOfContents.map((heading) => (
          <li key={heading.id} data-depth={heading.depth}>
            <button
              type="button"
              className={activeHeading === heading.id ? 'is-active' : ''}
              aria-current={activeHeading === heading.id ? 'location' : undefined}
              onClick={() => scrollToHeading(heading.id)}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  ) : null

  return (
    <main ref={pageRef} className="blog-page blog-reader" aria-label={`Reading ${article.title}`}>
      <div className="blog-reader__progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <button className="blog-reader__back" type="button" onClick={onBack}>
        <ReaderArrow direction="left" />
        Back to notes
      </button>

      <header className="blog-reader__hero">
        <p className="blog-reader__breadcrumb">
          <span>{section?.title}</span>
          {article.categoryPath.map((category, index) => (
            <span key={`${article.categoryPath.slice(0, index + 1).join('/')}-${index}`}>{category}</span>
          ))}
        </p>
        <h1>{payload?.documentTitle ?? article.title}</h1>
        <p className="blog-reader__summary">{article.summary}</p>
        <div className="blog-reader__meta" aria-label="Article information">
          <span>{payload ? `${payload.readingMinutes} min read` : 'Loading note'}</span>
          {payload && <span>{payload.wordCount.toLocaleString()} words</span>}
          {article.date && <time>{article.date}</time>}
        </div>
      </header>

      {toc && <details className="blog-reader-toc-mobile"><summary>On this page</summary>{toc}</details>}

      <div className="blog-reader__layout">
        <aside>{toc}</aside>
        <div className="blog-reader__paper">
          <article ref={articleRef} className="blog-prose" aria-busy={!payload && !loadError}>
            {!payload && !loadError && <LoadingArticle />}
            {loadError && (
              <div className="blog-reader__error" role="alert">
                <h2>This note could not be opened.</h2>
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoadError('')
                    setPayload(null)
                    setRetryCount((count) => count + 1)
                  }}
                >
                  Try again
                </button>
              </div>
            )}
            {payload && payload.markdown && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[
                  rehypeHeadingIds,
                  rehypeObsidianLinkLineBreaks,
                  rehypeKatex,
                  rehypeHighlight,
                ]}
                components={markdownComponents}
              >
                {payload.markdown}
              </ReactMarkdown>
            )}
            {payload && !payload.markdown && (
              <div className="blog-reader__empty">This note is intentionally empty.</div>
            )}
          </article>

          <RelatedKnowledge article={article} onNavigate={onNavigate} />

          <nav className="blog-reader__neighbors" aria-label="Adjacent notes">
            {previous ? (
              <button type="button" onClick={() => onNavigate(previous.id)}>
                <ReaderArrow direction="left" />
                <span><small>Previous note</small><strong>{previous.title}</strong></span>
              </button>
            ) : <span />}
            {next ? (
              <button type="button" onClick={() => onNavigate(next.id)}>
                <span><small>Next note</small><strong>{next.title}</strong></span>
                <ReaderArrow direction="right" />
              </button>
            ) : <span />}
          </nav>
        </div>
      </div>
    </main>
  )
}
