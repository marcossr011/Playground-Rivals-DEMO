import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { WORD_THEMES } from '../../data/words';
import { formatClock, normalizeText, shuffle, uid } from '../../lib/random';
import { sfx, vibrate } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { useCountdown, useGameReport, useKeyboard } from '../hooks';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface ThemeConfig {
  themeId?: string;
  lives?: number;
  seconds?: number;
}

function themeFor(id?: string) {
  return WORD_THEMES.find((theme) => theme.id === id) ?? WORD_THEMES[0];
}

/* ───────────────────────────── Ahorcado ───────────────────────────── */

export function HangmanGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as ThemeConfig;
  const theme = themeFor(config.themeId);
  const maxLives = config.lives ?? 6;
  const [round, setRound] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  const word = useMemo(() => normalizeText(theme.words[Math.floor(Math.random() * theme.words.length)]), [theme, round]);
  const [guessed, setGuessed] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [won, setWon] = useState(false);

  const wrong = guessed.filter((letter) => !word.includes(letter));
  const lives = Math.max(0, maxLives - wrong.length);
  const solved = word.split('').every((letter) => letter === ' ' || guessed.includes(letter));

  useEffect(() => {
    if (guessed.length === 0) return;
    if (solved && !done) {
      setDone(true);
      setWon(true);
      setResultOpen(true);
      sfx.win();
      vibrate([30, 40, 60]);
      report({ score: lives * 150 + 150, won: true });
    } else if (lives <= 0 && !done) {
      setDone(true);
      setWon(false);
      setResultOpen(true);
      sfx.lose();
      report({ score: 0, won: false });
    }
  }, [guessed, solved, done, lives, report]);

  const guess = (raw: string) => {
    const letter = normalizeText(raw).slice(-1);
    if (done || !ALPHABET.includes(letter) || guessed.includes(letter)) return;
    sfx.select();
    setGuessed((current) => [...current, letter]);
  };

  useKeyboard((key) => {
    if (key === 'Backspace' && guessed.length) {
      setGuessed((current) => current.slice(0, -1));
      return;
    }
    if (key.length === 1) guess(key);
  }, !done);

  const restart = () => {
    resetReport();
    setGuessed([]);
    setDone(false);
    setWon(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  const face = ['🫥', '😐', '😟', '😰', '😵', '🫠', '💀'][Math.min(wrong.length, 6)];

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">{theme.emoji} {theme.name}</span>
        <span className="hud-chip">❤️ {'▮'.repeat(lives)}{'▯'.repeat(maxLives - lives)}</span>
        <span className="hud-chip">{face}</span>
      </div>

      <div className="hangman-word">
        {word.split('').map((letter, index) =>
          letter === ' ' ? (
            <span key={index} className="hangman-gap" />
          ) : (
            <span key={index} className={`hangman-slot ${done && !guessed.includes(letter) ? 'is-lost' : ''}`}>
              {guessed.includes(letter) || done ? letter : ''}
            </span>
          )
        )}
      </div>

      <div className="keyboard">
        {ALPHABET.map((letter) => {
          const used = guessed.includes(letter);
          const ok = used && word.includes(letter);
          return (
            <button
              key={letter}
              type="button"
              className={`key ${used ? 'is-used' : ''} ${ok ? 'is-ok' : ''} ${used && !ok ? 'is-bad' : ''}`}
              onClick={() => guess(letter)}
              disabled={done || used}
            >
              {letter}
            </button>
          );
        })}
      </div>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>
          Nueva palabra
        </button>
      </div>

      <ResultOverlay
        open={resultOpen}
        emoji={won ? '🎉' : '💀'}
        title={won ? '¡Palabra descubierta!' : `Era «${word.toUpperCase()}»`}
        subtitle={won ? `Te quedaban ${lives} ${lives === 1 ? 'vida' : 'vidas'}` : 'La próxima va a ir mejor'}
        score={won ? lives * 150 + 150 : 0}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Anagramas ───────────────────────────── */

export function AnagramGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as ThemeConfig;
  const theme = themeFor(config.themeId);
  const seconds = config.seconds ?? 90;
  const [round, setRound] = useState(0);
  const [finished, setFinished] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [solved, setSolved] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);
  const [hint, setHint] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  const { report, resetReport } = useGameReport(meta);

  const pool = useMemo(
    () => theme.words.map((word) => normalizeText(word)).filter((word) => word.length >= 4 && word.length <= 8),
    [theme]
  );
  const current = useMemo(() => {
    const available = pool.filter((word) => !used.includes(word));
    const source = available.length ? available : pool;
    return source[Math.floor(Math.random() * source.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, solved, skipped, round]);

  const scrambled = useMemo(() => {
    let letters = shuffle(current.split('')).join('');
    if (letters === current) letters = shuffle(current.split('')).join('');
    return letters;
  }, [current]);

  const { remaining, progress } = useCountdown(seconds, !finished, round, () => {
    setFinished(true);
    setResultOpen(true);
    sfx.lose();
    report({ score: solved * 100, won: solved > 0 });
  });

  useEffect(() => {
    setUsed((currentUsed) => [...currentUsed, current]);
  }, [current]);

  const next = () => {
    setInput('');
    setWrong(false);
    setHint(false);
  };

  const submit = () => {
    if (finished) return;
    if (normalizeText(input) === current) {
      sfx.match();
      vibrate(20);
      setSolved((value) => value + 1);
      next();
    } else {
      sfx.error();
      setWrong(true);
      window.setTimeout(() => setWrong(false), 400);
    }
  };

  const skip = () => {
    if (finished) return;
    sfx.tap();
    setSkipped((value) => value + 1);
    next();
  };

  useEffect(() => {
    if (remaining <= 0 && !finished) {
      setFinished(true);
      setResultOpen(true);
    }
  }, [remaining, finished]);

  const restart = () => {
    resetReport();
    setSolved(0);
    setSkipped(0);
    setInput('');
    setHint(false);
    setWrong(false);
    setUsed([]);
    setFinished(false);
    setResultOpen(false);
    setRound((currentRound) => currentRound + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">✅ {solved}</span>
        <span className="hud-chip">⏭️ {skipped}</span>
        <span className={`hud-chip ${remaining < 15 ? 'is-danger' : ''}`}>⏱️ {Math.ceil(remaining)} s</span>
      </div>
      <div className="meter">
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="anagram-card">
        <p className="anagram-letters">{scrambled.toUpperCase().split('').join(' ')}</p>
        <p className="faint">{theme.emoji} {theme.name} · {current.length} letras</p>
        {hint ? <p className="anagram-hint">Empieza por «{current[0].toUpperCase()}»</p> : null}
      </div>

      <form
        className={`anagram-form ${wrong ? 'is-wrong' : ''}`}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          className="input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Escribe la palabra"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          disabled={finished}
        />
        <button type="submit" className="btn btn-primary" disabled={finished || !input.trim()}>
          Probar
        </button>
      </form>

      <div className="game-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHint(true)} disabled={hint || finished}>
          💡 Primera letra
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={skip} disabled={finished}>
          Saltar
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
          Reiniciar
        </button>
      </div>

      <p className="engine-tip">Ordena todas las letras sin dejar ninguna fuera. No importan los acentos.</p>

      <ResultOverlay
        open={resultOpen}
        emoji="🔀"
        title="Tiempo agotado"
        subtitle={`Resolviste ${solved} anagramas`}
        score={solved * 100}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────── Palabra oculta ───────────────────────────── */

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export function WordGuessGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as ThemeConfig;
  const length = (meta.config as { length?: number }).length ?? 5;
  const maxAttempts = (meta.config as { attempts?: number }).attempts ?? 6;
  const pool = useMemo(
    () =>
      WORD_THEMES.flatMap((theme) => theme.words.map((word) => normalizeText(word))).filter(
        (word) => word.length === length
      ),
    [length]
  );
  const [round, setRound] = useState(0);
  const [secret, setSecret] = useState(() => pool[Math.floor(Math.random() * pool.length)] ?? 'PERRO');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [resultOpen, setResultOpen] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const { report, resetReport } = useGameReport(meta);
  const done = won || guesses.length >= maxAttempts;

  const evaluate = (guess: string) => {
    const marks: ('ok' | 'near' | 'off')[] = Array(length).fill('off');
    const remaining: Record<string, number> = {};
    for (let i = 0; i < length; i++) {
      if (guess[i] === secret[i]) marks[i] = 'ok';
      else remaining[secret[i]] = (remaining[secret[i]] ?? 0) + 1;
    }
    for (let i = 0; i < length; i++) {
      if (marks[i] === 'ok') continue;
      if (remaining[guess[i]] > 0) {
        marks[i] = 'near';
        remaining[guess[i]] -= 1;
      }
    }
    return marks;
  };

  const keyState = useMemo(() => {
    const map: Record<string, 'ok' | 'near' | 'off'> = {};
    const rank = { off: 0, near: 1, ok: 2 };
    for (const guess of guesses) {
      const marks = evaluate(guess);
      guess.split('').forEach((letter, index) => {
        const next = marks[index];
        if (!map[letter] || rank[next] > rank[map[letter]]) map[letter] = next;
      });
    }
    return map;
  }, [guesses, secret]);

  const submit = () => {
    if (done) return;
    const guess = normalizeText(input);
    if (guess.length !== length) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      sfx.error();
      return;
    }
    const nextGuesses = [...guesses, guess];
    setGuesses(nextGuesses);
    setInput('');
    if (guess === secret) {
      sfx.win();
      vibrate([40, 40, 60]);
      setWon(true);
      setResultOpen(true);
      report({ score: (maxAttempts - guesses.length) * 120 + 200, won: true });
    } else if (nextGuesses.length >= maxAttempts) {
      sfx.lose();
      setResultOpen(true);
      report({ score: 0, won: false });
    } else {
      sfx.tap();
    }
  };

  const type = (key: string) => {
    if (done) return;
    if (key === 'BACK') {
      setInput((current) => current.slice(0, -1));
      return;
    }
    if (key === 'ENTER') {
      submit();
      return;
    }
    if (input.length < length) setInput((current) => current + key);
  };

  useKeyboard((key) => {
    if (key === 'Backspace') type('BACK');
    else if (key === 'Enter') type('ENTER');
    else if (/^[a-zA-Z]$/.test(key)) type(key.toUpperCase());
  }, !done);

  const restart = () => {
    resetReport();
    setSecret(pool[Math.floor(Math.random() * pool.length)] ?? 'PERRO');
    setGuesses([]);
    setInput('');
    setWon(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">🧩 {guesses.length}/{maxAttempts}</span>
        <span className="hud-chip">🔤 {length} letras</span>
        <span className="hud-chip">{done ? (won ? '🎉' : '💤') : '🟩'}</span>
      </div>

      <div className="wordle-board" key={round}>
        {Array.from({ length: maxAttempts }).map((_, rowIndex) => {
          const guess = guesses[rowIndex];
          const isActive = rowIndex === guesses.length && !done;
          const letters = guess ? guess.split('') : isActive ? input.padEnd(length, ' ').split('') : Array(length).fill('');
          const marks = guess ? evaluate(guess) : [];
          return (
            <div className={`wordle-row ${isActive ? 'is-active' : ''} ${shake && isActive ? 'is-shake' : ''}`} key={rowIndex}>
              {letters.map((letter, index) => (
                <span
                  key={index}
                  className={`wordle-cell ${guess ? `is-${marks[index]}` : ''} ${letter !== ' ' && letter ? 'is-filled' : ''}`}
                >
                  {letter.trim() || ''}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="keyboard keyboard-wordle">
        {KEY_ROWS.map((row) => (
          <div className="key-row" key={row}>
            {row.split('').map((letter) => (
              <button
                key={letter}
                type="button"
                className={`key small ${keyState[letter] ? `is-${keyState[letter]}` : ''}`}
                onClick={() => type(letter)}
                disabled={done}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
        <div className="key-row">
          <button type="button" className="key wide" onClick={() => type('ENTER')} disabled={done}>
            Enviar
          </button>
          <button type="button" className="key wide" onClick={() => type('BACK')} disabled={done}>
            Borrar
          </button>
        </div>
      </div>

      <p className="engine-tip">Verde: letra y posición correctas. Amarillo: la letra existe pero está en otro sitio.</p>

      <ResultOverlay
        open={resultOpen}
        emoji={won ? '🥳' : '🔍'}
        title={won ? '¡Palabra encontrada!' : `Era «${secret}»`}
        subtitle={won ? `Lo resolviste en ${guesses.length} ${guesses.length === 1 ? 'intento' : 'intentos'}` : 'Otra ronda y seguro que sí'}
        score={won ? (maxAttempts - guesses.length) * 120 + 200 : 0}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
