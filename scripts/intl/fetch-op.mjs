// Downloads all raw-food (type=CATEGORY) prices from Open Prices into op-raw.json (cache for build.mjs).
import fs from 'node:fs';
const out = []; let page = 1, pages = 1;
while (page <= pages) {
  const r = await fetch(`https://prices.openfoodfacts.org/api/v1/prices?type=CATEGORY&size=100&page=${page}&order_by=-date`, { headers: { 'user-agent': 'SnapCravings-price-refresh/1.0 (bot@local)' } });
  if (!r.ok) throw new Error('open prices ' + r.status); const d = await r.json(); pages = d.pages;
  for (const p of d.items) out.push({ tag: p.category_tag, price: p.price, per: p.price_per, cur: p.currency, date: p.date, cc: p.location?.osm_address_country_code, w: p.price_is_discounted, org: p.origins_tags, loc: p.location_id });
  page++;
}
fs.writeFileSync(new URL('./op-raw.json', import.meta.url), JSON.stringify(out));
console.log(out.length, 'prices');
