import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const items: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Inicio', icon: 'home', end: true },
  { to: '/explorar', label: 'Explorar', icon: 'compass' },
  { to: '/salas', label: 'Salas', icon: 'users' },
  { to: '/vida-real', label: 'La calle', icon: 'tree' },
  { to: '/perfil', label: 'Tú', icon: 'user' }
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      <div className="bottom-nav-inner">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name={item.icon} size={22} filled={false} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
