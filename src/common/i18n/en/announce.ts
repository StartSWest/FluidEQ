/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Announcements of new scenes: the big card members see once, and what it
 * says when it is a preview of one not yet out.
 */
const announce = {
  'announce.news.title': 'App news',
  'announce.news.description':
    'Announcements from FluidEQ. Read them here whenever you like.',
  'announce.news.read': 'Read news',
  'announce.news.offline':
    'You are offline. Showing saved news that is still current.',
  'announce.news.empty': 'No current announcements.',

  'announce.eyebrow': 'New in Visualizers · {count} scenes',
  'announce.try': 'Try them now',
  'announce.later': 'Later',
  'announce.previewNote': 'Preview. Nothing was sent and nothing was recorded.',
} as const;

export default announce;
