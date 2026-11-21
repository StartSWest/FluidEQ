/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': 'Поделиться: {name}',
  'presetShare.menu.community': 'Поделиться с сообществом…',
  'presetShare.menu.copyLink': 'Копировать ссылку',
  'presetShare.menu.export': 'Экспорт…',
  'presetShare.linkCopied': 'Ссылка скопирована',
  'presetShare.linkMaking': 'Создаём ссылку…',
  'presetShare.linkFailed.signedOut': 'Войдите, чтобы создать ссылку',
  'presetShare.linkFailed.suspended': 'Этот аккаунт сейчас не может делиться',
  'presetShare.linkFailed.rateLimited': 'Слишком много ссылок за час',
  'presetShare.linkFailed.tooMany': 'Достигнут лимит ссылок аккаунта',
  'presetShare.linkFailed.takenDown': 'Эта ссылка удалена',
  'presetShare.linkFailed.offline': 'Сервер FluidEQ не ответил',

  'presetShare.text.title': '{name} · пресет FluidEQ',
  'presetShare.text.curve': 'Кривая: полос — {count}',
  'presetShare.text.rack': 'Рэк: {stages}',
  'presetShare.text.open': 'Открыть в FluidEQ',

  'presetShare.chip.curve': 'Кривая · полос: {count}',
  'presetShare.chip.flat': 'Без изменений',

  'presetShare.export.title': 'Экспорт: {name}',
  'presetShare.export.hint':
    'Кривая и все этапы рэка. Ваша нормализация и голова вашей комнаты остаются у вас.',
  'presetShare.export.tab.forum': 'Для любого форума',
  'presetShare.export.tab.file': 'Файл',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit · Discord · GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · другие форумы',
  'presetShare.format.plain': 'Обычный текст',
  'presetShare.format.plainFor': 'Для всего остального',
  'presetShare.export.withLink':
    'Добавить короткую ссылку на его страницу на fluideq.com',
  'presetShare.export.linkSignIn': 'Войдите, чтобы добавить короткую ссылку',
  'presetShare.export.fits':
    'Символов: {count} · помещается в одно сообщение Discord',
  'presetShare.export.long':
    'Символов: {count} · слишком длинно для одного сообщения Discord. Отправьте только короткую ссылку.',
  'presetShare.export.pasteHint':
    'Любой, у кого есть FluidEQ, может вставить это в «Импорт».',
  'presetShare.export.fileHint':
    'Читаемый JSON с кривой и всеми этапами — тот же файл, что сохраняет страница DSP. Перетащите его в «Импорт», чтобы вернуть.',
  'presetShare.export.apoNoCurve':
    'У этого пресета нет кривой: весь его звук — в рэке, а для рэка нужен FluidEQ.',
  'presetShare.export.apoRack':
    'В этом формате переносится только кривая. FluidEQ нужен для этапов: {stages}.',
  'presetShare.export.copy': 'Копировать',
  'presetShare.export.copyCurve': 'Копировать кривую',
  'presetShare.export.save': 'Сохранить файл…',
  'presetShare.export.copied': 'Скопировано',
  'presetShare.export.saved': 'Сохранено',
  'presetShare.export.failed': 'Не получилось. Попробуйте ещё раз.',

  'presetShare.forum.attached': 'Прикреплённый пресет',
  'presetShare.forum.remove': 'Убрать пресет',
  'presetShare.forum.template':
    'Создан для: \nПрослушан на: \nПопробуйте с: \n\nЧто делает: ',

  'presetShare.card.by': 'Автор: @{author}',
  'presetShare.card.sharedBy': 'Автор: {author}',
  'presetShare.card.sharedByMember': 'Поделился участник FluidEQ',
  'presetShare.card.add': 'Добавить в мои пресеты',
  'presetShare.card.added': 'В «Свои» · играет',
  'presetShare.card.try': 'Попробовать',
  'presetShare.card.stopTrying': 'Закончить пробу',
  'presetShare.card.tryingNote':
    'Играет, пока вы не остановите его или не уйдёте из публикации; затем вернётся ваш собственный звук.',

  'presetShare.import.button': 'Импорт',
  'presetShare.import.title': 'Импорт пресета',
  'presetShare.import.hint':
    'Вставьте сообщение с форума, ссылку или файл пресета. Читается только пресет внутри.',
  'presetShare.import.paste': 'Вставить из буфера обмена',
  'presetShare.import.placeholder': 'Вставьте сюда…',
  'presetShare.import.chooseFile': 'Выбрать файл…',
  'presetShare.import.found': 'Найден один пресет',
  'presetShare.import.missing':
    'В этом тексте нет пресета FluidEQ. Вставьте сообщение целиком или ссылку.',
  'presetShare.import.newer':
    'Этот пресет создан в более новой версии FluidEQ. Обновите FluidEQ, чтобы его прочитать.',
  'presetShare.import.damaged':
    'Код пресета обрезан или повреждён. Скопируйте его ещё раз от начала до конца.',
  'presetShare.import.clipboardFailed':
    'FluidEQ не смог прочитать буфер обмена. Вставьте текст в поле вручную.',
  'presetShare.import.gone':
    'Этим пресетом больше не делятся. Попросите его код.',
  'presetShare.import.offline':
    'FluidEQ не смог связаться со своим сервером, чтобы открыть эту ссылку. Проверьте подключение и попробуйте ещё раз.',

  'presetShare.link.title': 'Добавить этот пресет?',
  'presetShare.link.hint':
    'Из ссылки, которую вы открыли. Ничего не заиграет и не сохранится, пока вы не нажмёте.',
  'presetShare.link.notNow': 'Не сейчас',
  'presetShare.link.fetching': 'Получаем пресет из FluidEQ…',
} as const;
