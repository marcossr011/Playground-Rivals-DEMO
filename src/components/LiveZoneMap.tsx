import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapPlayer {
  id: string;
  name: string;
  avatar: string;
  lat: number;
  lng: number;
  isMe: boolean;
  stale: boolean;
  outside: boolean;
  eliminated: boolean;
}

export interface MapZone {
  lat: number;
  lng: number;
  radius: number;
}

interface LiveZoneMapProps {
  players: MapPlayer[];
  zone: MapZone | null;
  canPick?: boolean;
  onPick?: (lat: number, lng: number) => void;
  zoneNote?: string;
}

const WORLD_CENTER: [number, number] = [20, 0];
const WORLD_ZOOM = 2;

export function formatZoneRadius(radius: number): string {
  return radius >= 1000 ? `${Math.round(radius / 100) / 10} km` : `${Math.round(radius)} m`;
}

function zoneBounds(zone: MapZone): L.LatLngBounds {
  const latDelta = (zone.radius / 6_371_000) * (180 / Math.PI);
  const lngDelta = latDelta / Math.max(0.2, Math.cos((zone.lat * Math.PI) / 180));
  return L.latLngBounds([zone.lat - latDelta, zone.lng - lngDelta], [zone.lat + latDelta, zone.lng + lngDelta]);
}

const PHOTO_AVATAR = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

function pinContent(avatar: string): string {
  if (PHOTO_AVATAR.test(avatar)) return `<img src="${avatar}" alt="" />`;
  const safe = avatar.replace(/[&<>"']/g, '');
  return `<span>${safe}</span>`;
}

export function LiveZoneMap({ players, zone, canPick = false, onPick, zoneNote }: LiveZoneMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef({ canPick, onPick });
  const fittedRef = useRef('');
  pickRef.current = { canPick, onPick };

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { zoomControl: true, attributionControl: false, worldCopyJump: true }).setView(
      WORLD_CENTER,
      WORLD_ZOOM
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!pickRef.current.canPick) return;
      pickRef.current.onPick?.(event.latlng.lat, event.latlng.lng);
    });
    window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = '';
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (zone) {
      L.circle([zone.lat, zone.lng], {
        radius: zone.radius,
        color: '#42e2a6',
        weight: 2,
        fillColor: '#42e2a6',
        fillOpacity: 0.12,
        dashArray: '6 8'
      }).addTo(layer);
    }

    for (const player of players) {
      const icon = L.divIcon({
        className: '',
        html: `<div class="player-pin ${player.isMe ? 'is-me' : ''} ${player.stale ? 'is-stale' : ''} ${
          player.outside ? 'is-outside' : ''
        } ${player.eliminated ? 'is-eliminated' : ''}">${pinContent(player.avatar)}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      const marker = L.marker([player.lat, player.lng], { icon }).addTo(layer);
      const tooltip = document.createElement('span');
      tooltip.textContent = `${player.name}${player.isMe ? ' (tú)' : ''}${player.eliminated ? ' · eliminado' : player.outside ? ' · fuera de zona' : ''}`;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -12] });
    }

    const centerKey = zone ? `${zone.lat.toFixed(5)},${zone.lng.toFixed(5)}` : '';
    if (centerKey && fittedRef.current !== centerKey) {
      map.fitBounds(zoneBounds(zone!).pad(0.25), { maxZoom: 15 });
      fittedRef.current = centerKey;
    } else if (!zone && players.length && !fittedRef.current) {
      map.fitBounds(L.latLngBounds(players.map((player) => [player.lat, player.lng] as [number, number])).pad(0.35), {
        maxZoom: 16
      });
      fittedRef.current = 'players';
    }
  }, [players, zone]);

  return (
    <div className={`room-map-wrap ${canPick ? 'is-picking' : ''}`}>
      <div ref={el} className="outdoor-room-map" role="application" aria-label="Mapa mundial de la zona y jugadores" />
      <button
        type="button"
        className="zone-world-chip"
        onClick={() => mapRef.current?.setView(WORLD_CENTER, WORLD_ZOOM)}
      >
        🌍 Mundo
      </button>
      {zone ? (
        <span className="zone-center-chip">
          Zona · {formatZoneRadius(zone.radius)}
          {zoneNote ? ` · ${zoneNote}` : ''}
        </span>
      ) : null}
      {canPick ? <span className="zone-pick-chip">Toca el mapa para fijar el centro</span> : null}
    </div>
  );
}
