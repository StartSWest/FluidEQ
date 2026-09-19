/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Scenes under review: the admin's page of scenes to approve, what a maker is
 * told about the scene they sent, and the corner notice for either.
 *
 * A member's scene waits for the admin before anybody else sees it, and so
 * does every new version of one. The reasons a scene is not approved are said
 * to both of them from the same list, so they are worded to read right from
 * either side.
 */
const review = {
  'review.tab': 'To approve',
  'review.tabCount': 'Waiting for approval: {count}',
  'review.badge': 'Waiting for you: {count}',
  'review.hint':
    'Every scene a member publishes, and every new version of one, waits here until you approve it. Nobody else sees it until then.',
  'review.empty.title': 'Nothing waiting',
  'review.empty.hint':
    'New scenes and new versions appear here when members publish them.',
  'review.kind.new': 'New scene',
  'review.kind.update': 'Update · v{from} → v{to}',
  'review.sent': 'Sent {date}',
  'review.open': 'Review',
  'review.back': 'Everything waiting',
  'review.flag.takenDown': 'Taken down from the gallery',
  'review.flag.takenDownHint':
    'Taken down from the gallery: restore it from Reported to approve a new version',
  'review.flag.reports': 'Open reports on the version out now: {count}',
  'review.note.title': 'What its maker says is new',
  'review.note.none': 'Its maker wrote nothing about this version.',
  'review.sceneFailed': 'This scene could not be opened to watch.',
  'review.changed':
    'This scene changed while you watched: its maker sent a newer version or withdrew it. The list shows what waits now.',
  'review.approve': 'Approve and publish',
  'review.approving': 'Approving…',
  'review.reject': 'Do not approve',
  'review.reject.title': 'Why is it not approved?',
  'review.reject.lead':
    'Its maker is told the reason, and your line if you write one.',
  'review.reject.noteLabel': 'A line to its maker (optional)',
  'review.reject.notePlaceholder':
    'Like: the white flash at the drop is too strong',
  'review.reject.cancel': 'Back',
  'review.reject.send': 'Send the answer',
  'review.reject.sending': 'Sending…',
  'review.reason.flashing': 'Flashing or strobing',
  'review.reason.rights': "Someone else's work",
  'review.reason.offensive': 'Offensive',
  'review.reason.broken': 'Broken or too heavy to play',
  'review.reason.other': 'Something else',
  'review.done.approved': '{name} is in the gallery now.',
  'review.done.rejected':
    '{name} was not approved. Its maker will be told why.',
  'review.failed': 'The answer did not go through. Try again.',
  'review.versionRaised':
    'The gallery already has this version or a newer one.',
  'review.takenDown':
    'It was taken down meanwhile, so it takes no new version. Restore it from Reported first.',
  'review.deleted': "It was deleted for good, so it can't take a new version.",
  'review.filesFailed':
    "Approved, but its files didn't reach the gallery. Press Approve and publish again to finish.",
  'review.forbidden': 'Only the FluidEQ admin can approve scenes.',
  'review.fine.new':
    'Approving puts it in the gallery at version {version}: everyone signed in sees it, and Plus members can add it.',
  'review.fine.update':
    'Approving replaces version {version} for everyone who has the scene. Not approving leaves version {version} where it is.',
  'review.state.pending': 'Under review',
  'review.state.pendingUpdate': 'Version {version} under review',
  'review.state.rejected': 'Not approved',
  'review.state.rejectedUpdate': 'Version {version} not approved',
  'review.withdraw': 'Withdraw',
  'review.withdrawConfirm': 'Withdraw it from review?',
  'review.remove': 'Remove',
  'review.removeConfirm': 'Remove it from this list?',
  'review.withdrawn': '{name} was withdrawn.',
  'review.notice.waitingOne': 'A scene is waiting for your approval',
  'review.notice.waitingMany': '{count} scenes are waiting for your approval',
  'review.notice.waitingWho': '{name} by {maker}',
  'review.notice.waitingNewest': 'Newest: {name} by {maker}',
  'review.notice.later': 'Later',
  'review.notice.review': 'Review now',
  'review.notice.approved': '{name} is in the gallery',
  'review.notice.approvedBody': 'It was approved. Plus members can add it now.',
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
