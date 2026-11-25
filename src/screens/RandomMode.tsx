import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { AvatarVisual } from '../components/AvatarVisual';
import { useApp } from '../state/AppContext';
import { displayAvatar } from '../lib/avatar';
import { CATEGORIES, ONLINE_GAMES, getGame, searchGames } from '../data/catalog';
import { LEAGUE_TIERS, leagueProgress } from '../lib/leagues';
import { pick } from '../lib/random';
import { rememberRandomSession } from '../lib/randomSession';
import type { Category } from '../types';

const BOT_CATEGORIES = CATEGORIES.filter((category) => category.id !== 'Aire libre');
const LEVELS: { id: 'facil' | 'normal' | 'dificil'; label: string; help: string }[] = [
  { id: 'facil', label: 'Fácil', help: 'Para calentar' },
  { id: 'normal', label: 'Normal', help: 'Equilibrado' },
  { id: 'dificil', label: 'Difícil', help: 'Sufrir un poco' }
];
const BOARD_CANDIDATES = ONLINE_GAMES.filter((game) => ['ttt-3x3-normal', 'c4-7x6-normal', 'reversi-8x8-normal'].includes(game.metaId));

export default function RandomMode() {
  const navigate = useNavigate();
  const { state } = useApp();
  const [mode, setMode] = useState<'bots' | 'people'>('bots');
  const [level, setLevel] = useState<'facil' | 'normal' | 'dificil'>('normal');
  const [category, setCategory] = useState<Category | 'Todas'>('Todas');
  const [format, setFormat] = useState<'1v1' | 'tournament'>('1v1');
  const [boardGame, setBoardGame] = useState<string>('sorpresa');

  const league = useMemo(() => leagueProgress(state.league), [state.league]);

  const peoplePool = useMemo(
    () => ONLINE_GAMES.filter((game) => category === 'Todas' || getGame(game.metaId)?.category === category),
    [category]
  );

  const launch = () => {
    if (mode === 'bots') {
      const pool = searchGames({ category, mode: 'solo' }).filter((game) => game.family !== 'outdoor');
      if (!pool.length) return;
      const chosen = pick(pool);
      rememberRandomSession({ mode: 'bots', category, level, format: '1v1' });
      navigate(`/juego/${chosen.id}`);
      return;
    }
    if (format === 'tournament') {
      const chosen = boardGame === 'sorpresa' ? pick(BOARD_CANDIDATES) : BOARD_CANDIDATES.find((game) => game.metaId === boardGame);
      if (!chosen) return;
      rememberRandomSession({ mode: 'people', category: 'Estrategia', level, format: 'tournament' });
      navigate(`/torneo/${chosen.metaId}`);
      return;
    }
    if (!peoplePool.length) return;
    const chosen = pick(peoplePool);
    rememberRandomSession({ mode: 'people', category, level, format: '1v1' });
    navigate(`/salas?juego=${encodeURIComponent(chosen.metaId)}&rapida=1`);
  };

  const launchLabel =
    mode === 'bots' ? 'Jugar contra un bot' : format === 'tournament' ? 'Entrar a un torneo de 4' : 'Buscar rival aleatorio';
  const disabled = mode === 'people' && format === '1v1' && !peoplePool.length;

  return (
    <div className="screen">
      <header className="topbar">
        <Link to="/" className="icon-btn" aria-label="Volver al inicio">
          <Icon name="arrow-left" size={20} />
        </Link>
        <span className="page-kicker">Modo aleatorio</span>
        <Link to="/perfil" className="avatar-chip" aria-label="Tu perfil">
          <AvatarVisual
            className="avatar-bubble"
            value={displayAvatar(state.profile)}
            fallback={state.profile.avatar}
          />
        </Link>
      </header>

      <section className="random-hero">
        <span className="random-die" aria-hidden="true">
          🎲
        </span>
        <span className="badge live">Competitivo</span>
        <h1>Que decida el azar.</h1>
        <p>Un rival, un juego, una liga. Elige contra bots o contra personas y deja que Recreo sortee la partida.</p>
      </section>

      <section className="league-card" aria-label="Tu liga">
        <div className="league-head">
          <span className="league-emoji">{league.tier.emoji}</span>
          <div>
            <h3>Liga {league.tier.name}</h3>
            <p>
              {state.league.wins}V · {state.league.losses}D · racha {state.league.streak} · mejor racha {state.league.bestStreak}
            </p>
          </div>
          <div className="league-points">
            <strong>{state.league.points}</strong>
            <small>puntos</small>
          </div>
        </div>
        <div className="league-bar">
          <span style={{ width: `${league.percent}%` }} />
        </div>
        <div className="league-meta">
          <span>{league.next ? `Siguiente: ${league.next.emoji} ${league.next.name}` : 'Rango máximo'}</span>
          <span>{league.next ? `${league.pointsToNext} pts · racha ${league.streakToNext}` : 'Leyenda'}</span>
        </div>
        <div className="random-chips" aria-label="Rangos de liga">
          {LEAGUE_TIERS.map((tier) => (
            <span key={tier.id} className={`chip tiny ${league.tier.id === tier.id ? 'active' : ''}`}>
              {tier.emoji} {tier.name}
            </span>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Elige el rival</h2>
            <p>La dificultad y el nivel no afectan a la liga: ganar suma</p>
          </div>
        </div>
        <div className="random-options">
          <button
            type="button"
            className={`random-option ${mode === 'bots' ? 'active' : ''}`}
            onClick={() => setMode('bots')}
            aria-pressed={mode === 'bots'}
          >
            <strong>🤖 Contra bots</strong>
            <small>Rival de la máquina, nivel ajustable.</small>
          </button>
          <button
            type="button"
            className={`random-option ${mode === 'people' ? 'active' : ''}`}
            onClick={() => setMode('people')}
            aria-pressed={mode === 'people'}
          >
            <strong>🌍 Contra personas</strong>
            <small>1 contra 1 o torneo de 4 con desconocidos.</small>
          </button>
        </div>
      </section>

      {mode === 'bots' ? (
        <>
          <section className="section">
            <div className="random-block">
              <span className="label">Dificultad del bot</span>
              <div className="random-options">
                {LEVELS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`random-option ${level === option.id ? 'active' : ''}`}
                    onClick={() => setLevel(option.id)}
                    aria-pressed={level === option.id}
                  >
                    <strong>{option.label}</strong>
                    <small>{option.help}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="random-block">
              <span className="label">Juegos</span>
              <div className="random-chips">
                <button type="button" className={`chip ${category === 'Todas' ? 'active' : ''}`} onClick={() => setCategory('Todas')}>
                  ✨ Todos los juegos
                </button>
                {BOT_CATEGORIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip ${category === item.id ? 'active' : ''}`}
                    onClick={() => setCategory(item.id)}
                  >
                    {item.emoji} {item.label}
                  </button>
                ))}
              </div>
              <p className="random-foot" style={{ textAlign: 'left', margin: 0 }}>
                Se sorteará un juego de {category === 'Todas' ? 'todo el catálogo' : `la categoría ${category}`}. La partida cuenta para tu liga.
              </p>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="section">
            <div className="random-block">
              <span className="label">Formato online</span>
              <div className="random-options">
                <button
                  type="button"
                  className={`random-option ${format === '1v1' ? 'active' : ''}`}
                  onClick={() => setFormat('1v1')}
                  aria-pressed={format === '1v1'}
                >
                  <strong>⚔️ 1 contra 1</strong>
                  <small>Emparejamiento rápido con un desconocido.</small>
                </button>
                <button
                  type="button"
                  className={`random-option ${format === 'tournament' ? 'active' : ''}`}
                  onClick={() => setFormat('tournament')}
                  aria-pressed={format === 'tournament'}
                >
                  <strong>🏆 Torneo de 4</strong>
                  <small>Semifinales y final. Dos victorias.</small>
                </button>
              </div>
            </div>
          </section>

          {format === '1v1' ? (
            <section className="section">
              <div className="random-block">
                <span className="label">Categoría online</span>
                <div className="random-chips">
                  <button type="button" className={`chip ${category === 'Todas' ? 'active' : ''}`} onClick={() => setCategory('Todas')}>
                    ✨ Todos los duelos
                  </button>
                  {CATEGORIES.filter((item) => item.id === 'Estrategia' || item.id === 'Trivia').map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`chip ${category === item.id ? 'active' : ''}`}
                      onClick={() => setCategory(item.id)}
                    >
                      {item.emoji} {item.label}
                    </button>
                  ))}
                </div>
                <p className="random-foot" style={{ textAlign: 'left', margin: 0 }}>
                  {peoplePool.length
                    ? `Se sorteará entre ${peoplePool.map((game) => game.name).join(', ')}.`
                    : 'No hay duelos online en esa categoría. Prueba con Estrategia o Trivia.'}
                </p>
              </div>
            </section>
          ) : (
            <section className="section">
              <div className="random-block">
                <span className="label">Juego del torneo</span>
                <div className="random-chips">
                  <button
                    type="button"
                    className={`chip ${boardGame === 'sorpresa' ? 'active' : ''}`}
                    onClick={() => setBoardGame('sorpresa')}
                  >
                    🎲 Sorpréndeme
                  </button>
                  {BOARD_CANDIDATES.map((game) => (
                    <button
                      key={game.metaId}
                      type="button"
                      className={`chip ${boardGame === game.metaId ? 'active' : ''}`}
                      onClick={() => setBoardGame(game.metaId)}
                    >
                      {game.emoji} {game.name}
                    </button>
                  ))}
                </div>
                <p className="random-foot" style={{ textAlign: 'left', margin: 0 }}>
                  Torneos solo de estrategia, con gente de cualquier parte. Ganar la final cuenta como victoria de liga.
                </p>
              </div>
            </section>
          )}
        </>
      )}

      <button type="button" className="btn btn-primary btn-wide random-launch" onClick={launch} disabled={disabled}>
        <Icon name={mode === 'bots' ? 'dice' : format === 'tournament' ? 'trophy' : 'users'} size={18} /> {launchLabel}
      </button>
      <p className="random-foot">
        Liga: victoria +25 puntos y +5 extra por cada victoria seguida (máx. +50). Derrota −10 y racha a cero.
        Sube de Bronce a Leyenda por puntos o racha.
      </p>
    </div>
  );
}
