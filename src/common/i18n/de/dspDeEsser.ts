/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': 'De-Esser',
  'dsp.deEsser.description':
    'Senkt die scharfen S-, T- und Sch-Laute einer Stimme nur, während sie klingen, und lässt Becken und die übrigen Höhen in Ruhe.',
  'dsp.deEsser.isolate': 'Isolieren',
  'dsp.deEsser.isolateHint': 'Nur hören, was der De-Esser wegnimmt.',
  'dsp.deEsser.isolateOn':
    'Es spielt nur, was der De-Esser wegnimmt. Hören Sie darin Becken, nimmt er zu viel.',

  'dsp.deEsser.group.find': 'Finden',
  'dsp.deEsser.group.findHint':
    'Die Empfindlichkeit wird am Pegel des Songs selbst gemessen, ein leiser und ein lauter Titel werden also gleich behandelt.',
  'dsp.deEsser.group.reduce': 'Absenken',
  'dsp.deEsser.group.timing': 'Timing',
  'dsp.deEsser.group.timingHint':
    'Anfang erfassen reagiert kurz vor jedem S, damit seine erste Flanke nicht verloren geht. Loslassen bestimmt, wie schnell die Höhen danach zurückkommen.',
  'dsp.deEsser.group.where': 'Wo',

  'dsp.deEsser.sensitivity': 'Empfindlichkeit',
  'dsp.deEsser.lowHz': 'Von',
  'dsp.deEsser.highHz': 'Bis',
  'dsp.deEsser.rangeDb': 'Bis zu',
  'dsp.deEsser.widthOct': 'Breite',
  'dsp.deEsser.attackMs': 'Anfang erfassen',
  'dsp.deEsser.releaseMs': 'Loslassen',
  'dsp.deEsser.keepCymbals': 'Becken schonen',

  'dsp.deEsser.mode.label': 'Wie abgesenkt wird',
  'dsp.deEsser.mode.spectral': 'Spektral',
  'dsp.deEsser.mode.treble': 'Höhen',
  'dsp.deEsser.mode.whole': 'Ganze Stimme',
  'dsp.deEsser.mode.spectralHint':
    'Senkt nur die Frequenzen, aus denen das S besteht, und folgt ihm, wenn es wandert.',
  'dsp.deEsser.mode.trebleHint':
    'Senkt alles oberhalb des S, wie die meisten De-Esser. Fester, etwas dumpfer.',
  'dsp.deEsser.mode.wholeHint':
    'Senkt bei jedem S den ganzen Klang, alles darunter eingeschlossen, und kann daher pumpen. Nur für eine allein aufgenommene Stimme.',

  'dsp.deEsser.where.label': 'Welcher Teil des Stereobilds',
  'dsp.deEsser.where.centre': 'Mitte',
  'dsp.deEsser.where.all': 'Alles',
  'dsp.deEsser.where.centreHint':
    'Stimmen stehen in der Mitte und Hi-Hats meist seitlich, deshalb hört und senkt er in der Mitte.',
  'dsp.deEsser.where.allHint':
    'Hört auf das ganze Stereobild. Für Mono-Aufnahmen, Sprache und Live-Aufnahmen.',

  'dsp.deEsser.graph.s': 'S bei',
  'dsp.deEsser.graph.cut': 'Absenkung',
  'dsp.deEsser.graph.isolate': 'Nur das Weggenommene',
  'dsp.deEsser.graph.spared': 'Becken durchgelassen',
  'dsp.deEsser.graph.now': 'jetzt',
  'dsp.deEsser.graph.voice': 'Stimme',
  'dsp.deEsser.graph.notVoice': 'Keine Stimme',
  'dsp.deEsser.graph.threshold': 'Wo es beginnt',
  'dsp.deEsser.engineOld':
    'Die hier installierte FluidEQ Engine ist älter als der De-Esser, daher ist diese Stufe noch nicht zu hören. Der Rest des Racks klingt wie bisher.',
  'dsp.deEsser.upTo': 'bis zu {db}',
  'dsp.deEsser.lens.trebleNow': 'Höhen jetzt',
  'dsp.deEsser.lens.underVoice': '{db} unter der Stimme',
  'dsp.deEsser.lens.ahead': '{ms} im Voraus gehört',
  'dsp.deEsser.lens.cymbalNeeds': 'ein Becken braucht {db} mehr',
  'dsp.deEsser.lens.cymbal': 'Becken',
  'dsp.deEsser.lens.s': 'S',
  'dsp.deEsser.lens.left': 'L',
  'dsp.deEsser.lens.right': 'R',

  'dsp.deEsserPresetGroup.music': 'Musik',
  'dsp.deEsserPresetGroup.speech': 'Sprache',
  'dsp.deEsserPreset.gentle': 'Sanft',
  'dsp.deEsserPreset.vocalMusic': 'Musik mit Gesang',
  'dsp.deEsserPreset.brightHeadphones': 'Helle Kopfhörer',
  'dsp.deEsserPreset.harshStreams': 'Raue Streams',
  'dsp.deEsserPreset.live': 'Live-Aufnahmen',
  'dsp.deEsserPreset.podcast': 'Podcast & Sprache',
} as const;
