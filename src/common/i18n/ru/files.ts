const files = {
  'files.title.sharePreset': 'Поделиться пресетом эквалайзера',
  'files.title.exportDspChain': 'Экспортировать пресет цепочки DSP',
  'files.title.importEq': 'Импортировать настройки эквалайзера',
  'files.title.importImpulse': 'Импортировать импульсную характеристику',
  'files.title.exportChain': 'Экспортировать эту цепочку',
  'files.title.importChain': 'Импортировать цепочку',
  'files.title.exportKaraoke': 'Экспортировать караоке',
  'files.title.saveDownload': 'Сохранить загрузку на компьютер',
  'files.save': 'Сохранить',
  'files.type.eqPreset': 'Пресет эквалайзера FluidEQ',
  'files.type.dspChain': 'Цепочка DSP FluidEQ',
  'files.type.eqSettings': 'Настройки эквалайзера',
  'files.type.impulse': 'Импульсная характеристика WAV',
  'files.type.chain': 'Цепочка FluidEQ',
  'files.type.scene': 'Сцена FluidEQ',
  'files.type.programs': 'Программы',
  'files.type.pictures': 'Изображения',
  'files.type.all': 'Все файлы',
  'files.imported.profile': 'Импортировано полос из профиля FluidEQ: {count}.',
  'files.imported.graphicEq':
    'Импортировано полос из файла GraphicEQ: {count}.',
  'files.imported.parametricEq':
    'Импортировано полос из файла ParametricEQ программы Equalizer APO: {count}.',
  'files.imported.skipped':
    'Пропущено полос с типом фильтра, который FluidEQ не умеет изменять: {count}.',
  'files.imported.squiglink':
    'Импортировано полос из экспорта Squiglink: {count}.',
  'files.imported.squiglinkSkipped':
    'Пропущено полос, которые нельзя изменить в FluidEQ: {count}.',
  'files.imported.preampKept':
    'Его предусиление {gain} дБ сохранено, поэтому автонормализация выключена.',
  'files.impulse.applied': 'Применено: {name}.',
  'files.chain.exported': 'Цепочка для {device} экспортирована.',
  'files.chain.imported': 'Цепочка импортирована.',
  'files.chain.importedFrom': 'Импортирована цепочка с {device}.',
  'files.chain.noOutput': 'Нет активного выхода, поэтому импортировать некуда.',
  'files.chain.notChain': 'Этот файл — не цепочка FluidEQ.',
  'files.squiglink.empty': 'Сначала вставьте экспорт эквалайзера из Squiglink.',
  'files.squiglink.tooLarge':
    'Этот экспорт эквалайзера слишком велик для импорта.',
  'files.squiglink.noFilters':
    'Фильтры Equalizer APO не найдены. Скопируйте экспортированный из Squiglink текст ParametricEQ или GraphicEQ.',
  'files.eq.tooLarge': 'Этот файл слишком велик для настроек эквалайзера.',
  'files.eq.notProfile': 'Этот файл JSON — не профиль FluidEQ.',
  'files.eq.noFilters':
    'В этом файле не найдены фильтры Equalizer APO. Ожидался профиль ParametricEQ, GraphicEQ или FluidEQ.',
  'files.wav.notWav': 'Этот файл — не импульсная характеристика WAV.',
  'files.wav.truncated': 'Этот файл WAV обрезан.',
  'files.wav.unsupported': 'Equalizer APO не поддерживает этот формат WAV.',
  'files.wav.noFormat': 'В этом файле WAV нет блока формата.',
  'files.wav.tooLarge':
    'Эта импульсная характеристика слишком велика для безопасного импорта.',
  'files.wav.rate':
    'Частота этой импульсной характеристики — {rate} Гц. Equalizer APO нужна одна из этих: {rates} Гц.',
  'files.wav.noChunks':
    'В этом файле WAV нет пригодного блока формата или данных.',
  'files.wav.sampleFormat':
    'Формат сэмплов этого WAV нельзя безопасно проанализировать.',
  'files.wav.noSamples': 'В этой импульсной характеристике WAV нет сэмплов.',
  'files.wav.badSamples':
    'В этой импульсной характеристике WAV есть недопустимые сэмплы.',
  'files.wav.silent':
    'У этой импульсной характеристики WAV нет измеримого отклика.',
  'files.apo.notLocated':
    'Equalizer APO не установлен, или его установка не найдена.',
  'files.apo.selectorMissing':
    'Не найден конфигуратор устройств Equalizer APO.',
  'files.apo.editorMissing': 'Настройки Equalizer APO не найдены.',
  'files.wav.tooLong':
    'Эта импульсная характеристика слишком длинная для анализа и безопасной нормализации.',
} as const;

export default files;
