const listening = {
  'listening.notice.title': 'FluidEQ zählt, wie lange Sie hören',
  'listening.notice.body':
    'Eine Zahl pro Tag: die Minuten Musik, die gespielt haben, für die letzten {days} Tage und nie mehr als {hours} Stunden am Tag. Nicht, was lief, und nicht, woher. Nur der Administrator von FluidEQ sieht sie, zusammengezählt mit denen aller anderen und nie mit Ihrem Namen.',
  'listening.notice.keep': 'Eingeschaltet lassen',
  'listening.notice.off': 'Ausschalten',
  'listening.notice.change': 'Sie können das jederzeit in Ihrem Konto ändern.',
  'listening.card.title': 'Hörzeit',
  'listening.card.today': 'Heute auf diesem Computer',
  'listening.card.notCounted': 'Nicht gezählt',
  'listening.card.switch': 'Mit FluidEQ teilen, wie lange ich höre',
  'listening.card.what': 'Was FluidEQ sieht',
  'listening.card.offNote':
    'Aus: Nichts wird gezählt, und jeder Tag, den Sie gesendet haben, wurde gelöscht.',
  'listening.card.unknownNote':
    'Verbinden Sie sich mit dem Internet, um das zu sehen oder zu ändern.',
  'listening.error.offline':
    'FluidEQ war nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  'listening.error.signedOut': 'Melden Sie sich erneut an, um das zu ändern.',
  'listening.error.server': 'Das hat nicht geklappt. Versuchen Sie es erneut.',
  'listening.admin.tab': 'Hören',
  'listening.admin.plan': 'Wie lange Menschen hören',
  'listening.admin.loading': 'Hörzahlen werden geladen',
  'listening.admin.time': 'Hörzeit',
  'listening.admin.timeNote': '{time} pro Tag im Zeitraum',
  'listening.admin.listeners': 'Hörer',
  'listening.admin.listenersNote': 'von {accounts} Konten',
  'listening.admin.average': 'Ein Hörtag',
  'listening.admin.averageNote':
    'pro Hörer, an den Tagen, an denen gehört wurde',
  'listening.admin.sharing': 'Teilen',
  'listening.admin.sharingNote':
    '{declined} ausgeschaltet · {unasked} noch nicht gefragt',
  'listening.admin.chart': 'Jeder Tag',
  'listening.admin.chartKey.time': 'Hörzeit',
  'listening.admin.chartKey.listeners': 'Hörer',
  'listening.admin.day': '{date}: {time} von {listeners} Hörern',
  'listening.admin.peak': 'Stärkster Tag: {date}, {time}',
  'listening.admin.empty': 'In diesem Zeitraum hat noch niemand gehört.',
  'listening.admin.rules':
    'Gezählt nur für Konten, die informiert wurden und es eingeschaltet ließen. Ihr eigenes Konto und gesperrte Konten bleiben außen vor. Ein Tag ist der Kalendertag des jeweiligen Hörers und zählt höchstens {hours} Stunden; zwei Computer, die gleichzeitig spielen, zählen einmal.',
};

export default listening;
