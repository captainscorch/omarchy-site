import { t } from '@/i18n/site'
import type { SearchEntry } from '@/lib/content'

/**
 * The palette's standing menu, shaped like the one SUPER+SPACE opens on the
 * desktop: a short root of destinations you can walk into, rather than an
 * empty field that asks you to already know what you want.
 *
 * Ids are dotted the way omarchy-menu's are, so a child names its parent and
 * the tree needs no nesting to read. A row either goes somewhere (`to`, `href`)
 * or opens a submenu; the submenus that list content are filled in from the
 * search index once it arrives, since it already carries every chapter, post,
 * theme and plugin the site knows about.
 */

export type MenuIcon =
  | 'manual'
  | 'news'
  | 'themes'
  | 'plugins'
  | 'install'
  | 'community'
  | 'foundation'
  | 'about'
  | 'page'
  | 'meetups'
  | 'teams'
  | 'discord'
  | 'github'
  | 'security'
  | 'patrons'
  | 'brand'
  | 'server'

export type MenuItem = {
  id: string
  label: string
  icon: MenuIcon
  /** In-site destination, handed to the router. */
  to?: string
  /** Anchor to scroll to once `to` has rendered. */
  hash?: string
  /** External destination; opens in a new tab. */
  href?: string
  /** Filled in from the search index rather than listed here. */
  provider?: 'manual' | 'news'
  /** Header shown while the submenu is open; defaults to the label. */
  title?: string
}

/** The whole tree, flat. `parentOf` reads the hierarchy back out of the ids. */
const ITEMS: Array<MenuItem> = [
  // Root
  { id: 'manual', label: 'Manual', icon: 'manual', provider: 'manual' },
  { id: 'news', label: 'News', icon: 'news', provider: 'news' },
  { id: 'themes', label: 'Themes', icon: 'themes', to: '/themes/' },
  {
    id: 'plugins',
    label: 'Plugins',
    icon: 'plugins',
    href: 'https://plugins.omarchy.org',
  },
  {
    id: 'install',
    label: 'Install',
    icon: 'install',
    to: '/',
    hash: 'install',
  },
  { id: 'community', label: 'Community', icon: 'community' },
  { id: 'foundation', label: 'Foundation', icon: 'foundation' },
  { id: 'about', label: 'About', icon: 'about' },

  // Community
  {
    id: 'community.meetups',
    label: 'Meetups',
    icon: 'meetups',
    to: '/meetups/',
  },
  { id: 'community.teams', label: 'Teams', icon: 'teams', to: '/teams/' },
  {
    id: 'community.workstations',
    label: 'Workstations',
    icon: 'page',
    to: '/workstations/',
  },
  {
    id: 'community.discord',
    label: 'Discord',
    icon: 'discord',
    href: 'https://discord.gg/tXFUdasqhY',
  },
  {
    id: 'community.github',
    label: 'GitHub',
    icon: 'github',
    href: 'https://github.com/omacom/omarchy',
  },

  // Foundation
  {
    id: 'foundation.about',
    label: 'The Foundation',
    icon: 'foundation',
    to: '/foundation/',
  },
  {
    id: 'foundation.patrons',
    label: 'Patrons',
    icon: 'patrons',
    to: '/patrons/',
  },
  {
    id: 'foundation.sponsorships',
    label: 'Sponsorships',
    icon: 'patrons',
    to: '/sponsorships/',
  },
  { id: 'foundation.staff', label: 'Staff', icon: 'teams', to: '/staff/' },
  {
    id: 'foundation.air',
    label: 'Artists in Residence',
    icon: 'page',
    to: '/air/',
  },

  // About
  { id: 'about.doctrine', label: 'Doctrine', icon: 'page', to: '/doctrine/' },
  { id: 'about.brand', label: 'Brand', icon: 'brand', to: '/brand/' },
  { id: 'about.omakub', label: 'Omakub', icon: 'page', to: '/omakub/' },
  {
    id: 'about.server',
    label: 'Omarchy Server',
    icon: 'server',
    to: '/server/',
  },
  {
    id: 'about.potato',
    label: 'Potato Hardware',
    icon: 'page',
    to: '/potato/',
  },
  {
    id: 'about.security',
    label: 'Security',
    icon: 'security',
    to: '/security/',
  },
]

const parentOf = (id: string) =>
  id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : 'root'

/** Rows shown for a menu id, in the order they are declared. */
export function childrenOf(menu: string): Array<MenuItem> {
  return ITEMS.filter((item) => parentOf(item.id) === menu)
}

export const menuItem = (id: string) => ITEMS.find((item) => item.id === id)

/** A row opens a submenu when it has children of its own or a provider. */
export const opensMenu = (item: MenuItem) =>
  !!item.provider || childrenOf(item.id).length > 0

export const menuTitle = (menu: string) => {
  const item = menuItem(menu)
  return t(item?.title ?? item?.label ?? 'Go')
}

/**
 * Index entries dressed as menu rows. Manual chapters only - the per-heading
 * entries are for searching, and listing them here would bury the chapters.
 * Themes and plugins are not here: each is one destination, so a submenu of
 * them was a list whose every row went to the same page. They stay reachable
 * by search, which is where a specific theme or plugin was always found.
 */
export function providerRows(
  provider: MenuItem['provider'],
  index: Array<SearchEntry> | null,
): Array<MenuItem> {
  if (!provider || !index) return []
  if (provider === 'manual')
    return index
      .filter((entry) => entry.kind === 'manual' && !entry.heading)
      .map((entry) => ({
        id: `manual.${entry.slug}`,
        label: entry.title,
        icon: 'manual' as const,
        to: entry.slug === 'index' ? '/manual/' : `/manual/${entry.slug}/`,
      }))
  return index
    .filter((entry) => entry.kind === 'news')
    .map((entry) => ({
      id: `news.${entry.slug}`,
      label: entry.title,
      icon: 'news' as const,
      to: `/news/${entry.year}/${entry.month}/${entry.slug}/`,
    }))
}

/** Substring match on the label, the way the desktop menu filters a submenu. */
export function filterRows(rows: Array<MenuItem>, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return rows
  return rows.filter((row) => {
    const label = t(row.label).toLowerCase()
    return terms.every((term) => label.includes(term))
  })
}
