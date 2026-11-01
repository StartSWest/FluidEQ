/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the listener just asked to be, held on the bar until the host's
 * clock can be believed again.
 *
 * A seek is a round trip — renderer to main, down the host's stdin, into the
 * deck, and back up on a later telemetry frame. The bar reads the host, so
 * without this it spends that trip showing the position the thumb was dragged
 * AWAY from: released at 2:30, snaps to 0:45, jumps to 2:30.
 *
 * Let go on the first clock reading AFTER THE HOST HAS ANSWERED, and not on
 * the first reading that moves: the host sends forty readings a second and
 * the round trip is longer than one of them, so the reading that moved was
 * the song playing on from where it was, and the bar went back there for the
 * rest of the trip and then jumped to the target — the knob going to the new
 * place, back, and to the new place again, on every seek (Ivan, 2026-09-22).
 * The deck's clock reads the target from the moment a seek is applied, before
 * the answer is written, so the first reading after the answer is the truth:
 * the target if the seek landed, the song playing on if the deck refused it —
 * and a refusal is answered as such and let go of at once. Nothing here waits
 * on a duration.
 */
export interface IPendingSeek {
  targetMs: number;
  /** The clock's reading when the host answered; absent until it has. */
  answeredAtSeconds?: number;
}

export const holdSeek = (targetMs: number): IPendingSeek => ({ targetMs });

/**
 * The host's answer: held until the clock moves on from `clockSeconds`, or
 * nothing held at all when the deck refused the seek.
 */
export const seekAnswered = (
  pending: IPendingSeek,
  applied: boolean,
  clockSeconds: number,
): IPendingSeek | undefined =>
  applied
    ? { targetMs: pending.targetMs, answeredAtSeconds: clockSeconds }
    : undefined;

/** Whether the bar may read the clock again. */
export const seekSettled = (
  pending: IPendingSeek,
  clockSeconds: number,
  hostOwnsTransport: boolean,
): boolean =>
  !hostOwnsTransport ||
  (pending.answeredAtSeconds !== undefined &&
    clockSeconds !== pending.answeredAtSeconds);
