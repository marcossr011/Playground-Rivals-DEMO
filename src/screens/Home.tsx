import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES, FEATURED_GAMES, GAME_MAP, GAMES, TOTAL_GAMES, getGame } from '../data/catalog';
import { OUTDOOR_GAMES } from '../data/realLife';
import { useApp } from '../state/AppContext';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import { AvatarVisual } from '../components/AvatarVisual';
import { displayAvatar } from '../lib/avatar';
import { categoryTone, gameHref } from '../lib/gameUi';
import { leagueProgress } from '../lib/leagues';
import { pick } from '../lib/random';
import type { GameMeta, OutdoorGame } from '../types';

const STREET_IDS = ['escondite-clasico', 'captura-la-bandera', 'pilla-pilla', 'busqueda-del-tesoro'];

const streetGames = STREET_IDS.map((id) => OUTDOOR_GAMES.find((game) => game.id === id)).filter(
  (game): game is OutdoorGame => Boolean(game)
);

const glows: Record<string, string> = {
  Arcade: 'rgba(255, 106, 61, 0.5)',
  Cartas: 'rgba(255, 93, 143, 0.45)',
  Estrategia: 'rgba(87, 184, 255, 0.42)',
  Fiesta: 'rgba(179, 102, 255, 0.45)',
  Palabras: 'rgba(66, 226, 166, 0.4)',
  Puzzle: 'rgba(123, 97, 255, 0.5)',
  Trivia: 'rgba(255, 201, 74, 0.4)',
  'Aire libre': 'rgba(66, 226, 166, 0.42)'
};

function uniqueFamilies(games: GameMeta[], count: number): GameMeta[] {
  const result: GameMeta[] = [];
  const families = new Set<string>();
  for (const game of games) {
    if (families.has(game.family)) continue;
    families.add(game.family);
    result.push(game);
    if (result.length >= count) break;
  }
  return result;
}

function byIds(ids: string[]): GameMeta[] {
  return ids.map((id) => getGame(id)).filter((game): game is GameMeta => Boolean(game));
}

export default function Home() {
  const navigate = useNavigate();
  const { state } = useApp();
  const league = leagueProgress(state.league);

  const featured = useMemo(() => uniqueFamilies(FEATURED_GAMES, 6), []);
  const recent = useMemo(
    () => state.recent.map((id) => GAME_MAP.get(id)).filter((game): game is GameMeta => Boolean(game)).slice(0, 4),
    [state.recent]
  );

  const soloGames = byIds(['klondike-1-clasico', 'minas-16x16-40', '2048-4-2048', 'sopa-animales-10-normal']);
  const togetherGames = byIds(['ttt-3x3-normal', 'c4-7x6-normal', 'mem-animales-pairs-4x4', 'mimica-animales-normal']);

  const surprise = () => {
    const pool = GAMES.filter((game) => game.family !== 'outdoor');
    navigate(gameHref(pick(pool)));
  };

  return (
    <div className="screen">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Recreo, inicio">
          <img src="/recreo-mark.svg" alt="" className="brand-mark" />
          <span className="brand-word">
            recre<span>o</span>
          </span>
        </Link>
        <div className="topbar-actions">
          <Link to="/aleatorio" className="icon-btn" aria-label="Modo aleatorio">
            <Icon name="dice" size={19} />
          </Link>
          <Link to="/explorar" className="icon-btn" aria-label="Buscar juegos">
            <Icon name="search" size={19} />
          </Link>
          <Link to="/perfil" className="avatar-chip" aria-label="Tu perfil">
            <AvatarVisual
              className="avatar-bubble"
              value={displayAvatar(state.profile)}
              fallback={state.profile.avatar}
            />
            <span className="avatar-name">{state.profile.name}</span>
          </Link>
        </div>
      </header>

      <section className="hero">
        <span className="hero-kicker">
          <i /> {TOTAL_GAMES.toLocaleString('es-ES')} juegos y retos
        </span>
        <h1>
          El recreo
          <br />
          <em>no tiene fin.</em>
        </h1>
        <p>Solitarios para tu pausa, salas con amigos o desconocidos y juegos para salir a la calle.</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={surprise}>
            <Icon name="dice" size={18} /> Sorpréndeme
          </button>
          <Link to="/salas" className="btn btn-ghost">
            <Icon name="users" size={18} /> Jugar con gente
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-tile t1">⭕</div>
          <div className="hero-tile t2">🎭</div>
          <div className="hero-tile t3">🗺️</div>
        </div>
      </section>

      <div className="category-scroll" role="list" aria-label="Categorías">
        {CATEGORIES.map((category) => (
          <Link
            key={category.id}
            to={`/explorar?categoria=${encodeURIComponent(category.id)}`}
            className="category-pill"
            role="listitem"
          >
            <span aria-hidden="true">{category.emoji}</span>
            {category.label}
            <span className="faint" style={{ fontSize: 10 }}>
              {category.count}
            </span>
          </Link>
        ))}
      </div>

      {recent.length ? (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Sigue jugando</h2>
              <p>Donde lo dejaste</p>
            </div>
            <Link to="/perfil" className="section-link">
              Historial <Icon name="chevron-right" size={14} />
            </Link>
          </div>
          <div className="game-grid">
            {recent.slice(0, 2).map((game) => (
              <GameTile key={game.id} meta={game} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Elegidos para hoy</h2>
            <p>Una mezcla de todo el recreo</p>
          </div>
          <Link to="/explorar" className="section-link">
            Ver todo <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        <div className="hscroll">
          {featured.map((game) => (
            <Link
              key={game.id}
              to={gameHref(game)}
              className={`feature-card ${categoryTone(game.category)}`}
              style={{ '--feature-glow': glows[game.category] } as React.CSSProperties}
            >
              <span className="badge hot" style={{ alignSelf: 'flex-start' }}>
                {game.difficulty ?? game.category}
              </span>
              <h3 style={{ marginTop: 10 }}>{game.title}</h3>
              <p>{game.blurb}</p>
              <span className="feature-cta">
                Jugar ahora <Icon name="arrow-right" size={14} />
              </span>
              <span className="feature-emoji" aria-hidden="true">
                {game.emoji}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" id="juegos-app">
        <div className="section-head">
          <div>
            <h2>Juegos en la app</h2>
            <p>Solo, con amigos en el mismo móvil o contra gente</p>
          </div>
          <Link to="/explorar" className="section-link">
            Ver todo <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        <div className="home-split">
          <Link to="/salas" className="home-split-card is-active">
            <i />
            <span aria-hidden="true">🎮</span>
            <strong>Salas online</strong>
            <small>Código, rival rápido o torneo de 4</small>
          </Link>
          <Link to="/aleatorio" className="home-split-card">
            <i />
            <span aria-hidden="true">🎲</span>
            <strong>Modo aleatorio</strong>
            <small>
              {league.tier.emoji} {league.tier.name} · {state.league.points} pts · bots o personas
            </small>
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Para tu pausa</h2>
            <p>Solitarios que enganchan</p>
          </div>
          <Link to="/explorar?modo=solo" className="section-link">
            Más <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        <div className="game-grid">
          {soloGames.map((game) => (
            <GameTile key={game.id} meta={game} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Con amigos, mismo móvil</h2>
            <p>Pasa el teléfono y juega</p>
          </div>
          <Link to="/explorar?modo=local" className="section-link">
            Más <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        <div className="game-grid">
          {togetherGames.map((game) => (
            <GameTile key={game.id} meta={game} />
          ))}
        </div>
      </section>

      <section className="section" id="juegos-calle">
        <div className="section-head">
          <div>
            <h2>Juegos de vida real</h2>
            <p>Escondite, captura la bandera, pilla-pilla y búsqueda del tesoro</p>
          </div>
          <Link to="/vida-real" className="section-link">
            Las {OUTDOOR_GAMES.length} guías <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        <div className="street-feature-grid">
          {streetGames.map((game) => (
            <Link key={game.id} to={`/vida-real/${game.id}`} className="street-feature">
              <span className="big" aria-hidden="true">
                {game.emoji}
              </span>
              <div>
                <strong>{game.name}</strong>
                <small>
                  {game.players} · {game.duration}
                </small>
              </div>
              <Icon name="chevron-right" size={16} />
            </Link>
          ))}
        </div>
        <p className="street-note">
          Solo entre conocidos: la sala se abre con un código de amigo, la zona se elige en el mapa del mundo y se cierra
          sola, siempre con permiso explícito.
        </p>
        <Link to="/vida-real" className="btn btn-ghost btn-wide" style={{ marginTop: 12 }}>
          Ver todas las guías de calle <Icon name="arrow-right" size={16} />
        </Link>
      </section>

      <section className="section">
        <Link to="/explorar" className="btn btn-ghost btn-wide">
          Explorar los {TOTAL_GAMES.toLocaleString('es-ES')} juegos <Icon name="arrow-right" size={16} />
        </Link>
        <p className="tinytip">
          Incluye juegos base, variantes de dificultad y retos generados. Cada entrada se puede jugar.
        </p>
      </section>
    </div>
  );
}
