import { useId, useMemo } from 'react';

/**
 * A cover drawn from a scene's own colours, for the moment before its picture
 * arrives and for a scene whose picture never does — so no card in the gallery
 * is ever a grey hole or a flat gradient that reads as a placeholder.
 *
 * Light ribbons over the scene's darkest colour and a low spectrum along the
 * floor: what a music visual looks like, in the colours this one uses. The
 * shape comes from the scene's id, so every scene has its own and keeps it.
 * The swatch is checked as two to four hex colours before it reaches here.
 */

/** The Park–Miller modulus: every state stays an exact integer in a double. */
const MODULUS = 2147483647;

/**
 * A small PRNG seeded from the id — the same id draws the same cover — in
 * plain arithmetic: the "minimal standard" generator, whose products stay
 * under 2^47 and so never lose a bit.
 */
const seeded = (text: string) => {
  let state =
    Array.from(text).reduce(
      (hash, char) => (hash * 31 + char.charCodeAt(0)) % MODULUS,
      7,
    ) || 1;
  return () => {
    state = (state * 48271) % MODULUS;
    return state / MODULUS;
  };
};

const WIDTH = 160;
const HEIGHT = 90;
const BARS = 28;

/** A smooth line through points, midpoint to midpoint. */
const smoothPath = (points: ReadonlyArray<readonly [number, number]>) =>
  points
    .map(([x, y], index) => {
      if (index === 0) {
        return `M${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      const [px, py] = points[index - 1];
      return `Q${px.toFixed(1)} ${py.toFixed(1)} ${((px + x) / 2).toFixed(1)} ${((py + y) / 2).toFixed(1)}`;
    })
    .join('');

interface ISwatchArtProps {
  seed: string;
  swatch: readonly string[];
}

export default function SwatchArt({ seed, swatch }: ISwatchArtProps) {
  const id = useId().replace(/:/g, '');
  const [
    ground = '#07111a',
    first = '#19f2b3',
    second = first,
    third = second,
  ] = swatch;

  const shape = useMemo(() => {
    const random = seeded(seed);
    const ribbons = [0, 1, 2].map((index) => {
      const base = 30 + index * 13 + random() * 8;
      const amplitude = 6 + random() * 12;
      const frequency = 0.02 + random() * 0.035;
      const phase = random() * Math.PI * 2;
      const points = Array.from({ length: 11 }, (_, step) => {
        const x = -10 + step * 18;
        return [x, base + Math.sin(x * frequency + phase) * amplitude] as const;
      });
      return smoothPath(points);
    });
    const bars = Array.from({ length: BARS }, (_, index) => {
      const shaped = Math.sin((index / BARS) * Math.PI) * 0.6 + 0.25;
      return Math.max(3, (shaped + random() * 0.45) * 22);
    });
    const glow = { x: 20 + random() * 120, y: 12 + random() * 30 };
    return { ribbons, bars, glow };
  }, [seed]);

  const barWidth = WIDTH / BARS;

  return (
    <svg
      className="gallery-art"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ground} />
          <stop offset="1" stopColor="#020508" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor={third} stopOpacity="0.55" />
          <stop offset="1" stopColor={third} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-bars`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={first} stopOpacity="0.75" />
          <stop offset="1" stopColor={second} stopOpacity="0.1" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill={`url(#${id}-ground)`} />
      <ellipse
        cx={shape.glow.x}
        cy={shape.glow.y}
        rx="70"
        ry="42"
        fill={`url(#${id}-glow)`}
      />
      {shape.bars.map((height, index) => (
        <rect
          // The bars never reorder: the index is the bar's place on the floor.
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          x={index * barWidth + barWidth * 0.18}
          y={HEIGHT - height}
          width={barWidth * 0.64}
          height={height}
          rx="0.8"
          fill={`url(#${id}-bars)`}
        />
      ))}
      <path
        d={shape.ribbons[0]}
        fill="none"
        stroke={first}
        strokeWidth="9"
        strokeOpacity="0.45"
        filter={`url(#${id}-soft)`}
      />
      <path
        d={shape.ribbons[1]}
        fill="none"
        stroke={second}
        strokeWidth="3.2"
        strokeOpacity="0.85"
        strokeLinecap="round"
      />
      <path
        d={shape.ribbons[2]}
        fill="none"
        stroke={third}
        strokeWidth="1.3"
        strokeOpacity="0.95"
        strokeLinecap="round"
      />
      <path
        d={shape.ribbons[1]}
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.6"
        strokeOpacity="0.55"
      />
    </svg>
  );
}
