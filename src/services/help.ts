/** Help Center content. Swap for a docs API while keeping these return types. */
import helpJson from '../data/help.json'
import type { HelpArticle, HelpCategory } from '../types'

export const help = {
  categories: helpJson.categories as HelpCategory[],
  articles: helpJson.articles as HelpArticle[],
}

export function getHelpArticle(slug: string) {
  return help.articles.find((a) => a.slug === slug)
}
