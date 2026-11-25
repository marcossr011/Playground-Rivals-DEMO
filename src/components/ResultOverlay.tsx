import { Sheet } from './Sheet';

interface ResultOverlayProps {
  open: boolean;
  emoji: string;
  title: string;
  subtitle?: string;
  score?: number;
  scoreLabel?: string;
  extra?: React.ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  onExit: () => void;
}

export function ResultOverlay({
  open,
  emoji,
  title,
  subtitle,
  score,
  scoreLabel = 'puntos',
  extra,
  retryLabel = 'Jugar otra vez',
  onRetry,
  onExit
}: ResultOverlayProps) {
  return (
    <Sheet open={open} onClose={onExit} label="Fin de la partida">
      <div className="result-card">
        <div className="result-emoji" aria-hidden="true">
          {emoji}
        </div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
        {typeof score === 'number' ? (
          <div className="result-score">
            {Math.round(score)}
            <small>{scoreLabel}</small>
          </div>
        ) : null}
        {extra}
        <div className="sheet-actions">
          {onRetry ? (
            <button type="button" className="btn btn-primary btn-wide" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-wide" onClick={onExit}>
            Volver
          </button>
        </div>
      </div>
    </Sheet>
  );
}
