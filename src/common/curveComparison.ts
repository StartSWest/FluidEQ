export const CURVE_COMPARISONS = ['A', 'B'] as const;
export type TCurveComparison = (typeof CURVE_COMPARISONS)[number];
export const CURVE_COMPARISON_FILENAME = 'fluideq-curve-phase.txt';
export const DEFAULT_CURVE_COMPARISON: TCurveComparison = 'B';
export const EQ_PHASE_FILENAME = 'fluideq-eq-phase.txt';
export type TPhaseScope = 'eq' | 'curves';

export interface ICurveComparisonStatus {
  variant: TCurveComparison;
  eqVariant: TCurveComparison;
  eqSupported: boolean;
  hasSampledCurves: boolean;
  supported: boolean;
  active: boolean;
}

export const supportsCurveComparison = (version?: string): boolean => {
  const [major, minor] = version?.split('.').map(Number) ?? [];
  return major > 1 || (major === 1 && minor >= 6);
};

export const isCurveComparison = (value: unknown): value is TCurveComparison =>
  value === 'A' || value === 'B';

export const supportsEqPhase = supportsCurveComparison;
