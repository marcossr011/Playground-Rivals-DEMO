import type { Category, Difficulty, FamilyId, GameMeta, PlayMode, WordTheme } from '../types';
import { MEMORY_THEMES } from './memoryThemes';
import { WORD_THEMES } from './words';
import { OUTDOOR_GAMES } from './realLife';
import { CHARADES, IMPOSTOR_PACKS } from './party';
import { FAMILY_INFO } from './families';

const games: GameMeta[] = [];
const seen = new Set<string>();

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function add(meta: GameMeta): void {
  if (seen.has(meta.id)) throw new Error(`Id de juego duplicado: ${meta.id}`);
  seen.add(meta.id);
  games.push(meta);
}

function base(meta: Omit<GameMeta, 'modes' | 'tags'> & { modes?: PlayMode[]; tags?: string[] }): GameMeta {
  return { modes: ['solo'], tags: [], ...meta } as GameMeta;
}

const difficultyByIndex = (index: number, max: number): Difficulty =>
  index <= Math.floor(max / 3) ? 'Fácil' : index <= Math.floor((max * 2) / 3) ? 'Medio' : 'Difícil';

/* ───────────────────────── Memoria ───────────────────────── */
const pairSizes = [
  [3, 4],
  [4, 3],
  [4, 4],
  [4, 5],
  [5, 4],
  [5, 6],
  [6, 5],
  [6, 6]
];
const trioSizes = [
  [3, 4],
  [4, 3],
  [3, 5],
  [5, 3],
  [3, 6],
  [6, 3],
  [5, 6],
  [6, 5],
  [6, 6]
];

for (const theme of MEMORY_THEMES) {
  for (const mode of ['pairs', 'trios'] as const) {
    const sizes = mode === 'pairs' ? pairSizes : trioSizes;
    for (const [cols, rows] of sizes) {
      const cards = cols * rows;
      const difficulty: Difficulty = cards <= 12 ? 'Fácil' : cards <= 20 ? 'Medio' : 'Difícil';
      add({
        id: `mem-${theme.id}-${mode}-${cols}x${rows}`,
        title: `${mode === 'pairs' ? 'Memoria' : 'Tríos'} · ${theme.name} ${cols}×${rows}`,
        blurb:
          mode === 'pairs'
            ? `Encuentra todas las parejas de ${theme.name.toLowerCase()} en un tablero de ${cols}×${rows} cartas.`
            : `Encuentra los tríos de ${theme.name.toLowerCase()} en un tablero de ${cols}×${rows} cartas.`,
        family: 'memory',
        category: 'Puzzle',
        emoji: theme.emoji,
        config: { themeId: theme.id, cols, rows, mode },
        modes: ['solo', 'local'],
        players: '1–2 jugadores',
        difficulty,
        duration: cards <= 12 ? '2–4 min' : cards <= 20 ? '3–6 min' : '5–10 min',
        tags: ['memoria', 'parejas', theme.id, '2 jugadores'],
        featured: theme.id === 'animales' && mode === 'pairs' && cols === 4 && rows === 4,
        variantOf: 'Memoria'
      });
    }
  }
}

/* ───────────────────────── Sopa de letras ───────────────────────── */
const searchSizes: { size: number; label: string }[] = [
  { size: 8, label: 'Pequeña' },
  { size: 10, label: 'Clásica' },
  { size: 12, label: 'Grande' },
  { size: 15, label: 'Gigante' }
];
const searchDiffs: { id: 'easy' | 'normal' | 'expert'; label: Difficulty; seconds: number }[] = [
  { id: 'easy', label: 'Fácil', seconds: 180 },
  { id: 'normal', label: 'Medio', seconds: 240 },
  { id: 'expert', label: 'Difícil', seconds: 300 }
];

for (const theme of WORD_THEMES) {
  for (const size of searchSizes) {
    for (const diff of searchDiffs) {
      add({
        id: `sopa-${theme.id}-${size.size}-${diff.id}`,
        title: `Sopa de ${theme.name.toLowerCase()} · ${size.label} · ${diff.label}`,
        blurb: `Encuentra las palabras de ${theme.name.toLowerCase()} en una cuadrícula de ${size.size}×${size.size}. Nivel ${diff.label.toLowerCase()}.`,
        family: 'wordsearch',
        category: 'Palabras',
        emoji: '🔎',
        config: { themeId: theme.id, size: size.size, difficulty: diff.id, seconds: diff.seconds },
        modes: ['solo'],
        players: '1 jugador',
        difficulty: diff.label,
        duration: `${Math.round(diff.seconds / 60)} min`,
        tags: ['sopa de letras', theme.id, diff.id],
        featured: theme.id === 'animales' && size.size === 10 && diff.id === 'normal',
        variantOf: 'Sopa de letras'
      });
    }
  }
}

/* ───────────────────────── Ahorcado ───────────────────────── */
const hangmanLives: { lives: number; label: Difficulty }[] = [
  { lives: 8, label: 'Fácil' },
  { lives: 6, label: 'Medio' },
  { lives: 4, label: 'Difícil' }
];
for (const theme of WORD_THEMES) {
  for (const level of hangmanLives) {
    add({
      id: `ahorcado-${theme.id}-${level.lives}`,
      title: `Ahorcado de ${theme.name.toLowerCase()} · ${level.label}`,
      blurb: `Adivina una palabra de ${theme.name.toLowerCase()} letra a letra. Empiezas con ${level.lives} vidas.`,
      family: 'hangman',
      category: 'Palabras',
      emoji: '🪢',
      config: { themeId: theme.id, lives: level.lives },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: level.label,
      duration: '2–5 min',
      tags: ['ahorcado', 'letras', theme.id],
      variantOf: 'Ahorcado'
    });
  }
}

/* ───────────────────────── Anagramas ───────────────────────── */
for (const theme of WORD_THEMES) {
  for (const mode of [
    { id: 'expres', label: 'Exprés', seconds: 60 },
    { id: 'clasico', label: 'Clásico', seconds: 120 }
  ]) {
    add({
      id: `anagrama-${theme.id}-${mode.id}`,
      title: `Anagramas de ${theme.name.toLowerCase()} · ${mode.label}`,
      blurb: `Ordena las letras para formar palabras de ${theme.name.toLowerCase()} antes de que se agote el tiempo.`,
      family: 'anagram',
      category: 'Palabras',
      emoji: '🔀',
      config: { themeId: theme.id, seconds: mode.seconds },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: mode.seconds <= 60 ? 'Difícil' : 'Medio',
      duration: mode.label,
      tags: ['anagramas', 'letras', theme.id],
      variantOf: 'Anagramas'
    });
  }
}

/* ───────────────────────── Palabra oculta ───────────────────────── */
const guessLevels: { attempts: number; label: Difficulty }[] = [
  { attempts: 8, label: 'Fácil' },
  { attempts: 6, label: 'Medio' },
  { attempts: 5, label: 'Difícil' }
];
for (const length of [5, 6, 7]) {
  for (const level of guessLevels) {
    add({
      id: `oculta-${length}-${level.attempts}`,
      title: `Palabra oculta · ${length} letras · ${level.label}`,
      blurb: `Adivina una palabra de ${length} letras y ${level.attempts} intentos. Las pistas de color te acercan a la respuesta.`,
      family: 'wordguess',
      category: 'Palabras',
      emoji: '🟩',
      config: { length, attempts: level.attempts },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: level.label,
      duration: '2–5 min',
      tags: ['palabra oculta', 'vocabulario', `${length} letras`],
      featured: length === 5 && level.attempts === 6,
      variantOf: 'Palabra oculta'
    });
  }
}

/* ───────────────────────── Trivia ───────────────────────── */
const continents = ['Europa', 'América', 'Asia', 'África', 'Oceanía', 'Mundo'] as const;
const geoModes: { id: 'bandera' | 'capital' | 'mixto'; label: string }[] = [
  { id: 'bandera', label: 'Banderas' },
  { id: 'capital', label: 'Capitales' },
  { id: 'mixto', label: 'Banderas y capitales' }
];
const levels: { id: 'facil' | 'medio' | 'dificil'; label: Difficulty }[] = [
  { id: 'facil', label: 'Fácil' },
  { id: 'medio', label: 'Medio' },
  { id: 'dificil', label: 'Difícil' }
];
for (const continent of continents) {
  for (const mode of geoModes) {
    for (const level of levels) {
      const id = `trivia-geo-${continent.toLowerCase().replace('é', 'e')}-${mode.id}-${level.id}`;
      const isOnlineBase = continent === 'Mundo' && mode.id === 'mixto' && level.id === 'medio';
      add({
        id,
        title: `${mode.label} · ${continent} · ${level.label}`,
        blurb: `Diez preguntas de ${mode.label.toLowerCase()} de ${continent === 'Mundo' ? 'todo el mundo' : continent}. Nivel ${level.label.toLowerCase()}.`,
        family: 'trivia',
        category: 'Trivia',
        emoji: mode.id === 'bandera' ? '🚩' : mode.id === 'capital' ? '🏛️' : '🌍',
        config: { quizType: 'geo', continent, mode: mode.id, difficulty: level.id },
        modes: isOnlineBase ? ['solo', 'online'] : ['solo'],
        players: isOnlineBase ? '1–2 jugadores' : '1 jugador',
        difficulty: level.label,
        duration: '3–5 min',
        tags: ['trivia', 'geografía', continent.toLowerCase(), level.id, ...(isOnlineBase ? ['online'] : [])],
        featured: isOnlineBase,
        variantOf: 'Trivia de geografía'
      });
    }
  }
}

for (const theme of WORD_THEMES) {
  for (const level of levels.slice(0, 2)) {
    add({
      id: `ortografia-${theme.id}-${level.id}`,
      title: `Letra perdida · ${theme.name} · ${level.label}`,
      blurb: `Elige la letra que falta en palabras de ${theme.name.toLowerCase()}. Ideal para repasar ortografía sin darte cuenta.`,
      family: 'trivia',
      category: 'Trivia',
      emoji: '🔤',
      config: { quizType: 'spelling', themeId: theme.id, difficulty: level.id },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: level.label,
      duration: '2–4 min',
      tags: ['ortografía', 'letras', theme.id],
      variantOf: 'Letra perdida'
    });
  }
}

const quizTypes: { id: string; label: string; emoji: string; tag: string }[] = [
  { id: 'synonyms', label: 'Sinónimos', emoji: '🟰', tag: 'vocabulario' },
  { id: 'antonyms', label: 'Antónimos', emoji: '↔️', tag: 'vocabulario' },
  { id: 'science', label: 'Símbolos químicos', emoji: '🧪', tag: 'ciencia' },
  { id: 'history', label: 'Años de la historia', emoji: '🏺', tag: 'historia' }
];
for (const type of quizTypes) {
  for (const count of [8, 10, 12]) {
    add({
      id: `quiz-${type.id}-${count}`,
      title: `${type.label} · ${count} preguntas`,
      blurb: `Ronda de ${count} preguntas de ${type.label.toLowerCase()} con cuatro opciones cada una.`,
      family: 'trivia',
      category: 'Trivia',
      emoji: type.emoji,
      config: { quizType: type.id, count },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: count <= 8 ? 'Fácil' : count <= 10 ? 'Medio' : 'Difícil',
      duration: '2–5 min',
      tags: ['trivia', type.tag],
      variantOf: 'Trivia exprés'
    });
  }
}

/* ───────────────────────── Cálculo ───────────────────────── */
const operations: { id: string; label: string; emoji: string }[] = [
  { id: 'suma', label: 'Sumas', emoji: '➕' },
  { id: 'resta', label: 'Restas', emoji: '➖' },
  { id: 'multiplicacion', label: 'Multiplicaciones', emoji: '✖️' },
  { id: 'division', label: 'Divisiones', emoji: '➗' },
  { id: 'mixto', label: 'Operaciones mixtas', emoji: '🧮' },
  { id: 'potencias', label: 'Potencias y raíces', emoji: '²' }
];
const ranges = [10, 20, 50, 100, 200, 500, 1000, 2000];
const durations = [30, 60, 90, 120, 180];
for (const op of operations) {
  for (const max of ranges) {
    for (const seconds of durations) {
      add({
        id: `calculo-${op.id}-${max}-${seconds}`,
        title: `${op.label} hasta ${max} · ${seconds} s`,
        blurb: `Resuelve el máximo de operaciones (${op.label.toLowerCase()}, números hasta ${max}) en ${seconds} segundos.`,
        family: 'math',
        category: 'Puzzle',
        emoji: op.emoji,
        config: { mode: 'arithmetic', op: op.id, max, seconds },
        modes: ['solo'],
        players: '1 jugador',
        difficulty: max <= 20 ? 'Fácil' : max <= 100 ? 'Medio' : 'Difícil',
        duration: `${seconds} s`,
        tags: ['cálculo', 'matemáticas', op.id],
        featured: op.id === 'mixto' && max === 100 && seconds === 60,
        variantOf: 'Cálculo mental'
      });
    }
  }
}

for (let table = 1; table <= 12; table++) {
  for (const variant of [
    { id: 'directa', label: 'Directa' },
    { id: 'inversa', label: 'Inversa' }
  ]) {
    add({
      id: `tabla-${table}-${variant.id}`,
      title: `Tabla del ${table} · ${variant.label}`,
      blurb: `Practica la tabla del ${table} en 60 segundos. Resuelve el máximo de multiplicaciones posible.`,
      family: 'math',
      category: 'Puzzle',
      emoji: '🔢',
      config: { mode: 'tables', table, variant: variant.id, seconds: 60 },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: table <= 4 ? 'Fácil' : table <= 8 ? 'Medio' : 'Difícil',
      duration: '60 s',
      tags: ['tablas', 'multiplicar', `tabla ${table}`],
      variantOf: 'Tablas de multiplicar'
    });
  }
}

const sequenceStyles = [
  { id: 'suma', label: 'Saltos' },
  { id: 'multiplicacion', label: 'Multiplicación' },
  { id: 'alterna', label: 'Alternas' }
];
for (const style of sequenceStyles) {
  for (let level = 1; level <= 3; level++) {
    add({
      id: `secuencias-${style.id}-${level}`,
      title: `Secuencias · ${style.label} · Nivel ${level}`,
      blurb: `Descubre el número que sigue en secuencias de tipo ${style.label.toLowerCase()}. Nivel ${level}.`,
      family: 'math',
      category: 'Puzzle',
      emoji: '🧠',
      config: { mode: 'sequences', style: style.id, level },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: level === 1 ? 'Fácil' : level === 2 ? 'Medio' : 'Difícil',
      duration: '2 min',
      tags: ['secuencias', 'lógica', 'matemáticas'],
      variantOf: 'Secuencias'
    });
  }
}

for (const max of [20, 100, 500]) {
  for (const direction of [
    { id: 'arabe', label: 'Número → romano' },
    { id: 'romano', label: 'Romano → número' }
  ]) {
    add({
      id: `romanos-${max}-${direction.id}`,
      title: `Romanos hasta ${max} · ${direction.label}`,
      blurb: `Convierte números hasta ${max} entre arábigos y romanos. ${direction.label}.`,
      family: 'math',
      category: 'Puzzle',
      emoji: '🏛️',
      config: { mode: 'roman', max, direction: direction.id },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: max <= 20 ? 'Fácil' : max <= 100 ? 'Medio' : 'Difícil',
      duration: '2 min',
      tags: ['números romanos', 'matemáticas'],
      variantOf: 'Números romanos'
    });
  }
}

for (const level of levels) {
  for (const variant of [
    { id: 'porcentaje', label: 'Porcentajes' },
    { id: 'descuento', label: 'Descuentos' }
  ]) {
    add({
      id: `porcentajes-${level.id}-${variant.id}`,
      title: `${variant.label} · ${level.label}`,
      blurb: `Calcula ${variant.label.toLowerCase()} mentalmente en sesiones de dos minutos. Nivel ${level.label.toLowerCase()}.`,
      family: 'math',
      category: 'Puzzle',
      emoji: '％',
      config: { mode: 'percent', level: level.id, variant: variant.id },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: level.label,
      duration: '2 min',
      tags: ['porcentajes', 'matemáticas', 'dinero'],
      variantOf: 'Porcentajes'
    });
  }
}

/* ───────────────────────── Cartas ───────────────────────── */
const klondikeVariants = [
  { id: 'clasico', label: 'Clásico', timed: false, back: 'classic', scoring: false },
  { id: 'relampago', label: 'Relámpago', timed: true, back: 'coral', scoring: false },
  { id: 'nocturno', label: 'Nocturno', timed: false, back: 'night', scoring: false },
  { id: 'vegas', label: 'Vegas', timed: false, back: 'mint', scoring: true }
];
for (const draw of [1, 3]) {
  for (const variant of klondikeVariants) {
    add({
      id: `klondike-${draw}-${variant.id}`,
      title: `Solitario · Roba ${draw} · ${variant.label}`,
      blurb: `Klondike de 52 cartas${draw === 3 ? ' robando de tres en tres' : ' robando de una en una'}${variant.timed ? ', contra reloj' : ''}. Estilo ${variant.label.toLowerCase()}.`,
      family: 'klondike',
      category: 'Cartas',
      emoji: '🃏',
      config: { draw, timed: variant.timed, back: variant.back, vegas: variant.scoring },
      modes: ['solo'],
      players: '1 jugador',
      duration: variant.timed ? '5 min' : '5–15 min',
      difficulty: draw === 3 ? 'Difícil' : 'Medio',
      tags: ['solitario', 'klondike', 'cartas'],
      featured: draw === 1 && variant.id === 'clasico',
      variantOf: 'Solitario Klondike'
    });
  }
}

for (const draw of [1, 3]) {
  for (const redeals of [0, 2]) {
    add({
      id: `piramide-${draw}-${redeals}`,
      title: `Pirámide · Roba ${draw}${redeals ? ' · 2 repartos' : ' · sin reparto'}`,
      blurb: `Retira parejas que sumen 13 de la pirámide. ${redeals ? 'Puedes volver a pasar el mazo dos veces.' : 'No hay segundas oportunidades con el mazo.'}`,
      family: 'pyramid',
      category: 'Cartas',
      emoji: '🔺',
      config: { draw, redeals },
      modes: ['solo'],
      players: '1 jugador',
      duration: '3–8 min',
      difficulty: redeals === 0 ? 'Difícil' : 'Medio',
      tags: ['solitario', 'pirámide', 'cartas'],
      variantOf: 'Pirámide'
    });
  }
}

for (const decks of [1, 2, 4, 6]) {
  for (const soft17 of [true, false]) {
    add({
      id: `blackjack-${decks}-${soft17 ? 's17' : 'h17'}`,
      title: `Blackjack · ${decks} ${decks === 1 ? 'baraja' : 'barajas'} · ${soft17 ? 'S17' : 'H17'}`,
      blurb: `Blackjack contra la banca con ${decks} ${decks === 1 ? 'baraja' : 'barajas'}. ${soft17 ? 'La banca se planta con 17 suave.' : 'La banca pide con 17 suave.'}`,
      family: 'blackjack',
      category: 'Cartas',
      emoji: '♠️',
      config: { decks, soft17 },
      modes: ['solo'],
      players: '1 jugador',
      duration: '5–10 min',
      tags: ['blackjack', 'veintiuna', 'casino'],
      variantOf: 'Blackjack'
    });
  }
}

for (const mode of [
  { id: 'clasico', label: 'Clásico', speed: 900 },
  { id: 'turbo', label: 'Relámpago', speed: 380 }
]) {
  add({
    id: `guerra-${mode.id}`,
    title: `Guerra de cartas · ${mode.label}`,
    blurb: `Voltea cartas contra la banca y gana la mejor. Enfréntate a una guerra cuando haya empate.`,
    family: 'war',
    category: 'Cartas',
    emoji: '⚔️',
    config: { speed: mode.speed },
    modes: ['solo'],
    players: '1 jugador (vs CPU)',
    difficulty: mode.id === 'turbo' ? 'Difícil' : 'Fácil',
    duration: '3–6 min',
    tags: ['guerra', 'cartas', 'azar'],
    variantOf: 'Guerra de cartas'
  });
}

for (const deck of [
  { id: 'cartas', label: 'Cartas' },
  { id: 'numeros', label: 'Números' }
]) {
  for (const lives of [3, 2, 1]) {
    add({
      id: `mayor-menor-${deck.id}-${lives}`,
      title: `Mayor o menor · ${deck.label} · ${lives} ${lives === 1 ? 'vida' : 'vidas'}`,
      blurb: `Adivina si el siguiente ${deck.id === 'cartas' ? 'naipe' : 'número'} será mayor o menor. Cada fallo cuesta una vida.`,
      family: 'higherlower',
      category: 'Cartas',
      emoji: deck.id === 'cartas' ? '🂡' : '🔢',
      config: { deck: deck.id, lives },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: lives === 3 ? 'Fácil' : lives === 2 ? 'Medio' : 'Difícil',
      duration: '2–5 min',
      tags: ['cartas', 'azar', 'racha'],
      variantOf: 'Mayor o menor'
    });
  }
}

/* ───────────────────────── Estrategia ───────────────────────── */
const aiLevels: { id: string; label: Difficulty }[] = [
  { id: 'facil', label: 'Fácil' },
  { id: 'normal', label: 'Medio' },
  { id: 'dificil', label: 'Difícil' }
];
const tttSizes = [
  { size: 3, win: 3 },
  { size: 4, win: 4 },
  { size: 5, win: 4 },
  { size: 6, win: 5 }
];
for (const board of tttSizes) {
  for (const ai of aiLevels) {
    const id = `ttt-${board.size}x${board.size}-${ai.id}`;
    const isOnline = board.size === 3 && ai.id === 'normal';
    add({
      id,
      title: `Tres en raya ${board.size}×${board.size} · ${ai.label}`,
      blurb: `Consigue ${board.win} en línea en un tablero de ${board.size}×${board.size}. Juega contra la máquina o contra un amigo.`,
      family: 'ttt',
      category: 'Estrategia',
      emoji: '⭕',
      config: { size: board.size, win: board.win, ai: ai.id },
      modes: isOnline ? ['solo', 'local', 'online'] : ['solo', 'local'],
      players: isOnline ? '1–2 jugadores' : '1–2 jugadores',
      difficulty: ai.label,
      duration: '1–5 min',
      tags: ['tres en raya', 'tablero', '2 jugadores', ...(isOnline ? ['online'] : [])],
      featured: isOnline,
      variantOf: 'Tres en raya'
    });
  }
}

const c4Boards = [
  { cols: 7, rows: 6 },
  { cols: 8, rows: 7 },
  { cols: 6, rows: 5 },
  { cols: 9, rows: 7 }
];
for (const board of c4Boards) {
  for (const ai of aiLevels.slice(1)) {
    const id = `c4-${board.cols}x${board.rows}-${ai.id}`;
    const isOnline = board.cols === 7 && board.rows === 6 && ai.id === 'normal';
    add({
      id,
      title: `Cuatro en línea ${board.cols}×${board.rows} · ${ai.label}`,
      blurb: `Conecta cuatro fichas en un tablero de ${board.cols}×${board.rows}. Contra la máquina o contra un amigo.`,
      family: 'connect4',
      category: 'Estrategia',
      emoji: '🔴',
      config: { cols: board.cols, rows: board.rows, ai: ai.id },
      modes: isOnline ? ['solo', 'local', 'online'] : ['solo', 'local'],
      players: '1–2 jugadores',
      difficulty: ai.label,
      duration: '2–8 min',
      tags: ['cuatro en línea', 'tablero', '2 jugadores', ...(isOnline ? ['online'] : [])],
      variantOf: 'Cuatro en línea'
    });
  }
}

for (const size of [6, 8]) {
  for (const ai of aiLevels) {
    const id = `reversi-${size}x${size}-${ai.id}`;
    const isOnline = size === 8 && ai.id === 'normal';
    add({
      id,
      title: `Reversi ${size}×${size} · ${ai.label}`,
      blurb: `Encierra fichas rivales para darles la vuelta en un tablero de ${size}×${size}. Gana quien domine más casillas.`,
      family: 'reversi',
      category: 'Estrategia',
      emoji: '⚫',
      config: { size, ai: ai.id },
      modes: isOnline ? ['solo', 'local', 'online'] : ['solo', 'local'],
      players: '1–2 jugadores',
      difficulty: ai.label,
      duration: '3–10 min',
      tags: ['reversi', 'othello', 'tablero', '2 jugadores', ...(isOnline ? ['online'] : [])],
      variantOf: 'Reversi'
    });
  }
}

for (const size of [3, 4, 5, 6]) {
  for (const target of [1024, 2048]) {
    add({
      id: `2048-${size}-${target}`,
      title: `Fusión ${size}×${size} · Meta ${target}`,
      blurb: `Desliza y combina números iguales en un tablero de ${size}×${size}. Intenta llegar a ${target}.`,
      family: '2048',
      category: 'Puzzle',
      emoji: '🟪',
      config: { size, target },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: target > 1024 ? 'Difícil' : 'Medio',
      duration: '3–10 min',
      tags: ['2048', 'números', 'puzle'],
      featured: size === 4 && target === 2048,
      variantOf: 'Fusión 2048'
    });
  }
}

const minefields = [
  { cols: 8, rows: 8, mines: 10, label: 'Principiante' },
  { cols: 9, rows: 9, mines: 12, label: 'Clásico' },
  { cols: 12, rows: 12, mines: 22, label: 'Intermedio' },
  { cols: 12, rows: 18, mines: 40, label: 'Panorámico' },
  { cols: 15, rows: 15, mines: 40, label: 'Experto' },
  { cols: 16, rows: 16, mines: 40, label: 'Tablero grande' },
  { cols: 16, rows: 24, mines: 70, label: 'Desafío' },
  { cols: 16, rows: 30, mines: 99, label: 'Maestro' }
];
for (const field of minefields) {
  add({
    id: `minas-${field.cols}x${field.rows}-${field.mines}`,
    title: `Buscaminas ${field.cols}×${field.rows} · ${field.label}`,
    blurb: `Despeja ${field.cols * field.rows} casillas sin pisar ninguna de las ${field.mines} minas.`,
    family: 'minesweeper',
    category: 'Puzzle',
    emoji: '💣',
    config: { cols: field.cols, rows: field.rows, mines: field.mines },
    modes: ['solo'],
    players: '1 jugador',
    difficulty: field.mines <= 12 ? 'Fácil' : field.mines <= 40 ? 'Medio' : 'Difícil',
    duration: '3–20 min',
    tags: ['buscaminas', 'lógica', 'minas'],
    variantOf: 'Buscaminas'
  });
}

for (const size of [9, 6]) {
  for (const level of levels) {
    add({
      id: `sudoku-${size}-${level.id}`,
      title: `Sudoku ${size}×${size} · ${level.label}`,
      blurb: `Completa el tablero de ${size}×${size} sin repetir números en filas, columnas y bloques. Nivel ${level.label.toLowerCase()}.`,
      family: 'sudoku',
      category: 'Puzzle',
      emoji: '🔢',
      config: { size, difficulty: level.id },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: level.label,
      duration: '5–20 min',
      tags: ['sudoku', 'lógica', 'números'],
      variantOf: 'Sudoku'
    });
  }
}

for (const size of [3, 4, 5]) {
  for (const mode of [
    { id: 'clasico', label: 'Clásico' },
    { id: 'crono', label: 'Contrarreloj' }
  ]) {
    add({
      id: `deslizante-${size}-${mode.id}`,
      title: `Puzle deslizante ${size}×${size} · ${mode.label}`,
      blurb: `Ordena las fichas del 1 al ${size * size - 1} deslizándolas al hueco${mode.id === 'crono' ? ' antes de que acabe el tiempo' : ''}.`,
      family: 'sliding',
      category: 'Puzzle',
      emoji: '🧩',
      config: { size, mode: mode.id },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: size === 3 ? 'Fácil' : size === 4 ? 'Medio' : 'Difícil',
      duration: mode.id === 'crono' ? '5 min' : '3–15 min',
      tags: ['puzle', 'deslizante', '15-puzzle'],
      variantOf: 'Puzle deslizante'
    });
  }
}

for (const maze of [
  { size: 9, label: 'Pequeño' },
  { size: 13, label: 'Mediano' },
  { size: 17, label: 'Grande' },
  { size: 25, label: 'Laberinto enorme' }
]) {
  for (const fog of [
    { level: 0, label: 'Vista completa' },
    { level: 1, label: 'Niebla media' },
    { level: 2, label: 'Niebla densa' }
  ]) {
    add({
      id: `laberinto-${maze.size}-${fog.level}`,
      title: `Laberinto ${maze.label} · ${fog.label}`,
      blurb: `Encuentra la salida del laberinto de ${maze.size}×${maze.size}. ${fog.level ? 'Solo verás parte del mapa: memoriza el camino.' : 'Tienes el mapa completo a la vista.'}`,
      family: 'maze',
      category: 'Puzzle',
      emoji: '🌀',
      config: { size: maze.size, fog: fog.level },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: fog.level === 0 ? 'Fácil' : fog.level === 1 ? 'Medio' : 'Difícil',
      duration: '2–10 min',
      tags: ['laberinto', 'orientación', 'puzle'],
      variantOf: 'Laberinto'
    });
  }
}

for (const size of [3, 4, 5]) {
  for (const scramble of [6, 12, 20, 28]) {
    add({
      id: `luces-${size}-${scramble}`,
      title: `Luces fuera ${size}×${size} · ${scramble} giros`,
      blurb: `Apaga todas las luces de la cuadrícula. Cada toque cambia la casilla y sus vecinas. Mezcla de ${scramble} giros.`,
      family: 'lightsout',
      category: 'Puzzle',
      emoji: '💡',
      config: { size, scramble },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: scramble <= 6 ? 'Fácil' : scramble <= 20 ? 'Medio' : 'Difícil',
      duration: '2–8 min',
      tags: ['luces fuera', 'lógica', 'puzle'],
      variantOf: 'Luces fuera'
    });
  }
}

/* ───────────────────────── Arcade ───────────────────────── */
const snakeSpeeds = [
  { id: 'lenta', label: 'Lenta', ms: 190 },
  { id: 'normal', label: 'Normal', ms: 145 },
  { id: 'rapida', label: 'Rápida', ms: 110 },
  { id: 'turbo', label: 'Turbo', ms: 85 }
];
for (const speed of snakeSpeeds) {
  for (const wrap of [false, true]) {
    add({
      id: `serpiente-${speed.id}-${wrap ? 'portal' : 'muros'}`,
      title: `Serpiente · ${speed.label} · ${wrap ? 'Portal' : 'Muros'}`,
      blurb: `Come y crece sin chocarte. ${wrap ? 'Los bordes son portales: sales por un lado y apareces por el otro.' : 'Los bordes son muros: un choque termina la partida.'}`,
      family: 'snake',
      category: 'Arcade',
      emoji: '🐍',
      config: { speed: speed.ms, wrap },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: speed.ms <= 110 ? 'Difícil' : speed.ms <= 145 ? 'Medio' : 'Fácil',
      duration: '2–8 min',
      tags: ['serpiente', 'arcade', 'retro'],
      featured: speed.id === 'normal' && !wrap,
      variantOf: 'Serpiente'
    });
  }
}

for (const speed of [
  { id: 'lento', label: 'Lento', ms: 1000 },
  { id: 'normal', label: 'Normal', ms: 750 },
  { id: 'rapido', label: 'Rápido', ms: 560 }
]) {
  for (const start of [3, 5]) {
    add({
      id: `secuencia-${speed.id}-${start}`,
      title: `Secuencia de colores · ${speed.label} · ${start} colores`,
      blurb: `Memoriza y repite la secuencia de colores. Empiezas con ${start} pasos y cada ronda suma uno.`,
      family: 'simon',
      category: 'Arcade',
      emoji: '🟢',
      config: { speed: speed.ms, start },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: speed.ms <= 560 ? 'Difícil' : speed.ms <= 750 ? 'Medio' : 'Fácil',
      duration: '2–5 min',
      tags: ['memoria', 'secuencia', 'colores'],
      variantOf: 'Secuencia de colores'
    });
  }
}

for (const rounds of [3, 5, 10, 20]) {
  add({
    id: `reflejos-${rounds}`,
    title: `Reflejos · ${rounds === 20 ? 'Maratón' : `${rounds} rondas`}`,
    blurb: `Toca la pantalla en cuanto cambie de color. Se mide tu tiempo de reacción medio y el mejor.`,
    family: 'reaction',
    category: 'Arcade',
    emoji: '⚡',
    config: { rounds },
    modes: ['solo'],
    players: '1 jugador',
    duration: rounds <= 5 ? '1–2 min' : '3–6 min',
    tags: ['reflejos', 'reacción', 'tiempo'],
    variantOf: 'Reflejos'
  });
}

for (const size of [3, 4]) {
  for (const seconds of [30, 45]) {
    for (const speed of [
      { id: 'normal', label: 'Normal', ms: 900 },
      { id: 'rapida', label: 'Rápido', ms: 620 }
    ]) {
      add({
        id: `topos-${size}-${seconds}-${speed.id}`,
        title: `Topos ${size}×${size} · ${seconds} s · ${speed.label}`,
        blurb: `Golpea los topos que asoman durante ${seconds} segundos. Cuanto más rápido, más puntos.`,
        family: 'whack',
        category: 'Arcade',
        emoji: '🔨',
        config: { size, seconds, speed: speed.ms },
        modes: ['solo'],
        players: '1 jugador',
        difficulty: speed.ms <= 620 ? 'Difícil' : 'Medio',
        duration: `${seconds} s`,
        tags: ['topos', 'reflejos', 'arcade'],
        variantOf: 'Topos'
      });
    }
  }
}

for (const seconds of [20, 30, 60]) {
  for (const target of [
    { id: 'normal', label: 'Dianas normales', size: 46 },
    { id: 'pequena', label: 'Dianas pequeñas', size: 30 }
  ]) {
    add({
      id: `punteria-${seconds}-${target.id}`,
      title: `Puntería · ${seconds} s · ${target.label}`,
      blurb: `Toca el máximo de dianas en ${seconds} segundos. ${target.id === 'pequena' ? 'Son más pequeñas: precisión pura.' : 'Encuentra tu ritmo y no falles.'}`,
      family: 'aim',
      category: 'Arcade',
      emoji: '🎯',
      config: { seconds, size: target.size },
      modes: ['solo'],
      players: '1 jugador',
      difficulty: target.id === 'pequena' ? 'Difícil' : 'Medio',
      duration: `${seconds} s`,
      tags: ['puntería', 'precisión', 'arcade'],
      variantOf: 'Puntería'
    });
  }
}

/* ───────────────────────── Fiesta ───────────────────────── */
const charadeLevels: { id: 'easy' | 'normal' | 'hard'; label: Difficulty; seconds: number }[] = [
  { id: 'easy', label: 'Fácil', seconds: 90 },
  { id: 'normal', label: 'Medio', seconds: 75 },
  { id: 'hard', label: 'Difícil', seconds: 60 }
];
for (const category of CHARADES) {
  for (const level of charadeLevels) {
    add({
      id: `mimica-${category.id}-${level.id}`,
      title: `Mímica · ${category.name} · ${level.label}`,
      blurb: `Describe con gestos las palabras de ${category.name.toLowerCase()} sin hablar. ${level.seconds} segundos por turno.`,
      family: 'charades',
      category: 'Fiesta',
      emoji: category.emoji,
      config: { categoryId: category.id, difficulty: level.id, seconds: level.seconds },
      modes: ['local'],
      players: '3–12 jugadores',
      difficulty: level.label,
      duration: '10–20 min',
      tags: ['mímica', 'charadas', 'grupo', category.id],
      featured: category.id === 'animales' && level.id === 'normal',
      variantOf: 'Mímica'
    });
  }
}

for (const pack of IMPOSTOR_PACKS) {
  add({
    id: `impostor-${pack.id}`,
    title: `Impostor · ${pack.name}`,
    blurb: `Todos reciben la misma palabra secreta menos una persona. Hablad, disimulad y descubrid al impostor.`,
    family: 'impostor',
    category: 'Fiesta',
    emoji: pack.emoji,
    config: { packId: pack.id },
    modes: ['local'],
    players: '3–10 jugadores',
    duration: '10–20 min',
    tags: ['impostor', 'deducción', 'grupo', pack.id],
    variantOf: 'Impostor'
  });
}

/* ───────────────────────── Aire libre ───────────────────────── */
for (const game of OUTDOOR_GAMES) {
  add({
    id: `outdoor-${game.id}`,
    title: game.name,
    blurb: game.tagline,
    family: 'outdoor',
    category: 'Aire libre',
    emoji: game.emoji,
    config: { outdoorId: game.id },
    modes: ['local'],
    players: game.players,
    duration: game.duration,
    tags: game.tags,
    featured: game.id === 'captura-la-bandera' || game.id === 'manhunt',
    variantOf: 'Juegos al aire libre'
  });
}

/* ───────────────────────── Orden final ───────────────────────── */
const categoryOrder: Category[] = ['Arcade', 'Cartas', 'Estrategia', 'Fiesta', 'Palabras', 'Puzzle', 'Trivia', 'Aire libre'];
games.sort((a, b) => {
  if (Boolean(b.featured) !== Boolean(a.featured)) return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
  const cat = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
  if (cat !== 0) return cat;
  return a.title.localeCompare(b.title, 'es');
});

export const GAMES: GameMeta[] = games;
export const GAME_MAP = new Map(GAMES.map((game) => [game.id, game]));
export const TOTAL_GAMES = GAMES.length;

export const CATEGORIES: { id: Category; label: string; emoji: string; count: number }[] = ([
  { id: 'Arcade', label: 'Arcade', emoji: '👾' },
  { id: 'Cartas', label: 'Cartas', emoji: '🃏' },
  { id: 'Estrategia', label: 'Estrategia', emoji: '♟️' },
  { id: 'Fiesta', label: 'Fiesta', emoji: '🎉' },
  { id: 'Palabras', label: 'Palabras', emoji: '🔤' },
  { id: 'Puzzle', label: 'Puzles', emoji: '🧩' },
  { id: 'Trivia', label: 'Trivia', emoji: '❓' },
  { id: 'Aire libre', label: 'Aire libre', emoji: '🌳' }
] as { id: Category; label: string; emoji: string }[]).map((category) => ({
  ...category,
  count: GAMES.filter((game) => game.category === category.id).length
}));

export const FAMILY_COUNTS: Partial<Record<FamilyId, number>> = GAMES.reduce<Partial<Record<FamilyId, number>>>(
  (acc, game) => {
    acc[game.family] = (acc[game.family] ?? 0) + 1;
    return acc;
  },
  {}
);

export function getGame(id: string | undefined): GameMeta | undefined {
  return id ? GAME_MAP.get(id) : undefined;
}

export function searchGames(options: { query?: string; category?: Category | 'Todas'; mode?: PlayMode | 'todos' }): GameMeta[] {
  const query = options.query?.trim().toLowerCase() ?? '';
  const category = options.category ?? 'Todas';
  const mode = options.mode ?? 'todos';
  const words = query.split(/\s+/).filter(Boolean);
  return GAMES.filter((game) => {
    if (category !== 'Todas' && game.category !== category) return false;
    if (mode !== 'todos' && !game.modes.includes(mode)) return false;
    if (!words.length) return true;
    const haystack = `${game.title} ${game.blurb} ${game.family} ${game.tags.join(' ')} ${FAMILY_INFO[game.family].name}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export interface OnlineGameInfo {
  metaId: string;
  name: string;
  emoji: string;
  blurb: string;
}

export const ONLINE_GAMES: OnlineGameInfo[] = [
  {
    metaId: 'ttt-3x3-normal',
    name: 'Tres en raya',
    emoji: '⭕',
    blurb: 'Clásico duelo de 3 en línea.'
  },
  {
    metaId: 'c4-7x6-normal',
    name: 'Cuatro en línea',
    emoji: '🔴',
    blurb: 'Conecta cuatro antes que tu rival.'
  },
  {
    metaId: 'reversi-8x8-normal',
    name: 'Reversi',
    emoji: '⚫',
    blurb: 'Domina el tablero dando la vuelta a las fichas.'
  },
  {
    metaId: 'trivia-geo-mundo-mixto-medio',
    name: 'Duelo de trivia',
    emoji: '🌍',
    blurb: 'Banderas y capitales del mundo, turnos alternos.'
  }
];

export function getOnlineMeta(metaId: string): GameMeta | undefined {
  return GAME_MAP.get(metaId);
}

export const FEATURED_GAMES = GAMES.filter((game) => game.featured);

export { WORD_THEMES };
export type { WordTheme };
