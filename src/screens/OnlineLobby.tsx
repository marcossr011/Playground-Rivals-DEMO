import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ONLINE_GAMES } from '../data/catalog';
import { Icon } from '../components/Icon';
import { AvatarVisual } from '../components/AvatarVisual';
import { useApp } from '../state/AppContext';
import { displayAvatar, networkAvatar } from '../lib/avatar';
import { rememberSeat, whenOnline } from '../net/socket';
import type { ActionAck } from '../shared/online';

type Mode = 'codigo' | 'rapido';

function emitAck(
  event: 'room:create' | 'room:join' | 'room:quick',
  payload: { gameId: string; name: string; avatar: string } | { code: string; name: string; avatar: string }
): Promise<ActionAck> {
  return whenOnline().then(
    (socket) =>
      new Promise<ActionAck>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('El servidor no responde. Prueba otra vez.')), 8000);
        const done = (response: ActionAck) => {
          window.clearTimeout(timer);
          resolve(response);
        };
        if (event === 'room:join') {
          socket.emit('room:join', payload as { code: string; name: string; avatar: string }, done);
        } else {
          const room = payload as { gameId: string; name: string; avatar: string };
          if (event === 'room:create') socket.emit('room:create', room, done);
          else socket.emit('room:quick', room, done);
        }
      })
  );
}

export default function OnlineLobby() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { state } = useApp();
  const requested = params.get('juego');
  const requestedInitial = ONLINE_GAMES.some((game) => game.metaId === requested) ? (requested as string) : ONLINE_GAMES[0].metaId;
  const [selected, setSelected] = useState(requestedInitial);
  const [mode, setMode] = useState<Mode>(params.get('rapida') === '1' ? 'rapido' : 'codigo');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<Mode | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const game = ONLINE_GAMES.find((item) => item.metaId === selected) ?? ONLINE_GAMES[0];
  const profile = { name: state.profile.name, avatar: networkAvatar(state.profile) };

  const enter = (response: ActionAck) => {
    if (!response.ok || !response.code || !response.playerId) {
      setError(response.error ?? 'No se pudo abrir la sala.');
      setBusy(null);
      return;
    }
    rememberSeat(response.code, response.playerId);
    navigate(`/sala/${response.code}`);
  };

  const createRoom = async () => {
    setBusy('codigo');
    setError(null);
    try {
      enter(await emitAck('room:create', { gameId: selected, ...profile }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error de conexión.');
      setBusy(null);
    }
  };

  const quickMatch = async () => {
    setBusy('rapido');
    setError(null);
    try {
      enter(await emitAck('room:quick', { gameId: selected, ...profile }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error de conexión.');
      setBusy(null);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Escribe el código de 4 caracteres.');
      return;
    }
    setBusy('join');
    setError(null);
    try {
      enter(await emitAck('room:join', { code, ...profile }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error de conexión.');
      setBusy(null);
    }
  };

  useEffect(() => {
    if (params.get('rapida') !== '1' || autoStarted.current) return;
    autoStarted.current = true;
    void quickMatch();
    // El modo aleatorio llega con la búsqueda ya disparada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen online-lobby">
      <header className="topbar">
        <Link to="/" className="icon-btn" aria-label="Volver al inicio">
          <Icon name="arrow-left" size={20} />
        </Link>
        <span className="page-kicker">Salas online</span>
        <Link to="/perfil" className="avatar-chip" aria-label="Tu perfil">
          <AvatarVisual
            className="avatar-bubble"
            value={displayAvatar(state.profile)}
            fallback={state.profile.avatar}
          />
        </Link>
      </header>

      <section className="online-hero">
        <span className="hero-kicker">
          <i /> Duelos en tiempo real
        </span>
        <h1>Juega con quien sea, ahora.</h1>
        <p>Crea una sala privada y comparte el código, o busca un rival al instante. Sin registro.</p>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Elige tu duelo</h2>
            <p>Cuatro clásicos con partidas rápidas</p>
          </div>
          <span className="badge live">En vivo</span>
        </div>
        <div className="online-games">
          {ONLINE_GAMES.map((item) => {
            const meta = item.metaId === selected;
            return (
              <button
                key={item.metaId}
                type="button"
                className={`online-game ${meta ? 'is-selected' : ''}`}
                onClick={() => setSelected(item.metaId)}
                aria-pressed={meta}
              >
                <span className="online-game-emoji" aria-hidden="true">
                  {item.emoji}
                </span>
                <span className="online-game-copy">
                  <strong>{item.name}</strong>
                  <small>{item.blurb}</small>
                </span>
                <Icon name={meta ? 'check' : 'chevron-right'} size={18} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="section online-panel">
        <div className="segmented">
          <button type="button" className={mode === 'codigo' ? 'active' : ''} onClick={() => setMode('codigo')}>
            Con código
          </button>
          <button type="button" className={mode === 'rapido' ? 'active' : ''} onClick={() => setMode('rapido')}>
            Rival rápido
          </button>
        </div>

        {mode === 'codigo' ? (
          <div className="stack" style={{ gap: 16 }}>
            <div className="online-choice">
              <span className="online-choice-icon" aria-hidden="true">
                🔗
              </span>
              <div className="grow">
                <h3>Abrir sala privada</h3>
                <p className="muted">Tú eliges {game.name.toLowerCase()} y compartes el código de 4 letras.</p>
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-wide" onClick={createRoom} disabled={busy !== null}>
              {busy === 'codigo' ? <span className="spin" /> : <Icon name="plus" size={18} />}
              Crear sala de {game.name}
            </button>

            <div className="online-divider">
              <span>o entra con un código</span>
            </div>

            <div className="online-join">
              <input
                className="input pin-input"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') joinRoom();
                }}
                placeholder="ABCD"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                aria-label="Código de sala"
                maxLength={4}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={joinRoom}
                disabled={busy !== null || joinCode.trim().length < 4}
              >
                {busy === 'join' ? <span className="spin" /> : <Icon name="arrow-right" size={18} />}
                Entrar
              </button>
            </div>
            <p className="tinytip">Pide el código a quien creó la partida. Se une el primero que entre.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            <div className="online-choice">
              <span className="online-choice-icon" aria-hidden="true">
                ⚡
              </span>
              <div className="grow">
                <h3>Rival rápido de {game.name.toLowerCase()}</h3>
                <p className="muted">Te emparejamos con otra persona que esté buscando el mismo juego.</p>
              </div>
            </div>
            <button type="button" className="btn btn-mint btn-wide" onClick={quickMatch} disabled={busy !== null}>
              {busy === 'rapido' ? <span className="spin" /> : <Icon name="dice" size={18} />}
              Buscar rival ahora
            </button>
            <p className="tinytip">Si no hay nadie esperando, se abre una sala y el próximo jugador entra solo.</p>
          </div>
        )}

        {error ? (
          <p className="online-error" role="alert">
            <Icon name="info" size={16} /> {error}
          </p>
        ) : null}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Cómo funciona</h2>
            <p>De la nada al duelo en tres pasos</p>
          </div>
        </div>
        <ol className="online-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Elige juego y sala</strong>
              <p>Privada con código para tus amigos o rápida para conocer gente.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Comparte o espera</strong>
              <p>El código de 4 caracteres se copia y se pega en cualquier chat.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Juega y pide revancha</strong>
              <p>Turnos de 45 segundos. Si alguien se va, la partida se cierra sola.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="section">
        <div className="quick-row">
          <Link to={`/juego/${game.metaId}`} className="quick-card salas">
            <span className="big">{game.emoji}</span>
            <h3>Probar sin rival</h3>
            <p>{game.name} contra la máquina</p>
            <span className="feature-cta" style={{ marginTop: 10 }}>
              Jugar <Icon name="arrow-right" size={13} />
            </span>
          </Link>
          <Link to="/explorar?modo=online" className="quick-card calle">
            <span className="big">🌐</span>
            <h3>Más online</h3>
            <p>Explora los modos conectados</p>
            <span className="feature-cta" style={{ marginTop: 10 }}>
              Ver <Icon name="arrow-right" size={13} />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
