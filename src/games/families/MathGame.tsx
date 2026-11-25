import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { generateMathQuestion } from '../../shared/quiz';
import { sfx } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { useCountdown, useGameReport } from '../hooks';

export function MathGame({ meta }: { meta: GameMeta }) {
  const config = meta.config as Record<string, unknown>;
  const mode = String(config.mode ?? 'arithmetic');
  const seconds = Number(config.seconds ?? (mode === 'tables' ? 60 : 120));
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  const question = useMemo(
    () => generateMathQuestion(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.id, round, index]
  );

  const { remaining, progress } = useCountdown(seconds, started && !done, round, () => {
    if (done) return;
    setDone(true);
    setResultOpen(true);
    sfx.lose();
    report({ score: correct * 100 + bestStreak * 20, won: correct >= 10 });
  });

  useEffect(() => {
    if (chosen === null || done) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => current + 1);
      setChosen(null);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [chosen, done]);

  const answer = (option: number) => {
    if (chosen !== null || done || !started) return;
    setChosen(option);
    if (option === question.answer) {
      sfx.select();
      setCorrect((value) => value + 1);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((best) => Math.max(best, nextStreak));
    } else {
      sfx.error();
      setWrong((value) => value + 1);
      setStreak(0);
    }
  };

  const restart = () => {
    resetReport();
    setRound((current) => current + 1);
    setIndex(0);
    setStarted(true);
    setChosen(null);
    setCorrect(0);
    setWrong(0);
    setStreak(0);
    setBestStreak(0);
    setDone(false);
    setResultOpen(false);
  };

  const score = correct * 100 + bestStreak * 20;

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">✅ {correct}</span>
        <span className="hud-chip">❌ {wrong}</span>
        <span className="hud-chip">🔥 {streak}</span>
        <span className={`hud-chip ${remaining < 10 ? 'is-danger' : ''}`}>⏱️ {Math.ceil(remaining)} s</span>
      </div>
      <div className="meter">
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      {!started ? (
        <div className="start-card">
          <span className="start-emoji">{meta.emoji}</span>
          <h2>{meta.title}</h2>
          <p className="muted">{meta.blurb}</p>
          <p className="start-note">Tienes {seconds} segundos. Cada acierto suma y la racha multiplica la emoción.</p>
          <button type="button" className="btn btn-primary btn-wide" onClick={() => setStarted(true)}>
            Empezar ronda
          </button>
        </div>
      ) : (
        <>
          <div className={`math-prompt ${question.big ? 'is-big' : ''}`} key={`${round}-${index}`}>
            {question.prompt}
          </div>
          <div className="quiz-options math-options">
            {question.options.map((option, optionIndex) => {
              const state =
                chosen === null
                  ? ''
                  : optionIndex === question.answer
                    ? 'is-correct'
                    : optionIndex === chosen
                      ? 'is-wrong'
                      : 'is-dim';
              return (
                <button
                  key={`${option}-${optionIndex}`}
                  type="button"
                  className={`quiz-option ${state}`}
                  onClick={() => answer(optionIndex)}
                  disabled={chosen !== null || done}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="game-actions">
        <button type="button" className="btn btn-ghost" onClick={restart}>
          Reiniciar ronda
        </button>
      </div>

      <ResultOverlay
        open={resultOpen}
        emoji="🧮"
        title="Tiempo agotado"
        subtitle={`${correct} aciertos · ${wrong} fallos · mejor racha ${bestStreak}`}
        score={score}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
