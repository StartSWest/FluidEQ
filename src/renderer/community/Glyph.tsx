export type TCommunityGlyph =
  | 'general'
  | 'looks'
  | 'help'
  | 'feature-requests'
  | 'channel'
  | 'board'
  | 'send'
  | 'report'
  | 'block'
  | 'delete'
  | 'lock'
  | 'mention'
  | 'crown'
  | 'headphones'
  | 'calendar'
  | 'shield'
  | 'card'
  | 'person'
  | 'upload'
  | 'monitor'
  | 'mail'
  | 'refresh'
  | 'studio'
  | 'heart';

interface IGlyphProps {
  name: TCommunityGlyph;
  className?: string;
}

/**
 * The community's small pictures: one per channel the server ships with, the
 * trophy for the leaderboard, the four actions, one per part of a score, and
 * the few the Plus terms need for their sections. Hand-drawn on a 20-unit
 * grid, stroked in `currentColor`, so each one takes the row's own state —
 * dim at rest, lit when active — the way the look picker's icons do.
 *
 * A channel added on the server later has no picture of its own and gets the
 * plain hash; that is the one case `channel` exists for.
 */
export default function Glyph({ name, className }: IGlyphProps) {
  const path = (() => {
    switch (name) {
      case 'general':
        // Two overlapping speech bubbles.
        return (
          <>
            <path d="M3 4.5h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-3 2.5V12.5H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
            <path d="M14 8h3a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-1v2.2L13.3 15.5H11" />
          </>
        );
      case 'studio':
        // A brush at work, and the spark of the thing it is making.
        return (
          <>
            <path d="M3.5 16.5 4 13l8.6-8.6a1.9 1.9 0 0 1 2.7 2.7L6.7 15.7Z" />
            <path d="M11.2 5.8l2.9 2.9" opacity="0.6" />
            <path d="M16 12.5v4.5M13.75 14.75h4.5" />
          </>
        );
      case 'looks':
        // A small spectrum: four bars under a curve.
        return (
          <>
            <path d="M3 16.5V11M7.5 16.5V7M12 16.5V9.5M16.5 16.5V4.5" />
            <path d="M2 8.5c3-3 5.5-3 8-1s5 1.5 8-2" opacity="0.6" />
          </>
        );
      case 'help':
        // A life ring.
        return (
          <>
            <circle cx="10" cy="10" r="7.5" />
            <circle cx="10" cy="10" r="3" />
            <path d="M4.7 4.7l3.2 3.2M12.1 12.1l3.2 3.2M15.3 4.7l-3.2 3.2M7.9 12.1l-3.2 3.2" />
          </>
        );
      case 'feature-requests':
        // A lit bulb.
        return (
          <>
            <path d="M6.5 8.5a3.5 3.5 0 1 1 7 0c0 1.6-1 2.4-1.6 3.2-.4.5-.5 1-.5 1.6H8.6c0-.6-.1-1.1-.5-1.6C7.5 10.9 6.5 10.1 6.5 8.5Z" />
            <path d="M8.5 16h3M9 18h2" />
            <path d="M10 2v1.4M4.2 5.5l1 .8M15.8 5.5l-1 .8" opacity="0.6" />
          </>
        );
      case 'board':
        // A trophy.
        return (
          <>
            <path d="M6 3h8v4.5a4 4 0 0 1-8 0V3Z" />
            <path d="M6 5H3.5a2.5 2.5 0 0 0 2.6 3.2M14 5h2.5a2.5 2.5 0 0 1-2.6 3.2" />
            <path d="M10 11.5v2.5M7 17h6M8.5 14h3v3h-3z" />
          </>
        );
      case 'send':
        return <path d="M3 10 17 3l-3.5 14-4-5.5L3 10Zm6.5 1.5L17 3" />;
      case 'report':
        // A flag.
        return <path d="M5 17V3.5h9l-2 3.5 2 3.5H5" />;
      case 'block':
        // A struck circle.
        return (
          <>
            <circle cx="10" cy="10" r="7" />
            <path d="M5.2 5.2l9.6 9.6" />
          </>
        );
      case 'delete':
        return <path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6" />;
      case 'lock':
        return (
          <>
            <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
            <rect x="4.5" y="9" width="11" height="8" rx="1.8" />
          </>
        );
      case 'crown':
        // Three points, a band, and a jewel on the middle one.
        return (
          <>
            <path d="M3 15 2 6.5l4.6 3.4L10 4.5l3.4 5.4L18 6.5 17 15Z" />
            <path d="M3.5 17.5h13" />
          </>
        );
      case 'mention':
        return (
          <>
            <circle cx="10" cy="10" r="3" />
            <path d="M13 10v1.2a1.8 1.8 0 0 0 3.6 0V10a6.6 6.6 0 1 0-2.6 5.3" />
          </>
        );
      case 'headphones':
        // The band and two cups: listening.
        return (
          <>
            <path d="M3.5 13v-2.5a6.5 6.5 0 0 1 13 0V13" />
            <rect x="2.5" y="12" width="3.5" height="5.5" rx="1.4" />
            <rect x="14" y="12" width="3.5" height="5.5" rx="1.4" />
          </>
        );
      case 'calendar':
        // A page with a tick: a day that counted.
        return (
          <>
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
            <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
            <path d="M7.2 12.6l1.9 1.9 3.7-3.8" />
          </>
        );
      case 'shield':
        // A shield with a tick: checked, protected.
        return (
          <>
            <path d="M10 2.5 16 5v4.8c0 3.6-2.5 6.4-6 7.7-3.5-1.3-6-4.1-6-7.7V5Z" />
            <path d="M7.3 10.2 9.2 12l3.6-3.8" />
          </>
        );
      case 'card':
        return (
          <>
            <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
            <path d="M2.5 8.5h15M5.5 12.5h3" />
          </>
        );
      case 'person':
        return (
          <>
            <circle cx="10" cy="7" r="3.2" />
            <path d="M3.8 17c.8-3.2 3.2-5 6.2-5s5.4 1.8 6.2 5" />
          </>
        );
      case 'upload':
        // An arrow leaving a tray: what is sent.
        return (
          <>
            <path d="M10 13V3.5M5.8 7.6 10 3.5l4.2 4.1" />
            <path d="M3.5 12.5v2.5A1.5 1.5 0 0 0 5 16.5h10a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
          </>
        );
      case 'monitor':
        // The computer: what stays on it.
        return (
          <>
            <rect x="2.5" y="3.5" width="15" height="10" rx="1.8" />
            <path d="M7 17h6M10 13.5V17" />
          </>
        );
      case 'mail':
        return (
          <>
            <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
            <path d="M3.2 5.6 10 11l6.8-5.4" />
          </>
        );
      case 'heart':
        // A like on a member's scene.
        return (
          <path d="M10 16.8S3.2 12.6 3.2 7.6a3.5 3.5 0 0 1 6.8-1.2 3.5 3.5 0 0 1 6.8 1.2c0 5-6.8 9.2-6.8 9.2Z" />
        );
      case 'refresh':
        return (
          <>
            <path d="M16 10a6 6 0 1 1-1.8-4.3" />
            <path d="M16.2 3.2v3.3h-3.3" />
          </>
        );
      case 'channel':
      default:
        return <path d="M8 3 6.5 17M13.5 3 12 17M3.5 7.5h14M2.5 12.5h14" />;
    }
  })();
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}

/** Which picture a channel gets, by the id the server ships it with. */
export const channelGlyph = (channelId: string): TCommunityGlyph => {
  switch (channelId) {
    case 'general':
    case 'looks':
    case 'help':
    case 'feature-requests':
      return channelId;
    default:
      return 'channel';
  }
};
