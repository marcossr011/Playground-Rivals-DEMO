import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameMeta } from '../../types';
import { applyC4, chooseC4Move, createC4, type C4State } from '../../shared/connect4';
import { applyReversi, chooseReversiMove, createReversi, legalMoves, type ReversiState } from '../../shared/reversi';
import { applyTtt, chooseTttMove, createTtt, type TttState } from '../../shared/ttt';
import { ResultOverlay } from '../../components/ResultOverlay';
import { sfx, vibrate } from '../../lib/audio';
import { useGameReport } from '../hooks';

/* ───────────────────────────── Tres en raya ───────────────────────────── */

export function TicTacToeGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { size?: number; win?: number; ai?: string };
  const size = config.size ?? 3;
  const win = config.win ?? 3;
  const difficulty = config.ai ?? 'normal';
  const [twoPlayers, setTwoPlayers] = useState(false);
  const [game, setGame] = useState<TttState>(() => createTtt(size, win));
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  useEffect(() => {
    if (twoPlayers || game.turn !== 1 || game.status !== 'playing') return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (current.turn !== 1 || current.status !== 'playing') return current;
        const move = chooseTttMove(current, difficulty);
        return applyTtt(current, move).state;
      });
    }, 380);
    return () => window.clearTimeout(timer);
  }, [game, twoPlayers, difficulty]);

  useEffect(() => {
    if (game.status === 'playing' || resultOpen) return;
    setResultOpen(true);
    sfx[game.status === 'won' && game.winner === 0 ? 'win' : 'lose']();
    report({ score: game.status === 'won' ? (game.winner === 0 ? 300 : 60) : 100, won: game.status === 'won' && game.winner === 0 });
  }, [game, resultOpen, report]);

  const play = (index: number) => {
    if (game.status !== 'playing' || game.board[index]) return;
    if (!twoPlayers && game.turn !== 0) return;
    setGame((current) => applyTtt(current, index).state);
    vibrate(10);
  };

  const restart = () => {
    resetReport();
    setGame(createTtt(size, win));
    setResultOpen(false);
  };

  const turnLabel = game.status !== 'playing' ? 'Partida terminada' : game.turn === 0 ? 'Turno de ✕' : twoPlayers ? 'Turno de ◯' : 'Pensando…';

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">{turnLabel}</span>
        {meta.modes.includes('local') ? (
          <button type="button" className={`chip tiny ${twoPlayers ? 'active' : ''}`} onClick={() => { setTwoPlayers((current) => !current); restart(); }}>
            👥 2 jugadores
          </button>
        ) : null}
      </div>

      <div className="ttt-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, fontSize: size <= 3 ? 48 : size === 4 ? 34 : 24 }}>
        {game.board.map((mark, index) => (
          <button
            key={index}
            type="button"
            className={`ttt-cell mark-${mark} ${game.line.includes(index) ? 'is-line' : ''}`}
            onClick={() => play(index)}
            disabled={mark !== 0 || game.status !== 'playing'}
            aria-label={`Casilla ${index + 1}`}
          >
            {mark === 1 ? '✕' : mark === 2 ? '◯' : ''}
          </button>
        ))}
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Nueva partida</button>
      </div>
      <p className="engine-tip">Consigue {win} en línea en un tablero de {size}×{size}. {twoPlayers ? 'Pasad el móvil en cada turno.' : 'Juegas con ✕ contra la máquina.'}</p>

      <ResultOverlay
        open={resultOpen}
        emoji="⭕"
        title={game.status === 'draw' ? 'Empate' : game.winner === 0 ? '¡Ganaste!' : twoPlayers ? 'Gana ◯' : 'Gana la máquina'}
        subtitle={game.status === 'draw' ? 'Nadie consiguió la línea' : `${game.moves} movimientos`}
        score={game.status === 'won' ? (game.winner === 0 ? 300 : 60) : 100}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Cuatro en línea ───────────────────────────── */

export function Connect4Game({ meta }: { meta: GameMeta }) {
  const config = meta.config as { cols?: number; rows?: number; ai?: string };
  const cols = config.cols ?? 7;
  const rows = config.rows ?? 6;
  const difficulty = config.ai ?? 'normal';
  const [twoPlayers, setTwoPlayers] = useState(false);
  const [game, setGame] = useState<C4State>(() => createC4(cols, rows));
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  useEffect(() => {
    if (twoPlayers || game.turn !== 1 || game.status !== 'playing') return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (current.turn !== 1 || current.status !== 'playing') return current;
        const move = chooseC4Move(current, difficulty);
        return move === null ? current : applyC4(current, move).state;
      });
    }, 420);
    return () => window.clearTimeout(timer);
  }, [game, twoPlayers, difficulty]);

  useEffect(() => {
    if (game.status === 'playing' || resultOpen) return;
    setResultOpen(true);
    sfx[game.status === 'won' && game.winner === 0 ? 'win' : 'lose']();
    report({ score: game.status === 'won' ? (game.winner === 0 ? 350 : 60) : 120, won: game.status === 'won' && game.winner === 0 });
  }, [game, resultOpen, report]);

  const play = (col: number) => {
    if (game.status !== 'playing') return;
    if (!twoPlayers && game.turn !== 0) return;
    setGame((current) => applyC4(current, col).state);
    sfx.tap();
  };

  const restart = () => {
    resetReport();
    setGame(createC4(cols, rows));
    setResultOpen(false);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">{game.status !== 'playing' ? 'Partida terminada' : game.turn === 0 ? 'Turno 🔴' : twoPlayers ? 'Turno 🟡' : 'Pensando…'}</span>
        {meta.modes.includes('local') ? (
          <button type="button" className={`chip tiny ${twoPlayers ? 'active' : ''}`} onClick={() => { setTwoPlayers((current) => !current); restart(); }}>
            👥 2 jugadores
          </button>
        ) : null}
      </div>

      <div className="c4-wrap">
        <div className="c4-columns" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, col) => (
            <button key={col} type="button" className="c4-drop" onClick={() => play(col)} disabled={game.status !== 'playing'} aria-label={`Soltar en columna ${col + 1}`}>
              ▼
            </button>
          ))}
        </div>
        <div className="c4-board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols * rows }).map((_, index) => {
            const mark = game.board[index];
            return (
              <div key={index} className={`c4-cell mark-${mark} ${game.line.includes(index) ? 'is-line' : ''}`}>
                <span />
              </div>
            );
          })}
        </div>
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Nueva partida</button>
      </div>
      <p className="engine-tip">Conecta cuatro fichas en horizontal, vertical o diagonal. Toca la flecha de una columna para soltar tu ficha.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="🔴"
        title={game.status === 'draw' ? 'Tablero lleno' : game.winner === 0 ? '¡Cuatro en línea!' : twoPlayers ? 'Gana 🟡' : 'Gana la máquina'}
        subtitle={`${game.moves} fichas colocadas`}
        score={game.status === 'won' ? (game.winner === 0 ? 350 : 60) : 120}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Reversi ───────────────────────────── */

export function ReversiGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { size?: number; ai?: string };
  const size = config.size ?? 8;
  const difficulty = config.ai ?? 'normal';
  const [twoPlayers, setTwoPlayers] = useState(false);
  const [game, setGame] = useState<ReversiState>(() => createReversi(size));
  const [resultOpen, setResultOpen] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const { report, resetReport } = useGameReport(meta);

  const humanTurn = twoPlayers || game.turn === 0;

  useEffect(() => {
    if (twoPlayers || game.turn !== 1 || game.status !== 'playing') return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (current.turn !== 1 || current.status !== 'playing') return current;
        const move = chooseReversiMove(current, difficulty);
        if (move === null) return current;
        return applyReversi(current, move).state;
      });
    }, 480);
    return () => window.clearTimeout(timer);
  }, [game, twoPlayers, difficulty]);

  useEffect(() => {
    if (game.status === 'playing' || resultOpen) return;
    setResultOpen(true);
    const won = game.winner === 0 || (twoPlayers && game.winner !== null);
    sfx[game.winner === null ? 'tick' : won ? 'win' : 'lose']();
    report({ score: game.winner === 0 ? 400 : game.status === 'draw' ? 150 : 60, won: game.winner === 0 || (twoPlayers && game.winner !== null) });
  }, [game, resultOpen, report, twoPlayers]);

  const legal = useMemo(
    () => (game.status === 'playing' ? legalMoves(game.board, size, (game.turn + 1) as 1 | 2) : new Map<number, number[]>()),
    [game, size]
  );

  const play = (index: number) => {
    if (!humanTurn || game.status !== 'playing') return;
    const result = applyReversi(game, index);
    if (result.error) {
      sfx.error();
      return;
    }
    setGame(result.state);
    setFlash(index);
    sfx.tap();
    vibrate(10);
  };

  const restart = () => {
    resetReport();
    setGame(createReversi(size));
    setResultOpen(false);
    setFlash(null);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">⚫ {game.black}</span>
        <span className="hud-chip">⚪ {game.white}</span>
        <span className="hud-chip">
          {game.status !== 'playing' ? 'Fin' : game.turn === 0 ? 'Turno ⚫' : twoPlayers ? 'Turno ⚪' : 'Máquina ⚪'}
        </span>
        {meta.modes.includes('local') ? (
          <button type="button" className={`chip tiny ${twoPlayers ? 'active' : ''}`} onClick={() => { setTwoPlayers((current) => !current); restart(); }}>
            👥 2 jugadores
          </button>
        ) : null}
      </div>

      <div className="reversi-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {game.board.map((mark, index) => (
          <button
            key={index}
            type="button"
            className={`reversi-cell ${legal.has(index) ? 'is-legal' : ''} ${flash === index ? 'is-flash' : ''}`}
            onClick={() => play(index)}
            disabled={game.status !== 'playing' || !humanTurn || !legal.has(index)}
            aria-label={mark === 1 ? 'Ficha negra' : mark === 2 ? 'Ficha blanca' : 'Casilla vacía'}
          >
            {mark ? <span className={`disc disc-${mark}`} /> : legal.has(index) ? <span className="legal-dot" /> : null}
          </button>
        ))}
      </div>

      {game.passed ? <p className="engine-tip">Sin movimientos posibles: se pasa el turno automáticamente.</p> : null}

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>Nueva partida</button>
      </div>
      <p className="engine-tip">Coloca fichas para encerrar las del rival y darles la vuelta. Gana quien tenga más fichas al final.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="⚫"
        title={game.status === 'draw' ? 'Empate' : game.winner === 0 ? '¡Ganaste!' : twoPlayers ? 'Gana ⚪' : 'Gana la máquina'}
        subtitle={`Negras ${game.black} · Blancas ${game.white}`}
        score={game.winner === 0 ? 400 : game.status === 'draw' ? 150 : 60}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
