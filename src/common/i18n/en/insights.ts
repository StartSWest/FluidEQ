/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's reading of which scenes members watch: the Favourites page,
 * and the scenes an account has added, liked and played, under that account.
 */
const insights = {
  'insights.tab': 'Favourites',
  'insights.loading': 'Loading the scenes members watch',
  'insights.period': 'Period',
  'insights.period.week': '7 days',
  'insights.period.month': '30 days',
  'insights.period.quarter': '90 days',
  'insights.period.all': 'All time',
  'insights.favourites.hint':
    'Every scene played, added or liked in the period, ranked by how many people played it, then by time on screen. Your own testing is left out.',
  'insights.favourites.summary': '{scenes} scenes played for {time}',
  'insights.favourites.empty':
    'No scene was played, added or liked in this period.',
  'insights.favourites.kinds': 'Time on screen by kind',
  'insights.favourites.noPlays': 'Nothing played yet in this period.',
  'insights.favourites.advice':
    '{kind} holds {share} of all viewing across {count} scenes. More {kind} scenes are the safest bet.',
  'insights.col.rank': 'Rank',
  'insights.col.scene': 'Scene',
  'insights.col.people': 'People',
  'insights.col.time': 'Time',
  'insights.col.perPerson': 'Per person',
  'insights.col.adds': 'Adds',
  'insights.col.likes': 'Likes',
  'insights.account.title': 'Scenes',
  'insights.account.empty':
    'No scene added, liked or played yet. Play time is counted once the member runs this version of FluidEQ and has seen the updated terms.',
  'insights.account.played': 'Scenes played',
  'insights.account.time': 'On screen',
  'insights.account.added': 'Added',
  'insights.account.liked': 'Liked',
  'insights.account.kind': 'Favourite kind',
  'insights.account.notPlayed': 'Not played',
  'insights.account.days': '{days} days · last {date}',
  'insights.by': 'by {maker}',
  'insights.byFluidEQ': 'by FluidEQ',
  'insights.member': 'a member',
  'insights.chip.added': 'Added {date}',
  'insights.chip.liked': 'Liked',
  'insights.kind.other': 'No category',
  'insights.time.hoursMinutes': '{hours} {minutes}',
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
  'insights.server.noToken': 'Requests need a usage key.',
  'insights.server.tokenSteps':
    'Make an access token on supabase.com under Account → Access tokens (with only “read analytics usage”, if it offers the choice), then add it to the project under Edge Functions → Secrets as USAGE_ACCESS_TOKEN.',
  'insights.server.tokenRefused':
    'Supabase refused the usage key. Make a new one and save it again under the same name.',
  'insights.server.tables': 'Largest tables',
  'insights.server.buckets': 'Files by folder',
  'insights.server.bucketFiles': '{count} files',
  'insights.server.noFiles': 'No files stored yet.',
  'insights.server.egress': 'Data sent',
  'insights.server.egressBody':
    'The free plan includes {limit} a month, and it is usually the first limit reached: every scene and picture a member downloads counts. No API reports it; Supabase shows it on the project’s Usage page.',
  'insights.server.openSupabase': 'Open Supabase',
  'insights.server.rules':
    'The free plan has no end date. Going past a limit brings an email and a grace period; if it goes on, Supabase answers requests with “payment required” until the next month or an upgrade. A project with no requests for {days} days is paused, which FluidEQ’s own traffic prevents.',
} as const;

export default insights;
