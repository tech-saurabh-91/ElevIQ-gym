import { money } from '@/lib/format';
import type { PublicOffer } from '@/lib/types';

export const offerLabel = (o: PublicOffer) => o.badgeText || (o.discountType === 'percent' ? `${o.value}% OFF` : `${money(o.value)} OFF`);
