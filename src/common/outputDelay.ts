/* FluidEQ — GPL-3.0-or-later */
/** The engine reports its full path; legacy mirrors report their copy buffer. */
export type TOutputDelayKind = 'buffer' | 'engine' | 'unavailable';
export type TOutputDelayCallback = (
  milliseconds: number,
  kind?: TOutputDelayKind,
) => void;
