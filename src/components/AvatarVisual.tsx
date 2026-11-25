import { isImageAvatar } from '../lib/avatar';

interface AvatarVisualProps {
  value?: string;
  fallback?: string;
  className?: string;
}

export function AvatarVisual({ value, fallback = '🙂', className }: AvatarVisualProps) {
  if (isImageAvatar(value)) {
    return (
      <span className={className}>
        <img src={value} alt="" className="avatar-img" />
      </span>
    );
  }
  return <span className={className}>{value || fallback}</span>;
}
