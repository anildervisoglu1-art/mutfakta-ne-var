import type { CategoryId, Urgency } from '../types';
import { foodImageUrl } from '../lib/images';

/** Kategori renginde yumuşak bir zemin üzerinde ürün görseli. */
export function FoodTile({ img, category, size = 56, alt = '' }: { img: string; category: CategoryId; size?: number; alt?: string }) {
  return (
    <span className="food-tile" style={{ width: size, height: size, background: `var(--cat-${category})` }}>
      <img src={foodImageUrl(img)} alt={alt} width={size * 0.62} height={size * 0.62} draggable={false} loading="lazy" />
    </span>
  );
}

/** Görselin etrafında kalan süreyi gösteren halka. */
export function FoodRing({
  img,
  category,
  ratio,
  urgency,
  size = 60,
}: {
  img: string;
  category: CategoryId;
  ratio: number;
  urgency: Urgency;
  size?: number;
}) {
  const stroke = size > 80 ? 5 : 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = urgency === 'expired' ? 0 : Math.max(ratio, 0.06);
  return (
    <span className="food-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {shown > 0 && <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(--${urgency})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * shown} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="food-ring__arc"
        />}
      </svg>
      <span className="food-ring__inner">
        <FoodTile img={img} category={category} size={size - stroke * 2 - 6} />
      </span>
    </span>
  );
}
