/**
 * One-shot: strip donut recipes, expand history + invention origins.
 * Smoothie recipes stay. Development work by David Lane
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = path.join(ROOT, 'data/donuts-gallery.json');

const ORIGINS = {
  'classic-glazed': {
    place: 'Rockport, Maine, USA',
    year: '1847',
    lat: 44.1845,
    lng: -69.1089,
    note: 'Captain Hanson Gregory claimed inventing the ring doughnut by knocking out the soggy center.'
  },
  'boston-cream': {
    place: 'Boston, Massachusetts, USA',
    year: '1850s–1900s',
    lat: 42.3601,
    lng: -71.0589,
    note: 'Named for Boston cream pie — custard + chocolate — remade as a filled yeast doughnut.'
  },
  'raspberry-jelly': {
    place: 'Central Europe → North America',
    year: '1800s',
    lat: 52.52,
    lng: 13.405,
    note: 'Cousin to Berliners and Polish pączki; jelly-filled rounds crossed the Atlantic with immigrant bakers.'
  },
  'old-fashioned': {
    place: 'American Midwest bakery counters',
    year: 'early 1900s',
    lat: 41.8781,
    lng: -87.6298,
    note: 'Sour-cream cake rings with craggy cracks — denser than yeast, built to catch glaze pools.'
  },
  'maple-walnut': {
    place: 'Northeastern woodlands / New England',
    year: 'Indigenous → colonial sugarhouses',
    lat: 44.2619,
    lng: -72.5806,
    note: 'Maple syrup has deep Indigenous roots; New England bakeries turned it into cold-weather glaze.'
  },
  'french-cruller': {
    place: 'France (pâte à choux tradition)',
    year: '1800s',
    lat: 48.8566,
    lng: 2.3522,
    note: 'Ridged rings of choux pastry — the same airy dough family as éclairs — fried and lightly glazed.'
  },
  'chocolate-frosted': {
    place: 'United States doughnut shops',
    year: 'mid-20th century',
    lat: 40.7128,
    lng: -74.006,
    note: 'Thick cocoa frosting + sprinkles became the kid-counter classic once chains scaled yeast rings.'
  },
  'strawberry-sprinkle': {
    place: 'American soda-fountain bakeries',
    year: 'mid-20th century',
    lat: 34.0522,
    lng: -118.2437,
    note: 'Bright pink frost rode mid-century soda-fountain color — bakery shorthand for “fun” long before social media.'
  },
  'lemon-poppy': {
    place: 'Central Europe → American bakeries',
    year: '1900s',
    lat: 48.2082,
    lng: 16.3738,
    note: 'Lemon and poppy seed traveled with Central European baking into sunny American morning cases.'
  },
  'apple-fritter': {
    place: 'American fair & orchard belts',
    year: '1800s–1900s',
    lat: 40.2732,
    lng: -76.8867,
    note: 'Irregular fried apple dough — carnival and orchard country energy more than tidy ring geometry.'
  },
  'cinnamon-sugar': {
    place: 'Spanish / colonial Americas influence',
    year: 'long tradition',
    lat: 40.4168,
    lng: -3.7038,
    note: 'Cinnamon-sugar coatings echo Spanish and colonial sweets; American shops made the warm shake iconic.'
  },
  'matcha-white-chocolate': {
    place: 'Japan → global café culture',
    year: 'late 20th–21st c.',
    lat: 35.0116,
    lng: 135.7681,
    note: 'Matcha moved from tea ceremony into modern pastry; white chocolate softens the grassy bitterness.'
  },
  'blueberry-cake': {
    place: 'Maine & Northeast blueberry country',
    year: '20th century bakery staple',
    lat: 44.3106,
    lng: -69.7795,
    note: 'Wild blueberries shaped Northeastern cake tradition — crumb cake energy in doughnut form.'
  }
};

const HISTORY = {
  'classic-glazed':
    'The ring doughnut’s origin story usually points to Rockport, Maine, where Captain Hanson Gregory said he punched out the soggy middle in 1847. Dutch olykoeks (“oil cakes”) had already arrived with New Amsterdam settlers, but the hole made frying even and created the American ring. By the early 1900s, automated doughnut machines and thin sugar glaze turned the shiny yeast ring into a breakfast staple from New York counters to West Coast shops — glaze sealing moisture so the crumb stays soft for hours.',
  'boston-cream':
    'Boston cream pie (really a cake) became a Massachusetts pride dish in the 1800s: sponge, vanilla custard, chocolate top. Bakers later compressed that idea into a filled yeast doughnut — custard piped inside, chocolate ganache on top. By the mid-20th century it was a New England bakery fixture and a Dunkin’-era classic nationwide, a portable echo of Boston’s favorite “pie.”',
  'raspberry-jelly':
    'Jelly doughnuts descend from Central and Eastern European fried filled pastries — German Berliners, Polish pączki — brought into North American bakeries by immigrant bakers. Powdered sugar hides the surprise; raspberry’s bright acid cuts rich fried dough. In the U.S. they became carnival and bakery-case standards, especially around holidays and Sunday mornings.',
  'old-fashioned':
    'Unlike puffy yeast rings, old-fashioned cake donuts use chemical leavening and often sour cream for tenderness. The cracked, craggy surface isn’t a flaw — it’s the signature that holds thick glaze in little pools. Midwestern and neighborhood American bakeries perfected the style in the early 1900s as a denser, dunkable cousin to the yeast raised ring.',
  'maple-walnut':
    'Maple sugar and syrup are rooted in Indigenous foodways across the northeastern woodlands. Colonial and New England sugarhouses later commercialized the spring sap run. Bakeries turned that forest sweetness into maple glaze; toasted walnuts add crunch that echoes Vermont and Canadian sugar-shack seasons more than tropical fruit shops.',
  'french-cruller':
    '“Cruller” names vary, but the French-style ring uses pâte à choux — the same cooked dough behind éclairs and cream puffs — piped with a star tip so ridges catch a light glaze. It fries hollow and airy, a European pastry technique that found a second life in North American doughnut cases as the lightest bite in the box.',
  'chocolate-frosted':
    'Once American doughnut shops scaled yeast rings, thick chocolate frosting beat thin glaze for holding sprinkles. Mid-century counters and national chains made the cocoa crown + candy jimmies a childhood default — less about Old World pastry lineage, more about soda-fountain color and Saturday mornings.',
  'strawberry-sprinkle':
    'Pink strawberry frosting is a mid-century American bakery color language — soda fountains, birthday boxes, and “fun” frosting long before Instagram. The flavor is often strawberry puree or oil in a sweet frosting base; sprinkles turn it into weekend energy on a classic yeast ring.',
  'lemon-poppy':
    'Lemon and poppy seed traveled with Central European baking (think Austrian and Hungarian cakes) into American morning pastry. Citrus oil brightens fried dough; tiny poppy seeds add nutty crunch. It reads sunny and bakery-European even when sold beside chocolate-frosted American classics.',
  'apple-fritter':
    'Fritters are older than tidy rings — irregular fried dough studded with fruit. American fairgrounds and orchard belts (Pennsylvania, Ohio, New England) made apple fritters a cold-weather and carnival favorite: cinnamon, chunks of apple, and a glaze that clings to every jagged edge.',
  'cinnamon-sugar':
    'Cinnamon-sugar coatings echo Spanish and colonial New World sweets (think churros and spiced fried dough). U.S. shops made the warm sugar shake a simple classic — no frosting required — just spice, crunch, and heat from the fryer.',
  'matcha-white-chocolate':
    'Matcha’s home is Japanese tea culture; late 20th- and 21st-century cafés folded it into global pastry. On a doughnut, grassy umami meets sweet white chocolate so the tea note stays friendly. It’s a modern fusion case item — Kyoto green meeting American fryer tradition.',
  'blueberry-cake':
    'Wild lowbush blueberries shaped Maine and Northeast baking — muffins, pies, and cake crumbs. Blueberry cake doughnuts borrow that orchard-and-coast pantry: tender cake crumb, berry pockets, and a nod to summer markets along the Downeast shore.'
};

const data = JSON.parse(await readFile(FILE, 'utf8'));

data.brand = {
  ...data.brand,
  tagline: 'Flip a treat. Hear the history. Meet Savy Donuts and Smoothies on Harbor.',
  welcomeScript:
    "Hey! I'm Pip — welcome to Glazed, celebrating Savy Donuts and Smoothies on Harbor. Flip any donut for its story and where it came from. Smoothies still share blend notes. Ask me in chat too — I'm your baker guide."
};

data.donuts = data.donuts.map((d) => {
  const next = { ...d };
  delete next.recipe;
  next.history = HISTORY[d.id] || d.history;
  next.origin = ORIGINS[d.id] || d.origin || null;
  if (next.avatarScript && /recipe/i.test(next.avatarScript)) {
    /* keep existing scripts — they're flavor, not recipes */
  }
  return next;
});

await writeFile(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
process.stdout.write(`Updated ${FILE} — ${data.donuts.length} donuts, recipes stripped, origins set.\n`);
