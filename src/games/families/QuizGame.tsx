import { useEffect, useMemo, useState } from 'react';
import type { GameMeta } from '../../types';
import { generateTriviaQuestions } from '../../shared/quiz';
import { sfx, vibrate } from '../../lib/audio';
import { ResultOverlay } from '../../components/ResultOverlay';
import { useGameReport } from '../hooks';

export function QuizGame({ meta }: { meta: GameMeta }) {
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const { report, resetReport } = useGameReport(meta);

  const questions = useMemo(
    () => generateTriviaQuestions(meta.config as Record<string, unknown>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.id, round]
  );
  const question = questions[index];

  useEffect(() => {
    if (chosen === null || done) return;
    const timer = window.setTimeout(() => {
      if (index + 1 >= questions.length) {
        setDone(true);
        setResultOpen(true);
        sfx[correct >= questions.length / 2 ? 'win' : 'lose']();
        report({ score: correct * 100 + bestStreak * 25, won: correct >= questions.length / 2 });
      } else {
        setIndex((current) => current + 1);
        setChosen(null);
      }
    }, 1150);
    return () => window.clearTimeout(timer);
  }, [chosen, done, index, questions.length, correct, bestStreak, report]);

  const answer = (option: number) => {
    if (chosen !== null || done || !question) return;
    setChosen(option);
    if (option === question.answer) {
      sfx.match();
      vibrate(20);
      setCorrect((value) => value + 1);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((best) => Math.max(best, nextStreak));
    } else {
      sfx.error();
      setStreak(0);
    }
  };

  const restart = () => {
    resetReport();
    setIndex(0);
    setChosen(null);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setDone(false);
    setResultOpen(false);
    setRound((current) => current + 1);
  };

  if (!question) {
    return (
      <div className="engine">
        <p className="empty">No hay preguntas para esta configuración.</p>
      </div>
    );
  }

  return (
    <div className="engine">
      <div className="game-hud">
        <span className="hud-chip">
          {index + 1}/{questions.length}
        </span>
        <span className="hud-chip">✅ {correct}</span>
        <span className="hud-chip">🔥 Racha {streak}</span>
      </div>
      <div className="meter">
        <span style={{ width: `${((index + (chosen !== null ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="quiz-card" key={`${round}-${index}`}>
        {question.visual ? <div className="quiz-visual">{question.visual}</div> : null}
        <p className={`quiz-prompt ${question.big ? 'is-big' : ''}`}>{question.prompt}</p>
      </div>

      <div className="quiz-options">
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
              disabled={chosen !== null}
            >
              <span className="quiz-letter">{'ABCD'[optionIndex]}</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      <p className="engine-tip">
        {meta.title} · {question.hint ?? 'Elige una respuesta'}
      </p>

      <ResultOverlay
        open={resultOpen}
        emoji={correct === questions.length ? '🏆' : correct >= questions.length / 2 ? '🎉' : '📚'}
        title={correct === questions.length ? '¡Pleno!' : 'Ronda terminada'}
        subtitle={`${correct} de ${questions.length} respuestas correctas`}
        score={correct * 100 + bestStreak * 25}
        extra={<p className="result-extra">Mejor racha: {bestStreak} 🔥</p>}
        onRetry={restart}
        onExit={() => setResultOpen(false)}
      />
    </div>
  );
}
