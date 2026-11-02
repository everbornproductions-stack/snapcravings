// SnapCravings i18n: English is the source text; ES maps it to Latin American Spanish.
// t('English {n}', {n}) returns the string in the current language. Static HTML text nodes, placeholders and
// aria-labels are swapped by applyStatic() (originals kept so the EN/ES toggle can switch back without a reload).
(function () {
  const ES = {
    // static: home
    'an Everborn product': 'un producto de Everborn', 'My diet and settings': 'Mi dieta y ajustes', 'Snap. Cook. Yum!': '¡Foto. Cocina. Ñam!',
    'Craving something?': '¿Se te antoja algo?', 'Make it': 'Prepáralo', 'or': 'o', 'buy it': 'cómpralo', ', the smart way.': ', de la forma más lista.',
    'Snap your fridge for recipes, or name a craving and see which way is cheaper.': 'Toma foto a tu refri para recibir recetas, o dinos qué se te antoja y mira qué sale más barato.',
    'Your fridge has ideas!': '¡Tu refri tiene ideas!', 'Snap it': 'Tómale foto', 'Photograph your fridge or pantry. Get recipes with full steps.': 'Fotografía tu refri o alacena. Recibe recetas con todos los pasos.',
    'Make it or take it?': '¿Lo cocinas o lo pides?', 'Crave it': 'Antójate', 'Name it. We compare cooking it with ordering it, fees and all.': 'Dinos qué es. Comparamos cocinarlo con pedirlo, con todo y comisiones.',
    'Popular cravings': 'Antojos populares', '· crave smarter, not harder': '· antójate con cabeza', 'Go unlimited with Pro': 'Hazlo ilimitado con Pro',
    'Your favorites': 'Tus favoritos', 'My diet & allergies': 'Mi dieta y alergias', 'Install SnapCravings': 'Instala SnapCravings', 'Install': 'Instalar',
    'Snap from your home screen, one tap away.': 'Toma fotos desde tu pantalla de inicio, a un toque.',
    'Pad thai': 'Pad thai', 'Pizza': 'Pizza', 'Tacos': 'Tacos', 'Burger': 'Hamburguesa', 'Sushi': 'Sushi', '🍔 Burger': '🍔 Hamburguesa',
    // static: screens
    'Scan result': 'Resultado del escaneo', 'Recipe ideas': 'Ideas de recetas', 'Still want it from a restaurant?': '¿Todavía lo quieres de un restaurante?',
    'See what cooking it costs. Delivery-app comparison is coming soon.': 'Mira cuánto cuesta cocinarlo. La comparación con apps de entrega viene pronto.',
    'Compare make vs. buy': 'Compara cocinar vs. comprar', 'Recipe': 'Receta', 'Save to favorites': 'Guardar en favoritos',
    'Crave smarter, not harder.': 'Antójate con cabeza.', 'What are you': '¿Qué se te', 'craving?': 'antoja?', 'Chicken pad thai': 'Pad thai de pollo', 'Craving': 'Antojo',
    'Your memberships': 'Tus membresías', '· for the ordering comparison, coming soon': '· para comparar pedidos, muy pronto', 'Tip for delivery': 'Propina de entrega',
    'Make it or take it? Compare →': '¿Lo cocinas o lo pides? Compara →', "📸 Have a checkout screen? Fees? We see 'em.": '📸 ¿Tienes la pantalla de pago? ¿Comisiones? Las vemos.',
    "Coming soon: upload a screenshot of your own cart and we'll read the real total. We never log in to or scrape delivery apps.": 'Muy pronto: sube una captura de tu carrito y leeremos el total real. Nunca entramos a tus apps de entrega ni copiamos sus datos.',
    'Make vs. buy': 'Cocinar vs. comprar', 'Your cart': 'Tu carrito', 'Restock time!': '¡Hora de surtir!', 'Your cart is your grocery list': 'Tu carrito es tu lista del súper',
    'Everything you add lives on your grocery list, ready to send to Instacart.': 'Todo lo que agregas vive en tu lista del súper, lista para mandar a Instacart.',
    '🛒 Open my grocery list': '🛒 Abrir mi lista del súper', 'Grocery list': 'Lista del súper', 'Your grocery list': 'Tu lista del súper',
    "What your recipes are missing, plus what's running low in your fridge photos. Tap to check off.": 'Lo que les falta a tus recetas, más lo que se está acabando según tus fotos. Toca para tachar.',
    'Missing for your recipes': 'Falta para tus recetas', 'Running low': 'Se está acabando', '· spotted in your snap': '· visto en tu foto',
    'Add an item, like milk': 'Agrega algo, como leche', 'Add an item': 'Agregar un artículo', 'Add': 'Agregar',
    'Estimated grocery prices (AI estimate, not live Instacart prices), before delivery and service fees. Checked-off items are left out.': 'Precios estimados del súper (estimación de IA, no precios en vivo de Instacart), sin comisiones de entrega ni de servicio. Lo tachado no cuenta.',
    '🛒 Send list to Instacart': '🛒 Mandar lista a Instacart', 'Clear checked-off items': 'Quitar lo tachado',
    'Opens Instacart search for each item. You pick the store and check out in Instacart; prices there may differ.': 'Abre la búsqueda de Instacart para cada artículo. Tú eliges la tienda y pagas en Instacart; ahí los precios pueden variar.',
    'Favorites': 'Favoritos', 'Saved for later!': '¡Guardado para después!', 'Your favorite recipes': 'Tus recetas favoritas', 'Tap a recipe to cook it again. Tap ♥ to unsave.': 'Toca una receta para cocinarla otra vez. Toca ♥ para quitarla.',
    'Settings': 'Ajustes', 'Go Pro': 'Hazte Pro', "Crave smarter, not harder. See the cheapest way to get what you're craving before you spend.": 'Antójate con cabeza. Mira la forma más barata de conseguir tu antojo antes de gastar.',
    'Unlimited photo scans': 'Escaneos de fotos ilimitados', 'Free plan: a few scans a week': 'Plan gratis: unos cuantos escaneos por semana', 'Make-vs-buy comparison': 'Comparación cocinar vs. comprar',
    'All-in totals across apps, fees, tax and tip': 'Totales completos entre apps, comisiones, impuestos y propina', 'Saved favorites': 'Favoritos guardados', 'Keep the recipes and orders you love': 'Guarda las recetas y pedidos que te encantan',
    'Free': 'Gratis', 'Photo scans': 'Escaneos de fotos', 'Limited': 'Limitado', 'Unlimited': 'Ilimitado', 'Recipes': 'Recetas', 'Yearly': 'Anual', 'SAVE 33%': 'AHORRA 33%',
    'Coming soon · about $3.33/mo': 'Muy pronto · unos $3.33/mes', 'Monthly': 'Mensual', 'Founders price, first 100 members, locked in': 'Precio fundador, primeros 100 miembros, garantizado',
    'Email': 'Correo', 'you@email.com': 'tu@correo.com', "Go Unlimited — let's get cooking!": 'Hazte Ilimitado. ¡A cocinar!', 'Restore purchase': 'Restaurar compra', 'Have a code?': '¿Tienes un código?',
    'Your code': 'Tu código', 'Code': 'Código', 'Unlock it!': '¡Desbloquéalo!', 'Unlimited is coming soon. Free scans and codes still work!': 'Ilimitado llega pronto. ¡Los escaneos gratis y los códigos siguen funcionando!',
    'Home': 'Inicio', 'Snap': 'Foto', 'Crave': 'Antojo', 'Cart': 'Carrito', 'Pro': 'Pro', 'SnapCravings beta': 'SnapCravings beta',
    // dynamic
    'Pop in your code first!': '¡Primero escribe tu código!', "Code unlocked! You're Unlimited! 🎉": '¡Código desbloqueado! ¡Ya eres Ilimitado! 🎉',
    "Hmm, that didn't work. Try again!": 'Mmm, eso no funcionó. ¡Intenta de nuevo!', "You're Unlimited! Let's get cooking! 🎉": '¡Ya eres Ilimitado! ¡A cocinar! 🎉',
    'No active plan for that email yet.': 'Todavía no hay un plan activo con ese correo.', "You're Unlimited! 🎉": '¡Ya eres Ilimitado! 🎉',
    "{email} · unlimited photo scans. Let's get cooking!": '{email} · escaneos de fotos ilimitados. ¡A cocinar!', '📸 Snap it': '📸 Tómale foto',
    'Your food preferences live in': 'Tus preferencias de comida están en', 'Manage or cancel anytime in': 'Administra o cancela cuando quieras en',
    'Unlimited · coming soon!': 'Ilimitado · ¡muy pronto!',
    '${price}/mo founders price, first 100 members, locked in. Secure checkout by Stripe. We use your email only to find your plan.': '${price}/mes, precio fundador para los primeros 100 miembros, garantizado. Pago seguro con Stripe. Usamos tu correo solo para encontrar tu plan.',
    'Unlimited is coming soon!': '¡Ilimitado llega pronto!', 'Pop in your email first!': '¡Primero escribe tu correo!', 'Pop in a real email so we can find your plan later!': '¡Escribe un correo real para poder encontrar tu plan después!',
    'Heading to checkout…': 'Yendo al pago…', 'Thanks! Checking your plan…': '¡Gracias! Revisando tu plan…', 'Removed from favorites.': 'Se quitó de favoritos.', 'Saved to favorites! ❤️': '¡Guardado en favoritos! ❤️',
    'Unsave': 'Quitar', 'Save': 'Guardar', '{n} saved recipe. Pantry power!': '{n} receta guardada. ¡El poder de la alacena!', '{n} saved recipes. Pantry power!': '{n} recetas guardadas. ¡El poder de la alacena!',
    'Tap ♡ on any recipe to save it': 'Toca ♡ en cualquier receta para guardarla', '{n} min · {s} servings': '{n} min · {s} porciones', 'Missing {n}: {items}': 'Faltan {n}: {items}',
    'Pantry power! You have everything': '¡El poder de la alacena! Tienes todo', 'No favorites yet': 'Aún no tienes favoritos', 'Tap ♡ on any recipe and it lands here.': 'Toca ♡ en cualquier receta y aparecerá aquí.',
    'Anything': 'Lo que sea', 'Noodles': 'Fideos', 'Something quick': 'Algo rápido', 'Comfort food': 'Comida reconfortante', 'Spicy': 'Picante',
    'Snap your fridge': 'Tómale foto a tu refri', 'Open it wide. Every shelf counts!': 'Ábrelo bien. ¡Cada repisa cuenta!', 'Brrr, nice!': '¡Brrr, qué bien!', 'Now your freezer': 'Ahora tu congelador',
    'Frozen treasure counts too.': 'Los tesoros congelados también cuentan.', 'Pantry power!': '¡El poder de la alacena!', 'Now your pantry': 'Ahora tu alacena',
    'Cans, pasta, rice, sauces, oils. Show us the goods.': 'Latas, pasta, arroz, salsas, aceites. Muéstranos lo que tienes.', 'Spice it up!': '¡Ponle sabor!', 'Last one: your spices!': 'La última: ¡tus especias!',
    'Spice rack, drawer or cabinet. Labels facing out if you can.': 'Especiero, cajón o gabinete. Con las etiquetas hacia afuera si puedes.',
    'Produce': 'Frutas y verduras', 'Proteins': 'Proteínas', 'Dairy': 'Lácteos', 'Pantry': 'Alacena', 'Spices & Seasonings': 'Especias y condimentos',
    'fridge': 'refri', 'freezer': 'congelador', 'pantry': 'alacena', 'spices': 'especias', 'kitchen': 'cocina',
    'That took too long. Check your signal and tap Retry!': 'Tardó demasiado. Revisa tu señal y toca Reintentar.', 'Lost the connection for a sec. Tap Retry!': 'Se perdió la conexión un momento. ¡Toca Reintentar!',
    'Something went sideways. Try again!': 'Algo salió mal. ¡Intenta de nuevo!', 'That photo could not be read. Try another!': 'No pudimos leer esa foto. ¡Prueba otra!',
    'Gluten-free': 'Sin gluten', 'Dairy-free': 'Sin lácteos', 'Vegetarian': 'Vegetariano', 'Vegan': 'Vegano', 'Nut allergy': 'Alergia a nueces y cacahuates', 'Shellfish allergy': 'Alergia a mariscos',
    'Egg-free': 'Sin huevo', 'Soy allergy': 'Alergia a la soya', 'Keto/low-carb': 'Keto/bajo en carbohidratos', 'Halal': 'Halal',
    'Mexican': 'Mexicana', 'Asian': 'Asiática', 'Italian': 'Italiana', 'Mediterranean': 'Mediterránea', 'Indian': 'India',
    'Mood: ': 'Antojo: ', 'Gluten-free, vegan, allergies and more': 'Sin gluten, vegano, alergias y más',
    '${price}/mo or $39.99/year. Secure checkout by Google Play. Cancel anytime in Google Play.': '${price}/mes o $39.99/año. Pago seguro con Google Play. Cancela cuando quieras en Google Play.', 'Or go yearly: $39.99/year': 'O elige anual: $39.99/año', "Opens Google Play subscriptions. You keep Unlimited until the end of the period you've already paid for.": 'Abre las suscripciones de Google Play. Sigues con Ilimitado hasta el final del periodo que ya pagaste.',
    'Cancel subscription': 'Cancelar suscripción', "Opens Stripe's secure page. Use the email you paid with. You keep Unlimited until the end of the period you've already paid for.": 'Abre la página segura de Stripe. Usa el correo con el que pagaste. Sigues con Ilimitado hasta el final del periodo que ya pagaste.',
    "To cancel, use the link in your Stripe receipt email. You keep Unlimited until the end of the period you've already paid for.": 'Para cancelar, usa el enlace del correo de recibo de Stripe. Sigues con Ilimitado hasta el final del periodo que ya pagaste.',
    '/month': '/mes', 'Your plan': 'Tu plan', 'Before we snap!': '¡Antes de la foto!', 'Your kitchen, your rules!': '¡Tu cocina, tus reglas!', 'Any food rules?': '¿Alguna regla de comida?',
    'My diet &amp; allergies': 'Mi dieta y alergias',
    'Totally optional. Pick your diet and allergies, and every recipe will fit. You can change it anytime from the ⚙️ on Home.': 'Totalmente opcional. Elige tu dieta y alergias, y cada receta se ajustará. Puedes cambiarlo cuando quieras desde el ⚙️ en Inicio.',
    "Tap what applies. We'll keep every recipe and grocery list in line.": 'Toca lo que aplique. Cuidaremos que cada receta y lista del súper lo respete.',
    'My diet': 'Mi dieta', 'My allergies': 'Mis alergias', 'Allergies are treated as hard rules. Still, always double-check labels yourself.': 'Las alergias son reglas estrictas. Aun así, revisa siempre las etiquetas tú mismo.',
    "Other allergies or foods I don't eat": 'Otras alergias o alimentos que no como', 'Like soy, sesame, or cilantro': 'Como soya, ajonjolí o cilantro', 'Other foods to skip': 'Otros alimentos a evitar',
    "Foods I'm in the mood for": 'Comida que se me antoja', '· optional': '· opcional', 'Like Mexican, Asian, comfort food': 'Como mexicana, asiática, reconfortante',
    'Save &amp; snap it 📸': 'Guardar y tomar foto 📸', 'Skip for now': 'Omitir por ahora', "Done. Let's get cooking!": 'Listo. ¡A cocinar!', 'Language': 'Idioma',
    "That's {n} photos, the max. Hit Go!": 'Son {n} fotos, el máximo. ¡Dale a Listo!', 'One photo could not be read. Try another!': 'No pudimos leer una foto. ¡Prueba otra!',
    'Your {area} photo': 'Tu foto de {area}', 'Remove photo': 'Quitar foto', 'Snap a photo first!': '¡Primero toma una foto!',
    'Peeking at {n} photo… spices too! ({d}/{n})': 'Revisando {n} foto… ¡y las especias! ({d}/{n})', 'Peeking at {n} photos… spices too! ({d}/{n})': 'Revisando {n} fotos… ¡y las especias! ({d}/{n})',
    'Hungry for more?': '¿Con hambre de más?', 'Free scans used up': 'Se acabaron los escaneos gratis', 'Your {n} photo is still here.': 'Tu foto sigue aquí.', 'Your {n} photos are still here.': 'Tus {n} fotos siguen aquí.',
    'Go Unlimited (coming soon) · Have a code?': 'Hazte Ilimitado (muy pronto) · ¿Tienes un código?', 'Oops, kitchen hiccup!': '¡Ups, hipo en la cocina!', "We couldn't read your photos": 'No pudimos leer tus fotos', 'Retry 🔄': 'Reintentar 🔄',
    'Step {a} of {b} · {n}/{m} photos': 'Paso {a} de {b} · {n}/{m} fotos', 'Add another': 'Agregar otra', '🖼 Pick photos': '🖼 Elegir fotos', 'Next →': 'Siguiente →', 'Skip': 'Omitir',
    'Fridge to fabulous!': '¡Del refri a lo fabuloso!', '{n} photo ready!': '¡{n} foto lista!', '{n} photos ready!': '¡{n} fotos listas!',
    "We'll look at all of them together: one list, spices and sauces too.": 'Las revisamos todas juntas: una sola lista, con especias y salsas.', '‹ Add more photos': '‹ Agregar más fotos', 'Go! 🚀': '¡Listo! 🚀',
    'We found {n} ingredient': 'Encontramos {n} ingrediente', 'We found {n} ingredients': 'Encontramos {n} ingredientes', 'Tap to remove anything we got wrong, or add what we missed.': 'Toca para quitar lo que no acertamos, o agrega lo que faltó.',
    '+ Add': '+ Agregar', '🔄 Start over with new photos': '🔄 Empezar de nuevo con fotos nuevas', '🔄 Start over': '🔄 Empezar de nuevo', "🚫 doesn't fit your diet, so we'll leave it out of recipes and your grocery list.": '🚫 no va con tu dieta, así que lo dejamos fuera de las recetas y de tu lista del súper.',
    'Coral = running low. We added it to your grocery list.': 'Coral = se está acabando. Lo agregamos a tu lista del súper.', 'Coral = running low. We added them to your grocery list.': 'Coral = se está acabando. Los agregamos a tu lista del súper.',
    'What are you craving?': '¿Qué se te antoja?', "Let's get cooking! Show recipes →": '¡A cocinar! Ver recetas →', '🛒 Restock time! Build my grocery list': '🛒 ¡Hora de surtir! Armar mi lista del súper',
    '{n} new idea! Let\'s get cooking!': '¡{n} idea nueva! ¡A cocinar!', "{n} new ideas! Let's get cooking!": '¡{n} ideas nuevas! ¡A cocinar!', 'Kitchen hiccup. Tap again for more ideas!': 'Hipo en la cocina. ¡Toca otra vez para más ideas!',
    'Cooking up ideas…': 'Cocinando ideas…', "Recipes didn't come through": 'Las recetas no llegaron', 'Your ingredients are saved.': 'Tus ingredientes están guardados.',
    'Easy': 'Fácil', 'Medium': 'Intermedio', 'Chef mode': 'Modo chef', 'Craving unlocked!': '¡Antojo desbloqueado!', 'No recipes yet': 'Aún no hay recetas',
    "Snap your fridge first and we'll match recipes to what you have.": 'Primero tómale foto a tu refri y te daremos recetas con lo que tienes.',
    'Nothing makes the cut with only what you have. Check the ideas below!': 'Nada sale solo con lo que tienes. ¡Mira las ideas de abajo!', '🛒 + List': '🛒 + Lista',
    'Matched to “{c}”': 'Para tu antojo: “{c}”', '🥗 Cooking for: {d} · ': '🥗 Cocinando para: {d} · ', 'Change': 'Cambiar', "Ready now: let's get cooking!": 'Listas ya: ¡a cocinar!',
    'You already have everything for these. Pantry power!': 'Ya tienes todo para estas. ¡El poder de la alacena!', 'Make it with a few more things': 'Prepáralas con unas cosas más',
    'Just a few items away. Add them to your grocery list and restock time is done!': 'Te faltan pocas cosas. ¡Agrégalas a tu lista del súper y listo!', 'Cooking up more…': 'Cocinando más…',
    'Hungry for more? Tap for more ideas!': '¿Con hambre de más? ¡Toca para más ideas!', 'Pick a recipe first!': '¡Primero elige una receta!', 'See recipes': 'Ver recetas',
    'Total': 'Total', 'Servings': 'Porciones', 'Level': 'Nivel', 'Ingredients': 'Ingredientes', 'Missing {n} item': 'Falta {n} artículo', 'Missing {n} items': 'Faltan {n} artículos',
    'Estimated grocery cost (AI estimate), before delivery and service fees.': 'Costo estimado del súper (estimación de IA), sin comisiones de entrega ni de servicio.',
    '🛒 Add missing items to Instacart cart': '🛒 Agregar lo que falta al carrito de Instacart', '＋ Add to my grocery list': '＋ Agregar a mi lista del súper', 'Pantry power! You have everything.': '¡El poder de la alacena! Tienes todo.',
    'Steps': 'Pasos', "· Let's get cooking!": '· ¡A cocinar!', 'Make it or take it? Compare with ordering →': '¿Lo cocinas o lo pides? Compara con pedirlo →', 'AI-generated recipe. Check doneness and allergens yourself.': 'Receta hecha con IA. Revisa tú mismo la cocción y los alérgenos.',
    'Name a craving first!': '¡Primero dinos qué se te antoja!', 'Crunching the numbers…': 'Haciendo cuentas…', "Tell us what you're craving first!": '¡Primero dinos qué se te antoja!',
    '⚠ Cook cost is an estimate': '⚠ El costo de cocinar es un estimado', '{s} servings · {name}': '{s} porciones · {name}', 'Make it at home': 'Prepáralo en casa', '~{p} at the store': '~{p} en el súper', 'You have everything!': '¡Tienes todo!',
    '{n} item to buy (full packages). ': '{n} artículo por comprar (paquetes completos). ', '{n} items to buy (full packages). ': '{n} artículos por comprar (paquetes completos). ',
    'What this meal uses: ~{a}, about ~{b} per serving.': 'Lo que usa esta comida: ~{a}, unos ~{b} por porción.', '{n} min cook · estimate': '{n} min de cocina · estimado', 'Nothing to buy': 'Nada que comprar',
    'Restaurant direct': 'Directo del restaurante', 'Live all-in prices': 'Precios completos en vivo', 'Coming soon': 'Muy pronto', "Fees? We see 'em.": '¿Comisiones? Las vemos.',
    'Soon. Ordering totals (menu markups, delivery, service and small-order fees, tax, tip) are coming. We never scrape delivery apps. Cook cost is an AI estimate of grocery prices, not a quote.': 'Pronto. Vienen los totales de pedidos (sobreprecio del menú, entrega, servicio, cargo por pedido pequeño, impuestos y propina). Nunca copiamos datos de apps de entrega. El costo de cocinar es una estimación de IA de precios del súper, no una cotización.',
    "Let's get cooking! See the recipe →": '¡A cocinar! Ver la receta →', '🛒 Restock time! Add missing items to my list': '🛒 ¡Hora de surtir! Agregar lo que falta a mi lista',
    "Removed {n} grocery item that don't fit your diet.": 'Quitamos {n} artículo del súper que no va con tu dieta.', "Removed {n} grocery items that don't fit your diet.": 'Quitamos {n} artículos del súper que no van con tu dieta.',
    'Added to your grocery list. Restock time!': 'Agregado a tu lista del súper. ¡Hora de surtir!', 'Nothing here yet!': '¡Aún no hay nada aquí!', '{n} item to grab': '{n} artículo por comprar', '{n} items to grab': '{n} artículos por comprar',
    'Your list is empty. Add something first!': 'Tu lista está vacía. ¡Primero agrega algo!', 'Tap each item to find it on Instacart:': 'Toca cada artículo para buscarlo en Instacart:',
    "Saved! Let's get cooking!": '¡Guardado! ¡A cocinar!', 'Saved! Hit Show recipes for fresh ideas that fit.': '¡Guardado! Toca Ver recetas para ideas nuevas que te queden.', 'Add an ingredient': 'Agrega un ingrediente',
    'Yearly is coming soon! Monthly is ready now.': '¡El plan anual llega pronto! El mensual ya está listo.', 'Pop in the email you used at checkout!': '¡Escribe el correo que usaste al pagar!',
    "Unlimited scans. Let's get cooking!": 'Escaneos ilimitados. ¡A cocinar!', '{n} of 3 free scans left this week': 'Te quedan {n} de 3 escaneos gratis esta semana', 'Free scans used up. Beta bonus: keep snapping!': 'Se acabaron los escaneos gratis. Bono beta: ¡sigue tomando fotos!',
    '3 of 3 free scans left this week': 'Te quedan 3 de 3 escaneos gratis esta semana',
    'Installed! Find SnapCravings on your home screen.': '¡Instalada! Busca SnapCravings en tu pantalla de inicio.', 'Tap Share (⬆️), then Add to Home Screen': 'Toca Compartir (⬆️) y luego Agregar a inicio',
    'In Safari: tap Share (⬆️), then Add to Home Screen': 'En Safari: toca Compartir (⬆️) y luego Agregar a inicio', 'Open the ⋮ menu, then tap Install': 'Abre el menú ⋮ y toca Instalar',
    'Open the Chrome ⋮ menu, then tap Install app (or Add to Home screen)': 'Abre el menú ⋮ de Chrome y toca Instalar app (o Agregar a la pantalla principal)', 'In Safari: File menu, then Add to Dock': 'En Safari: menú Archivo y luego Agregar al Dock',
    'Firefox can’t install apps. Open this page in Chrome or Edge to install': 'Firefox no puede instalar apps. Abre esta página en Chrome o Edge para instalarla',
    'Click the install icon (⊕) at the right end of the address bar, or ⋮ menu, then Install SnapCravings': 'Haz clic en el ícono de instalar (⊕) al final de la barra de direcciones, o en el menú ⋮, y luego Instalar SnapCravings',
    'Done: the app is in English.': 'Listo: la app está en español.',
    // server errors (fallback if the server answered in English)
    "You've used your 3 free scans this week.": 'Ya usaste tus 3 escaneos gratis de esta semana.', 'Our kitchen is busy. Tap Retry in a moment!': 'Nuestra cocina está llena. ¡Toca Reintentar en un momento!',
    'That took too long. Tap Retry!': 'Tardó demasiado. ¡Toca Reintentar!', 'The recipe brain hiccuped. Tap Retry!': 'El cerebro de recetas tuvo un hipo. ¡Toca Reintentar!',
    'Whoa, hungry! You hit the hourly limit. Try again soon.': '¡Uy, qué hambre! Llegaste al límite por hora. Intenta de nuevo pronto.',
    '$39.99/yr, save 33% vs $4.99/mo list price': '$39.99/año, ahorra 33% vs. $4.99/mes de lista', '$39.99 billed once a year. Secure checkout by Stripe. We use your email only to find your plan.': '$39.99 cobrado una vez al año. Pago seguro con Stripe. Usamos tu correo solo para encontrar tu plan.',
    'Add some ingredients first!': '¡Primero agrega algunos ingredientes!', 'Invalid code': 'Código inválido'
  };
  // More languages (2026-11-02): dictionaries live in web/i18n/<code>.js and register on window.SC_I18N; the head script in
  // index.html picks the language and loads only that file before the deferred scripts run. English text stays the key.
  const D = Object.assign(window.SC_I18N || (window.SC_I18N = {}), { es: ES });
  const LANGS = window.SC_LANGS || [['en', 'English'], ['es', 'Español']]; const ok = l => LANGS.some(x => x[0] === l);
  const pick = () => { if (window.SC_LANG && ok(window.SC_LANG)) return window.SC_LANG; const s = localStorage.getItem('sc.lang'); if (s) { try { const v = JSON.parse(s); if (ok(v)) return v; } catch {} } const n = String((navigator.languages || [])[0] || navigator.language || '').toLowerCase().replace(/^in\b/, 'id'); const m = LANGS.find(x => n.split('-')[0] === x[0]); return m ? m[0] : 'en'; };
  let lang = pick(); const dict = () => (lang === 'en' ? null : D[lang]);
  const t = (s, v) => { const d = dict(); let o = d && Object.prototype.hasOwnProperty.call(d, s) ? d[s] : s; if (v) for (const k in v) o = o.split('{' + k + '}').join(v[k]); return o; };
  const orig = new WeakMap(), origAttr = new WeakMap();
  function applyStatic(root) {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; const d = dict();
    const w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) continue;
      if (!orig.has(n)) { if (!n.nodeValue.trim()) continue; orig.set(n, n.nodeValue); }
      const o = orig.get(n), k = o.trim();
      n.nodeValue = d && Object.prototype.hasOwnProperty.call(d, k) ? o.replace(k, d[k]) : o;
    }
    for (const e of (root || document.body).querySelectorAll('[placeholder],[aria-label]')) {
      const a = origAttr.get(e) || { placeholder: e.getAttribute('placeholder'), 'aria-label': e.getAttribute('aria-label') }; origAttr.set(e, a);
      for (const k of ['placeholder', 'aria-label']) if (a[k] != null) e.setAttribute(k, t(a[k]));
    }
  }
  // load(l): fetch a language file on the fly (Settings picker), then call back.
  const load = (l, cb) => { if (l === 'en' || D[l]) return cb(); const sc = document.createElement('script'); sc.src = 'i18n/' + l + '.js?v=' + (window.SC_IV || ''); sc.onload = sc.onerror = () => cb(); document.head.appendChild(sc); };
  window.I18N = { t, ES, D, LANGS, load, applyStatic, get lang() { return lang; }, get rtl() { return lang === 'ar'; }, set(l) { lang = ok(l) && (l === 'en' || D[l]) ? l : 'en'; localStorage.setItem('sc.lang', JSON.stringify(lang)); } };
  window.t = t;
})();
