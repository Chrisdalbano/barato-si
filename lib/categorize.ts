import type { DealCategory } from './types.ts'

export const categories: DealCategory[] = ['videojuegos', 'informatica', 'electronica', 'hogar', 'cocina', 'herramientas', 'ropa', 'deporte', 'juguetes', 'belleza', 'alimentacion', 'software', 'otros']
const rules: [DealCategory, RegExp][] = [
  ['informatica', /\b(laptop|notebook|computer|computers|RTX|GPU|graphics card|SSD|monitor|router|MacBook|desktop|hard drive)\b/i],
  ['cocina', /\b(air fryer|blender|cookware|Keurig|knife set|kitchen|coffee maker)\b/i],
  ['alimentacion', /\b(coffee pods|snacks?|protein|K-cups|groceries|food|gourmet)\b/i],
  ['herramientas', /\b(drill|saw|tool set|tools|DeWalt|Milwaukee)\b/i],
  ['electronica', /\b(TV|television|headphones?|earbuds?|speaker|camera|phone|iPhone|tablet|iPad|smartwatch|electronics|OLED|lens)\b/i],
  ['hogar', /\b(vacuum|mattress|sofa|lamp|bedding|home|garden|furniture)\b/i],
  ['ropa', /\b(shirt|shoes|jacket|jeans|sneakers|dress|clothing|apparel|pants|socks|activewear)\b/i],
  ['deporte', /\b(bike|treadmill|dumbbell|golf|sports?|fitness)\b/i],
  ['juguetes', /\b(LEGO|doll|Nerf|puzzle|toys)\b/i],
  ['belleza', /\b(shampoo|razor|skincare|perfume|beauty)\b/i],
  ['software', /\b(Windows|Office|antivirus|VPN|software)\b/i],
]
export function categorize(title: string, sourceCategory: string | null, store: string): DealCategory {
  if (/^(Steam|GOG|Epic(?: Games(?: Store)?)?|CheapShark|IsThereAnyDeal|IndieGala|Fanatical|Humble(?: Store)?|GreenManGaming|Gamesplanet|GameBillet)$/i.test(store) || /videojuegos|video games|PC games/i.test(sourceCategory || '')) return 'videojuegos'
  if (categories.includes(sourceCategory as DealCategory)) return sourceCategory as DealCategory
  // Specific product words beat broad publisher labels such as Electronics.
  return rules.find(([, re]) => re.test(title))?.[0]
    || (categories.includes(sourceCategory as DealCategory) ? sourceCategory as DealCategory : rules.find(([, re]) => re.test(sourceCategory || ''))?.[0]) || 'otros'
}
