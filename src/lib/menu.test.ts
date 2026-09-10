import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SearchEntry } from '../astro/search-index.ts'
import {
  childrenOf,
  filterRows,
  menuItem,
  menuTitle,
  opensMenu,
  providerRows,
} from './menu.ts'

const chapter = (
  slug: string,
  title: string,
  heading: string | null,
): SearchEntry => ({
  kind: 'manual',
  slug,
  title,
  heading,
  hash: heading && heading.toLowerCase(),
  text: 'body',
})

const post: SearchEntry = {
  kind: 'news',
  slug: 'hello',
  year: '2026',
  month: '09',
  title: 'Hello',
  meta: 'September 2026',
  text: 'body',
}

test('every manual chapter is listed once, in index order, even one that opens with a heading', () => {
  const index = [
    chapter('index', 'Getting started', null),
    chapter('index', 'Getting started', 'Install'),
    // No headingless entry: the chapter's text starts under its first heading.
    chapter('faq', 'FAQ', 'Why Hyprland?'),
    chapter('faq', 'FAQ', 'Why Arch?'),
    chapter('tuis', 'TUIs', null),
    post,
  ]
  assert.deepEqual(
    providerRows('manual', index).map((row) => [row.id, row.label, row.to]),
    [
      ['manual.index', 'Getting started', '/manual/'],
      ['manual.faq', 'FAQ', '/manual/faq/'],
      ['manual.tuis', 'TUIs', '/manual/tuis/'],
    ],
  )
})

test('news rows carry the dated path and nothing from the manual', () => {
  assert.deepEqual(
    providerRows('news', [chapter('faq', 'FAQ', null), post]).map((row) => [
      row.id,
      row.to,
    ]),
    [['news.hello', '/news/2026/09/hello/']],
  )
  assert.deepEqual(providerRows('news', null), [])
  assert.deepEqual(providerRows(undefined, [post]), [])
})

test('filtering keeps the rows whose label contains every term', () => {
  const root = childrenOf('root')
  assert.deepEqual(
    filterRows(root, 'found').map((row) => row.id),
    ['foundation'],
  )
  assert.deepEqual(
    filterRows(root, 'ins TALL').map((row) => row.id),
    ['install'],
  )
  assert.deepEqual(filterRows(root, 'nothing like this'), [])
  assert.deepEqual(filterRows(root, '  '), root)
})

test('the tree reads out of the dotted ids', () => {
  assert.ok(childrenOf('root').length > 0)
  for (const row of childrenOf('community'))
    assert.ok(row.id.startsWith('community.'), row.id)
  assert.equal(opensMenu(menuItem('manual')!), true)
  assert.equal(opensMenu(menuItem('community')!), true)
  assert.equal(opensMenu(menuItem('themes')!), false)
  assert.equal(menuTitle('root'), 'Go')
  assert.equal(menuTitle('community'), menuItem('community')!.label)
})
