/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Look Designer, the support panel, the creature and its game. */
import { Dictionary } from '../en';

const look: Partial<Dictionary> = {
  'look.textureStyle': 'Textura',
  'look.texture.none': 'Liso',
  'look.texture.hatch': 'Tracejado',
  'look.texture.crosshatch': 'Tracejado cruzado',
  'look.texture.rules': 'Linhas',
  'look.texture.pinstripe': 'Risca fina',
  'look.texture.dots': 'Pontos',
  'look.texture.grid': 'Grade',
  'look.texture.weave': 'Trama',
  'look.texture.scales': 'Escamas',
  'look.texture.chevron': 'Chevron',
  'look.texture.static': 'Grão',
  'look.texture.image': 'Imagem',
  'look.texture.replace': 'Trocar imagem',
  'look.texture.tooBig':
    'Essa imagem é grande demais para guardar. Tente uma menor.',
  'look.texture.unreadable': 'Não foi possível ler esse arquivo como imagem.',
  'look.tilt': 'Inclinação',
  'look.tiltHint':
    'Decibéis por oitava. Inclina a exibição para os agudos, para que uma mistura equilibrada fique plana.',
  'look.tiltValue': '{value} dB/oct',
  'look.channels': 'Canais',
  'look.channels.joined': 'Juntos',
  'look.channels.split': 'Esquerdo e direito',
  'look.edit': 'Editar visual',
  'look.create': 'Criar visual',
  'look.new': 'Novo visual',
  'look.close': 'Fechar o editor visual',
  'look.closeHint': 'Fechar sem salvar (Esc)',
  'look.pickForm': 'Escolha a forma no seletor acima ou pressione Espaço.',
  'look.colourBy': 'Colorir por',
  'look.palette.cycle': 'Coloração',
  'look.palette.flat': 'Uniforme',
  'look.palette.flatHint': 'Uma cor para toda a figura',
  'look.palette.frequency': 'Frequência',
  'look.palette.frequencyHint':
    'A cor percorre o eixo e mostra onde cada barra está no intervalo.',
  'look.palette.level': 'Nível',
  'look.palette.levelHint':
    'A cor sobe pelo eixo e mostra a intensidade de cada barra.',
  'look.palette.heat': 'Calor',
  'look.palette.heatHint': 'A cor segue o volume, do frio ao vermelho.',
  'look.palette.auto': 'Auto',
  'look.palette.autoHint':
    'Cada forma com a sua própria cor: uma estrada iluminada pelo volume, as barras pela posição.',
  'look.colours': 'Cores',
  'look.colourValue': 'Cor {number}: {colour}',
  'look.removeColour': 'Remover cor {number}',
  'look.custom': 'Personalizada',
  'look.customColour': 'Qualquer outra cor',
  'look.reset': 'Redefinir',
  'look.addColour': 'Adicionar cor',
  'look.addColourHint': 'Adicionar uma cor ao fim do gradiente',
  'look.pieces': 'Partes',
  'look.gap': 'Espaçamento',
  'look.continuous': 'Esta forma é desenhada como uma figura contínua',
  'look.attack': 'Ataque',
  'look.release': 'Liberação',
  'look.releaseHint': 'Quanto tempo um pico permanece antes de cair',
  'look.drawnAs': 'Desenhar como',
  'look.filled': 'Preenchido',
  'look.stroked': 'Contorno',
  'look.fill': 'Preenchimento',
  'look.weight': 'Espessura',
  'look.rainbow': 'Arco-íris',
  'look.glow': 'Brilho',
  'look.off': 'Desativado',
  'look.glowHint': 'Quanto a figura cresce e brilha com a batida.',
  'look.needsRainbow': 'Requer o modo Arco-íris.',
  'look.glowNotForForm': 'Esta forma não tem brilho.',
  'look.rainbowBorder': 'Borda arco-íris',
  'look.rainbowBorderHint':
    'Contorna o gráfico com uma cor que percorre todo o espectro.',
  'look.borderWeight': 'Espessura da borda',
  'look.litPeaks': 'Picos iluminados',
  'look.name': 'Nome',
  'look.resetAll': 'Redefinir todos os ajustes',
  'look.resetAllHint': 'Restaurar os ajustes originais desta forma',
  'look.export': 'Exportar este visual para um arquivo',
  'look.exportHint': 'Salvar este visual em um arquivo compartilhável',
  'look.import': 'Importar um visual de um arquivo',
  'look.delete': 'Excluir este visual',
  'look.save': 'Salvar',
  'look.saveHint': 'Salvar e selecionar este visual',
  'look.full': 'A lista está cheia — exclua um visual para liberar espaço',
  'look.error.emptyFile': 'Nenhum visual foi encontrado nesse arquivo.',
  'look.error.readFile': 'O FluidEQ não conseguiu ler esse arquivo visual.',
  'support.eyebrow': 'TOTALMENTE OPCIONAL',
  'support.petHint': 'Pressione Espaço para fazê-lo pular',
  'support.game.hint': 'Toque no ritmo quando o pico chegar à linha',
  'support.game.howTo':
    'Reproduza música e toque no mascote ou pressione Espaço quando um pico chegar à linha central. Alcance ×10 para desbloquear o modo arco-íris.',
  'support.game.thanks':
    'Se algo aqui fez você sorrir, ideias e apoio são o que mantêm isto vivo.',
  'support.game.noAudio': 'Toque algo e o ritmo aparece aqui',
  'support.game.listening': 'Procurando o ritmo…',
  'support.game.share': 'Compartilhar',
  'support.game.shareEuphoria': 'Compartilhar o arco-íris',
  'support.game.shareTitle': 'Compartilhe sua pontuação',
  'support.game.shareUnlock':
    'Desbloqueie o modo arco-íris jogando ou confirmando sua contribuição para dar suas cores a este cartão.',
  'support.game.shareNote':
    'Salve o cartão e anexe-o à publicação: nenhuma destas redes consegue tirar uma imagem de um link.',
  'support.game.shareSave': 'Salvar cartão',
  'support.game.shareCopyCard': 'Copiar cartão',
  'support.game.shareCardCopied': 'Copiado — cole-o',
  'support.game.shareCopy': 'Copiar texto',
  'support.game.shareCopied': 'Copiado',
  'support.game.shareLinkOnly':
    'Compartilha apenas o link: cole o texto você mesmo',
  'support.game.euphoria': 'Modo arco-íris',
  'support.game.euphoriaToggle': 'Ligar ou desligar o modo arco-íris',
  'support.game.euphoriaHint':
    'Cores do arco-íris, e o gráfico, os medidores e a onda desenhados na taxa de atualização total da sua tela em vez de 30 quadros por segundo. Pressione para ligar ou desligar.',
  'support.game.perfect': 'Perfeito',
  'support.game.great': 'Muito bom',
  'support.game.good': 'Bom',
  'support.game.miss': 'Errou',
  'support.title': 'Apoie o projeto',
  'support.close': 'Fechar',
  'support.pitch':
    'O FluidEQ é livre e de código aberto, e vai continuar assim: o código é público, você sempre pode compilá-lo por conta própria sem pagar nada, e nada é rastreado. O que se vende é a compilação assinada, pronta para usar. Se ele conquistou um lugar no seu setup, uma contribuição financia o tempo que o mantém e as próximas ideias que saírem da mesma oficina.',
  'support.craft':
    'Isto é o trabalho de uma pessoa só, feito com muito carinho e um cuidado com os detalhes que beira o exagero. Cada painel foi desenhado à mão e discutido: como a curva se lê num relance, como um menu se abre, o que um botão giratório faz quando você gira devagar, que palavras entram num botão. Aqui não há componente de prateleira com um tema por cima.',
  'support.card': 'Cartão ou carteira',
  'support.card.hint':
    'Pagamento seguro hospedado pela Stripe. Abre no seu navegador — o aplicativo nunca vê os dados do cartão.',
  'support.coffee': 'Me pague um café',
  'support.coffee.hint':
    'Uma contribuição única, sem precisar de conta. Clique para abrir no navegador ou escaneie o código com o celular.',
  'support.verify': 'Confira o endereço antes de enviar.',
  'support.copy': 'Copiar endereço',
  'support.copied': 'Copiado',
  'support.openWallet': 'Abrir na carteira',
  'support.contributed': 'Eu contribuí — ativar o modo arco-íris',
  'support.rainbowHint':
    'Já contribuiu? Ative o modo arco-íris imediatamente com “Eu contribuí”: as cores e um movimento mais suave no gráfico e nos medidores. Não é preciso alcançar ×10.',
  'support.thanks':
    'Obrigado — o modo arco-íris está desbloqueado, e seu mascote tem sua estrela e sua dança.',
  'support.releaseNotes': 'Veja as novidades desta versão',
  'support.footerBefore':
    'Prefere contribuir com tempo? Issues e pull requests são igualmente bem-vindos no',
};

export default look;
