/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Общий звук',
  'remoteAudio.eyebrow': 'АУДИОСВЯЗЬ ПО LAN',
  'remoteAudio.title': 'Слушайте другие компьютеры здесь',
  'remoteAudio.subtitle':
    'Сделайте компьютер с гарнитурой принимающим. Любое число компьютеров с FluidEQ в той же локальной сети сможет подключиться и передавать сюда системный звук.',
  'remoteAudio.security': 'Свойства соединения',
  'remoteAudio.badge.local': 'Только локальная сеть',
  'remoteAudio.badge.lossless': 'PCM 32 бита без потерь',
  'remoteAudio.badge.encrypted': 'Шифрование AES-256',
  'remoteAudio.listen.kicker': 'КОМПЬЮТЕР B · ГАРНИТУРА',
  'remoteAudio.listen.title': 'Воспроизводить звук на этом компьютере',
  'remoteAudio.listen.body':
    'Выберите подключённую здесь гарнитуру или колонки и передайте код сопряжения каждому компьютеру, который хотите слышать.',
  'remoteAudio.listen.start': 'Начать приём',
  'remoteAudio.listen.activeTitle': 'Этот компьютер принимает звук',
  'remoteAudio.listen.stop': 'Остановить приём',
  'remoteAudio.send.kicker': 'КОМПЬЮТЕР A · ИСТОЧНИК',
  'remoteAudio.send.title': 'Передавать звук этого компьютера',
  'remoteAudio.send.body':
    'Вставьте код с компьютера с гарнитурой. FluidEQ передаёт системный звук без сжатия.',
  'remoteAudio.send.codeLabel': 'Код с компьютера с гарнитурой',
  'remoteAudio.send.codePlaceholder': 'Вставьте FLUIDEQ-LAN-1…',
  'remoteAudio.send.start': 'Начать передачу',
  'remoteAudio.send.activeTitle': 'Передаётся системный звук',
  'remoteAudio.send.activeBody':
    'Оставьте FluidEQ открытым на обоих компьютерах. Приёмник воспроизводит этот поток без потерь вместе со всеми другими подключёнными источниками.',
  'remoteAudio.send.stop': 'Остановить передачу',
  'remoteAudio.output.label': 'Воспроизводить через',
  'remoteAudio.output.default': 'Аудиовыход по умолчанию',
  'remoteAudio.output.unnamed': 'Аудиовыход {number}',
  'remoteAudio.status.preparing': 'Подготовка…',
  'remoteAudio.status.waiting': 'Ожидание компьютеров',
  'remoteAudio.status.connecting': 'Подключение…',
  'remoteAudio.status.connectedOne': 'Подключён {count} компьютер',
  'remoteAudio.status.connectedMany': 'Подключено компьютеров: {count}',
  'remoteAudio.status.sending': 'Передаётся звук без потерь',
  'remoteAudio.status.playbackBlocked':
    'Нажмите «Возобновить», чтобы услышать звук',
  'remoteAudio.status.disconnected': 'Приёмник отключился',
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
  'remoteAudio.error.connection':
    'Зашифрованное аудиосоединение остановлено. Завершите этот сеанс и подключитесь заново с актуальным кодом.',
};

export default remoteAudio;
