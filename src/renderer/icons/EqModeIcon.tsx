const PATHS: Record<string, string> = {
  eq: 'M5 3v18M12 3v18M19 3v18M2 8h6M9 16h6M16 10h6',
  curves: 'M2 17C6 17 5 5 10 5S14 19 18 19s3-7 4-7',
  normal: 'M3 16h5V8h8v8h5',
  studio: 'M3 18h4v-6h4V6h4v6h4v6h2',
  double: 'M3 17h5V7h8v10h5M3 21h18',
  constant: 'M2 18C8 18 7 6 12 6s4 12 10 12',
  proportional: 'M2 18h5c3 0 3-14 5-14s2 14 5 14h5',
  asymmetric: 'M2 14c4 0 3-8 7-8s3 8 6 8c2 0 1 7 3 7s1-7 4-7',
  off: 'M2 12h5l2-7 3 14 3-12 2 5h5',
  twelfth: 'M2 12h4c2 0 2-7 5-7s2 14 5 14 2-7 6-7',
  third: 'M2 12c5 0 5-5 10-5s5 10 10 10',
  minimumPhase: 'M2 17h3V5l3 15 3-10 3 7 3-3 3 3h2',
  linearPhase: 'M2 16h4l2-4 2 8 2-16 2 16 2-8 2 4h4',
};

export default function EqModeIcon({ kind }: { kind: string }) {
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
