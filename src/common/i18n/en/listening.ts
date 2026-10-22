/**
 * How long people listen (premium 0068): the notice that tells a signed-in
 * account it is counted, the account panel's switch, and the admin's page.
 * `{days}` and `{hours}` are the window and the cap, from `common/listening`.
 */
const listening = {
  'listening.notice.title': 'FluidEQ counts how long you listen',
  'listening.notice.body':
    'One number a day: the minutes of music that played, for the last {days} days and never more than {hours} hours a day. Not what played, nor from where. Only FluidEQ’s admin sees it, added up with everyone else’s and never with your name.',
  'listening.notice.keep': 'Keep it on',
  'listening.notice.off': 'Turn it off',
  'listening.notice.change': 'You can change this any time in your account.',
  'listening.card.title': 'Listening time',
  'listening.card.today': 'Today on this computer',
  'listening.card.notCounted': 'Not counted',
  'listening.card.switch': 'Share how long I listen with FluidEQ',
  'listening.card.what': 'What FluidEQ sees',
  'listening.card.offNote':
    'Off: nothing is counted, and every day you sent has been deleted.',
  'listening.card.unknownNote':
    'Connect to the internet to see or change this.',
  'listening.error.offline':
    'Could not reach FluidEQ. Check your connection and try again.',
  'listening.error.signedOut': 'Sign in again to change this.',
  'listening.error.server': 'That did not go through. Try again.',
  'listening.admin.tab': 'Listening',
  'listening.admin.plan': 'How long people listen',
  'listening.admin.loading': 'Loading the listening figures',
  'listening.admin.time': 'Listening time',
  'listening.admin.timeNote': '{time} a day across the period',
  'listening.admin.listeners': 'Listeners',
  'listening.admin.listenersNote': 'of {accounts} accounts',
  'listening.admin.average': 'A listening day',
  'listening.admin.averageNote': 'per listener, on the days they listened',
  'listening.admin.sharing': 'Sharing',
  'listening.admin.sharingNote':
    '{declined} switched it off · {unasked} not asked yet',
  'listening.admin.chart': 'Each day',
  'listening.admin.chartKey.time': 'Listening time',
  'listening.admin.chartKey.listeners': 'Listeners',
  'listening.admin.day': '{date}: {time} from {listeners} listeners',
  'listening.admin.peak': 'Busiest day: {date}, {time}',
  'listening.admin.empty': 'Nobody has listened in this period yet.',
  'listening.admin.rules':
    'Counted only for accounts that were told and kept it on. Your own account and banned ones are left out. A day is each listener’s own calendar day and counts at most {hours} hours; two computers playing at once count once.',
};

export default listening;
