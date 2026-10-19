/** Global site config and navigation — the only content the app shell loads eagerly. */
import siteJson from '../data/site.json'
import navigationJson from '../data/navigation.json'
import type { FooterColumn, NavGroup } from '../types'

export const site = siteJson

export const navigation = {
  main: navigationJson.main as NavGroup[],
  footer: navigationJson.footer as FooterColumn[],
}
