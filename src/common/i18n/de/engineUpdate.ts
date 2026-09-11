const engineUpdate = {
  'engineUpdate.badge': 'ENGINE-UPDATE',
  'engineUpdate.title': 'Eine neue FluidEQ-Engine ist bereit',
  'engineUpdate.body':
    'Diese FluidEQ-Version bringt eine aktualisierte Audio-Engine mit. Die Installation fragt Windows um Erlaubnis und startet den Ton für ein paar Sekunden neu.',
  'engineUpdate.action': 'Engine aktualisieren',
  'engineUpdate.running': 'Die Engine wird aktualisiert…',
  'engineUpdate.doneBadge': 'AKTUELL',
  'engineUpdate.doneTitle': 'Die FluidEQ-Engine ist aktuell',
  'engineUpdate.doneBody':
    'Windows-Audio wurde mit der neuen Engine neu gestartet; Ihre Ausgänge und Ihr EQ sind unverändert. Öffnen Sie Programme, die noch stumm sind, erneut.',
  'engineUpdate.declined':
    'Die Windows-Berechtigung wurde verweigert, daher spielt Ihr EQ weiter über die bisherige Engine.',
  'engineUpdate.failed':
    'Die Engine konnte nicht aktualisiert werden, daher spielt Ihr EQ weiter über die bisherige.',
} as const;

export default engineUpdate;
