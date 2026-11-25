import { FAMILY_COUNTS, GAMES, GAME_MAP, ONLINE_GAMES } from '../src/data/catalog';
import { OUTDOOR_GAMES } from '../src/data/realLife';
import { CHARADES, IMPOSTOR_PACKS } from '../src/data/party';
import { WORD_THEMES } from '../src/data/words';
import { COUNTRIES } from '../src/data/countries';

const total = GAMES.length;
console.log(`\nTotal de juegos en el catálogo: ${total}`);
console.log(`Juegos al aire libre: ${OUTDOOR_GAMES.length}`);
console.log(`Temas de palabras: ${WORD_THEMES.length} (${WORD_THEMES.reduce((sum, theme) => sum + theme.words.length, 0)} palabras)`);
console.log(`Países: ${COUNTRIES.length}`);
console.log(`Mímica: ${CHARADES.length} categorías · ${CHARADES.reduce((sum, cat) => sum + cat.easy.length + cat.normal.length + cat.hard.length, 0)} retos`);
console.log(`Impostor: ${IMPOSTOR_PACKS.length} packs\n`);

console.log('Por familia:');
for (const [family, count] of Object.entries(FAMILY_COUNTS).sort(([, a], [, b]) => Number(b) - Number(a))) {
  console.log(`  ${family.padEnd(14)} ${count}`);
}

const missingOnline = ONLINE_GAMES.filter((game) => !GAME_MAP.has(game.metaId));
if (missingOnline.length) {
  console.error('\nFaltan metajuegos online:', missingOnline.map((game) => game.metaId));
  process.exit(1);
}

const duplicateTitles = new Map<string, number>();
for (const game of GAMES) duplicateTitles.set(game.title, (duplicateTitles.get(game.title) ?? 0) + 1);
const repeated = [...duplicateTitles.entries()].filter(([, count]) => count > 1);
console.log(`\nTítulos repetidos: ${repeated.length}`);
if (repeated.length) console.log(repeated.slice(0, 12));

if (total < 1000) {
  console.error(`\nERROR: el catálogo solo tiene ${total} juegos.`);
  process.exit(1);
}
console.log('\nOK: catálogo por encima de 1000 y salas online enlazadas.');
