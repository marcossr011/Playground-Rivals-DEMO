import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number;
}

export function supportsGeolocation(): boolean {
  return Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && 'geolocation' in navigator);
}

async function nativePosition(timeoutMs: number): Promise<Coords> {
  const current = await Geolocation.checkPermissions();
  if (current.location !== 'granted') {
    const requested = await Geolocation.requestPermissions({ permissions: ['location'] });
    if (requested.location !== 'granted') {
      throw new Error('Permiso de ubicación denegado. Actívalo en los ajustes del móvil.');
    }
  }
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: timeoutMs,
    maximumAge: 15_000
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 0
  };
}

export function requestPosition(timeoutMs = 12000): Promise<Coords> {
  if (Capacitor.isNativePlatform()) {
    return nativePosition(timeoutMs).catch((caught: unknown) => {
      if (caught instanceof Error && caught.message.startsWith('Permiso de ubicación')) throw caught;
      throw new Error('No se pudo obtener tu ubicación. Activa el GPS y prueba al aire libre.');
    });
  }
  return new Promise((resolve, reject) => {
    if (!supportsGeolocation()) {
      reject(new Error('Este dispositivo no permite geolocalización.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador.'
              : 'No se pudo obtener tu ubicación. Prueba al aire libre.'
          )
        );
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15_000 }
    );
  });
}
