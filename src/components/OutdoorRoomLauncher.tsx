import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { networkAvatar } from '../lib/avatar';
import { connectOnline, rememberOutdoorSeat, whenOnline } from '../net/socket';
import { Icon } from './Icon';

interface OutdoorRoomLauncherProps {
  outdoorId: string;
  title: string;
}

export function OutdoorRoomLauncher({ outdoorId, title }: OutdoorRoomLauncherProps) {
  const { state } = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  const profile = { name: state.profile.name, avatar: networkAvatar(state.profile) };

  const create = async () => {
    setBusy('create');
    setError('');
    try {
      const socket = await whenOnline();
      socket.emit(
        'outdoor:create',
        { gameId: `outdoor-${outdoorId}`, ...profile },
        (response) => {
          setBusy(null);
          if (!response.ok || !response.code || !response.playerId) {
            setError(response.error ?? 'No se pudo crear la sala.');
            return;
          }
          rememberOutdoorSeat(response.code, response.playerId);
          navigate(`/calle/${response.code}`);
        }
      );
      window.setTimeout(() => setBusy((current) => (current === 'create' ? null : current)), 9000);
    } catch (caught) {
      setBusy(null);
      setError(caught instanceof Error ? caught.message : 'No hay conexión con las salas.');
    }
  };

  const join = async () => {
    const clean = code.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (clean.length < 4) {
      setError('Escribe el código que te ha pasado tu amigo.');
      return;
    }
    setBusy('join');
    setError('');
    try {
      const socket = connectOnline();
      socket.emit('outdoor:join', { code: clean, ...profile }, (response) => {
        setBusy(null);
        if (!response.ok || !response.code || !response.playerId) {
          setError(response.error ?? 'No se pudo entrar en la sala.');
          return;
        }
        rememberOutdoorSeat(response.code, response.playerId);
        navigate(`/calle/${response.code}`);
      });
      window.setTimeout(() => setBusy((current) => (current === 'join' ? null : current)), 9000);
    } catch {
      setBusy(null);
      setError('No hay conexión con las salas.');
    }
  };

  return (
    <div className="outdoor-launcher">
      <div>
        <span className="badge hot">Solo amigos</span>
        <h3 style={{ marginTop: 8 }}>Sala de {title}</h3>
        <p>
          Crea una sala y pasa el código solo a gente que conozcas. Elige la zona en el mapa del mundo, ajusta la duración
          de la partida y la zona se irá cerrando sola: si sales, todos ven tu ubicación en vivo y si tardas en volver,
          quedas eliminado.
        </p>
      </div>
      <button type="button" className="btn btn-mint btn-wide" onClick={create} disabled={busy !== null}>
        <Icon name="users" size={17} /> {busy === 'create' ? 'Creando sala…' : 'Crear sala para amigos'}
      </button>
      <div className="outdoor-launcher-join">
        <input
          className="input pin-input"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="CÓDIGO"
          maxLength={5}
          aria-label="Código de sala de calle"
          autoCapitalize="characters"
        />
        <button type="button" className="btn btn-ghost" onClick={join} disabled={busy !== null}>
          {busy === 'join' ? 'Entrando…' : 'Unirme'}
        </button>
      </div>
      {error ? <p className="outdoor-launcher-error">{error}</p> : null}
      <p className="tiny-note" style={{ margin: 0 }}>
        🔒 Las salas no son públicas: sin el código no se entra. La ubicación nunca se comparte fuera de la sala.
      </p>
    </div>
  );
}
