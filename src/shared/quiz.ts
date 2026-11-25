import { COUNTRIES } from '../data/countries';
import { ANTONYM_PAIRS, HISTORY_YEARS, SCIENCE_SYMBOLS, SYNONYM_PAIRS } from '../data/extraQuiz';
import { WORD_THEMES } from '../data/words';
import type { Country } from '../types';
import { randomInt, shuffle, type Rng } from '../lib/random';

export interface Question {
  prompt: string;
  options: string[];
  answer: number;
  hint?: string;
  visual?: string;
  big?: boolean;
}

type Config = Record<string, unknown>;

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

function withAnswer(options: string[], answer: string, rng: Rng): { options: string[]; answer: number } {
  const unique = [...new Set(options.filter((option) => option !== answer))];
  const picked = shuffle(unique, rng).slice(0, 3);
  const all = shuffle([answer, ...picked], rng);
  return { options: all, answer: all.indexOf(answer) };
}

function distractors<T>(pool: T[], exclude: (item: T) => boolean, count: number, rng: Rng, fallback: T[] = []): T[] {
  let available = pool.filter((item) => !exclude(item));
  if (available.length < count) available = [...available, ...fallback.filter((item) => !exclude(item))];
  return shuffle(available, rng).slice(0, count);
}

/* ───────────────────────── Geografía ───────────────────────── */
function geoPool(continent: string, difficulty: string): Country[] {
  const base = continent === 'Mundo' ? COUNTRIES : COUNTRIES.filter((country) => country.continent === continent);
  if (difficulty === 'facil') {
    const tier1 = base.filter((country) => country.tier === 1);
    if (tier1.length >= 6) return tier1;
  }
  if (difficulty === 'medio') {
    const easy = base.filter((country) => country.tier <= 2);
    if (easy.length >= 8) return easy;
  }
  if (difficulty === 'dificil') {
    const hard = base.filter((country) => country.tier >= 2);
    if (hard.length >= 8) return hard;
  }
  return base;
}

function makeGeoQuestions(config: Config, rng: Rng): Question[] {
  const continent = str(config.continent, 'Mundo');
  const mode = str(config.mode, 'mixto');
  const difficulty = str(config.difficulty, 'medio');
  const pool = geoPool(continent, difficulty);
  const targets = shuffle(pool, rng).slice(0, Math.min(10, pool.length));
  const sameContinent = COUNTRIES.filter((country) => country.continent === continent);

  return targets.map((country, index) => {
    const questionMode = mode === 'mixto' ? (index % 2 === 0 ? 'bandera' : 'capital') : mode;
    if (questionMode === 'bandera') {
      const names = distractors(
        sameContinent,
        (item) => item.name === country.name,
        3,
        rng,
        COUNTRIES
      ).map((item) => item.name);
      const built = withAnswer(names, country.name, rng);
      return {
        prompt: '¿De qué país es esta bandera?',
        visual: country.flag,
        hint: country.continent,
        options: built.options,
        answer: built.answer,
        big: true
      };
    }
    const capitals = distractors(
      sameContinent,
      (item) => item.name === country.name,
      3,
      rng,
      COUNTRIES
    ).map((item) => item.capital);
    const built = withAnswer(capitals, country.capital, rng);
    return {
      prompt: `¿Cuál es la capital de ${country.name}?`,
      hint: country.continent,
      options: built.options,
      answer: built.answer,
      big: false
    };
  });
}

/* ───────────────────────── Lengua ───────────────────────── */
function makeSpellingQuestions(config: Config, rng: Rng): Question[] {
  const theme = WORD_THEMES.find((item) => item.id === str(config.themeId)) ?? WORD_THEMES[0];
  const difficulty = str(config.difficulty, 'facil');
  let words = theme.words.filter((word) => {
    if (difficulty === 'facil') return word.length <= 5;
    return word.length >= 6 && word.length <= 7;
  });
  if (words.length < 8) words = theme.words;
  words = shuffle(words, rng).slice(0, 10);
  const letters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

  return words.map((word) => {
    const upper = word.toUpperCase();
    const index = 1 + randomInt(Math.max(1, upper.length - 2), rng);
    const correct = upper[index];
    const blanked = `${upper.slice(0, index)}_${upper.slice(index + 1)}`;
    const wrong = shuffle(letters.filter((letter) => letter !== correct), rng).slice(0, 3);
    const built = withAnswer(wrong, correct, rng);
    return {
      prompt: '¿Qué letra falta en esta palabra?',
      visual: blanked.split('').join(' '),
      hint: theme.name,
      options: built.options,
      answer: built.answer,
      big: true
    };
  });
}

function makePairQuestions(
  pairs: { word: string; value: string }[],
  label: string,
  config: Config,
  rng: Rng
): Question[] {
  const count = num(config.count, 10);
  const picked = shuffle(pairs, rng).slice(0, Math.min(count, pairs.length));
  return picked.map((pair) => {
    const wrong = distractors(pairs, (item) => item.value === pair.value, 3, rng).map((item) => item.value);
    const built = withAnswer(wrong, pair.value, rng);
    return {
      prompt: `¿Cuál es un ${label} de «${pair.word}»?`,
      options: built.options,
      answer: built.answer,
      big: false
    };
  });
}

function makeScienceQuestions(config: Config, rng: Rng): Question[] {
  const count = num(config.count, 10);
  const picked = shuffle(SCIENCE_SYMBOLS, rng).slice(0, count);
  return picked.map((entry) => {
    const wrong = distractors(SCIENCE_SYMBOLS, (item) => item.element === entry.element, 3, rng).map((item) => item.element);
    const built = withAnswer(wrong, entry.element, rng);
    return {
      prompt: `¿Qué elemento químico tiene el símbolo ${entry.symbol}?`,
      options: built.options,
      answer: built.answer,
      hint: 'Química'
    };
  });
}

function makeHistoryQuestions(config: Config, rng: Rng): Question[] {
  const count = num(config.count, 10);
  const picked = shuffle(HISTORY_YEARS, rng).slice(0, count);
  return picked.map((entry) => {
    const wrong = distractors(HISTORY_YEARS, (item) => item.year === entry.year, 3, rng).map((item) => String(item.year));
    const built = withAnswer(wrong, String(entry.year), rng);
    return {
      prompt: `¿En qué año ocurrió? ${entry.event}`,
      options: built.options,
      answer: built.answer,
      hint: 'Historia'
    };
  });
}

export function generateTriviaQuestions(config: Config, rng: Rng = Math.random): Question[] {
  const type = str(config.quizType, 'geo');
  if (type === 'geo') return makeGeoQuestions(config, rng);
  if (type === 'spelling') return makeSpellingQuestions(config, rng);
  if (type === 'synonyms') {
    return makePairQuestions(
      SYNONYM_PAIRS.map((pair) => ({ word: pair.word, value: pair.synonym })),
      'sinónimo',
      config,
      rng
    );
  }
  if (type === 'antonyms') {
    return makePairQuestions(
      ANTONYM_PAIRS.map((pair) => ({ word: pair.word, value: pair.antonym })),
      'antónimo',
      config,
      rng
    );
  }
  if (type === 'science') return makeScienceQuestions(config, rng);
  if (type === 'history') return makeHistoryQuestions(config, rng);
  return [];
}

/* ───────────────────────── Cálculo ───────────────────────── */
function numericOptions(answer: number, rng: Rng, decimals = 0): { options: string[]; answerIndex: number } {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < 4 && guard < 80) {
    guard++;
    const spread = Math.max(2, Math.round(Math.abs(answer) * 0.15));
    const offset = randomInt(spread * 2 + 1, rng) - spread;
    const candidate = answer + (offset === 0 ? 1 : offset);
    if (candidate >= 0) set.add(candidate);
  }
  let guard2 = 0;
  while (set.size < 4 && guard2 < 40) {
    guard2++;
    set.add(answer + set.size * 3 + 1);
  }
  const values = shuffle([...set], rng).map((value) =>
    decimals ? String(Number(value.toFixed(decimals)).toString().replace('.', ',')) : String(value)
  );
  const correct = decimals
    ? String(Number(answer.toFixed(decimals)).toString().replace('.', ','))
    : String(answer);
  return { options: values, answerIndex: values.indexOf(correct) };
}

function randomIntBetween(min: number, max: number, rng: Rng): number {
  return min + randomInt(Math.max(1, max - min + 1), rng);
}

function arithmeticQuestion(op: string, max: number, rng: Rng): Omit<Question, 'hint'> {
  let prompt = '';
  let answer = 0;
  const actual = op === 'mixto' ? shuffle(['suma', 'resta', 'multiplicacion', 'division'], rng)[0] : op;
  if (actual === 'suma') {
    const a = randomIntBetween(1, max, rng);
    const b = randomIntBetween(1, max, rng);
    prompt = `${a} + ${b} = ?`;
    answer = a + b;
  } else if (actual === 'resta') {
    const a = randomIntBetween(2, max, rng);
    const b = randomIntBetween(1, a, rng);
    prompt = `${a} − ${b} = ?`;
    answer = a - b;
  } else if (actual === 'multiplicacion') {
    const cap = max <= 20 ? max : max <= 100 ? 12 : 15;
    const a = randomIntBetween(2, Math.min(cap, 12), rng);
    const b = randomIntBetween(2, Math.min(cap, 12), rng);
    prompt = `${a} × ${b} = ?`;
    answer = a * b;
  } else if (actual === 'division') {
    const b = randomIntBetween(2, 12, rng);
    const q = randomIntBetween(1, Math.min(12, Math.max(2, Math.floor(max / b))), rng);
    prompt = `${b * q} ÷ ${b} = ?`;
    answer = q;
  } else {
    const kind = randomInt(3, rng);
    if (kind === 0) {
      const n = randomIntBetween(2, 12, rng);
      prompt = `${n}² = ?`;
      answer = n * n;
    } else if (kind === 1) {
      const n = randomIntBetween(2, 6, rng);
      prompt = `${n}³ = ?`;
      answer = n * n * n;
    } else {
      const n = randomIntBetween(2, Math.max(10, Math.min(25, Math.floor(Math.sqrt(max)) || 10)), rng);
      prompt = `√${n * n} = ?`;
      answer = n;
    }
  }
  const built = numericOptions(answer, rng);
  return { prompt, options: built.options, answer: built.answerIndex, big: true };
}

function tableQuestion(table: number, variant: string, rng: Rng): Omit<Question, 'hint'> {
  const k = randomIntBetween(1, 12, rng);
  let prompt = '';
  let answer = 0;
  if (variant === 'inversa') {
    prompt = `${table} × ? = ${table * k}`;
    answer = k;
  } else {
    prompt = `${table} × ${k} = ?`;
    answer = table * k;
  }
  const built = numericOptions(answer, rng);
  return { prompt, options: built.options, answer: built.answerIndex, big: true };
}

function sequenceQuestion(style: string, level: number, rng: Rng): Omit<Question, 'hint'> {
  let sequence: number[] = [];
  let answer = 0;
  if (style === 'multiplicacion') {
    const start = randomIntBetween(1, 4, rng);
    const ratio = level >= 3 ? randomIntBetween(2, 3, rng) : 2;
    sequence = [start, start * ratio, start * ratio ** 2, start * ratio ** 3];
    answer = start * ratio ** 4;
  } else if (style === 'alterna') {
    const start = randomIntBetween(1, 9, rng);
    const a = randomIntBetween(2, 3 + level, rng);
    const b = randomIntBetween(2, 4 + level, rng);
    sequence = [start];
    for (let i = 1; i < 4; i++) sequence.push(sequence[i - 1] + (i % 2 === 0 ? b : a));
    answer = sequence[3] + (4 % 2 === 0 ? b : a);
  } else {
    const start = randomIntBetween(1, 15, rng);
    const step = randomIntBetween(2, 4 + level * 2, rng);
    sequence = [start, start + step, start + step * 2, start + step * 3];
    answer = start + step * 4;
  }
  const built = numericOptions(answer, rng);
  return {
    prompt: `¿Qué número sigue? ${sequence.join(', ')}, …`,
    options: built.options,
    answer: built.answerIndex,
    big: true
  };
}

export function toRoman(value: number): string {
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I']
  ];
  let remaining = value;
  let result = '';
  for (const [amount, symbol] of table) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }
  return result;
}

function romanQuestion(max: number, direction: string, rng: Rng): Omit<Question, 'hint'> {
  const value = randomIntBetween(1, max, rng);
  if (direction === 'romano') {
    const roman = toRoman(value);
    const candidates = new Set<number>([value]);
    for (const delta of [1, -1, 2, -2, 5, -5, 10, -10, 3, 4]) {
      if (value + delta > 0 && value + delta <= max + 10) candidates.add(value + delta);
    }
    const options = shuffle([...candidates], rng)
      .slice(0, 4)
      .map(String);
    return {
      prompt: `¿Qué número es ${roman}?`,
      options,
      answer: options.indexOf(String(value)),
      big: true
    };
  }
  const candidates = new Set<string>([toRoman(value)]);
  for (const delta of [1, -1, 2, -2, 5, -5, 10, -10, 3, 4]) {
    if (value + delta > 0) candidates.add(toRoman(value + delta));
  }
  const options = shuffle([...candidates], rng).slice(0, 4);
  return {
    prompt: `¿Cómo se escribe ${value} en números romanos?`,
    options,
    answer: options.indexOf(toRoman(value)),
    big: true
  };
}

function percentQuestion(level: string, variant: string, rng: Rng): Omit<Question, 'hint'> {
  const percents = level === 'facil' ? [10, 20, 50] : level === 'medio' ? [10, 20, 25, 40, 50] : [15, 25, 30, 35, 45, 60, 75];
  const percent = percents[randomInt(percents.length, rng)];
  const base = randomIntBetween(2, level === 'facil' ? 12 : level === 'medio' ? 25 : 50, rng) * 20;
  const discount = Math.round((base * percent) / 100);
  if (variant === 'descuento') {
    const answer = base - discount;
    const built = numericOptions(answer, rng);
    return {
      prompt: `Un artículo cuesta ${base} € y tiene un ${percent}% de descuento. ¿Cuánto pagas?`,
      options: built.options.map((option) => `${option} €`),
      answer: built.answerIndex,
      big: false
    };
  }
  const answer = discount;
  const built = numericOptions(answer, rng);
  return {
    prompt: `¿Cuánto es el ${percent}% de ${base}?`,
    options: built.options,
    answer: built.answerIndex,
    big: true
  };
}

export function generateMathQuestion(config: Config, rng: Rng = Math.random): Question {
  const mode = str(config.mode, 'arithmetic');
  if (mode === 'tables') {
    return { ...tableQuestion(num(config.table, 7), str(config.variant, 'directa'), rng), hint: 'Tablas' };
  }
  if (mode === 'sequences') {
    return { ...sequenceQuestion(str(config.style, 'suma'), num(config.level, 1), rng), hint: 'Secuencias' };
  }
  if (mode === 'roman') {
    return { ...romanQuestion(num(config.max, 100), str(config.direction, 'arabe'), rng), hint: 'Romanos' };
  }
  if (mode === 'percent') {
    return { ...percentQuestion(str(config.level, 'medio'), str(config.variant, 'porcentaje'), rng), hint: 'Porcentajes' };
  }
  return { ...arithmeticQuestion(str(config.op, 'mixto'), num(config.max, 100), rng), hint: 'Cálculo' };
}
