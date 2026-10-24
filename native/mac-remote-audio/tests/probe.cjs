/* FluidEQ — GPL-3.0-or-later */
// Measure anti-phase probe power in short Hann windows. One coherent long
// DFT mistakes clock drift or a phase discontinuity for a gain change.
// Averaging power preserves level across phase changes; the stereo side
// rejects centre-panned playback. Synthetic controls pin the meter. No PCM
// is saved.
module.exports = (rate, seconds, centreHz) => {
  const total = Math.round(rate * seconds);
  const windowFrames = Math.min(total, Math.round(rate / 10));
  const bins = Array.from({ length: 3 }, (_, index) => {
    const hz = centreHz + index - 1;
    const step = (2 * Math.PI * hz) / rate;
    return {
      hz,
      sine: 0,
      cosine: 1,
      sinStep: Math.sin(step),
      cosStep: Math.cos(step),
      real: 0,
      imaginary: 0,
    };
  });
  let count = 0;
  let power = 0;
  let windowCount = 0;
  return {
    push(pcm, frames) {
      for (let frame = 0; frame < frames && count < total; ++frame, ++count) {
        const side =
          (pcm.readFloatLE(frame * 8) - pcm.readFloatLE(frame * 8 + 4)) / 2;
        const weighted =
          side *
          (0.5 -
            0.5 * Math.cos((2 * Math.PI * windowCount) / (windowFrames - 1)));
        for (const bin of bins) {
          bin.real += weighted * bin.cosine;
          bin.imaginary += weighted * bin.sine;
          const sine = bin.sine * bin.cosStep + bin.cosine * bin.sinStep;
          bin.cosine = bin.cosine * bin.cosStep - bin.sine * bin.sinStep;
          bin.sine = sine;
        }
        windowCount += 1;
        if (windowCount === windowFrames) {
          const amplitude = Math.max(
            ...bins.map(
              (bin) =>
                (4 * Math.hypot(bin.real, bin.imaginary)) / (windowFrames - 1),
            ),
          );
          power += amplitude * amplitude * windowFrames;
          bins.forEach((bin) => {
            bin.real = 0;
            bin.imaginary = 0;
          });
          windowCount = 0;
        }
      }
      return count === total;
    },
    result() {
      return Math.sqrt(power / (total - windowCount));
    },
  };
};
