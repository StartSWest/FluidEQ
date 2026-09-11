/**
 * The DSP page's line while the rack runs nowhere under the FluidEQ Engine —
 * FluidEQ switched off, or the engine not running. See `rackPlacement.ts`.
 * Its own file because `dsp.ts` is already past the project's length limit.
 */
const dspOff = {
  'dspOff.switchedOff': 'FluidEQ is switched off, so the DSP is off too.',
  'dspOff.engineOff':
    'The FluidEQ Engine isn’t running on this output, so the DSP is off too.',
  'dspOff.turnOn': 'Turn FluidEQ on',
} as const;

export default dspOff;
