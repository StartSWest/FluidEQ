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
  | 'mention';

interface IGlyphProps {
  name: TCommunityGlyph;
  className?: string;
}

/**
 * The community's small pictures: one per channel the server ships with, the
 * trophy for the leaderboard, and the four actions. Hand-drawn on a 20-unit
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
      case 'mention':
        return (
          <>
            <circle cx="10" cy="10" r="3" />
            <path d="M13 10v1.2a1.8 1.8 0 0 0 3.6 0V10a6.6 6.6 0 1 0-2.6 5.3" />
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
