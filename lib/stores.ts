const merchants: [string, string][] = [
  ['Steam', 'store.steampowered.com'], ['GOG', 'gog.com'], ['Humble Store', 'humblebundle.com'], ['Fanatical', 'fanatical.com'], ['GreenManGaming', 'greenmangaming.com'], ['Gamesplanet', 'gamesplanet.com'], ['IndieGala', 'indiegala.com'], ['GameBillet', 'gamebillet.com'], ['Epic Games Store', 'store.epicgames.com'],
  ['Amazon', 'amazon.com'], ['Walmart', 'walmart.com'], ['Best Buy', 'bestbuy.com'], ["Macy's", 'macys.com'], ['Target', 'target.com'], ['eBay', 'ebay.com'], ['Newegg', 'newegg.com'], ['Home Depot', 'homedepot.com'], ["Lowe's", 'lowes.com'], ['Woot', 'woot.com'], ['B&H', 'bhphotovideo.com'], ['Adorama', 'adorama.com'], ['Dell', 'dell.com'], ['Lenovo', 'lenovo.com'], ['HP', 'hp.com'],
  ['GamersGate', 'gamersgate.com'], ['WinGameStore', 'wingamestore.com'], ['Gamesload', 'gamesload.com'], ['2Game', '2game.com'], ['DLGamer', 'dlgamer.com'], ['AllYouPlay', 'allyouplay.com'], ['Noctre', 'noctre.com'], ['DreamGame', 'dreamgame.com'], ['Voidu', 'voidu.com'], ['Blizzard Shop', 'shop.battle.net'],
]
export function storeDomain(store: string): string | null {
  return merchants.find(([name]) => name.toLowerCase() === store.toLowerCase() || name === 'Epic Games Store' && store === 'Epic Games')?.[1] || null
}
export function merchant(url: string): { store: string; storeDomain: string } {
  const host = new URL(url).hostname.replace(/^www\./, '')
  const match = merchants.find(([, domain]) => host === domain || host.endsWith('.' + domain))
  return { store: match?.[0] || host, storeDomain: match?.[1] || host }
}
export function httpsImage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try { const url = new URL(value.startsWith('//') ? 'https:' + value : value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
}
