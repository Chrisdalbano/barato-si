import { expect, it } from 'vitest'
import { robotsAllowed } from '../lib/robots'

it('uses most specific agent, longest rule, allow on equal length', () => {
  const policy = 'User-agent: *\nDisallow: /\nUser-agent: barato.si\nDisallow: /api\nAllow: /api/open\nDisallow: /api/open/private\nAllow: /api/open/private'
  expect(robotsAllowed(policy, 'https://test/api/open/private')).toBe(true)
  expect(robotsAllowed(policy, 'https://test/api/secret')).toBe(false)
  expect(robotsAllowed(policy, 'https://test/hello')).toBe(true)
})
it('handles wildcards, query strings, terminal anchors, repeated groups, and empty disallows', () => {
  const policy = 'User-agent: *\nDisallow:\nDisallow: /*?*rss=*\nUser-agent: *\nDisallow: /secret$'
  expect(robotsAllowed(policy, 'https://test/?rss=1')).toBe(false)
  expect(robotsAllowed(policy, 'https://test/secret')).toBe(false)
  expect(robotsAllowed(policy, 'https://test/secrets')).toBe(true)
  expect(robotsAllowed('<html>challenge</html>', 'https://test/')).toBe(false)
})
