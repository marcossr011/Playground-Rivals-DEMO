import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { isRed, makeDeck, rankLabel, shuffleDeck, type Card } from '../../lib/deck';
import { formatClock } from '../../lib/random';
import { sfx } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { useCountdown, useGameReport, useStopwatch } from '../hooks';

type KCard = Card & { up: boolean };

function CardFace({ card, small = false }: { card: KCard; small?: boolean }) {
  return (
    <span className={`pcard ${isRed(card) ? 'is-red' : 'is-black'} ${small ? 'is-small' : ''}`}>
      <span className="pcard-rank">{rankLabel(card.rank)}</span>
      <span className="pcard-suit">{card.suit}</span>
    </span>
  );
}

function CardBack({ small = false }: { small?: boolean }) {
  return <span className={`pcard is-back ${small ? 'is-small' : ''}`} aria-label="Carta boca abajo">✦</span>;
}

/* ───────────────────────────── Klondike ───────────────────────────── */

interface KlondikeState {
  stock: KCard[];
  waste: KCard[];
  tableau: KCard[][];
  foundations: KCard[][];
}

type KlondikeSource = { type: 'waste' } | { type: 'tableau'; pile: number; index: number };

function dealKlondike(): KlondikeState {
  const deck: KCard[] = shuffleDeck(makeDeck()).map((card) => ({ ...card, up: false }));
  const tableau: KCard[][] = [];
  let cursor = 0;
  for (let pile = 0; pile < 7; pile++) {
    const cards: KCard[] = [];
    for (let row = 0; row <= pile; row++) {
      const card = deck[cursor++];
      cards.push({ ...card, up: row === pile });
    }
    tableau.push(cards);
  }
  return {
    stock: deck.slice(cursor).map((card) => ({ ...card, up: false })),
    waste: [],
    tableau,
    foundations: [[], [], [], []]
  };
}

function foundationIndexFor(suit: Card['suit']): number {
  return ['♠', '♥', '♦', '♣'].indexOf(suit);
}

export function KlondikeGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { draw?: number; timed?: boolean; vegas?: boolean };
  const drawCount = config.draw === 3 ? 3 : 1;
  const timed = Boolean(config.timed);
  const [round, setRound] = useState(0);
  const [state, setState] = useState<KlondikeState>(() => dealKlondike());
  const [selected, setSelected] = useState<KlondikeSource | null>(null);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [won, setWon] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const stopwatch = useStopwatch(!done, round);
  const { remaining } = useCountdown(300, timed && !done, round, () => {
    if (done) return;
    setDone(true);
    setWon(false);
    setResultOpen(true);
    sfx.alarm();
    report({ score: 120, won: false });
  });

  const selectedCard = useMemo(() => {
    if (!selected) return null;
    if (selected.type === 'waste') return state.waste[state.waste.length - 1] ?? null;
    return state.tableau[selected.pile]?.[selected.index] ?? null;
  }, [selected, state]);

  const canToFoundation = (card: KCard | null, foundation: number): boolean => {
    if (!card) return false;
    if (foundationIndexFor(card.suit) !== foundation) return false;
    return state.foundations[foundation].length === card.rank - 1;
  };

  const canToTableau = (card: KCard | null, pile: number): boolean => {
    if (!card) return false;
    const target = state.tableau[pile];
    if (!target.length) return card.rank === 13;
    const top = target[target.length - 1];
    return top.up && isRed(top) !== isRed(card) && top.rank === card.rank + 1;
  };

  const validRun = (pile: number, index: number): boolean => {
    const cards = state.tableau[pile];
    for (let i = index; i < cards.length; i++) {
      if (!cards[i].up) return false;
      if (i > index) {
        const prev = cards[i - 1];
        if (isRed(prev) === isRed(cards[i]) || prev.rank !== cards[i].rank + 1) return false;
      }
    }
    return true;
  };

  const finishWin = (next: KlondikeState) => {
    if (next.foundations.every((pile) => pile.length === 13)) {
      setDone(true);
      setWon(true);
      setResultOpen(true);
      sfx.win();
      const score = 500 + next.foundations.flat().length * 10 - moves * 2;
      report({ score: Math.max(100, score), won: true });
      return true;
    }
    return false;
  };

  const selectable = (source: KlondikeSource): boolean => {
    if (source.type === 'waste') return state.waste.length > 0;
    return Boolean(state.tableau[source.pile]?.[source.index]?.up) && validRun(source.pile, source.index);
  };

  const tryMoveToFoundation = (source: KlondikeSource, foundation: number) => {
    const card = source.type === 'waste' ? state.waste[state.waste.length - 1] : state.tableau[source.pile][source.index];
    if (source.type === 'tableau' && source.index !== state.tableau[source.pile].length - 1) {
      sfx.error();
      return;
    }
    if (!canToFoundation(card, foundation)) {
      sfx.error();
      return;
    }
    const next: KlondikeState = {
      ...state,
      foundations: state.foundations.map((pile, index) => (index === foundation ? [...pile, { ...card, up: true }] : pile)),
      stock: state.stock,
      waste: source.type === 'waste' ? state.waste.slice(0, -1) : state.waste,
      tableau: state.tableau.map((pile, pileIndex) => {
        if (source.type !== 'tableau' || pileIndex !== source.pile) return pile;
        const cards = pile.slice(0, source.index);
        if (cards.length && !cards[cards.length - 1].up) cards[cards.length - 1] = { ...cards[cards.length - 1], up: true };
        return cards;
      })
    };
    setState(next);
    setSelected(null);
    setMoves((value) => value + 1);
    sfx.match();
    finishWin(next);
  };

  const tryMoveToTableau = (source: KlondikeSource, pile: number) => {
    if (source.type === 'tableau' && source.pile === pile) {
      setSelected(null);
      return;
    }
    const card = source.type === 'waste' ? state.waste[state.waste.length - 1] : state.tableau[source.pile][source.index];
    if (!canToTableau(card, pile)) {
      sfx.error();
      return;
    }
    const moving = source.type === 'waste' ? [{ ...card, up: true }] : state.tableau[source.pile].slice(source.index);
    const next: KlondikeState = {
      ...state,
      stock: state.stock,
      waste: source.type === 'waste' ? state.waste.slice(0, -1) : state.waste,
      foundations: state.foundations,
      tableau: state.tableau.map((cards, index) => {
        if (index === pile) return [...cards, ...moving];
        if (source.type === 'tableau' && index === source.pile) {
          const left = cards.slice(0, source.index);
          if (left.length && !left[left.length - 1].up) left[left.length - 1] = { ...left[left.length - 1], up: true };
          return left;
        }
        return cards;
      })
    };
    setState(next);
    setSelected(null);
    setMoves((value) => value + 1);
    sfx.tap();
    finishWin(next);
  };

  const clickCard = (source: KlondikeSource) => {
    const cards = source.type === 'waste' ? state.waste : state.tableau[source.pile];
    const card = source.type === 'waste' ? cards[cards.length - 1] : cards[source.index];
    if (!card) return;
    if (!card.up) {
      if (source.type === 'tableau' && source.index === cards.length - 1) {
        setState((current) => ({
          ...current,
          tableau: current.tableau.map((pile, index) =>
            index === source.pile ? pile.map((item, itemIndex) => (itemIndex === source.index ? { ...item, up: true } : item)) : pile
          )
        }));
        sfx.select();
      }
      return;
    }
    if (selected && selected.type === 'tableau' && source.type === 'tableau' && selected.pile === source.pile && selected.index === source.index) {
      for (let foundation = 0; foundation < 4; foundation++) {
        if (canToFoundation(card, foundation)) {
          tryMoveToFoundation(source, foundation);
          return;
        }
      }
      setSelected(null);
      return;
    }
    if (!selectable(source)) {
      sfx.error();
      return;
    }
    setSelected(source);
    sfx.select();
  };

  const draw = () => {
    if (done) return;
    if (!state.stock.length) {
      if (!state.waste.length) return;
      setState({
        ...state,
        stock: state.waste
          .slice()
          .reverse()
          .map((card) => ({ ...card, up: false })),
        waste: []
      });
      setSelected(null);
      sfx.tap();
      return;
    }
    const count = Math.min(drawCount, state.stock.length);
    const drawn = state.stock.slice(-count).map((card) => ({ ...card, up: true }));
    setState({ ...state, stock: state.stock.slice(0, -count), waste: [...state.waste, ...drawn] });
    setSelected(null);
    sfx.tap();
  };

  const autoFoundation = () => {
    const tops: KlondikeSource[] = [];
    if (state.waste.length) tops.push({ type: 'waste' });
    state.tableau.forEach((pile, pileIndex) => {
      const index = pile.length - 1;
      if (index >= 0 && pile[index].up) tops.push({ type: 'tableau', pile: pileIndex, index });
    });
    for (const source of tops) {
      const card = source.type === 'waste' ? state.waste[state.waste.length - 1] : state.tableau[source.pile][source.index];
      for (let foundation = 0; foundation < 4; foundation++) {
        if (canToFoundation(card, foundation)) {
          tryMoveToFoundation(source, foundation);
          return;
        }
      }
    }
    sfx.error();
  };

  const restart = () => {
    resetReport();
    setState(dealKlondike());
    setSelected(null);
    setMoves(0);
    setDone(false);
    setWon(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  const foundationCard = (index: number) => state.foundations[index][state.foundations[index].length - 1] ?? null;
  const selectedCardRank = selectedCard ? rankLabel(selectedCard.rank) : '';

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🃏 {state.stock.length}</span>
        <span className="hud-chip">👣 {moves}</span>
        <span className="hud-chip">⏱️ {timed ? `${Math.ceil(remaining)} s` : formatClock(stopwatch)}</span>
        <button type="button" className="chip tiny" onClick={autoFoundation}>✨ Auto</button>
      </div>

      <div className="solitaire-top">
        <button type="button" className={`pile stock ${state.stock.length ? '' : 'is-empty'}`} onClick={draw} aria-label="Robar del mazo">
          {state.stock.length ? <CardBack /> : <span className="pile-empty">↻</span>}
        </button>
        <button
          type="button"
          className={`pile waste ${selected?.type === 'waste' ? 'is-selected' : ''}`}
          onClick={() => state.waste.length && clickCard({ type: 'waste' })}
          aria-label="Pila de descartes"
        >
          {state.waste.length ? <CardFace card={state.waste[state.waste.length - 1]} /> : <span className="pile-empty">·</span>}
        </button>
        <div className="solitaire-spacer" />
        {state.foundations.map((pile, index) => {
          const top = foundationCard(index);
          const target =
            selected &&
            (selected.type === 'waste' || selected.index === state.tableau[selected.pile].length - 1) &&
            canToFoundation(selectedCard, index);
          return (
            <button
              key={index}
              type="button"
              className={`pile foundation ${target ? 'is-target' : ''} ${selected?.type === 'waste' || selected?.type === 'tableau' ? '' : ''}`}
              onClick={() => selected && tryMoveToFoundation(selected, index)}
              aria-label={`Fundación ${index + 1}`}
            >
              {top ? <CardFace card={top} /> : <span className="pile-empty">{['♠', '♥', '♦', '♣'][index]}</span>}
            </button>
          );
        })}
      </div>

      <div className="solitaire-tableau">
        {state.tableau.map((pile, pileIndex) => {
          const target = selected && canToTableau(selectedCard, pileIndex);
          return (
            <button
              key={pileIndex}
              type="button"
              className={`tableau-col ${target ? 'is-target' : ''}`}
              onClick={() => selected && tryMoveToTableau(selected, pileIndex)}
              aria-label={`Columna ${pileIndex + 1}`}
            >
              {pile.length === 0 ? <span className="pile-empty">K</span> : null}
              {pile.map((card, index) =>
                card.up ? (
                  <span
                    key={card.id}
                    className="tableau-card"
                    onClick={(event) => {
                      event.stopPropagation();
                      clickCard({ type: 'tableau', pile: pileIndex, index });
                    }}
                  >
                    <span className={`pcard ${isRed(card) ? 'is-red' : 'is-black'} ${
                      selected?.type === 'tableau' && selected.pile === pileIndex && selected.index === index ? 'is-selected' : ''
                    }`}>
                      <span className="pcard-rank">{rankLabel(card.rank)}</span>
                      <span className="pcard-suit">{card.suit}</span>
                    </span>
                  </span>
                ) : (
                  <span
                    key={card.id}
                    className="tableau-card"
                    onClick={(event) => {
                      event.stopPropagation();
                      clickCard({ type: 'tableau', pile: pileIndex, index });
                    }}
                  >
                    <CardBack />
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      {selected ? (
        <p className="engine-tip is-active-tip">
          Seleccionada {selectedCardRank} · toca una columna o fundación iluminada. Toca la misma carta para enviarla a su fundación.
        </p>
      ) : (
        <p className="engine-tip">Toca el mazo para robar. Toca una carta y luego otra columna o fundación para moverla. Los reyes van a columnas vacías.</p>
      )}

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Nueva partida</button>
      </div>

      <ResultOverlay
        open={resultOpen}
        emoji={won ? '🃏' : '⏳'}
        title={won ? '¡Solitario resuelto!' : 'Se acabó el tiempo'}
        subtitle={`${moves} movimientos · ${formatClock(stopwatch)}`}
        score={won ? Math.max(100, 500 + 520 - moves * 2) : 120}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Pirámide ───────────────────────────── */

interface PyramidState {
  pyramid: (Card | null)[];
  stock: Card[];
  waste: Card[];
  redeals: number;
}

function pyramidIndexes(): { row: number; pos: number; index: number }[] {
  const list: { row: number; pos: number; index: number }[] = [];
  for (let row = 0; row < 7; row++) {
    for (let pos = 0; pos <= row; pos++) list.push({ row, pos, index: (row * (row + 1)) / 2 + pos });
  }
  return list;
}

function dealPyramid(redeals: number): PyramidState {
  const deck = shuffleDeck(makeDeck());
  return { pyramid: deck.slice(0, 28), stock: deck.slice(28), waste: [], redeals };
}

function pyramidValue(card: Card): number {
  return card.rank;
}

export function PyramidGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { draw?: number; redeals?: number };
  const drawCount = config.draw === 3 ? 3 : 1;
  const [round, setRound] = useState(0);
  const [state, setState] = useState<PyramidState>(() => dealPyramid(config.redeals ?? 0));
  const [selected, setSelected] = useState<number | 'waste' | null>(null);
  const [removed, setRemoved] = useState(0);
  const [done, setDone] = useState(false);
  const [won, setWon] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const seconds = useStopwatch(!done, round);

  const covered = (index: number): boolean => {
    const positions = pyramidIndexes();
    const { row, pos } = positions[index];
    if (row === 6) return false;
    const belowStart = ((row + 1) * (row + 2)) / 2;
    return Boolean(state.pyramid[belowStart + pos] || state.pyramid[belowStart + pos + 1]);
  };

  const availableMoves = (current: PyramidState): boolean => {
    const positions = pyramidIndexes();
    const leftovers: number[] = [];
    for (const { index, row, pos } of positions) {
      if (!current.pyramid[index]) continue;
      const belowStart = ((row + 1) * (row + 2)) / 2;
      const isCovered = row < 6 && Boolean(current.pyramid[belowStart + pos] || current.pyramid[belowStart + pos + 1]);
      if (!isCovered) leftovers.push(pyramidValue(current.pyramid[index] as Card));
    }
    if (current.waste.length) leftovers.push(pyramidValue(current.waste[current.waste.length - 1]));
    for (let i = 0; i < leftovers.length; i++) {
      if (leftovers[i] === 13) return true;
      for (let j = i + 1; j < leftovers.length; j++) {
        if (leftovers[i] + leftovers[j] === 13) return true;
      }
    }
    return false;
  };

  const finish = (next: PyramidState, nextRemoved: number) => {
    if (next.pyramid.every((card) => card === null)) {
      setDone(true);
      setWon(true);
      setResultOpen(true);
      sfx.win();
      report({ score: 400 + nextRemoved * 15, won: true });
      return true;
    }
    if (!next.stock.length && next.redeals === 0 && !availableMoves(next)) {
      setDone(true);
      setWon(false);
      setResultOpen(true);
      sfx.lose();
      report({ score: nextRemoved * 15, won: false });
      return true;
    }
    return false;
  };

  const removeCards = (first: number | 'waste', second?: number | 'waste') => {
    const next: PyramidState = {
      ...state,
      pyramid: [...state.pyramid],
      waste: [...state.waste]
    };
    const take = (slot: number | 'waste') => {
      if (slot === 'waste') return next.waste.pop() ?? null;
      const card = next.pyramid[slot];
      next.pyramid[slot] = null;
      return card;
    };
    take(first);
    if (second !== undefined) take(second);
    const count = second !== undefined ? 2 : 1;
    setState(next);
    setSelected(null);
    setRemoved((value) => value + count);
    sfx.match();
    finish(next, removed + count);
  };

  const choose = (slot: number | 'waste') => {
    if (done) return;
    const card = slot === 'waste' ? state.waste[state.waste.length - 1] : state.pyramid[slot];
    if (!card) return;
    if (slot !== 'waste' && covered(slot)) {
      sfx.error();
      return;
    }
    if (selected === null) {
      if (card.rank === 13) {
        removeCards(slot);
        return;
      }
      setSelected(slot);
      sfx.select();
      return;
    }
    if (selected === slot) {
      setSelected(null);
      return;
    }
    const firstCard = selected === 'waste' ? state.waste[state.waste.length - 1] : state.pyramid[selected];
    if (!firstCard) {
      setSelected(slot);
      return;
    }
    if (pyramidValue(firstCard) + pyramidValue(card) === 13) {
      removeCards(selected, slot);
      return;
    }
    sfx.error();
    if (card.rank === 13) {
      removeCards(slot);
      return;
    }
    setSelected(slot);
  };

  const draw = () => {
    if (done) return;
    if (state.stock.length) {
      const count = Math.min(drawCount, state.stock.length);
      const next: PyramidState = {
        ...state,
        stock: state.stock.slice(0, -count),
        waste: [...state.waste, ...state.stock.slice(-count)]
      };
      setState(next);
      setSelected(null);
      sfx.tap();
      window.setTimeout(() => {
        if (!next.stock.length && next.redeals === 0 && !availableMoves(next)) {
          setDone(true);
          setWon(false);
          setResultOpen(true);
          sfx.lose();
          report({ score: removed * 15, won: false });
        }
      }, 300);
      return;
    }
    if (state.redeals > 0 && state.waste.length) {
      setState({ ...state, stock: state.waste.slice().reverse(), waste: [], redeals: state.redeals - 1 });
      setSelected(null);
      sfx.select();
      return;
    }
    sfx.error();
  };

  const restart = () => {
    resetReport();
    setState(dealPyramid(config.redeals ?? 0));
    setSelected(null);
    setRemoved(0);
    setDone(false);
    setWon(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  const positions = pyramidIndexes();
  const selectedCard = selected === null ? null : selected === 'waste' ? state.waste[state.waste.length - 1] : state.pyramid[selected];

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🃏 {state.stock.length}</span>
        <span className="hud-chip">↻ {state.redeals}</span>
        <span className="hud-chip">✅ {removed}/28</span>
        <span className="hud-chip">⏱️ {formatClock(seconds)}</span>
      </div>

      <div className="pyramid-board">
        <div className="pyramid-rows">
          {Array.from({ length: 7 }).map((_, row) => (
            <div className="pyramid-row" key={row}>
              {positions
                .filter((position) => position.row === row)
                .map(({ index }) => {
                  const card = state.pyramid[index];
                  if (!card) return <span key={index} className="pyramid-slot" />;
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`pyramid-card ${covered(index) ? 'is-covered' : ''} ${selected === index ? 'is-selected' : ''}`}
                      onClick={() => choose(index)}
                    >
                      <CardFace card={{ ...card, up: true }} small />
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <div className="pyramid-bottom">
        <button type="button" className="pile stock" onClick={draw} aria-label="Robar carta">
          {state.stock.length ? <CardBack /> : <span className="pile-empty">↻</span>}
        </button>
        <button
          type="button"
          className={`pile waste ${selected === 'waste' ? 'is-selected' : ''}`}
          onClick={() => choose('waste')}
          aria-label="Descarte"
        >
          {state.waste.length ? <CardFace card={{ ...state.waste[state.waste.length - 1], up: true }} /> : <span className="pile-empty">·</span>}
        </button>
        <div className="pyramid-bottom-info">
          <p className="faint">Retira parejas que sumen 13. Los reyes se retiran solos.</p>
          {selectedCard ? <p className="engine-tip is-active-tip">Seleccionada: {rankLabel(selectedCard.rank)} {selectedCard.suit}</p> : null}
        </div>
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Nueva partida</button>
      </div>

      <ResultOverlay
        open={resultOpen}
        emoji={won ? '🔺' : '🫥'}
        title={won ? '¡Pirámide despejada!' : 'No quedan movimientos'}
        subtitle={`${removed} cartas retiradas · ${formatClock(seconds)}`}
        score={won ? 400 + removed * 15 : removed * 15}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
