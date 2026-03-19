import type { BurgerLayer } from '@/components/home/BurgerScrollSection'

/**
 * Default burger layers. Replace these paths with your own PNGs
 * (transparent background, bottom-to-top order).
 */
export const DEFAULT_BURGER_LAYERS: BurgerLayer[] = [
  { src: '/banners/burger-layers/bun-bottom.png', alt: 'Bun bottom' },
  { src: '/banners/burger-layers/patty.png', alt: 'Patty' },
  { src: '/banners/burger-layers/cheese.png', alt: 'Cheese' },
  { src: '/banners/burger-layers/mushrooms.png', alt: 'Mushrooms' },
  { src: '/banners/burger-layers/sauces.png', alt: 'Sauces' },
  { src: '/banners/burger-layers/bun-top.png', alt: 'Bun top' },
]
