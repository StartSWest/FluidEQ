/**
 * Why the server stopped handing out scene downloads for now (server
 * migration 0117), as main tells the window.
 *
 * Every account has a daily allowance of downloads, set well above what
 * anybody uses in a day, so that a stolen or scripted account cannot run up
 * the server's bill; and the whole service has a daily ceiling past which
 * gallery previews pause while scenes people own still download.
 */
export interface ISceneDownloadsPaused {
  /** `daily_allowance`: this account's day is used up. `busy`: the service's. */
  reason: 'daily_allowance' | 'busy';
  /** When downloads come back: the next UTC midnight, as ISO 8601. */
  resetsAt: string;
}

export const isSceneDownloadsPaused = (
  value: unknown,
): value is ISceneDownloadsPaused =>
  typeof value === 'object' &&
  value !== null &&
  'reason' in value &&
  (value.reason === 'daily_allowance' || value.reason === 'busy') &&
  'resetsAt' in value &&
  typeof value.resetsAt === 'string' &&
  Number.isFinite(Date.parse(value.resetsAt));
