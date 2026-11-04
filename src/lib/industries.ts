import {
  Banknote,
  BookOpen,
  Boxes,
  BrickWall,
  Briefcase,
  Building,
  Building2,
  Calculator,
  Camera,
  Car,
  Clapperboard,
  Code,
  Cog,
  Dumbbell,
  Factory,
  FlaskConical,
  Gem,
  Globe,
  GraduationCap,
  Hammer,
  HandHeart,
  HardHat,
  HeartPulse,
  Hospital,
  Hotel,
  House,
  Landmark,
  Lightbulb,
  Megaphone,
  Microscope,
  MonitorPlay,
  PartyPopper,
  PawPrint,
  PencilRuler,
  Pill,
  Plane,
  Printer,
  Scale,
  School,
  Scissors,
  Shapes,
  Ship,
  Shirt,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sofa,
  Sparkles,
  Sprout,
  Stethoscope,
  Store,
  Sun,
  Truck,
  Tv,
  Users,
  UtensilsCrossed,
  Wheat,
  Wifi,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { createElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/http'
import { qk } from './queryKeys'

/** One row of the industry master list (GET /api/meta/industries; backend `industries` table). */
export interface Industry {
  id: string
  slug: string
  name: string
  /** lucide-react icon name, resolved through the registry below. */
  icon: string
  /** Shown as a tile on onboarding; the rest are found by search. */
  featured: boolean
  keywords: string[]
  /** Pipeline template the workspace starts with; null → general. */
  pipelineTemplate: string | null
}

/**
 * Icons the industries table names (industries.icon). Listed explicitly so the bundle only carries
 * these; an industry with an icon not listed here shows a generic shape until it's added.
 */
const icons: Record<string, LucideIcon> = {
  Banknote,
  BookOpen,
  Boxes,
  BrickWall,
  Briefcase,
  Building,
  Building2,
  Calculator,
  Camera,
  Car,
  Clapperboard,
  Code,
  Cog,
  Dumbbell,
  Factory,
  FlaskConical,
  Gem,
  Globe,
  GraduationCap,
  Hammer,
  HandHeart,
  HardHat,
  HeartPulse,
  Hospital,
  Hotel,
  House,
  Landmark,
  Lightbulb,
  Megaphone,
  Microscope,
  MonitorPlay,
  PartyPopper,
  PawPrint,
  PencilRuler,
  Pill,
  Plane,
  Printer,
  Scale,
  School,
  Scissors,
  Shapes,
  Ship,
  Shirt,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sofa,
  Sparkles,
  Sprout,
  Stethoscope,
  Store,
  Sun,
  Truck,
  Tv,
  Users,
  UtensilsCrossed,
  Wheat,
  Wifi,
  Wrench,
}

/** The active industries, in display order. Rarely changes, so it's cached for the session. */
export function useIndustries() {
  const query = useQuery({
    queryKey: qk.industries,
    queryFn: () => api<{ industries: Industry[] }>('/meta/industries').then((d) => d.industries),
    staleTime: 30 * 60 * 1000,
    gcTime: Infinity,
  })
  return { ...query, industries: query.data ?? [] }
}

const isOther = (i: Industry) => i.slug === 'other'

/** For selects: A–Z, with "Other" last. */
export function sortForSelect(list: Industry[]) {
  return [...list].sort((a, b) => Number(isOther(a)) - Number(isOther(b)) || a.name.localeCompare(b.name))
}

export function iconFor(icon?: string | null): LucideIcon {
  return (icon && icons[icon]) || Shapes
}

/** An industry's icon by its lucide name, e.g. <IndustryIcon icon={industry.icon} className="size-4" />. */
export function IndustryIcon({ icon, className }: { icon?: string | null; className?: string }) {
  return createElement(iconFor(icon), { className, 'aria-hidden': true })
}

const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Ranks: exact word in the name or a keyword ("CA", "gym", "car") or a name prefix → a name word
 * prefix → a keyword word prefix → (3+ characters only) anywhere. "Other" never matches a search.
 */
export function searchIndustries(list: Industry[], query: string, limit = 8): Industry[] {
  const q = normalise(query)
  if (!q) return []
  const words = (s: string) => normalise(s).split(' ')
  return list
    .filter((i) => !isOther(i))
    .map((i) => {
      const nameWords = words(i.name)
      const keywordWords = i.keywords.flatMap(words)
      const haystack = [i.name, ...i.keywords].map(normalise)
      const score =
        normalise(i.name).startsWith(q) || nameWords.includes(q) || i.keywords.some((k) => normalise(k) === q) || keywordWords.includes(q)
          ? 0
          : nameWords.some((w) => w.startsWith(q))
            ? 1
            : keywordWords.some((w) => w.startsWith(q)) || haystack.some((h) => h.startsWith(q))
              ? 2
              : q.length >= 3 && haystack.some((h) => h.includes(q))
                ? 3
                : -1
      return { i, score }
    })
    .filter((r) => r.score >= 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((r) => r.i)
}
