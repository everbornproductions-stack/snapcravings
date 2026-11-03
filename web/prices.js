// Price-source label for the cook cost (2026-11-02). Server tags come from functions/_lib/prices.js:
// 'store' = Kroger store price near the user, 'regional' = BLS average for the user's US region. Own strings, 10 languages.
(function (root) {
  const T = {
    en: { line: 'Real prices for {n} of {m} ingredients: {src}.', regional: 'regional average ({r}, BLS {p})', store: 'store price near you', US: 'US', NE: 'Northeast', MW: 'Midwest', S: 'South', W: 'West', tag: 'regional average', tagS: 'store price' },
    es: { line: 'Precios reales para {n} de {m} ingredientes: {src}.', regional: 'promedio regional ({r}, BLS {p})', store: 'precio de tienda cerca de ti', US: 'EE. UU.', NE: 'Noreste', MW: 'Medio Oeste', S: 'Sur', W: 'Oeste', tag: 'promedio regional', tagS: 'precio de tienda' },
    pt: { line: 'Preços reais para {n} de {m} ingredientes: {src}.', regional: 'média regional ({r}, BLS {p})', store: 'preço de loja perto de você', US: 'EUA', NE: 'Nordeste', MW: 'Meio-Oeste', S: 'Sul', W: 'Oeste', tag: 'média regional', tagS: 'preço de loja' },
    hi: { line: '{m} में से {n} सामग्रियों के असली दाम: {src}।', regional: 'क्षेत्रीय औसत ({r}, BLS {p})', store: 'आपके पास की दुकान का दाम', US: 'अमेरिका', NE: 'उत्तर-पूर्व', MW: 'मध्य-पश्चिम', S: 'दक्षिण', W: 'पश्चिम', tag: 'क्षेत्रीय औसत', tagS: 'दुकान का दाम' },
    id: { line: 'Harga asli untuk {n} dari {m} bahan: {src}.', regional: 'rata-rata regional ({r}, BLS {p})', store: 'harga toko di dekat Anda', US: 'AS', NE: 'Timur Laut', MW: 'Midwest', S: 'Selatan', W: 'Barat', tag: 'rata-rata regional', tagS: 'harga toko' },
    fr: { line: 'Prix réels pour {n} ingrédients sur {m} : {src}.', regional: 'moyenne régionale ({r}, BLS {p})', store: 'prix en magasin près de chez vous', US: 'États-Unis', NE: 'Nord-Est', MW: 'Midwest', S: 'Sud', W: 'Ouest', tag: 'moyenne régionale', tagS: 'prix en magasin' },
    de: { line: 'Echte Preise für {n} von {m} Zutaten: {src}.', regional: 'regionaler Durchschnitt ({r}, BLS {p})', store: 'Ladenpreis in deiner Nähe', US: 'USA', NE: 'Nordosten', MW: 'Mittlerer Westen', S: 'Süden', W: 'Westen', tag: 'regionaler Durchschnitt', tagS: 'Ladenpreis' },
    ar: { line: 'أسعار حقيقية لـ {n} من {m} مكونات: {src}.', regional: 'متوسط إقليمي ({r}، BLS {p})', store: 'سعر متجر قريب منك', US: 'الولايات المتحدة', NE: 'الشمال الشرقي', MW: 'الغرب الأوسط', S: 'الجنوب', W: 'الغرب', tag: 'متوسط إقليمي', tagS: 'سعر المتجر' },
    ru: { line: 'Реальные цены для {n} из {m} ингредиентов: {src}.', regional: 'средняя по региону ({r}, BLS {p})', store: 'цена в магазине рядом с вами', US: 'США', NE: 'Северо-Восток', MW: 'Средний Запад', S: 'Юг', W: 'Запад', tag: 'средняя по региону', tagS: 'цена в магазине' },
    tr: { line: '{m} malzemeden {n} tanesi için gerçek fiyatlar: {src}.', regional: 'bölge ortalaması ({r}, BLS {p})', store: 'yakınınızdaki mağaza fiyatı', US: 'ABD', NE: 'Kuzeydoğu', MW: 'Orta Batı', S: 'Güney', W: 'Batı', tag: 'bölge ortalaması', tagS: 'mağaza fiyatı' }
  };
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  // ps = the crave answer's priceSrc; returns plain text ('' when nothing real was used).
  function label(ps, lang) {
    if (!ps || !(ps.store + ps.regional)) return ''; const L = T[String(lang || 'en').slice(0, 2)] || T.en;
    const parts = []; if (ps.store) parts.push(L.store); if (ps.regional) parts.push(fill(L.regional, { r: L[ps.region] || L.US, p: String(ps.period || '').replace(/^(\w{3})\w*/, '$1') }));
    return fill(L.line, { n: ps.store + ps.regional, m: ps.of, src: parts.join(' · ') });
  }
  const tag = (src, lang) => { const L = T[String(lang || 'en').slice(0, 2)] || T.en; return src === 'store' ? L.tagS : src === 'regional' ? L.tag : ''; };
  root.SC_PRICES = { T, label, tag };
})(typeof globalThis !== 'undefined' ? globalThis : this);
