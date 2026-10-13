/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Announcements of new scenes: the big card members see once, and the
 * admin's page where one is written and scheduled.
 */
const announce = {
  'announce.eyebrow': 'New in Plus · {count} scenes',
  'announce.trialEnds':
    'Your free trial ends soon. Keep these scenes and every other one with Plus.',
  'announce.try': 'Try them now',
  'announce.keepPlus': 'Keep Plus',
  'announce.later': 'Later',
  'announce.previewNote': 'Preview. Nothing was sent and nothing was recorded.',
  'announce.untitled': 'New scenes',
  'announce.tab': 'Announcements',
  'announce.pageHint':
    'Each person sees an announcement once, big, over whatever they have open. Members whose trial ends within two days also see a line about keeping Plus.',
  'announce.field.title': 'Title',
  'announce.field.titlePlaceholder': 'For example: Night Drive',
  'announce.field.body': 'What it is',
  'announce.field.bodyPlaceholder':
    'For example: six new city-at-night scenes that move with your bass and your treble.',
  'announce.field.scenes':
    'Scenes in it: {count} of {most}. The first is the big frame.',
  'announce.field.noScenes':
    'FluidEQ’s scenes have not loaded yet. Open Visualizers once, then come back.',
  'announce.field.when': 'Goes out',
  'announce.field.audience': 'Who sees it',
  'announce.audience.everyone': 'Everyone signed in',
  'announce.audience.everyoneLine':
    'Plus members, trials and free accounts. Free accounts are sent to Visualizers to try the scenes.',
  'announce.audience.members': 'Plus members and trials',
  'announce.audience.membersLine': 'Everyone who can play the scenes now.',
  'announce.audience.trialEnding': 'Only trials ending within 2 days',
  'announce.audience.trialEndingLine':
    'The members who are about to decide whether to pay.',
  'announce.trials.dayAfter': '{count} trials end on {date}, the day after.',
  'announce.trials.twoAfter': '{count} more the day after that.',
  'announce.preview': 'Preview',
  'announce.schedule': 'Schedule',
  'announce.saveChanges': 'Save changes',
  'announce.stopEditing': 'Stop editing',
  'announce.done': 'Scheduled. It goes out {date}.',
  'announce.listTitle': 'Scheduled and showing',
  'announce.listEmpty': 'Nothing scheduled.',
  'announce.state.out': 'Showing',
  'announce.state.later': 'Scheduled',
  'announce.edit': 'Edit',
  'announce.cancel': 'Cancel it',
  'announce.cancelAsk': 'Cancel this announcement?',
  'announce.cancelOut': 'Stop showing it to anyone who has not seen it?',
  'announce.keep': 'Keep it',
} as const;

export default announce;
