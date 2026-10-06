import { expect, it, vi } from 'vitest'
import { classify, defaultModel } from '../lib/classify'
import { deal, now } from './helpers'

const candidate = (id = 'a') => deal({ id, category: 'informatica', price: 99, listPrice: 1199, discountPct: 91.7, errorScore: 100 })
const item = (id = 'a') => ({ id, product: '<b>Lenovo</b> https://example.test/p', category: 'informatica', verdict: 'error', confidence: .9, note: 'Posible error. https://example.test/x' })
const response = (items: unknown[]) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items }) } }] }))
const env = { LLM_API_KEY: 'fixture-secret-value', LLM_FALLBACK_MODELS: '' }

it('never calls the provider without a key and omits classifier status', async () => {
  const fetcher = vi.fn()
  const result = await classify([candidate()], {}, now, {}, fetcher)
  expect(fetcher).not.toHaveBeenCalled()
  expect(result.classifier).toBeUndefined()
})
it('validates the whole batch, sanitizes strings, caches by price and sends attribution', async () => {
  const fetcher = vi.fn(async (_url, init) => {
    const request = JSON.parse(init.body)
    expect(init.headers.Authorization).toBe('Bearer fixture-secret-value')
    expect(init.headers['HTTP-Referer']).toBe('https://barato.si')
    expect(init.headers['X-Title']).toBe('barato.si')
    expect(request.temperature).toBe(0)
    expect(request.response_format).toEqual({ type: 'json_object' })
    expect(JSON.parse(request.messages[1].content)[0].text.length).toBe(300)
    return response([item()])
  })
  const result = await classify([{ ...candidate(), sourceText: 'x'.repeat(500) }], env, now, {}, fetcher)
  expect(result.classifier).toMatchObject({ ok: true, classified: 1, cached: 0 })
  expect(result.deals[0]?.ai).toMatchObject({ product: 'Lenovo', note: 'Posible error.' })
  const cached = await classify([candidate()], env, now, result.cache, fetcher)
  expect(cached.classifier?.cached).toBe(1)
  expect(fetcher).toHaveBeenCalledTimes(1)
  const changed = vi.fn(async () => response([item()]))
  const reclassified = await classify([{ ...candidate(), price: 100 }], env, now, result.cache, changed)
  expect(changed).toHaveBeenCalledTimes(1)
  expect(reclassified.cache.a?.price).toBe(100)
})
it.each([
  [{ ...item(), id: 'unknown' }], [{ ...item(), confidence: '0.9' }], [{ ...item(), confidence: 2 }],
  [{ ...item(), category: 'unknown' }], [{ ...item(), verdict: 'maybe' }], [{ ...item(), note: 5 }], [],
])('discards invalid batches without partially applying valid rows: %j', async invalid => {
  const fetcher = vi.fn(async () => response([item('b'), ...invalid]))
  const result = await classify([candidate('b'), candidate()], env, now, {}, fetcher)
  expect(result.deals.every(d => !d.ai)).toBe(true)
  expect(result.cache).toEqual({})
  expect(result.classifier).toMatchObject({ ok: false, classified: 0 })
})
it.each([429, 503, 200])('tries fallback after HTTP %s or invalid JSON', async status => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('invalid', { status })).mockImplementationOnce(async () => response([item()]))
  const result = await classify([candidate()], { ...env, LLM_FALLBACK_MODELS: 'fallback-model' }, now, {}, fetcher)
  expect(result.classifier).toMatchObject({ ok: true, model: 'fallback-model', classified: 1 })
  expect(JSON.parse(fetcher.mock.calls[1]![1].body).model).toBe('fallback-model')
})
it('never outputs a key echoed in provider errors, content or cached strings', async () => {
  for (const fetcher of [vi.fn().mockRejectedValue(new Error('Oops ' + env.LLM_API_KEY)), vi.fn(async () => response([{ ...item(), note: env.LLM_API_KEY }]))]) {
    const result = await classify([candidate()], env, now, {}, fetcher)
    expect(JSON.stringify(result)).not.toContain(env.LLM_API_KEY)
    expect(result.classifier?.ok).toBe(false)
  }
})
it('caps candidates at 150, batches at 25, and failed requests at eight', async () => {
  const deals = Array.from({ length: 200 }, (_, i) => candidate(String(i)))
  const success = vi.fn(async (_url, init) => response(JSON.parse(JSON.parse(init.body).messages[1].content).map((d: any) => item(d.id))))
  const result = await classify(deals, env, now, {}, success)
  expect(result.classifier?.classified).toBe(150)
  expect(success).toHaveBeenCalledTimes(6)
  const failure = vi.fn(async () => new Response('', { status: 429 }))
  await classify(deals, { ...env, LLM_FALLBACK_MODELS: 'second,third' }, now, {}, failure)
  expect(failure).toHaveBeenCalledTimes(8)
})
it('prunes stale cache entries and excludes games', async () => {
  const fetcher = vi.fn()
  const result = await classify([{ ...candidate(), category: 'videojuegos' }], env, now, { stale: { price: 1, date: '2020-01-01', ai: { ...item(), category: 'informatica', verdict: 'error', model: defaultModel } } }, fetcher)
  expect(result.cache).toEqual({})
  expect(fetcher).not.toHaveBeenCalled()
})
it('bounds an unresponsive provider with a 45-second timeout', async () => {
  vi.useFakeTimers()
  try {
    const fetcher = vi.fn(() => new Promise<Response>(() => {}))
    const pending = classify([candidate()], env, now, {}, fetcher)
    await vi.advanceTimersByTimeAsync(45001)
    expect((await pending).classifier?.ok).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  } finally { vi.useRealTimers() }
})
