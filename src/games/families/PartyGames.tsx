import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { CHARADES, IMPOSTOR_PACKS } from '../../data/party';
import { shuffle } from '../../lib/random';
import { sfx, vibrate } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { useCountdown, useGameReport } from '../hooks';

/* ───────────────────────────── Mímica ───────────────────────────── */

export function CharadesGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as { categoryId?: string; difficulty?: 'easy' | 'normal' | 'hard'; seconds?: number };
  const category = CHARADES.find((item) => item.id === config.categoryId) ?? CHARADES[0];
  const difficulty = config.difficulty ?? 'normal';
  const seconds = config.seconds ?? 75;
  const [round, setRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [passes, setPasses] = useState(0);
  const [finished, setFinished] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  const words = useMemo(
    () => shuffle(category[difficulty].map((word) => word)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, difficulty, round]
  );
  const word = words[wordIndex % words.length];

  const { remaining, progress } = useCountdown(seconds, running && !finished, round, () => {
    setRunning(false);
    setFinished(true);
    setResultOpen(true);
    sfx.alarm();
    report({ score: hits * 100, won: hits > 0 });
  });

  const nextWord = (hit: boolean) => {
    if (!running) return;
    if (hit) {
      setHits((value) => value + 1);
      sfx.match();
      vibrate(20);
    } else {
      setPasses((value) => value + 1);
      sfx.tap();
    }
    setWordIndex((index) => index + 1);
  };

  const start = () => {
    resetReport();
    setRunning(true);
    setFinished(false);
    setResultOpen(false);
    setHits(0);
    setPasses(0);
    setWordIndex(0);
    setRound((current) => current + 1);
  };

  const finishEarly = () => {
    if (!running) return;
    setRunning(false);
    setFinished(true);
    setResultOpen(true);
    report({ score: hits * 100, won: hits > 0 });
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">{category.emoji} {category.name}</span>
        <span className="hud-chip">✅ {hits}</span>
        <span className="hud-chip">⏭️ {passes}</span>
        <span className={`hud-chip ${remaining < 15 ? 'is-danger' : ''}`}>⏱️ {Math.ceil(remaining)} s</span>
      </div>
      <div className="meter">
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className={`charades-card ${running ? 'is-running' : ''}`}>
        <span className="charades-kicker">{running ? '¡Representa sin hablar!' : 'Mímica en grupo'}</span>
        <span className="charades-word">{running ? word : '¿Preparados?'}</span>
        <span className="charades-level">{difficulty === 'easy' ? 'Fácil' : difficulty === 'normal' ? 'Medio' : 'Difícil'} · {seconds} s por ronda</span>
        {!running ? (
          <button type="button" className="btn btn-primary btn-wide" onClick={start}>
            {finished ? 'Otra ronda' : 'Empezar ronda'}
          </button>
        ) : (
          <div className="charades-actions">
            <button type="button" className="btn btn-mint" onClick={() => nextWord(true)}>✅ Acertada</button>
            <button type="button" className="btn btn-ghost" onClick={() => nextWord(false)}>⏭️ Pasar</button>
          </div>
        )}
      </div>

      <div className="game-actions">
        {running ? <button type="button" className="btn btn-ghost btn-sm" onClick={finishEarly}>Terminar ronda</button> : null}
      </div>

      <div className="rules-card">
        <h3>Cómo se juega</h3>
        <p>Una persona coge el móvil, ve la palabra y la representa solo con gestos. El equipo intenta adivinarla antes de que acabe el tiempo. Si la aciertan, pulsa «Acertada»; si se atascan, «Pasar».</p>
        <p className="faint">No se puede hablar, deletrear, señalar objetos con la misma palabra ni usar sonidos que la delaten.</p>
      </div>

      <ResultOverlay
        open={resultOpen}
        emoji="🎭"
        title="Ronda terminada"
        subtitle={`${hits} acertadas · ${passes} pasadas`}
        score={hits * 100}
        onRetry={start}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Impostor ───────────────────────────── */

type ImpostorPhase = 'setup' | 'pass' | 'reveal' | 'discuss' | 'result';

export function ImpostorGame({ meta }: { meta: GameMeta }) {
  const pack = IMPOSTOR_PACKS.find((item) => item.id === (meta.config as { packId?: string }).packId) ?? IMPOSTOR_PACKS[0];
  const [phase, setPhase] = useState<ImpostorPhase>('setup');
  const [players, setPlayers] = useState(5);
  const [impostors, setImpostors] = useState(1);
  const [round, setRound] = useState(0);
  const [word, setWord] = useState('');
  const [impostorIndexes, setImpostorIndexes] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [showing, setShowing] = useState(false);

  const deal = () => {
    const indexes = shuffle(Array.from({ length: players }, (_, index) => index)).slice(0, Math.min(impostors, Math.max(1, players - 2)));
    setImpostorIndexes(indexes);
    setWord(pack.words[Math.floor(Math.random() * pack.words.length)]);
    setCurrent(0);
    setShowing(false);
    setPhase('pass');
    setRound((value) => value + 1);
    sfx.select();
  };

  useEffect(() => {
    setImpostors((value) => Math.min(value, Math.max(1, players - 2)));
  }, [players]);

  const names = Array.from({ length: players }, (_, index) => `Jugador ${index + 1}`);

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">{pack.emoji} {pack.name}</span>
        <span className="hud-chip">👥 {players}</span>
        <span className="hud-chip">🕵️ {impostors}</span>
      </div>

      {phase === 'setup' ? (
        <div className="start-card">
          <span className="start-emoji">🕵️</span>
          <h2>El impostor</h2>
          <p className="muted">Todos verán la palabra secreta menos quien reciba el papel de impostor. Pasad el móvil y hablad hasta descubrirlo.</p>
          <div className="setup-row">
            <span>Jugadores</span>
            <div className="stepper">
              <button type="button" className="icon-btn small" onClick={() => setPlayers((value) => Math.max(3, value - 1))} aria-label="Menos jugadores">−</button>
              <strong>{players}</strong>
              <button type="button" className="icon-btn small" onClick={() => setPlayers((value) => Math.min(10, value + 1))} aria-label="Más jugadores">+</button>
            </div>
          </div>
          <div className="setup-row">
            <span>Impostores</span>
            <div className="stepper">
              <button type="button" className="icon-btn small" onClick={() => setImpostors((value) => Math.max(1, value - 1))} aria-label="Menos impostores">−</button>
              <strong>{impostors}</strong>
              <button type="button" className="icon-btn small" onClick={() => setImpostors((value) => Math.min(2, value + 1))} aria-label="Más impostores">+</button>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-wide" onClick={deal}>Repartir roles</button>
        </div>
      ) : null}

      {phase === 'pass' ? (
        <div className="impostor-pass" key={round}>
          <span className="impostor-avatar">📱</span>
          <h2>Pasa el móvil a {names[current]}</h2>
          <p className="muted">Asegúrate de que nadie más mira la pantalla.</p>
          <button type="button" className="btn btn-primary btn-wide" onClick={() => { setShowing(true); setPhase('reveal'); }}>
            Soy {names[current]}
          </button>
        </div>
      ) : null}

      {phase === 'reveal' ? (
        <div className="impostor-reveal" key={`${round}-${current}`}>
          <span className="impostor-role">{impostorIndexes.includes(current) ? '🕵️ Impostor' : '🙋 Palabra secreta'}</span>
          <span className="impostor-word">{impostorIndexes.includes(current) ? 'Hazte pasar por uno más' : word}</span>
          {impostorIndexes.includes(current) ? (
            <p className="muted">No conoces la palabra. Escucha, improvisa y no te descubran.</p>
          ) : (
            <p className="muted">Recuérdala bien. Describe sin decirla directamente.</p>
          )}
          <button
            type="button"
            className="btn btn-dark btn-wide"
            onClick={() => {
              setShowing(false);
              if (current + 1 >= players) {
                setPhase('discuss');
              } else {
                setCurrent((value) => value + 1);
                setPhase('pass');
              }
            }}
          >
            Ocultar y pasar
          </button>
        </div>
      ) : null}

      {phase === 'discuss' ? (
        <div className="impostor-discuss">
          <span className="start-emoji">🗣️</span>
          <h2>Debate abierto</h2>
          <p className="muted">Cada jugador describe la palabra con una pista. Después votad quién es el impostor.</p>
          <ol className="discuss-list">
            <li>Da una pista corta sin decir la palabra.</li>
            <li>Escucha las pistas de los demás: el impostor improvisa.</li>
            <li>Votad y señalad al sospechoso.</li>
            <li>Revelad el papel del elegido.</li>
          </ol>
          <button type="button" className="btn btn-primary btn-wide" onClick={() => setPhase('result')}>
            Revelar impostores
          </button>
        </div>
      ) : null}

      {phase === 'result' ? (
        <div className="impostor-result">
          <span className="start-emoji">🎭</span>
          <h2>{impostorIndexes.length === 1 ? 'El impostor era…' : 'Los impostores eran…'}</h2>
          <div className="impostor-names">
            {impostorIndexes.map((index) => (
              <span key={index} className="badge hot">{names[index]}</span>
            ))}
          </div>
          <p className="muted">La palabra secreta era «{word}».</p>
          <div className="game-actions">
            <button type="button" className="btn btn-primary" onClick={deal}>Otra ronda</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setPhase('setup'); setWord(''); setImpostorIndexes([]); }}>Cambiar ajustes</button>
          </div>
        </div>
      ) : null}

      <div className="rules-card">
        <h3>Cómo se juega</h3>
        <p>Todos reciben la misma palabra secreta excepto el impostor. Por turnos, cada persona dice una pista relacionada. El impostor debe disimular; el grupo debe descubrirlo.</p>
        <p className="faint">Si el impostor sobrevive a la votación, gana. Si lo descubren, gana el grupo.</p>
      </div>
    </div>
  );
}
