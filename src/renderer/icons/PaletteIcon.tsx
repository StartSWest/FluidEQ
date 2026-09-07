import type { GraphPalette } from 'common/graphStyles';

/** Each palette has its own silhouette; colour alone cannot identify a mode. */
const PaletteIcon = ({ palette }: { palette: GraphPalette }) => {
  switch (palette) {
    case 'signal':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'rainbow':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <rect x="1" y="3" width="3" height="10" opacity="0.35" />
          <rect x="6.5" y="3" width="3" height="10" opacity="0.65" />
          <rect x="12" y="3" width="3" height="10" />
        </svg>
      );
    case 'level':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <rect x="3" y="1" width="10" height="3" />
          <rect x="3" y="6.5" width="10" height="3" opacity="0.65" />
          <rect x="3" y="12" width="10" height="3" opacity="0.35" />
        </svg>
      );
    case 'heat':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <path d="M8 1C9 5 13 6 13 10a5 5 0 0 1-10 0c0-2 1-4 3-5 0 2 1 3 1 3 2-2 1-5 1-7Z" />
        </svg>
      );
    case 'auto':
      // A four-point star: "whatever suits it", the way a camera's auto
      // mode is drawn.
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <path d="M8 1 9.6 6.4 15 8 9.6 9.6 8 15 6.4 9.6 1 8 6.4 6.4Z" />
        </svg>
      );
    default:
      return null;
  }
};

export default PaletteIcon;
