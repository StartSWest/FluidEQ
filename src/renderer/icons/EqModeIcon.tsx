import type { TEqModeScope } from '../../common/eqMode';

// The EQ mode menu's two groups. Its choices are words on a segmented track;
// the glyphs each tile once carried went with the tiles.
const PATHS: Record<TEqModeScope, string> = {
  eq: 'M5 3v18M12 3v18M19 3v18M2 8h6M9 16h6M16 10h6',
  curves: 'M2 17C6 17 5 5 10 5S14 19 18 19s3-7 4-7',
};

export default function EqModeIcon({ kind }: { kind: TEqModeScope }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[kind]} />
    </svg>
  );
}
