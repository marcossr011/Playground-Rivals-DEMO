import { useState } from 'react';
import { AVATARS, useApp } from '../state/AppContext';
import { PROFANITY_OPTIONS } from '../lib/profanity';
import type { ControlScheme, ProfanityLevel } from '../types';

export function OnboardingGate() {
  const { state, completeOnboarding } = useApp();
  const [name, setName] = useState(state.profile.name);
  const [avatar, setAvatar] = useState(state.profile.avatar);
  const [filter, setFilter] = useState<ProfanityLevel>(state.filter);
  const [controls, setControls] = useState<ControlScheme>(state.controls);

  if (state.onboarded) return null;

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <img src="/recreo-mark.svg" alt="" className="onboarding-logo" />
        <h1>
          Bienvenido
          <br />
          al <span>recreo</span>.
        </h1>
        <p className="lead">
          Más de mil juegos: solitarios para tu pausa, salas con amigos y desconocidos, y una guía completa para
          jugar en la calle. Elige cómo te llaman.
        </p>

        <label className="onboarding-label" htmlFor="onb-name">
          Tu nombre de jugador
        </label>
        <input
          id="onb-name"
          className="input"
          value={name}
          maxLength={20}
          onChange={(event) => setName(event.target.value)}
          placeholder="¿Cómo te llaman?"
          autoComplete="nickname"
        />

        <span className="onboarding-label">Tu avatar</span>
        <div className="avatar-grid">
          {AVATARS.map((option) => (
            <button
              key={option}
              type="button"
              className={`avatar-option ${avatar === option ? 'active' : ''}`}
              onClick={() => setAvatar(option)}
              aria-label={`Avatar ${option}`}
              aria-pressed={avatar === option}
            >
              {option}
            </button>
          ))}
        </div>

        <span className="onboarding-label">Filtro de insultos en el chat</span>
        <div className="filters">
          {PROFANITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`chip ${filter === option.id ? 'active' : ''}`}
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="tiny-note">{PROFANITY_OPTIONS.find((option) => option.id === filter)?.help} Puedes cambiarlo en Ajustes.</p>

        <span className="onboarding-label">Controles con dirección</span>
        <div className="filters">
          <button
            type="button"
            className={`chip ${controls === 'swipe' ? 'active' : ''}`}
            onClick={() => setControls('swipe')}
            aria-pressed={controls === 'swipe'}
          >
            👆 Deslizar
          </button>
          <button
            type="button"
            className={`chip ${controls === 'joystick' ? 'active' : ''}`}
            onClick={() => setControls('joystick')}
            aria-pressed={controls === 'joystick'}
          >
            🕹️ Joystick
          </button>
        </div>
        <p className="tiny-note">El joystick va bien cuando varios amigos comparten un móvil. Se aplica a laberinto, serpiente y 2048.</p>

        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={() => completeOnboarding({ name, avatar, filter, controls })}
          >
            Entrar al recreo
          </button>
        </div>
        <button
          type="button"
          className="onboarding-skip"
          onClick={() => completeOnboarding({ filter, controls })}
        >
          Explorar sin cambiar nada
        </button>
      </div>
    </div>
  );
}
