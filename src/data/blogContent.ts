import generatedCatalog from './blogContent.generated.json'

export type BlogSectionId = string

export type BlogSection = {
  id: BlogSectionId
  index: string
  title: string
  sourceDirectory: string
  description: string
  categoryDescription: string
  illustration: string
  keywords: string[]
}

export type BlogArticle = {
  id: string
  title: string
  sectionId: BlogSectionId
  categoryPath: string[]
  sourcePath: string
  contentPath: string
  summary: string
  date?: string
  tags?: string[]
}

export type BlogCatalogMetadata = {
  repository: string
  ref: string
  commit: string
  commitDate: string
  articleCount: number
  sectionCounts: Record<string, number>
}

export type BlogDirectory = {
  name: string
  path: string[]
  directNoteCount: number
  descendantNoteCount: number
}

export type BlogDirectorySnapshot = {
  path: string[]
  directories: BlogDirectory[]
  articles: BlogArticle[]
  descendantNoteCount: number
}

export type BlogGraphDirectoryNode = {
  id: string
  sectionId: BlogSectionId
  path: string[]
  label: string
  parentId?: string
}

export type BlogGraphDirectoryEdge = {
  source: string
  target: string
  type: 'directory'
}

export type BlogGraphWikilinkEdge = {
  source: string
  target: string
  occurrences: number
}

export type BlogGraphUnresolvedLink = {
  source: string
  target: string
  label: string
}

export type BlogArticleRelation = {
  article: BlogArticle
  direction: 'incoming' | 'outgoing' | 'mutual'
  occurrences: number
}

type SectionPresentation = Omit<BlogSection, 'id' | 'index' | 'sourceDirectory'>

const sectionPresentations: Record<string, SectionPresentation> = {
  '八股笔记': {
    title: 'Interview Notes',
    description: 'Java 后端面试知识体系，从基础到框架、系统梳理。',
    categoryDescription: '面向 Java 后端面试的原子化知识笔记。',
    illustration: '/assets/blog/interview-books.webp',
    keywords: ['Java', 'Collections', 'JUC', 'JVM', 'Spring', 'MySQL', 'Redis'],
  },
  '网课笔记': {
    title: 'Course Notes',
    description: '跟着视频课的学习笔记，记录知识与实践过程。',
    categoryDescription: '从课程章节走向工程实践的逐步记录。',
    illustration: '/assets/blog/course-notebook.webp',
    keywords: ['JavaWeb', 'Redis', 'RabbitMQ', 'Project'],
  },
  '网课个人感想': {
    title: 'Learning Reflections',
    description: '每门课的学习复盘，思考、取舍与评价。',
    categoryDescription: '关于学习方法、课程体验与成长的复盘。',
    illustration: '/assets/blog/reflections-coffee.webp',
    keywords: ['Learning', 'Review', 'Practice'],
  },
  '项目及其相关文档': {
    title: 'Project Documentation',
    description: '实习与练手项目的设计文档、技术分析与实现细节。',
    categoryDescription: '把项目经验整理为可复述的设计决策。',
    illustration: '/assets/blog/projects-laptop.webp',
    keywords: ['采云台', '研约通', 'Architecture'],
  },
}

function fallbackPresentation(sourceDirectory: string): SectionPresentation {
  return {
    title: sourceDirectory,
    description: `${sourceDirectory} 中持续整理的学习笔记。`,
    categoryDescription: `${sourceDirectory} 的分类归档。`,
    illustration: '/assets/blog/course-notebook.webp',
    keywords: [sourceDirectory],
  }
}

export const blogSections: BlogSection[] = generatedCatalog.sections.map((section, index) => ({
  id: section.id,
  index: String(index + 1).padStart(2, '0'),
  sourceDirectory: section.sourceDirectory,
  ...(sectionPresentations[section.sourceDirectory] ?? fallbackPresentation(section.sourceDirectory)),
}))

const sectionIds = new Set(blogSections.map((section) => section.id))

export const blogArticles: BlogArticle[] = generatedCatalog.articles.map((article) => ({
  ...article,
  sectionId: article.sectionId,
}))

for (const article of blogArticles) {
  if (!sectionIds.has(article.sectionId)) {
    throw new Error(`Unknown generated blog section: ${article.sectionId}`)
  }
}

export const blogCatalogMetadata: BlogCatalogMetadata = {
  ...generatedCatalog.source,
  articleCount: generatedCatalog.articleCount,
  sectionCounts: generatedCatalog.sectionCounts,
}

export const blogGraph = {
  articleNodes: generatedCatalog.graph.articleNodes.map((node) => ({ ...node })),
  directoryNodes: generatedCatalog.graph.directoryNodes.map((node) => ({
    ...node,
    path: [...node.path],
  })) as BlogGraphDirectoryNode[],
  directoryEdges: generatedCatalog.graph.directoryEdges.map((edge) => ({
    ...edge,
    type: 'directory' as const,
  })) as BlogGraphDirectoryEdge[],
  wikilinkEdges: generatedCatalog.graph.wikilinkEdges.map((edge) => ({ ...edge })) as BlogGraphWikilinkEdge[],
  unresolvedLinks: (generatedCatalog.graph.unresolvedLinks as BlogGraphUnresolvedLink[]).map((link) => ({ ...link })),
  isolatedArticleIds: [...generatedCatalog.graph.isolatedArticleIds],
}

// Selected notes stay independently configurable while resolving against the real
// generated catalog. Full source paths remain stable even when filenames collide.
export const selectedNoteSourcePaths = [
  'content/八股笔记/Spring/Spring/Spring三级缓存.md',
  'content/八股笔记/MySQL/索引/B+树特性.md',
  'content/八股笔记/集合/Map/HashMap实现原理.md',
  'content/项目及其相关文档/研约通/项目文档ai整理/05-Redis-Lua高并发预约.md',
]

const articleBySourcePath = new Map(
  blogArticles.map((article) => [article.sourcePath, article]),
)

const configuredSelectedNotes = selectedNoteSourcePaths
  .map((sourcePath) => articleBySourcePath.get(sourcePath))
  .filter((article): article is BlogArticle => Boolean(article))

const sectionFallbackNotes = blogSections
  .map((section) => blogArticles.find((article) => article.sectionId === section.id))
  .filter((article): article is BlogArticle => Boolean(article))

export const selectedNotes = configuredSelectedNotes.length === selectedNoteSourcePaths.length
  ? configuredSelectedNotes
  : sectionFallbackNotes

export function getSection(sectionId: BlogSectionId) {
  return blogSections.find((section) => section.id === sectionId)
}

export function getSectionArticles(sectionId: BlogSectionId) {
  return blogArticles.filter((article) => article.sectionId === sectionId)
}

export function getArticle(articleId: string) {
  return blogArticles.find((article) => article.id === articleId)
}

export function getArticleNeighbors(articleId: string) {
  const article = getArticle(articleId)
  if (!article) return { previous: undefined, next: undefined }
  const sectionArticles = getSectionArticles(article.sectionId)
  const index = sectionArticles.findIndex((candidate) => candidate.id === articleId)
  return {
    previous: index > 0 ? sectionArticles[index - 1] : undefined,
    next: index >= 0 && index < sectionArticles.length - 1 ? sectionArticles[index + 1] : undefined,
  }
}

export function getArticleRelations(articleId: string) {
  const relations = new Map<string, BlogArticleRelation>()

  for (const edge of blogGraph.wikilinkEdges) {
    if (edge.source !== articleId && edge.target !== articleId) continue
    const relatedId = edge.source === articleId ? edge.target : edge.source
    const article = getArticle(relatedId)
    if (!article) continue
    const direction = edge.source === articleId ? 'outgoing' : 'incoming'
    const existing = relations.get(relatedId)
    relations.set(relatedId, {
      article,
      direction: existing && existing.direction !== direction ? 'mutual' : direction,
      occurrences: (existing?.occurrences ?? 0) + edge.occurrences,
    })
  }

  return {
    relations: Array.from(relations.values()).sort((left, right) => {
      const directionOrder = { mutual: 0, outgoing: 1, incoming: 2 }
      return directionOrder[left.direction] - directionOrder[right.direction]
        || left.article.title.localeCompare(right.article.title, 'zh-CN', { numeric: true })
    }),
    unresolved: blogGraph.unresolvedLinks.filter((link) => link.source === articleId),
  }
}

function startsWithPath(candidate: string[], path: string[]) {
  return path.every((segment, index) => candidate[index] === segment)
}

export function getBlogDirectory(
  sectionId: BlogSectionId,
  path: string[] = [],
): BlogDirectorySnapshot {
  const articles = getSectionArticles(sectionId)
  const descendants = articles.filter((article) => startsWithPath(article.categoryPath, path))
  const directArticles = descendants
    .filter((article) => article.categoryPath.length === path.length)
    .sort((left, right) => (
      Number(!left.sourcePath.endsWith('-概览.md')) - Number(!right.sourcePath.endsWith('-概览.md'))
    ))
  const childNames = Array.from(new Set(
    descendants
      .map((article) => article.categoryPath[path.length])
      .filter((name): name is string => Boolean(name)),
  ))

  const directories = childNames.map((name) => {
    const childPath = [...path, name]
    const childArticles = descendants.filter((article) => startsWithPath(article.categoryPath, childPath))
    return {
      name,
      path: childPath,
      directNoteCount: childArticles.filter((article) => article.categoryPath.length === childPath.length).length,
      descendantNoteCount: childArticles.length,
    }
  })

  return {
    path,
    directories,
    articles: directArticles,
    descendantNoteCount: descendants.length,
  }
}
