const troubleshoot = {
  'troubleshoot.title': 'Resolver problemas de áudio',
  'troubleshoot.description':
    'Siga a lista de cima para baixo e pare no primeiro passo que resolver. Cada um é mais invasivo que o anterior, e o primeiro resolve a maioria dos problemas.',
  'troubleshoot.footer':
    'Ainda com problema depois de tudo isso? Use **{report}** no mesmo menu: ele reúne os registros, remove tudo o que possa identificar você e mostra tudo antes de enviar.',
  'troubleshoot.tried': 'Tentado',
  'troubleshoot.restart.title': 'Reiniciar o áudio do Windows',
  'troubleshoot.restart.when':
    'O som parou, ou o gráfico ficou reto enquanto algo toca. É a solução em quase todos os casos e a primeira a tentar.',
  'troubleshoot.restart.cost':
    'Alguns segundos de silêncio. O Windows pede permissão.',
  'troubleshoot.apo.reselect.title':
    'Selecione de novo seus dispositivos no Equalizer APO',
  'troubleshoot.apo.reselect.when':
    'Um dispositivo é equalizado e outro não, ou um headset que você acabou de conectar está sendo ignorado. O Equalizer APO se liga a cada saída separadamente, e um dispositivo novo só fica ligado depois que você o marca.',
  'troubleshoot.apo.reselect.cost':
    'Abre o Device Selector do Equalizer APO. Depois é preciso reiniciar.',
  'troubleshoot.apo.openSelector': 'Abrir o Device Selector',
  'troubleshoot.apo.mode.title': 'Tente o outro modo de instalação',
  'troubleshoot.apo.mode.when':
    'Um dispositivo está marcado no Device Selector e continua sem efeito, ou marcá-lo faz o dispositivo parar de tocar de vez. O Equalizer APO pode se ligar ao áudio do Windows de dois jeitos diferentes, e alguns equipamentos só funcionam com um deles.',
  'troubleshoot.apo.mode.cost':
    'Uma reinicialização. É reversível: volte do mesmo jeito.',
  'troubleshoot.apo.mode.detail':
    'No Device Selector, abra **Troubleshooting options**. O padrão é instalar como **APO**, que funciona na maioria dos computadores. **Install as SFX/EFX** é a alternativa, indicada para dispositivos cujos drivers trazem efeitos próprios — muito áudio de notebook e de games. Se um dispositivo parou de funcionar depois que você o marcou, tente o outro modo antes de concluir que ele não pode ser equalizado.',
  'troubleshoot.apo.reinstall.title': 'Reinstalar o Equalizer APO',
  'troubleshoot.apo.reinstall.when':
    'Os dois primeiros não mudaram nada, ou o Windows foi atualizado e o equalizador não funciona desde então. O instalador também é a ferramenta de reparo: registra de novo o componente de áudio e reabre a lista de dispositivos.',
  'troubleshoot.apo.reinstall.cost':
    'Permissão de administrador, e depois o computador precisa reiniciar. Seus perfis e presets do FluidEQ não são alterados.',
  'troubleshoot.apo.readd.title':
    'Remova o dispositivo, reinicie e adicione de novo',
  'troubleshoot.apo.readd.when':
    'Só se um dispositivo específico continuar com problema depois de reinstalar. Desmarque-o no Device Selector, reinicie o computador, marque-o de novo e reinicie mais uma vez.',
  'troubleshoot.apo.readd.cost': 'Duas reinicializações.',
  'troubleshoot.apo.readd.detail':
    'As duas reinicializações não são superstição. O Equalizer APO se liga a um endpoint de áudio quando o computador inicia, então um dispositivo desligado com o Windows em execução fica meio ligado até deixar de estar — e adicioná-lo de novo antes disso traz o estado com defeito de volta.',
  'troubleshoot.engine.enable.title':
    'Coloque o Motor FluidEQ de volta nas suas saídas',
  'troubleshoot.engine.enable.when':
    'Um dispositivo é equalizado e outro não, ou um headset que você acabou de conectar está sendo ignorado. O motor se liga a cada saída separadamente, e uma atualização do Windows pode desligá-lo de uma saída em que ele já estava.',
  'troubleshoot.engine.permission':
    'O Windows pede permissão e o áudio reinicia por um instante. Sem reiniciar o computador.',
  'troubleshoot.engine.remove.title': 'Remova o Motor FluidEQ desta saída',
  'troubleshoot.engine.remove.when':
    'Só esta saída tem um problema que nada acima resolve, ou você quer devolvê-la a outro programa de áudio. O motor sai da saída pela qual o Windows está tocando agora, e o que ele tinha substituído volta.',
  'troubleshoot.engine.remove.cost':
    'O Windows pede permissão e o áudio reinicia por um instante. Suas outras saídas não são alteradas, e o passo acima o coloca de volta.',
  'troubleshoot.engine.remove.action': 'Remover desta saída',
} as const;

export default troubleshoot;
