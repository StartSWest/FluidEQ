/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Scenes under review: what a maker is told about the scene they sent, and
 * the corner notice that says an answer came.
 *
 * A member's scene waits for review before anybody else sees it, and so does
 * every new version of one. The reasons a scene is not approved are worded to
 * read right to the maker who is told them.
 */
const review = {
  'review.sent': 'Sent {date}',
  'review.reason.flashing': 'Flashing or strobing',
  'review.reason.rights': "Someone else's work",
  'review.reason.offensive': 'Offensive',
  'review.reason.broken': 'Broken or too heavy to play',
  'review.reason.other': 'Something else',
  'review.state.pending': 'Under review',
  'review.state.pendingUpdate': 'Version {version} under review',
  'review.state.rejected': 'Not approved',
  'review.state.rejectedUpdate': 'Version {version} not approved',
  'review.withdraw': 'Withdraw',
  'review.withdrawConfirm': 'Withdraw it from review?',
  'review.remove': 'Remove',
  'review.removeConfirm': 'Remove it from this list?',
  'review.withdrawn': '{name} was withdrawn.',
  'review.notice.approved': '{name} is in the gallery',
  'review.notice.approvedBody':
    'It was approved. It plays free for you everywhere now, and anyone can get it.',
  'review.notice.approvedUpdate':
    'Version {version} of {name} is in the gallery',
  'review.notice.approvedUpdateBody':
    'It was approved. Everyone who has the scene gets the new version.',
  'review.notice.rejected': '{name} was not approved',
  'review.notice.rejectedUpdate':
    'Version {version} of {name} was not approved',
  'review.notice.keepsLive': 'Everyone who has it keeps version {version}.',
  'review.notice.gotIt': 'Got it',
  'review.notice.openStudio': 'Open the Studio',
  'review.notice.openMine': 'Your scenes',
} as const;

export default review;
