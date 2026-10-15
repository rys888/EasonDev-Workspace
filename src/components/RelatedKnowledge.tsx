import { useMemo } from 'react'
import {
  blogSections,
  getArticleRelations,
  getSection,
} from '../data/blogContent'
import type { BlogArticle } from '../data/blogContent'

type Props = {
  article: BlogArticle
  onNavigate: (articleId: string) => void
}

const SECTION_COLORS = ['#9d6b35', '#a26850', '#788067', '#7b6552']

function mapLabel(title: string) {
  return title.length > 15 ? `${title.slice(0, 14)}…` : title
}

export function RelatedKnowledge({ article, onNavigate }: Props) {
  const { relations, unresolved } = useMemo(() => getArticleRelations(article.id), [article.id])
  const mappedRelations = relations.slice(0, 10)

  return (
    <details className="blog-related">
      <summary>
        <span>
          <small>Direct wikilinks</small>
          <strong>Related Knowledge</strong>
        </span>
        <span>{relations.length} {relations.length === 1 ? 'connection' : 'connections'}</span>
        <i aria-hidden="true">+</i>
      </summary>

      <div className="blog-related__content">
        {relations.length > 0 ? (
          <>
            <div className="blog-related__map" aria-hidden="true">
              <svg viewBox="0 0 1000 360" preserveAspectRatio="xMidYMid meet">
                {mappedRelations.map((relation, index) => {
                  const angle = mappedRelations.length === 1
                    ? 0
                    : index / mappedRelations.length * Math.PI * 2 - Math.PI / 2
                  const x = 500 + Math.cos(angle) * 345
                  const y = 180 + Math.sin(angle) * 112
                  const sectionIndex = Math.max(0, blogSections.findIndex((section) => section.id === relation.article.sectionId))
                  return (
                    <g key={relation.article.id}>
                      <line
                        x1="500"
                        y1="180"
                        x2={x}
                        y2={y}
                        className={`is-${relation.direction}`}
                      />
                      <circle cx={x} cy={y} r="9" fill={SECTION_COLORS[sectionIndex % SECTION_COLORS.length]} />
                      <text x={x} y={y + (y < 180 ? -17 : 28)}>{mapLabel(relation.article.title)}</text>
                    </g>
                  )
                })}
                <circle cx="500" cy="180" r="17" />
                <text className="is-current" x="500" y="224">Current note</text>
              </svg>
            </div>

            <div className="blog-related__list">
              {relations.map((relation) => (
                <button key={relation.article.id} type="button" onClick={() => onNavigate(relation.article.id)}>
                  <span>{relation.direction === 'mutual' ? '↔' : relation.direction === 'outgoing' ? '→' : '←'}</span>
                  <strong>{relation.article.title}</strong>
                  <small>{getSection(relation.article.sectionId)?.title}</small>
                  <i>{relation.direction}</i>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="blog-related__empty">This note is currently isolated from the wikilink network.</p>
        )}

        {unresolved.length > 0 && (
          <div className="blog-related__unresolved">
            <strong>Unresolved references</strong>
            <ul>{unresolved.map((link) => <li key={link.target}>{link.label}</li>)}</ul>
          </div>
        )}
      </div>
    </details>
  )
}
