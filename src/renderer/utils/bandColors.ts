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
