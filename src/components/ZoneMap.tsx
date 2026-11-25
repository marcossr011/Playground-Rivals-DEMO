import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { formatClock, uid } from '../lib/random';
import { sfx } from '../lib/audio';
import { Icon } from './Icon';

type PinType = 'bandera' | 'baseA' | 'baseB' | 'carcel' | 'punto';

interface ZonePin {
  id: string;
  type: PinType;
  lat: number;
  lng: number;
}

const PIN_TYPES: Record<PinType, { emoji: string; label: string }> = {
  bandera: { emoji: '🚩', label: 'Bandera' },
  baseA: { emoji: '🔵', label: 'Base A' },
  baseB: { emoji: '🟠', label: 'Base B' },
  carcel: { emoji: '⛓️', label: 'Cárcel' },
  punto: { emoji: '⭐', label: 'Punto de interés' }
};

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038];

function parseCoords(raw: string): [number, number] | null {
  const text = raw.trim();
  const at = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return [Number(at[1]), Number(at[2])];
  const q = text.match(/(?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (q) return [Number(q[1]), Number(q[2])];
  const plain = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (plain) return [Number(plain[1]), Number(plain[2])];
  return null;
}

export function ZoneMap({ gameId }: { gameId: string }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const placingRef = useRef<PinType | null>(null);
  const storageKey = `recreo.zone.${gameId}`;
  const [pins, setPins] = useState<ZonePin[]>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as ZonePin[]) : [];
      return Array.isArray(parsed) ? parsed.filter((pin) => pin && pin.type in PIN_TYPES) : [];
    } catch {
      return [];
    }
  });
  const [placing, setPlacing] = useState<PinType | null>(null);
  const [hidden, setHidden] = useState(false);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(pins));
    } catch {
      /* sin almacenamiento */
    }
  }, [pins, storageKey]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true }).setView(DEFAULT_CENTER, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => {
      const type = placingRef.current;
      if (!type) return;
      setPins((current) => [...current, { id: uid('pin'), type, lat: event.latlng.lat, lng: event.latlng.lng }]);
      setPlacing(null);
      setStatus(`${PIN_TYPES[type].label} colocada. Toca otro punto para añadir más o desactiva el modo.`);
      sfx.select();
    });
    map.on('moveend', () => {
      const pos = map.getCenter();
      setCenter([pos.lat, pos.lng]);
    });
    mapRef.current = map;
    setCenter(DEFAULT_CENTER);
    setReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();
    if (hidden) return;
    for (const pin of pins) {
      const info = PIN_TYPES[pin.type];
      const icon = L.divIcon({
        className: `zone-pin zone-pin-${pin.type}`,
        html: `<span>${info.emoji}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 30]
      });
      L.marker([pin.lat, pin.lng], { icon }).bindPopup(`${info.label}<br/>${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`).addTo(group);
    }
  }, [pins, hidden, ready]);

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setStatus('Este dispositivo no permite geolocalización.');
      return;
    }
    setStatus('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 17);
        setStatus('Mapa centrado en tu ubicación.');
      },
      () => setStatus('No se pudo obtener la ubicación. Revisa los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const importLink = () => {
    const coords = parseCoords(importText);
    if (!coords) {
      setStatus('No reconozco coordenadas en ese enlace. Pega un enlace con «@lat,lng» o escribe «lat,lng».');
      return;
    }
    mapRef.current?.setView(coords, 17);
    setStatus('Mapa centrado en las coordenadas importadas.');
    setImportText('');
  };

  const share = async () => {
    if (!center) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${center[0]},${center[1]}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Zona de juego', text: 'Aquí jugamos', url });
        setStatus('Zona compartida.');
      } else {
        await navigator.clipboard.writeText(url);
        setStatus('Enlace de Google Maps copiado.');
      }
    } catch {
      setStatus('No se pudo compartir el enlace.');
    }
  };

  const removeLast = () => {
    setPins((current) => current.slice(0, -1));
    sfx.tap();
  };

  const clearAll = () => {
    if (!pins.length) return;
    if (!window.confirm('¿Borrar todas las marcas de esta zona?')) return;
    setPins([]);
    sfx.error();
  };

  return (
    <div className="zone-map">
      <div className="zone-tools">
        {(Object.keys(PIN_TYPES) as PinType[]).map((type) => (
          <button
            key={type}
            type="button"
            className={`chip tiny ${placing === type ? 'active' : ''}`}
            onClick={() => {
              setPlacing((current) => (current === type ? null : type));
              setStatus(placing === type ? '' : `Toca el mapa para colocar: ${PIN_TYPES[type].label}.`);
            }}
          >
            {PIN_TYPES[type].emoji} {PIN_TYPES[type].label}
          </button>
        ))}
      </div>

      <div className="map-wrap">
        <div ref={mapEl} className="map-canvas" />
        {placing ? <div className="map-placing">Toca el mapa para colocar «{PIN_TYPES[placing].label}»</div> : null}
      </div>

      <div className="zone-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={locate}>
          <Icon name="map-pin" size={15} /> Mi ubicación
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={share} disabled={!center}>
          <Icon name="share" size={15} /> Compartir zona
        </button>
        <button type="button" className={`btn btn-ghost btn-sm ${hidden ? 'is-active' : ''}`} onClick={() => setHidden((value) => !value)}>
          <Icon name="shield" size={15} /> {hidden ? 'Mostrar marcas' : 'Ocultar marcas'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={removeLast} disabled={!pins.length}>
          Deshacer
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll} disabled={!pins.length}>
          <Icon name="trash" size={15} /> Borrar
        </button>
      </div>

      <div className="zone-import">
        <input
          className="input"
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          placeholder="Pega un enlace de Google Maps o lat,lng"
          inputMode="text"
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={importLink}>
          Centrar
        </button>
      </div>

      <div className="zone-meta">
        <span className="faint">
          {center ? `Centro: ${center[0].toFixed(5)}, ${center[1].toFixed(5)}` : 'Mueve el mapa para ver coordenadas'}
        </span>
        <span className="badge">{pins.length} marcas</span>
      </div>
      {status ? <p className="zone-status">{status}</p> : null}
      <p className="tiny-note">
        Las marcas se guardan en este móvil para esta guía. Las zonas privadas se ocultan con «Ocultar marcas» antes de pasar el teléfono.
      </p>
    </div>
  );
}

export function RefereePanel({ teams, durationMinutes, scoreHint }: { teams: string[]; durationMinutes: number; scoreHint: string }) {
  const [left, setLeft] = useState(durationMinutes * 60);
  const [running, setRunning] = useState(false);
  const [scores, setScores] = useState<number[]>(() => teams.map(() => 0));
  const [log, setLog] = useState<{ id: string; text: string; at: string }[]>([]);
  const ended = useRef(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (left > 0 || ended.current) return;
    ended.current = true;
    setRunning(false);
    sfx.alarm();
    setLog((current) => [
      { id: uid('ev'), text: '⏱️ Fin del tiempo reglamentario', at: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) },
      ...current
    ]);
  }, [left]);

  const adjust = (index: number, delta: number) => {
    setScores((current) => current.map((value, position) => (position === index ? Math.max(0, value + delta) : value)));
    const team = teams[index];
    setLog((current) =>
      [
        {
          id: uid('ev'),
          text: delta > 0 ? `+1 ${team}` : `−1 ${team}`,
          at: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        },
        ...current
      ].slice(0, 30)
    );
    sfx[delta > 0 ? 'select' : 'tick']();
  };

  const reset = () => {
    setLeft(durationMinutes * 60);
    setRunning(false);
    setScores(teams.map(() => 0));
    setLog([]);
    ended.current = false;
    sfx.tap();
  };

  const toggle = () => {
    if (left === 0) {
      setLeft(durationMinutes * 60);
      ended.current = false;
    }
    setRunning((value) => !value);
    sfx.tap();
  };

  return (
    <div className="referee">
      <div className="referee-head">
        <div>
          <span className="badge live">Modo árbitro</span>
          <h3 style={{ marginTop: 8 }}>Cronómetro y marcador</h3>
        </div>
        <span className={`referee-clock ${left === 0 ? 'is-over' : ''} ${running ? 'is-running' : ''}`}>{formatClock(left)}</span>
      </div>

      <div className="referee-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={toggle}>
          {running ? 'Pausar' : left === 0 ? 'Nueva cuenta' : 'Iniciar'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Reiniciar</button>
      </div>

      <div className="referee-scores">
        {teams.map((team, index) => (
          <div key={team} className="referee-team">
            <span className="referee-team-name">{team}</span>
            <strong>{scores[index]}</strong>
            <div className="referee-team-buttons">
              <button type="button" className="icon-btn small" onClick={() => adjust(index, -1)} aria-label={`Quitar punto a ${team}`}>−</button>
              <button type="button" className="icon-btn small is-score" onClick={() => adjust(index, 1)} aria-label={`Sumar punto a ${team}`}>+</button>
            </div>
          </div>
        ))}
      </div>

      <p className="tiny-note">{scoreHint}</p>

      {log.length ? (
        <div className="referee-log">
          {log.map((entry) => (
            <div key={entry.id} className="referee-event">
              <span>{entry.text}</span>
              <small>{entry.at}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="faint" style={{ marginTop: 10 }}>Los puntos y el final del tiempo aparecerán aquí.</p>
      )}
    </div>
  );
}
