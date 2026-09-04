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
  'remoteAudio.badge.local': 'Только локальная сеть',
  'remoteAudio.badge.lossless': 'PCM 32 бита без потерь',
  'remoteAudio.badge.encrypted': 'Шифрование AES-256',
  'remoteAudio.listen.kicker': 'ПРИЁМНИК · СЕРВЕР',
  'remoteAudio.listen.title': 'Воспроизводить звук на этом компьютере',
  'remoteAudio.listen.body':
    'Используйте эту роль на компьютере с гарнитурой или колонками. Он принимает один или несколько источников и воспроизводит их через выход, выбранный в FluidEQ.',
  'remoteAudio.listen.start': 'Создать код подключения',
  'remoteAudio.listen.activeTitle': 'Этот компьютер принимает звук',
  'remoteAudio.listen.stop': 'Остановить приём',
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
  'remoteAudio.monitor.buffer': 'Буфер {milliseconds} мс',
  'remoteAudio.monitor.noRole': 'Роль не выбрана',
  'remoteAudio.monitor.noSources': 'Нет подключённых компьютеров-источников',
  'remoteAudio.monitor.waitingSource': 'Ожидание источника',
  'remoteAudio.monitor.outgoing': 'Звук с этого компьютера',
  'remoteAudio.monitor.transmitting': 'Передача',
  'remoteAudio.monitor.quiet': 'Тишина',
  'remoteAudio.code.title': 'Подключить другие компьютеры',
  'remoteAudio.code.hint':
    'Скопируйте код на каждый источник. Один код подключает несколько компьютеров, пока приёмник включён. Если показано несколько адресов, выберите общую для обоих компьютеров сеть.',
  'remoteAudio.code.copy': 'Копировать код',
  'remoteAudio.code.copied': 'Скопировано',
  'remoteAudio.code.forAddress': 'Код сопряжения для {address}',
  'remoteAudio.resume': 'Возобновить звук',
  'remoteAudio.note.title': 'Начните с низкой громкости.',
  'remoteAudio.note.body':
    'Звук нескольких компьютеров смешивается, поэтому громкость может быстро сложиться. Уменьшите громкость гарнитуры до первого подключения. Остановка приёмника сразу делает его код недействительным.',
  'remoteAudio.error.lan':
    'FluidEQ не удалось открыть локальное соединение. Убедитесь, что оба компьютера находятся в одной частной сети и брандмауэр разрешает работу FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ не удалось захватить системный звук этого компьютера. Проверьте текущее устройство вывода, остановите сеанс и повторите попытку.',
  'remoteAudio.error.playback':
    'FluidEQ не удалось запустить аудиодвижок без потерь. Перезапустите FluidEQ и повторите попытку.',
  'remoteAudio.error.connection':
    'Зашифрованное аудиосоединение остановлено. Завершите этот сеанс и подключитесь заново с актуальным кодом.',
};

export default remoteAudio;
