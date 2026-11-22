/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'Mikrofon',
  'mic.label': 'Mikrofon',
  'mic.pickHint': 'Wählen Sie das Mikrofon, dessen Klang Sie formen möchten',
  'mic.list.heading': 'Mikrofone an diesem PC',
  'mic.list.on': 'An',
  'mic.list.off': 'Nicht eingerichtet',
  'mic.live': 'Live in jeder App · geringe Latenz {ms} ms',
  'mic.notSetUp': 'Auf diesem Mikrofon noch nicht eingerichtet',
  'mic.picture.label':
    'Ihre Stimme: blass, was das Mikrofon aufnimmt, und hell, was andere hören',
  'mic.picture.raw': 'Ihr Mikrofon',
  'mic.picture.heard': 'Was andere hören',
  'mic.picture.gate': 'Gate',
  'mic.profile.label': 'Mikrofonprofil',
  'mic.profile.pickHint':
    'Beginnen Sie mit einem Profil für die Art, wie Sie das Mikrofon nutzen',
  'mic.profile.group.use': 'Nach Einsatz',
  'mic.profile.group.mic': 'Nach Mikrofon',
  'mic.profile.tuned': 'angepasst',
  'mic.profile.stream': 'Streaming',
  'mic.profile.stream.hint': 'Warm, nah und gleichmäßig für Twitch und YouTube',
  'mic.profile.podcast': 'Podcast',
  'mic.profile.podcast.hint': 'Eine natürliche Stimme, sanft im Zaum gehalten',
  'mic.profile.chat': 'Spiel-Chat',
  'mic.profile.chat.hint':
    'Klar und präsent in Discord und im Team-Chat, nichts zwischen den Wörtern',
  'mic.profile.sing': 'Gesang',
  'mic.profile.sing.hint':
    'Offen und luftig, kein Pumpen, jeder Atemzug bleibt erhalten',
  'mic.profile.broadcast': 'Rundfunk',
  'mic.profile.broadcast.hint':
    'Radiostimme: kräftige Tiefen, straff und dicht',
  'mic.profile.noisy': 'Lauter Raum',
  'mic.profile.noisy.hint':
    'Lüfter, Kinder, Verkehr: Stimmreiniger und Gate auf voller Stärke',
  'mic.profile.meet': 'Meetings',
  'mic.profile.meet.hint':
    'Teams und Zoom: klare Worte, die eigene Bereinigung bleibt den Apps überlassen',
  'mic.profile.laptop': 'Laptop-Mikrofon',
  'mic.profile.laptop.hint':
    'Dünn, fern und hallig: Tiefensperre hoch, Stimmreiniger kräftig',
  'mic.profile.headset': 'Headset-Mikrofon',
  'mic.profile.headset.hint':
    'Eine kleine Kapsel nah am Mund: Wärme zurück, Plosive weg',
  'mic.reset': 'Auf {profile} zurücksetzen',
  'mic.setup.title':
    'Die FluidEQ Engine ist auf {mic} noch nicht eingerichtet.',
  'mic.setup.body':
    'Windows fragt einmal um Erlaubnis. Ihre Ausgaben spielen während der Einrichtung weiter.',
  'mic.setup.button': 'Auf diesem Mikrofon einrichten',
  'mic.setup.working': 'Wird eingerichtet…',
  'mic.setup.declined':
    'Windows hat keine Erlaubnis erteilt, daher wurde nichts geändert.',
  'mic.setup.failed': 'Die Einrichtung auf diesem Mikrofon ist fehlgeschlagen.',
  'mic.notFluid.title':
    'Der eigene Klang eines Mikrofons läuft über die FluidEQ Engine.',
  'mic.notFluid.body':
    'Sein Klang bleibt gespeichert und ist zu hören, sobald die FluidEQ Engine ausgewählt ist.',
  'mic.empty.title': 'Kein Mikrofon gefunden',
  'mic.empty.body':
    'Schließen Sie ein Mikrofon an oder aktualisieren Sie die FluidEQ Engine, damit sie Mikrofone auflisten kann.',
  'mic.stage.lowCut': 'Tiefensperre',
  'mic.stage.cleaner': 'Stimmreiniger',
  'mic.stage.gate': 'Gate',
  'mic.stage.deEsser': 'De-Esser',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'Kompressor',
  'mic.stage.limiter': 'Limiter',
  'mic.lowCut.title': 'Tiefensperre',
  'mic.lowCut.description':
    'Entfernt Rumpeln, Tischklopfen und den Lüfter unterhalb der Stimme, bevor der Stimmreiniger sie hört.',
  'mic.lowCut.group.below': 'Unter der Stimme',
  'mic.lowCut.group.belowHint':
    'Nah am Mikrofon nimmt den zusätzlichen Bass zurück, den eine Stimme wenige Zentimeter vor der Kapsel bekommt.',
  'mic.lowCut.cut': 'Schneidet unter',
  'mic.lowCut.proximity': 'Nah am Mikrofon',
  'mic.lowCut.group.pops': 'Plosive',
  'mic.lowCut.group.popsHint':
    'Dämpft den Stoß eines P oder B und lässt eine gleichmäßige Stimme unberührt.',
  'mic.lowCut.plosive': 'Poppschutz',
  'mic.gate.title': 'Gate',
  'mic.gate.description':
    'Schließt das Mikrofon zwischen den Wörtern, damit Raum, Lüfter und Tastatur draußen bleiben. Mit kleinem Bereich wird es zu einem sanften Expander.',
  'mic.gate.group.level': 'Wann es öffnet',
  'mic.gate.group.levelHint':
    'Achten Sie auf die gestrichelte Linie im Bild: Ihre Stimme sollte sie überschreiten, der Raum darunter bleiben.',
  'mic.gate.threshold': 'Öffnet ab',
  'mic.gate.range': 'Dämpft um',
  'mic.gate.group.time': 'Wie schnell',
  'mic.gate.group.timeHint':
    'Die Haltezeit lässt es zwischen den Silben offen, damit Wortenden nie abgeschnitten werden.',
  'mic.gate.attack': 'Öffnet in',
  'mic.gate.hold': 'Haltezeit',
  'mic.gate.release': 'Schließt in',
};
