import test from 'node:test';
import assert from 'node:assert/strict';
import { dietOf, bad, recipeHits, flagScan } from '../functions/_lib/diet.js';
const D = (...tags) => dietOf({ tags });
const R = (name, ings, steps = ['Cocina todo.']) => ({ name, ingredients: ings.map(item => ({ item, qty: '1', have: true })), missing: [], steps });
const flagged = (d, ...items) => items.forEach(t => assert.equal(bad(d, t), true, 'should flag: ' + t));
const fine = (d, ...items) => items.forEach(t => assert.equal(bad(d, t), false, 'should allow: ' + t));

test('es: nut allergy', () => {
  const d = D('Nut allergy');
  flagged(d, 'cacahuates', 'maní tostado', 'Crema de cacahuate', 'nueces picadas', 'almendras fileteadas', 'pistaches', 'avellanas', 'piñones', 'mazapán', 'nuez');
  fine(d, 'nuez moscada', 'leche de coco', 'castañas de agua', 'aceite de oliva', 'calabaza');
});
test('es: shellfish allergy', () => {
  const d = D('Shellfish allergy');
  flagged(d, 'camarón', 'Camarones al ajillo', 'mariscos mixtos', 'salsa de ostión', 'jaiba', 'pulpo', 'calamares', 'langostinos', 'almejas', 'mejillones');
  fine(d, 'hongos ostra', 'filete de salmón', 'pechuga de pollo', 'pescado blanco');
});
test('es: soy allergy', () => {
  const d = D('Soy allergy');
  flagged(d, 'salsa de soya', 'soja texturizada', 'tofu firme', 'lecitina de soya', 'leche de soya');
  fine(d, 'aminos de coco', 'pollo', 'vinagre de arroz', 'aceite de ajonjolí');
});
test('es: gluten-free', () => {
  const d = D('Gluten-free');
  flagged(d, 'harina de trigo', 'pan molido', 'tortillas de harina', 'cerveza', 'fideos', 'galletas saladas', 'cebada', 'pollo empanizado', 'pan', 'avena');
  fine(d, 'tortillas de maíz', 'harina de arroz', 'maicena', 'fideos de arroz', 'pasta sin gluten', 'papa', 'arroz blanco', 'vinagre de arroz');
});
test('es: dairy, egg, vegan, vegetarian', () => {
  const dy = D('Dairy-free'), e = D('Egg-free'), v = D('Vegan'), g = D('Vegetarian');
  flagged(dy, 'queso Oaxaca', 'leche entera', 'mantequilla', 'crema agria', 'yogur griego', 'requesón', 'cajeta');
  fine(dy, 'leche de almendra', 'crema de coco', 'aceite de oliva', 'levadura nutricional', 'queso sin lácteos');
  flagged(e, 'huevos', 'mayonesa', 'yemas de huevo', 'merengue');
  fine(e, 'berenjena', 'mayonesa vegana', 'huevo de linaza');
  flagged(v, 'caldo de pollo', 'miel', 'huevo', 'queso', 'tocino', 'gelatina');
  fine(v, 'miel de agave', 'leche de avena', 'caldo de verduras', 'tofu', 'frijoles negros');
  flagged(g, 'pollo', 'carne molida', 'atún', 'caldo de res', 'anchoas', 'jamón');
  fine(g, 'queso', 'huevos', 'caldo de verduras', 'champiñones');
});
test('es: keto and halal', () => {
  const k = D('Keto/low-carb'), h = D('Halal');
  flagged(k, 'arroz', 'azúcar', 'papas', 'frijoles', 'plátano', 'pan', 'elote');
  fine(k, 'arroz de coliflor', 'aguacate', 'espinacas', 'vinagre de manzana', 'pollo');
  flagged(h, 'carne de cerdo', 'tocino', 'vino blanco', 'tequila', 'jamón', 'manteca de cerdo');
  fine(h, 'pollo halal', 'vinagre de vino', 'cordero', 'salchichas de pollo');
});
test('es: other foods typed in Spanish', () => {
  const d = dietOf({ other: 'ajonjolí, cilantro y aceitunas; soy alérgico a kiwi' });
  assert.deepEqual(d.terms.sort(), ['aceitunas', 'ajonjoli', 'cilantro', 'kiwi']);
  flagged(d, 'semillas de ajonjolí', 'cilantro fresco', 'aceitunas negras');
  fine(d, 'pollo', 'perejil');
});
test('es: recipe steps, negations and scan flags', () => {
  const d = D('Nut allergy', 'Shellfish allergy');
  assert.ok(recipeHits(d, R('Tazón de verduras', ['arroz', 'brócoli'], ['Cuece el arroz.', 'Decora con cacahuates picados si quieres.'])).includes('cacahuates'));
  assert.ok(recipeHits(d, R('Tacos', ['tortillas de maíz'], ['Agrega los camarones y cocina 3 minutos.'])).includes('camarones'));
  assert.equal(recipeHits(d, R('Tacos de pollo', ['pollo', 'tortillas de maíz'], ['Cocina el pollo.', 'Sin nueces ni mariscos.'])).length, 0);
  const out = flagScan({ ingredients: [{ name: 'Salsa de soya' }, { name: 'Leche' }, { name: 'Zanahorias' }] }, D('Soy allergy', 'Vegan'));
  assert.deepEqual(out.ingredients.map(i => !!i.conflict), [true, true, false]);
});
