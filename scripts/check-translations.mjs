import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import locales from '../src/i18n/locales.json' with { type: 'json' }

const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
const posts = json('src/data/news-posts.json')
const messages = new Set()
const problems = []
const args = process.argv.slice(2)
const strictNews = args.includes('--strict-news')
const pendingNews = args.includes('--pending-news')
const selected = args.filter(
  (arg) => !['--strict-news', '--pending-news'].includes(arg),
)
const sourceHash = (post) =>
  createHash('sha256').update(`${post.title}\n${post.html}`).digest('hex')
const articleStatus = (contentLocale, news, post) => {
  const translated = news[post.slug]
  if (
    !translated?.title?.trim() ||
    !existsSync(`src/i18n/${contentLocale}/news/${post.slug}.html`) ||
    !readFileSync(
      `src/i18n/${contentLocale}/news/${post.slug}.html`,
      'utf8',
    ).trim()
  )
    return 'missing'
  if (translated.sourceHash !== sourceHash(post)) return 'stale'
  return null
}
for (const code of selected) {
  if (!Object.hasOwn(locales, code)) problems.push(`Unknown locale: ${code}`)
}
// Queue inspection is independent of UI validation and writes only JSON to stdout.
if (pendingNews) {
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  const pending = []
  const seen = new Set()
  for (const [code, locale] of Object.entries(locales)) {
    if (selected.length && !selected.includes(code)) continue
    const contentLocale = locale.contentLocale ?? code
    if (contentLocale === 'en' || seen.has(contentLocale)) continue
    seen.add(contentLocale)
    const file = `src/i18n/${contentLocale}/news.json`
    const news = existsSync(file) ? json(file) : {}
    for (const post of posts) {
      const reason = articleStatus(contentLocale, news, post)
      if (reason)
        pending.push({
          locale: contentLocale,
          slug: post.slug,
          reason,
          sourceHash: sourceHash(post),
        })
    }
  }
  console.log(JSON.stringify(pending, null, 2))
  process.exit(0)
}
const referenceMessages = json('src/i18n/messages/da.json')
const referenceBlocks = json('src/i18n/da/blocks.json')
const references = (html, attribute) =>
  [...html.matchAll(new RegExp(`${attribute}="([^"]*)"`, 'g'))]
    .map((match) => match[1])
    .sort()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'parked' || entry.name === 'i18n') continue
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) collect(file)
    else if (/\.(tsx?|astro)$/.test(file)) {
      // Astro frontmatter and template calls also use t('literal').
      const source = readFileSync(file, 'utf8')
      const tree = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      const visit = (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 't' &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        )
          messages.add(node.arguments[0].text)
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
  }
}
collect('src')
const domains = new Set()
for (const [code, locale] of Object.entries(locales)) {
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(code))
    problems.push(`Invalid language code: ${code}`)
  const url = new URL(locale.domain)
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    domains.has(url.hostname)
  )
    problems.push(`Invalid or duplicate domain: ${locale.domain}`)
  domains.add(url.hostname)
  if (locale.direction && !['ltr', 'rtl'].includes(locale.direction))
    problems.push(`Invalid text direction: ${code}`)
  if (locale.flag && !/^[A-Z]{2}$/.test(locale.flag))
    problems.push(`Invalid flag country code: ${code}`)
  new Intl.DateTimeFormat(locale.formatLocale)
  const contentLocale = locale.contentLocale ?? code
  if (contentLocale === 'en' || (selected.length && !selected.includes(code)))
    continue
  const files = [
    `src/i18n/messages/${contentLocale}.json`,
    `src/i18n/${contentLocale}/blocks.json`,
  ]
  const missing = files.filter((file) => !existsSync(file))
  if (missing.length) {
    problems.push(...missing.map((file) => `${code}: missing ${file}`))
    continue
  }
  const catalogue = json(`src/i18n/messages/${contentLocale}.json`)
  for (const message of new Set([
    ...messages,
    ...Object.keys(referenceMessages),
  ])) {
    if (!catalogue[message])
      problems.push(`${code}: missing message: ${message}`)
  }
  const blocks = json(`src/i18n/${contentLocale}/blocks.json`)
  for (const source of Object.keys(referenceBlocks)) {
    if (!blocks[source]?.trim()) {
      problems.push(`${code}: missing prose: ${source}`)
      continue
    }
    for (const attribute of ['href', 'src']) {
      if (
        !same(
          references(source, attribute),
          references(blocks[source], attribute),
        )
      )
        problems.push(
          `${code}: prose ${attribute} references differ: ${source}`,
        )
    }
  }
  const newsFile = `src/i18n/${contentLocale}/news.json`
  const news = existsSync(newsFile) ? json(newsFile) : {}
  for (const post of posts) {
    const status = articleStatus(contentLocale, news, post)
    if (status) {
      if (strictNews)
        problems.push(
          status === 'missing'
            ? `${code}: missing article: ${post.slug}`
            : `${code}: source article changed; review translation: ${post.slug}`,
        )
    } else {
      const html = readFileSync(
        `src/i18n/${contentLocale}/news/${post.slug}.html`,
        'utf8',
      )
      for (const attribute of ['href', 'src']) {
        const values = (text) =>
          [
            ...new Set(
              [
                ...text.matchAll(new RegExp(`${attribute}="([^"\\s]+)"`, 'g')),
              ].map((match) => match[1]),
            ),
          ].sort()
        if (JSON.stringify(values(post.html)) !== JSON.stringify(values(html)))
          problems.push(
            `${code}: article ${attribute} references differ: ${post.slug}`,
          )
      }
    }
  }
  if (!existsSync(`src/i18n/${contentLocale}/blocks.json`))
    problems.push(`${code}: missing main-page prose catalogue`)
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(
  `Translations checked: ${(selected.length ? selected : Object.keys(locales)).join(', ')}; ${messages.size} UI messages, ${posts.length} news articles per language.`,
)
