import { Link } from 'react-router-dom';
import type { GameMeta } from '../types';
import { useApp } from '../state/AppContext';
import { categoryTone, gameHref, primaryMode } from '../lib/gameUi';
import { Icon } from './Icon';

interface GameTileProps {
  meta: GameMeta;
}

export function GameTile({ meta }: GameTileProps) {
  const { isFavorite, toggleFavorite } = useApp();
  const fav = isFavorite(meta.id);

  return (
    <article className={`game-tile ${categoryTone(meta.category)}`}>
      <Link to={gameHref(meta)} className="tile-link" aria-label={`Jugar a ${meta.title}`}>
        <div className="tile-art">
          <span className="tile-glyph" aria-hidden="true">
            {meta.emoji}
          </span>
          <span className="tile-corner">{primaryMode(meta)}</span>
        </div>
        <div className="tile-body">
          <h3 className="tile-title">{meta.title}</h3>
          <div className="tile-meta">
            <span>{meta.category}</span>
            {meta.difficulty ? (
              <>
                <i className="dot" />
                <span>{meta.difficulty}</span>
              </>
            ) : meta.duration ? (
              <>
                <i className="dot" />
                <span>{meta.duration}</span>
              </>
            ) : null}
          </div>
        </div>
      </Link>
      <button
        type="button"
        className={`tile-fav ${fav ? 'active' : ''}`}
        aria-label={fav ? `Quitar ${meta.title} de favoritos` : `Añadir ${meta.title} a favoritos`}
        aria-pressed={fav}
        onClick={() => toggleFavorite(meta.id)}
      >
        <Icon name="heart" size={16} filled={fav} />
      </button>
    </article>
  );
}
