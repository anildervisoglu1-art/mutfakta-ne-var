import type { CSSProperties } from 'react';
import { foodImageUrl } from '../lib/images';

/**
 * Kapağı açılıp kapanan, içi ışıklı buzdolabı çizimi.
 * `open` kapağı açar; `items` raflarda görünen ürün görselleridir.
 */
export function Fridge({
  open,
  items = [],
  width = 200,
  pulse,
  className = '',
}: {
  open: boolean;
  items?: string[];
  width?: number;
  /** Değiştikçe kapak kısaca açılıp kapanır (ürün eklendiğinde). */
  pulse?: number;
  className?: string;
}) {
  const shelves = [items.slice(0, 3), items.slice(3, 6), items.slice(6, 9)];
  return (
    <div
      className={`fridge ${open ? 'is-open' : ''} ${className}`}
      style={{ '--fw': `${width}px` } as CSSProperties}
      data-pulse={pulse}
      key={pulse}
      aria-hidden="true"
    >
      <div className="fridge__freezer">
        <span className="fridge__handle fridge__handle--top" />
      </div>
      <div className="fridge__main">
        <div className="fridge__inside">
          <span className="fridge__light" />
          {shelves.map((row, i) => (
            <div className="fridge__shelf" key={i}>
              {row.map((img, j) => (
                <img key={j} src={foodImageUrl(img)} alt="" style={{ animationDelay: `${0.15 + (i * 3 + j) * 0.03}s` }} />
              ))}
            </div>
          ))}
          <div className="fridge__drawer" />
        </div>
        <div className={`fridge__door ${pulse ? 'is-pulse' : ''}`}>
          <div className="fridge__door-front">
            <span className="fridge__handle" />
            <span className="fridge__magnet" />
          </div>
          <div className="fridge__door-back">
            <span className="fridge__door-rack" />
            <span className="fridge__door-rack" />
            <span className="fridge__door-rack" />
          </div>
        </div>
      </div>
      <span className="fridge__feet" />
    </div>
  );
}
