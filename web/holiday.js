// Holiday mode (2026-11-02): from ~7 days before a major holiday through the day itself, the app gets holiday accent
// colors, a header emoji, a small banner and a "Holiday foods" craving. Per country (API /api/geo -> cf.country, else the
// browser locale region, else the language). Dev overrides: ?holiday=<id> and ?country=XX. Plain script: sets
// globalThis.SC_HOLIDAY (browser) and is imported for its side effect by functions/api/[[path]].js and the tests.
(function (root) {
  const D = (y, m, d) => new Date(y, m - 1, d);
  const nth = (y, m, wd, n) => { const f = D(y, m, 1); return D(y, m, 1 + ((wd - f.getDay() + 7) % 7) + 7 * (n - 1)); }; // n-th weekday of month
  const last = (y, m, wd) => { const l = D(y, m + 1, 0); return D(y, m, l.getDate() - ((l.getDay() - wd + 7) % 7)); };
  const add = (d, n) => D(d.getFullYear(), d.getMonth() + 1, d.getDate() + n);
  function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return D(y, mo, da); }
  function orthEaster(y) { const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7, mo = Math.floor((d + e + 114) / 31), da = ((d + e + 114) % 31) + 1; return add(D(y, mo, da), 13); } // Julian -> Gregorian (1900-2099)
  // Lunar / lunisolar dates (verify yearly): table through 2028.
  const T = { lunar: { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26] }, diwali: { 2025: [10, 20], 2026: [11, 8], 2027: [10, 29], 2028: [10, 17] },
    holi: { 2025: [3, 14], 2026: [3, 4], 2027: [3, 22], 2028: [3, 11] }, ramadan: { 2025: [3, 1], 2026: [2, 18], 2027: [2, 8], 2028: [1, 28] },
    eid: { 2025: [3, 30], 2026: [3, 20], 2027: [3, 9], 2028: [2, 26] }, adha: { 2025: [6, 6], 2026: [5, 27], 2027: [5, 16], 2028: [5, 5] }, hanukkah: { 2025: [12, 14], 2026: [12, 4], 2027: [12, 24], 2028: [12, 12] } };
  const tab = k => y => T[k][y] ? D(y, T[k][y][0], T[k][y][1]) : null;
  // id: [emoji, accent, soft accent, date(y), window start offset (default -7), classic dishes for the AI]
  const H = {
    newyear: ['🎆', '#C9A227', '#F8F0D4', y => D(y, 1, 1), -7, 'party bites, festive roast, champagne-friendly appetizers'],
    valentines: ['💘', '#D6336C', '#FBE3EC', y => D(y, 2, 14), -7, 'romantic dinner for two, steak, pasta, chocolate desserts'],
    stpatricks: ['☘️', '#2F8F5B', '#E3F3E9', y => D(y, 3, 17), -7, 'corned beef and cabbage, Irish stew, soda bread, colcannon, shepherd\'s pie'],
    easter: ['🐣', '#9B6BD3', '#EFE6FA', easter, -7, 'glazed ham, roast lamb, deviled eggs, hot cross buns, carrot cake'],
    cincodemayo: ['🌮', '#D9480F', '#FFE8D9', y => D(y, 5, 5), -7, 'tacos, guacamole, enchiladas, elote, churros'],
    mothersday: ['💐', '#E64980', '#FDE6EF', y => nth(y, 5, 0, 2), -7, 'brunch, eggs Benedict, French toast, quiche, pretty desserts'],
    memorialday: ['🇺🇸', '#1C5DB8', '#E1EBFA', y => last(y, 5, 1), -7, 'BBQ burgers, grilled chicken, potato salad, coleslaw'],
    fathersday: ['👔', '#1C5DB8', '#E1EBFA', y => nth(y, 6, 0, 3), -7, 'grilled steak, ribs, burgers, loaded potatoes'],
    july4: ['🎇', '#C92A2A', '#FCE3E3', y => D(y, 7, 4), -7, 'BBQ, hot dogs, burgers, corn on the cob, apple pie, flag cake'],
    laborday: ['🌭', '#1C5DB8', '#E1EBFA', y => nth(y, 9, 1, 1), -7, 'grilled burgers, hot dogs, pasta salad, cookout sides'],
    halloween: ['🎃', '#E8590C', '#FFE8D6', y => D(y, 10, 31), -7, 'pumpkin soup, chili, spooky snacks, caramel apples, pumpkin treats'],
    thanksgiving: ['🦃', '#B5651D', '#F7E7D6', y => nth(y, 11, 4, 4), -7, 'roast turkey, stuffing, mashed potatoes and gravy, green bean casserole, cranberry sauce, pumpkin pie'],
    hanukkah: ['🕎', '#1C5DB8', '#E1EBFA', tab('hanukkah'), -7, 'latkes, brisket, sufganiyot, kugel, challah'],
    christmas: ['🎄', '#C92A2A', '#E3F3E9', y => D(y, 12, 25), -7, 'roast, glazed ham, holiday sides, cookies, festive desserts'],
    diwali: ['🪔', '#E67700', '#FFF0D6', tab('diwali'), -7, 'sweets like gulab jamun, kaju katli and ladoo, samosas, chole, paneer dishes'],
    ramadan: ['🌙', '#2B8A6E', '#DFF3EC', y => { const r = tab('ramadan')(y), e = tab('eid')(y); return r && e ? { start: add(r, -3), end: add(e, -4) } : null; }, 0, 'iftar dishes: dates, lentil soup, samosas/sambusa, fattoush, stuffed dishes, kebabs'],
    eid: ['🌙', '#2B8A6E', '#DFF3EC', tab('eid'), -3, 'Eid feast: biryani, ma\'amoul, sheer khurma, kebabs, sweets'],
    eidadha: ['🐑', '#2B8A6E', '#DFF3EC', tab('adha'), -7, 'lamb or goat dishes, kebabs, rice pilaf, stews, festive sweets'],
    lunarnewyear: ['🧧', '#C92A2A', '#FCE3E3', tab('lunar'), -7, 'dumplings, spring rolls, whole fish, long-life noodles, nian gao'],
    holi: ['🎨', '#D6336C', '#FBE3EC', tab('holi'), -7, 'gujiya, thandai, dahi vada, pakoras, puran poli'],
    carnaval: ['🎭', '#7048E8', '#ECE6FD', y => add(easter(y), -47), -7, 'feijoada, coxinha, pastel, brigadeiro, street snacks'],
    festajunina: ['🌽', '#E67700', '#FFF0D6', y => D(y, 6, 24), -7, 'pamonha, canjica, pé de moleque, corn cake, quentão-style treats'],
    muertos: ['💀', '#E8590C', '#FFE8D6', y => ({ start: D(y, 10, 26), end: D(y, 11, 2) }), 0, 'pan de muerto, mole, tamales, champurrado, calabaza en tacha'],
    posadas: ['🎄', '#C92A2A', '#E3F3E9', y => ({ start: D(y, 12, 16), end: D(y, 12, 25) }), 0, 'tamales, pozole, bacalao, ponche navideño, buñuelos'],
    reyes: ['👑', '#C9A227', '#F8F0D4', y => D(y, 1, 6), -4, 'rosca de reyes / galette des rois, hot chocolate, festive roast'],
    bastille: ['🇫🇷', '#1C5DB8', '#E1EBFA', y => D(y, 7, 14), -7, 'picnic food, quiche, salade niçoise, crêpes, tarte aux fruits'],
    oktoberfest: ['🍺', '#1C5DB8', '#E1EBFA', y => ({ start: D(y, 9, 16), end: D(y, 10, 3) }), 0, 'bratwurst, pretzels, schnitzel, potato salad, sauerkraut, obatzda'],
    orthodoxxmas: ['🎄', '#C92A2A', '#E3F3E9', y => D(y, 1, 7), -5, 'kutia, olivier salad, roast goose or duck, pirozhki, honey cake'],
    maslenitsa: ['🥞', '#E67700', '#FFF0D6', y => { const e = orthEaster(y); return { start: add(e, -56), end: add(e, -49) }; }, 0, 'blini with sour cream, jam or caviar, syrniki, pancakes'],
  };
  const L = { // labels: en, es, pt, hi, id, fr, de, ar, ru, tr
    newyear: ['New Year\'s', 'Año Nuevo', 'Ano-Novo', 'नया साल', 'Tahun Baru', 'Nouvel An', 'Silvester & Neujahr', 'رأس السنة', 'Новый год', 'Yılbaşı'],
    valentines: ['Valentine\'s Day', 'San Valentín', 'Dia dos Namorados', 'वैलेंटाइन डे', 'Hari Valentine', 'Saint-Valentin', 'Valentinstag', 'عيد الحب', 'День святого Валентина', 'Sevgililer Günü'],
    stpatricks: ['St. Patrick\'s Day', 'Día de San Patricio', 'Dia de São Patrício', 'सेंट पैट्रिक डे', 'Hari St. Patrick', 'Saint-Patrick', 'St. Patrick\'s Day', 'عيد القديس باتريك', 'День святого Патрика', 'Aziz Patrick Günü'],
    easter: ['Easter', 'Pascua', 'Páscoa', 'ईस्टर', 'Paskah', 'Pâques', 'Ostern', 'عيد الفصح', 'Пасха', 'Paskalya'],
    cincodemayo: ['Cinco de Mayo', 'Cinco de Mayo', 'Cinco de Mayo', 'सिंको डे मायो', 'Cinco de Mayo', 'Cinco de Mayo', 'Cinco de Mayo', 'سينكو دي مايو', 'Синко де Майо', 'Cinco de Mayo'],
    mothersday: ['Mother\'s Day', 'Día de las Madres', 'Dia das Mães', 'मदर्स डे', 'Hari Ibu', 'Fête des mères', 'Muttertag', 'عيد الأم', 'День матери', 'Anneler Günü'],
    memorialday: ['Memorial Day', 'Memorial Day', 'Memorial Day', 'मेमोरियल डे', 'Memorial Day', 'Memorial Day', 'Memorial Day', 'يوم الذكرى', 'День памяти (США)', 'Anma Günü (ABD)'],
    fathersday: ['Father\'s Day', 'Día del Padre', 'Dia dos Pais', 'फादर्स डे', 'Hari Ayah', 'Fête des pères', 'Vatertag', 'عيد الأب', 'День отца', 'Babalar Günü'],
    july4: ['the 4th of July', '4 de Julio', '4 de Julho', '4 जुलाई', '4 Juli', '4 Juillet', '4. Juli', 'الرابع من يوليو', '4 июля', '4 Temmuz'],
    laborday: ['Labor Day', 'Día del Trabajo (EE. UU.)', 'Labor Day', 'लेबर डे', 'Labor Day', 'Labor Day', 'Labor Day', 'عيد العمال', 'День труда (США)', 'İşçi Bayramı (ABD)'],
    halloween: ['Halloween', 'Halloween', 'Halloween', 'हैलोवीन', 'Halloween', 'Halloween', 'Halloween', 'الهالوين', 'Хэллоуин', 'Cadılar Bayramı'],
    thanksgiving: ['Thanksgiving', 'Día de Acción de Gracias', 'Dia de Ação de Graças', 'थैंक्सगिविंग', 'Thanksgiving', 'Thanksgiving', 'Thanksgiving', 'عيد الشكر', 'День благодарения', 'Şükran Günü'],
    hanukkah: ['Hanukkah', 'Janucá', 'Hanukkah', 'हनुक्का', 'Hanukkah', 'Hanoukka', 'Chanukka', 'عيد الأنوار (حانوكا)', 'Ханука', 'Hanuka'],
    christmas: ['Christmas', 'Navidad', 'Natal', 'क्रिसमस', 'Natal', 'Noël', 'Weihnachten', 'عيد الميلاد', 'Рождество', 'Noel'],
    diwali: ['Diwali', 'Diwali', 'Diwali', 'दिवाली', 'Diwali', 'Diwali', 'Diwali', 'ديوالي', 'Дивали', 'Diwali'],
    ramadan: ['Ramadan iftar', 'Iftar de Ramadán', 'Iftar do Ramadã', 'रमज़ान इफ़्तार', 'Buka puasa Ramadan', 'Iftar du Ramadan', 'Ramadan-Iftar', 'إفطار رمضان', 'Ифтар в Рамадан', 'Ramazan iftarı'],
    eid: ['Eid al-Fitr', 'Eid al-Fitr', 'Eid al-Fitr', 'ईद-उल-फ़ित्र', 'Lebaran (Idulfitri)', 'Aïd el-Fitr', 'Zuckerfest (Eid al-Fitr)', 'عيد الفطر', 'Ураза-байрам', 'Ramazan Bayramı'],
    eidadha: ['Eid al-Adha', 'Eid al-Adha', 'Eid al-Adha', 'ईद-उल-अज़हा (बकरीद)', 'Iduladha', 'Aïd el-Kébir', 'Opferfest (Eid al-Adha)', 'عيد الأضحى', 'Курбан-байрам', 'Kurban Bayramı'],
    lunarnewyear: ['Lunar New Year', 'Año Nuevo Lunar', 'Ano-Novo Lunar', 'चीनी नव वर्ष', 'Imlek', 'Nouvel An lunaire', 'Mondneujahr', 'رأس السنة القمرية', 'Лунный Новый год', 'Ay Yılı'],
    holi: ['Holi', 'Holi', 'Holi', 'होली', 'Holi', 'Holi', 'Holi', 'هولي', 'Холи', 'Holi'],
    carnaval: ['Carnival', 'Carnaval', 'Carnaval', 'कार्निवल', 'Karnaval', 'Carnaval', 'Karneval', 'الكرنفال', 'Карнавал', 'Karnaval'],
    festajunina: ['Festa Junina', 'Fiesta de San Juan', 'Festa Junina', 'फेस्टा जुनीना', 'Festa Junina', 'Festa Junina', 'Festa Junina', 'فيستا جونينا', 'Фешта Жунина', 'Festa Junina'],
    muertos: ['Day of the Dead', 'Día de Muertos', 'Dia dos Mortos', 'मृतकों का दिन', 'Hari Orang Mati', 'Jour des morts', 'Tag der Toten', 'يوم الموتى', 'День мёртвых', 'Ölüler Günü'],
    posadas: ['Christmas & Las Posadas', 'Posadas y Navidad', 'Natal e Las Posadas', 'क्रिसमस', 'Natal', 'Noël et Posadas', 'Weihnachten', 'عيد الميلاد', 'Рождество', 'Noel'],
    reyes: ['Epiphany', 'Día de Reyes', 'Dia de Reis', 'एपिफेनी', 'Epifani', 'Épiphanie (galette des rois)', 'Heilige Drei Könige', 'عيد الغطاس', 'Крещение', 'Epifani'],
    bastille: ['Bastille Day', 'Día de la Bastilla', 'Queda da Bastilha', 'बास्तील दिवस', 'Hari Bastille', '14 Juillet', 'Französischer Nationalfeiertag', 'يوم الباستيل', 'День взятия Бастилии', 'Bastille Günü'],
    oktoberfest: ['Oktoberfest', 'Oktoberfest', 'Oktoberfest', 'ऑक्टोबरफेस्ट', 'Oktoberfest', 'Oktoberfest', 'Oktoberfest', 'أكتوبرفست', 'Октоберфест', 'Oktoberfest'],
    orthodoxxmas: ['Orthodox Christmas', 'Navidad ortodoxa', 'Natal ortodoxo', 'ऑर्थोडॉक्स क्रिसमस', 'Natal Ortodoks', 'Noël orthodoxe', 'Orthodoxes Weihnachten', 'عيد الميلاد الأرثوذكسي', 'Рождество', 'Ortodoks Noeli'],
    maslenitsa: ['Maslenitsa', 'Maslenitsa', 'Maslenitsa', 'मास्लेनित्सा', 'Maslenitsa', 'Maslenitsa', 'Maslenitsa', 'ماسلينيتسا', 'Масленица', 'Maslenitsa'],
  };
  const LANGS = ['en', 'es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr'];
  const UI = { // [Holiday foods, {h} is coming!, Snap your fridge, then pick Holiday foods for {h} recipes.]
    en: ['Holiday foods', '{h} is coming!', 'Snap your fridge, then pick Holiday foods for {h} recipes.'],
    es: ['Comida de fiesta', '¡Se acerca {h}!', 'Toma foto a tu refri y elige Comida de fiesta para recetas de {h}.'],
    pt: ['Comidas de festa', '{h} está chegando!', 'Fotografe sua geladeira e escolha Comidas de festa para receitas de {h}.'],
    hi: ['त्योहार के पकवान', '{h} आ रहा है!', 'अपने फ्रिज की फोटो लें, फिर {h} की रेसिपी के लिए त्योहार के पकवान चुनें।'],
    id: ['Hidangan hari raya', '{h} sebentar lagi!', 'Foto kulkasmu, lalu pilih Hidangan hari raya untuk resep {h}.'],
    fr: ['Plats de fête', '{h} approche !', 'Photographiez votre frigo, puis choisissez Plats de fête pour des recettes de {h}.'],
    de: ['Festtagsessen', '{h} steht vor der Tür!', 'Fotografiere deinen Kühlschrank und wähle Festtagsessen für {h}-Rezepte.'],
    ar: ['أكلات العيد', '{h} على الأبواب!', 'صوّر ثلاجتك ثم اختر أكلات العيد لوصفات {h}.'],
    ru: ['Праздничные блюда', 'Скоро {h}!', 'Сфотографируйте холодильник и выберите «Праздничные блюда» для рецептов на {h}.'],
    tr: ['Bayram yemekleri', '{h} yaklaşıyor!', 'Buzdolabının fotoğrafını çek, {h} tarifleri için Bayram yemekleri\'ni seç.'],
  };
  const ARAB = 'SA AE EG QA KW BH OM JO LB SY IQ YE PS MA DZ TN LY SD'.split(' ');
  const LATAM = 'MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR'.split(' ');
  const SETS = {
    US: ['newyear', 'valentines', 'stpatricks', 'easter', 'cincodemayo', 'mothersday', 'memorialday', 'fathersday', 'july4', 'laborday', 'halloween', 'thanksgiving', 'hanukkah', 'christmas', 'diwali', 'ramadan', 'eid', 'lunarnewyear'],
    BR: ['newyear', 'carnaval', 'easter', 'festajunina', 'christmas'],
    IN: ['newyear', 'holi', 'ramadan', 'eid', 'diwali', 'christmas'],
    ID: ['newyear', 'lunarnewyear', 'ramadan', 'eid', 'eidadha', 'christmas'],
    MX: ['newyear', 'reyes', 'easter', 'muertos', 'posadas'],
    ES: ['newyear', 'reyes', 'easter', 'christmas'],
    FR: ['newyear', 'reyes', 'easter', 'bastille', 'christmas'],
    DE: ['newyear', 'easter', 'oktoberfest', 'christmas'],
    ARAB: ['newyear', 'ramadan', 'eid', 'eidadha'],
    RU: ['newyear', 'orthodoxxmas', 'maslenitsa'],
    TR: ['newyear', 'ramadan', 'eid', 'eidadha'],
    GLOBAL: ['newyear', 'valentines', 'easter', 'christmas'],
  };
  const ALIAS = { AT: 'DE', CH: 'DE', BE: 'FR', PT: 'BR', ...Object.fromEntries(ARAB.map(c => [c, 'ARAB'])), ...Object.fromEntries(LATAM.map(c => [c, 'MX'])) };
  const LANG_COUNTRY = { en: 'US', es: 'MX', pt: 'BR', hi: 'IN', id: 'ID', fr: 'FR', de: 'DE', ar: 'SA', ru: 'RU', tr: 'TR' };
  const setFor = cc => { cc = String(cc || '').toUpperCase(); return SETS[cc] || SETS[ALIAS[cc]] || SETS.GLOBAL; };
  // Browser fallback: locale region (pt-BR -> BR), else the language's main country.
  function countryFromLocale(loc, lang) { const m = String(loc || '').match(/^[a-z]{2,3}[-_]([A-Za-z]{2})\b/); if (m) return m[1].toUpperCase(); return LANG_COUNTRY[String(lang || loc || '').toLowerCase().slice(0, 2)] || ''; }
  const strip = d => D(d.getFullYear(), d.getMonth() + 1, d.getDate());
  function windowOf(id, year) { const h = H[id]; if (!h) return null; const v = h[3](year); if (!v) return null; return v.start ? v : { start: add(v, h[4]), end: v }; }
  // Active holiday for a local date + country: the one whose window holds today; short (<=10 day) windows beat long ones
  // (Ramadan, Muertos week...), then nearest end first.
  const rank = w => ((w.end - w.start) > 10 * 864e5 ? 1e15 : 0) + +w.end;
  function active(date, country) { const t = strip(date || new Date()); let best = null;
    for (const id of setFor(country)) for (const y of [t.getFullYear() - 1, t.getFullYear(), t.getFullYear() + 1]) { const w = windowOf(id, y); if (w && t >= w.start && t <= w.end && (!best || rank(w) < rank(best))) best = { id, ...w }; }
    return best; }
  const li = l => Math.max(0, LANGS.indexOf(String(l || 'en').slice(0, 2)));
  const info = (id, lang) => H[id] ? { id, emoji: H[id][0], accent: H[id][1], soft: H[id][2], name: L[id][li(lang)] || L[id][0], nameEn: L[id][0], dishes: H[id][5], ui: UI[LANGS[li(lang)]] } : null;
  root.SC_HOLIDAY = { H, L, UI, SETS, ids: Object.keys(H), setFor, active, info, windowOf, easter, orthEaster, countryFromLocale, isHoliday: c => /^holiday:[a-z0-9]+$/.test(String(c || '')) && !!H[String(c).slice(8)] };
})(typeof globalThis !== 'undefined' ? globalThis : this);
