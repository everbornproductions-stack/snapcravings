// Recipe icon guard: models sometimes return a word ("peppers") or a code point ("1f35d") instead of an emoji.
// Map known food words (from the emoji field, then the recipe name) to an emoji, else fall back to 🍽️.
const MAP = [[/pepper|chil[ie]|jalape/, '🌶️'], [/pasta|spaghetti|noodle|ramen|lo mein|zoodle/, '🍝'], [/pizza/, '🍕'], [/burger/, '🍔'], [/taco|burrito|quesadilla|fajita/, '🌮'],
  [/salad|greens|lettuce|kale|spinach/, '🥗'], [/soup|stew|chili|broth|curry/, '🍲'], [/rice|risotto|bowl/, '🍚'], [/sushi/, '🍣'], [/shrimp|prawn/, '🍤'], [/fish|salmon|tuna|cod/, '🐟'],
  [/chicken|poultry|wing/, '🍗'], [/steak|beef|meat|pork|lamb/, '🥩'], [/bacon/, '🥓'], [/egg|omelet|frittata/, '🍳'], [/pancake|waffle/, '🥞'], [/bread|toast|sandwich/, '🥪'],
  [/cheese/, '🧀'], [/avocado|guac/, '🥑'], [/broccoli/, '🥦'], [/carrot/, '🥕'], [/corn/, '🌽'], [/potato|fries/, '🥔'], [/mushroom/, '🍄'], [/tomato/, '🍅'], [/eggplant/, '🍆'],
  [/cucumber|zucchini/, '🥒'], [/onion|garlic/, '🧅'], [/tofu|bento/, '🍱'], [/dumpling/, '🥟'], [/cake|dessert|cupcake/, '🍰'], [/cookie/, '🍪'], [/berr|strawberr/, '🍓'],
  [/apple/, '🍎'], [/banana/, '🍌'], [/lemon/, '🍋'], [/smoothie|shake|drink/, '🥤'], [/coffee/, '☕'], [/tea/, '🍵'], [/pie/, '🥧'], [/cauliflower|veg/, '🥦']];
const EMO = /\p{Extended_Pictographic}/u;
export function recipeEmoji(e, name = '') {
  const s = String(e ?? '').trim();
  const h = /^(?:u\+)?([0-9a-f]{4,6})$/i.exec(s);
  if (h) { try { const c = String.fromCodePoint(parseInt(h[1], 16)); if (EMO.test(c)) return c; } catch {} }
  if (s && EMO.test(s) && !/[A-Za-z0-9]/.test(s)) return [...s].slice(0, 4).join('');
  for (const t of [s, String(name ?? '')]) { const w = t.toLowerCase(); for (const [re, em] of MAP) if (re.test(w)) return em; }
  return '🍽️';
}
