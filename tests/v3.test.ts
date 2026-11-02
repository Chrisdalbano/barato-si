import { verifyCandidates } from '../scripts/verify'
import { describe, expect, it } from 'vitest'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { productKey, brandOf, brandTier, isDirect } from '../lib/identity'
import { emptyLedger, mergeLedger, pruneLedger, seedLedger } from '../lib/ledger'
import { resolveReference } from '../lib/reference'
import { scoreDeal } from '../lib/rank'
import { applyGate, diversify, evidenceOf, rejection } from '../lib/interest'
import { scoreError } from '../lib/errors'
import { normalizeSource } from '../lib/normalize'
import { collect, readPrevious } from '../scripts/pipeline'
import { fireReasons, parseOffers, runWatch, notifyWatch, parseCamel, parseStorePage } from '../scripts/watch'
import { createSourceReader } from '../scripts/network'
import { deal } from './helpers'
const now = new Date('2026-11-02T12:00:00Z')
const laptop = deal({ title: 'Lenovo laptop RTX 4060', price: 99, listPrice: null, category: 'informatica', url:'https://www.amazon.com/dp/B012345678', store:'Amazon', storeDomain:'amazon.com' })
const key = productKey(laptop)
const archive = [29,30,31].map(day => ({date:'2026-10-'+day,deals:[{...laptop,price:1199}]}))
it('recognizes ASINs only on real Amazon/CCC hosts and brands at boundaries',()=>{
 expect(productKey(laptop)).toBe('asin:B012345678')
 expect(productKey({...laptop,url:'https://camelcamelcamel.com/product/B012345678'})).toBe(key)
 expect(productKey({...laptop,url:'https://amazon.com.evil.test/dp/B012345678'})).toBe('url:a')
 for(const brand of ['ASUS','NVIDIA','HP','Minisforum','Framework','DeWalt']) expect(brandTier(brandOf(brand+' workstation'))).toBe(1)
 expect(brandOf('helping flagship widget')).toBeNull()
 expect(isDirect({...laptop,storeUrl:'https://dealnews.com/item'})).toBe(false)
 expect(isDirect(laptop)).toBe(true)
})
it('keeps daily lows without mutation, excludes games and currencies, prunes and size-caps',()=>{
 const original = seedLedger(archive,now), snapshot=JSON.stringify(original)
 const next=mergeLedger(original,[laptop,{...laptop,price:109},{...laptop,currency:'EUR',price:1},deal({id:'game',category:'videojuegos'})],now)
 expect(next.products[key]!.series.at(-1)!.p).toBe(99)
 expect(next.products[key]!.series).toHaveLength(4)
 expect(JSON.stringify(original)).toBe(snapshot)
 expect(Object.keys(next.products)).toEqual([key])
 const pruned=pruneLedger(next,new Date('2027-03-02'))
 expect(pruned.products).toEqual({})
 const capped=pruneLedger(next,now,230)
 expect(new TextEncoder().encode(JSON.stringify(capped)+'\r\n').length).toBeLessThanOrEqual(230)
})
it('uses a prior-day median without list price, even after merging today',()=>{
 const ledger=mergeLedger(seedLedger(archive,now),[laptop],now)
 const ref=resolveReference(laptop,[laptop],ledger,[],now)
 expect(ref).toMatchObject({kind:'ledger',price:1199,observations:3})
 expect(scoreDeal({...laptop,reference:ref},now).errorScore).toBeGreaterThanOrEqual(70)
})
it('requires identical product/model and currency for cross-store evidence',()=>{
 const other={...laptop,store:'Other',storeDomain:'other.test',price:1199}
 expect(resolveReference(laptop,[other],emptyLedger(now),[],now)?.kind).toBe('cross-store')
 expect(resolveReference(laptop,[{...other,currency:'EUR'}],emptyLedger(now),[],now)).toBeUndefined()
 expect(resolveReference(laptop,[{...other,url:'https://other.test/another',id:'other'}],emptyLedger(now),[],now)).toBeUndefined()
 const tv={...laptop,title:'Sony XR75Z9K123 TV',url:'https://amazon.com/item',id:'tv'}
 expect(resolveReference(tv,[{...other,title:tv.title,url:'https://other.test/tv',id:'tv2'}],emptyLedger(now),[],now)?.kind).toBe('cross-store')
})
it('honors reference precedence and marks a conservative floor candidate',()=>{
 const curated=[{titleRegex:'RTX.*4060',kind:'spec-floor' as const,currency:'USD' as const,price:200,asOf:'2026-11-02',source:'Suelo editorial conservador'}]
 const ref=resolveReference(laptop,[],emptyLedger(now),curated,now)
 const result=scoreDeal({...laptop,reference:ref},now)
 expect(result.errorScore).toBeGreaterThanOrEqual(40)
 expect(result.errorSignals.join(' ')).toMatch(/Suelo conservador/)
 expect(resolveReference(laptop,[],seedLedger(archive,now),curated,now)?.kind).toBe('ledger')
 expect(resolveReference(laptop,[],emptyLedger(now),curated,new Date('2026-11-01'))).toBeUndefined()
})
it('retains noname, stable, game, roundup, coupon and refurb protections',()=>{
 expect(scoreDeal(deal({title:'Unknown laptop',price:1,listPrice:9999}),now).errorScore).toBeLessThan(40)
 const ref={price:1199,kind:'ledger' as const,note:'Mediana histórica'}
 const trusted={...laptop,reference:ref}
 expect(scoreDeal(trusted,now,{days:3,minPrice:99,maxPrice:99,firstSeen:'2026-10-28'}).errorScore).toBeLessThan(70)
 expect(scoreDeal({...trusted,category:'videojuegos',store:'Steam'},now).errorScore).toBeLessThanOrEqual(15)
 expect(scoreDeal({...trusted,title:'Laptop from $99'},now).errorScore).toBe(0)
 expect(scoreDeal({...trusted,title:'Lenovo refurbished laptop with code'},now).errorScore).toBeLessThan(scoreDeal(trusted,now).errorScore)
})
it('rejects stable slug categories, allows candidates but never roundups',()=>{
 for(const [category,reason] of [['ropa','apparel'],['belleza','beauty'],['alimentacion','food']]) expect(rejection(deal({category}))).toBe(reason)
 expect(rejection(deal({title:'Christmas tree'}))).toBe('seasonal-decor')
 expect(rejection(deal({title:'Gift card'}))).toBe('gift-card')
 expect(rejection({...laptop,errorScore:40,interest:0})).toBeUndefined()
 expect(rejection({...laptop,errorScore:70,title:'Laptops from $99'})).toBe('low-value')
 const input=[{...laptop,direct:true},{...laptop,direct:false,source:'Other'}], snapshot=JSON.stringify(input)
 const gate=applyGate(input)
 expect(JSON.stringify(input)).toBe(snapshot)
 expect(gate.gate.byReason['middleman-duplicate']).toBe(1)
})
it('parses CCC prices without interpreting the from suffix as a roundup',()=>{
 const raw='<rss><channel><item><title>ASUS monitor - down 47.72% ($9.12) to $9.99 from $19.11</title><link>https://camelcamelcamel.com/product/B012345678</link></item></channel></rss>'
 const [d]=normalizeSource({name:'CamelCamelCamel',kind:'camelcamelcamel',url:'https://camelcamelcamel.com/top_drops/feed'},raw,now)
 expect(d).toMatchObject({title:'ASUS monitor',price:9.99,storeUrl:laptop.url,url:laptop.url,direct:true,reference:{kind:'source-previous',price:19.11},productKey:key})
})
it('uses available Shopify configurations and their own compare prices only',()=>{
 const raw=JSON.stringify({products:[{title:'Minisforum computer',handle:'pc',variants:[{id:1,available:false,price:'1',compare_at_price:'999'},{id:2,title:'32GB',available:true,price:'299',compare_at_price:'399'}]}]})
 expect(normalizeSource({name:'Minisforum',kind:'shopify',url:'https://store.minisforum.com/products.json?limit=250',direct:true},raw,now)[0]).toMatchObject({price:299,listPrice:399,direct:true,productKey:'shopify:store.minisforum.com:pc',storeUrl:'https://store.minisforum.com/products/pc'})
})
it('reads Keepa documented deal schema; excludes out-of-stock price sentinels',async()=>{
 const raw=await readFile(new URL('./fixtures/keepa.json',import.meta.url),'utf8')
 const rows=normalizeSource({name:'Keepa',kind:'keepa',url:'https://api.keepa.com/deal'},raw,now)
 expect(rows).toHaveLength(1)
 expect(rows[0]).toMatchObject({price:99.99,direct:true,store:'Amazon'})
})
it('does not send Keepa credentials during robots preflight',async()=>{
 const calls: string[]=[]
 await createSourceReader((async(url)=>{calls.push(String(url)); return new Response(calls.length===1?'User-agent: *\nAllow: /':'{}')}) as typeof fetch)({name:'Keepa',kind:'keepa',url:'https://api.keepa.com/deal',apiKey:'secret'})
 expect(calls[0]).not.toContain('secret'); expect(calls[1]).toContain('key=secret')
})
it('passes pre-cap observations to ledger and uses ledger history across source IDs',async()=>{
 let saved=emptyLedger(now)
 const raw=JSON.stringify({products:[{title:'Minisforum PC',handle:'pc',variants:[{available:true,price:'1'}]}]})
 const file=await collect([{name:'Minisforum',kind:'shopify',direct:true,url:'https://store.minisforum.com/products.json'}],async()=>raw,now,[],{onLedger:l=>saved=l})
 expect(file.version).toBe(3)
 expect(file.gate!.rejected).toBe(1)
 expect(Object.keys(saved.products)).toHaveLength(1)
 const dir=await mkdtemp(join(tmpdir(),'barato-ledger-'))
 try {await mkdir(join(dir,'api'),{recursive:true});await writeFile(join(dir,'api/deals.json'),JSON.stringify({deals:[laptop]}));const [d]=await readPrevious(dir,now,seedLedger(archive,now));expect(d?.history?.days).toBe(3)} finally {await rm(dir,{recursive:true})}
})
it('watch records alert conditions without treating unknown stock as available',()=>{
 const rule={name:'PC',title:'PC',maxPrice:100}
 const first={title:'PC',url:'https://shop.test/pc',price:100,currency:'USD',available:true,status:'ok' as const,at:'2026-11-02'}
 expect(fireReasons(rule,first)).toHaveLength(2)
 expect(fireReasons(rule,first,{...first,price:110,available:false})).toContain('De nuevo disponible')
 expect(fireReasons(rule,{...first,price:120},first)).toEqual([])
 expect(fireReasons(rule,{...first,status:'blocked'},first)).toEqual([])
 expect(parseOffers('<script type="application/ld+json">{"@type":"Product","name":"PC","offers":{"price":"99","priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script>',first.url,first.at)[0]).toMatchObject({price:99,available:true})
 expect(parseOffers('<script type="application/ld+json">{"name":"PC","offers":{"price":"99"}}</script>',first.url,first.at)).toEqual([])
})
it('watch never runs in CI',async()=>{await expect(runWatch('/no/such/path',{CI:'true'})).rejects.toThrow('never run in CI')})
it('watch deduplicates rule/price across reruns and records rises',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'barato-watch-')), privateDir=join(dir,'data/private')
 try {
 await mkdir(privateDir,{recursive:true});await writeFile(join(privateDir,'watchlist.json'),JSON.stringify([{name:'PC',title:'PC',maxPrice:100}]))
 for(const price of [99,120,99]) {await writeFile(join(privateDir,'collected.json'),JSON.stringify({generatedAt:new Date().toISOString(),deals:[deal({title:'PC',price})]})); await runWatch(dir,{})}
 const h=JSON.parse(await readFile(join(privateDir,'watch-history.json'),'utf8'))
 expect(h.fired).toHaveLength(1)
 expect(Object.values(h.observations).flat().map((x:any)=>x.price)).toEqual([99,120,99])
 }finally{await rm(dir,{recursive:true})}
})

it('reads DealNews staff picks as publisher evidence',()=>{
 const raw='<rss><channel><item><title>Lenovo laptop for $499</title><link>https://dealnews.com/pc</link><dealnews:staffPick>true</dealnews:staffPick></item></channel></rss>'
 expect(normalizeSource({name:'DealNews',kind:'rss',url:'https://www.dealnews.com/?rss=1'},raw,now)[0]?.staffPick).toBe(true)
})
it('does not compare different cheapest Shopify configurations',()=>{
 const original=deal({title:'Minisforum PC 64GB',url:'https://store.minisforum.com/products/pc',price:999,category:'informatica'})
 const ledger=seedLedger(archive.map(a=>({...a,deals:[original]})),now)
 const barebone={...original,title:'Minisforum PC Barebone',price:199}
 expect(resolveReference({...barebone,listPrice:null},[],ledger,[],now)).toBeUndefined()
 expect(mergeLedger(ledger,[barebone],now).products[productKey(original)]!.series).toHaveLength(1)
})
it('passes board text only over stdin, including shell metacharacters',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'barato-board-')), path=join(dir,'received.json')
 try {
 const title='$(danger) & | < >', body='title with "quotes"; exit 1'
 await notifyWatch(title,body,JSON.stringify([process.execPath,'-e','let s="";process.stdin.on("data",b=>s+=b);process.stdin.on("end",()=>require("node:fs").writeFileSync(process.argv[1],s))',path]))
 expect(JSON.parse(await readFile(path,'utf8'))).toEqual({title,body})
 }finally{await rm(dir,{recursive:true})}
})
it('does not classify a routine 42 percent historical markdown as an error candidate',()=>{
 const d=deal({title:'Unknown digital frame',price:89.99,listPrice:null,reference:{kind:'ledger',price:153.99,note:'Mediana de 7 días'}})
 expect(scoreDeal(d,now).errorScore).toBeLessThan(40)
})

it('does not publish an EU-only configuration as a US catalog offer',()=>{
 const source={name:'GMKtec',kind:'shopify' as const,url:'https://www.gmktec.com/products.json',direct:true}
 const product={title:'GMKtec PC',handle:'pc',variants:[{title:'8GB / EU',available:true,price:'99'},{title:'8GB / US',available:false,price:'109'}]}
 expect(normalizeSource(source,JSON.stringify({products:[product]}),now)).toHaveLength(0)
 product.variants[1]!.available=true
 expect(normalizeSource(source,JSON.stringify({products:[product]}),now)[0]?.price).toBe(109)
})

describe('v3 gate tuning (2026-11-02)', () => {
  const offer = (o: Record<string, unknown>) => ({ id: String(Math.random()), title: 'ASUS Laptop', url: 'https://a.test/p', sourceUrl: 'https://a.test/p', storeUrl: 'https://a.test/p', store: 'Shop', storeDomain: 'a.test', source: 'Shop', currency: 'USD', price: 500, listPrice: 625, discountPct: 20, image: null, category: 'informatica', publishedAt: '2026-11-01T00:00:00.000Z', foundAt: '2026-11-01T00:00:00.000Z', score: 50, errorScore: 0, errorSignals: [], flag: 'normal', reasons: [], direct: true, interest: 80, ...o }) as any
  it('keeps a permanent catalog discount off the page, but not a deep one', () => {
    expect(rejection(offer({}))).toBe('catalog-price')
    expect(rejection(offer({ discountPct: 40 }))).toBeUndefined()
    expect(rejection(offer({ reference: { price: 600, kind: 'ledger', note: 'x' }, referenceDiscountPct: 16 }))).toBeUndefined()
  })
  it('rejects appliance spare parts', () => {
    expect(rejection(offer({ title: 'Samsung Gasket-Door Ref Aw1 Pjt DA63-06542B', sourceUrl: 'https://c.test/x' }))).toBe('replacement-part')
  })
  it('collapses colour variants at one price', () => {
    const a = offer({ title: 'Oura Ring 4 Smart Ring - Gold', sourceUrl: 'https://c.test/1', url: 'https://a.test/1' })
    const b = offer({ title: 'Oura Ring 4 Smart Ring - Midnight', sourceUrl: 'https://c.test/2', url: 'https://a.test/2' })
    const { kept, gate } = applyGate([a, b])
    expect(kept).toHaveLength(1)
    expect(gate.byReason['variant-duplicate']).toBe(1)
  })
  it('stops one store walling off the list, and caps small stores', () => {
    const rows = [...Array.from({ length: 20 }, (_, i) => offer({ id: 's' + i, store: 'Small' })), ...Array.from({ length: 5 }, (_, i) => offer({ id: 'a' + i, store: 'Amazon' }))]
    const out = diversify(rows)
    expect(out.slice(0, 3).every((d: any) => d.store === 'Small')).toBe(false)
    expect(out.slice(0, 17).filter((d: any) => d.store === 'Small').length).toBe(12)
  })
  it('counts a list claim for less than an observed price', () => {
    const claimed = offer({ discountPct: 50 })
    const observed = offer({ discountPct: null, reference: { price: 1000, kind: 'ledger', note: 'x' }, referenceDiscountPct: 50 })
    expect(evidenceOf(observed)).toBeGreaterThan(evidenceOf(claimed))
  })
})
scoreFloorTest()
function scoreFloorTest() {
  it('a price below a curated spec floor is a candidate with no list price, and deeper breaches are probable', () => {
    const base = { title: 'MSI Laptop RTX 5070', url: 'https://a.test/p', sourceUrl: 'https://b.test/p', store: 'Shop', source: 'Shop', currency: 'USD', listPrice: null, discountPct: null, image: null, category: 'informatica', publishedAt: '2026-11-01T00:00:00.000Z', foundAt: '2026-11-01T00:00:00.000Z', storeUrl: null, storeDomain: null, id: 'x', reference: { price: 600, kind: 'curated', note: 'Suelo conservador por especificaciones: x' } } as any
    expect(scoreError({ ...base, price: 500 }, 0).errorScore).toBeGreaterThanOrEqual(55)
    expect(scoreError({ ...base, price: 400 }, 0).errorScore).toBeGreaterThanOrEqual(70)
  })
}

it('reads CamelCamelCamel history tables and stock words from pages without JSON-LD', () => {
  const camel = '<title>ASUS Ascent GX10 | Amazon price tracker</title><table><tr><td>Amazon</td><td>$3,461.21 (Mar 30, 2026)</td><td>$6,059.99 (Aug 31, 2026)</td><td>-</td><td>$3,969.59</td></tr><tr><td>3rd Party New</td><td>$3,012.72 (Dec 17, 2025)</td><td>$8,792.00 (Oct 02, 2026)</td><td>$7,899.99 (Oct 31, 2026)</td><td>$5,476.22</td></tr></table>'
  const rows = parseCamel(camel, 'https://camelcamelcamel.com/product/B0G1MQYHRD', 'now')
  expect(rows[0]).toMatchObject({ available: false, status: 'unavailable' })
  expect(rows[1]).toMatchObject({ price: 7899.99, currency: 'USD', available: true, status: 'ok', url: 'https://camelcamelcamel.com/product/B0G1MQYHRD#terceros' })
  expect(parseStorePage('<title>GX10</title><p>Backorder $3,999.00</p>', 'https://s.test/a', 'now')[0]).toMatchObject({ available: false, status: 'unavailable' })
  expect(parseStorePage('<title>GX10</title><p>$3,999.00</p><button>Add to Cart</button>', 'https://s.test/a', 'now')[0]).toMatchObject({ price: 3999, available: true })
})

it('gives ASIN rows Amazon pictures and keeps the feed image as the fallback', () => {
  const xml = '<rss><channel><item><title>Canon EOS R5 - down 13.34% ($400.00) to $2,599.00 from $2,999.00</title><link>https://camelcamelcamel.com/product/B08C7KG5LP</link><description></description><pubDate>Mon, 02 Nov 2026 11:17:46 PST</pubDate></item></channel></rss>'
  const [row] = normalizeSource({ name: 'CamelCamelCamel', kind: 'camelcamelcamel', url: 'https://camelcamelcamel.com/top_drops/feed' }, xml, new Date('2026-11-02T20:00:00Z'))
  expect(row!.image).toBe('https://m.media-amazon.com/images/P/B08C7KG5LP.01._SL300_.jpg')
  expect(row!.imageFallback).toBeNull()
})

describe('price freshness (2026-11-02)', () => {
  const now = new Date('2026-11-02T20:00:00Z')
  const row = (o: Record<string, unknown>) => ({ id: 'x', title: 'ASUS Laptop', url: 'https://www.amazon.com/dp/B0C549K894', storeUrl: 'https://www.amazon.com/dp/B0C549K894', sourceUrl: 'https://t.test/1', store: 'Amazon', storeDomain: 'amazon.com', source: 'Techbargains', currency: 'USD', price: 500, listPrice: null, discountPct: null, image: null, category: 'informatica', publishedAt: '2026-11-02T00:00:00.000Z', foundAt: '2026-11-02T00:00:00.000Z', score: 50, errorScore: 0, errorSignals: [], flag: 'normal', reasons: [], direct: true, interest: 80, ...o }) as any
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString()
  it('holds third-party Amazon rows to a day and sold-by-Amazon rows to four days', () => {
    expect(rejection(row({ publishedAt: hoursAgo(30), storeUrl: 'https://www.amazon.com/dp/B0C549K894?smid=A3Q5O9' }), now)).toBe('stale-price')
    expect(rejection(row({ publishedAt: hoursAgo(30), storeUrl: 'https://www.amazon.com/dp/B0C549K894?smid=ATVPDKIKX0DER' }), now)).toBeUndefined()
    expect(rejection(row({ publishedAt: hoursAgo(100), storeUrl: 'https://www.amazon.com/dp/B0C549K894?smid=ATVPDKIKX0DER' }), now)).toBe('stale-price')
  })
  it('stale prices do not get in as error candidates either', () => {
    expect(rejection(row({ publishedAt: hoursAgo(30), source: 'CamelCamelCamel', errorScore: 80 }), now)).toBe('stale-price')
  })
  const camel = (cells: string) => '<title>Shark | x</title><table><tr><td>Amazon</td><td>$200.00 (Mar 30, 2026)</td><td>$900.00 (Aug 31, 2026)</td><td>' + cells + '</td><td>$500.00</td></tr></table>'
  const cand = (o = {}) => row({ price: 279.99, errorScore: 56, errorSignals: ['a'], reference: { price: 1299.99, kind: 'source-previous', note: 'n' }, ...o })
  it('corrects a moved candidate price, which ends the false alarm', async () => {
    const [d] = await verifyCandidates([cand()], async () => camel('$989.99'), now)
    expect(d!.price).toBe(989.99)
    expect(d!.errorScore).toBeLessThan(40)
    expect(d!.errorSignals.at(-1)).toMatch(/corregido/)
  })
  it('confirms a matching price, drops a vanished one, and leaves failures alone', async () => {
    expect((await verifyCandidates([cand()], async () => camel('$279.99'), now))[0]!.errorSignals.at(-1)).toMatch(/confirmado/)
    expect(await verifyCandidates([cand()], async () => camel('-'), now)).toHaveLength(0)
    const [d] = await verifyCandidates([cand()], async () => { throw new Error('403') }, now)
    expect(d!.price).toBe(279.99)
    expect(d!.errorSignals.at(-1)).toMatch(/sin comprobar/)
  })
})
