// Price-source label for the cook cost (2026-11-02). Server tags come from functions/_lib/prices.js:
// 'store' = Kroger store price near the user, 'regional' = BLS average for the user's US region, 'local' = official/open country data (functions/_lib/intl-prices.js). Own strings, 10 languages.
(function (root) {
  const T = {
    en: { line: 'Real prices for {n} of {m} ingredients: {src}.', regional: 'regional average ({r}, BLS {p})', store: 'store price near you', US: 'US', NE: 'Northeast', MW: 'Midwest', S: 'South', W: 'West', tag: 'regional average', tagS: 'store price', local: 'local price ({s})', tagL: 'local price' },
    es: { line: 'Precios reales para {n} de {m} ingredientes: {src}.', regional: 'promedio regional ({r}, BLS {p})', store: 'precio de tienda cerca de ti', US: 'EE. UU.', NE: 'Noreste', MW: 'Medio Oeste', S: 'Sur', W: 'Oeste', tag: 'promedio regional', tagS: 'precio de tienda', local: 'precio local ({s})', tagL: 'precio local' },
    pt: { line: 'Preços reais para {n} de {m} ingredientes: {src}.', regional: 'média regional ({r}, BLS {p})', store: 'preço de loja perto de você', US: 'EUA', NE: 'Nordeste', MW: 'Meio-Oeste', S: 'Sul', W: 'Oeste', tag: 'média regional', tagS: 'preço de loja', local: 'preço local ({s})', tagL: 'preço local' },
    hi: { line: '{m} में से {n} सामग्रियों के असली दाम: {src}।', regional: 'क्षेत्रीय औसत ({r}, BLS {p})', store: 'आपके पास की दुकान का दाम', US: 'अमेरिका', NE: 'उत्तर-पूर्व', MW: 'मध्य-पश्चिम', S: 'दक्षिण', W: 'पश्चिम', tag: 'क्षेत्रीय औसत', tagS: 'दुकान का दाम', local: 'स्थानीय दाम ({s})', tagL: 'स्थानीय दाम' },
    id: { line: 'Harga asli untuk {n} dari {m} bahan: {src}.', regional: 'rata-rata regional ({r}, BLS {p})', store: 'harga toko di dekat Anda', US: 'AS', NE: 'Timur Laut', MW: 'Midwest', S: 'Selatan', W: 'Barat', tag: 'rata-rata regional', tagS: 'harga toko', local: 'harga lokal ({s})', tagL: 'harga lokal' },
    fr: { line: 'Prix réels pour {n} ingrédients sur {m} : {src}.', regional: 'moyenne régionale ({r}, BLS {p})', store: 'prix en magasin près de chez vous', US: 'États-Unis', NE: 'Nord-Est', MW: 'Midwest', S: 'Sud', W: 'Ouest', tag: 'moyenne régionale', tagS: 'prix en magasin', local: 'prix local ({s})', tagL: 'prix local' },
    de: { line: 'Echte Preise für {n} von {m} Zutaten: {src}.', regional: 'regionaler Durchschnitt ({r}, BLS {p})', store: 'Ladenpreis in deiner Nähe', US: 'USA', NE: 'Nordosten', MW: 'Mittlerer Westen', S: 'Süden', W: 'Westen', tag: 'regionaler Durchschnitt', tagS: 'Ladenpreis', local: 'lokaler Preis ({s})', tagL: 'lokaler Preis' },
    ar: { line: 'أسعار حقيقية لـ {n} من {m} مكونات: {src}.', regional: 'متوسط إقليمي ({r}، BLS {p})', store: 'سعر متجر قريب منك', US: 'الولايات المتحدة', NE: 'الشمال الشرقي', MW: 'الغرب الأوسط', S: 'الجنوب', W: 'الغرب', tag: 'متوسط إقليمي', tagS: 'سعر المتجر', local: 'سعر محلي ({s})', tagL: 'سعر محلي' },
    ru: { line: 'Реальные цены для {n} из {m} ингредиентов: {src}.', regional: 'средняя по региону ({r}, BLS {p})', store: 'цена в магазине рядом с вами', US: 'США', NE: 'Северо-Восток', MW: 'Средний Запад', S: 'Юг', W: 'Запад', tag: 'средняя по региону', tagS: 'цена в магазине', local: 'местная цена ({s})', tagL: 'местная цена' },
    tr: { line: '{m} malzemeden {n} tanesi için gerçek fiyatlar: {src}.', regional: 'bölge ortalaması ({r}, BLS {p})', store: 'yakınınızdaki mağaza fiyatı', US: 'ABD', NE: 'Kuzeydoğu', MW: 'Orta Batı', S: 'Güney', W: 'Batı', tag: 'bölge ortalaması', tagS: 'mağaza fiyatı', local: 'yerel fiyat ({s})', tagL: 'yerel fiyat' }
  };
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  // ps = the crave answer's priceSrc; returns plain text ('' when nothing real was used).
  function label(ps, lang) {
    if (!ps || !((ps.store || 0) + (ps.regional || 0) + (ps.local || 0))) return ''; const L = T[String(lang || 'en').slice(0, 2)] || T.en;
    const parts = []; if (ps.store) parts.push(L.store); if (ps.regional) parts.push(fill(L.regional, { r: L[ps.region] || L.US, p: String(ps.period || '').replace(/^(\w{3})\w*/, '$1') }));
    if (ps.local) parts.push(fill(L.local, { s: (ps.srcs || []).join(', ') }).replace(' ()', ''));
    return fill(L.line, { n: (ps.store || 0) + (ps.regional || 0) + (ps.local || 0), m: ps.of, src: parts.join(' · ') });
  }
  const tag = (src, lang) => { const L = T[String(lang || 'en').slice(0, 2)] || T.en; return src === 'store' ? L.tagS : src === 'regional' ? L.tag : src === 'local' ? L.tagL : ''; };
  root.SC_PRICES = { T, label, tag };
})(typeof globalThis !== 'undefined' ? globalThis : this);
