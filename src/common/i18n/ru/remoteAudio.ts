/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Поделиться аудио',
  'remoteAudio.eyebrow': 'АУДИОСВЯЗЬ ПО LAN',
  'remoteAudio.title': 'Слушайте другие компьютеры здесь',
  'remoteAudio.subtitle':
    'Выберите одну роль для этого компьютера. Приёмник — это ПК с гарнитурой; остальные ПК могут подключаться как источники.',
  'remoteAudio.choose': 'Выберите роль этого компьютера',
  'remoteAudio.security': 'Свойства соединения',
  'remoteAudio.badge.local': 'Только частная LAN',
  'remoteAudio.badge.lossless': 'Передача Float32 PCM без потерь',
  'remoteAudio.badge.encrypted': 'Шифрование AES-256-GCM',
  'remoteAudio.listen.kicker': 'ПРИЁМНИК · СЕРВЕР',
  'remoteAudio.listen.title': 'Воспроизводить звук на этом компьютере',
  'remoteAudio.listen.body':
    'Используйте эту роль на компьютере с гарнитурой или колонками. Он принимает один или несколько источников и воспроизводит их через выход, выбранный в FluidEQ.',
  'remoteAudio.listen.start': 'Создать код подключения',
  'remoteAudio.listen.activeTitle': 'Этот компьютер принимает звук',
  'remoteAudio.listen.newCode': 'Создать новый код',
  'remoteAudio.listen.stop': 'Остановить приём',
  'remoteAudio.stream.title': 'Приоритет потока',
  'remoteAudio.stream.lossless': 'Оба режима передают PCM без потерь',
  'remoteAudio.stream.video.title': 'Видео',
  'remoteAudio.stream.video.body':
    'Минимальная задержка для синхронизации губ. Чувствительнее к загруженному Wi-Fi.',
  'remoteAudio.stream.video.buffer': 'Старт ~30 мс',
  'remoteAudio.stream.music.title': 'Музыка',
  'remoteAudio.stream.music.body':
    'Больший запас буфера для непрерывного прослушивания.',
  'remoteAudio.stream.music.buffer': 'Старт ~240 мс',
  'remoteAudio.send.kicker': 'ИСТОЧНИК · КЛИЕНТ',
  'remoteAudio.send.title': 'Передавать звук этого компьютера',
  'remoteAudio.send.body':
    'Сделайте это на каждом компьютере, который хотите слышать. Вставьте код с компьютера с гарнитурой.',
  'remoteAudio.send.codeLabel': 'Код подключения',
  'remoteAudio.send.codePlaceholder': 'Вставьте FLUIDEQ-LAN-2…',
  'remoteAudio.send.start': 'Подключить и передавать',
  'remoteAudio.send.activeTitle': 'Передаётся системный звук',
  'remoteAudio.send.activeBody':
    'Оставьте FluidEQ открытым на обоих компьютерах. Приёмник воспроизводит этот поток без потерь вместе со всеми другими подключёнными источниками.',
  'remoteAudio.send.destination': 'Воспроизведение на {name}',
  'remoteAudio.send.stop': 'Остановить передачу',
  'remoteAudio.send.readyHint':
    'Сохранённый код остаётся здесь после остановки.',
  'remoteAudio.status.preparing': 'Подготовка…',
  'remoteAudio.status.waiting': 'Ожидание компьютеров',
  'remoteAudio.status.connecting': 'Подключение…',
  'remoteAudio.status.connectedOne': 'Подключён {count} компьютер',
  'remoteAudio.status.connectedMany': 'Подключено компьютеров: {count}',
  'remoteAudio.status.sending': 'Передаётся звук без потерь',
  'remoteAudio.status.playbackBlocked':
    'Нажмите «Возобновить», чтобы услышать звук',
  'remoteAudio.status.disconnected': 'Приёмник отключился',
  'remoteAudio.monitor.title': 'Связь в реальном времени',
  'remoteAudio.monitor.inactive': 'Выберите роль, чтобы начать',
  'remoteAudio.monitor.ready': 'Готов к коду подключения',
  'remoteAudio.monitor.waveform': 'График передаваемого звука',
  'remoteAudio.monitor.waveformFor': 'График звука от {name}',
  'remoteAudio.monitor.buffer': 'Воспроизведение {milliseconds} мс',
  'remoteAudio.monitor.sendQueue': 'Очередь отправки {milliseconds} мс',
  'remoteAudio.monitor.noRole': 'Роль не выбрана',
  'remoteAudio.monitor.noSources': 'Нет подключённых компьютеров-источников',
  'remoteAudio.monitor.waitingSource': 'Ожидание источника',
  'remoteAudio.monitor.outgoing': 'Звук с этого компьютера',
  'remoteAudio.monitor.transmitting': 'Передача',
  'remoteAudio.monitor.quiet': 'Тишина',
  'remoteAudio.monitor.peakLevel': 'Пиковый уровень звука',
  'remoteAudio.monitor.peak': 'Пик {decibels} dB',
  'remoteAudio.monitor.networkUsage': 'LAN {megabits} Мбит/с',
  'remoteAudio.monitor.networkHealthy': 'Сеть стабильна',
  'remoteAudio.monitor.networkQueued': '{milliseconds} мс в очереди',
  'remoteAudio.code.title': 'Подключить другие компьютеры',
  'remoteAudio.code.hint':
    'Скопируйте код на каждый источник. Сопряжение сохраняется после закрытия приложения и перезапуска ПК. Если показано несколько адресов, выберите общую для компьютеров сеть.',
  'remoteAudio.code.copy': 'Копировать код',
  'remoteAudio.code.copied': 'Скопировано',
  'remoteAudio.code.forAddress': 'Код сопряжения для {address}',
  'remoteAudio.resume': 'Возобновить звук',
  'remoteAudio.note.title': 'Начните с низкой громкости.',
  'remoteAudio.note.body':
    'Звук нескольких компьютеров смешивается, поэтому громкость может быстро сложиться. Уменьшите громкость гарнитуры до первого подключения. Сохранённые сопряжения разрываются только при создании нового кода.',
  'remoteAudio.error.lan':
    'FluidEQ не удалось открыть локальное соединение. Убедитесь, что оба компьютера находятся в одной частной сети и брандмауэр разрешает работу FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ не удалось захватить системный звук этого компьютера. Проверьте текущее устройство вывода, остановите сеанс и повторите попытку.',
  'remoteAudio.error.playback':
    'FluidEQ не удалось запустить аудиодвижок без потерь. Перезапустите FluidEQ и повторите попытку.',
  'remoteAudio.error.connection':
    'Зашифрованное аудиосоединение остановлено. Сохранённый код остаётся ниже; подключитесь снова, когда приёмник будет готов.',
};

export default remoteAudio;
