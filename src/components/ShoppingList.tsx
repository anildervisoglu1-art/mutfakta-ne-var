import { useState } from 'react';
import { useFridge } from '../store/useFridge';
import { findExact, getCategory, guessCatalog, searchKey } from '../data/catalog';
import { defaultUnit, UNIT_LABEL } from '../lib/units';
import { FoodTile } from './Food';
import { Icon } from './Icon';
import { Stepper } from './Stepper';
import { toast } from './Toast';
import type { CatalogItem, CategoryId, ShoppingItem } from '../types';

/** Serbest yazılan alışveriş ürünü için katalog eşleşmesi (görsel ve birim için). */
export function shoppingFromName(name: string): { name: string; catalogId?: string; img: string; category: CategoryId; unit: ShoppingItem['unit'] } {
  const exact: CatalogItem | undefined = findExact(name);
  const guess = exact ? undefined : guessCatalog(name);
  const c = exact ?? guess?.item;
  const category = c?.category ?? guess?.category ?? 'temel';
  // Yazılan ad korunur ("bebek yoğurdu" Yoğurt'a bağlanır ama adı değişmez); yalnızca ürünün kendi adıysa katalogdaki yazılış kullanılır.
  const typed = name.trim();
  const own = exact && searchKey(exact.name.replace(/\s*\(.*\)/, '')) === searchKey(typed);
  return { name: own ? exact.name : typed.charAt(0).toLocaleUpperCase('tr') + typed.slice(1), catalogId: exact?.id, img: c?.img ?? getCategory(category).img, category, unit: defaultUnit({ catalogId: c?.id, category }) };
}

/**
 * Küçük alışveriş listesi. "Alındı" işaretlemek mutfağa ürün eklemez:
 * eklemek için satırdaki "Mutfağa ekle" düğmesi ekleme ekranını o adla açar (tarihi kullanıcı onaylar).
 */
export function ShoppingList({ onAddToKitchen }: { onAddToKitchen: (item: ShoppingItem) => void }) {
  const list = useFridge((s) => s.shopping);
  const { addShopping, updateShopping, removeShopping } = useFridge.getState();
  const [text, setText] = useState('');
  const open = list.filter((x) => !x.done);
  const done = list.filter((x) => x.done);

  const submit = () => {
    const name = text.trim();
    if (!name) return;
    const r = addShopping(shoppingFromName(name));
    setText('');
    toast({ text: r.existed ? `${r.item.name} zaten listede` : `${r.item.name} listeye eklendi`, tone: 'good', undo: r.existed ? undefined : () => useFridge.getState().undoShopping(r) });
  };

  const remove = (x: ShoppingItem) => {
    const idx = useFridge.getState().shopping.findIndex((y) => y.id === x.id);
    removeShopping(x.id);
    // Geri al yalnızca bu satırı eski yerine koyar; arada yapılan diğer değişiklikler korunur.
    toast({
      text: `${x.name} listeden çıkarıldı`,
      undo: () =>
        useFridge.setState((s) => (s.shopping.some((y) => y.id === x.id) ? s : { shopping: [...s.shopping.slice(0, idx), x, ...s.shopping.slice(idx)] })),
    });
  };

  return (
    <div className="shop">
      <h2 className="sheet-title">Alışveriş listesi</h2>
      <form
        className="shop__add"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input id="shop-new" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ürün yaz: süt, domates…" aria-label="Listeye ürün ekle" enterKeyHint="done" maxLength={60} />
        <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
          Ekle
        </button>
      </form>

      {list.length === 0 && <p className="sheet-sub">Liste boş. Tariflerdeki eksikleri ya da biten ürünleri buraya ekleyebilirsin.</p>}

      {open.length > 0 && (
        <ul className="shop__list">
          {open.map((x) => (
            <li key={x.id} className="shop__row">
              <button type="button" className="shop__check" role="checkbox" aria-checked={false} aria-label={`${x.name}: alındı`} onClick={() => updateShopping(x.id, { done: true })}>
                <span className="check-row__box" />
              </button>
              <FoodTile img={x.img} category={x.category} size={36} />
              <span className="shop__name">
                {x.name}
                <small>{UNIT_LABEL[x.unit]}</small>
              </span>
              {/* Miktar ve sil birlikte durur; dar ekranda birlikte alt satıra, sağa geçer. */}
              <span className="shop__ctrl">
                <Stepper value={x.quantity} min={1} max={99} label={`${x.name} miktarı (${UNIT_LABEL[x.unit]})`} onChange={(q) => updateShopping(x.id, { quantity: q })} />
                <button type="button" className="icon-btn shop__remove" aria-label={`${x.name}: listeden çıkar`} onClick={() => remove(x)}>
                  <Icon name="x" size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <h3 className="shop__subtitle">Alındı</h3>
          <p className="shop__note">Alındı işareti mutfağına ürün eklemez. Eklemek için “Mutfağa ekle”ye dokun; tarihi orada onaylarsın.</p>
          <ul className="shop__list">
            {done.map((x) => (
              <li key={x.id} className="shop__row is-done">
                <button type="button" className="shop__check" role="checkbox" aria-checked={true} aria-label={`${x.name}: alınmadı olarak işaretle`} onClick={() => updateShopping(x.id, { done: false })}>
                  <span className="check-row__box">
                    <Icon name="check" size={16} stroke={3} />
                  </span>
                </button>
                <FoodTile img={x.img} category={x.category} size={36} />
                <span className="shop__name">
                  {x.name}
                  <small>
                    {x.quantity} {UNIT_LABEL[x.unit]}
                  </small>
                </span>
                <button type="button" className="btn btn--soft shop__to-kitchen" onClick={() => onAddToKitchen(x)}>
                  Mutfağa ekle
                </button>
                <button type="button" className="icon-btn shop__remove" aria-label={`${x.name}: listeden çıkar`} onClick={() => remove(x)}>
                  <Icon name="x" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
