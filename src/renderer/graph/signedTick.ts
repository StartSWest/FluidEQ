/**
 * A right-hand scale's number, its minus the true minus sign (U+2212) that d3
 * writes on the gain scale down the left: a hyphen there stood beside it at
 * the same height as a shorter, different sign ("−20 dB" against "-20 dB").
 *
 * A module of its own, importing nothing: the analyser's scale
 * (`liveGraphBand.ts`) is read where there is no document, and the graph's
 * paper (`graphPaper.ts`) pulls in the window's colours on import.
 */
const signedTick = (value: number): string =>
  value < 0 ? `\u2212${-value}` : `${value}`;

export default signedTick;
