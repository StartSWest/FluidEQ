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
    'Действует на музыку, которая играет внутри FluidEQ. Spotify, YouTube и другие приложения не затрагиваются.',
  'dsp.idle':
    'Запускается, когда вы включаете что-то из Библиотеки. Обрабатывается собственный проигрыватель FluidEQ, поэтому до загрузки трека работать не над чем.',
  'dsp.unavailable':
    'Не удалось запустить обработку звука. На воспроизведение это не влияет.',
  'dsp.presets': 'Пресеты',
  'dsp.preset.flat': 'Выключено',
  'dsp.preset.lossyRepair': 'Восстановить сжатое',
  'dsp.preset.loud': 'Громко',
  'dsp.enabled': 'Включено',

  'dsp.eq.title': 'Эквалайзер',
  'dsp.eq.description':
    'Шесть параметрических полос, нарисованных так, как фильтры отвечают на самом деле, а не как их просили.',
  'dsp.eq.shape': 'Тип полосы',
  'dsp.eq.bandOff': 'Выкл',
  'dsp.eq.frequency': 'Частота',
  'dsp.eq.gain': 'Усиление',
  'dsp.eq.quality': 'Ширина',

  'dsp.exciter.title': 'Эксайтер',
  'dsp.exciter.description':
    'Создаёт высокие гармоники, отброшенные кодеком с потерями. Он их придумывает, а не восстанавливает.',
  'dsp.exciter.crossover': 'Выше',
  'dsp.exciter.drive': 'Интенсивность',
  'dsp.exciter.mix': 'Количество',

  'dsp.compressor.title': 'Многополосный компрессор',
  'dsp.compressor.description':
    'Выравнивает уровень в трёх частотных полосах независимо.',
  'dsp.compressor.band.low': 'Низкие',
  'dsp.compressor.band.mid': 'Средние',
  'dsp.compressor.band.high': 'Высокие',
  'dsp.compressor.crossoverLow': 'Раздел низких / средних',
  'dsp.compressor.crossoverHigh': 'Раздел средних / высоких',
  'dsp.compressor.threshold': 'Порог',
  'dsp.compressor.ratio': 'Соотношение',
  'dsp.compressor.attack': 'Атака',
  'dsp.compressor.release': 'Восстановление',
  'dsp.compressor.makeup': 'Компенсация',

  'dsp.maximizer.title': 'Максимайзер',
  'dsp.maximizer.description':
    'Поднимает общий уровень, не давая пикам выйти за потолок.',
  'dsp.maximizer.ceiling': 'Потолок',
  'dsp.maximizer.lookAhead': 'Упреждение',
  'dsp.maximizer.release': 'Восстановление',
  'dsp.maximizer.headroomHint':
    'Потолок оставляет запас под {gain} дБ, которые ваш профиль вывода добавляет после этого.',

  'tabs.dsp': 'DSP',
};

export default dsp;
