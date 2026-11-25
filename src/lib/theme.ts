import type { ThemeId } from '../types';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  hint: string;
  primary: string;
  secondary: string;
}

export const THEMES: ThemeOption[] = [
  { id: 'coral', label: 'Coral', hint: 'Atardecer', primary: '#ff6a3d', secondary: '#7b61ff' },
  { id: 'menta', label: 'Menta', hint: 'Pista fresca', primary: '#35e0a1', secondary: '#2fb8d8' },
  { id: 'oceano', label: 'Océano', hint: 'Azul profundo', primary: '#4aa8ff', secondary: '#7b61ff' },
  { id: 'violeta', label: 'Violeta', hint: 'Neón suave', primary: '#a07bff', secondary: '#ff6ac2' },
  { id: 'ambar', label: 'Ámbar', hint: 'Tarde cálida', primary: '#ffb020', secondary: '#ff7a45' },
  { id: 'rosa', label: 'Rosa', hint: 'Modo fiesta', primary: '#ff5d8f', secondary: '#a07bff' }
];

export const DEFAULT_THEME: ThemeId = 'coral';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((theme) => theme.id === value);
}

export function themeOption(id: ThemeId): ThemeOption {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
