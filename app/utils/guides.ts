// The text of the deal-season explainers (lib/guides.ts has the slugs).
// Pure data, both languages. Examples are real records from barato.si's own
// files, with their date; nothing here claims traffic, results or certainty.
import { GUIDE_SLUGS, isGuide } from '../../lib/guides'
import type { GuideSlug } from '../../lib/guides'
import type { Locale } from './locale'

export interface GuideSection { h: string; p: string[] }
export interface GuideSource { label: string; url: string }
export interface Guide {
  title: string
  /** <title> and meta description. */
  seoTitle: string
  description: string
  lede: string
  sections: GuideSection[]
  sources: GuideSource[]
}

/** When the text was last reviewed (ISO date). */
export const GUIDES_UPDATED = '2026-11-05'

const FTC_233: GuideSource = {
  label: '16 CFR Part 233, Guides Against Deceptive Pricing (FTC)',
  url: 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-233',
}

const es: Record<GuideSlug, Guide> = {
  'precio-antes-inflado': {
    title: 'Cómo saber si el precio «antes» está inflado',
    seoTitle: 'Cómo saber si el precio «antes» de una oferta está inflado · barato.si',
    description: 'El precio tachado lo pone quien vende. Cómo comprobar en dos minutos si una rebaja de Black Friday es real, con un ejemplo de los datos de barato.si.',
    lede: 'El precio tachado lo pone quien vende. La rebaja que importa es contra lo que el producto costó de verdad en las últimas semanas, no contra la cifra más alta que tuvo alguna vez.',
    sections: [
      {
        h: 'Un ejemplo de esta semana',
        p: [
          'El 5 de noviembre de 2026, un portátil Lenovo V14 G5 (Core i7, 16 GB, 1 TB) estaba en Walmart a 629 USD. barato.si lo había visto 28 días antes de esa fecha: el precio más bajo fue 629 USD, el más alto 859,99 USD y la mediana 629 USD.',
          'Un «antes 859,99» sería un precio real de algún día, y aun así una mala vara de medir: casi siempre costó 629. Por eso barato.si no lo destacó como rebaja ese día. Comprar a 629 no está mal; lo que no hay es un descuento del 27 %.',
        ],
      },
      {
        h: 'Qué mirar antes de pagar',
        p: [
          'Busca el historial. Una herramienta de historial de precios te dice cuánto costó día a día; si el producto está en barato.si, su fila muestra contra qué referencia se compara y de dónde sale. Si el precio «rebajado» es el de casi todo el mes, no es una rebaja.',
          'Desconfía del precio de lista. En electrónica y en hogar, el precio de lista del fabricante a menudo es una cifra que casi nadie paga. barato.si marca esas referencias como «sin verificar».',
          'Mira si la referencia subió justo antes. Un producto que pasa de 40 a 60 en octubre y vuelve a 40 en noviembre «con 33 % de descuento» no bajó de precio.',
          'Compara en otra tienda. Si el mismo modelo está al mismo precio en otro sitio sin cartel de oferta, ese es su precio.',
        ],
      },
      {
        h: 'Qué dice la norma en EE. UU.',
        p: [
          'La guía de la FTC sobre precios engañosos dice que un precio anterior solo sirve como comparación si el producto se ofreció de verdad a ese precio al público, de forma regular y durante un tiempo razonable. Es una guía, no una garantía de que cada tienda la cumpla, y por eso conviene comprobarlo uno mismo.',
        ],
      },
    ],
    sources: [FTC_233],
  },
  'por-que-cancelan-errores-de-precio': {
    title: 'Por qué las tiendas cancelan los errores de precio',
    seoTitle: 'Por qué las tiendas cancelan los errores de precio (y qué hacer) · barato.si',
    description: 'Un error de precio es un fallo de la tienda, y sus condiciones de venta casi siempre le permiten cancelar el pedido. Qué significa la confirmación y cómo comprar sin llevarte un disgusto.',
    lede: 'Un error de precio es un fallo de la tienda: una cifra mal escrita, un descuento aplicado dos veces, un dato equivocado del proveedor. La tienda casi siempre puede cancelarlo, y a menudo lo hace.',
    sections: [
      {
        h: 'Un ejemplo de esta semana',
        p: [
          'El 5 de noviembre de 2026, barato.si marcó un dock USB-C Targus (DOCK215USZ) a 59,99 USD en Amazon. CamelCamelCamel tenía como precio anterior 287,99 USD: el precio de ese día era el 21 % de la referencia. Es el tipo de caída que barato.si señala como posible error, con una sola lectura detrás. Puede ser un error, una liquidación o un dato mal leído; la página lo dice así.',
        ],
      },
      {
        h: 'Por qué pueden cancelarlo',
        p: [
          'Las condiciones de venta de las grandes tiendas de EE. UU. suelen reservarse el derecho de cancelar pedidos hechos a un precio equivocado. En varias, la venta no se cierra cuando llega el correo de confirmación, sino cuando el pedido se envía.',
          'El correo de «hemos recibido tu pedido» confirma eso: que lo recibieron. No promete que lo vayan a mandar a ese precio.',
        ],
      },
      {
        h: 'Cómo comprar sin disgustos',
        p: [
          'Paga con un medio que te devuelva el dinero rápido si cancelan. Una tarjeta de crédito suele liberar la retención en días; una tarjeta de regalo puede tardar más.',
          'No compres otra cosa contando con que el error llegue. Si llega, perfecto.',
          'No pidas veinte unidades. Los pedidos grandes a precio de error son los primeros que se cancelan.',
          'Un error de precio se compra rápido y se celebra despacio.',
        ],
      },
    ],
    sources: [],
  },
  'para-que-sirve-cyber-monday': {
    title: 'Para qué sirve de verdad el Cyber Monday',
    seoTitle: 'Cyber Monday: qué es y para qué sirve de verdad · barato.si',
    description: 'El Cyber Monday es el lunes después de Acción de Gracias, con nombre de 2005. Qué cambia frente al Black Friday y cómo saber si esperar al lunes vale la pena.',
    lede: 'El Cyber Monday es el lunes después de Acción de Gracias. El nombre lo puso en 2005 la división en línea de la National Retail Federation de EE. UU., cuando comprar por internet desde la oficina todavía era noticia. En 2026 cae el 30 de noviembre.',
    sections: [
      {
        h: 'Qué cambia frente al Black Friday',
        p: [
          'Hoy muchas tiendas estiran las mismas ofertas desde antes del viernes hasta el lunes, y algunas lo llaman «Cyber Week». Muchas veces el lunes no trae precios nuevos, sino los mismos con otro cartel.',
          'Lo que sí suele aparecer el lunes son ofertas solo en línea y cupones de tiendas que el viernes apostaron por la tienda física.',
        ],
      },
      {
        h: 'Cómo decidir si esperar',
        p: [
          'Anota el precio del viernes del producto que quieres. Si el lunes es el mismo, el lunes no aporta nada; si es más bajo, compra entonces. Si el viernes ya está en su mínimo de los últimos meses, esperar es apostar.',
          'Para una cifra concreta, compara contra el historial y no contra el cartel. En barato.si, cada oferta lleva su referencia y de dónde sale.',
          'barato.si publica cada día las ofertas de esa semana tal como las ve, con los posibles errores primero. Si un día no hay nada que pase los criterios, la página lo dice.',
        ],
      },
    ],
    sources: [],
  },
}

const en: Record<GuideSlug, Guide> = {
  'precio-antes-inflado': {
    title: 'How to tell if a "was" price is inflated',
    seoTitle: 'How to tell if a sale\'s "was" price is inflated · barato.si',
    description: 'The crossed-out price is set by the seller. How to check in two minutes whether a Black Friday discount is real, with an example from barato.si\'s own data.',
    lede: 'The crossed-out price is set by the seller. The discount that matters is against what the product actually cost over the last few weeks, not against the highest number it ever had.',
    sections: [
      {
        h: 'An example from this week',
        p: [
          'On November 5, 2026, a Lenovo V14 G5 laptop (Core i7, 16 GB, 1 TB) was 629 USD at Walmart. barato.si had seen it on 28 days before that: the lowest price was 629 USD, the highest 859.99 USD and the median 629 USD.',
          'A "was 859.99" would be a real price from some day, and still a bad yardstick: it nearly always cost 629. That is why barato.si did not flag it as a discount that day. Buying at 629 is fine. There just isn\'t a 27% discount.',
        ],
      },
      {
        h: 'What to check before you pay',
        p: [
          'Look up the history. A price-history tool shows what it cost day by day; if the product is on barato.si, its row shows which reference it is compared against and where that comes from. If the "sale" price is what it cost most of the month, it isn\'t a sale.',
          'Be wary of list price. In electronics and home goods, the manufacturer\'s list price is often a number almost nobody pays. barato.si labels those references "unverified".',
          'Check whether the reference went up just before. A product that goes from 40 to 60 in October and back to 40 in November "at 33% off" did not get cheaper.',
          'Compare another store. If the same model costs the same elsewhere with no sale banner, that is its price.',
        ],
      },
      {
        h: 'What the US rule says',
        p: [
          'The FTC\'s guide on deceptive pricing says a former price is a fair comparison only if the product was really offered to the public at that price, regularly, for a reasonably substantial period. It is guidance, not a promise every store follows it, so it pays to check yourself.',
        ],
      },
    ],
    sources: [FTC_233],
  },
  'por-que-cancelan-errores-de-precio': {
    title: 'Why stores cancel price errors',
    seoTitle: 'Why stores cancel price errors (and what to do) · barato.si',
    description: 'A price error is the store\'s mistake, and its terms of sale almost always let it cancel the order. What the confirmation email means and how to buy without getting burned.',
    lede: 'A price error is the store\'s mistake: a mistyped number, a discount applied twice, a bad figure from a supplier. The store can almost always cancel it, and often does.',
    sections: [
      {
        h: 'An example from this week',
        p: [
          'On November 5, 2026, barato.si flagged a Targus USB-C dock (DOCK215USZ) at 59.99 USD on Amazon. CamelCamelCamel had its previous price at 287.99 USD, so that day\'s price was 21% of the reference. That is the kind of drop barato.si marks as a possible error, with a single reading behind it. It may be an error, a clearance or a misread figure, and the page says so.',
        ],
      },
      {
        h: 'Why they can cancel',
        p: [
          'The terms of sale of large US stores usually reserve the right to cancel orders placed at a wrong price. At several of them, the sale is not final when the confirmation email arrives, but when the order ships.',
          'The "we received your order" email confirms exactly that: they received it. It does not promise to ship it at that price.',
        ],
      },
      {
        h: 'How to buy without getting burned',
        p: [
          'Pay with something that refunds fast if they cancel. A credit card usually releases the hold in days; a gift card balance can take longer.',
          'Don\'t buy anything else counting on the error arriving. If it arrives, great.',
          'Don\'t order twenty. Large orders at an error price are the first to be cancelled.',
          'Buy a price error fast and celebrate it slowly.',
        ],
      },
    ],
    sources: [],
  },
  'para-que-sirve-cyber-monday': {
    title: 'What Cyber Monday is actually good for',
    seoTitle: 'Cyber Monday: what it is and what it\'s actually good for · barato.si',
    description: 'Cyber Monday is the Monday after Thanksgiving, a name from 2005. What changes compared with Black Friday, and how to tell whether waiting for Monday is worth it.',
    lede: 'Cyber Monday is the Monday after Thanksgiving. The online division of the US National Retail Federation named it in 2005, when shopping online from the office was still news. In 2026 it falls on November 30.',
    sections: [
      {
        h: 'What changes compared with Black Friday',
        p: [
          'Many stores now stretch the same deals from before Friday through Monday, and some call it "Cyber Week". Often Monday brings no new prices, just the same ones under a different banner.',
          'What does tend to show up on Monday is online-only deals and coupons from stores that bet on their physical shops on Friday.',
        ],
      },
      {
        h: 'How to decide whether to wait',
        p: [
          'Write down Friday\'s price for the thing you want. If Monday\'s is the same, Monday adds nothing; if it is lower, buy then. If Friday\'s price is already its low for the last few months, waiting is a bet.',
          'For an actual number, compare against the history, not the banner. On barato.si every deal shows its reference and where it comes from.',
          'barato.si publishes that week\'s deals every day as it sees them, possible errors first. If on some day nothing passes the bar, the page says so.',
        ],
      },
    ],
    sources: [],
  },
}

const GUIDES: Record<Locale, Record<GuideSlug, Guide>> = { es, en }

/** The guide in `locale`, or null for an unknown slug. Takes the Spanish slug. */
export function guideFor(slug: string | undefined | null, locale: Locale): Guide | null {
  return isGuide(slug) ? GUIDES[locale][slug] : null
}

/** All guides in hub order, with both paths, for the lists that link them. */
export function guideList(locale: Locale): { slug: GuideSlug; title: string; path: string }[] {
  return (Object.keys(GUIDE_SLUGS) as GuideSlug[]).map(slug => ({
    slug,
    title: GUIDES[locale][slug].title,
    path: locale === 'en' ? `/en/guide/${GUIDE_SLUGS[slug]}` : `/guia/${slug}`,
  }))
}
