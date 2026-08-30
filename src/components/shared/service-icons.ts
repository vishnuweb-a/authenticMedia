import {
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Cloud,
  CreditCard,
  Gauge,
  Globe,
  LayoutGrid,
  LifeBuoy,
  Lock,
  Mail,
  MapPin,
  Package,
  Palette,
  Phone,
  Plug,
  RefreshCw,
  Search,
  Shield,
  Target,
  TrendingUp,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * The reference renders service glyphs as emoji characters, which look
 * different on every platform and are not accessible. DESIGN-SYSTEM.md →
 * Iconography recommends replacing them with a consistent set at identical size
 * and placement, so this registry maps each service to a Lucide icon.
 *
 * Feature sessions add keys here rather than importing icons ad hoc, which
 * keeps one icon vocabulary across the app.
 */
export const SERVICE_ICONS = {
  wrench: Wrench,
  card: CreditCard,
  box: Package,
  sync: RefreshCw,
  shield: Shield,
  chart: BarChart3,
  cloud: Cloud,
  palette: Palette,
  lock: Lock,
  trending: Gauge,
  globe: Globe,
  support: LifeBuoy,
  integration: Plug,
  app: LayoutGrid,
  audit: Search,
  target: Target,
  bot: Bot,
  seo: TrendingUp,
  bolt: Zap,
  mail: Mail,
  phone: Phone,
  pin: MapPin,
  clock: Clock,
  check: CheckCircle2,
} as const satisfies Record<string, LucideIcon>

export type ServiceIconName = keyof typeof SERVICE_ICONS

export function isServiceIconName(value: string): value is ServiceIconName {
  return value in SERVICE_ICONS
}
