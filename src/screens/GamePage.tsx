import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { GameMeta } from '../types';
import { getGame } from '../data/catalog';
import { useApp } from '../state/AppContext';
import { readRandomSession } from '../lib/randomSession';
import { GameInfoSheet, GameTopBar, PlayFooterLink } from '../components/GameTopBar';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { MemoryGame } from '../games/families/MemoryGame';
import { WordSearchGame } from '../games/families/WordSearchGame';
import { AnagramGame, HangmanGame, WordGuessGame } from '../games/families/WordGames';
import { QuizGame } from '../games/families/QuizGame';
import { MathGame } from '../games/families/MathGame';
import { KlondikeGame, PyramidGame } from '../games/families/SolitaireGames';
import { BlackjackGame, HigherLowerGame, WarGame } from '../games/families/CasinoGames';
import { Connect4Game, ReversiGame, TicTacToeGame } from '../games/families/BoardGames';
import { Game2048, MinesweeperGame, SlidingGame, SudokuGame } from '../games/families/PuzzleGames';
import { LightsOutGame, MazeGame } from '../games/families/MazeLights';
import { AimGame, ReactionGame, SimonGame, SnakeGame, WhackGame } from '../games/families/ArcadeGames';
import { CharadesGame, ImpostorGame } from '../games/families/PartyGames';

type Engine = ComponentType<{ meta: GameMeta }>;

const ENGINES: Record<string, Engine> = {
  memory: MemoryGame,
  wordsearch: WordSearchGame,
  hangman: HangmanGame,
  anagram: AnagramGame,
  wordguess: WordGuessGame,
  trivia: QuizGame,
  math: MathGame,
  klondike: KlondikeGame,
  pyramid: PyramidGame,
  blackjack: BlackjackGame,
  war: WarGame,
  higherlower: HigherLowerGame,
  ttt: TicTacToeGame,
  connect4: Connect4Game,
  reversi: ReversiGame,
  '2048': Game2048,
  minesweeper: MinesweeperGame,
  sudoku: SudokuGame,
  sliding: SlidingGame,
  maze: MazeGame,
  lightsout: LightsOutGame,
  snake: SnakeGame,
  simon: SimonGame,
  reaction: ReactionGame,
  whack: WhackGame,
  aim: AimGame,
  charades: CharadesGame,
  impostor: ImpostorGame
};

export default function GamePage() {
  const { id = '' } = useParams();
  const meta = getGame(id);
  const navigate = useNavigate();
  const { markRecent } = useApp();
  const [infoOpen, setInfoOpen] = useState(false);
  const random = readRandomSession();
  const activeMeta = useMemo<GameMeta>(
    () =>
      meta && random?.mode === 'bots'
        ? { ...meta, config: { ...meta.config, ai: random.level } }
        : meta ?? ({} as GameMeta),
    [meta, random?.mode, random?.level]
  );

  useEffect(() => {
    if (meta) markRecent(meta.id);
  }, [meta?.id, markRecent]);

  if (!meta) {
    return (
      <div className="app-frame">
        <div className="not-found">
          <div>
            <div className="big">🎮</div>
            <h1 style={{ marginTop: 14 }}>Juego no encontrado</h1>
            <p className="muted" style={{ marginTop: 6 }}>Puede que el enlace esté mal o que la variante ya no exista.</p>
            <Link to="/explorar" className="btn btn-primary" style={{ marginTop: 18 }}>Explorar juegos</Link>
          </div>
        </div>
      </div>
    );
  }

  if (meta.family === 'outdoor') {
    return <Navigate to={`/vida-real/${String(meta.config.outdoorId ?? meta.id)}`} replace />;
  }

  const Engine = ENGINES[meta.family];
  const canOnline = meta.modes.includes('online');

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/explorar');
  };

  return (
    <div className="app-frame">
      <div className="screen play-screen">
        <GameTopBar
          meta={activeMeta}
          onBack={goBack}
          onInfo={() => setInfoOpen(true)}
          right={
            canOnline ? (
              <Link to={`/salas?juego=${encodeURIComponent(activeMeta.id)}`} className="icon-btn small" aria-label="Jugar en sala online">
                <Icon name="users" size={18} />
              </Link>
            ) : undefined
          }
        />

        {canOnline ? (
          <Link to={`/salas?juego=${encodeURIComponent(activeMeta.id)}`} className="online-invite">
            <span className="online-invite-icon">🌐</span>
            <span>
              <strong>¿Jugamos a distancia?</strong>
              <small>Crea una sala con código o busca rival al instante.</small>
            </span>
            <Icon name="chevron-right" size={16} />
          </Link>
        ) : null}

        {Engine ? (
          <Engine meta={activeMeta} />
        ) : (
          <div className="empty">
            <div className="big">🚧</div>
            <h2>Motor en camino</h2>
            <p className="muted">Esta familia todavía no tiene motor jugable.</p>
          </div>
        )}

        <PlayFooterLink />
      </div>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} label="Información del juego">
        <GameInfoSheet meta={activeMeta} onClose={() => setInfoOpen(false)} />
      </Sheet>
    </div>
  );
}
