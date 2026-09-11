const engineHealth = {
  'engineHealth.offTitle': 'Die FluidEQ-Engine läuft nicht auf {device}',
  'engineHealth.offBody':
    'Auf diesem Ausgang läuft Ton ohne deinen EQ. Ein Neustart von Windows-Audio holt die Engine meist zurück, und alles andere in FluidEQ funktioniert währenddessen weiter.',
  'engineHealth.partlyOff': 'TEILWEISE AUS',
  'engineHealth.problemsTitle':
    'Ein Teil deines Klangs erreicht {device} nicht',
  'engineHealth.problem.convolution':
    'Die Faltung ist aus: Die Engine konnte die Impulsantwort nicht laden. Versuche eine andere Datei.',
  'engineHealth.problem.graphic-eq':
    'Der grafische EQ ist aus: Die Engine konnte seine Kurve nicht erstellen.',
  'engineHealth.problem.dsp-rack':
    'Die DSP-Effekte sind aus: Die Engine konnte sie nicht starten.',
  'engineHealth.problem.reload-failed':
    'Deine letzte Änderung wurde nicht geladen, deshalb läuft noch die vorherige.',
  'engineHealth.problem.unwatched':
    'Die Engine sieht die Änderungen nicht, die du für diesen Ausgang machst.',
  'engineHealth.problem.other':
    'Etwas anderes, das die Engine ausführen sollte, läuft nicht.',
  'engineHealth.useApo': 'Equalizer APO verwenden…',
} as const;

export default engineHealth;
