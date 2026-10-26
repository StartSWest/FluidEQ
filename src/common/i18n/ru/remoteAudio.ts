/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'remoteAudio.group.add': 'Добавить компьютер',
  'remoteAudio.group.title': 'Вся группа',
  'remoteAudio.group.mix': 'Ваш микс',
  'remoteAudio.group.thisPC': 'Этот ПК',
  'remoteAudio.group.receive': 'Принимать',
  'remoteAudio.group.send': 'Отправлять',
  'remoteAudio.group.share': 'Делиться',
  'remoteAudio.group.options': 'Параметры {name}',
  'remoteAudio.group.count': 'Компьютеров: {count}',
  'remoteAudio.group.sourceOff': 'Передача выключена',
  'remoteAudio.group.offline': 'Не в сети',
  'remoteAudio.group.unavailable': 'Системная громкость недоступна',
  'remoteAudio.group.mute': 'Выключить звук этого ПК',
  'remoteAudio.group.unmute': 'Включить звук этого ПК',
  'remoteAudio.group.output': 'Выход',
  'remoteAudio.group.hint':
    'Подключите компьютер, чтобы присоединиться к его группе. Каждый компьютер отправляет свой звук напрямую остальным. Настройте то, что слышите, в своём миксе.',
  'tabs.share': 'Поделиться аудио',
  'remoteAudio.eyebrow': 'АУДИОСВЯЗЬ ПО LAN',
  'remoteAudio.title': 'Слушайте другие компьютеры здесь',
  'remoteAudio.security': 'Свойства соединения',
  'remoteAudio.badge.local': 'Только частная LAN',
  'remoteAudio.badge.lossless': 'Передача Float32 PCM без потерь',
  'remoteAudio.badge.encrypted': 'Шифрование AES-256-GCM',
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
  'remoteAudio.link.many':
    'Один и тот же код связывает любое число компьютеров, а разрыв связи с одним не затрагивает остальные.',
  'remoteAudio.rule.echoTitle': 'В обе стороны, без эха',
  'remoteAudio.rule.echo':
    'Каждый компьютер отправляет только то, что воспроизводит сам, — никогда не принимаемый звук, — поэтому ничего не возвращается.',
  'remoteAudio.rule.eqTitle': 'Ваш EQ там, где вы слушаете',
  'remoteAudio.rule.eq':
    'Звук уходит без изменений. Компьютер, на котором вы его слушаете, применяет свой EQ, кривую наушников и DSP — один раз.',
  'remoteAudio.rule.steadyTitle': 'Стабильно, без дрейфа',
  'remoteAudio.rule.steady':
    'Около 30 мс задержки, и она держится: часы двух компьютеров идут в такт, без пропусков и медленного дрейфа.',
  'remoteAudio.linked.cardLabel': 'Связь с {name}',
  'remoteAudio.linked.bothWays': 'В обе стороны',
  'remoteAudio.linked.incomingOnly': 'Только входящий',
  'remoteAudio.linked.outgoingOnly': 'Только исходящий',
  'remoteAudio.linked.paused': 'Пауза',
  'remoteAudio.linked.lossless': 'Без потерь',
  'remoteAudio.linked.unlink': 'Разорвать связь',
  'remoteAudio.linked.pause': 'Пауза',
  'remoteAudio.linked.resume': 'Продолжить',
  'remoteAudio.lane.inPaused':
    'Пауза. Здесь ничего не звучит, пока вы не продолжите.',
  'remoteAudio.lane.outPaused':
    'Пауза. Ничего не отправляется, пока вы не продолжите.',
  'remoteAudio.lane.volume': 'Громкость звука {name}',
  'remoteAudio.lane.pausedThere': 'Связь поставлена на паузу на {name}.',
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
  'remoteAudio.lane.received': 'приём',
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
    'Воспроизведение в обе стороны требует Windows или FluidEQ Engine в Linux.',
  'remoteAudio.lane.outQuiet': 'На этом компьютере ничего не играет',
  'remoteAudio.lane.outOff':
    'Отправка выключена. {name} не слышит этот компьютер.',
  'remoteAudio.lane.outNotPlayed':
    'На {name} выключено «Воспроизводить здесь».',
  'remoteAudio.lane.outOld':
    '{name} нужна последняя версия FluidEQ, чтобы воспроизводить звук этого компьютера.',
  'remoteAudio.lane.outOneWay':
    'Отправка в обе стороны требует Windows или FluidEQ Engine в Linux.',
  'remoteAudio.lane.outFailed':
    'Не удалось захватить звук этого компьютера. Выключите и снова включите «Отправлять мой звук», чтобы попробовать ещё раз.',
  'remoteAudio.singlePlayer.title': 'Только один проигрыватель',
  'remoteAudio.singlePlayer.body':
    'распространяется и на связанные компьютеры: запуск чего-то на одном ставит на паузу то, что играло на другом.',
  'remoteAudio.code.copy': 'Копировать код',
  'remoteAudio.code.copied': 'Скопировано',
  'remoteAudio.code.label': 'Код этого компьютера',
  'remoteAudio.status.preparing': 'Подготовка…',
  'remoteAudio.status.noNetwork':
    'Подключите этот компьютер к сети, чтобы получить его код.',
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
  'remoteAudio.error.code':
    'Это не код FluidEQ или код этого же компьютера. Скопируйте код со страницы «Поделиться аудио» на другом компьютере.',
  'remoteAudio.error.capture':
    'FluidEQ не удалось захватить системный звук этого компьютера. Проверьте текущее устройство вывода и попробуйте снова.',
  'remoteAudio.error.playback':
    'FluidEQ не удалось запустить аудиодвижок без потерь. Перезапустите FluidEQ и повторите попытку.',
  'remoteAudio.error.connection':
    'Зашифрованное аудиосоединение прервалось. FluidEQ продолжает искать другой компьютер и переподключится сам, когда тот вернётся.',
};

export default remoteAudio;
