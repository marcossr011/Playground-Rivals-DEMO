import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { MEMORY_THEMES } from '../../data/memoryThemes';
import { sample, shuffle, uid } from '../../lib/random';
import { sfx, vibrate } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { useGameReport, useStopwatch } from '../hooks';
import { formatClock } from '../../lib/random';

interface MemoryCard {
  id: string;
  item: string;
  matched: boolean;
}

interface Config {
  themeId?: string;
  cols?: number;
  rows?: number;
  mode?: string;
}

export function MemoryGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as Config;
  const cols = config.cols ?? 4;
  const rows = config.rows ?? 4;
  const mode = config.mode === 'trios' ? 'trios' : 'pairs';
  const groupSize = mode === 'trios' ? 3 : 2;
  const theme = MEMORY_THEMES.find((item) => item.id === config.themeId) ?? MEMORY_THEMES[0];
  const [round, setRound] = useState(0);
  const [twoPlayers, setTwoPlayers] = useState(false);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [scores, setScores] = useState({ one: 0, two: 0 });
  const [turn, setTurn] = useState<1 | 2>(1);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const seconds = useStopwatch(!done, round);
  const total = cols * rows;

  useEffect(() => {
    const groups = Math.floor(total / groupSize);
    const items = sample(theme.items, groups);
    const deck: MemoryCard[] = [];
    for (const item of items) {
      for (let copy = 0; copy < groupSize; copy++) deck.push({ id: uid('c'), item, matched: false });
    }
    while (deck.length < total) deck.push({ id: uid('c'), item: theme.items[deck.length % theme.items.length], matched: false });
    setCards(shuffle(deck).slice(0, total));
    setFlipped([]);
    setAttempts(0);
    setScores({ one: 0, two: 0 });
    setTurn(1);
    setDone(false);
    setResultOpen(false);
  }, [round, total, groupSize, theme]);

  useEffect(() => {
    if (flipped.length < groupSize) return;
    const chosen = flipped.map((index) => cards[index]);
    const isMatch = chosen.every((card) => card.item === chosen[0].item);
    const timer = window.setTimeout(
      () => {
        if (isMatch) {
          setCards((current) =>
            current.map((card, index) => (flipped.includes(index) ? { ...card, matched: true } : card))
          );
          setScores((current) => ({
            ...current,
            [turn === 1 ? 'one' : 'two']: current[turn === 1 ? 'one' : 'two'] + 1
          }));
          sfx.match();
          vibrate(20);
        } else {
          setScores((current) => current);
          if (twoPlayers) setTurn((current) => (current === 1 ? 2 : 1));
        }
        setFlipped([]);
        setAttempts((current) => current + 1);
      },
      isMatch ? 380 : 820
    );
    return () => window.clearTimeout(timer);
  }, [flipped, cards, groupSize, turn, twoPlayers]);

  useEffect(() => {
    if (!done && cards.length && cards.every((card) => card.matched)) {
      const score = scores.one + scores.two;
      const finalScore = Math.max(20, Math.round(score * 100 - attempts * 6 - seconds * 2));
      setDone(true);
      setResultOpen(true);
      sfx.win();
      report({ score: finalScore, won: true });
    }
  }, [cards, done, scores, attempts, seconds, report]);

  const takeTurn = (index: number) => {
    if (done || flipped.includes(index) || cards[index]?.matched || flipped.length >= groupSize) return;
    sfx.tap();
    setFlipped((current) => [...current, index]);
  };

  const winnerText = twoPlayers
    ? scores.one === scores.two
      ? 'Empate'
      : scores.one > scores.two
        ? 'Gana el jugador 1'
        : 'Gana el jugador 2'
    : '¡Tablero completado!';

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">👣 Intentos {attempts}</span>
        <span className="hud-chip">⏱️ {formatClock(seconds)}</span>
        <span className="hud-chip">✅ {cards.filter((card) => card.matched).length / groupSize}/{Math.floor(total / groupSize)}</span>
        {meta.modes.includes('local') ? (
          <button
            type="button"
            className={`chip tiny ${twoPlayers ? 'active' : ''}`}
            onClick={() => {
              setTwoPlayers((current) => !current);
              setRound((current) => current + 1);
            }}
          >
            👥 2 jugadores
          </button>
        ) : null}
      </div>

      {twoPlayers ? (
        <div className="memory-turn">
          <span className={turn === 1 ? 'active' : ''}>J1 · {scores.one}</span>
          <span className={turn === 2 ? 'active' : ''}>J2 · {scores.two}</span>
        </div>
      ) : null}

      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cards.map((card, index) => {
          const visible = card.matched || flipped.includes(index);
          return (
            <button
              key={card.id}
              type="button"
              className={`memory-card ${visible ? 'is-visible' : ''} ${card.matched ? 'is-matched' : ''}`}
              onClick={() => takeTurn(index)}
              aria-label={visible ? card.item : 'Carta boca abajo'}
            >
              <span>{visible ? card.item : '✦'}</span>
            </button>
          );
        })}
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setRound((current) => current + 1)}>
          Nueva partida
        </button>
      </div>

      <p className="engine-tip">
        {twoPlayers
          ? 'Encuentra parejas y pasa el turno si fallas. Cada acierto suma un punto.'
          : `Encuentra todos los ${mode === 'trios' ? 'tríos' : 'pares'} de ${theme.name.toLowerCase()} con el menor número de intentos.`}
      </p>

      <ResultOverlay
        open={resultOpen}
        emoji={twoPlayers ? '🏆' : '🧠'}
        title={winnerText}
        subtitle={`${attempts} intentos · ${formatClock(seconds)}`}
        score={twoPlayers ? undefined : Math.max(20, Math.round(scores.one * 100 - attempts * 6 - seconds * 2))}
        extra={
          twoPlayers ? (
            <div className="result-table">
              <span>Jugador 1 · {scores.one} puntos</span>
              <span>Jugador 2 · {scores.two} puntos</span>
            </div>
          ) : null
        }
        onRetry={() => { resetReport(); setRound((current) => current + 1); }}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
