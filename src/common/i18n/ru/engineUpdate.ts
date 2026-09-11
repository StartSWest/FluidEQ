const engineUpdate = {
  'engineUpdate.badge': 'ОБНОВЛЕНИЕ ДВИЖКА',
  'engineUpdate.title': 'Новый движок FluidEQ готов',
  'engineUpdate.body':
    'В этой версии FluidEQ есть обновлённый звуковой движок. Для установки понадобится разрешение Windows, а звук перезапустится на несколько секунд.',
  'engineUpdate.action': 'Обновить движок',
  'engineUpdate.running': 'Движок обновляется…',
  'engineUpdate.doneBadge': 'АКТУАЛЕН',
  'engineUpdate.doneTitle': 'Движок FluidEQ обновлён',
  'engineUpdate.doneBody':
    'Служба звука Windows перезапущена с новым движком, выходы и эквалайзер остались как были. Откройте заново приложения, которые ещё молчат.',
  'engineUpdate.declined':
    'Разрешение Windows отклонено, поэтому ваш эквалайзер по-прежнему работает на прежнем движке.',
  'engineUpdate.failed':
    'Не удалось обновить движок, поэтому ваш эквалайзер по-прежнему работает на прежнем.',
} as const;

export default engineUpdate;
