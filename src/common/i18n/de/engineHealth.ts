const engineHealth = {
  'engineHealth.offTitle': 'Die FluidEQ-Engine läuft nicht auf {device}',
  'engineHealth.offBody':
    'Auf diesem Ausgang läuft Ton ohne Ihren EQ. Ein Neustart von Windows-Audio holt die Engine meist zurück, und alles andere in FluidEQ funktioniert währenddessen weiter.',
  'engineHealth.neverRanTitle': 'Windows hat die FluidEQ-Engine nie gestartet',
  'engineHealth.neverRanBody':
    'Die Engine ist installiert und auf {device} eingerichtet, und Windows hat sie dort kein einziges Mal geladen – ein Neustart des Audios holt sie also nicht zurück. FluidEQ hat bereits alles in Ordnung gebracht, woran es herankommt; bleibt es dabei, hält Ihre Sicherheitssoftware oder der Treiber Ihrer Soundkarte sie auf. Equalizer APO verarbeitet Ihren Klang in der Zwischenzeit.',
  'engineHealth.bypassedTitle':
    'Ihr Ton läuft auf {device} nicht durch FluidEQ',
  'engineHealth.bypassedBody':
    'Die Engine ist installiert und für diesen Ausgang eingeschaltet, und Windows spielt die Musik daran vorbei — bei ihr ist kein Ton angekommen. Ein Ausgang hat mehrere Plätze für einen Effekt, und Windows wählt für jede Art von Wiedergabe einen anderen; FluidEQ sitzt auf einem, an dem diese Musik nicht vorbeikommt. Ein anderer Platz kostet eine Windows-Berechtigung und eine Sekunde Stille.',
  'engineHealth.tryAnotherSlot': 'Anderen Platz versuchen',
  'engineHealth.partlyOff': 'TEILWEISE AUS',
  'engineHealth.problemsTitle': 'Ein Teil Ihres Klangs erreicht {device} nicht',
  'engineHealth.problem.convolution':
    'Die Faltung ist aus: Die Engine konnte die Impulsantwort nicht laden. Versuchen Sie eine andere Datei.',
  'engineHealth.problem.eq-phase':
    'Der linearphasige EQ konnte nicht starten; die ursprünglichen Filter bleiben aktiv.',
  'engineHealth.problem.graphic-eq':
    'Der grafische EQ ist aus: Die Engine konnte seine Kurve nicht erstellen.',
  'engineHealth.problem.dsp-rack':
    'Die DSP-Effekte sind aus: Die Engine konnte sie nicht starten.',
  'engineHealth.problem.reload-failed':
    'Ihre letzte Änderung wurde nicht geladen, deshalb läuft noch die vorherige.',
  'engineHealth.problem.unwatched':
    'Die Engine sieht die Änderungen nicht, die Sie für diesen Ausgang machen.',
  'engineHealth.problem.other':
    'Etwas anderes, das die Engine ausführen sollte, läuft nicht.',
  'engineHealth.engineIsOld':
    'Die auf diesem PC installierte FluidEQ-Engine ist nicht die, die diese Version von FluidEQ mitbringt.',
  'engineHealth.rackNeedsEngine':
    'Die DSP-Effekte laufen in der Engine selbst – ein Neustart des Windows-Audios startet also dieselbe Engine erneut. Was hilft, ist FluidEQs eigene Engine einzusetzen: eine Windows-Berechtigung und eine Sekunde Stille.',
  'engineHealth.useApo': 'Equalizer APO verwenden…',
} as const;

export default engineHealth;
