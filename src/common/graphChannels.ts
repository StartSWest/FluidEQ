/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether the graph draws the two channels as one signal or as two.
 *
 * `joined` is what every look has always drawn: an analyser folds whatever
 * arrives down to one signal before its transform, so left and right are
 * already added together by the time a figure is built from them.
 *
 * `split` reads each channel on its own analyser and draws two figures —
 * left above the centre line, right below it — which is the only way a
 * hard-panned mix, a channel that has gone quiet, or a correction that is
 * not the same on both sides can be seen at all. It costs a second transform
 * per frame, which is why it is a choice and not the default.
 */
export type TGraphChannels = 'joined' | 'split';

export const GRAPH_CHANNELS: TGraphChannels[] = ['joined', 'split'];

export const isGraphChannels = (value: unknown): value is TGraphChannels =>
  typeof value === 'string' && GRAPH_CHANNELS.includes(value as TGraphChannels);
