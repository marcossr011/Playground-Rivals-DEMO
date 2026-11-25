import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { blackjackValue, handTotal, isRed, makeDeck, rankLabel, shuffleDeck, type Card } from '../../lib/deck';
import { shuffle } from '../../lib/random';
import { sfx } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { useGameReport } from '../hooks';

/* ───────────────────────────── Blackjack ───────────────────────────── */

type BjPhase = 'playing' | 'done';

interface BjState {
  shoe: Card[];
  player: Card[];
  dealer: Card[];
  phase: BjPhase;
  chips: number;
  bet: number;
  message: string;
  reveal: boolean;
  wins: number;
  losses: number;
}

function buildShoe(decks: number): Card[] {
  return shuffleDeck(makeDeck(decks));
}

function drawCard(shoe: Card[], decks: number): { card: Card; shoe: Card[] } {
  let source = shoe;
  if (!source.length) source = buildShoe(decks);
  return { card: source[source.length - 1], shoe: source.slice(0, -1) };
}

function dealBlackjack(chips: number, bet: number, decks: number): BjState {  let shoe = buildShoe(decks);
  const player: Card[] = [];
  const dealer: Card[] = [];
  for (let i = 0; i < 2; i++) {
    const first = drawCard(shoe, decks);
    player.push(first.card);
    shoe = first.shoe;
    const second = drawCard(shoe, decks);
    dealer.push(second.card);
    shoe = second.shoe;
  }
  return {
    shoe,
    player,
    dealer,
    phase: 'playing',
    chips: chips - bet,
    bet,
    message: 'Tu turno: pide o plántate',
    reveal: false,
    wins: 0,
    losses: 0
  };
}

function ButtonCard({ card, hidden }: { card: Card; hidden?: boolean }) {
  if (hidden) {
    return <span className="bj-card is-back">✦</span>;
  }
  return (
    <span className={`bj-card ${isRed(card) ? 'is-red' : 'is-black'}`}>
      <span>{rankLabel(card.rank)}</span>
      <span>{card.suit}</span>
    </span>
  );
}

export function BlackjackGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { decks?: number; soft17?: boolean };
  const decks = config.decks ?? 1;
  const soft17 = config.soft17 ?? true;
  const BET = 10;
  const [round, setRound] = useState(0);
  const [game, setGame] = useState<BjState>(() => dealBlackjack(100, BET, decks));
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  const settle = (state: BjState, outcome: 'win' | 'lose' | 'push' | 'blackjack'): BjState => {
    const delta = outcome === 'win' ? state.bet : outcome === 'blackjack' ? Math.round(state.bet * 1.5) : outcome === 'push' ? state.bet : 0;
    const chips = state.chips + delta;
    const message =
      outcome === 'win'
        ? '¡Ganas la mano!'
        : outcome === 'blackjack'
          ? '¡Blackjack! Pago 3:2'
          : outcome === 'push'
            ? 'Empate: recuperas tu apuesta'
            : 'La banca gana esta mano';
    return {
      ...state,
      chips,
      message,
      phase: 'done',
      reveal: true,
      wins: state.wins + (outcome === 'win' || outcome === 'blackjack' ? 1 : 0),
      losses: state.losses + (outcome === 'lose' ? 1 : 0)
    };
  };

  const hit = () => {
    if (game.phase !== 'playing') return;
    const drawn = drawCard(game.shoe, decks);
    const player = [...game.player, drawn.card];
    sfx.tap();
    if (handTotal(player).total > 21) {
      sfx.lose();
      setGame(settle({ ...game, player, shoe: drawn.shoe }, 'lose'));
    } else {
      setGame({ ...game, player, shoe: drawn.shoe });
    }
  };

  const stand = () => {
    if (game.phase !== 'playing') return;
    let shoe = game.shoe;
    const dealer = [...game.dealer];
    let guard = 0;
    while (guard < 12) {
      guard++;
      const total = handTotal(dealer);
      const mustHit = total.total < 17 || (total.total === 17 && total.soft && !soft17);
      if (!mustHit) break;
      const drawn = drawCard(shoe, decks);
      dealer.push(drawn.card);
      shoe = drawn.shoe;
    }
    const player = handTotal(game.player).total;
    const house = handTotal(dealer).total;
    const outcome = house > 21 || player > house ? 'win' : player === house ? 'push' : 'lose';
    sfx[outcome === 'lose' ? 'lose' : 'win']();
    setGame(settle({ ...game, dealer, shoe }, outcome));
  };

  const double = () => {
    if (game.phase !== 'playing' || game.player.length !== 2 || game.chips < game.bet) return;
    const drawn = drawCard(game.shoe, decks);
    const player = [...game.player, drawn.card];
    const base: BjState = { ...game, player, shoe: drawn.shoe, chips: game.chips - game.bet, bet: game.bet * 2 };
    if (handTotal(player).total > 21) {
      sfx.lose();
      setGame(settle(base, 'lose'));
      return;
    }
    let shoe = base.shoe;
    const dealer = [...base.dealer];
    for (let guard = 0; guard < 12; guard++) {
      const total = handTotal(dealer);
      if (!(total.total < 17 || (total.total === 17 && total.soft && !soft17))) break;
      const next = drawCard(shoe, decks);
      dealer.push(next.card);
      shoe = next.shoe;
    }
    const outcome = handTotal(dealer).total > 21 || handTotal(player).total > handTotal(dealer).total ? 'win' : handTotal(player).total === handTotal(dealer).total ? 'push' : 'lose';
    setGame(settle({ ...base, dealer, shoe }, outcome));
    sfx[outcome === 'lose' ? 'lose' : 'win']();
  };

  const nextHand = () => {
    if (game.chips < BET) {
      setResultOpen(true);
      sfx.lose();
      report({ score: game.chips, won: game.chips > 100 });
      return;
    }
    setGame(dealBlackjack(game.chips, BET, decks));
  };

  const restart = () => {
    resetReport();
    setGame(dealBlackjack(100, BET, decks));
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  useEffect(() => {
    if (game.phase === 'done' && game.chips < BET && !resultOpen) {
      const timer = window.setTimeout(() => {
        setResultOpen(true);
        report({ score: game.chips, won: game.chips > 100 });
      }, 900);
      return () => window.clearTimeout(timer);
    }
  }, [game, resultOpen, report]);

  const playerTotal = handTotal(game.player);
  const dealerTotal = handTotal(game.dealer);

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">💰 {game.chips}</span>
        <span className="hud-chip">🎯 Apuesta {BET}</span>
        <span className="hud-chip">🏆 {game.wins} · {game.losses}</span>
      </div>

      <div className="bj-table">
        <div className="bj-side">
          <p className={`bj-total ${revealClass(game.reveal, dealerTotal.total)}`}>
            Banca {game.reveal ? dealerTotal.total : `· ${blackjackValue(game.dealer[0]?.rank ?? 1)} + ?`}
          </p>
          <div className="bj-hand">
            {game.dealer.map((card, index) => (
              <ButtonCard key={card.id} card={card} hidden={!game.reveal && index === 1} />
            ))}
          </div>
        </div>
        <div className="bj-side">
          <p className={`bj-total ${revealClass(true, playerTotal.total)}`}>Tú {playerTotal.total}{playerTotal.soft ? ' · suave' : ''}</p>
          <div className="bj-hand">
            {game.player.map((card) => (
              <ButtonCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      </div>

      <p className={`bj-message ${game.phase === 'done' ? 'is-done' : ''}`}>{game.message}</p>

      <div className="game-actions">
        {game.phase === 'playing' ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={hit}>Pedir</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stand}>Plantarse</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={double} disabled={game.player.length !== 2 || game.chips < game.bet}>
              Doblar
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={nextHand}>
            Siguiente mano
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>Reiniciar</button>
      </div>

      <p className="engine-tip">
        {decks} {decks === 1 ? 'baraja' : 'barajas'} · la banca {soft17 ? 'se planta con 17 suave' : 'pide con 17 suave'}. Apuesta fija de {BET} fichas.
      </p>

      <ResultOverlay
        open={resultOpen}
        emoji="♠️"
        title="Te quedaste sin fichas"
        subtitle={`Ganaste ${game.wins} manos y perdiste ${game.losses}`}
        score={game.chips}
        scoreLabel="fichas"
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

function revealClass(reveal: boolean, total: number): string {
  if (!reveal) return '';
  if (total > 21) return 'is-bust';
  if (total === 21) return 'is-blackjack';
  return '';
}

/* ───────────────────────────── Guerra de cartas ───────────────────────────── */

export function WarGame({ meta }: { meta: GameMeta }) {
  const speed = (meta.config as { speed?: number }).speed ?? 900;
  const [decks, setDecks] = useState(() => {
    const full = shuffleDeck(makeDeck());
    return { a: full.slice(0, 26), b: full.slice(26) };
  });
  const [current, setCurrent] = useState<{ a: Card; b: Card } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('Pulsa jugar para empezar la batalla');
  const [rounds, setRounds] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  const battle = () => {
    if (done) return;
    if (!decks.a.length || !decks.b.length) {
      endWar(decks.a.length > 0);
      return;
    }
    const a = [...decks.a];
    const b = [...decks.b];
    const pool: Card[] = [];
    let cardA = a.pop() as Card;
    let cardB = b.pop() as Card;
    pool.push(cardA, cardB);
    let guard = 0;
    while (cardA.rank === cardB.rank && guard < 9 && a.length && b.length) {
      guard++;
      const extraA: Card[] = [];
      const extraB: Card[] = [];
      for (let i = 0; i < 3 && a.length; i++) extraA.push(a.pop() as Card);
      for (let i = 0; i < 3 && b.length; i++) extraB.push(b.pop() as Card);
      pool.push(...extraA, ...extraB);
      if (!extraA.length || !extraB.length) break;
      cardA = extraA[extraA.length - 1];
      cardB = extraB[extraB.length - 1];
    }
    const won = cardA.rank > cardB.rank || (!b.length && a.length);
    const lose = cardB.rank > cardA.rank || (!a.length && b.length);
    const shuffledPool = shuffle(pool);
    const next = won ? { a: [...shuffledPool, ...a], b } : lose ? { a, b: [...shuffledPool, ...b] } : decks;
    setCurrent({ a: cardA, b: cardB });
    setRounds((value) => value + 1);
    setDecks(next);
    setMessage(
      won
        ? `Ganas la baza: ${rankLabel(cardA.rank)} contra ${rankLabel(cardB.rank)}`
        : lose
          ? `Baza para la banca: ${rankLabel(cardA.rank)} contra ${rankLabel(cardB.rank)}`
          : `Empate a ${rankLabel(cardA.rank)}: ¡guerra!`
    );
    if (won) sfx.select();
    else if (lose) sfx.tick();
    else sfx.alarm();
    if (!next.a.length || !next.b.length) {
      window.setTimeout(() => endWar(next.a.length > 0), 420);
    }
  };

  function endWar(playerWon: boolean) {
    if (done) return;
    setDone(true);
    setPlaying(false);
    setResultOpen(true);
    sfx[playerWon ? 'win' : 'lose']();
    report({ score: playerWon ? 400 : 60, won: playerWon });
    setMessage(playerWon ? '¡Ganaste la guerra!' : 'La banca se lleva la guerra');
  }

  useEffect(() => {
    if (!playing || done) return;
    const timer = window.setTimeout(battle, speed);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, done, speed, decks]);

  const restart = () => {
    resetReport();
    const full = shuffleDeck(makeDeck());
    setDecks({ a: full.slice(0, 26), b: full.slice(26) });
    setCurrent(null);
    setRounds(0);
    setDone(false);
    setResultOpen(false);
    setPlaying(false);
    setMessage('Pulsa jugar para empezar la batalla');
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🧑 {decks.a.length}</span>
        <span className="hud-chip">🤖 {decks.b.length}</span>
        <span className="hud-chip">🔁 {rounds}</span>
      </div>

      <div className="war-table">
        <div className="war-side">
          <span className="war-label">Tú</span>
          <div className="war-card-slot">{current ? <ButtonCard card={current.a} /> : <span className="bj-card is-placeholder">?</span>}</div>
        </div>
        <span className="war-vs">VS</span>
        <div className="war-side">
          <span className="war-label">Banca</span>
          <div className="war-card-slot">{current ? <ButtonCard card={current.b} /> : <span className="bj-card is-placeholder">?</span>}</div>
        </div>
      </div>

      <p className="bj-message">{message}</p>

      <div className="game-actions">
        <button type="button" className="btn btn-primary" onClick={() => setPlaying((value) => !value)} disabled={done}>
          {playing ? 'Pausar' : 'Jugar'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={battle} disabled={playing || done}>
          Siguiente baza
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>Reiniciar</button>
      </div>
      <p className="engine-tip">La carta más alta gana la baza. En caso de empate, se acumulan cartas y gana quien descubra la más alta en la guerra.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="⚔️"
        title={decks.a.length ? '¡Ganaste la guerra!' : 'La banca gana'}
        subtitle={`${rounds} bazas jugadas`}
        score={decks.a.length ? 400 : 60}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Mayor o menor ───────────────────────────── */

export function HigherLowerGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { deck?: string; lives?: number };
  const isCards = (config.deck ?? 'cartas') === 'cartas';
  const maxLives = config.lives ?? 3;
  const cardDeck = useMemo(() => shuffleDeck(makeDeck()), []);
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(1);
  const [lives, setLives] = useState(maxLives);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState('¿La siguiente será mayor o menor?');
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  const current = useMemo(() => {
    if (isCards) return cardDeck[(index - 1) % cardDeck.length];
    return { id: `n${index - 1}`, suit: '♠' as const, rank: (((index * 37 + round * 11) % 100) + 1) as Card['rank'] };
  }, [cardDeck, index, isCards, round]);
  const next = useMemo(() => {
    if (isCards) return cardDeck[index % cardDeck.length];
    return { id: `n${index}`, suit: '♠' as const, rank: (((index * 53 + 17 + round * 7) % 100) + 1) as Card['rank'] };
  }, [cardDeck, index, isCards, round]);

  const value = (card: Card) => (isCards ? card.rank : ((card.rank * 53) % 100) + 1);
  const display = (card: Card) => (isCards ? `${rankLabel(card.rank)}${card.suit}` : String(value(card)));

  const guess = (direction: 'mayor' | 'menor') => {
    if (done || revealed) return;
    const a = value(current);
    const b = value(next);
    const success = direction === 'mayor' ? b > a : b < a;
    const nextLives = success ? lives : lives - 1;
    setRevealed(true);
    setLives(nextLives);
    if (success) {
      sfx.match();
      const nextCorrect = correct + 1;
      setCorrect(nextCorrect);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBest((valueBest) => Math.max(valueBest, nextStreak));
      setMessage(`¡Correcto! ${isCards ? display(current) : a} → ${isCards ? display(next) : b}`);
    } else {
      sfx.error();
      setStreak(0);
      setMessage(b === a ? `Empate a ${a}: pierdes la ronda` : `Fallaste: era ${b}`);
    }
    window.setTimeout(() => {
      setRevealed(false);
      setIndex((currentIndex) => currentIndex + 1);
      setMessage('¿La siguiente será mayor o menor?');
      if (nextLives <= 0) {
        setDone(true);
        setResultOpen(true);
        sfx.lose();
        report({ score: correct * 80 + best * 20, won: false });
      }
    }, 1100);
  };

  const restart = () => {
    resetReport();
    setLives(maxLives);
    setStreak(0);
    setBest(0);
    setCorrect(0);
    setIndex(1);
    setRevealed(false);
    setDone(false);
    setResultOpen(false);
    setMessage('¿La siguiente será mayor o menor?');
    setRound((valueRound) => valueRound + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">❤️ {'▮'.repeat(Math.max(0, lives))}{'▯'.repeat(Math.max(0, maxLives - lives))}</span>
        <span className="hud-chip">🔥 {streak}</span>
        <span className="hud-chip">✅ {correct}</span>
      </div>

      <div className="hl-table">
        <div className={`hl-card ${revealed ? 'is-revealed' : ''}`}>
          <span className="hl-label">Actual</span>
          <span className="hl-value">{isCards ? display(current) : value(current)}</span>
        </div>
        <span className="hl-arrow">→</span>
        <div className={`hl-card is-next ${revealed ? 'is-revealed' : ''}`}>
          <span className="hl-label">Siguiente</span>
          <span className="hl-value">{revealed ? (isCards ? display(next) : value(next)) : '?'}</span>
        </div>
      </div>

      <p className="bj-message">{message}</p>

      <div className="hl-actions">
        <button type="button" className="btn btn-primary btn-wide" onClick={() => guess('mayor')} disabled={done || revealed}>
          ⬆️ Mayor
        </button>
        <button type="button" className="btn btn-violet btn-wide" onClick={() => guess('menor')} disabled={done || revealed}>
          ⬇️ Menor
        </button>
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>Reiniciar</button>
      </div>

      <ResultOverlay
        open={resultOpen}
        emoji="🎲"
        title="Sin vidas"
        subtitle={`${correct} aciertos · mejor racha ${best}`}
        score={correct * 80 + best * 20}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
