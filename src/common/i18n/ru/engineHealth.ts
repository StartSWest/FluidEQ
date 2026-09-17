const engineHealth = {
  'engineHealth.offTitle': 'Движок FluidEQ не работает на {device}',
  'engineHealth.offBody':
    'На этом выходе звук идёт без вашего эквалайзера. Перезапуск звука Windows обычно возвращает движок, а всё остальное в FluidEQ тем временем продолжает работать.',
  'engineHealth.neverRanTitle': 'Windows ни разу не запускал движок FluidEQ',
  'engineHealth.neverRanBody':
    'Движок установлен и включён на {device}, но Windows ни разу не загрузил его там — перезапуск звука его не вернёт. FluidEQ уже исправил всё, до чего может дотянуться; если ничего не изменилось, ему мешает ваша защитная программа или драйвер звуковой карты. Тем временем звук обрабатывает Equalizer APO.',
  'engineHealth.bypassedTitle': 'Звук на «{device}» идёт мимо FluidEQ',
  'engineHealth.bypassedBody':
    'Движок установлен и включён для этого выхода, а Windows проигрывает музыку мимо него — до него не дошло ни звука. У выхода есть несколько мест для эффекта, и для каждого вида воспроизведения Windows выбирает своё; FluidEQ стоит в том, через которое эта музыка не идёт. Перенос в другое место потребует разрешения Windows и секунды тишины.',
  'engineHealth.tryAnotherSlot': 'Попробовать другое место',
  'engineHealth.partlyOff': 'ЧАСТИЧНО ВЫКЛ.',
  'engineHealth.problemsTitle': 'Часть вашего звука не доходит до {device}',
  'engineHealth.problem.convolution':
    'Свёртка выключена: движок не смог загрузить импульсную характеристику. Попробуйте другой файл.',
  'engineHealth.problem.eq-phase':
    'Не удалось запустить линейно-фазовый EQ; исходные фильтры остаются активными.',
  'engineHealth.problem.graphic-eq':
    'Графический эквалайзер выключен: движок не смог построить его кривую.',
  'engineHealth.problem.dsp-rack':
    'Эффекты DSP выключены: движок не смог их запустить.',
  'engineHealth.problem.reload-failed':
    'Ваше последнее изменение не загрузилось, поэтому по-прежнему звучит предыдущее.',
  'engineHealth.problem.unwatched':
    'Движок не видит изменений, которые вы вносите для этого выхода.',
  'engineHealth.problem.other':
    'Что-то ещё, что должен был выполнять движок, не работает.',
  'engineHealth.engineIsOld':
    'Установленный на этом ПК движок FluidEQ — не тот, который несёт эта версия FluidEQ.',
  'engineHealth.rackNeedsEngine':
    'Эффекты DSP работают внутри самого движка, поэтому перезапуск звука Windows заново запускает тот же движок. Помогает установка собственного движка FluidEQ — одно разрешение Windows и секунда тишины.',
  'engineHealth.useApo': 'Использовать Equalizer APO…',
} as const;

export default engineHealth;
