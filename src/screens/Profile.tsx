import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApp, AVATARS } from '../state/AppContext';
import { FAMILY_INFO } from '../data/families';
import { GAMES, GAME_MAP } from '../data/catalog';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import { AvatarVisual } from '../components/AvatarVisual';
import { Sheet } from '../components/Sheet';
import { displayAvatar, fileToAvatar } from '../lib/avatar';
import { THEMES } from '../lib/theme';
import { PROFANITY_OPTIONS } from '../lib/profanity';
import { leagueProgress } from '../lib/leagues';
import { friendCodeFor } from '../lib/randomSession';
import { connectOnline, socket } from '../net/socket';
import type { ControlScheme, FamilyId, GameMeta } from '../types';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CONTROL_OPTIONS: { id: ControlScheme; label: string; help: string }[] = [
  { id: 'swipe', label: '👆 Deslizar', help: 'Desliza el dedo sobre el tablero para moverte.' },
  { id: 'joystick', label: '🕹️ Joystick', help: 'Mando en pantalla, ideal si varios juegan en un móvil.' }
];

export default function Profile() {
  const {
    state,
    updateProfile,
    updateSettings,
    resetProgress,
    addFriend,
    addFriendRequest,
    resolveFriendRequest,
    removeFriend
  } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(state.profile.name);
  const [avatar, setAvatar] = useState(state.profile.avatar);
  const [photo, setPhoto] = useState<string | undefined>(state.profile.photo);
  const [photoSmall, setPhotoSmall] = useState<string | undefined>(state.profile.photoSmall);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [toast, setToast] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const myCode = friendCodeFor(state.profile.id);
  const league = useMemo(() => leagueProgress(state.league), [state.league]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const active = connectOnline();
    const register = () => {
      active.emit('friend:register', { code: myCode, name: state.profile.name, avatar: state.profile.avatar }, () => {});
    };
    const onRequest = (request: { code: string; name: string; avatar: string; at: number }) => {
      addFriendRequest({ ...request, direction: 'incoming' });
      setToast(`Solicitud de amistad de ${request.name}.`);
    };
    const onAccepted = (accepted: { code: string; name: string; avatar: string; at: number }) => {
      addFriend({ code: accepted.code, name: accepted.name, avatar: accepted.avatar });
      resolveFriendRequest(accepted.code);
      setToast(`${accepted.name} aceptó tu solicitud de amistad.`);
    };
    const onDeclined = ({ code }: { code: string }) => {
      resolveFriendRequest(code);
      setToast(`Solicitud rechazada por ${code}.`);
    };
    active.on('friend:request', onRequest);
    active.on('friend:accepted', onAccepted);
    active.on('friend:declined', onDeclined);
    active.on('connect', register);
    if (active.connected) register();
    return () => {
      active.off('friend:request', onRequest);
      active.off('friend:accepted', onAccepted);
      active.off('friend:declined', onDeclined);
      active.off('connect', register);
    };
  }, [myCode, state.profile.name, state.profile.avatar, addFriend, addFriendRequest, resolveFriendRequest]);

  const totals = useMemo(() => {
    const entries = Object.values(state.stats);
    return {
      plays: entries.reduce((sum, stat) => sum + stat.plays, 0),
      wins: entries.reduce((sum, stat) => sum + stat.wins, 0),
      families: entries.length
    };
  }, [state.stats]);

  const topFamilies = useMemo(
    () =>
      (Object.entries(state.stats) as [FamilyId, { plays: number; wins: number; bestScore: number }][])
        .filter(([family]) => FAMILY_INFO[family])
        .sort(([, a], [, b]) => b.plays - a.plays)
        .slice(0, 5),
    [state.stats]
  );

  const favorites = useMemo(
    () => state.favorites.map((id) => GAME_MAP.get(id)).filter((game): game is GameMeta => Boolean(game)).slice(0, 4),
    [state.favorites]
  );
  const recent = useMemo(
    () => state.recent.map((id) => GAME_MAP.get(id)).filter((game): game is GameMeta => Boolean(game)).slice(0, 4),
    [state.recent]
  );

  const openEditor = () => {
    setName(state.profile.name);
    setAvatar(state.profile.avatar);
    setPhoto(state.profile.photo);
    setPhotoSmall(state.profile.photoSmall);
    setPhotoError('');
    setEditing(true);
  };

  const saveProfile = () => {
    updateProfile({ name, avatar, photo, photoSmall });
    setEditing(false);
  };

  const pickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const result = await fileToAvatar(file);
      setPhoto(result.photo);
      setPhotoSmall(result.photoSmall);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'No se pudo usar esa foto.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const clearPhoto = () => {
    setPhoto(undefined);
    setPhotoSmall(undefined);
    setPhotoError('');
  };

  const submitFriend = () => {
    const code = friendCode.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
    if (code.length < 4) {
      setToast('El código de amigo tiene al menos 4 caracteres.');
      return;
    }
    if (code === myCode) {
      setToast('Ese es tu propio código: compártelo con tus amigos.');
      return;
    }
    if (state.friends.some((friend) => friend.code === code)) {
      setToast('Ese amigo ya está en tu lista.');
      return;
    }
    if (state.friendRequests.some((request) => request.code === code)) {
      setToast('Ya existe una solicitud con ese código.');
      return;
    }
    const active = connectOnline();
    active.emit(
      'friend:request',
      { targetCode: code, name: state.profile.name, avatar: state.profile.avatar },
      (response) => {
        if (!response.ok) {
          setToast(response.error ?? 'No se pudo enviar la solicitud.');
          return;
        }
        addFriendRequest({ code, name: `Amigo ${code}`, avatar: '🙂', direction: 'outgoing' });
        setFriendCode('');
        setToast(`Solicitud enviada a ${code}. Tu amigo debe aceptarla.`);
      }
    );
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setToast('¡Recreo instalado! Ya está en tu pantalla de inicio.');
    setInstallEvent(null);
  };

  const share = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Recreo', text: 'Más de 1000 juegos para el móvil y la calle', url });
      } else {
        await navigator.clipboard.writeText(url);
        setToast('Enlace copiado al portapapeles.');
      }
    } catch {
      /* user cancelled */
    }
  };

  const isStandalone =
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <h1 style={{ fontSize: 30, letterSpacing: '-0.04em' }}>Tu recreo</h1>
          <p className="faint" style={{ fontSize: 12, marginTop: 3 }}>
            Progreso guardado en este dispositivo
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={openEditor} aria-label="Editar perfil">
          <Icon name="settings" size={19} />
        </button>
      </div>

      <section className="profile-hero">
        <AvatarVisual
          className="avatar-bubble lg"
          value={displayAvatar(state.profile)}
          fallback={state.profile.avatar}
        />
        <div className="grow">
          <h2>{state.profile.name}</h2>
          <p>
            {totals.plays === 0 ? 'Aún no has jugado. El patio te espera.' : `${totals.plays} partidas · ${totals.wins} victorias`}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={openEditor}>
            Cambiar nombre y foto
          </button>
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat-box">
          <b>{totals.plays}</b>
          <span>Partidas</span>
        </div>
        <div className="stat-box">
          <b>{totals.wins}</b>
          <span>Victorias</span>
        </div>
        <div className="stat-box">
          <b>{totals.families}</b>
          <span>Familias probadas</span>
        </div>
      </div>

      <section className="league-card" aria-label="Liga competitiva">
        <div className="league-head">
          <span className="league-emoji">{league.tier.emoji}</span>
          <div>
            <h3>Liga {league.tier.name}</h3>
            <p>
              {state.league.wins}V · {state.league.losses}D · racha {state.league.streak}
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
          <span>{league.next ? `Siguiente: ${league.next.emoji} ${league.next.name}` : 'Rango máximo alcanzado'}</span>
          <span>{league.next ? `${league.pointsToNext} pts · racha ${league.streakToNext}` : '👑 Leyenda'}</span>
        </div>
        <Link to="/aleatorio" className="btn btn-mint btn-sm btn-wide">
          Subir en la liga <Icon name="arrow-right" size={14} />
        </Link>
      </section>

      {topFamilies.length ? (
        <section className="section">
          <div className="section-head">
            <h2>Lo que más juegas</h2>
            <span className="faint" style={{ fontSize: 11 }}>
              {state.favorites.length} favoritos
            </span>
          </div>
          <div className="family-stats">
            {topFamilies.map(([family, stat]) => {
              const info = FAMILY_INFO[family];
              const max = topFamilies[0][1].plays || 1;
              return (
                <div key={family} className="family-stat">
                  <span className="emoji">{info.emoji}</span>
                  <span className="grow">{info.name}</span>
                  <span className="faint">{stat.plays} partidas</span>
                  <span className="bar">
                    <i style={{ width: `${Math.max(8, (stat.plays / max) * 100)}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {favorites.length ? (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Favoritos</h2>
              <p>Tu cajón de imprescindibles</p>
            </div>
            <Link to="/explorar" className="section-link">
              Añadir <Icon name="plus" size={14} />
            </Link>
          </div>
          <div className="game-grid">
            {favorites.map((game) => (
              <GameTile key={game.id} meta={game} />
            ))}
          </div>
        </section>
      ) : null}

      {recent.length ? (
        <section className="section">
          <div className="section-head">
            <h2>Recientes</h2>
            <Link to="/explorar" className="section-link">
              Explorar <Icon name="chevron-right" size={14} />
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
            <h2>Aspecto</h2>
            <p>Elige el color de tu recreo</p>
          </div>
        </div>
        <div className="theme-grid" role="radiogroup" aria-label="Tema de la app">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={state.theme === option.id}
              className={`theme-swatch ${state.theme === option.id ? 'active' : ''}`}
              onClick={() => updateSettings({ theme: option.id })}
            >
              <span
                className="theme-preview"
                style={{ background: `linear-gradient(135deg, ${option.primary}, ${option.secondary})` }}
              >
                <span className="theme-dot" />
              </span>
              <span>
                <b>{option.label}</b>
                <small>{option.hint}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Ajustes</h2>
        </div>
        <div className="settings-card">
          <button
            type="button"
            className="setting-row"
            onClick={() => updateSettings({ sound: !state.sound })}
            aria-pressed={state.sound}
          >
            <span className="setting-icon">
              <Icon name="volume" size={18} />
            </span>
            <span className="setting-copy">
              <b>Sonido</b>
              <span>Efectos al mover, acertar y celebrar</span>
            </span>
            <span className={`switch ${state.sound ? 'on' : ''}`} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="setting-row"
            onClick={() => updateSettings({ haptics: !state.haptics })}
            aria-pressed={state.haptics}
          >
            <span className="setting-icon">
              <Icon name="vibrate" size={18} />
            </span>
            <span className="setting-copy">
              <b>Vibración</b>
              <span>Pequeños avisos al tocar (si el móvil lo permite)</span>
            </span>
            <span className={`switch ${state.haptics ? 'on' : ''}`} aria-hidden="true" />
          </button>
          <button type="button" className="setting-row" onClick={share}>
            <span className="setting-icon">
              <Icon name="share" size={18} />
            </span>
            <span className="setting-copy">
              <b>Invitar a un amigo</b>
              <span>Comparte el recreo</span>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
          <button
            type="button"
            className="setting-row"
            onClick={() => {
              if (window.confirm('¿Borrar favoritos, historial y estadísticas? Esta acción no se puede deshacer.')) {
                resetProgress();
                setToast('Progreso borrado.');
              }
            }}
          >
            <span className="setting-icon" style={{ color: 'var(--danger)' }}>
              <Icon name="trash" size={18} />
            </span>
            <span className="setting-copy">
              <b>Borrar mi progreso</b>
              <span>Mantiene tu perfil, limpia estadísticas</span>
            </span>
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Chat seguro</h2>
            <p>Salas y mensajes privados</p>
          </div>
        </div>
        <div className="settings-group">
          <h3>Filtro de insultos</h3>
          <p>Se aplica a lo que envías y a lo que ves en salas y privados. Puedes cambiarlo cuando quieras.</p>
          <div className="filters" role="group" aria-label="Nivel del filtro de insultos">
            {PROFANITY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`chip ${state.filter === option.id ? 'active' : ''}`}
                onClick={() => updateSettings({ filter: option.id })}
                aria-pressed={state.filter === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="tiny-note">{PROFANITY_OPTIONS.find((option) => option.id === state.filter)?.help}</p>
        </div>
        <div className="settings-group" style={{ marginTop: 10 }}>
          <h3>Controles con dirección</h3>
          <p>En serpiente, laberintos y 2048. Los botones de dirección siempre quedan como alternativa.</p>
          <div className="filters" role="group" aria-label="Esquema de controles">
            {CONTROL_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`chip ${state.controls === option.id ? 'active' : ''}`}
                onClick={() => updateSettings({ controls: option.id })}
                aria-pressed={state.controls === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="tiny-note">{CONTROL_OPTIONS.find((option) => option.id === state.controls)?.help}</p>
        </div>
        <div className="settings-group" style={{ marginTop: 10 }}>
          <h3>Registro de cuenta</h3>
          <p>El registro con cuenta llegará en una actualización futura. Mientras tanto, Recreo guarda tu progreso y amistades en este móvil.</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Amigos y privados</h2>
            <p>Solo gente que conoces</p>
          </div>
          <span className="faint" style={{ fontSize: 11 }}>
            {state.friends.length} {state.friends.length === 1 ? 'amigo' : 'amigos'}
          </span>
        </div>
        <div className="friend-code-card">
          <h3>Tu código de amigo</h3>
          <p>Compártelo para que te añadan. Los mensajes privados y las salas de vida real solo se abren entre amigos.</p>
          <div className="friend-code">
            <strong>{myCode}</strong>
            <button
              type="button"
              className="icon-btn small"
              aria-label="Copiar mi código"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(myCode);
                  setToast('Código copiado. Pásalo a tu amigo.');
                } catch {
                  setToast(`Tu código es ${myCode}`);
                }
              }}
            >
              <Icon name="copy" size={17} />
            </button>
          </div>
          <div className="friend-add">
            <input
              className="input"
              value={friendCode}
              onChange={(event) => setFriendCode(event.target.value.toUpperCase())}
              placeholder="Código de tu amigo"
              maxLength={8}
              autoCapitalize="characters"
              aria-label="Código de amigo"
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={submitFriend} disabled={!friendCode.trim()}>
              Añadir
            </button>
          </div>
        </div>
        {state.friendRequests.length ? (
          <div className="friend-code-card" style={{ marginTop: 10 }}>
            <h3>Solicitudes de amistad</h3>
            {state.friendRequests.map((request) => (
              <div className="friend-row" key={request.code}>
                <AvatarVisual className="avatar" value={request.avatar} />
                <div className="grow">
                  <strong>{request.name}</strong>
                  <small>{request.direction === 'incoming' ? 'Quiere ser tu amigo' : 'Solicitud enviada'} · {request.code}</small>
                </div>
                {request.direction === 'incoming' ? (
                  <div className="friend-actions">
                    <button
                      type="button"
                      aria-label={`Aceptar solicitud de ${request.name}`}
                      onClick={() => {
                        socket.emit(
                          'friend:accept',
                          { code: request.code, name: state.profile.name, avatar: state.profile.avatar },
                          (response) => {
                            if (!response.ok) {
                              setToast(response.error ?? 'No se pudo aceptar.');
                              return;
                            }
                            addFriend({ code: request.code, name: request.name, avatar: request.avatar });
                            resolveFriendRequest(request.code);
                            setToast(`${request.name} ya está en tus amigos.`);
                          }
                        );
                      }}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      aria-label={`Rechazar solicitud de ${request.name}`}
                      onClick={() => {
                        socket.emit('friend:decline', { code: request.code }, (response) => {
                          if (response.ok) {
                            resolveFriendRequest(request.code);
                            setToast('Solicitud rechazada.');
                          }
                        });
                      }}
                    >
                      Rechazar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => resolveFriendRequest(request.code)}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <div className="friend-list">
          {state.friends.length ? (
            state.friends.map((friend) => {
              const thread = state.chats[friend.code] ?? [];
              return (
                <div className="friend-row" key={friend.code}>
                  <AvatarVisual className="avatar" value={friend.avatar} />
                  <div className="grow">
                    <strong>{friend.name}</strong>
                    <small>
                      {friend.code}
                      {thread.length ? ` · ${thread.length} mensaje${thread.length === 1 ? '' : 's'}` : ''}
                    </small>
                  </div>
                  <div className="friend-actions">
                    <Link to={`/mensajes/${friend.code}`} aria-label={`Abrir chat privado con ${friend.name}`}>
                      <Icon name="send" size={15} />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Quitar a ${friend.name}`}
                      onClick={() => {
                        if (window.confirm(`¿Quitar a ${friend.name} y borrar el chat privado?`)) {
                          removeFriend(friend.code);
                          setToast('Amigo eliminado.');
                        }
                      }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="tiny-note">
              Aún no tienes amigos. Pásale tu código a alguien de confianza y añade el suyo para hablar en privado.
            </p>
          )}
        </div>
      </section>

      {installEvent ? (
        <button type="button" className="pwa-banner btn-wide" onClick={install} style={{ textAlign: 'left' }}>
          <span style={{ fontSize: 24 }}>📲</span>
          <span className="grow">
            <b>Instala Recreo</b>
            <br />
            Acceso directo a pantalla completa, también sin datos.
          </span>
          <Icon name="arrow-right" size={16} />
        </button>
      ) : isStandalone ? (
        <div className="pwa-banner">
          <span style={{ fontSize: 24 }}>✅</span>
          <span className="grow">
            <b>Instalada</b>
            <br />
            Ya estás jugando como una app nativa.
          </span>
        </div>
      ) : (
        <div className="pwa-banner">
          <span style={{ fontSize: 24 }}>📲</span>
          <span className="grow">
            <b>Llévala en el bolsillo</b>
            <br />
            En iPhone: Compartir → Añadir a pantalla de inicio.
          </span>
        </div>
      )}

      {toast ? (
        <div className="toast" role="status" onClick={() => setToast('')}>
          {toast}
        </div>
      ) : null}

      <p className="profile-foot">
        Recreo · {GAMES.length.toLocaleString('es-ES')} juegos · Versión 1.0
        <br />
        Hecho para jugar en el móvil y en la calle.
      </p>

      <Sheet open={editing} onClose={() => setEditing(false)} label="Editar perfil">
        <h2>Tu jugador</h2>
        <p className="lead">Así te verán en las salas online.</p>
        <label className="onboarding-label" htmlFor="profile-name">
          Nombre
        </label>
        <input
          id="profile-name"
          className="input"
          value={name}
          maxLength={20}
          onChange={(event) => setName(event.target.value)}
          autoComplete="nickname"
        />
        <span className="onboarding-label">Foto de perfil</span>
        <div className="photo-editor">
          <AvatarVisual className="avatar-bubble photo-preview" value={photo ?? avatar} fallback={avatar} />
          <div className="photo-actions">
            <label className={`btn btn-ghost btn-sm photo-upload ${photoBusy ? 'is-busy' : ''}`}>
              {photoBusy ? 'Procesando…' : photo ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" onChange={pickPhoto} disabled={photoBusy} hidden />
            </label>
            {photo ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearPhoto}>
                Quitar foto
              </button>
            ) : null}
          </div>
        </div>
        {photoError ? <p className="outdoor-launcher-error">{photoError}</p> : null}
        <p className="tiny-note">
          Recortamos tu foto en cuadrado. Se guarda en este dispositivo y en salas se comparte una versión pequeña.
        </p>
        <span className="onboarding-label">O elige un emoji</span>
        <div className="avatar-grid">
          {AVATARS.map((option) => (
            <button
              key={option}
              type="button"
              className={`avatar-option ${!photo && avatar === option ? 'active' : ''}`}
              onClick={() => {
                setAvatar(option);
                clearPhoto();
              }}
              aria-label={`Avatar ${option}`}
              aria-pressed={!photo && avatar === option}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-primary btn-wide" onClick={saveProfile} disabled={!name.trim()}>
            Guardar
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </Sheet>
    </div>
  );
}
