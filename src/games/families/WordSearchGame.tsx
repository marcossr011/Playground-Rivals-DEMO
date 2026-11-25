import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { WORD_THEMES } from '../../data/words';
import { normalizeText, shuffle, uid } from '../../lib/random';
import { sfx } from '../../lib/audio';
import { useCountdown, useGameReport } from '../hooks';
import { ResultOverlay } from '../../components/ResultOverlay';

interface Config {
  themeId?: string;
  size?: number;
  difficulty?: string;
  seconds?: number;
}

interface Placement {
  word: string;
  cells: number[];
}

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [-1, -1],
  [1, -1]
];

function buildBoard(words: string[], size: number) {
  const grid: string[] = Array(size * size).fill('');
  const placements: Placement[] = [];
  const chosen = shuffle(words.filter((word) => word.length <= size)).slice(0, Math.min(12, Math.max(8, Math.floor(size / 2) + 3)));
  for (const raw of chosen) {
    const word = raw;
    for (let attempt = 0; attempt < 80; attempt++) {
      const [dx, dy] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      const endRow = row + dy * (word.length - 1);
      const endCol = col + dx * (word.length - 1);
      if (endRow < 0 || endCol < 0 || endRow >= size || endCol >= size) continue;
      const cells: number[] = [];
      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const index = (row + dy * i) * size + (col + dx * i);
        const current = grid[index];
        if (current && current !== word[i]) {
          fits = false;
          break;
        }
        cells.push(index);
      }
      if (!fits) continue;
      for (let i = 0; i < word.length; i++) grid[cells[i]] = word[i];
      placements.push({ word, cells });
      break;
    }
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let index = 0; index < grid.length; index++) {
    if (!grid[index]) grid[index] = letters[Math.floor(Math.random() * 26)];
  }
  return { grid, placements };
}

export function WordSearchGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as Config;
  const theme = WORD_THEMES.find((item) => item.id === config.themeId) ?? WORD_THEMES[0];
  const size = config.size ?? 10;
  const seconds = config.seconds ?? 180;
  const [round, setRound] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [hintCells, setHintCells] = useState<number[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  const { grid, placements } = useMemo(
    () => buildBoard(theme.words.map((word) => normalizeText(word)), size),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme.id, size, round]
  );

  useEffect(() => {
    setFound([]);
    setSelected([]);
    setStart(null);
    setHintCells([]);
    setFinished(false);
    setResultOpen(false);
  }, [round]);

  const { remaining, progress } = useCountdown(seconds, !finished, round, () => {
    if (!finished && found.length < placements.length) {
      setFinished(true);
      setResultOpen(true);
      sfx.lose();
      report({ score: found.length * 80, won: false });
    }
  });

  const foundCells = useMemo(() => {
    const set = new Set<number>();
    for (const placement of placements) {
      if (found.includes(placement.word)) placement.cells.forEach((cell) => set.add(cell));
    }
    return set;
  }, [placements, found]);

  useEffect(() => {
    if (!finished && placements.length && found.length === placements.length) {
      setFinished(true);
      setResultOpen(true);
      sfx.win();
      report({ score: Math.round(placements.length * 100 + remaining * 2), won: true });
    }
  }, [found, placements, finished, remaining, report]);

  const selectCell = (index: number) => {
    if (finished) return;
    sfx.tap();
    if (start === null) {
      setStart(index);
      setSelected([index]);
      return;
    }
    const row = Math.floor(start / size);
    const col = start % size;
    const row2 = Math.floor(index / size);
    const col2 = index % size;
    const dRow = Math.sign(row2 - row);
    const dCol = Math.sign(col2 - col);
    if (!((dRow === 0 || dCol === 0 || Math.abs(row2 - row) === Math.abs(col2 - col)) && (row !== row2 || col !== col2))) {
      setStart(index);
      setSelected([index]);
      return;
    }
    const length = Math.max(Math.abs(row2 - row), Math.abs(col2 - col)) + 1;
    const cells: number[] = [];
    for (let i = 0; i < length; i++) cells.push((row + dRow * i) * size + (col + dCol * i));
    const word = cells.map((cell) => grid[cell]).join('');
    const reversed = [...cells].reverse().map((cell) => grid[cell]).join('');
    const match = placements.find(
      (placement) => !found.includes(placement.word) && (placement.word === word || placement.word === reversed)
    );
    setSelected(cells);
    setStart(null);
    if (match) {
      sfx.match();
      setFound((current) => [...current, match.word]);
      setHintCells([]);
    } else {
      sfx.error();
      window.setTimeout(() => setSelected([]), 350);
    }
  };

  const showHint = () => {
    const pending = placements.find((placement) => !found.includes(placement.word));
    if (!pending) return;
    setHintCells(pending.cells);
    window.setTimeout(() => setHintCells([]), 1800);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🔎 {found.length}/{placements.length}</span>
        <span className={`hud-chip ${remaining < 20 ? 'is-danger' : ''}`}>⏱️ {Math.ceil(remaining)} s</span>
        <button type="button" className="chip tiny" onClick={showHint}>
          💡 Pista
        </button>
      </div>
      <div className="meter">
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="wordsearch-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {grid.map((letter, index) => (
          <button
            key={`${round}-${index}`}
            type="button"
            className={`ws-cell ${selected.includes(index) ? 'is-selected' : ''} ${
              foundCells.has(index) ? 'is-found' : ''
            } ${hintCells.includes(index) ? 'is-hint' : ''}`}
            onClick={() => selectCell(index)}
            aria-label={`Letra ${letter}`}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="word-list">
        {placements.map((placement) => (
          <span key={placement.word} className={`word-pill ${found.includes(placement.word) ? 'is-found' : ''}`}>
            {placement.word}
          </span>
        ))}
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={() => { resetReport(); setRound((current) => current + 1); }}>
          Otra cuadrícula
        </button>
      </div>
      <p className="engine-tip">Toca la primera letra y luego la última. La palabra puede estar en horizontal, vertical o diagonal.</p>

      <ResultOverlay
        open={resultOpen}
        emoji={found.length === placements.length ? '🥳' : '⏳'}
        title={found.length === placements.length ? '¡Sopa resuelta!' : 'Se acabó el tiempo'}
        subtitle={`${found.length} de ${placements.length} palabras`}
        score={found.length === placements.length ? Math.round(placements.length * 100 + remaining * 2) : found.length * 80}
        onRetry={() => {
          resetReport();
          setFound([]);
          setSelected([]);
          setStart(null);
          setHintCells([]);
          setFinished(false);
          setResultOpen(false);
          setRound((current) => current + 1);
        }}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
