/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': 'Pontuação',
  'karaoke.score.verdictPerfect': 'Perfeito',
  'karaoke.score.verdictGood': 'Bom',
  'karaoke.score.verdictLate': 'Atrasado',
  'karaoke.score.verdictLow': 'Baixo',
  'karaoke.score.verdictHigh': 'Alto',
  'karaoke.score.verdictMissed': 'Perdida',
  'karaoke.score.verdictSkipped': 'Sem pontuação',
  'karaoke.score.octaveMark': '{verdict} · 8ª',
  'karaoke.score.ratingExcellent': 'Excelente',
  'karaoke.score.ratingGreat': 'Muito bom',
  'karaoke.score.ratingGood': 'Bom',
  'karaoke.score.ratingFair': 'Regular',
  'karaoke.score.ratingPractice': 'Para treinar',
  'karaoke.score.lineNumber': 'Linha {number}',
  'karaoke.score.lineWithText': '{line}, “{text}”',
  'karaoke.score.practiseLine': '{line}: cantar de novo',
  'karaoke.score.outOf': 'de {max}',
  'karaoke.score.streak': 'Sequência',
  'karaoke.score.close': 'Fechar o resultado',
  'karaoke.score.recapTitle': 'Resumo',
  'karaoke.score.bestFirst': 'Sua primeira marca nesta música',
  'karaoke.score.bestNew': 'Novo recorde · +{delta}',
  'karaoke.score.bestTied': 'Igual ao seu recorde',
  'karaoke.score.bestBehind': 'A {delta} do seu recorde',
  'karaoke.score.inTune': 'Afinação',
  'karaoke.score.inTuneNote': 'do tempo que você cantou dentro da nota',
  'karaoke.score.onTime': 'No tempo',
  'karaoke.score.onTimeNote': '{count} de {total} notas entraram no tempo',
  'karaoke.score.notes': 'Notas',
  'karaoke.score.notesNote': 'acertadas',
  'karaoke.score.hardestTitle': 'O que foi mais difícil',
  'karaoke.score.hardestLow': '{line}: você ficou uns {cents} cents abaixo.',
  'karaoke.score.hardestHigh': '{line}: você ficou uns {cents} cents acima.',
  'karaoke.score.hardestLate': '{line}: você entrou com atraso nas notas.',
  'karaoke.score.hardestMissed': '{line}: algumas notas ficaram sem cantar.',
  'karaoke.score.hardestLowest':
    '{line} foi a de menor pontuação, com {percent}.',
  'karaoke.score.tipTitle': 'Para a próxima',
  'karaoke.score.tipLow':
    'Pense a nota um pouco mais alta antes de cantá-la e sustente o ar até o fim para que ela não caia.',
  'karaoke.score.tipHigh':
    'Relaxe a garganta e cante um pouco mais suave: forçar para soar alto é o que sobe a nota.',
  'karaoke.score.tipLate':
    'Respire antes da linha, não na primeira palavra, para que a primeira nota entre no tempo.',
  'karaoke.score.tipMissed':
    'Aprenda a letra das linhas que ficaram sem cantar e cante-as baixinho com a gravação antes de soltar a voz.',
  'karaoke.score.tipOctave':
    'Você cantou boa parte uma oitava ao lado, e isso conta. Para igualar a gravação, tente algumas linhas na oitava dela.',
  'karaoke.score.tipClean':
    'Você cantou limpo do começo ao fim. Tente uma música mais difícil, ou esta com o tom da melodia desligado.',
  'karaoke.score.practisePassage': 'Praticar esse trecho',
  'karaoke.score.singAgain': 'Cantar de novo',
  'karaoke.score.mapTitle': 'Mapa da música',
  'karaoke.score.mapSummary': '{points} pontos · {inTune} afinado',
  'karaoke.score.mapCanvas': 'Todas as notas da música na cor do seu resultado',
  'karaoke.score.deltaTitle': 'Comparado à sua melhor tentativa',
  'karaoke.score.historyTitle': 'Suas últimas tentativas',
  'karaoke.score.historyNow': 'Agora',
  'karaoke.score.historyBest': 'Sua melhor',
  'karaoke.score.progressTitle': 'Seu progresso',
  'karaoke.score.progressFirst':
    'Sua primeira vez com esta música: esta é a marca a superar.',
  'karaoke.score.progressSame':
    'Cada linha ficou onde estava na sua melhor tentativa.',
  'karaoke.score.progressUp':
    '{line} foi a que mais melhorou desde a sua melhor tentativa ({delta} pontos).',
  'karaoke.score.progressDown':
    '{line} caiu em relação à sua melhor tentativa ({delta}). Pratique-a sozinha duas ou três vezes e depois cante a música inteira.',
  'karaoke.score.progressUpDown':
    '{up} foi a que mais melhorou desde a sua melhor tentativa ({delta} pontos). {down} caiu: pratique-a sozinha duas ou três vezes e depois cante a música inteira.',
};

export default karaokeScore;
