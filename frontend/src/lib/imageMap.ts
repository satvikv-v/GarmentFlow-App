export function getGarmentImage(product: string | null | undefined): string {
  if (!product) return '/img_generic.png';
  const p = product.toLowerCase();
  if (p.includes('shirt') || p.includes('top') || p.includes('polo') || p.includes('blouse')) return '/img_shirt.png';
  if (p.includes('pant') || p.includes('trouser') || p.includes('jean') || p.includes('short')) return '/img_trouser.png';
  if (p.includes('dress') || p.includes('gown')) return '/img_dress.png';
  if (p.includes('uniform') || p.includes('scrub') || p.includes('overall')) return '/img_uniform.png';
  if (p.includes('jacket') || p.includes('coat') || p.includes('blazer')) return '/img_jacket.png';
  if (p.includes('fabric') || p.includes('cotton') || p.includes('linen')) return '/img_fabric.png';
  return '/img_generic.png';
}
