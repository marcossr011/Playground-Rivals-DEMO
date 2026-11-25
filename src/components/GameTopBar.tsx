import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import type { GameMeta } from '../types';
import { Icon } from './Icon';

interface GameTopBarProps {
  meta: GameMeta;
  onBack: () => void;
  onInfo: () => void;
  right?: React.ReactNode;
}

export function GameTopBar({ meta, onBack, onInfo, right }: GameTopBarProps) {
  const { isFavorite, toggleFavorite } = useApp();
  const fav = isFavorite(meta.id);

  return (
    <header className="play-topbar">
      <button type="button" className="icon-btn" onClick={onBack} aria-label="Volver">
        <Icon name="arrow-left" size={20} />
      </button>
      <div className="play-heading">
        <span className="play-emoji" aria-hidden="true">
          {meta.emoji}
        </span>
        <div>
          <h1>{meta.title}</h1>
          <p>
            {meta.category} · {meta.players}
          </p>
        </div>
      </div>
      <div className="play-actions">
        {right}
        <button type="button" className="icon-btn small" onClick={onInfo} aria-label="Cómo se juega">
          <Icon name="info" size={18} />
        </button>
        <button
          type="button"
          className={`icon-btn small ${fav ? 'active' : ''}`}
          onClick={() => toggleFavorite(meta.id)}
          aria-label={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          aria-pressed={fav}
        >
          <Icon name="heart" size={17} filled={fav} />
        </button>
      </div>
    </header>
  );
}

export function GameInfoSheet({ meta, onClose }: { meta: GameMeta; onClose: () => void }) {
  return (
    <div>
      <div className="row" style={{ gap: 12 }}>
        <span style={{ fontSize: 38 }}>{meta.emoji}</span>
        <div>
          <h2>{meta.title}</h2>
          <p className="lead" style={{ marginTop: 2 }}>
            {meta.category} · {meta.players}
            {meta.difficulty ? ` · ${meta.difficulty}` : ''}
          </p>
        </div>
      </div>
      <p className="lead" style={{ marginTop: 14 }}>
        {meta.blurb}
      </p>
      <div className="divider" />
      <div className="info-row">
        <span className="faint">Modos</span>
        <span>{meta.modes.includes('online') ? 'Solo, salas online' : meta.modes.includes('local') ? 'Solo y 2 jugadores' : 'Un jugador'}</span>
      </div>
      {meta.duration ? (
        <div className="info-row">
          <span className="faint">Duración</span>
          <span>{meta.duration}</span>
        </div>
      ) : null}
      <div className="info-row">
        <span className="faint">Etiquetas</span>
        <span>{meta.tags.slice(0, 4).join(' · ')}</span>
      </div>
      {meta.variantOf ? (
        <p className="tiny-note">Esta entrada es una variante del juego base «{meta.variantOf}» con reglas propias de configuración.</p>
      ) : null}
      <div className="sheet-actions">
        <button type="button" className="btn btn-ghost btn-wide" onClick={onClose}>
          Volver al juego
        </button>
      </div>
    </div>
  );
}

export function PlayFooterLink() {
  return (
    <div className="play-footer">
      <Link to="/explorar" className="section-link">
        Seguir explorando <Icon name="chevron-right" size={14} />
      </Link>
    </div>
  );
}
