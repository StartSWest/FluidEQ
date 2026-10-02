/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Поделиться аудио',
  'remoteAudio.eyebrow': 'АУДИОСВЯЗЬ ПО LAN',
  'remoteAudio.title': 'Слушайте другие компьютеры здесь',
  'remoteAudio.subtitle':
    'Свяжите два компьютера, и каждый будет воспроизводить звук другого. Каждый отправляет свой звук без изменений; компьютер, на котором вы слушаете, применяет свой EQ, кривые и DSP.',
  'remoteAudio.security': 'Свойства соединения',
  'remoteAudio.badge.local': 'Только частная LAN',
  'remoteAudio.badge.lossless': 'Передача Float32 PCM без потерь',
  'remoteAudio.badge.encrypted': 'Шифрование AES-256-GCM',
  'remoteAudio.link.section': 'Связать компьютер',
  'remoteAudio.link.thisComputer': 'Этот компьютер',
  'remoteAudio.link.thisHint':
    'Вставьте этот код на другом компьютере или вставьте сюда код того компьютера. Подойдёт любой вариант.',
  'remoteAudio.link.or': 'или',
  'remoteAudio.link.otherComputer': 'Код другого компьютера',
  'remoteAudio.link.codeLabel': 'Код подключения',
  'remoteAudio.link.placeholder': 'Вставьте FLUIDEQ-LAN-2…',
  'remoteAudio.link.start': 'Связать',
  'remoteAudio.link.otherHint':
    'Оба компьютера сразу начинают воспроизводить друг друга. Если нужно только одно направление, выключите другое позже.',
  'remoteAudio.link.once':
    'Достаточно одного раза. Связанные компьютеры находят друг друга после перезапуска — с любой стороны.',
  'remoteAudio.rule.echoTitle': 'В обе стороны, без эха',
  'remoteAudio.rule.echo':
    'Каждый компьютер отправляет только то, что воспроизводит сам, — никогда не принимаемый звук, — поэтому ничего не возвращается.',
  'remoteAudio.rule.eqTitle': 'Ваш EQ там, где вы слушаете',
  'remoteAudio.rule.eq':
    'Звук уходит без изменений. Компьютер, на котором вы его слушаете, применяет свой EQ, кривую наушников и DSP — один раз.',
  'remoteAudio.rule.steadyTitle': 'Стабильно, без дрейфа',
  'remoteAudio.rule.steady':
    'Около 30 мс задержки, и она держится: часы двух компьютеров идут в такт, без пропусков и медленного дрейфа.',
  'remoteAudio.linked.section': 'Связаны',
  'remoteAudio.linked.cardLabel': 'Связь с {name}',
  'remoteAudio.linked.bothWays': 'В обе стороны',
  'remoteAudio.linked.incomingOnly': 'Только входящий',
  'remoteAudio.linked.outgoingOnly': 'Только исходящий',
  'remoteAudio.linked.paused': 'Пауза',
  'remoteAudio.linked.looking': 'Поиск {name} в вашей сети…',
  'remoteAudio.linked.lossless': 'Без потерь',
  'remoteAudio.linked.unlink': 'Разорвать связь',
  'remoteAudio.linked.noEcho':
    'Без эха: звук {name} никогда не отправляется обратно.',
  'remoteAudio.linked.untouched':
    'Уходит без изменений в обе стороны — каждый компьютер применяет свой EQ и DSP.',
  'remoteAudio.lane.from': 'От {name}',
  'remoteAudio.lane.to': 'Для {name}',
  'remoteAudio.lane.playsHere': 'Звучит здесь',
  'remoteAudio.lane.yourSound': 'Ваш звук',
  'remoteAudio.lane.playItHere': 'Воспроизводить здесь',
  'remoteAudio.lane.sendMySound': 'Отправлять мой звук',
  'remoteAudio.lane.delay': 'задержка',
  'remoteAudio.lane.sent': 'отправка',
  'remoteAudio.lane.milliseconds': '{milliseconds} мс',
  'remoteAudio.lane.megabits': '{megabits} Мбит/с',
  'remoteAudio.lane.receiving': 'Приём',
  'remoteAudio.lane.paused': 'Пауза',
  'remoteAudio.lane.inQuiet': 'На {name} ничего не играет',
  'remoteAudio.lane.inOff':
    'Выключено: звук {name} не воспроизводится на этом компьютере.',
  'remoteAudio.lane.inNotSent': 'На {name} выключено «Отправлять мой звук».',
  'remoteAudio.lane.inOld':
    '{name} нужна последняя версия FluidEQ, чтобы отправлять сюда свой звук.',
  'remoteAudio.lane.inOneWay':
    'Для воспроизведения в обе стороны на этом компьютере нужна Windows.',
  'remoteAudio.lane.outQuiet': 'На этом компьютере ничего не играет',
  'remoteAudio.lane.outOff':
    'Отправка выключена. {name} не слышит этот компьютер.',
  'remoteAudio.lane.outNotPlayed':
    'На {name} выключено «Воспроизводить здесь».',
  'remoteAudio.lane.outOld':
    '{name} нужна последняя версия FluidEQ, чтобы воспроизводить звук этого компьютера.',
  'remoteAudio.lane.outOneWay':
    'Для отправки в обе стороны на этом компьютере нужна Windows.',
  'remoteAudio.lane.outFailed':
    'Не удалось захватить звук этого компьютера. Выключите и снова включите «Отправлять мой звук», чтобы попробовать ещё раз.',
  'remoteAudio.another.section': 'Связать ещё один компьютер',
  'remoteAudio.another.hub':
    'Вставьте код этого компьютера на другом компьютере. Каждый связанный компьютер получает свою строку выше.',
  'remoteAudio.another.spoke':
    'Чтобы связать третий компьютер, вставьте на нём код {name}: компьютер связывается с тем, чей код использует.',
  'remoteAudio.singlePlayer.title': 'Только один проигрыватель',
  'remoteAudio.singlePlayer.body':
    'распространяется и на связанные компьютеры: запуск чего-то на одном ставит на паузу то, что играло на другом.',
  'remoteAudio.code.copy': 'Копировать код',
  'remoteAudio.code.copied': 'Скопировано',
  'remoteAudio.code.forAddress': 'Код сопряжения для {address}',
  'remoteAudio.status.preparing': 'Подготовка…',
  'remoteAudio.status.playbackBlocked':
    'Нажмите «Возобновить», чтобы услышать звук',
  'remoteAudio.resume': 'Возобновить звук',
  'remoteAudio.retry': 'Повторить',
  'remoteAudio.monitor.networkHealthy': 'Сеть стабильна',
  'remoteAudio.monitor.networkQueued': '{milliseconds} мс в очереди',
  'remoteAudio.note.title': 'Начните с низкой громкости.',
  'remoteAudio.note.body':
    'Два компьютера, играющие одновременно, складываются по громкости. Уменьшите громкость перед первой связью.',
  'remoteAudio.error.lan':
    'FluidEQ не удалось открыть локальное соединение. Убедитесь, что оба компьютера находятся в одной частной сети и брандмауэр разрешает работу FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ не удалось захватить системный звук этого компьютера. Проверьте текущее устройство вывода и попробуйте снова.',
  'remoteAudio.error.playback':
    'FluidEQ не удалось запустить аудиодвижок без потерь. Перезапустите FluidEQ и повторите попытку.',
  'remoteAudio.error.connection':
    'Зашифрованное аудиосоединение прервалось. FluidEQ продолжает искать другой компьютер и переподключится сам, когда тот вернётся.',
};

export default remoteAudio;
