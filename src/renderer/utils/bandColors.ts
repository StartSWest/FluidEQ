type Rgb = readonly [number, number, number];

export interface IBandColor {
  color: string;
  muted: string;
  track: string;
}

// Keep the EQ rails and graph points on the same waveform-inspired spectrum.
// The caller supplies a 0..1 position in frequency order, so every fixed
// layout samples the same palette regardless of its band count.
const BAND_COLOR_STOPS: ReadonlyArray<{ position: number; color: Rgb }> = [
  { position: 0, color: [0, 229, 255] },
  { position: 0.28, color: [84, 255, 138] },
  { position: 0.52, color: [255, 230, 109] },
  { position: 0.76, color: [255, 60, 172] },
  { position: 1, color: [139, 92, 255] },
];

/**
 * The palette as gradient stops, for anything painted across the whole axis.
 *
 * Exported from here rather than written out again beside the `<defs>` that
 * needs it: two copies of five colours is two copies that will disagree the
 * first time one of them is adjusted.
 */
export const BAND_SPECTRUM_STOPS: ReadonlyArray<{
  offset: number;
  color: string;
}> = BAND_COLOR_STOPS.map((stop) => ({
  offset: stop.position,
  color: `rgb(${stop.color.join(', ')})`,
}));

/**
 * The same palette as hex, for the colour pickers in the look designer.
 *
 * A native colour input speaks `#rrggbb` and nothing else — hand it
 * `rgb(0, 229, 207)` and it silently shows black — so somebody starting from
 * the spectrum needs it in that form. Derived from the same stops rather than
 * written out again, for the reason the comment above already gives.
 */
export const BAND_SPECTRUM_HEX: readonly string[] = BAND_COLOR_STOPS.map(
  (stop) =>
    `#${stop.color
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`,
);

export const getBandColor = (progress: number): IBandColor => {
  const normalized = Math.max(0, Math.min(1, progress));
  const rightStop =
    BAND_COLOR_STOPS.find((stop) => stop.position >= normalized) ||
    BAND_COLOR_STOPS[BAND_COLOR_STOPS.length - 1];
  const rightIndex = BAND_COLOR_STOPS.indexOf(rightStop);
  const leftStop = BAND_COLOR_STOPS[Math.max(0, rightIndex - 1)];
  const span = rightStop.position - leftStop.position || 1;
  const amount = (normalized - leftStop.position) / span;
  const rgb = leftStop.color.map((channel, index) =>
    Math.round(channel + (rightStop.color[index] - channel) * amount),
  );
  const color = `rgb(${rgb.join(', ')})`;
  return {
    color,
    muted: `rgba(${rgb.join(', ')}, 0.38)`,
    track: `rgba(${rgb.join(', ')}, 0.1)`,
  };
};
