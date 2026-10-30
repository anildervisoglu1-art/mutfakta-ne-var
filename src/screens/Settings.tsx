import { useRef, useState } from 'react';
import { migrateItems, useFridge } from '../store/useFridge';
import { buildCalendar, calendarChanges, calendarSignature, downloadFile } from '../lib/calendar';
import { notificationsSupported, requestNotifications } from '../lib/notify';
import { longDate, today } from '../lib/dates';
import { cleanHistory, cleanItem, cleanList, cleanPlan, cleanShopping } from '../lib/validate';
import { Icon, type IconName } from '../components/Icon';
import { Segmented, Toggle } from '../components/Stepper';
import { Sheet } from '../components/Sheet';
import { toast } from '../components/Toast';
import type { FridgeItem, HistoryEntry, Plan, Settings as SettingsT, ShoppingItem } from '../types';

type Confirm =
  | { kind: 'reset' }
  | { kind: 'demo' }
  | { kind: 'restore'; items: FridgeItem[]; history: HistoryEntry[]; shopping?: ShoppingItem[]; plans?: Plan[]; settings?: SettingsT; skipped: number }
  | { kind: 'calendar' }
  | { kind: 'notify-denied' };

export function Settings() {
  const items = useFridge((s) => s.items);
  const history = useFridge((s) => s.history);
  const settings = useFridge((s) => s.settings);
  const shopping = useFridge((s) => s.shopping);
  const plans = useFridge((s) => s.plans);
  const { setSettings, loadDemo, replaceAll, reset } = useFridge.getState();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const snapshot = () => ({ items: useFridge.getState().items, history: useFridge.getState().history, settings: useFridge.getState().settings, shopping: useFridge.getState().shopping, plans: useFridge.getState().plans });

  const toggleNotifications = async (on: boolean) => {
    if (!on) return setSettings({ notifications: false });
    if (!notificationsSupported()) return toast({ text: 'Bu tarayıcı bildirim desteklemiyor. Takvim hatırlatıcısını kullan.' });
    const ok = await requestNotifications();
    setSettings({ notifications: ok });
    if (ok) toast({ text: 'Açık. Uygulamayı açtığında, günde en fazla bir kez özet gösteririz. Uygulama kapalıyken bildirim gelmez.', tone: 'good' });
    else setConfirm({ kind: 'notify-denied' });
  };

  const exportCalendar = () => {
    const previous = Object.keys(settings.calendar?.sig ?? {});
    // Mutfak boşsa da önceki dosyanın hatırlatıcılarını iptal eden bir dosya hazırlanabilir.
    if (items.length === 0 && plans.length === 0 && previous.length === 0) return toast({ text: 'Önce mutfağına ürün ekle.' });
    downloadFile(`mutfak-hatirlaticilar-${today()}.ics`, buildCalendar(items, settings.leadDays, new Date(), history, previous, plans), 'text/calendar');
    // İndirmek kurulum demek değildir: kullanıcı takvimine eklediğini onaylayana kadar "hazırlandı".
    setSettings({ calendar: { status: 'prepared', at: today(), lead: settings.leadDays, sig: calendarSignature(items, today(), plans) } });
    setConfirm({ kind: 'calendar' });
  };

  const cal = settings.calendar;
  const changes = cal ? calendarChanges(items, cal, settings.leadDays, today(), plans) : undefined;
  const calendarTitle = !cal ? 'Takvime hatırlatıcı ekle' : changes && changes.total > 0 ? 'Takvim dosyasını güncelle' : 'Takvim dosyasını yeniden hazırla';
  const calendarSub = !cal
    ? 'Her ürün için uyarı günü sabah 09:00 hatırlatıcısı içeren bir dosya hazırlanır.'
    : cal.status === 'prepared'
      ? `Durum: dosya hazırlandı (${longDate(cal.at)}), takvime eklendiği onaylanmadı.`
      : changes && changes.total > 0
        ? `Güncel değil: ${changes.leadChanged ? 'uyarı süresi değişti; ' : 'son dosyadan sonra '}${changes.total} ürünün hatırlatıcısı değişti (eklenen, biten ya da tarihi değişen).`
        : `Durum: takvime eklendi (${longDate(cal.at)}). Hatırlatıcılar güncel.`;
  const confirmCalendar = () => {
    if (!cal) return;
    setSettings({ calendar: { ...cal, status: 'confirmed' } });
    toast({ text: 'Tamam, takvim hatırlatıcıları kuruldu olarak işaretlendi.', tone: 'good' });
  };

  const backup = () => {
    const { lastNotified: _ignored, ...keep } = settings;
    void _ignored;
    downloadFile(`mutfak-yedek-${today()}.json`, JSON.stringify({ app: 'dolapta-ne-var', version: 2, items, history, shopping, plans, settings: keep }, null, 2), 'application/json');
    toast({ text: 'Yedek dosyası indirildi', tone: 'good' });
  };

  const readFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { app?: string; items?: unknown; history?: unknown; shopping?: unknown; plans?: unknown; settings?: SettingsT };
      if (data.app !== 'dolapta-ne-var' || !Array.isArray(data.items)) throw new Error('format');
      const it = cleanList(data.items, cleanItem);
      it.ok = migrateItems(it.ok);
      const hi = cleanList(data.history, cleanHistory);
      const sh = cleanList(data.shopping, cleanShopping);
      const pl = cleanList(data.plans, cleanPlan);
      if (it.ok.length === 0 && hi.ok.length === 0) throw new Error('empty');
      const lead = Number(data.settings?.leadDays);
      const s = data.settings && [1, 2, 3].includes(lead) ? { leadDays: lead, notifications: settings.notifications } : undefined;
      setConfirm({ kind: 'restore', items: it.ok, history: hi.ok, shopping: Array.isArray(data.shopping) ? sh.ok : undefined, plans: Array.isArray(data.plans) ? pl.ok : undefined, settings: s, skipped: it.skipped + hi.skipped + sh.skipped + pl.skipped });
    } catch {
      toast({ text: 'Bu dosya geçerli bir Mutfakta Ne Var? yedeği değil.' });
    }
  };

  return (
    <main className="screen">
      <header className="page-head">
        <p className="eyebrow">Tercihler</p>
        <h1 className="display">Ayarlar</h1>
      </header>

      <section className="card">
        <h2 className="card__title">Ne zaman uyarayım?</h2>
        <p className="card__sub">Son güne bu kadar gün kalınca ürün “Önce bunları kullan” listesine çıkar ve turuncu görünür.</p>
        <Segmented
          label="Uyarı zamanı"
          value={String(settings.leadDays) as '1' | '2' | '3'}
          options={[
            { id: '1', label: '1 gün önce' },
            { id: '2', label: '2 gün önce' },
            { id: '3', label: '3 gün önce' },
          ]}
          onChange={(v) => setSettings({ leadDays: Number(v) })}
        />
      </section>

      <section className="card">
        <h2 className="card__title">Hatırlatmalar</h2>
        <ul className="remind-kinds">
          <li>
            <strong>Uygulama içinde</strong> Son günü yaklaşanlar ana ekranın en üstünde. Her zaman açık.
          </li>
          <li>
            <strong>Tarayıcı bildirimi</strong> Yalnızca uygulamayı açtığında, günde en fazla bir kez özet. Uygulama kapalıyken gelmez.
          </li>
          <li>
            <strong>Takvim hatırlatıcısı</strong> Telefonunun takvimi hatırlatır; uygulama kapalıyken de çalışan tek yol budur. Planların da takvime eklenir.
          </li>
        </ul>
        <SettingRow icon="calendar" title={calendarTitle} sub={calendarSub} onClick={exportCalendar} />
        {settings.calendar?.status === 'prepared' && (
          <div className="remind-confirm">
            <span>Dosyayı takvimine ekledin mi?</span>
            <button type="button" className="btn btn--soft" onClick={confirmCalendar}>
              Evet, ekledim
            </button>
          </div>
        )}
        <div className="row">
          <span className="row__icon">
            <Icon name="bell" />
          </span>
          <span className="row__text">
            <strong>Uygulamayı açınca özet göster</strong>
            <small>Tarayıcı bildirimi; yalnızca uygulamayı açtığında, günde en fazla bir kez</small>
          </span>
          <Toggle checked={settings.notifications} onChange={toggleNotifications} label="Uygulamayı açınca özet göster" />
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Veriler</h2>
        <SettingRow icon="download" title="Yedek al" sub="Mutfağını, geçmişini, planlarını, alışveriş listeni ve ayarlarını dosyaya kaydet" onClick={backup} />
        <SettingRow icon="upload" title="Yedekten yükle" sub="Başka cihazdan aldığın yedeği aç" onClick={() => fileRef.current?.click()} />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = '';
          }}
        />
        <SettingRow
          icon="sparkle"
          title="Örnek mutfakla dene"
          sub="Uygulamayı örnek ürünlerle gez"
          onClick={() => (items.length ? setConfirm({ kind: 'demo' }) : (loadDemo(), toast({ text: 'Örnek mutfak yüklendi', tone: 'good' })))}
        />
        <SettingRow icon="trash" title="Her şeyi sil" sub="Ürünler, geçmiş, planlar ve alışveriş listesi kalıcı olarak silinir" danger onClick={() => setConfirm({ kind: 'reset' })} />
      </section>

      <section className="about">
        <p>
          <strong>Mutfakta Ne Var?</strong> verilerini yalnızca bu cihazda saklar; hesap, reklam ya da takip yoktur.
        </p>
        <p>“Tahmini” yazan süreler, ürünlerin ortalama saklama süresine dayanan yaklaşık değerlerdir; ürünün gerçek durumunu ölçmez. Paketteki tarih önceliklidir: STT (son tüketim) geçtiyse tüketme; TETT (tavsiye edilen) geçtiyse kalite düşmüş olabilir, kontrol et. Görünüşü, kokusu ya da tadı değişen ürünü tüketme.</p>
        <p className="about__credit">
          Ürün görselleri: Twemoji, © Twitter/X ve katkıda bulunanlar,{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC-BY 4.0
          </a>
          .
        </p>
      </section>
      <div className="list-end" />

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} label="Onay">
        {confirm?.kind === 'reset' && (
          <ConfirmBody
            title="Her şey silinsin mi?"
            text={`Mutfağındaki ${items.length} ürün, tüm geçmiş ve alışveriş listesi silinecek. Hemen ardından geri alabilirsin; sonrasında geri gelmez.${settings.calendar ? ' Takvimine eklediğin hatırlatıcılar kendiliğinden silinmez; sonra Ayarlar’dan yeni takvim dosyası hazırlayıp iptal et.' : ''}`}
            action="Sil"
            danger
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              const prev = snapshot();
              reset();
              setConfirm(null);
              toast({ text: 'Tüm veriler silindi', undo: () => replaceAll(prev) });
            }}
          />
        )}
        {confirm?.kind === 'demo' && (
          <ConfirmBody
            title="Örnek mutfak yüklensin mi?"
            text={`Mutfağındaki ${items.length} ürünün yerini örnek ürünler alacak. İstersen hemen geri alabilirsin.`}
            action="Örnekle değiştir"
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              const prev = snapshot();
              loadDemo();
              setConfirm(null);
              toast({ text: 'Örnek mutfak yüklendi', tone: 'good', undo: () => replaceAll(prev) });
            }}
          />
        )}
        {confirm?.kind === 'restore' && (
          <ConfirmBody
            title="Yedek yüklensin mi?"
            text={`Yedekte ${confirm.items.length} ürün, ${confirm.history.length} geçmiş kaydı${confirm.shopping?.length ? `, ${confirm.shopping.length} alışveriş satırı` : ''}${confirm.plans?.length ? `, ${confirm.plans.length} plan` : ''} var. Şu anki ${items.length} ürünün yerini alacak.${confirm.skipped ? ` Bozuk ${confirm.skipped} kayıt atlandı.` : ''}`}
            action="Yükle"
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              const prev = snapshot();
              replaceAll({ items: confirm.items, history: confirm.history, shopping: confirm.shopping, plans: confirm.plans, settings: confirm.settings });
              setConfirm(null);
              toast({ text: `${confirm.items.length} ürün geri yüklendi`, tone: 'good', undo: () => replaceAll(prev) });
            }}
          />
        )}
        {confirm?.kind === 'calendar' && (
          <div>
            <h2 className="sheet-title">Takvim dosyası hazırlandı</h2>
            <ol className="howto">
              <li>İndirilen “mutfak-hatirlaticilar” dosyasını aç.</li>
              <li>Takvim uygulamanda “Ekle” ya da “Tümünü ekle”yi seç.</li>
              <li>Uyarı günü sabah 09:00’da takvimin hatırlatır (uyarı günü bugün olanlar için birkaç dakika sonra).</li>
            </ol>
            <p className="sheet-sub">
              Ürün ekledikçe, bitirdikçe ya da tarih değiştikçe dosyayı yeniden hazırla; gerektiğinde ana ekranda haber veririz. Bazı takvim uygulamaları eski hatırlatıcıları güncellemez ya da iptal etmez: aynı ürün için iki hatırlatıcı görürsen eski “Mutfakta Ne Var?” etkinliklerini silip yeni dosyayı ekle.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn--soft btn--lg" onClick={() => setConfirm(null)}>
                Henüz eklemedim
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  confirmCalendar();
                  setConfirm(null);
                }}
              >
                Takvimime ekledim
              </button>
            </div>
          </div>
        )}
        {confirm?.kind === 'notify-denied' && (
          <div>
            <h2 className="sheet-title">Bildirim izni kapalı</h2>
            <ol className="howto">
              <li>
                <strong>Android (Chrome):</strong> adres çubuğundaki kilit simgesi → İzinler → Bildirimler → İzin ver.
              </li>
              <li>
                <strong>iPhone:</strong> önce Paylaş → “Ana Ekrana Ekle” ile uygulamayı yükle; sonra Ayarlar → Bildirimler → Mutfağım.
              </li>
            </ol>
            <p className="sheet-sub">Uygulama kapalıyken de hatırlatma için “Takvime hatırlatıcı ekle”yi kullan.</p>
            <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => setConfirm(null)}>
              Tamam
            </button>
          </div>
        )}
      </Sheet>
    </main>
  );
}

function ConfirmBody({ title, text, action, danger, onCancel, onConfirm }: { title: string; text: string; action: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div>
      <h2 className="sheet-title">{title}</h2>
      <p className="sheet-sub">{text}</p>
      <div className="btn-row">
        <button type="button" className="btn btn--soft btn--lg" onClick={onCancel}>
          Vazgeç
        </button>
        <button type="button" className={`btn btn--lg ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>
          {action}
        </button>
      </div>
    </div>
  );
}

function SettingRow({ icon, title, sub, onClick, danger }: { icon: IconName; title: string; sub: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={`row row--btn ${danger ? 'row--danger' : ''}`} onClick={onClick}>
      <span className="row__icon">
        <Icon name={icon} />
      </span>
      <span className="row__text">
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
      <Icon name="chevron" size={18} className="row__chev" />
    </button>
  );
}
