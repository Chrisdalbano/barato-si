import { affiliateLink, relFor } from '../utils/affiliate'
import { linkFor } from '../utils/deal'

/**
 * Outbound links for deals. With no Amazon tag configured (the default) this is
 * exactly linkFor() and rel="noopener". With a tag, only canonical amazon.com/dp
 * links without an existing tag gain ours, and say so with rel="sponsored".
 */
export function useOutbound() {
  const tag = String(useRuntimeConfig().public.amazonTag ?? '')
  const out = (deal: { url: string; storeUrl?: string | null }) => affiliateLink(linkFor(deal), tag)
  return {
    href: (deal: { url: string; storeUrl?: string | null }) => out(deal).href,
    rel: (deal: { url: string; storeUrl?: string | null }) => relFor(out(deal)),
  }
}
