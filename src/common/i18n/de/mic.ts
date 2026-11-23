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
  'mic.live': 'Live in jeder App',
  'mic.notSetUp': 'Auf diesem Mikrofon noch nicht eingerichtet',
  'mic.state.opening': 'Mikrofon wird geöffnet …',
  'mic.state.noInput':
    'Windows zeigt für dieses Mikrofon gerade keinen Eingang',
  'mic.state.blocked':
    'Windows hat FluidEQ dieses Mikrofon nicht öffnen lassen',
  'mic.state.waiting': 'Mikrofon offen · wartet, bis die Engine darauf startet',
  'mic.meter.gateOpen': 'Stimme geht durch',
  'mic.meter.gateClosed': 'Gate geschlossen',
  'mic.meter.compressor': 'Kompressor',
  'mic.meter.limiter': 'Limiter',
  'mic.monitor.label': 'Endergebnis anhören',
  'mic.monitor.hint':
    'Spielt, was andere hören, auf dem Ausgang ab, den Sie gerade hören',
  'mic.monitor.warning':
    'Nutzen Sie Kopfhörer: Über Lautsprecher gelangt Ihre Stimme zurück ins Mikrofon und koppelt.',
  'mic.effectsOff.short':
    'Die Audioverbesserungen von Windows sind für dieses Mikrofon aus',
  'mic.effectsOff.title': 'Audioverbesserungen sind für {mic} aus',
  'mic.effectsOff.body':
    'Solange sie aus sind, lädt Windows auf diesem Mikrofon keinen Effekt, und FluidEQ kann es nicht bearbeiten. Schalten Sie in den Eigenschaften des Mikrofons „Audioverbesserungen“ ein.',
  'mic.effectsOff.button': 'Windows-Soundeinstellungen öffnen',
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
  'mic.stage.cleaner': 'Geräuschunterdrückung',
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
  'mic.monitor.on': 'Endergebnis wird wiedergegeben',
  'mic.delay.label': 'Verzögerung',
  'mic.delay.measured':
    'von der Engine an diesem Mikrofon gemessen, von der Kapsel bis in jede App',
  'mic.delay.unknown': 'die Engine hat dieses Mikrofon noch nicht gemessen',
  'mic.delay.windows': 'Windows',
  'mic.rail.master': 'Mikrofon bearbeiten',
  'mic.rail.note':
    'Jeder Schalter schaltet seine Stufe ganz ab: keine Klangänderung, keine Verzögerung. Die Zahl neben einer Stufe ist die Verzögerung, die sie hinzufügt.',
  'mic.meter.noise': 'Entferntes Rauschen',
  'mic.cleaner.description':
    'Entfernt Tastatur, Lüfter und Raum unter Ihrer Stimme, während Sie sprechen.',
  'mic.cleaner.strength': 'Stärke',
  'mic.cleaner.noiseNow': 'Jetzt entferntes Rauschen',
  'mic.cleaner.noiseHint':
    'Wie weit der Raum nach der Reinigung unter Ihrer Stimme liegt; die blasse Linie ist das Meiste der letzten Sekunden. Über 80 % klingt eine Stimme bearbeitet.',
  'mic.cleaner.neverCuts': 'Schneidet nie ab',
  'mic.cleaner.neverCutsHint':
    'Kommt das Modell einmal zu spät, behält die Stimme den Pegel des letzten gereinigten Moments und wird ohne Klick angeschlossen, nie mit dem rohen Raum. Solche Momente werden hier gezählt.',
  'mic.cleaner.lateMinute': 'verspätete Blöcke in der letzten Minute',
  'mic.gate.live.title': 'Ihre Stimme am Gate',
  'mic.gate.live.hint':
    'Der Balken ist Ihre Stimme jetzt. Unter der Linie senkt das Gate sie ab; es schließt etwas tiefer wieder, damit eine Stimme auf der Linie nicht flattert.',
  'mic.gate.live.open': 'Offen – Ihre Stimme liegt {db} dB über dem Gate.',
  'mic.gate.live.closed':
    'Geschlossen – Ihre Stimme liegt {db} dB unter dem Gate.',
  'mic.gate.live.opens': 'öffnet bei {db} dB',
};
