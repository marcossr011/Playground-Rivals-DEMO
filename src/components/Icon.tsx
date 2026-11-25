import type { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'compass'
  | 'users'
  | 'tree'
  | 'user'
  | 'search'
  | 'heart'
  | 'arrow-left'
  | 'play'
  | 'flame'
  | 'trophy'
  | 'clock'
  | 'sparkles'
  | 'settings'
  | 'volume'
  | 'vibrate'
  | 'refresh'
  | 'chevron-right'
  | 'x'
  | 'send'
  | 'copy'
  | 'flag'
  | 'map-pin'
  | 'timer'
  | 'plus'
  | 'minus'
  | 'check'
  | 'info'
  | 'dice'
  | 'wifi'
  | 'shield'
  | 'share'
  | 'arrow-right'
  | 'grid'
  | 'list'
  | 'trash';

const paths: Record<IconName, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.4A3 3 0 0 1 16 11M18.5 20c0-2.6-.9-4.4-2.5-5.3" />
    </>
  ),
  tree: (
    <>
      <path d="M12 2 6 11h3l-4 6h5v5h4v-5h5l-4-6h3z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 21c0-3.8 3.4-6.3 7.5-6.3s7.5 2.5 7.5 6.3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 5 5" />
    </>
  ),
  heart: <path d="M12 20.3S3.5 15 3.5 8.9A4.9 4.9 0 0 1 12 5.6a4.9 4.9 0 0 1 8.5 3.3C20.5 15 12 20.3 12 20.3Z" />,
  'arrow-left': <path d="M19 12H5m6-7-7 7 7 7" />,
  play: <path d="M8 5.5v13l11-6.5z" />,
  flame: <path d="M12 22c4.4 0 7-2.9 7-6.7 0-3-1.8-5.2-3.5-7.2-.6-.8-1.6-.3-1.5.7.1 1.4-.2 2.4-.9 3.1-.7-2.6-2-5.3-4.4-7.4-.5-.4-1.3-.1-1.2.6.3 3-1.3 4.6-2.2 6.4A7.7 7.7 0 0 0 5 15.3C5 19.1 7.6 22 12 22Z" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  vibrate: (
    <>
      <rect x="8" y="4" width="8" height="16" rx="2" />
      <path d="M4 9v6M20 9v6M2 11v2M22 11v2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M19.4 12a7.5 7.5 0 1 1-2.2-5.3L20 12" />
    </>
  ),
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  send: <path d="M4 12 21 4l-7 17-3-7z" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  flag: <path d="M5 21V3m0 0c4-3 9 3 14 0v10c-5 3-10-3-14 0" />,
  'map-pin': (
    <>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6M12 2v3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m4 12.5 5.2 5L20 6.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  dice: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.2" />
      <circle cx="15.5" cy="8.5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="8.5" cy="15.5" r="1.2" />
      <circle cx="15.5" cy="15.5" r="1.2" />
    </>
  ),
  wifi: (
    <>
      <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5.2 5.2 0 0 1 7 0M2 9a15 15 0 0 1 20 0" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
      <path d="m8.5 11.5 2.5 2.5 4.5-4.5" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </>
  ),
  'arrow-right': <path d="M5 12h14m-6-7 7 7-7 7" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </>
  )
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  filled?: boolean;
}

export function Icon({ name, size = 22, filled = false, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
