/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's reading of which scenes members choose: the Favourites page,
 * and the scenes an account has added and liked, under that account.
 */
const insights = {
  'insights.tab': 'Favourites',
  'insights.loading': 'Loading the scenes members get',
  'insights.period': 'Period',
  'insights.period.week': '7 days',
  'insights.period.month': '30 days',
  'insights.period.quarter': '90 days',
  'insights.period.all': 'All time',
  'insights.favourites.hint':
    'Every scene added or liked in the period, ranked by adds, then likes. Your own are left out.',
  'insights.favourites.summary': '{scenes} scenes added {adds} times',
  'insights.favourites.empty': 'No scene was added or liked in this period.',
  'insights.favourites.kinds': 'Adds by kind',
  'insights.favourites.noAdds': 'Nothing added yet in this period.',
  'insights.favourites.advice':
    '{kind} holds {share} of all adds across {count} scenes. More {kind} scenes are the safest bet.',
  'insights.col.rank': 'Rank',
  'insights.col.scene': 'Scene',
  'insights.col.adds': 'Adds',
  'insights.col.likes': 'Likes',
  'insights.account.title': 'Scenes',
  'insights.account.empty': 'No scene added or liked yet.',
  'insights.account.added': 'Added',
  'insights.account.liked': 'Liked',
  'insights.account.kind': 'Favourite kind',
  'insights.by': 'by {maker}',
  'insights.byFluidEQ': 'by FluidEQ',
  'insights.member': 'a member',
  'insights.chip.added': 'Added {date}',
  'insights.chip.liked': 'Liked',
  'insights.chip.unpublished': 'Not published',
  'insights.kind.other': 'No category',
  'insights.error.offline':
    'FluidEQ couldn’t reach its server. Check your connection and try again.',
  'insights.error.signedOut': 'Sign in again to see this.',
  'insights.error.server': 'This could not be loaded. Try again.',
  'insights.error.forbidden': 'Only the FluidEQ admin can see this.',
  'insights.error.notDeployed':
    'The server does not have this yet. It arrives with the server update that goes with this version of FluidEQ.',
  'insights.server.tab': 'Server',
  'insights.server.loading': 'Measuring the server',
  'insights.server.plan': 'Supabase free plan',
  'insights.server.measured': 'Measured at {time}',
  'insights.server.database': 'Database',
  'insights.server.files': 'Files',
  'insights.server.active': 'Active accounts, 30 days',
  'insights.server.activeNote': '{accounts} accounts in all',
  'insights.server.of': 'of {limit}',
  'insights.server.used': '{share} used',
  'insights.server.requests': 'Requests, last 7 days',
  'insights.server.unlimited': 'no limit on the free plan',
  'insights.server.kind.rest': 'Database',
  'insights.server.kind.auth': 'Sign-in',
  'insights.server.kind.storage': 'Files',
  'insights.server.kind.realtime': 'Live',
  'insights.server.noToken':
    'Request counts are not switched on for this server.',
  'insights.server.tokenRefused':
    'The server could not read the request counts.',
  'insights.server.tables': 'Largest tables',
  'insights.server.buckets': 'Files by folder',
  'insights.server.bucketFiles': '{count} files',
  'insights.server.noFiles': 'No files stored yet.',
  'insights.server.egress': 'Data sent',
  'insights.server.egressBody':
    'The free plan includes {limit} a month, and it is usually the first limit reached: every scene and picture a member downloads counts. No API reports it; Supabase shows it on the project’s Usage page.',
  'insights.server.openSupabase': 'Open Supabase',
  'insights.server.limit.warn': 'The server is filling up',
  'insights.server.limit.full': 'The server is nearly full',
  'insights.server.limit.body':
    "{what} is at {share} of Supabase's free plan. Move the project to a paid plan before it fills, or FluidEQ's online features start failing.",
  'insights.server.limit.database': 'The database',
  'insights.server.limit.files': 'File storage',
  'insights.server.limit.accounts': 'Active accounts',
  'insights.server.limit.later': 'Later',
  'insights.server.limit.open': 'Open the Server page',
  'insights.server.limit.badge': '{share} of the free plan used',
  'insights.server.rules':
    'The free plan has no end date. Going past a limit brings an email and a grace period; if it goes on, Supabase answers requests with “payment required” until the next month or an upgrade. A project with no requests for {days} days is paused, which FluidEQ’s own traffic prevents.',
} as const;

export default insights;
