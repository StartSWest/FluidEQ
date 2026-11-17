/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Who the native host is kept running for between its two players.
 *
 * A player lets go of the host when it loses the lease (`hostLease.ts`), and
 * the other engages it in the same breath; tearing the process and its device
 * down between the two cost a second and a gap (`residentHost` in
 * `nativeBackend.ts`). Whether to keep it is a question about the player
 * coming in: does it have something for the host to play? That is what each
 * player registers here — its want, apart from whether it holds the lease,
 * because at the moment of the handover the incoming player has not yet
 * rendered as the holder.
 *
 * A module store for the reason `hostLease.ts` gives: the two players sit in
 * different branches of the tree.
 */
import { useSyncExternalStore } from 'react';
import { onHostClientChange, readHostClient, THostClient } from './hostLease';
import { hasResidentHost, releaseResidentHost } from './nativeBackend';

const wanting = new Map<THostClient, number>();

const wants = (client: THostClient): boolean => (wanting.get(client) ?? 0) > 0;

/** Whether the player holding the host now has something for it to play. */
const holderWantsHost = (): boolean => wants(readHostClient());

/**
 * Whether a host `outgoing` is letting go of has a player coming for it: the
 * lease has moved to the other player, and that player wants the host.
 */
export const hostWantedAfter = (outgoing: THostClient): boolean => {
  const next = readHostClient();
  return next !== outgoing && wants(next);
};

/**
 * `client` has something for the host to play, whether or not it holds it.
 * Returns the withdrawal, which also releases a host kept running for
 * `client` that it will now never take.
 */
export const wantHost = (client: THostClient): (() => void) => {
  wanting.set(client, (wanting.get(client) ?? 0) + 1);
  let withdrawn = false;
  return () => {
    if (withdrawn) {
      return;
    }
    withdrawn = true;
    wanting.set(client, Math.max(0, (wanting.get(client) ?? 0) - 1));
    releaseResidentHost(holderWantsHost).catch(() => undefined);
  };
};

// The lease handed to a player with nothing to play: a host kept running for
// whoever held it before is nobody's now.
onHostClientChange(() => {
  releaseResidentHost(holderWantsHost).catch(() => undefined);
});

/**
 * Players holding an engaged host, until their let-go has run: the player
 * leaving still holds it while the one coming in starts to engage.
 */
const holding = new Map<THostClient, number>();

const otherHolds = (client: THostClient): boolean =>
  [...holding].some(([held, count]) => held !== client && count > 0);

/** `client`'s engine engaged; returns its end, said once. */
export const holdHost = (client: THostClient): (() => void) => {
  holding.set(client, (holding.get(client) ?? 0) + 1);
  let ended = false;
  return () => {
    if (ended) {
      return;
    }
    ended = true;
    holding.set(client, Math.max(0, (holding.get(client) ?? 0) - 1));
  };
};

/**
 * Whether `client` engaging now takes the host over from the other player —
 * still letting go of it, or already gone and left it running — rather than
 * starting one. Only then is the engagement a matter of milliseconds, and
 * only then may the player's media element be kept quiet through it: kept
 * quiet through a host starting from nothing, a song started on the element
 * was a second in by the time the host took it over from there.
 */
export const takesHostOver = (client: THostClient): boolean =>
  otherHolds(client) || hasResidentHost();

/** Players taking the host over, their elements kept quiet until it has. */
const quiet = new Map<THostClient, number>();
const quietListeners = new Set<() => void>();

const readQuiet = (client: THostClient): boolean =>
  (quiet.get(client) ?? 0) > 0;

/** `client`'s element kept quiet through its takeover; returns its end. */
export const quietenFor = (client: THostClient): (() => void) => {
  quiet.set(client, (quiet.get(client) ?? 0) + 1);
  quietListeners.forEach((listener) => listener());
  let ended = false;
  return () => {
    if (ended) {
      return;
    }
    ended = true;
    quiet.set(client, Math.max(0, (quiet.get(client) ?? 0) - 1));
    quietListeners.forEach((listener) => listener());
  };
};

const subscribeQuiet = (listener: () => void) => {
  quietListeners.add(listener);
  return () => {
    quietListeners.delete(listener);
  };
};

/** Whether `client`'s element is to be kept quiet (`useMuteWhileEngaging`). */
export const useQuietWhileEngaging = (client: THostClient): boolean =>
  useSyncExternalStore(
    subscribeQuiet,
    () => readQuiet(client),
    () => readQuiet(client),
  );
