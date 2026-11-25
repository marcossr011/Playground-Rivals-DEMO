import { Link, useNavigate, useParams } from 'react-router-dom';
import { OUTDOOR_GAMES } from '../data/realLife';
import { ZoneMap, RefereePanel } from '../components/ZoneMap';
import { OutdoorRoomLauncher } from '../components/OutdoorRoomLauncher';
import { Icon } from '../components/Icon';

export default function OutdoorGuide() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const game = OUTDOOR_GAMES.find((item) => item.id === id);

  if (!game) {
    return (
      <div className="app-frame">
        <div className="not-found">
          <div>
            <div className="big">🗺️</div>
            <h1 style={{ marginTop: 14 }}>Guía no encontrada</h1>
            <p className="muted" style={{ marginTop: 6 }}>Este juego al aire libre no está en el catálogo.</p>
            <Link to="/vida-real" className="btn btn-primary" style={{ marginTop: 18 }}>Ver todas las guías</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <div className="screen outdoor-guide">
        <header className="play-topbar">
          <button type="button" className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/vida-real'))} aria-label="Volver">
            <Icon name="arrow-left" size={20} />
          </button>
          <div className="play-heading">
            <span className="play-emoji" aria-hidden="true">{game.emoji}</span>
            <div>
              <h1>{game.name}</h1>
              <p>{game.category} · {game.players}</p>
            </div>
          </div>
          <div className="play-actions">
            <Link to="/vida-real" className="icon-btn small" aria-label="Todas las guías">
              <Icon name="grid" size={18} />
            </Link>
          </div>
        </header>

        <section className="guide-hero tone-aire">
          <span className="guide-hero-emoji">{game.emoji}</span>
          <p className="guide-tagline">{game.tagline}</p>
          <div className="guide-meta">
            <span>👥 {game.players}</span>
            <span>⏱️ {game.duration}</span>
            <span>🪐 {game.space}</span>
          </div>
        </section>

        <section className="guide-section guide-objective">
          <span className="guide-label">Objetivo</span>
          <p>{game.objective}</p>
        </section>

        <section className="guide-section">
          <OutdoorRoomLauncher outdoorId={game.id} title={game.name} />
        </section>

        <section className="guide-section">
          <h2>Antes de empezar</h2>
          <div className="guide-facts">
            <div>
              <span className="guide-fact-emoji">👥</span>
              <strong>{game.players}</strong>
              <small>Mínimo {game.minPlayers} jugadores</small>
            </div>
            <div>
              <span className="guide-fact-emoji">⏱️</span>
              <strong>{game.duration}</strong>
              <small>Ronda arbitrada: {game.referee.durationMinutes} min</small>
            </div>
            <div>
              <span className="guide-fact-emoji">🪐</span>
              <strong>Espacio</strong>
              <small>{game.space}</small>
            </div>
          </div>
          <div className="material-box">
            <span className="guide-label">Materiales</span>
            {game.materials.length ? (
              <ul className="material-list">
                {game.materials.map((item) => (
                  <li key={item}><span>🎒</span>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No hace falta material: solo ganas y un espacio seguro.</p>
            )}
          </div>
        </section>

        <section className="guide-section">
          <h2>Reglas</h2>
          <ol className="rule-list">
            {game.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </section>

        <section className="guide-section">
          <div className="section-head">
            <h2>Mapa de la zona</h2>
            <span className="badge">Se guarda en tu móvil</span>
          </div>
          <p className="guide-intro">Centra el mapa en el parque o patio, coloca las banderas y las bases y comparte la zona con el resto. Pulsa un tipo de marca y después toca el mapa.</p>
          <ZoneMap gameId={game.id} />
        </section>

        <section className="guide-section">
          <RefereePanel teams={game.referee.teams} durationMinutes={game.referee.durationMinutes} scoreHint={game.referee.scoreHint} />
        </section>

        <section className="guide-section">
          <h2>Variantes</h2>
          <ul className="variant-list">
            {game.variants.map((variant) => (
              <li key={variant}>{variant}</li>
            ))}
          </ul>
        </section>

        <section className="guide-section guide-safety">
          <h2>
            <Icon name="shield" size={18} /> Seguridad
          </h2>
          <ul className="safety-list">
            {game.safety.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <div className="guide-tags">
          {game.tags.map((tag) => (
            <span key={tag} className="chip tiny">#{tag}</span>
          ))}
        </div>

        <div className="play-footer">
          <Link to="/vida-real" className="section-link">
            Ver todas las guías <Icon name="chevron-right" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
