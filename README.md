# Mutfakta Ne Var?

**Uygulama:** https://anildervisoglu1-art.github.io/mutfakta-ne-var/ — telefonda açıp *Ana Ekrana Ekle* (iPhone) ya da *Uygulamayı yükle* (Android) ile kurulur. `main` dalına her gönderimde otomatik yayınlanır.

**Buzdolabından kilere, mutfaktakileri unutma; bozulmadan ye.**

Buzdolabı, dondurucu, tezgâh ve kilerdeki ürünleri takip eden; her ürünün **saklandığı yere göre ortalama ömrünü** hesaplayıp ne zamana kadar tüketmen gerektiğini gösteren ve **son güne kalmadan** uyaran, Türkçe ve mobil öncelikli bir web uygulaması (PWA). Amaç israfı azaltmak.

## Neler var?

- **Mutfağım:** Ürünler aciliyete göre gruplanır: *Önce bunları ye*, *Tarihi geçenler*, *7 gün içinde*, *Daha sonra*. Sağdaki rozet son güne kalan günü ("Bugün son gün", "Yarın son gün", "3 gün kaldı"), görselin etrafındaki halka kalan tazeliği gösterir. "Yedim" ile tek dokunuşta düş (geri alınabilir); tarihi geçmişlerde düğme "Attım" olur. Yer filtresi (Buzdolabı/Dondurucu/Tezgâh/Kiler) ve arama.
- **Ekleme:** `+` ile buzdolabının kapağı açılır, raflarda senin ürünlerin görünür ve dolabın içine dalınır. ~130 ürün, 13 kategori: meyve, sebze, süt ürünleri, et-balık, ev yemeği, ekmek, içecek, sos/kavanoz, **bakliyat & tahıl, kuruyemiş & kuru meyve, yağ-çay-baharat, atıştırmalık, dondurulmuş**. Köşedeki **+** ile tek dokunuşta ekle ya da ürüne dokunup miktar, yer, "paketi açıldı mı?", "ne zaman pişirdin?" ve paketteki tarihi (STT/TETT) ayarla. "Sık aldıkların" satırı haftalık alışverişi hızlandırır. Aynı ürün tekrar eklenirse miktarı artar. Listede olmayan ürünün kategorisi adından tahmin edilir.
- **Uyarı mantığı:** Son güne, ayardaki kadar gün (1/2/3) kalınca ürün öne çıkar; aynı gün kalan ürünler hep aynı renkte. Açılan ürünün süresi kısalır, açılmış taze ürün oda sıcaklığında bırakılamaz, tarihi geçmiş ürün dondurulamaz; 2 günlük çiğ et için "pişirmeyeceksen dondur" önerisi.
- **Tarifler:** 49 tarif; bugün son günü olan ürünü kullananlar en üstte, ana malzemesi eksik tarif önerilmez, dondurucudakiler "çözdür" notuyla kullanılır. "Bunu pişirdim" de, her malzemeden ne kadar kullandığını seç (geri alınabilir), artanı dolaba ekle.
- **Özet:** Son 30 günde değerlendirme oranı, haftalık yenen/atılan grafiği, en çok atılan kategori.
- **Hatırlatma:** "Telefonuma hatırlat" takvim dosyası (.ics) ile her ürün için uyarı günü 09:00 alarmı; uygulama açılınca günlük özet bildirimi.
- Çevrimdışı çalışır, ana ekrana eklenebilir. Veriler yalnızca cihazda; yedekle/geri yükle (bozuk dosyalar ayıklanır). Açık/koyu tema, büyük yazı desteği, ekran okuyucu etiketleri, hareketi azalt desteği.

Süreler USDA FoodKeeper, FDA Cold Food Storage Chart ve üniversite yayım tablolarındaki aralıkların temkinli ucundan derlendi (`src/data/catalog.ts`). Paketteki son tüketim tarihi her zaman önceliklidir.

## Geliştirme

```bash
cd buzdolabi
npm install
npm run dev        # http://localhost:5173
npm test           # tarih/tazelik/öneri mantığı testleri
npm run typecheck
npm run build      # dist/
```

- `npm run food-images`: katalog ve tariflerde geçen emojilerin Twemoji SVG'lerini `public/food/` içine kopyalar.
- `npm run icons`: `public/icons/logo.svg`'den PWA ikonlarını üretir (Playwright gerekir).
- `node scripts/shots.mjs`: önizleme sunucusu açıkken ana akışların açık/koyu ekran görüntülerini `qa/` içine alır.
