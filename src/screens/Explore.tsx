import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CATEGORIES, TOTAL_GAMES, searchGames } from '../data/catalog';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import type { Category, PlayMode } from '../types';

const modeOptions: { id: PlayMode | 'todos'; label: string; icon: 'compass' | 'user' | 'users' | 'wifi' }[] = [
  { id: 'todos', label: 'Todos', icon: 'compass' },
  { id: 'solo', label: 'Un jugador', icon: 'user' },
  { id: 'local', label: 'Mismo móvil', icon: 'users' },
  { id: 'online', label: 'Salas', icon: 'wifi' }
];

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const categoryParam = params.get('categoria');
  const modeParam = params.get('modo');
  const category: Category | 'Todas' = CATEGORIES.some((item) => item.id === categoryParam)
    ? (categoryParam as Category)
    : 'Todas';
  const mode: PlayMode | 'todos' = modeOptions.some((item) => item.id === modeParam)
    ? (modeParam as PlayMode | 'todos')
    : 'todos';

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [visible, setVisible] = useState(36);

  const results = useMemo(() => searchGames({ query, category, mode }), [query, category, mode]);

  useEffect(() => {
    setVisible(36);
  }, [query, category, mode]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'Todas' || value === 'todos') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <h1 style={{ fontSize: 30, letterSpacing: '-0.04em' }}>Explorar</h1>
          <p className="faint" style={{ fontSize: 12, marginTop: 3 }}>
            {TOTAL_GAMES.toLocaleString('es-ES')} juegos, retos y variantes
          </p>
        </div>
        <Link to="/" className="icon-btn" aria-label="Inicio">
          <Icon name="home" size={19} />
        </Link>
      </div>

      <div className="searchbar">
        <Icon name="search" size={19} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            const next = new URLSearchParams(params);
            if (event.target.value) next.set('q', event.target.value);
            else next.delete('q');
            setParams(next, { replace: true });
          }}
          placeholder="Busca un juego, un tema o una palabra"
          aria-label="Buscar juegos"
          enterKeyHint="search"
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              setQuery('');
              updateParam('q', '');
            }}
            aria-label="Borrar búsqueda"
          >
            <Icon name="x" size={14} />
          </button>
        ) : null}
      </div>

      <div className="filters" aria-label="Filtrar por modo">
        {modeOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip ${mode === option.id ? 'active' : ''}`}
            onClick={() => updateParam('modo', option.id)}
          >
            <Icon name={option.icon} size={13} />
            {option.label}
          </button>
        ))}
      </div>

      <div className="filters" aria-label="Filtrar por categoría">
        <button
          type="button"
          className={`chip ${category === 'Todas' ? 'active' : ''}`}
          onClick={() => updateParam('categoria', 'Todas')}
        >
          Todas
        </button>
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip ${category === item.id ? 'active' : ''}`}
            onClick={() => updateParam('categoria', item.id)}
          >
            <span aria-hidden="true">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="result-count">
        <b>{results.length.toLocaleString('es-ES')}</b> juegos{category !== 'Todas' ? ` de ${category}` : ''}
        {mode !== 'todos' ? ' para este modo' : ''}
      </div>

      {category === 'Aire libre' ? (
        <Link to="/vida-real" className="pwa-banner" style={{ marginTop: 0, marginBottom: 14 }}>
          <Icon name="map-pin" size={22} />
          <span className="grow">
            <b>Mapa, árbitro y temporizador</b>
            <br />
            Abre la sección de la calle para organizar la partida.
          </span>
          <Icon name="chevron-right" size={16} />
        </Link>
      ) : null}

      {results.length ? (
        <>
          <div className="game-grid">
            {results.slice(0, visible).map((game) => (
              <GameTile key={game.id} meta={game} />
            ))}
          </div>
          {visible < results.length ? (
            <div className="load-more">
              <button type="button" className="btn btn-ghost" onClick={() => setVisible((value) => value + 36)}>
                Cargar más ({Math.min(36, results.length - visible)})
              </button>
            </div>
          ) : null}
          <p className="tinytip">
            Cada ficha es una configuración jugable. Las variantes comparten motor pero cambian tablero, reglas,
            dificultad o duración.
          </p>
        </>
      ) : (
        <div className="empty">
          <div className="big">🔍</div>
          <h3>Nada por aquí</h3>
          <p>Prueba otra palabra o quita los filtros.</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => {
              setQuery('');
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
