import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { OUTDOOR_GAMES } from '../data/realLife';
import type { OutdoorCategory } from '../types';
import { Icon } from '../components/Icon';

const CATEGORIES: { id: OutdoorCategory | 'Todas'; emoji: string }[] = [
  { id: 'Todas', emoji: '🌳' },
  { id: 'Persecución', emoji: '🏃' },
  { id: 'Escondite', emoji: '🫣' },
  { id: 'Equipos', emoji: '🚩' },
  { id: 'Habilidad', emoji: '🎯' },
  { id: 'Fiesta', emoji: '🎉' },
  { id: 'Nocturno', emoji: '🌙' }
];

const FEATURED = ['captura-la-bandera', 'manhunt', 'sardinas'];

export default function OutdoorList() {
  const [category, setCategory] = useState<OutdoorCategory | 'Todas'>('Todas');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const featured = useMemo(
    () => FEATURED.map((id) => OUTDOOR_GAMES.find((game) => game.id === id)).filter(Boolean),
    []
  );

  const games = useMemo(() => {
    const text = query.trim().toLowerCase();
    return OUTDOOR_GAMES.filter((game) => {
      if (category !== 'Todas' && game.category !== category) return false;
      if (!text) return true;
      return (
        game.name.toLowerCase().includes(text) ||
        game.tagline.toLowerCase().includes(text) ||
        game.tags.some((tag) => tag.includes(text))
      );
    });
  }, [category, query]);

  return (
    <div className="screen outdoor-list">
      <header className="topbar">
        <div>
          <span className="page-kicker">Juegos fuera de pantalla</span>
          <h1 className="page-title">La calle es el tablero</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => setSearchOpen((value) => !value)} aria-label="Buscar juego al aire libre">
          <Icon name="search" size={19} />
        </button>
      </header>

      <section className="outdoor-hero">
        <div className="outdoor-hero-text">
          <span className="hero-kicker">
            <i /> {OUTDOOR_GAMES.length} guías completas
          </span>
          <h2>Reglas, mapa de zona y árbitro en el mismo sitio.</h2>
          <p>Captura la bandera, manhunt, sardinas, policías y ladrones y muchos más. Marca bases en el mapa, cronometra rondas y apunta los puntos.</p>
        </div>
        <div className="outdoor-hero-art" aria-hidden="true">
          <span>🚩</span>
          <span>🗺️</span>
          <span>🌳</span>
        </div>
      </section>

      <div className="outdoor-perks">
        <span>📍 Marcas en el mapa</span>
        <span>⏱️ Modo árbitro</span>
        <span>🛡️ Consejos de seguridad</span>
      </div>

      {searchOpen ? (
        <div className="searchbar" style={{ marginBottom: 14 }}>
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca manhunt, bandera, escondite…"
            autoFocus
          />
          {query ? (
            <button type="button" className="icon-btn small" onClick={() => setQuery('')} aria-label="Limpiar">
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="category-scroll">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip ${category === item.id ? 'active' : ''}`}
            onClick={() => setCategory(item.id)}
          >
            {item.emoji} {item.id}
          </button>
        ))}
      </div>

      {category === 'Todas' && !query ? (
        <section className="section">
          <div className="section-head">
            <h2>Clásicos para empezar</h2>
          </div>
          <div className="featured-outdoor">
            {featured.map((game) =>
              game ? (
                <Link key={game.id} to={`/vida-real/${game.id}`} className={`featured-outdoor-card tone-aire ${game.id === 'captura-la-bandera' ? 'is-big' : ''}`}>
                  <span className="featured-outdoor-emoji">{game.emoji}</span>
                  <span className="featured-outdoor-body">
                    <strong>{game.name}</strong>
                    <small>{game.tagline}</small>
                    <span className="outdoor-meta">
                      <span>👥 {game.players}</span>
                      <span>⏱️ {game.duration}</span>
                    </span>
                  </span>
                  <Icon name="arrow-right" size={18} />
                </Link>
              ) : null
            )}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h2>{category === 'Todas' ? 'Todas las guías' : category}</h2>
          <span className="faint">{games.length} juegos</span>
        </div>
        <div className="outdoor-grid">
          {games.map((game) => (
            <Link key={game.id} to={`/vida-real/${game.id}`} className="outdoor-card">
              <span className="outdoor-card-emoji">{game.emoji}</span>
              <span className="outdoor-card-body">
                <strong>{game.name}</strong>
                <small>{game.tagline}</small>
                <span className="outdoor-meta">
                  <span>👥 {game.players}</span>
                  <span>⏱️ {game.duration}</span>
                  <span className="badge">{game.category}</span>
                </span>
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
          ))}
        </div>
        {!games.length ? (
          <div className="empty">
            <div className="big">🌱</div>
            <h2>Nada por aquí</h2>
            <p className="muted">Prueba otra categoría o borra la búsqueda.</p>
          </div>
        ) : null}
      </section>

      <section className="outdoor-howto">
        <h2>Cómo usar las guías</h2>
        <div className="howto-grid">
          <div>
            <span>1</span>
            <strong>Elige el juego</strong>
            <p>Revisa jugadores, espacio y materiales antes de salir.</p>
          </div>
          <div>
            <span>2</span>
            <strong>Marca la zona</strong>
            <p>Centra el mapa, coloca banderas, bases y cárcel.</p>
          </div>
          <div>
            <span>3</span>
            <strong>Arbitra la ronda</strong>
            <p>Usa cronómetro, marcador y registro de puntos.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
