// SnapCravings web app. All AI calls go to /api/* (Cloudflare Pages Function); no keys in the client.
const $ = n => '$' + (Number(n) || 0).toFixed(2);
const r2 = n => Math.round(n * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = id => document.getElementById(id);
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('sc.' + k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem('sc.' + k, JSON.stringify(v)) };
const state = { photos: [], ingredients: LS.get('ingredients', []), low: LS.get('low', []), craving: 'Anything', recipes: LS.get('recipes', null), recipe: null, from: 'recipes', crave: LS.get('crave', null), busy: false };
let glist = LS.get('glist', []);
const CRAVINGS = ['Anything', 'Noodles', 'Something quick', 'Comfort food', 'Spicy'];
const MAX_PHOTOS = 4;

function toast(msg, ms = 3500) { const t = el('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = 'none', ms); }
async function api(path, body) {
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'Something went sideways. Try again!' }));
  if (!r.ok) throw new Error(j.error || 'Something went sideways. Try again!');
  return j;
}
// Resize on device: max 1280px, JPEG ~0.8, keeps uploads small.
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, 1280 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.8)); };
    img.onerror = () => rej(new Error('That photo could not be read. Try another!')); img.src = url;
  });
}
const loading = (msg) => `<div class="card" style="text-align:center;padding:26px"><span class="spin"></span><div style="margin-top:10px;font-weight:700">${esc(msg)}</div></div>`;

/* SNAP */
function openSnap(lib) { el(lib ? 'snapLib' : 'snapCam').click(); }
async function onPhotos(files) {
  files = [...files].slice(0, MAX_PHOTOS - state.photos.length);
  if (!files.length) return;
  location.hash = '#scan';
  try { for (const f of files) state.photos.push(await shrink(f)); } catch (e) { toast(e.message); }
  renderPhotos(); scan();
}
function renderPhotos() {
  el('scanPhotos').innerHTML = state.photos.length ? state.photos.map(p => `<img src="${p}" alt="Your photo">`).join('') + (state.photos.length < MAX_PHOTOS ? `<button class="chip" data-addphoto style="align-self:center;cursor:pointer;flex-shrink:0">+ Photo</button>` : '')
    : `<div style="margin:auto;text-align:center"><button class="btn primary" data-addphoto style="width:auto;padding:12px 18px">📸 Snap your fridge</button><div style="margin-top:6px"><button class="chip" data-addlib style="cursor:pointer">or pick photos</button></div></div>`;
}
async function scan() {
  state.busy = true; el('scanBody').innerHTML = loading('Peeking in your fridge…');
  try {
    const j = await api('scan', { images: state.photos });
    state.ingredients = j.ingredients.filter(i => !i.low).map(i => ({ name: i.name, qty: i.qty || '' }));
    state.low = j.ingredients.filter(i => i.low).map(i => ({ name: i.name, qty: i.qty || '' }));
    // running-low items are still "have" for cooking
    state.ingredients = state.ingredients.concat(state.low);
    LS.set('ingredients', state.ingredients); LS.set('low', state.low);
    state.low.forEach(l => addToList(l.name, 'low', 0, null, true));
  } catch (e) { toast(e.message); }
  state.busy = false; renderScan();
}
function renderScan() {
  if (!state.photos.length && !state.ingredients.length) { renderPhotos(); el('scanBody').innerHTML = `<div class="kick">Your fridge has ideas!</div><h2>Snap it</h2><p class="sub">Take up to ${MAX_PHOTOS} photos of your fridge or pantry. We'll find the ingredients.</p>`; return; }
  renderPhotos();
  const n = state.ingredients.length;
  el('scanBody').innerHTML = `<div class="kick">Fridge to fabulous!</div>
    <h2>We found ${n} ingredient${n === 1 ? '' : 's'}</h2>
    <p class="sub">Tap to remove anything we got wrong, or add what we missed.</p><div style="height:10px"></div>
    <div class="chips">${state.ingredients.map((g, i) => `<span class="chip ${state.low.some(l => l.name === g.name) ? 'miss' : 'have'}" data-rmi="${i}" style="cursor:pointer">${esc(g.name)}${g.qty ? ' · ' + esc(g.qty) : ''}<span class="x">×</span></span>`).join('')}<span class="chip" data-addi style="cursor:pointer">+ Add</span></div>
    ${state.low.length ? `<p class="fine">Coral = running low. We added ${state.low.length === 1 ? 'it' : 'them'} to your grocery list.</p>` : ''}
    <h3>What are you craving?</h3>
    <div class="chips">${CRAVINGS.map(c => `<span class="chip" data-cr="${esc(c)}" style="cursor:pointer;${c === state.craving ? 'background:var(--dark);color:#fff;border-color:var(--dark)' : ''}">${esc(c)}</span>`).join('')}</div>
    <button class="btn primary" id="goRecipes" ${n ? '' : 'disabled style="opacity:.5"'}>Let's get cooking! Show recipes →</button>
    <a class="btn ghost" href="#list">🛒 Restock time! Build my grocery list</a>`;
}

/* RECIPES */
async function getRecipes() {
  location.hash = '#recipes'; el('recipesBody').innerHTML = loading('Cooking up ideas…');
  try { state.recipes = await api('recipes', { ingredients: state.ingredients.map(i => i.name + (i.qty ? ' (' + i.qty + ')' : '')), craving: state.craving }); LS.set('recipes', state.recipes); }
  catch (e) { toast(e.message); el('recipesBody').innerHTML = `<p class="sub">${esc(e.message)}</p>`; return; }
  renderRecipes();
}
const THUMBS = ['#FFF1C9', '#E3F3E9', '#EDE6F7', '#FDE9E0'];
function renderRecipes() {
  const R = state.recipes;
  if (!R) { el('recipesBody').innerHTML = `<div class="kick">Craving unlocked!</div><h2>No recipes yet</h2><p class="sub">Snap your fridge first and we'll match recipes to what you have.</p><a class="btn primary" href="#scan">📸 Snap it</a>`; return; }
  const ready = (R.ready || []).map((r, i) => `<a class="card recipe" href="#recipe" data-rec="ready:${i}"><div class="thumb" style="background:${THUMBS[i % 4]}">${esc(r.emoji || '🍳')}</div><div style="flex:1"><b>${esc(r.name)}</b><div class="meta">${esc(r.minutes)} min · ${esc(r.servings)} servings</div><span class="pill g">Pantry power! You have everything</span></div><span>›</span></a>`).join('') || `<p class="sub">Nothing makes the cut with only what you have. Check the ideas below!</p>`;
  const more = (R.more || []).map((r, i) => `<div class="card recipe"><a href="#recipe" data-rec="more:${i}" style="display:flex;gap:12px;align-items:center;flex:1;color:inherit;text-decoration:none"><div class="thumb" style="background:${THUMBS[(i + 1) % 4]}">${esc(r.emoji || '🍜')}</div><div style="flex:1"><b>${esc(r.name)}</b><div class="meta">${esc(r.minutes)} min · ${esc(r.servings)} servings</div><span class="pill c">Missing ${r.missing.length}: ${esc(r.missing.map(m => m.item).join(', '))}</span></div></a><a class="chip" href="#list" data-addmiss="more:${i}" style="white-space:nowrap">🛒 + List</a></div>`).join('');
  el('recipesBody').innerHTML = `<div class="kick">Craving unlocked!</div><h2>Matched to “${esc(R.craving || state.craving)}”</h2>
    <h3>Ready now: let's get cooking!</h3><p class="sub">You already have everything for these. Pantry power!</p><div style="height:8px"></div>${ready}
    ${more ? `<h3>Make it with a few more things</h3><p class="sub">Just a few items away. Add them to your grocery list and restock time is done!</p><div style="height:8px"></div>${more}<a class="btn ghost" href="#list" data-addmiss="all">🛒 Restock time! Build my grocery list</a>` : ''}`;
}
const pick = key => { if (key === 'crave') return state.crave?.recipe; const [k, i] = key.split(':'); return state.recipes?.[k]?.[+i]; };

/* RECIPE */
function renderRecipe() {
  const r = state.recipe;
  if (!r) { el('recipeBody').innerHTML = `<p class="sub">Pick a recipe first!</p><a class="btn primary" href="#recipes">See recipes</a>`; return; }
  el('recipeBack').href = state.from === 'crave' ? '#compare' : '#recipes';
  const miss = r.missing || []; const cost = r2(miss.reduce((s, m) => s + (+m.est_price || 0), 0));
  el('recipeBody').innerHTML = `<div class="hero">${esc(r.emoji || '🍳')}</div><div class="kick">Craving unlocked!</div><h2>${esc(r.name)}</h2>
    <div class="stats"><div class="stat"><b>${esc(r.minutes)} min</b><span>Total</span></div><div class="stat"><b>${esc(r.servings)}</b><span>Servings</span></div><div class="stat"><b>${esc(r.level || 'Easy')}</b><span>Level</span></div></div>
    <h3>Ingredients</h3><div class="chips">${(r.ingredients || []).map(g => `<span class="chip ${g.have ? 'have' : 'miss'}">${g.have ? '✓' : '✕'} ${esc(g.item)}${g.qty ? ', ' + esc(g.qty) : ''}</span>`).join('')}</div>
    ${miss.length ? `<div class="card" style="margin-top:12px;background:var(--coral-soft);border-color:#F6C6B3">
      <div class="row" style="padding-top:0"><b>Missing ${miss.length} item${miss.length === 1 ? '' : 's'}</b><b>~${$(cost)}</b></div>
      <div class="fine" style="margin-top:0">Estimated grocery cost (AI estimate), before delivery and service fees.</div>
      <a class="btn insta" href="#list" data-addmiss="cur" style="padding:12px">🛒 Add missing items to Instacart cart</a>
      <a class="btn ghost" href="#list" data-addmiss="cur" style="padding:11px">＋ Add to my grocery list</a></div>` : `<div class="card" style="margin-top:12px;background:var(--green-soft);border-color:#BFE3CC"><b style="color:#1F6B42">Pantry power! You have everything.</b></div>`}
    <h3>Steps <span style="color:var(--coral)">· Let's get cooking!</span></h3>
    <ol class="steps">${(r.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <a class="btn ghost" href="#crave" data-craveit="${esc(r.name)}">Make it or take it? Compare with ordering →</a>
    <p class="fine">AI-generated recipe. Check doneness and allergens yourself.</p>`;
}

/* CRAVE + COMPARE */
async function crave(text) {
  text = (text || '').trim(); if (!text) return toast('Name a craving first!');
  location.hash = '#compare'; el('compareBody').innerHTML = loading('Crunching the numbers…');
  try { state.crave = await api('crave', { craving: text, ingredients: state.ingredients.map(i => i.name) }); state.crave.craving = text; LS.set('crave', state.crave); }
  catch (e) { el('compareBody').innerHTML = `<p class="sub">${esc(e.message)}</p>`; return; }
  renderCompare();
}
function renderCompare() {
  const c = state.crave; if (!c) { el('compareBody').innerHTML = `<p class="sub">Tell us what you're craving first!</p><a class="btn primary" href="#crave">Crave it</a>`; return; }
  const r = c.recipe; const miss = r.missing || []; const groc = r2(miss.reduce((s, m) => s + (+m.est_price || 0), 0));
  const apps = [['DoorDash', '#EB1700'], ['Uber Eats', '#06C167'], ['Grubhub', '#FF8000'], ['Restaurant direct', '#1E1B18']];
  el('compareBody').innerHTML = `<span class="example">⚠ Cook cost is an estimate</span><div class="kick">Make it or take it?</div><h2>${esc(c.craving)}</h2>
    <p class="sub" style="font-size:13px">${esc(r.servings)} servings · ${esc(r.name)}</p>
    <div class="verdict"><div class="k">Make it at home</div><div class="v">~${$(c.est_cook_cost)} total ingredients</div><div class="s">${miss.length ? `You'd buy ${miss.length} item${miss.length === 1 ? '' : 's'} (~${$(groc)}). ` : 'You have everything! '}About ~${$(c.est_cook_cost / Math.max(1, +r.servings || 1))} per serving.</div></div>
    <details class="opt best" open><summary><span class="badge" style="background:#2F8F5B">M</span><span class="nm">Make it <small>${esc(r.minutes)} min cook · estimate</small></span><span class="amt">~${$(groc)}</span></summary>
      <div class="bd">${miss.map(m => `<div class="row"><span class="m">${esc(m.item)}${m.qty ? ', ' + esc(m.qty) : ''}</span><span>~${$(m.est_price)}</span></div>`).join('') || '<div class="row"><span class="m">Nothing to buy</span><span>$0.00</span></div>'}</div></details>
    ${apps.map(([n, col]) => `<details class="opt"><summary><span class="badge" style="background:${col}">${n[0]}</span><span class="nm">${n}<small>Live all-in prices</small></span><span class="pill c" style="margin:0">Coming soon</span></summary></details>`).join('')}
    <p class="fine"><b>Fees? We see 'em.</b> Soon. Ordering totals (menu markups, delivery, service and small-order fees, tax, tip) are coming. We never scrape delivery apps. Cook cost is an AI estimate of grocery prices, not a quote.</p>
    <a class="btn primary" href="#recipe" data-rec="crave">Let's get cooking! See the recipe →</a>
    ${miss.length ? `<a class="btn ghost" href="#list" data-addmiss="crave">🛒 Restock time! Add missing items to my list</a>` : ''}`;
}

/* GROCERY LIST */
function addToList(name, src, price, recipe, quiet) {
  const k = name.trim().toLowerCase(); if (!k) return;
  const ex = glist.find(g => g.name.toLowerCase() === k);
  if (ex) { if (ex.done) ex.done = false; } else glist.push({ name: name.trim(), price: +price || 0, qty: 1, src, recipe, done: false });
  LS.set('glist', glist); if (!quiet) renderList();
}
function addMissing(r) { (r?.missing || []).forEach(m => addToList(m.item + (m.qty ? ', ' + m.qty : ''), 'miss', m.est_price, r.name, true)); LS.set('glist', glist); toast('Added to your grocery list. Restock time!'); }
function renderList() {
  const row = (g, i) => `<div class="row"><span data-gdone="${i}" style="cursor:pointer;flex:1;${g.done ? 'text-decoration:line-through;opacity:.5' : ''}">${g.done ? '✓' : '○'} ${esc(g.name)}</span><span class="qty"><button data-gq="${i}" data-d="-1">−</button>${g.qty}<button data-gq="${i}" data-d="1">+</button><b style="width:52px;text-align:right">${g.price ? '~' + $(r2(g.price * g.qty)) : '—'}</b></span></div>`;
  const part = f => glist.map((g, i) => f(g) ? row(g, i) : '').join('') || '<div class="fine" style="margin:0">Nothing here yet!</div>';
  el('listMissing').innerHTML = part(g => g.src === 'miss');
  el('listLow').innerHTML = part(g => g.src !== 'miss');
  const open = glist.filter(g => !g.done && g.qty > 0);
  el('listCount').textContent = `${open.length} item${open.length === 1 ? '' : 's'} to grab`;
  el('listTotal').textContent = '~' + $(r2(open.reduce((s, g) => s + g.price * g.qty, 0)));
}
const instaUrl = n => 'https://www.instacart.com/store/s?k=' + encodeURIComponent(n.replace(/,.*$/, ''));
function sendList() {
  const open = glist.filter(g => !g.done && g.qty > 0);
  if (!open.length) return toast('Your list is empty. Add something first!');
  el('listLinks').innerHTML = `<div class="fine">Tap each item to find it on Instacart:</div>` + open.map(g => `<a class="row" style="color:inherit" target="_blank" rel="noopener" href="${instaUrl(g.name)}"><span>🛒 ${esc(g.name)} × ${g.qty}</span><span>›</span></a>`).join('');
  window.open(instaUrl(open[0].name), '_blank', 'noopener');
}

/* EVENTS */
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('a.big-choice.snap') || t.closest('a.tab[href="#scan"]')) { if (!state.photos.length && !state.ingredients.length) { e.preventDefault(); location.hash = '#scan'; openSnap(); } return; }
  if (t.closest('[data-addphoto]')) return openSnap();
  if (t.closest('[data-addlib]')) return openSnap(true);
  const rm = t.closest('[data-rmi]'); if (rm) { state.ingredients.splice(+rm.dataset.rmi, 1); LS.set('ingredients', state.ingredients); return renderScan(); }
  if (t.closest('[data-addi]')) { const n = prompt('Add an ingredient'); if (n && n.trim()) { state.ingredients.push({ name: n.trim(), qty: '' }); LS.set('ingredients', state.ingredients); renderScan(); } return; }
  const cr = t.closest('[data-cr]'); if (cr) { state.craving = cr.dataset.cr; return renderScan(); }
  if (t.closest('#goRecipes')) return getRecipes();
  const am = t.closest('[data-addmiss]'); if (am) { const k = am.dataset.addmiss; if (k === 'all') (state.recipes?.more || []).forEach(addMissing); else addMissing(k === 'cur' ? state.recipe : pick(k)); }
  const rc = t.closest('[data-rec]'); if (rc) { state.recipe = pick(rc.dataset.rec); state.from = rc.dataset.rec === 'crave' ? 'crave' : 'recipes'; }
  const ci = t.closest('[data-craveit]'); if (ci) el('craveInput').value = ci.dataset.craveit;
  const hc = t.closest('[data-crave]'); if (hc) el('craveInput').value = hc.dataset.crave;
  if (t.closest('#craveGo')) return crave(el('craveInput').value);
  const d = t.closest('[data-gdone]'); if (d) { const g = glist[+d.dataset.gdone]; g.done = !g.done; LS.set('glist', glist); return renderList(); }
  const q = t.closest('[data-gq]'); if (q) { const g = glist[+q.dataset.gq]; g.qty = Math.max(0, g.qty + +q.dataset.d); LS.set('glist', glist); return renderList(); }
  if (t.closest('#listAddBtn')) { addToList(el('listAdd').value, 'manual', 0); el('listAdd').value = ''; return; }
  if (t.closest('#listSend')) return sendList();
  if (t.closest('#listClear')) { glist = glist.filter(g => !g.done); LS.set('glist', glist); el('listLinks').innerHTML = ''; return renderList(); }
  const tip = t.closest('[data-tip]'); if (tip) document.querySelectorAll('#tipSeg button').forEach(b => b.classList.toggle('on', b === tip));
  const s = t.closest('[data-mem]'); if (s) s.classList.toggle('on');
  const p = t.closest('.plan'); if (p) document.querySelectorAll('.plan').forEach(x => x.classList.toggle('on', x === p));
});
el('listAdd').addEventListener('keydown', e => { if (e.key === 'Enter') el('listAddBtn').click(); });
el('craveInput').addEventListener('keydown', e => { if (e.key === 'Enter') crave(el('craveInput').value); });
['snapCam', 'snapLib'].forEach(id => el(id).addEventListener('change', e => { onPhotos(e.target.files); e.target.value = ''; }));

const SCREENS = ['home', 'scan', 'recipes', 'recipe', 'crave', 'compare', 'cart', 'list', 'pro'];
const RENDER = { scan: () => state.busy || renderScan(), recipes: () => el('recipesBody').querySelector('.spin') || renderRecipes(), recipe: renderRecipe, compare: () => el('compareBody').querySelector('.spin') || renderCompare(), list: renderList };
function route() {
  const id = SCREENS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  RENDER[id]?.();
  document.querySelectorAll('.screen').forEach(s => { s.classList.toggle('active', s.id === id); if (s.id === id) s.scrollTop = 0; });
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.for.split(' ').includes(id)));
}
window.addEventListener('hashchange', () => { route(); const a = document.querySelector('.screen.active'); a.classList.remove('anim'); void a.offsetWidth; a.classList.add('anim'); });
route();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
