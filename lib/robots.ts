export const USER_AGENT = 'barato.si deals bot; +https://barato.si/llms.txt'

export function robotsAllowed(text: string, url: string, agent = USER_AGENT): boolean {
  if (/<(?:html|!doctype)/i.test(text)) return false
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []
  let group = { agents: [] as string[], rules: [] as { allow: boolean; path: string }[] }
  let hasDirectives = false
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(line.split('#')[0]!)
    if (!match) continue
    const [, rawKey, value] = match
    const key = rawKey!.toLowerCase()
    if (key === 'user-agent') {
      if (hasDirectives) { groups.push(group); group = { agents: [], rules: [] }; hasDirectives = false }
      group.agents.push(value!.toLowerCase())
    } else if (group.agents.length) {
      hasDirectives = true
      if (['allow', 'disallow'].includes(key) && value) group.rules.push({ allow: key === 'allow', path: value })
    }
  }
  groups.push(group)
  const specificity = (g: typeof group) => Math.max(-1, ...g.agents.map(a => a === '*' ? 0 : agent.toLowerCase().includes(a) ? a.length : -1))
  const best = Math.max(-1, ...groups.map(specificity))
  const target = new URL(url).pathname + new URL(url).search
  const matched = groups.filter(g => specificity(g) === best).flatMap(g => g.rules).filter(r => {
    const end = r.path.endsWith('$')
    const path = end ? r.path.slice(0, -1) : r.path
    const pattern = path.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
    return new RegExp('^' + pattern + (end ? '$' : '')).test(target)
  }).sort((a, b) => b.path.replace(/[*$]/g, '').length - a.path.replace(/[*$]/g, '').length || Number(b.allow) - Number(a.allow))
  return matched[0]?.allow ?? true
}
