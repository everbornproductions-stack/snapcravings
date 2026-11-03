// SnapCravings local currency + price levels (2026-11-02). Shared by the web app (classic script, globalThis.SC_MONEY) and the
// Pages functions (import '../../web/money.js'). Rough on purpose: fx = local units per US$ (late 2026), g = grocery price level
// vs the US in US$ terms, ck = 1 kg chicken breast in local money (prompt anchor so AI prices land in the right range),
// d = typical delivery fee [low, high] in local money, sv = app service fee share, tip = usual tip share, mk = app menu markup.
// Prices are AI ESTIMATES for the user's country. Stripe on the web still charges US$; the Play app shows Google's own prices.
(function (root) {
  const E = (fx, g, ck, d, sv, tip, mk) => ({ fx, g, ck, d, sv, tip, mk });
  const EUR = (g, ck, d, sv = 0.05, tip = 0.05) => ({ c: 'EUR', ...E(0.93, g, ck, d, sv, tip, 0.1) });
  const C = {
    US: { c: 'USD', ...E(1, 1, 9, [0, 6], 0.15, 0.15, 0.15) }, CA: { c: 'CAD', ...E(1.38, 1.05, 15, [2, 6], 0.12, 0.12, 0.15) },
    GB: { c: 'GBP', ...E(0.79, 0.85, 7, [1, 4], 0.1, 0.05, 0.12) }, IE: EUR(0.95, 11, [2, 5]), AU: { c: 'AUD', ...E(1.52, 1.05, 14, [3, 8], 0.1, 0, 0.15) }, NZ: { c: 'NZD', ...E(1.65, 1.05, 16, [3, 8], 0.1, 0, 0.15) },
    DE: EUR(0.85, 11, [1, 4]), AT: EUR(0.9, 12, [1, 4]), FR: EUR(0.9, 12, [1, 4]), ES: EUR(0.75, 8, [1, 4]), IT: EUR(0.8, 10, [1, 4]), PT: EUR(0.7, 7, [1, 3]),
    NL: EUR(0.85, 11, [1, 4]), BE: EUR(0.9, 12, [1, 4]), FI: EUR(0.95, 12, [2, 6]), GR: EUR(0.75, 8, [1, 3]),
    CH: { c: 'CHF', ...E(0.88, 1.4, 28, [3, 8], 0.05, 0.05, 0.1) }, PL: { c: 'PLN', ...E(4, 0.6, 28, [5, 12], 0.05, 0.05, 0.1) },
    SE: { c: 'SEK', ...E(10.5, 0.95, 110, [20, 50], 0.05, 0, 0.1) }, NO: { c: 'NOK', ...E(10.8, 1.2, 150, [30, 70], 0.05, 0, 0.1) }, DK: { c: 'DKK', ...E(6.9, 1, 85, [20, 45], 0.05, 0, 0.1) },
    MX: { c: 'MXN', ...E(18, 0.55, 130, [15, 45], 0.1, 0.1, 0.15) }, BR: { c: 'BRL', ...E(5.5, 0.5, 28, [5, 12], 0.05, 0.05, 0.15) },
    AR: { c: 'ARS', ...E(1150, 0.6, 7500, [1500, 3500], 0.05, 0.1, 0.15) }, CO: { c: 'COP', ...E(4100, 0.45, 22000, [4000, 9000], 0.08, 0.1, 0.15) },
    CL: { c: 'CLP', ...E(950, 0.7, 7500, [1500, 3500], 0.08, 0.1, 0.15) }, PE: { c: 'PEN', ...E(3.75, 0.55, 20, [5, 10], 0.05, 0.05, 0.15) },
    IN: { c: 'INR', ...E(84, 0.25, 320, [20, 60], 0.05, 0.03, 0.15) }, PK: { c: 'PKR', ...E(280, 0.25, 1100, [100, 250], 0.05, 0.05, 0.15) }, BD: { c: 'BDT', ...E(120, 0.3, 500, [40, 100], 0.05, 0.03, 0.15) },
    ID: { c: 'IDR', ...E(16000, 0.35, 70000, [8000, 15000], 0.05, 0, 0.15) }, PH: { c: 'PHP', ...E(57, 0.45, 260, [49, 99], 0.05, 0.05, 0.15) },
    MY: { c: 'MYR', ...E(4.5, 0.45, 15, [4, 8], 0.05, 0, 0.15) }, TH: { c: 'THB', ...E(35, 0.45, 110, [20, 50], 0.05, 0, 0.15) }, VN: { c: 'VND', ...E(25000, 0.35, 110000, [15000, 30000], 0.05, 0, 0.15) },
    JP: { c: 'JPY', ...E(150, 0.8, 1300, [200, 400], 0.1, 0, 0.1) }, KR: { c: 'KRW', ...E(1380, 1.1, 14000, [3000, 5000], 0, 0, 0.1) }, SG: { c: 'SGD', ...E(1.34, 1, 12, [3, 6], 0.05, 0, 0.15) },
    TR: { c: 'TRY', ...E(42, 0.45, 260, [20, 60], 0.05, 0.05, 0.15) }, RU: { c: 'RUB', ...E(95, 0.45, 480, [100, 300], 0.05, 0.05, 0.15) }, UA: { c: 'UAH', ...E(41, 0.4, 220, [40, 90], 0.05, 0.05, 0.15) },
    SA: { c: 'SAR', ...E(3.75, 0.8, 30, [7, 15], 0.05, 0.05, 0.15) }, AE: { c: 'AED', ...E(3.67, 0.9, 32, [5, 12], 0.05, 0.05, 0.15) }, EG: { c: 'EGP', ...E(50, 0.25, 250, [15, 35], 0.05, 0.05, 0.15) },
    MA: { c: 'MAD', ...E(10, 0.4, 70, [10, 20], 0.05, 0.05, 0.15) }, NG: { c: 'NGN', ...E(1600, 0.3, 7000, [800, 2000], 0.05, 0, 0.15) }, ZA: { c: 'ZAR', ...E(18, 0.5, 110, [15, 35], 0.05, 0.1, 0.15) }, KE: { c: 'KES', ...E(130, 0.4, 700, [100, 250], 0.05, 0, 0.15) }
  };
  const NAMES = { US: 'the United States', GB: 'the United Kingdom', AE: 'the United Arab Emirates', NL: 'the Netherlands', PH: 'the Philippines' };
  const cc2 = c => { c = String(c || '').toUpperCase().slice(0, 2); return /^[A-Z]{2}$/.test(c) ? c : ''; };
  const of = cc => C[cc2(cc)] || C.US;
  const cur = cc => of(cc).c;
  const name = cc => { cc = cc2(cc) || 'US'; if (NAMES[cc]) return NAMES[cc]; try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc); } catch { return cc; } };
  const dec = c => (Object.values(C).find(x => x.c === c)?.fx || 1) >= 50 ? 0 : 2; // INR, IDR, JPY... no cents
  const round = (n, c) => { const d = dec(c); const v = Number(n) || 0; return d ? Math.round(v * 100) / 100 : v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v); };
  function fmt(n, c = 'USD', lang) {
    const v = Number(n) || 0, d = dec(c);
    try { return new Intl.NumberFormat(lang || undefined, { style: 'currency', currency: c, currencyDisplay: c === 'USD' && (!lang || lang === 'en') ? 'narrowSymbol' : 'symbol', minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
    catch { return (c === 'USD' ? '$' : c + ' ') + v.toFixed(d); }
  }
  // US-equivalent US$ (what the library/cached data hold) -> realistic local money, and back.
  const fromUS = (usd, cc) => { const k = of(cc); return round((Number(usd) || 0) * k.fx * k.g, k.c); };
  const toUS = (v, cc) => { const k = of(cc); return Math.round((Number(v) || 0) / (k.fx * k.g) * 100) / 100; };
  // Prompt line for every AI cost estimate.
  const note = cc => { cc = cc2(cc) || 'US'; const k = of(cc); return `PRICES: The user shops in ${name(cc)}. Give every price (est_price, est_cook_cost, est_menu_price) in ${k.c} as a plain number, using realistic current ${name(cc)} supermarket prices, local brands and local package sizes, not US prices converted. For scale: 1 kg chicken breast costs about ${k.ck} ${k.c} there.`; };
  // Rough delivery-app total for ONE order of this dish (servings x a typical menu price + markup + delivery + service + tip).
  // An ESTIMATE range, never a quote; menu = typical restaurant price of one serving in local money.
  function delivery(menu, servings, cc) {
    const k = of(cc), s = Math.max(1, Math.min(8, +servings || 1)), m = Math.max(0, +menu || 0); if (!m) return null;
    const food = m * s, lo = food * 0.9 * (1 + k.mk * 0.5), hi = food * 1.1 * (1 + k.mk);
    const tot = (f, d, x) => f + d + f * k.sv * x + f * k.tip * x;
    return { lo: round(tot(lo, k.d[0], 0.8), k.c), hi: round(tot(hi, k.d[1], 1.2), k.c), c: k.c };
  }
  // Fallback menu price when the AI gave none: home cost per serving x 3.5, at least a cheap local meal.
  const menuGuess = (cookPerServing, cc) => { const k = of(cc); return Math.max(+cookPerServing * 3.5 || 0, round(8 * k.fx * k.g, k.c)); };
  // Browser only: the user's country = ?country (dev/QA), else /api/geo (sessionStorage sc.geo), else the browser locale.
  const country = () => { try { const q = cc2(new URLSearchParams(location.search).get('country')); if (q) return q; let g = ''; try { g = sessionStorage.getItem('sc.geo') || ''; } catch {}
    return cc2(g) || cc2(root.SC_HOLIDAY && root.SC_HOLIDAY.countryFromLocale((navigator.languages || [])[0] || navigator.language, root.I18N && root.I18N.lang)) || 'US'; } catch { return 'US'; } };
  if (typeof location !== 'undefined') root.scCountry = country;
  root.SC_MONEY = { C, cc2, of, cur, name, dec, round, fmt, fromUS, toUS, note, delivery, menuGuess };
})(typeof globalThis !== 'undefined' ? globalThis : this);
