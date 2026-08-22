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
  'dsp.bypassed': 'Обход',
  'dsp.enabled': 'Включено',

  'dsp.eqPreset.custom': 'Свой',
  'dsp.eqPreset.label': 'Пресет',
  'dsp.eqPreset.default': 'По умолчанию',
  'dsp.eqPreset.reset': 'Сбросить',
  'dsp.eqPreset.flat': 'Ровно',
  'dsp.eqPreset.vShape': 'V-образная',
  'dsp.eqPreset.rock': 'Рок',
  'dsp.eqPreset.pop': 'Поп',
  'dsp.eqPreset.jazz': 'Джаз',
  'dsp.eqPreset.classical': 'Классика',
  'dsp.eqPreset.electronic': 'Электроника',
  'dsp.eqPreset.hiphop': 'Хип-хоп',
  'dsp.eqPreset.acoustic': 'Акустика',
  'dsp.eqPreset.vocal': 'Голос',
  'dsp.eqPreset.podcast': 'Подкаст',
  'dsp.eqPreset.bassBoost': 'Больше баса',
  'dsp.eqPreset.trebleBoost': 'Больше верхов',
  'dsp.eqPreset.loudness': 'Тонкомпенсация',
  'dsp.eqPreset.lateNight': 'Поздний вечер',
  'dsp.eqPreset.smallSpeakers': 'Малые колонки',
  'dsp.eqPreset.car': 'Авто',
  'dsp.eqPreset.gaming': 'Игры',
  'dsp.eqPreset.movie': 'Кино',
  'dsp.eqPreset.warm': 'Тёплый',
  'dsp.eqPreset.air': 'Воздух',

  'dsp.eqPreset.import': 'Импорт',
  'dsp.eqPreset.export': 'Экспорт',
  'dsp.eqPreset.imported': 'Загружено фильтров: {count}.',
  'dsp.eqPreset.importSkipped':
    'Загружено фильтров: {count}, пропущено: {skipped}.',
  'dsp.eqPreset.importEmpty':
    'Этот эквалайзер не смог прочитать ни одного фильтра.',
  'dsp.eqPreset.importFailed': 'Не удалось прочитать этот файл.',
  'dsp.eqPreset.importPreamp':
    'Его запас в {gain} дБ измеряется здесь самостоятельно.',

  'dsp.eq.rack': 'Полосы',
  'dsp.eqModel.label': 'Характер',
  'dsp.eqModel.clean': 'Нет',
  'dsp.eqModel.proportional': 'Узкий',
  'dsp.eqModel.wide': 'Широкий',
  'dsp.eqEngine.label': 'Движок',
  'dsp.eqPhase.label': 'Фаза',
  'dsp.eqPhase.minimum': 'Минимальная',
  'dsp.eqPhase.linear': 'Линейная',
  'dsp.eqPhase.linearLatency': 'Линейная (+{ms} мс)',
  'dsp.eqEngine.serial': 'Последов.',
  'dsp.eqEngine.parallel': 'Параллельн.',
  'dsp.eqStereo.label': 'Действует на',
  'dsp.eqStereo.stereo': 'Стерео',
  'dsp.eqStereo.mid': 'Только центр',
  'dsp.eqStereo.side': 'Только бока',
  'dsp.eqOversample.label': 'Передискр.',
  'dsp.eqOversample.off': 'Выкл',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': 'Импорт кривой эквалайзера',
  'dsp.eqImport.hint':
    'Вставьте кривую из Squiglink, AutoEq или Equalizer APO — либо выберите файл с ней.',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': 'Выбрать файл',
  'dsp.eqImport.apply': 'Импортировать',
  'dsp.eqImport.cancel': 'Отмена',

  'dsp.eq.title': 'Эквалайзер',
  'dsp.eq.description':
    'Пятнадцать параметрических полос, нарисованных так, как фильтры отвечают на самом деле, а не как их просили.',
  'dsp.eq.band': 'Полоса',
  'dsp.eq.bands': 'Полосы',
  'dsp.eq.shape': 'Тип полосы',
  'dsp.eq.bandOff': 'Выкл',
  'dsp.eq.addLeft': 'Добавить полосу ниже этой',
  'dsp.eq.addRight': 'Добавить полосу выше этой',
  'dsp.eq.type.peak': 'Колокол',
  'dsp.eq.type.lowShelf': 'Низкий шельф',
  'dsp.eq.type.highShelf': 'Высокий шельф',
  'dsp.eq.type.notch': 'Режектор',
  'dsp.eq.type.lowPass': 'ФНЧ',
  'dsp.eq.type.highPass': 'ФВЧ',
  'dsp.eq.type.bandPass': 'Полосовой',
  'dsp.eq.frequency': 'Частота',
  'dsp.eq.gain': 'Усиление',
  'dsp.eq.preamp': 'Предус.',
  'dsp.eq.trim': 'Авторегулировка',
  'dsp.eq.trimHint': 'Запас перед полосами, чтобы эта кривая не перегружалась.',
  'dsp.eq.overUnity': 'превышение {gain} дБ',
  'dsp.eq.character': 'Характер',
  'dsp.eq.subsonic': 'Инфраниз.',
  'dsp.eq.fuzz': 'Фузз',
  'dsp.eq.monoBelow': 'Моно ниже',
  'dsp.eq.phase': 'Фаза',
  'dsp.eq.quality': 'Ширина',
  'dsp.eq.threshold': 'Порог',
  'dsp.eq.dynamic': 'Динамика',
  'dsp.eq.dynamicOn': 'Динамика ВКЛ',
  'dsp.eq.dynamicHint':
    'Работает, только пока эта полоса громче своего порога.',

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

  'tabs.dsp': 'DSP',
};

export default dsp;
