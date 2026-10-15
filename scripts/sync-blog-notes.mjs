import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, extname, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cacheRoot = resolve(projectRoot, '.cache/java-backend-learning')
const generatedPath = resolve(projectRoot, 'src/data/blogContent.generated.json')
const generatedContentRoot = resolve(projectRoot, 'public/blog-content')
const temporaryContentRoot = resolve(projectRoot, 'public/.blog-content.tmp')
const repository = process.env.BLOG_NOTES_REPOSITORY
  ?? 'https://github.com/rys888/Java-Backend-Learning.git'
const repositoryRef = process.env.BLOG_NOTES_REF ?? 'main'
const offline = process.argv.includes('--offline')

const configuredSections = [
  { directory: '八股笔记', id: 'interview-notes', fallbackTag: 'Interview Notes' },
  { directory: '网课笔记', id: 'course-notes', fallbackTag: 'Course Notes' },
  { directory: '网课个人感想', id: 'learning-reflections', fallbackTag: 'Learning Reflections' },
  { directory: '项目及其相关文档', id: 'project-documentation', fallbackTag: 'Project Documentation' },
]

const configuredSectionByDirectory = new Map(
  configuredSections.map((section) => [section.directory, section]),
)
const excludedContentDirectories = new Set(['附件'])
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })?.trim()
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function assertContentCacheClean() {
  const dirtyContent = runGit(
    ['-C', cacheRoot, 'status', '--porcelain', '--untracked-files=all', '--', 'content'],
    { capture: true },
  )
  if (dirtyContent) {
    throw new Error(
      `The managed notes cache contains local content changes and cannot be trusted:\n${dirtyContent}`,
    )
  }
}

async function syncRepository() {
  const gitDirectory = resolve(cacheRoot, '.git')
  const cacheExists = await pathExists(cacheRoot)

  if (offline) {
    if (!(await pathExists(gitDirectory))) {
      throw new Error(
        `Offline generation requires an existing notes cache at ${cacheRoot}. Run npm run notes:sync first.`,
      )
    }
    return
  }

  if (cacheExists && !(await pathExists(gitDirectory))) {
    throw new Error(
      `Notes cache exists but is not a Git checkout: ${cacheRoot}. Move it aside and retry.`,
    )
  }

  if (!cacheExists) {
    await mkdir(dirname(cacheRoot), { recursive: true })
    runGit([
      'clone',
      '--depth', '1',
      '--filter=blob:none',
      '--sparse',
      '--branch', repositoryRef,
      repository,
      cacheRoot,
    ])
  } else {
    assertContentCacheClean()
    runGit(['-C', cacheRoot, 'remote', 'set-url', 'origin', repository])
  }

  runGit(['-C', cacheRoot, 'fetch', '--depth', '1', 'origin', repositoryRef])
  runGit(['-C', cacheRoot, 'checkout', '--detach', 'FETCH_HEAD'])
  runGit(['-C', cacheRoot, 'sparse-checkout', 'set', 'content'])
  assertContentCacheClean()
}

function toPosix(path) {
  return path.split(sep).join('/')
}

function decodeScalar(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }
  return trimmed
}

function splitFrontmatter(markdown) {
  const opening = markdown.match(/^---\r?\n/)
  if (!opening) return { attributes: {}, body: markdown }

  const rest = markdown.slice(opening[0].length)
  const closing = rest.match(/^---\s*\r?$/m)
  if (!closing || closing.index === undefined) {
    return { attributes: {}, body: markdown }
  }

  const block = rest.slice(0, closing.index)
  const body = rest.slice(closing.index + closing[0].length).replace(/^\r?\n/, '')
  const attributes = {}
  let listKey = null

  for (const line of block.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (field) {
      const [, key, rawValue] = field
      const value = decodeScalar(rawValue)
      attributes[key] = value
      listKey = value ? null : key
      continue
    }

    const item = line.match(/^\s+-\s+(.+)$/)
    if (item && listKey) {
      const current = Array.isArray(attributes[listKey]) ? attributes[listKey] : []
      attributes[listKey] = [...current, decodeScalar(item[1])]
    }
  }

  return { attributes, body }
}

function cleanInlineMarkdown(value) {
  return value
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_~]/g, '')
    .replace(/(?:^|\s)[#>]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(attributes, body, filePath) {
  if (typeof attributes.title === 'string' && attributes.title.trim()) {
    return cleanInlineMarkdown(attributes.title)
  }

  const fileTitle = basename(filePath, extname(filePath)).trim()
  if (fileTitle) return fileTitle
  const heading = body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]
  return heading ? cleanInlineMarkdown(heading) : 'Untitled note'
}

function truncate(value, limit = 108) {
  if (value.length <= limit) return value
  const slice = value.slice(0, limit - 1)
  const boundary = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('，'), slice.lastIndexOf(' '))
  return `${slice.slice(0, boundary >= limit * 0.58 ? boundary : limit - 1).trim()}…`
}

function extractSummary(attributes, body, categoryPath, fallbackTag) {
  for (const key of ['summary', 'description', 'excerpt']) {
    if (typeof attributes[key] === 'string' && attributes[key].trim()) {
      return truncate(cleanInlineMarkdown(attributes[key]))
    }
  }

  const prose = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/%%[\s\S]*?%%/g, '')

  for (const paragraph of prose.split(/\r?\n\s*\r?\n/)) {
    const meaningfulLines = paragraph
      .split(/\r?\n/)
      .filter((line) => !/^\s*(?:#{1,6}\s|\|.*\||[-:| ]{3,}|!\[\[|!\[)/.test(line))
      .map((line) => line.replace(/^\s*(?:[-*+] |\d+[.)]\s+)/, ''))
    const candidate = cleanInlineMarkdown(meaningfulLines.join(' '))
    if (candidate.length >= 18) return truncate(candidate)
  }

  const location = categoryPath.length > 0 ? categoryPath.join(' · ') : fallbackTag
  return `收录于 ${location} 的学习笔记。`
}

function parseTags(attributes, categoryPath, fallbackTag) {
  if (Array.isArray(attributes.tags)) {
    const tags = attributes.tags.map(cleanInlineMarkdown).filter(Boolean)
    if (tags.length > 0) return tags
  }
  if (typeof attributes.tags === 'string' && attributes.tags.trim()) {
    const tags = attributes.tags
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(cleanInlineMarkdown)
      .filter(Boolean)
    if (tags.length > 0) return tags
  }
  return [categoryPath.at(-1) ?? fallbackTag]
}

function parseDate(attributes) {
  for (const key of ['date', 'created', 'updated', 'publishDate']) {
    if (typeof attributes[key] === 'string' && attributes[key].trim()) {
      return decodeScalar(attributes[key])
    }
  }
  return undefined
}

function normalizeVaultPath(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  let normalized = trimmed.replaceAll('\\', '/').normalize('NFC')
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // Obsidian accepts literal percent characters in filenames. Keep them intact.
  }
  normalized = normalized.replace(/^\.?\//, '').replace(/^content\//, '')
  return posix.normalize(normalized).replace(/^\.\.\//, '')
}

function withoutMarkdownExtension(value) {
  return value.replace(/\.md$/i, '')
}

function markdownLabel(value) {
  return value.replace(/([\\\[\]])/g, '\\$1')
}

function headingText(value) {
  return cleanInlineMarkdown(value)
    .replace(/\$+/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

function headingSlug(value) {
  return headingText(value)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section'
}

function splitDocumentTitle(body, fallbackTitle) {
  const lines = body.split(/\r?\n/)
  const firstContentIndex = lines.findIndex((line) => line.trim())
  if (firstContentIndex < 0) return { body, documentTitle: fallbackTitle }
  const heading = lines[firstContentIndex].match(/^#\s+(.+?)\s*#*\s*$/)
  if (!heading) return { body, documentTitle: fallbackTitle }
  const documentTitle = headingText(heading[1]) || fallbackTitle
  lines.splice(firstContentIndex, 1)
  if (lines[firstContentIndex]?.trim() === '') lines.splice(firstContentIndex, 1)
  return { body: lines.join('\n'), documentTitle }
}

function extractHeadings(markdown) {
  const headings = []
  const duplicateCounts = new Map()
  let fence = null

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0]
      else if (fence === fenceMatch[1][0]) fence = null
      continue
    }
    if (fence) continue

    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!match) continue
    const text = headingText(match[2])
    if (!text) continue
    const base = headingSlug(text)
    const count = (duplicateCounts.get(base) ?? 0) + 1
    duplicateCounts.set(base, count)
    headings.push({
      depth: match[1].length,
      text,
      id: count === 1 ? base : `${base}-${count}`,
    })
  }

  return headings
}

function estimateReading(markdown) {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[`*_~#[\]()|>]/g, ' ')
  const latinWords = prose.match(/[A-Za-z0-9_]+/g)?.length ?? 0
  const cjkCharacters = prose.match(/[\p{Script=Han}]/gu)?.length ?? 0
  const wordCount = latinWords + cjkCharacters
  return {
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(latinWords / 220 + cjkCharacters / 420)),
  }
}

function commonDirectoryDepth(left, right) {
  const leftParts = dirname(left).split('/')
  const rightParts = dirname(right).split('/')
  let depth = 0
  while (leftParts[depth] && leftParts[depth] === rightParts[depth]) depth += 1
  return depth
}

function chooseClosestRecord(candidates, currentRecord) {
  const unique = Array.from(new Map(candidates.map((candidate) => [candidate.article.id, candidate])).values())
  if (unique.length <= 1) return unique[0]
  const scored = unique
    .map((candidate) => ({
      candidate,
      score: commonDirectoryDepth(candidate.relativeToContent, currentRecord.relativeToContent),
    }))
    .sort((left, right) => right.score - left.score)
  return scored[0].score > scored[1].score ? scored[0].candidate : undefined
}

function createNoteResolver(records) {
  const byPath = new Map()
  const byBasename = new Map()
  const byAlias = new Map()

  const append = (map, key, record) => {
    if (!key) return
    const normalized = key.normalize('NFC').toLocaleLowerCase()
    map.set(normalized, [...(map.get(normalized) ?? []), record])
  }

  for (const record of records) {
    const pathWithoutExtension = withoutMarkdownExtension(record.relativeToContent)
    append(byPath, pathWithoutExtension, record)
    append(byBasename, basename(pathWithoutExtension), record)
    const aliases = Array.isArray(record.attributes.aliases)
      ? record.attributes.aliases
      : typeof record.attributes.aliases === 'string' && record.attributes.aliases
        ? [record.attributes.aliases]
        : []
    aliases.forEach((alias) => append(byAlias, cleanInlineMarkdown(alias), record))
  }

  return (rawTarget, currentRecord) => {
    const [rawPath, ...headingParts] = rawTarget.split('#')
    const heading = headingParts.join('#').trim()
    const targetPath = withoutMarkdownExtension(normalizeVaultPath(rawPath))
    if (!targetPath) return { record: currentRecord, heading }

    const lookup = targetPath.toLocaleLowerCase()
    const currentDirectory = dirname(currentRecord.relativeToContent)
    const directCandidates = [
      ...(byPath.get(lookup) ?? []),
      ...(byPath.get(withoutMarkdownExtension(normalizeVaultPath(posix.join(currentDirectory, targetPath))).toLocaleLowerCase()) ?? []),
    ]
    if (directCandidates.length > 0) {
      return { record: chooseClosestRecord(directCandidates, currentRecord), heading }
    }

    const basenameLookup = basename(targetPath).toLocaleLowerCase()
    const candidates = [
      ...(byBasename.get(basenameLookup) ?? []),
      ...(byAlias.get(lookup) ?? []),
    ]
    return { record: chooseClosestRecord(candidates, currentRecord), heading }
  }
}

async function collectContentFiles(directory, predicate, files = []) {
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) await collectContentFiles(path, predicate, files)
    else if (entry.isFile() && predicate(path)) files.push(path)
  }
  return files
}

function createAssetResolver(assetPaths, contentRoot) {
  const byPath = new Map()
  const byBasename = new Map()
  for (const filePath of assetPaths) {
    const relativePath = toPosix(relative(contentRoot, filePath)).normalize('NFC')
    byPath.set(relativePath.toLocaleLowerCase(), filePath)
    const key = basename(relativePath).toLocaleLowerCase()
    byBasename.set(key, [...(byBasename.get(key) ?? []), filePath])
  }

  return (rawTarget, currentRecord) => {
    const target = normalizeVaultPath(rawTarget)
    const currentDirectory = dirname(currentRecord.relativeToContent)
    const directPaths = [
      target,
      normalizeVaultPath(posix.join(currentDirectory, target)),
      normalizeVaultPath(posix.join('附件', target)),
    ]
    for (const candidate of directPaths) {
      const match = byPath.get(candidate.toLocaleLowerCase())
      if (match) return match
    }

    const candidates = byBasename.get(basename(target).toLocaleLowerCase()) ?? []
    if (candidates.length === 1) return candidates[0]
    if (candidates.length > 1) {
      const scored = candidates
        .map((filePath) => ({
          filePath,
          score: commonDirectoryDepth(
            toPosix(relative(contentRoot, filePath)),
            currentRecord.relativeToContent,
          ),
        }))
        .sort((left, right) => right.score - left.score)
      if (scored[0].score > scored[1].score) return scored[0].filePath
    }
    return undefined
  }
}

function transformMarkdown(markdown, currentRecord, context) {
  const unresolved = context.unresolved
  const invalidHeadingFragments = context.invalidHeadingFragments
  const resolveNote = context.resolveNote
  const resolveAsset = context.resolveAsset
  const registerAsset = context.registerAsset
  const recordBrokenWikiLink = context.recordBrokenWikiLink
  const recordWikiLink = context.recordWikiLink
  let fence = null

  const fragmentFor = (resolved) => {
    if (!resolved.heading || !resolved.record) return ''
    const id = headingSlug(resolved.heading)
    if (resolved.record.sourceHeadingIds.has(id)) return `#${id}`
    invalidHeadingFragments.add(
      `Missing heading "${resolved.heading}" in ${resolved.record.article.sourcePath} (linked from ${currentRecord.article.sourcePath})`,
    )
    return ''
  }

  const hrefFor = (resolved) => {
    const fragment = fragmentFor(resolved)
    if (fragment && resolved.record.article.id === currentRecord.article.id) return fragment
    return `/blog/n/${resolved.record.article.id}${fragment}`
  }

  const transformText = (text) => {
    const inlineParts = text.split(/(`+[^`]*`+)/g)
    return inlineParts.map((part, index) => {
      if (index % 2 === 1) return part

      const withEmbeds = part.replace(/!\[\[([^\]]+)\]\]/g, (_, inner) => {
        const [rawTarget, ...displayParts] = inner.split('|')
        const target = rawTarget.trim()
        const display = displayParts.join('|').trim()
        const extension = extname(target.split('#')[0]).toLocaleLowerCase()
        if (imageExtensions.has(extension)) {
          const assetPath = resolveAsset(target.split('#')[0], currentRecord)
          if (!assetPath) {
            unresolved.add(`Missing image "${target}" in ${currentRecord.article.sourcePath}`)
            return `> Missing local image: ${markdownLabel(display || basename(target))}`
          }
          const assetUrl = registerAsset(assetPath)
          const numericWidth = display.match(/^(\d{2,4})(?:x\d{2,4})?$/)?.[1]
          const width = numericWidth ? Math.min(1600, Math.max(120, Number(numericWidth))) : undefined
          const alt = numericWidth || !display
            ? basename(target, extension)
            : display
          return `![${markdownLabel(alt)}](${assetUrl}${width ? `?width=${width}` : ''})`
        }

        const resolved = resolveNote(target, currentRecord)
        if (!resolved.record) {
          unresolved.add(`Missing embedded note "${target}" in ${currentRecord.article.sourcePath}`)
          recordBrokenWikiLink(target, display || basename(target))
          return markdownLabel(display || basename(target))
        }
        const label = display || resolved.record.article.title
        recordWikiLink(resolved.record)
        return `[${markdownLabel(label)}](${hrefFor(resolved)})`
      })

      const withWikiLinks = withEmbeds.replace(/(?<!!)\[\[([^\]]+)\]\]/g, (_, inner) => {
        const [rawTarget, ...displayParts] = inner.split('|')
        const target = rawTarget.trim()
        const resolved = resolveNote(target, currentRecord)
        const targetWithoutHeading = target.split('#')[0]
        const label = displayParts.join('|').trim()
          || (targetWithoutHeading ? basename(targetWithoutHeading, '.md') : resolved.heading)
          || currentRecord.article.title
        if (!resolved.record) {
          unresolved.add(`Missing note "${target}" in ${currentRecord.article.sourcePath}`)
          recordBrokenWikiLink(target, label)
          return markdownLabel(label)
        }
        recordWikiLink(resolved.record)
        return `[${markdownLabel(label)}](${hrefFor(resolved)})`
      })

      return withWikiLinks.replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (full, label, rawHref) => {
        const href = rawHref.trim().replace(/\s+["'][^"']*["']$/, '')
        if (!/\.md(?:#.*)?$/i.test(href)) return full
        const resolved = resolveNote(href, currentRecord)
        if (!resolved.record) {
          unresolved.add(`Missing Markdown link "${href}" in ${currentRecord.article.sourcePath}`)
          return markdownLabel(label)
        }
        return `[${markdownLabel(label)}](${hrefFor(resolved)})`
      })
    }).join('')
  }

  return markdown
    .replace(/%%[\s\S]*?%%/g, '')
    .split(/\r?\n/)
    .map((line) => {
      const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
      if (fenceMatch) {
        if (!fence) fence = fenceMatch[1][0]
        else if (fence === fenceMatch[1][0]) fence = null
        return line
      }
      return fence ? line : transformText(line)
    })
    .join('\n')
    .trim()
}

async function buildCatalog() {
  const contentRoot = resolve(cacheRoot, 'content')
  if (!(await pathExists(contentRoot)) || !(await stat(contentRoot)).isDirectory()) {
    throw new Error(`Synced repository does not contain the expected content directory: ${contentRoot}`)
  }

  const files = await collectContentFiles(contentRoot, (path) => /\.md$/i.test(path))
  const assetPaths = await collectContentFiles(contentRoot, (path) => !/\.md$/i.test(path))
  const records = []
  const discoveredDirectories = Array.from(new Set(
    files
      .map((filePath) => toPosix(relative(contentRoot, filePath)).split('/'))
      .filter((parts) => parts.length > 1 && !excludedContentDirectories.has(parts[0]))
      .map((parts) => parts[0]),
  ))
  const orderedDirectories = [
    ...configuredSections
      .map((section) => section.directory)
      .filter((directory) => discoveredDirectories.includes(directory)),
    ...discoveredDirectories
      .filter((directory) => !configuredSectionByDirectory.has(directory))
      .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true })),
  ]
  const catalogSections = orderedDirectories.map((directory) => {
    const configured = configuredSectionByDirectory.get(directory)
    return configured ?? {
      directory,
      id: `section-${createHash('sha256').update(directory.normalize('NFC')).digest('hex').slice(0, 12)}`,
      fallbackTag: directory,
    }
  })
  const sectionByDirectory = new Map(
    catalogSections.map((section) => [section.directory, section]),
  )

  for (const filePath of files) {
    const relativeToContent = toPosix(relative(contentRoot, filePath))
    const [sourceDirectory, ...nestedParts] = relativeToContent.split('/')
    const section = sectionByDirectory.get(sourceDirectory)
    if (!section) continue

    const categoryPath = nestedParts.slice(0, -1)
    const sourcePath = `content/${relativeToContent}`
    const markdown = await readFile(filePath, 'utf8')
    const { attributes, body } = splitFrontmatter(markdown.replace(/^\uFEFF/, ''))
    const date = parseDate(attributes)
    const article = {
      id: `${section.id}-${createHash('sha256').update(sourcePath.normalize('NFC')).digest('hex').slice(0, 16)}`,
      title: extractTitle(attributes, body, filePath),
      sectionId: section.id,
      categoryPath,
      sourcePath,
      summary: extractSummary(attributes, body, categoryPath, section.fallbackTag),
      ...(date ? { date } : {}),
      tags: parseTags(attributes, categoryPath, section.fallbackTag),
      contentPath: `/blog-content/articles/${section.id}-${createHash('sha256').update(sourcePath.normalize('NFC')).digest('hex').slice(0, 16)}.json`,
    }
    records.push({
      article,
      attributes,
      body,
      filePath,
      relativeToContent,
      sourceHeadingIds: new Set(extractHeadings(body).map((heading) => heading.id)),
    })
  }

  const articles = records.map((record) => record.article)
  const sectionOrder = new Map(catalogSections.map((section, index) => [section.id, index]))
  articles.sort((left, right) => {
    const sectionDifference = sectionOrder.get(left.sectionId) - sectionOrder.get(right.sectionId)
    return sectionDifference || left.sourcePath.localeCompare(right.sourcePath, 'zh-CN', { numeric: true })
  })

  if (articles.length === 0) {
    throw new Error('No Markdown articles were found in the four configured content sections.')
  }

  const ids = new Set()
  const sourcePaths = new Set()
  for (const article of articles) {
    if (ids.has(article.id)) throw new Error(`Generated duplicate article id: ${article.id}`)
    if (sourcePaths.has(article.sourcePath)) throw new Error(`Generated duplicate source path: ${article.sourcePath}`)
    ids.add(article.id)
    sourcePaths.add(article.sourcePath)
  }

  await rm(temporaryContentRoot, { recursive: true, force: true })
  await mkdir(resolve(temporaryContentRoot, 'articles'), { recursive: true })
  await mkdir(resolve(temporaryContentRoot, 'assets'), { recursive: true })

  const resolveNote = createNoteResolver(records)
  const resolveAsset = createAssetResolver(assetPaths, contentRoot)
  const unresolved = new Set()
  const invalidHeadingFragments = new Set()
  const registeredAssets = new Map()
  const graphWikiLinks = new Map()
  const graphBrokenWikiLinks = new Map()
  const registerAsset = (filePath) => {
    const relativePath = toPosix(relative(contentRoot, filePath)).normalize('NFC')
    const extension = extname(filePath).toLocaleLowerCase()
    const name = `${createHash('sha256').update(relativePath).digest('hex').slice(0, 20)}${extension}`
    registeredAssets.set(name, filePath)
    return `/blog-content/assets/${name}`
  }

  const payloadSummaries = []
  for (const record of records) {
    const document = splitDocumentTitle(record.body, record.article.title)
    const markdown = transformMarkdown(document.body, record, {
      registerAsset,
      recordBrokenWikiLink: (target, label) => {
        const normalizedTarget = target.trim().normalize('NFC')
        const key = `${record.article.id}\u0000${normalizedTarget}`
        if (!graphBrokenWikiLinks.has(key)) {
          graphBrokenWikiLinks.set(key, {
            source: record.article.id,
            target: normalizedTarget,
            label: cleanInlineMarkdown(label) || normalizedTarget,
          })
        }
      },
      recordWikiLink: (targetRecord) => {
        if (targetRecord.article.id === record.article.id) return
        const key = `${record.article.id}\u0000${targetRecord.article.id}`
        const existing = graphWikiLinks.get(key)
        graphWikiLinks.set(key, {
          source: record.article.id,
          target: targetRecord.article.id,
          occurrences: (existing?.occurrences ?? 0) + 1,
        })
      },
      resolveAsset,
      resolveNote,
      unresolved,
      invalidHeadingFragments,
    })
    const headings = extractHeadings(markdown)
    const reading = estimateReading(markdown)
    const payload = {
      schemaVersion: 1,
      id: record.article.id,
      sourcePath: record.article.sourcePath,
      documentTitle: document.documentTitle,
      markdown,
      headings,
      ...reading,
    }
    await writeFile(
      resolve(temporaryContentRoot, 'articles', `${record.article.id}.json`),
      `${JSON.stringify(payload)}\n`,
      'utf8',
    )
    payloadSummaries.push({
      id: record.article.id,
      headings: headings.length,
      ...reading,
    })
  }

  for (const [name, filePath] of registeredAssets) {
    await copyFile(filePath, resolve(temporaryContentRoot, 'assets', name))
  }

  if (unresolved.size > 0) {
    console.warn(`Blog content generated with ${unresolved.size} unresolved Obsidian references:`)
    for (const warning of Array.from(unresolved).slice(0, 40)) console.warn(`- ${warning}`)
    if (unresolved.size > 40) console.warn(`- …and ${unresolved.size - 40} more`)
  }
  if (invalidHeadingFragments.size > 0) {
    console.warn(
      `Dropped ${invalidHeadingFragments.size} source-authored heading fragments whose target heading does not exist:`,
    )
    for (const warning of invalidHeadingFragments) console.warn(`- ${warning}`)
  }

  await rm(generatedContentRoot, { recursive: true, force: true })
  await rename(temporaryContentRoot, generatedContentRoot)

  const commit = runGit(['-C', cacheRoot, 'rev-parse', 'HEAD'], { capture: true })
  const commitDate = runGit(['-C', cacheRoot, 'show', '-s', '--format=%cI', 'HEAD'], { capture: true })
  const sectionCounts = Object.fromEntries(
    catalogSections.map((section) => [
      section.id,
      articles.filter((article) => article.sectionId === section.id).length,
    ]),
  )

  const graphDirectories = []
  const graphDirectoryEdges = []
  const graphDirectoryIds = new Map()
  const directoryKey = (sectionId, path) => `${sectionId}\u0000${path.join('\u0000')}`
  const ensureDirectory = (section, path) => {
    const key = directoryKey(section.id, path)
    const existing = graphDirectoryIds.get(key)
    if (existing) return existing
    const id = `directory-${createHash('sha256').update(key.normalize('NFC')).digest('hex').slice(0, 16)}`
    const parentPath = path.slice(0, -1)
    const parentId = path.length > 0 ? ensureDirectory(section, parentPath) : undefined
    graphDirectoryIds.set(key, id)
    graphDirectories.push({
      id,
      sectionId: section.id,
      path,
      label: path.at(-1) ?? section.directory,
      ...(parentId ? { parentId } : {}),
    })
    if (parentId) graphDirectoryEdges.push({ source: parentId, target: id, type: 'directory' })
    return id
  }

  for (const section of catalogSections) ensureDirectory(section, [])
  const graphArticles = articles.map((article) => {
    const section = catalogSections.find((candidate) => candidate.id === article.sectionId)
    if (!section) throw new Error(`Cannot build graph directory for unknown section: ${article.sectionId}`)
    const directoryId = ensureDirectory(section, article.categoryPath)
    graphDirectoryEdges.push({ source: directoryId, target: article.id, type: 'directory' })
    return { id: article.id, directoryId }
  })
  const linkedArticleIds = new Set()
  for (const link of graphWikiLinks.values()) {
    linkedArticleIds.add(link.source)
    linkedArticleIds.add(link.target)
  }
  const isolatedArticleIds = articles
    .map((article) => article.id)
    .filter((articleId) => !linkedArticleIds.has(articleId))

  return {
    schemaVersion: 3,
    source: {
      repository: repository.replace(/\.git$/, ''),
      ref: repositoryRef,
      commit,
      commitDate,
    },
    sections: catalogSections.map(({ id, directory }) => ({ id, sourceDirectory: directory })),
    articleCount: articles.length,
    content: {
      articlePayloads: payloadSummaries.length,
      localAssets: registeredAssets.size,
      unresolvedReferences: unresolved.size,
      invalidHeadingFragments: invalidHeadingFragments.size,
    },
    sectionCounts,
    articles,
    graph: {
      articleNodes: graphArticles,
      directoryNodes: graphDirectories,
      directoryEdges: graphDirectoryEdges,
      wikilinkEdges: Array.from(graphWikiLinks.values()),
      unresolvedLinks: Array.from(graphBrokenWikiLinks.values()),
      isolatedArticleIds,
    },
  }
}

try {
  await syncRepository()
  const catalog = await buildCatalog()
  const temporaryPath = `${generatedPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, generatedPath)

  const counts = catalog.sections
    .map((section) => `${section.sourceDirectory}: ${catalog.sectionCounts[section.id]}`)
    .join(', ')
  console.log(`Generated ${catalog.articleCount} blog articles from ${catalog.source.commit.slice(0, 12)}.`)
  console.log(counts)
  console.log(
    `Wrote ${catalog.content.articlePayloads} local article payloads and ${catalog.content.localAssets} local assets; ${catalog.content.unresolvedReferences} unresolved references, ${catalog.content.invalidHeadingFragments} invalid heading fragments removed.`,
  )
} catch (error) {
  console.error(`Blog note synchronization failed: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
}
