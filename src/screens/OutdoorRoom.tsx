import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { AvatarVisual } from '../components/AvatarVisual';
import { LiveZoneMap, formatZoneRadius, type MapPlayer } from '../components/LiveZoneMap';
import { SocialChat } from '../components/SocialChat';
import { useApp } from '../state/AppContext';
import { displayAvatar, networkAvatar } from '../lib/avatar';
import { requestPosition } from '../lib/geo';
import { formatClock } from '../lib/random';
import type { OutdoorSnapshot } from '../shared/social';
import {
  connectOnline,
  forgetOutdoorSeat,
  recallOutdoorSeat,
  rememberOutdoorSeat,
  socket
} from '../net/socket';

const leaveTimers = new Map<string, number>();

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export default function OutdoorRoom() {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const navigate = useNavigate();
  const { state } = useApp();
  const [snapshot, setSnapshot] = useState<OutdoorSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(() => recallOutdoorSeat(roomCode));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [joining, setJoining] = useState(false);
  const [sharing, setSharing] = useState<'idle' | 'asking' | 'on'>('idle');
  const [geoError, setGeoError] = useState('');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [zoneRadius, setZoneRadius] = useState(300);
  const [busyZone, setBusyZone] = useState(false);
  const [tryingRejoin, setTryingRejoin] = useState(Boolean(playerId));
  const noticeTimer = useRef<number | null>(null);
  const now = useNow();

  const flash = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2800);
  };

  useEffect(() => {
    const active = connectOnline();
    let disposed = false;
    const pending = leaveTimers.get(roomCode);
    if (pending) {
      window.clearTimeout(pending);
      leaveTimers.delete(roomCode);
    }

    const rejoin = () => {
      const seat = recallOutdoorSeat(roomCode);
      if (!seat) {
        setTryingRejoin(false);
        return;
      }
      active.emit('outdoor:rejoin', { code: roomCode, playerId: seat }, (response) => {
        if (disposed) return;
        setTryingRejoin(false);
        if (!response.ok) {
          setPlayerId(null);
          forgetOutdoorSeat(roomCode);
          setError(response.error ?? 'Tu asiento ya no está en la sala.');
          return;
        }
        if (response.playerId) {
          rememberOutdoorSeat(roomCode, response.playerId);
          setPlayerId(response.playerId);
        }
        if (response.snapshot) setSnapshot(response.snapshot);
        setError('');
      });
    };

    const onUpdate = (next: OutdoorSnapshot) => {
      setSnapshot(next);
      setError('');
    };
    const onClosed = ({ reason }: { reason: string }) => {
      setSnapshot(null);
      setError(reason);
    };
    const onToast = ({ message }: { message: string }) => flash(message);
    const onSocialToast = ({ message }: { message: string }) => flash(message);

    active.on('outdoor:update', onUpdate);
    active.on('outdoor:closed', onClosed);
    active.on('toast', onToast);
    active.on('social:toast', onSocialToast);
    active.on('connect', rejoin);
    if (active.connected) rejoin();

    return () => {
      disposed = true;
      active.off('outdoor:update', onUpdate);
      active.off('outdoor:closed', onClosed);
      active.off('toast', onToast);
      active.off('social:toast', onSocialToast);
      active.off('connect', rejoin);
      const timer = window.setTimeout(() => {
        socket.emit('outdoor:leave', { code: roomCode });
        leaveTimers.delete(roomCode);
      }, 900);
      leaveTimers.set(roomCode, timer);
    };
  }, [roomCode]);

  const room = snapshot?.room;
  const me = room?.players.find((player) => player.id === playerId);
  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const eliminated = Boolean(me?.eliminated);
  const outside = Boolean(me?.outside && !eliminated);
  const secondsToReveal = room?.nextReveal ? Math.max(0, Math.ceil((room.nextReveal - now) / 1000)) : 0;
  const secondsToEnd = room?.endsAt ? Math.max(0, Math.ceil((room.endsAt - now) / 1000)) : 0;
  const graceLeft =
    outside && me?.outsideSince && room ? Math.max(0, Math.ceil((room.graceMs - (now - me.outsideSince)) / 1000)) : 0;
  const humans = room?.players.filter((player) => player.connected).length ?? 0;
  const alive = room?.players.filter((player) => !player.eliminated).length ?? 0;
  const winner = room?.players.find((player) => player.id === room.result?.winnerId) ?? null;

  const pushPosition = async () => {
    try {
      const coords = await requestPosition();
      setAccuracy(Math.round(coords.accuracy));
      setLastSent(Date.now());
      setGeoError('');
      socket.emit('outdoor:position', { code: roomCode, lat: coords.lat, lng: coords.lng }, (response) => {
        if (!response.ok) setGeoError(response.error ?? 'No se pudo enviar tu ubicación.');
      });
    } catch (caught) {
      setGeoError(caught instanceof Error ? caught.message : 'No se pudo obtener tu ubicación.');
    }
  };

  const enableLocation = async () => {
    setSharing('asking');
    setGeoError('');
    try {
      const coords = await requestPosition();
      setAccuracy(Math.round(coords.accuracy));
      setSharing('on');
      setLastSent(Date.now());
      if (room?.status === 'playing') {
        socket.emit('outdoor:position', { code: roomCode, lat: coords.lat, lng: coords.lng }, (response) => {
          if (!response.ok) setGeoError(response.error ?? 'No se pudo enviar tu ubicación.');
        });
      } else {
        flash('Permiso concedido. Tu ubicación se enviará cuando empiece la partida.');
      }
    } catch (caught) {
      setSharing('idle');
      setGeoError(caught instanceof Error ? caught.message : 'Permiso de ubicación no concedido.');
    }
  };

  useEffect(() => {
    if (sharing !== 'on' || room?.status !== 'playing' || eliminated) return;
    void pushPosition();
    const timer = window.setInterval(() => void pushPosition(), 20_000);
    return () => window.clearInterval(timer);
    // pushPosition se recrea con cada render; el intervalo solo depende del estado de la partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, room?.status, eliminated, roomCode]);

  const join = () => {
    setJoining(true);
    setError('');
    socket.emit(
      'outdoor:join',
      { code: roomCode, name: state.profile.name, avatar: networkAvatar(state.profile) },
      (response) => {
        setJoining(false);
        if (!response.ok || !response.code || !response.playerId) {
          setError(response.error ?? 'No se pudo entrar en la sala.');
          return;
        }
        rememberOutdoorSeat(response.code, response.playerId);
        setPlayerId(response.playerId);
        if (response.snapshot) setSnapshot(response.snapshot);
      }
    );
  };

  const applyZone = (lat: number, lng: number, radius = zoneRadius) => {
    setBusyZone(true);
    setGeoError('');
    socket.emit('outdoor:zone', { code: roomCode, lat, lng, radius }, (response) => {
      setBusyZone(false);
      if (!response.ok) setGeoError(response.error ?? 'No se pudo definir la zona.');
    });
  };

  const setZoneFromMe = async () => {
    setBusyZone(true);
    setGeoError('');
    try {
      const coords = await requestPosition();
      applyZone(coords.lat, coords.lng);
    } catch (caught) {
      setBusyZone(false);
      setGeoError(caught instanceof Error ? caught.message : 'No se pudo obtener tu ubicación.');
    }
  };

  const configure = (patch: { updateMinutes?: number; matchMinutes?: number; graceSeconds?: number }) => {
    if (!room) return;
    socket.emit(
      'outdoor:config',
      {
        code: roomCode,
        updateMinutes: Math.round(room.updateEveryMs / 60_000),
        matchMinutes: Math.round(room.matchMs / 60_000),
        graceSeconds: Math.round(room.graceMs / 1000),
        ...patch
      },
      (response) => {
        if (!response.ok) flash(response.error ?? 'No se pudo ajustar la partida.');
      }
    );
  };

  const start = () => {
    socket.emit('outdoor:start', { code: roomCode }, (response) => {
      if (!response.ok) flash(response.error ?? 'No se pudo empezar.');
    });
  };

  const leave = () => {
    socket.emit('outdoor:leave', { code: roomCode });
    forgetOutdoorSeat(roomCode);
    navigate('/vida-real');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      flash('Código copiado. Solo pásalo a amigos.');
    } catch {
      flash(`Código: ${roomCode}`);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/calle/${roomCode}`;
    const text = `${room?.gameTitle ?? 'Juego de calle'} en Recreo. Sala solo para amigos, código ${roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Recreo', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}: ${url}`);
      flash('Invitación copiada.');
    } catch {
      /* cancelado */
    }
  };

  const reportUser = (target: { id: string; name: string }, reason: string) => {
    socket.emit(
      'report:send',
      { context: 'outdoor', code: roomCode, targetId: target.id, targetName: target.name, reason },
      (response) => {
        if (!response.ok) flash(response.error ?? 'No se pudo enviar el reporte.');
        else flash('Reporte enviado.');
      }
    );
  };

  const mapPlayers = useMemo<MapPlayer[]>(() => {
    if (!room) return [];
    return room.players
      .filter((player) => player.position)
      .map((player) => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        lat: player.position!.lat,
        lng: player.position!.lng,
        isMe: player.id === playerId,
        stale: !player.outside && now - player.position!.at > room.updateEveryMs * 2,
        outside: player.outside,
        eliminated: player.eliminated
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.players, playerId, now, room?.updateEveryMs]);

  const chatPeople = useMemo(
    () => (room?.players ?? []).map((player) => ({ id: player.id, name: player.name, avatar: player.avatar })),
    [room?.players]
  );

  if (!snapshot && !tryingRejoin && (!room || !playerId)) {
    if (error && (error.includes('asiento') || error.includes('No encontramos') || error.includes('completa'))) {
      return (
        <div className="screen room-screen">
          <div className="room-error">
            <span aria-hidden="true">🌳</span>
            <h1>No se pudo entrar</h1>
            <p className="muted">{error}</p>
            <Link to="/vida-real" className="btn btn-primary">
              Volver a la calle
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="screen outdoor-room-screen">
        <header className="play-topbar">
          <button type="button" className="icon-btn" onClick={() => navigate('/vida-real')} aria-label="Volver">
            <Icon name="arrow-left" size={20} />
          </button>
          <div className="play-heading">
            <span className="play-emoji" aria-hidden="true">
              🌳
            </span>
            <div>
              <h1>Sala de calle</h1>
              <p>Código {roomCode}</p>
            </div>
          </div>
        </header>
        <div className="geo-gate">
          <h3>Únete a la partida de tus amigos</h3>
          <p>
            Vas a entrar como <AvatarVisual className="avatar-inline" value={displayAvatar(state.profile)} fallback={state.profile.avatar} />{' '}
            <strong>{state.profile.name}</strong>. La sala es privada: solo entra quien tiene el código.
          </p>
          <div className="geo-status is-off">
            <Icon name="shield" size={15} /> La ubicación se pedirá por separado y con permiso explícito.
          </div>
          <button type="button" className="btn btn-mint btn-wide" onClick={join} disabled={joining}>
            {joining ? 'Entrando…' : 'Entrar en la sala'}
          </button>
          {error ? <p className="outdoor-launcher-error">{error}</p> : null}
        </div>
      </div>
    );
  }

  if (!snapshot || !room) {
    return (
      <div className="screen room-screen">
        <div className="room-loading">
          <span className="spin" />
          <p className="muted">Conectando con la sala {roomCode}…</p>
        </div>
      </div>
    );
  }

  const latestReveal = room.players.reduce((max, player) => Math.max(max, player.position?.at ?? 0), 0);

  return (
    <div className="screen outdoor-room-screen">
      <header className="play-topbar">
        <button type="button" className="icon-btn" onClick={leave} aria-label="Salir de la sala">
          <Icon name="arrow-left" size={20} />
        </button>
        <div className="play-heading">
          <span className="play-emoji" aria-hidden="true">
            {room.gameEmoji}
          </span>
          <div>
            <h1>{room.gameTitle}</h1>
            <p>Sala de amigos · {humans} conectados · {alive} dentro</p>
          </div>
        </div>
        <button type="button" className="icon-btn small" onClick={share} aria-label="Compartir invitación">
          <Icon name="share" size={18} />
        </button>
      </header>

      {notice ? (
        <div className="room-notice" role="status">
          {notice}
        </div>
      ) : null}

      {outside ? (
        <div className="outdoor-warning" role="alert">
          <Icon name="map-pin" size={17} />
          <span>
            <strong>Estás fuera de la zona.</strong> Todo el mundo ve tu ubicación en vivo. Vuelve dentro o serás eliminado en{' '}
            <strong>{graceLeft}s</strong>.
          </span>
        </div>
      ) : null}

      {eliminated ? (
        <div className="outdoor-warning is-eliminated" role="status">
          <Icon name="shield" size={17} />
          <span>
            <strong>Eliminado.</strong> Has pasado demasiado tiempo fuera de la zona. Puedes seguir el mapa y el chat, pero ya no
            cuentas tu posición.
          </span>
        </div>
      ) : null}

      <section className="room-code-card">
        <div>
          <span className="faint">Código privado</span>
          <strong className="room-code">{room.code.split('').join(' ')}</strong>
        </div>
        <div className="room-code-actions">
          <button type="button" className="icon-btn small" onClick={copyCode} aria-label="Copiar código">
            <Icon name="copy" size={17} />
          </button>
          <span className={`badge ${room.status === 'playing' ? 'live' : room.status === 'ended' ? '' : 'hot'}`}>
            {room.status === 'playing' ? 'En juego' : room.status === 'ended' ? 'Terminada' : 'Esperando'}
          </span>
        </div>
      </section>

      <div className="room-privacy">
        <Icon name="shield" size={17} />
        <span>
          <strong>Solo entre conocidos.</strong> Comparte este código únicamente con tus amigos. Dentro de la zona la posición se
          revela cada {Math.max(1, Math.round(room.updateEveryMs / 60_000))} min; si alguien sale, su ubicación pasa a verse en
          vivo para todos y queda eliminado tras {Math.round(room.graceMs / 1000)} s fuera.
        </span>
      </div>

      <section className="section" style={{ marginTop: 4 }}>
        <div className="section-head">
          <h2>Jugadores</h2>
          <span className="faint" style={{ fontSize: 11 }}>
            {room.players.filter((player) => player.connected).length} conectados
          </span>
        </div>
        <div className="outdoor-room-players">
          {room.players.map((player) => (
            <div className="outdoor-room-player" key={player.id}>
              <AvatarVisual className="avatar" value={player.avatar} />
              <div className="grow">
                <strong>
                  {player.name}
                  {player.id === playerId ? ' · tú' : ''}
                </strong>
                <small>
                  {player.eliminated
                    ? 'Eliminado · fuera de la zona'
                    : !player.connected
                      ? 'Desconectado'
                      : player.outside
                        ? 'Fuera de zona · ubicación en vivo'
                        : player.position
                          ? `Última posición: ${new Date(player.position.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                          : player.pendingPosition
                            ? 'Ubicación lista para la próxima actualización'
                            : 'Sin ubicación todavía'}
                </small>
              </div>
              <div className="badges">
                {player.isHost ? <span className="badge hot">Anfitrión</span> : null}
                {player.id === playerId ? <span className="badge live">Tú</span> : null}
                {player.eliminated ? <span className="badge hot">Eliminado</span> : player.outside ? <span className="badge hot">Fuera</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {room.status === 'waiting' ? (
        <section className="room-waiting">
          <div className="room-waiting-art" aria-hidden="true">
            <span>{room.gameEmoji}</span>
            <i />
            <i />
          </div>
          <h2>{isHost ? 'La sala está lista' : 'Esperando al anfitrión'}</h2>
          <p className="muted">
            {isHost
              ? 'Ajusta los tiempos, marca la zona en el mapa mundial y empieza cuando estén tus amigos.'
              : 'Tu amigo anfitrión ajusta los tiempos y la zona, y decide cuándo empieza.'}
          </p>
          <div className="outdoor-config">
            <div className="outdoor-config-row">
              <span>Duración de la partida</span>
              <div className="filters">
                {[10, 20, 30, 60].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`chip ${Math.round(room.matchMs / 60_000) === minutes ? 'active' : ''}`}
                    disabled={!isHost || room.status !== 'waiting'}
                    onClick={() => configure({ matchMinutes: minutes })}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>
            <div className="outdoor-config-row">
              <span>La zona se actualiza cada</span>
              <div className="filters">
                {[1, 3, 5, 10].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`chip ${Math.round(room.updateEveryMs / 60_000) === minutes ? 'active' : ''}`}
                    disabled={!isHost || room.status !== 'waiting'}
                    onClick={() => configure({ updateMinutes: minutes })}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>
            <div className="outdoor-config-row">
              <span>Fuera de la zona, eliminado tras</span>
              <div className="filters">
                {[30, 60, 120, 300].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    className={`chip ${Math.round(room.graceMs / 1000) === seconds ? 'active' : ''}`}
                    disabled={!isHost || room.status !== 'waiting'}
                    onClick={() => configure({ graceSeconds: seconds })}
                  >
                    {seconds} s
                  </button>
                ))}
              </div>
            </div>
            <p className="tiny-note">
              La zona se reduce un 15 % en cada actualización. Si sales, todos ven tu ubicación en vivo y quedas eliminado al
              agotar el tiempo de gracia.
            </p>
          </div>
          <div className="game-actions">
            <button type="button" className="btn btn-ghost" onClick={share}>
              <Icon name="share" size={17} /> Invitar a un amigo
            </button>
            {isHost ? (
              <button type="button" className="btn btn-mint" onClick={start} disabled={!room.zone}>
                <Icon name="play" size={17} filled /> {room.zone ? 'Empezar partida' : 'Define la zona primero'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {room.status === 'ended' ? (
        <section className={`room-result ${winner?.id === playerId ? 'is-win' : ''}`}>
          <span className="room-result-emoji" aria-hidden="true">
            {winner ? (winner.id === playerId ? '🏆' : '🏁') : '🤝'}
          </span>
          <h2>
            {winner
              ? winner.id === playerId
                ? '¡Ganaste!'
                : `Ganó ${winner.name}`
              : 'Partida terminada'}
          </h2>
          <p className="muted">{room.result?.reason ?? 'Se acabó el tiempo.'}</p>
          <p className="tiny-note">
            Quedaron {alive} de {room.players.length} jugadores dentro de la zona.
          </p>
          <div className="game-actions">
            <button type="button" className="btn btn-ghost" onClick={leave}>
              Volver a la calle
            </button>
          </div>
        </section>
      ) : null}

      {room.status === 'playing' ? (
        <div className="outdoor-hud">
          <span className="hud-chip">
            <Icon name="timer" size={14} /> Partida {formatClock(secondsToEnd)}
          </span>
          <span className="hud-chip">
            <Icon name="map-pin" size={14} /> Zona {formatClock(secondsToReveal)}
          </span>
        </div>
      ) : null}

      <section className="section" style={{ marginTop: 6 }}>
        <div className="section-head">
          <div>
            <h2>Zona de juego</h2>
            <p>Mapa mundial · {formatZoneRadius(room.zone?.radius ?? zoneRadius)}</p>
          </div>
          {isHost ? <span className="badge hot">Tú decides</span> : null}
        </div>

        {isHost || (room.zone && sharing === 'on') ? (
          <>
            <LiveZoneMap
              players={sharing === 'on' ? mapPlayers : []}
              zone={room.zone}
              canPick={isHost && room.status !== 'ended'}
              onPick={(lat, lng) => applyZone(lat, lng)}
              zoneNote={room.zone ? `se reduce cada ${Math.max(1, Math.round(room.updateEveryMs / 60_000))} min` : undefined}
            />
            {isHost && room.status !== 'ended' ? (
              <div className="outdoor-zone-setup">
                <div className="filters">
                  {[100, 300, 1000, 5000].map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      className={`chip ${zoneRadius === radius ? 'active' : ''}`}
                      onClick={() => {
                        setZoneRadius(radius);
                        if (room.zone) applyZone(room.zone.lat, room.zone.lng, radius);
                      }}
                    >
                      {formatZoneRadius(radius)}
                    </button>
                  ))}
                </div>
                <div className="zone-map-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={setZoneFromMe} disabled={busyZone}>
                    <Icon name="map-pin" size={15} /> {busyZone ? 'Guardando…' : 'Usar mi ubicación'}
                  </button>
                  {room.zone ? <span className="tiny-note">{formatZoneRadius(room.zone.radius)} de radio</span> : null}
                </div>
                <p className="tiny-note">
                  Toca cualquier punto del mapa mundial para fijar el centro. El radio se puede ajustar y la zona se reduce un
                  15 % en cada actualización.
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        {!room.zone && !isHost ? <p className="tiny-note">El anfitrión todavía no ha marcado la zona de juego.</p> : null}

        {room.zone && sharing !== 'on' ? (
          <p className="tiny-note">
            La zona está marcada. Comparte tu ubicación con permiso explícito para ver el mapa con todos los jugadores.
          </p>
        ) : null}

        {sharing !== 'on' ? (
          <div className="geo-gate">
            <h3>Comparte tu ubicación para ver a todos</h3>
            <p>
              Recreo pedirá permiso al navegador. Dentro de la zona tu posición se revela cada{' '}
              {Math.max(1, Math.round(room.updateEveryMs / 60_000))} min y solo en esta sala. Si sales, todo el mundo la verá en
              vivo mientras estés fuera.
            </p>
            <div className="geo-status is-off">
              <Icon name="shield" size={15} /> Ubicación desactivada · sin compartir
            </div>
            {geoError ? <p className="outdoor-launcher-error">{geoError}</p> : null}
            <button
              type="button"
              className="btn btn-mint btn-wide"
              onClick={enableLocation}
              disabled={sharing === 'asking' || eliminated}
            >
              <Icon name="map-pin" size={17} /> {sharing === 'asking' ? 'Pidiendo permiso…' : 'Permitir ubicación'}
            </button>
          </div>
        ) : (
          <div className="geo-status" style={{ marginTop: 10 }}>
            <Icon name="check" size={15} />
            <span>
              Ubicación compartida{accuracy ? ` (±${accuracy} m)` : ''}
              {lastSent ? ` · última lectura ${new Date(lastSent).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            {room.status === 'playing' ? (
              <span className="geo-countdown">
                Partida {formatClock(secondsToEnd)} · zona {formatClock(secondsToReveal)}
              </span>
            ) : null}
          </div>
        )}

        {sharing === 'on' ? (
          <div className="zone-map-actions">
            {room.status === 'playing' && !eliminated ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void pushPosition()}>
                <Icon name="refresh" size={15} /> Actualizar ahora
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSharing('idle')}>
              Dejar de compartir
            </button>
          </div>
        ) : null}

        <p className="room-location-note">
          {room.status === 'playing'
            ? latestReveal
              ? `Última actualización: ${new Date(latestReveal).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · próxima en ${formatClock(secondsToReveal)}.`
              : `La primera actualización llegará en ${formatClock(secondsToReveal)}.`
            : room.status === 'waiting'
              ? 'Las ubicaciones empezarán a mostrarse cuando el anfitrión inicie la partida.'
              : 'Partida terminada: el mapa queda congelado con las últimas posiciones.'}
        </p>
      </section>

      <section className="section">
        <SocialChat
          title="Chat de la sala"
          subtitle={`Solo estos ${room.players.length} jugadores · filtro ${state.filter === 'off' ? 'desactivado' : state.filter === 'strict' ? 'estricto' : 'suave'}`}
          messages={room.chat.map((message) => ({ ...message, system: message.system }))}
          meId={playerId ?? ''}
          people={chatPeople}
          muteScope={`outdoor-${room.code}`}
          filter={state.filter}
          onSend={(text) => {
            socket.emit('outdoor:chat', { code: roomCode, text }, (response) => {
              if (!response.ok) flash(response.error ?? 'No se pudo enviar.');
            });
          }}
          onReport={reportUser}
          emptyText="Todavía no hay mensajes. Acordad las reglas antes de empezar."
        />
      </section>

      <div className="play-footer">
        <button type="button" className="btn btn-ghost btn-wide" onClick={leave}>
          Salir de la sala
        </button>
      </div>
    </div>
  );
}
