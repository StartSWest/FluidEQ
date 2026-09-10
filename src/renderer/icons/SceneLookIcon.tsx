interface ISceneLookIconProps {
  /** Two to four hex colours the pack declares for itself. */
  swatch: readonly string[];
  className?: string;
}

/**
 * The picker-row icon for a premium scene.
 *
 * A sibling of `LookIcon`, not a branch inside it: that component is keyed on
 * `GraphStyle`, which a scene does not have, and a component that needs a mode
 * flag to behave two ways is two components. This one needs no GPU — it paints
 * the pack's own swatch as a curtain of light so the row says something about
 * what the scene looks like before it is chosen, which is the whole reason the
 * icons were added.
 */
export default function SceneLookIcon({
  swatch,
  className,
}: ISceneLookIconProps) {
  // De-duplicated: a repeated colour adds nothing to a gradient, and it is
  // what lets each stop be keyed by its own value.
  const colours = Array.from(
    new Set(swatch.length >= 2 ? swatch : ['#00e5cf', '#9cfff4', '#ff3cac']),
  );
  const stops = colours.map((colour, index) => (
    <stop
      key={colour}
      offset={`${(index / Math.max(1, colours.length - 1)) * 100}%`}
      stopColor={colour}
    />
  ));
  // One gradient per instance. The picker draws dozens of rows, and two rows
  // sharing an SVG id would paint the second with the first's colours.
  const gradientId = `scene-look-${colours.join('').replace(/#/g, '')}`;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          {stops}
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#07131c" />
      <path
        d="M3 20 C5 14 6 9 7 5 C8 11 9 14 10 20 Z"
        fill={`url(#${gradientId})`}
        opacity="0.75"
      />
      <path
        d="M9 20 C11 12 12 7 13 3 C14 9 16 13 17 20 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M15 20 C16 15 17 11 19 8 C20 12 21 16 21 20 Z"
        fill={`url(#${gradientId})`}
        opacity="0.6"
      />
    </svg>
  );
}
