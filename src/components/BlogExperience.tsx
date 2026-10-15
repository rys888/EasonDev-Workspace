import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import {
  blogArticles,
  blogSections,
  getArticle,
  getArticleNeighbors,
  getBlogDirectory,
  getSection,
  getSectionArticles,
  selectedNotes,
} from '../data/blogContent'
import type { BlogArticle, BlogSectionId } from '../data/blogContent'

type Props = {
  backButtonRef: RefObject<HTMLButtonElement | null>
  interactive: boolean
  onBack: () => void
}

type BlogView =
  | { kind: 'home' }
  | { kind: 'category'; sectionId: BlogSectionId; directoryPath: string[] }
  | { kind: 'graph' }
  | { kind: 'article'; articleId: string; heading?: string }

type BlogIndexView = Extract<BlogView, { kind: 'home' | 'category' | 'graph' }>

const serif = '"Iowan Old Style", Baskerville, "Songti SC", "STSong", Georgia, serif'
const BlogReader = lazy(async () => {
  const module = await import('./BlogReader')
  return { default: module.BlogReader }
})
const KnowledgeGraph = lazy(async () => {
  const module = await import('./KnowledgeGraph')
  return { default: module.KnowledgeGraph }
})

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.7" cy="10.7" r="6.6" />
      <path d="m15.6 15.6 4.2 4.2" />
    </svg>
  )
}

function GraphIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="7" r="2.1" />
      <circle cx="17.5" cy="5.5" r="2.1" />
      <circle cx="12.5" cy="18" r="2.1" />
      <path d="m7.9 7 7.5-1M7.2 8.8l4.1 7.3m5-8.7-2.8 8.7" />
    </svg>
  )
}

function ArrowIcon({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return (
    <svg className={`blog-arrow blog-arrow--${direction}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function BotanicalMark() {
  return (
    <svg className="blog-brand__mark" viewBox="0 0 40 46" aria-hidden="true">
      <path d="M28 42C20 31 16 20 13 6" />
      <path d="M17 19C9 17 5 12 5 5c7 2 11 7 12 14Z" />
      <path d="M21 28c5-7 11-9 16-7-2 7-7 10-16 7Z" />
      <path d="M25 35c-7 0-12-3-14-9 7-1 12 2 14 9Z" />
    </svg>
  )
}

function ArticleButton({ article, index, onOpen }: {
  article: BlogArticle
  index: number
  onOpen: (article: BlogArticle) => void
}) {
  return (
    <button className="blog-note-row" type="button" onClick={() => onOpen(article)}>
      <span className="blog-note-row__index">{String(index + 1).padStart(2, '0')}</span>
      <span className="blog-chip">{article.tags?.[0] ?? article.categoryPath.at(-1)}</span>
      <span className="blog-note-row__copy">
        <strong>{article.title}</strong>
        <small>{article.summary}</small>
      </span>
      {article.date && <time>{article.date}</time>}
      <span className="blog-note-row__arrow" aria-hidden="true">↗</span>
    </button>
  )
}

export function BlogExperience({ backButtonRef, interactive, onBack }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLElement>(null)
  const searchLayerRef = useRef<HTMLDivElement>(null)
  const searchDialogRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navigatingRef = useRef(false)
  const readerOriginRef = useRef<BlogIndexView>({ kind: 'home' })
  const wasInteractiveRef = useRef(false)
  const [view, setView] = useState<BlogView>({ kind: 'home' })
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const reducedMotion = useCallback(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useLayoutEffect(() => {
    const becameInteractive = interactive && !wasInteractiveRef.current
    wasInteractiveRef.current = interactive

    if (!interactive || !pageRef.current) return
    gsap.set(pageRef.current, { opacity: 1, y: 0 })
    const targets = pageRef.current.querySelectorAll<HTMLElement>('[data-blog-reveal]')
    if (targets.length === 0) return

    // The transition timeline has already brought the complete blog content to
    // its final frame before `interactive` becomes true. Replaying the page
    // reveal here would reset visible children to opacity 0 / translateY(14px)
    // on that exact state change, which presents as a last-frame jump.
    if (becameInteractive || reducedMotion()) {
      gsap.set(targets, { clearProps: 'all' })
      return
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.62, stagger: 0.055, ease: 'power2.out', clearProps: 'transform' },
      )
    }, pageRef)

    return () => context.revert()
  }, [interactive, reducedMotion, view])

  useLayoutEffect(() => {
    if (!searchOpen || !searchLayerRef.current || !searchDialogRef.current) return

    if (reducedMotion()) {
      gsap.set(searchLayerRef.current, { opacity: 1 })
      gsap.set(searchDialogRef.current, { opacity: 1 })
    } else {
      gsap.timeline()
        .fromTo(searchLayerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.24, ease: 'power1.out' })
        .fromTo(
          searchDialogRef.current,
          { opacity: 0, y: 14, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: 'power2.out' },
          0.04,
        )
    }

    searchInputRef.current?.focus({ preventScroll: true })
  }, [reducedMotion, searchOpen])

  useEffect(() => {
    if (!searchOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setSearchOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape, { capture: true })
    return () => window.removeEventListener('keydown', closeOnEscape, { capture: true })
  }, [searchOpen])

  const transitionTo = useCallback((nextView: BlogView) => {
    if (navigatingRef.current) return
    const current = pageRef.current

    const finish = () => {
      setView(nextView)
      shellRef.current?.closest<HTMLElement>('.blog-transition')?.scrollTo({ top: 0 })
      navigatingRef.current = false
    }

    if (!current || reducedMotion()) {
      finish()
      return
    }

    navigatingRef.current = true
    gsap.to(current, {
      opacity: 0,
      y: -8,
      duration: 0.2,
      ease: 'power1.in',
      onComplete: finish,
    })
  }, [reducedMotion])

  const returnFromArticle = useCallback(() => {
    transitionTo(readerOriginRef.current)
  }, [transitionTo])

  const openSection = (sectionId: BlogSectionId) => {
    transitionTo({ kind: 'category', sectionId, directoryPath: [] })
  }

  const navigateDirectory = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const { blogTarget, sectionId, directoryPath } = event.currentTarget.dataset
    if (blogTarget === 'home') {
      transitionTo({ kind: 'home' })
      return
    }
    if (!sectionId || !getSection(sectionId)) return
    const parsedPath: unknown = JSON.parse(directoryPath ?? '[]')
    if (!Array.isArray(parsedPath) || !parsedPath.every((segment) => typeof segment === 'string')) return
    transitionTo({ kind: 'category', sectionId, directoryPath: parsedPath })
  }, [transitionTo])

  const openArticle = (article: BlogArticle) => {
    if (view.kind !== 'article') readerOriginRef.current = view
    transitionTo({ kind: 'article', articleId: article.id })
  }

  const openArticleById = (articleId: string, heading?: string) => {
    const article = getArticle(articleId)
    if (!article) return
    if (view.kind !== 'article') readerOriginRef.current = view
    transitionTo({ kind: 'article', articleId, heading })
  }

  const closeSearch = () => {
    const layer = searchLayerRef.current
    const dialog = searchDialogRef.current
    if (!layer || !dialog || reducedMotion()) {
      setSearchOpen(false)
      return
    }

    gsap.timeline({ onComplete: () => setSearchOpen(false) })
      .to(dialog, { opacity: 0, y: 9, scale: 0.99, duration: 0.18, ease: 'power1.in' })
      .to(layer, { opacity: 0, duration: 0.16, ease: 'power1.in' }, 0.04)
  }

  const handleBackToRoom = () => {
    setSearchOpen(false)
    setView({ kind: 'home' })
    setSearchQuery('')
    onBack()
  }

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return selectedNotes
    return blogArticles.filter((article) => {
      const section = getSection(article.sectionId)
      return [
        article.title,
        article.summary,
        article.categoryPath.join(' '),
        article.tags?.join(' ') ?? '',
        section?.title ?? '',
      ].join(' ').toLocaleLowerCase().includes(normalizedQuery)
    }).slice(0, 8)
  }, [normalizedQuery])

  const renderHome = () => (
    <main ref={pageRef} className="blog-page blog-home" aria-label="Blog home">
      <section className="blog-hero" data-blog-reveal>
        <span className="blog-hero__birds" aria-hidden="true">⌁  ⌁</span>
        <h1>Notes on becoming.</h1>
        <p>Code, curiosity, and life.</p>
        <small>关于技术、思考与成长的记录。</small>
      </section>

      <section className="blog-explore" aria-labelledby="blog-explore-title">
        <div className="blog-section-heading" data-blog-reveal>
          <h2 id="blog-explore-title">Explore my knowledge</h2>
          <p>Four Paths, One Journey.</p>
        </div>
        <div className="blog-section-grid">
          {blogSections.map((section) => {
            const count = getSectionArticles(section.id).length
            return (
              <button
                key={section.id}
                className="blog-section-card"
                type="button"
                data-blog-reveal
                onClick={() => openSection(section.id)}
              >
                <span className="blog-section-card__image">
                  <img src={section.illustration} alt="" loading="eager" />
                </span>
                <span className="blog-section-card__body">
                  <span className="blog-section-card__index">{section.index}</span>
                  <strong>{section.title}</strong>
                  <span className="blog-section-card__count">{count} {count === 1 ? 'Note' : 'Notes'}</span>
                  <span className="blog-section-card__description">{section.description}</span>
                  <span className="blog-section-card__keywords" aria-hidden="true">
                    {section.keywords.slice(0, 4).map((keyword) => <i key={keyword}>{keyword}</i>)}
                  </span>
                  <span className="blog-section-card__action"><ArrowIcon /></span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="blog-selected" aria-labelledby="blog-selected-title">
        <div className="blog-section-heading" data-blog-reveal>
          <h2 id="blog-selected-title">Selected notes</h2>
          <p>Some thoughts are worth sharing.</p>
        </div>
        <div className="blog-selected__list" data-blog-reveal>
          {selectedNotes.map((article, index) => (
            <ArticleButton key={article.id} article={article} index={index} onOpen={openArticle} />
          ))}
        </div>
      </section>
    </main>
  )

  const renderCategory = (sectionId: BlogSectionId, directoryPath: string[]) => {
    const section = getSection(sectionId)
    if (!section) return null
    const sectionArticles = getSectionArticles(sectionId)
    const directory = getBlogDirectory(sectionId, directoryPath)
    const isRoot = directoryPath.length === 0
    const currentTitle = directoryPath.at(-1) ?? section.title
    const directItemCount = directory.directories.length + directory.articles.length
    const parentPath = directoryPath.slice(0, -1)
    const breadcrumbItems = [
      { label: 'Home', path: null },
      { label: section.title, path: [] as string[] },
      ...directoryPath.map((label, index) => ({ label, path: directoryPath.slice(0, index + 1) })),
    ]

    return (
      <main ref={pageRef} className="blog-page blog-category" aria-label={currentTitle}>
        <button
          className="blog-category__back"
          type="button"
          data-blog-reveal
          data-blog-target={isRoot ? 'home' : 'directory'}
          data-section-id={isRoot ? undefined : sectionId}
          data-directory-path={isRoot ? undefined : JSON.stringify(parentPath)}
          onClick={navigateDirectory}
        >
          <ArrowIcon direction="left" />
          {isRoot ? 'Back to home' : `Back to ${parentPath.at(-1) ?? section.title}`}
        </button>

        <nav className="blog-breadcrumbs" aria-label="Current location" data-blog-reveal>
          {breadcrumbItems.map((item, index) => {
            const current = index === breadcrumbItems.length - 1
            return (
              <span key={`${item.label}-${index}`}>
                {index > 0 && <i aria-hidden="true">/</i>}
                {current ? (
                  <strong aria-current="page">{item.label}</strong>
                ) : (
                  <button
                    type="button"
                    data-blog-target={item.path === null ? 'home' : 'directory'}
                    data-section-id={item.path === null ? undefined : sectionId}
                    data-directory-path={item.path === null ? undefined : JSON.stringify(item.path)}
                    onClick={navigateDirectory}
                  >
                    {item.label}
                  </button>
                )}
              </span>
            )
          })}
        </nav>

        <header className="blog-category__hero" data-blog-reveal>
          <span>{isRoot ? section.index : section.title}</span>
          <h1>{currentTitle}</h1>
          <p>
            {directory.descendantNoteCount} {directory.descendantNoteCount === 1 ? 'Note' : 'Notes'}
            <i />
            {isRoot ? section.categoryDescription : `${directItemCount} direct ${directItemCount === 1 ? 'item' : 'items'} in this folder.`}
          </p>
        </header>

        <div className="blog-category__layout">
          <aside className="blog-directory-trail" aria-label={`${section.title} navigation`} data-blog-reveal>
            <p>Current path</p>
            <ol>
              <li>
                <button
                  className={isRoot ? 'is-current' : ''}
                  type="button"
                  aria-current={isRoot ? 'page' : undefined}
                  data-section-id={sectionId}
                  data-directory-path="[]"
                  onClick={navigateDirectory}
                >
                  <span>{section.title}</span>
                  <small>{sectionArticles.length}</small>
                </button>
              </li>
              {directoryPath.map((label, index) => {
                const path = directoryPath.slice(0, index + 1)
                const current = index === directoryPath.length - 1
                return (
                  <li key={path.join('/')}>
                    <button
                      className={current ? 'is-current' : ''}
                      type="button"
                      aria-current={current ? 'page' : undefined}
                      data-section-id={sectionId}
                      data-directory-path={JSON.stringify(path)}
                      onClick={navigateDirectory}
                    >
                      <span>{label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </aside>

          <div className="blog-directory" aria-live="polite" data-blog-reveal>
            {directory.directories.length > 0 && (
              <section className="blog-directory__section" aria-labelledby="blog-folders-title">
                <div className="blog-directory__heading">
                  <h2 id="blog-folders-title">Folders</h2>
                  <span>{directory.directories.length}</span>
                </div>
                <div className="blog-folder-list">
                  {directory.directories.map((child, index) => (
                    <button
                      key={child.path.join('/')}
                      className="blog-folder-row"
                      type="button"
                      data-section-id={sectionId}
                      data-directory-path={JSON.stringify(child.path)}
                      onClick={navigateDirectory}
                    >
                      <span className="blog-folder-row__index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="blog-folder-row__mark" aria-hidden="true" />
                      <span className="blog-folder-row__copy">
                        <strong>{child.name}</strong>
                        <small>{child.descendantNoteCount} {child.descendantNoteCount === 1 ? 'note' : 'notes'}</small>
                      </span>
                      <ArrowIcon />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {directory.articles.length > 0 && (
              <section className="blog-directory__section blog-category__notes" aria-labelledby="blog-notes-title">
                <div className="blog-directory__heading">
                  <h2 id="blog-notes-title">Notes</h2>
                  <span>{directory.articles.length}</span>
                </div>
                {directory.articles.map((article, index) => (
                  <ArticleButton key={article.id} article={article} index={index} onOpen={openArticle} />
                ))}
              </section>
            )}
          </div>
        </div>
      </main>
    )
  }

  const renderArticle = (articleId: string, heading?: string) => {
    const article = getArticle(articleId)
    if (!article) return renderHome()
    const neighbors = getArticleNeighbors(article.id)
    return (
      <Suspense
        fallback={(
          <main ref={pageRef} className="blog-page blog-reader" aria-label={`Opening ${article.title}`}>
            <div className="blog-reader__loading" role="status"><span aria-hidden="true" /><p>Opening reader…</p></div>
          </main>
        )}
      >
        <BlogReader
          key={article.id}
          article={article}
          initialHeading={heading}
          pageRef={pageRef}
          previous={neighbors.previous}
          next={neighbors.next}
          onBack={returnFromArticle}
          onNavigate={openArticleById}
        />
      </Suspense>
    )
  }

  const renderGraph = () => (
    <Suspense
      fallback={(
        <main ref={pageRef} className="blog-page blog-graph" aria-label="Opening knowledge graph">
          <div className="blog-reader__loading" role="status"><span aria-hidden="true" /><p>Mapping knowledge…</p></div>
        </main>
      )}
    >
      <KnowledgeGraph
        pageRef={pageRef}
        onBack={() => transitionTo({ kind: 'home' })}
        onOpen={openArticle}
      />
    </Suspense>
  )

  return (
    <div ref={shellRef} className="blog-shell" style={{ '--blog-serif': serif } as React.CSSProperties}>
      <header className="blog-header">
        <button className="blog-brand" type="button" onClick={() => transitionTo({ kind: 'home' })}>
          <BotanicalMark />
          <span className="blog-brand__copy">
            <strong id="blog-title">Eason’s Blog</strong>
            <small>Code · Curiosity · Life</small>
          </span>
        </button>
        <nav className="blog-header__actions" aria-label="Blog utilities">
          <button type="button" aria-label="Knowledge Graph" onClick={() => transitionTo({ kind: 'graph' })}>
            <GraphIcon />
            <span>Knowledge Graph</span>
          </button>
          <button type="button" aria-label="Search notes" onClick={() => setSearchOpen(true)}>
            <SearchIcon />
            <span>Search</span>
          </button>
          <i aria-hidden="true" />
          <button ref={backButtonRef} type="button" aria-label="Back to Room" onClick={handleBackToRoom}>
            <span className="blog-header__back-arrow" aria-hidden="true">←</span>
            <span>Back to Room</span>
          </button>
        </nav>
      </header>

      {view.kind === 'home'
        ? renderHome()
        : view.kind === 'category'
          ? renderCategory(view.sectionId, view.directoryPath)
          : view.kind === 'graph'
            ? renderGraph()
            : renderArticle(view.articleId, view.heading)}

      {searchOpen && (
        <div
          ref={searchLayerRef}
          className="blog-search-layer"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSearch()
          }}
        >
          <div
            ref={searchDialogRef}
            className="blog-search"
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-search-title"
          >
            <h2 className="sr-only" id="blog-search-title">Search notes</h2>
            <div className="blog-search__field">
              <SearchIcon />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                placeholder="Search notes..."
                aria-label="Search notes"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button type="button" className="blog-search__clear" onClick={() => setSearchQuery('')}>
                  Clear
                </button>
              )}
              <button type="button" className="blog-search__close" aria-label="Close search" onClick={closeSearch}>×</button>
            </div>
            <div className="blog-search__results" aria-live="polite">
              <p>{normalizedQuery ? `${searchResults.length} matching notes` : 'Selected notes'}</p>
              {searchResults.length > 0 ? searchResults.map((article) => (
                <button key={article.id} type="button" onClick={() => { closeSearch(); openArticle(article) }}>
                  <span className="blog-chip">{article.tags?.[0] ?? article.categoryPath[0]}</span>
                  <strong>{article.title}</strong>
                  <small>{getSection(article.sectionId)?.title}</small>
                  <span aria-hidden="true">↗</span>
                </button>
              )) : (
                <div className="blog-search__empty">No notes found. Try another keyword.</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
