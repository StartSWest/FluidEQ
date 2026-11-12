/* FluidEQ — GPL-3.0-or-later */

/**
 * Whose turn it is among the dialogs that open by themselves at launch.
 *
 * One at a time, in this order (Ivan, 2026-11-11): the licence gate, then
 * What's New (the tour, and the changelog it opens), then the free edition's
 * word that updates are changing. Each waits on the state that says the ones
 * before it are closed, never on a clock; two panels on top of each other on
 * a first run read as a malfunction.
 */
export type TLaunchTurn = 'gate' | 'news' | 'notices';

export const launchTurn = (open: {
  gate: boolean;
  tour: boolean;
  whatsNew: boolean;
}): TLaunchTurn => {
  if (open.gate) {
    return 'gate';
  }
  return open.tour || open.whatsNew ? 'news' : 'notices';
};
