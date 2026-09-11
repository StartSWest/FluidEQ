import initialsOf from '../account/initials';
import { identityStyle } from './identity';

interface IAvatarProps {
  handle: string;
  displayName?: string;
  size?: 'row' | 'rail' | 'podium';
  className?: string;
}

/**
 * Two letters in the person's own colour. The same component everywhere a
 * person appears — a board row, the rail, the podium — so the same handle is
 * the same disc in all three, at three sizes.
 */
export default function Avatar({
  handle,
  displayName,
  size = 'row',
  className,
}: IAvatarProps) {
  return (
    <span
      className={`community__avatar community__avatar--${size}${className ? ` ${className}` : ''}`}
      style={identityStyle(handle)}
      aria-hidden="true"
    >
      {initialsOf(displayName, handle)}
    </span>
  );
}
