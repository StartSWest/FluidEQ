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
  'look.colours': 'Cores',
  'look.colourValue': 'Cor {number}: {colour}',
  'look.removeColour': 'Remover cor {number}',
  'look.custom': 'Personalizada',
  'look.customColour': 'Qualquer outra cor',
  'look.reset': 'Redefinir',
  'look.addColour': 'Adicionar cor',
  'look.addColourHint': 'Adicionar uma cor ao fim do gradiente',
  'look.pieces': 'Partes',
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
  'look.glowNeedsRainbow':
    'Requer o modo Arco-íris. Desativado, o brilho não altera o desenho.',
  'look.needsRainbow': 'Requer o modo Arco-íris.',
  'look.rainbowBorder': 'Borda arco-íris',
  'look.rainbowBorderHint':
    'Contorna o gráfico com uma cor que percorre todo o espectro.',
  'look.borderWeight': 'Espessura da borda',
  'look.litPeaks': 'Picos iluminados',
  'look.noLitPeaks': 'Esta forma não possui pontas iluminadas',
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
  'support.petHint': 'Pressione espaço para fazê-lo pular',
  'support.game.hint': 'Toque no ritmo quando o pico chegar à linha',
  'support.game.howTo':
    'Toque no bichinho ou pressione espaço a cada batida. Continue e algo acontece no ×10.',
  'support.game.thanks':
    'Se algo aqui te fez sorrir, ideias e apoio são o que mantêm isto vivo.',
  'support.game.noAudio': 'Toque algo e o ritmo aparece aqui',
  'support.game.listening': 'Procurando o ritmo…',
  'support.game.share': 'Partilhar',
  'support.game.shareEuphoria': 'Partilhar o arco-íris',
  'support.game.shareTitle': 'Partilhe a sua pontuação',
  'support.game.shareUnlock':
    'Chegue a ×10 e este cartão passa a modo arco-íris, com todo o espetro.',
  'support.game.shareNote':
    'Guarde o cartão e anexe-o à publicação: nenhuma destas redes consegue tirar uma imagem de um link.',
  'support.game.shareSave': 'Guardar cartão',
  'support.game.shareCopyCard': 'Copiar cartão',
  'support.game.shareCardCopied': 'Copiado — cole-o',
  'support.game.shareCopy': 'Copiar texto',
  'support.game.shareCopied': 'Copiado',
  'support.game.shareLinkOnly':
    'Partilha apenas o link: cole o texto você mesmo',
  'support.game.euphoria': 'Modo arco-íris',
  'support.game.euphoriaToggle': 'Ligar ou desligar o modo arco-íris',
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
  'support.contributed': 'Eu contribuí — libere a estrela e a dança',
  'support.thanks': 'Obrigado — seu bichinho ganhou a estrela e agora dança.',
  'support.releaseNotes': 'Veja as novidades desta versão',
  'support.footerBefore':
    'Prefere contribuir com tempo? Issues e pull requests são igualmente bem-vindos no',
};

export default look;
