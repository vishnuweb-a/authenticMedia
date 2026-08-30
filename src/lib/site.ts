/**
 * Organisation details.
 *
 * Every value here is verified in the reference captures (SCREEN-MAP.md →
 * Contact / Footer). Treat it as content, not as invented placeholder copy.
 */
export const SITE = {
  legalName: 'Authentic Media and IT Sector Private Limited',
  shortName: 'Authentic Media',
  description:
    'Technology-driven solutions for businesses that want to grow, stay secure, and move forward.',
  email: 'contact@authenticmedia.fun',
  phone: '7669438261',
  website: 'authenticmedia.fun',
  address: {
    lines: [
      'UNIT NO 44, FORTH FLOOR, TOWER A,',
      'PLOT NO A-16, ITHUM HEIGHTS,',
      'SECTOR 62, Noida, UP-201301, India',
    ],
    single:
      'UNIT NO 44, FORTH FLOOR, TOWER A, PLOT NO A-16, ITHUM HEIGHTS, SECTOR 62, Noida, UP-201301, India',
  },
  copyrightYear: 2026,
} as const

/**
 * Social destinations. The three tiles are verified in the footer capture; the
 * URLs themselves were never visible, so they stay as placeholders until real
 * profile links are supplied.
 */
export const SOCIAL_LINKS = [
  { label: 'LinkedIn', href: '#', icon: 'linkedin' },
  { label: 'X', href: '#', icon: 'x' },
  { label: 'Instagram', href: '#', icon: 'instagram' },
] as const
