/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const dsp = {
  'dsp.title': 'DSP',
  'dsp.scopeNotice':
    'Gilt für Musik, die in FluidEQ abgespielt wird. Spotify, YouTube und andere Apps bleiben unverändert.',
  'dsp.idle':
    'Startet, sobald du etwas aus der Bibliothek abspielst. Es verarbeitet FluidEQs eigenen Player und hat daher nichts zu tun, bis ein Titel geladen ist.',
  'dsp.unavailable':
    'Die Audioverarbeitung konnte nicht gestartet werden. Die Wiedergabe ist davon nicht betroffen.',
  'dsp.presets': 'Voreinstellungen',
  'dsp.preset.flat': 'Aus',
  'dsp.preset.lossyRepair': 'Komprimiertes reparieren',
  'dsp.preset.loud': 'Laut',
  'dsp.enabled': 'Ein',

  'dsp.exciter.title': 'Exciter',
  'dsp.exciter.description':
    'Erzeugt hohe Obertöne, die ein verlustbehafteter Encoder verworfen hat. Er erfindet sie, er stellt sie nicht wieder her.',
  'dsp.exciter.crossover': 'Oberhalb von',
  'dsp.exciter.drive': 'Intensität',
  'dsp.exciter.mix': 'Anteil',

  'dsp.compressor.title': 'Multiband-Kompressor',
  'dsp.compressor.description':
    'Gleicht den Pegel in drei Frequenzbändern unabhängig voneinander aus.',
  'dsp.compressor.band.low': 'Tiefen',
  'dsp.compressor.band.mid': 'Mitten',
  'dsp.compressor.band.high': 'Höhen',
  'dsp.compressor.crossoverLow': 'Trennung Tiefen / Mitten',
  'dsp.compressor.crossoverHigh': 'Trennung Mitten / Höhen',
  'dsp.compressor.threshold': 'Schwelle',
  'dsp.compressor.ratio': 'Verhältnis',
  'dsp.compressor.attack': 'Attack',
  'dsp.compressor.release': 'Release',
  'dsp.compressor.makeup': 'Ausgleich',

  'dsp.maximizer.title': 'Maximizer',
  'dsp.maximizer.description':
    'Hebt den Gesamtpegel an, ohne Spitzen über die Obergrenze zu lassen.',
  'dsp.maximizer.ceiling': 'Obergrenze',
  'dsp.maximizer.lookAhead': 'Vorausschau',
  'dsp.maximizer.release': 'Release',
  'dsp.maximizer.headroomHint':
    'Die Obergrenze lässt Platz für die {gain} dB, die dein Ausgabeprofil danach hinzufügt.',

  'tabs.dsp': 'DSP',
};

export default dsp;
