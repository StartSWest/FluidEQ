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

/** The Karaoke tab, its player and the Maker. */
import { Dictionary } from '../en';

const karaoke: Partial<Dictionary> = {
  'karaoke.eyebrow': 'KARAOKÊ LOCAL',
  'karaoke.title': 'Um palco feito para sua música',
  'karaoke.intro':
    'Este espaço reunirá músicas, letras sincronizadas, monitoramento do microfone e orientação de afinação, tudo localmente no seu computador.',
  'karaoke.fullscreen.enter': 'Entrar em tela cheia',
  'karaoke.fullscreen.exit': 'Sair da tela cheia',
  'karaoke.fullscreen.hideHeader': 'Ocultar o cabeçalho do FluidEQ',
  'karaoke.fullscreen.showHeader': 'Mostrar o cabeçalho do FluidEQ',
  'karaoke.actions': 'Ações do karaokê',
  'karaoke.readiness.resize':
    'Redimensionar os painéis de microfone e afinação',
  'karaoke.empty.title': 'Seu palco está pronto',
  'karaoke.empty.body':
    'Abra áudios com letras opcionais ou adicione uma pasta inteira. O FluidEQ associa arquivos com o mesmo nome em uma lista.',
  'karaoke.import.pending': 'A seguir: importar músicas',
  'karaoke.import.open': 'Abrir música',
  'karaoke.import.replace': 'Trocar música',
  'karaoke.import.addFiles': 'Adicionar arquivos',
  'karaoke.import.folder': 'Adicionar pasta',
  'karaoke.import.clear': 'Remover',
  'karaoke.import.loading': 'Preparando a música…',
  'karaoke.import.formats':
    'Áudio: MP3, WAV, OGG, Opus, FLAC, M4A ou AAC · Letras: LRC, eLRC ou TXT UltraStar · Adicione também capa e vídeo',
  'karaoke.import.drop': 'Solte músicas, letras ou pastas aqui',
  'karaoke.error.missingAudio':
    'Adicione um arquivo de áudio junto com esse arquivo de letra.',
  'karaoke.error.ambiguous':
    'Há mais de uma combinação possível. Selecione um áudio e, opcionalmente, um arquivo de letra.',
  'karaoke.error.unsupported':
    'Nenhum desses arquivos é ainda um formato de áudio ou letra Karaoke compatível. A capa e o vídeo precisam de uma música ao lado.',
  'karaoke.error.read':
    'O FluidEQ não conseguiu ler os arquivos locais selecionados.',
  'karaoke.error.playback':
    'Esta versão do Chromium não conseguiu reproduzir o arquivo ou codec de áudio.',
  'karaoke.warning.lyrics': 'não pôde ser interpretado.',
  'karaoke.warning.lyricsEmpty': 'está vazio.',
  'karaoke.warning.lyricsMissingTiming':
    'não contém tempos que o FluidEQ consiga ler.',
  'karaoke.warning.lyricsMissingBpm':
    'não declara nenhum BPM, que um arquivo UltraStar precisa.',
  'karaoke.warning.lyricsInvalidBpm':
    'declara um BPM que não é um número utilizável.',
  'karaoke.warning.lyricsMalformedNote':
    'tem uma linha de nota que o FluidEQ não conseguiu ler.',
  'karaoke.warning.lyricsUnsupportedVariant':
    'usa uma variante de karaokê que o FluidEQ ainda não sabe cantar, como um dueto.',
  'karaoke.warning.lyricsAtLine': 'Linha {line}.',
  'karaoke.warning.lyricsAudioIntact':
    'O áudio continua disponível sem letra sincronizada.',
  'karaoke.warning.setAside':
    'O FluidEQ ainda não sabe ler estes arquivos como karaokê, então eles ficaram de fora: {formats}.',
  'karaoke.warning.unpairedLyrics':
    'Nenhum arquivo de áudio combina com estes arquivos de letra, então eles não foram usados: {files}.',
  'karaoke.warning.ambiguousLyrics':
    'Dois arquivos de letra combinavam com a mesma música, então nenhum foi usado: {files}.',
  'karaoke.warning.andMore': 'e mais {count}',
  'karaoke.countdown.sing': 'Canta',
  'karaoke.song.unknownArtist': 'Música local',
  'karaoke.stage.videoUnsupported':
    'Não é possível reproduzir vídeo {format} aqui',
  'karaoke.stage.videoFailed':
    'Não foi possível decodificar o vídeo {format} aqui',
  'karaoke.stage.hideArt': 'Ocultar a capa',
  'karaoke.stage.showArt': 'Mostrar a capa',
  'karaoke.stage.noArt': 'Esta música não tem capa',
  'karaoke.playlist.title': 'Lista de reprodução',
  'karaoke.playlist.groupFolders': 'Agrupar por pasta',
  'karaoke.playlist.looseFiles': 'Arquivos soltos',
  'karaoke.playlist.resize': 'Redimensionar playlist e palco',
  'karaoke.playlist.collapse': 'Recolher playlist',
  'karaoke.playlist.expand': 'Expandir playlist',
  'karaoke.playlist.select': 'Selecionar {title}',
  'karaoke.playlist.moveUp': 'Mover {title} para cima',
  'karaoke.playlist.moveDown': 'Mover {title} para baixo',
  'karaoke.playlist.remove': 'Remover {title}',
  'karaoke.source.audioOnly': 'Somente áudio',
  'karaoke.source.lrc': 'LRC · tempo por linha',
  'karaoke.source.elrc': 'eLRC · tempo por palavra',
  'karaoke.source.ultrastar': 'UltraStar · sílabas + afinação',
  'karaoke.lyrics.none':
    'Nenhuma letra sincronizada foi escolhida. A reprodução e o afinador continuam disponíveis.',
  'karaoke.lyrics.line': 'Linha da letra {number}',
  'karaoke.lyrics.previous': 'Letra anterior',
  'karaoke.lyrics.next': 'Próxima letra',
  'karaoke.lyrics.follow': 'Seguir a letra',
  'karaoke.lyrics.textSize': 'Tamanho do texto da letra',
  'karaoke.transport.title': 'Controles de reprodução do Karaoke',
  'karaoke.transport.restart': 'Reiniciar música',
  'karaoke.transport.play': 'Reproduzir',
  'karaoke.transport.pause': 'Pausar',
  'karaoke.transport.spaceShortcut': '{action} · Espaço',
  'karaoke.transport.seek': 'Posição da música',
  'karaoke.transport.volume': 'Volume',
  'karaoke.transport.vocalLevel': 'Voz guia',
  'karaoke.transport.vocalOff': 'Somente base',
  'karaoke.transport.vocalFull': 'Original',
  'karaoke.transport.mixSettings': 'Definições de mistura',
  'karaoke.transport.openMixSettings':
    'Abrir definições de mistura para {channel}',
  'karaoke.mic.title': 'Microfone',
  'karaoke.mic.settings': 'Configurações do microfone',
  'karaoke.mic.off': 'Desligado',
  'karaoke.mic.hint':
    'Escolha uma entrada. O FluidEQ só pede acesso ao microfone quando você o ativa.',
  'karaoke.mic.select': 'Entrada do microfone',
  'karaoke.mic.default': 'Padrão do sistema',
  'karaoke.mic.unnamed': 'Microfone {number}',
  'karaoke.mic.turnOn': 'Ativar microfone',
  'karaoke.mic.turnOff': 'Desativar microfone',
  'karaoke.mic.requesting': 'Conectando…',
  'karaoke.mic.live': 'Ativo',
  'karaoke.mic.denied': 'Permissão negada',
  'karaoke.mic.unavailable': 'Sem microfone',
  'karaoke.mic.disconnected': 'Desconectado',
  'karaoke.mic.error': 'Não foi possível iniciar',
  'karaoke.mic.level': 'Nível de entrada do microfone',
  'karaoke.mic.levelValue': 'Nível de entrada do microfone: {percent}%',
  'karaoke.mic.privacy':
    'Somente análise local de nível e afinação. O FluidEQ não grava nem reproduz o microfone nos alto-falantes.',
  'karaoke.mic.volume': 'Volume do microfone',
  'karaoke.mic.volumeValue': 'Volume do microfone: {percent}%',
  'karaoke.pitch.title': 'Faixa de afinação',
  'karaoke.pitch.resize': 'Redimensionar a faixa de afinação',
  'karaoke.pitch.show': 'Mostrar guia de afinação',
  'karaoke.pitch.hide': 'Ocultar guia de afinação',
  'karaoke.pitch.guide': 'Guia melódico',
  'karaoke.pitch.toneGuide': 'Tom da melodia',
  'karaoke.pitch.toneEnable': 'Reproduzir o tom da melodia',
  'karaoke.pitch.toneDisable': 'Parar o tom da melodia',
  'karaoke.pitch.toneVolume': 'Volume do tom da melodia',
  'karaoke.pitch.scrubHint':
    'Arraste para a esquerda ou direita para percorrer a música; solte para manter pausado.',
  'karaoke.pitch.viewSelector': 'Exibição de afinação',
  'karaoke.pitch.viewNotes': 'Notas',
  'karaoke.pitch.viewWave': 'Curva',
  'karaoke.pitch.waveCanvas':
    'Curva em tempo real da afinação do cantor sobre as notas da música',
  'karaoke.pitch.waveSong': 'Música',
  'karaoke.pitch.waveVoice': 'Sua voz',
  'karaoke.pitch.waveFooter':
    'Os blocos azuis são as notas da música; a curva fina ao vivo é a afinação captada pelo microfone.',
  'karaoke.pitch.review': 'Avaliação da apresentação',
  'karaoke.pitch.reviewCount': '{count} trechos para praticar',
  'karaoke.pitch.issueHigh': 'Afinação alta em {time}. Pratique este trecho.',
  'karaoke.pitch.issueLow': 'Afinação baixa em {time}. Pratique este trecho.',
  'karaoke.pitch.issueMissed':
    'Notas não cantadas em {time}. Pratique este trecho.',
  'karaoke.practice.go': 'VAI!',
  'karaoke.practice.ready': 'Prepare-se para cantar novamente',
  'karaoke.countIn.ready': 'Prepare-se — a música começa depois de VAI',
  'karaoke.pitch.canvas':
    'Faixa de afinação ao vivo do microfone e das notas-alvo',
  'karaoke.pitch.micOff': 'Ligue o microfone para ver sua afinação.',
  'karaoke.pitch.loading': 'Iniciando análise de afinação…',
  'karaoke.pitch.unavailable':
    'A análise de afinação não está disponível. O nível do microfone continua funcionando.',
  'karaoke.pitch.noSignal': 'Cante no microfone para traçar sua afinação.',
  'karaoke.pitch.empty':
    'As notas-alvo só aparecerão quando a música importada realmente as fornecer.',
  'karaoke.pitch.high': 'Alto',
  'karaoke.pitch.tuned': 'Afinado',
  'karaoke.pitch.low': 'Baixo',
  'karaoke.pitch.ultrastar':
    'As barras azuis são as notas-alvo; o traço indica se a sua voz está alta, afinada ou baixa.',
  'karaoke.chords.aria':
    'Acordes de guitarra estimados da faixa de acompanhamento',
  'karaoke.chords.analyzing': 'A procurar acordes… {percent}%',
  'karaoke.chords.estimate': 'Acorde estimado',
  'karaoke.chords.next': 'Seguinte',
  'karaoke.chords.in': 'em {seconds}s',
  'karaoke.chords.none': 'Nenhum acorde estável encontrado',
  'karaoke.chords.confidence': 'Confiança da estimativa de áudio: {percent}%',
  'karaoke.maker.open': 'Criar',
  'karaoke.maker.openTitle': 'Criar ou editar este karaokê',
  'karaoke.maker.dialog': 'Criador de karaokê',
  'karaoke.maker.eyebrow': 'CRIADOR DE KARAOKÊ FLUIDEQ',
  'karaoke.maker.close': 'Fechar criador',
  'karaoke.maker.songTitle': 'Título da música',
  'karaoke.maker.untitled': 'Karaokê sem título',
  'karaoke.maker.undo': 'Desfazer',
  'karaoke.maker.redo': 'Refazer',
  'karaoke.maker.preview': 'Prévia · 1, 2, 3',
  'karaoke.maker.apply': 'Usar no reprodutor',
  'karaoke.maker.applyHint':
    'Use estas edições no player. O arquivo original não muda; Exportar cria um novo arquivo.',
  'karaoke.maker.lyrics': 'Letra',
  'karaoke.maker.toolsEdit': 'Ferramentas de edição',
  'karaoke.maker.toolsAnalysis': 'Ferramentas de análise',
  'karaoke.maker.lyricsTiming': 'Tempo da letra',
  'karaoke.maker.timingAll': 'Música inteira',
  'karaoke.maker.timingFromWord': 'Da palavra selecionada',
  'karaoke.maker.timingAllHint':
    'Move juntas todas as palavras e notas sincronizadas.',
  'karaoke.maker.timingFromWordHint':
    'Move “{word}” e tudo depois dela. O trecho anterior fica fixo.',
  'karaoke.maker.earlier': 'Mover toda a letra para antes',
  'karaoke.maker.later': 'Mover toda a letra para depois',
  'karaoke.maker.openProject': 'Importar karaokê',
  'karaoke.maker.projectLoaded':
    'Projeto carregado. O áudio atual permanece anexado.',
  'karaoke.maker.karaokeImported':
    'Sincronização importada. O áudio atual permanece anexado.',
  'karaoke.maker.tapWords': 'Marcar palavras',
  'karaoke.maker.recordLines': 'Gravar entradas de linhas',
  'karaoke.maker.syncLinesFromHere': 'Sincronizar linhas daqui',
  'karaoke.maker.syncWordsFromHere': 'Sincronizar palavras daqui',
  'karaoke.maker.syncNow': 'Agora',
  'karaoke.maker.syncNext': 'Próximo: {item}',
  'karaoke.maker.markLine': 'Marcar início da linha',
  'karaoke.maker.markLineEnd': 'Marcar fim da linha',
  'karaoke.maker.captureEnd': 'Ouvindo o final',
  'karaoke.maker.capturePressStart': 'Etapa 1 · Enter no INÍCIO',
  'karaoke.maker.captureReplaceStart':
    'Próxima letra pronta · Enter substitui o INÍCIO',
  'karaoke.maker.captureStartSaved': 'Início salvo em {time} · Enter no FIM',
  'karaoke.maker.captureAutomaticStart':
    'Início automático {time} · Enter no FIM',
  'karaoke.maker.captureAutomaticSuggestion':
    'Início sugerido {time} · Enter grava o INÍCIO',
  'karaoke.maker.captureFixEnd': 'Linha gravada · Enter corrige o FIM',
  'karaoke.maker.captureStartPoint': 'INÍCIO',
  'karaoke.maker.captureEndPoint': 'FIM',
  'karaoke.maker.captureGuideTitle': 'Tempo da linha',
  'karaoke.maker.captureSetupTitle': 'Pronto para gravar o tempo da letra?',
  'karaoke.maker.captureSetupBody':
    'Ouça o cantor. Pressione Enter no início da linha, Tab em cada nova palavra se desejar e Enter novamente no fim. Assim, a última palavra pode manter toda a duração.',
  'karaoke.maker.captureSetupStatus':
    'Leia o guia na prévia ao vivo e depois comece a gravar.',
  'karaoke.maker.captureStartRecording': 'Iniciar gravação',
  'karaoke.maker.captureMoveGuide':
    'Arraste para mover este guia. Clique duas vezes para restaurar a posição.',
  'karaoke.maker.selectionPanel': 'Ferramentas de seleção',
  'karaoke.maker.selectionMoveGuide':
    'Arraste para mover as ferramentas. Clique duas vezes para restaurar a posição.',
  'karaoke.maker.dismissSelection': 'Fechar ferramentas de seleção',
  'karaoke.maker.captureCountdownReady': 'Prepare-se para a primeira linha',
  'karaoke.maker.captureGuideNext': 'A seguir',
  'karaoke.maker.captureGuideAudio':
    'move o áudio 2 segundos · Shift: 1 segundo',
  'karaoke.maker.captureGuideLyrics': 'escolhe a linha da letra',
  'karaoke.maker.captureGuidePlayback': 'reproduz ou pausa',
  'karaoke.maker.captureGuideWords': 'marcar a próxima palavra',
  'karaoke.maker.captureGuideUndo': 'desfaz a última marca',
  'karaoke.maker.stopRecording': 'Parar gravação',
  'karaoke.maker.markWord': 'Marcar palavra',
  'karaoke.maker.markNextWord': 'Próxima palavra',
  'karaoke.maker.done': 'Concluir',
  'karaoke.maker.ignoreLine': 'Ignorar linha',
  'karaoke.maker.lineTimingComplete':
    'Sincronização das linhas concluída. Pronta para revisar e usar no player.',
  'karaoke.maker.recordLinesHint':
    'ENTER marca início/fim · ↑/↓ escolhe a linha · ←/→ move apenas o áudio 2 s · ESPAÇO reproduz ou pausa · Backspace desfaz',
  'karaoke.maker.panView': 'Mão · mover linha do tempo',
  'karaoke.maker.panHint':
    'Ferramenta mão: arraste no canvas para percorrer a música sem editar.',
  'karaoke.maker.scrubHint':
    'Clique ou arraste o cursor de reprodução para percorrer a música.',
  'karaoke.maker.addNote': 'Nota',
  'karaoke.maker.selectNotes': 'Selecionar notas',
  'karaoke.maker.paintNotes': 'Desenhar notas',
  'karaoke.maker.selectNotesHint':
    'Arraste uma caixa ao redor das notas. Arraste uma nota selecionada para mover o grupo. Use Ctrl e arraste até uma palavra ou sílaba para anexar.',
  'karaoke.maker.paintNotesHint':
    'Arraste pela grade de afinação para desenhar uma nota. A ferramenta permanece ativa para adicionar várias notas.',
  'karaoke.maker.notesSelected': 'notas selecionadas',
  'karaoke.maker.copyNotes': 'Copiar notas selecionadas',
  'karaoke.maker.pasteNotes': 'Colar notas no cursor',
  'karaoke.maker.notePasted': 'Nota colada no cursor.',
  'karaoke.maker.notesPasted': '{count} notas coladas no cursor.',
  'karaoke.maker.attachNotesByTime': 'Anexar à letra',
  'karaoke.maker.detachNotes': 'Desanexar da letra',
  'karaoke.maker.noteAttachHelp':
    'Mantenha Ctrl pressionado e arraste uma nota até uma palavra ou sílaba. Notas anexadas seguem a letra e ficam bloqueadas.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C copia a seleção · Ctrl+V cola a primeira nota no cursor.',
  'karaoke.maker.attachedTo': 'Anexada a “{word}”',
  'karaoke.maker.noteUnattached': 'Não anexada à letra',
  'karaoke.maker.splitWordSyllables': 'Dividir palavra em sílabas',
  'karaoke.maker.syllableEditorEyebrow': 'Editor de sílabas',
  'karaoke.maker.syllableEditorTitle': 'Dividir “{word}”',
  'karaoke.maker.syllableEditorHint':
    'Clique entre as letras para adicionar ou remover uma divisão silábica.',
  'karaoke.maker.syllableSplitPoint': 'Alternar divisão após “{text}”',
  'karaoke.maker.syllableEditorPreview': 'Sílabas resultantes',
  'karaoke.maker.applySyllableSplit': 'Aplicar divisão silábica',
  'karaoke.maker.hearNote': 'Ouvir nota',
  'karaoke.maker.split': 'Dividir',
  'karaoke.maker.delete': 'Excluir',
  'karaoke.maker.analyze': 'Analisar melodia',
  'karaoke.maker.prepare': 'Preparar karaokê',
  'karaoke.maker.advanced': 'Avançado',
  'karaoke.maker.prepared':
    'Este karaokê já tem notas de melodia sincronizadas.',
  'karaoke.maker.repairLyrics': 'Detectar novamente o tempo da letra',
  'karaoke.maker.repairMelody': 'Detectar novamente as notas da melodia',
  'karaoke.maker.rebuildKaraoke': 'Reconstruir letra + melodia',
  'karaoke.maker.autoAlign': 'Alinhar automaticamente',
  'karaoke.maker.aiMelody': 'Melodia por IA',
  'karaoke.maker.transcribe': 'Transcrever',
  'karaoke.maker.vocalStem': 'Usar faixa vocal',
  'karaoke.maker.vocalStemLoaded': 'Faixa vocal carregada',
  'karaoke.maker.groupVoice': 'Voz e música',
  'karaoke.maker.stemsTitle': 'Faixas separadas',
  'karaoke.maker.stemBacking': 'Faixa base',
  'karaoke.maker.stemSaveAs': 'Guardar {name} como',
  'karaoke.maker.stemSaveFormat': 'Guardar {name} como {format}',
  'karaoke.maker.stemMp3Encoding': 'A codificar o MP3…',
  'karaoke.maker.stemMp3Saved': 'MP3 guardado.',
  'karaoke.maker.stemMp3Failed': 'Não foi possível codificar o MP3.',
  'karaoke.maker.stemVoice': 'Voz',
  'karaoke.maker.stemSave': 'Salvar',
  'karaoke.maker.groupLyrics': 'Letra e sincronização',
  'karaoke.maker.removeBackground': 'Separar a voz da música',
  'karaoke.maker.removeBackgroundDone': 'Voz já separada',
  'karaoke.maker.separationDownloading':
    'Baixando o modelo de separação ({percent}%) · uma única vez, cerca de 700 MB',
  'karaoke.maker.separationReading': 'Lendo a música',
  'karaoke.maker.separating': 'Separando a voz da música',
  'karaoke.maker.separationDone':
    'Voz separada. A detecção de letra está pronta.',
  'karaoke.maker.separationSlow':
    'Sem aceleração gráfica neste computador, então isto levará alguns minutos em vez de menos de um.',
  'karaoke.maker.separationRequired':
    'Separe a voz primeiro: a detecção de letra lê a faixa vocal isolada.',
  'karaoke.maker.separationRequiredMelody':
    'Separe a voz primeiro: a detecção de notas segue uma única voz e, numa mistura, isso costuma ser um instrumento.',
  'karaoke.maker.wizardTitle': 'Preparar esta música automaticamente',
  'karaoke.maker.wizardIntro':
    'Esta música ainda não tem tempos de letra. O FluidEQ pode separar a voz da música e ler dela as palavras e seus tempos. Tudo roda neste computador.',
  'karaoke.maker.wizardStepSeparate': 'Separar a voz',
  'karaoke.maker.wizardStepTranscribe': 'Ler as palavras e os tempos',
  'karaoke.maker.wizardLanguage': 'Idioma da letra',
  'karaoke.maker.wizardLanguageAuto': 'Detectar automaticamente',
  'karaoke.maker.wizardStart': 'Preparar automaticamente',
  'karaoke.maker.wizardSkip': 'Eu faço isso',
  'karaoke.maker.wizardCancel': 'Parar',
  'karaoke.maker.wizardHide': 'Continuar em segundo plano',
  'karaoke.maker.wizardCancelled': 'Parado. O que foi concluído foi mantido.',
  'karaoke.maker.vocalFocus': 'Foco vocal central',
  'karaoke.maker.export': 'Exportar',
  'karaoke.maker.exportProject': 'Projeto FluidEQ',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'LRC aprimorado',
  'karaoke.maker.exportInstrumental': 'Faixa base (sem voz)',
  'karaoke.maker.tapHint':
    'Pressione ESPAÇO ou ENTER para “{word}” · Backspace desfaz',
  'karaoke.maker.editHint':
    'Arraste notas para mudar tom/tempo. Arraste as bordas para redimensionar. Ctrl + roda amplia.',
  'karaoke.maker.stats':
    '{notes} notas · {words} palavras · {checks} verificações',
  'karaoke.maker.wordStateLegend': 'Status do tempo da letra',
  'karaoke.maker.userAdjustedWords': '{count} ajustadas',
  'karaoke.maker.pendingWords': '{count} pendentes',
  'karaoke.maker.artist': 'Artista',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Posição na música',
  'karaoke.maker.previousView': 'Seção anterior',
  'karaoke.maker.nextView': 'Próxima seção',
  'karaoke.maker.resetZoom': 'Clique duas vezes para ajustar a letra',
  'karaoke.maker.livePreview': 'Prévia ao vivo',
  'karaoke.maker.showPreview': 'Mostrar prévia',
  'karaoke.maker.hidePreview': 'Ocultar prévia',
  'karaoke.maker.previewEmpty':
    'Adicione ou alinhe letras com tempo para ver a prévia ao vivo.',
  'karaoke.maker.noteNormal': 'Nota',
  'karaoke.maker.noteGolden': 'Dourada',
  'karaoke.maker.noteFree': 'Livre',
  'karaoke.maker.untimed': 'Sem tempo',
  'karaoke.maker.applyUntimed':
    'Ainda há {count} palavras da letra sem tempo de voz verificado. Detecte ou posicione-as antes de usar este karaokê no player.',
  'karaoke.maker.selectHint':
    'Selecione uma palavra ou nota melódica para inspecionar.',
  'karaoke.maker.rights':
    'Tenho permissão para usar e exportar este áudio e esta letra.',
  'karaoke.maker.cancel': 'Cancelar',
  'karaoke.maker.localAnalysis': 'Análise local',
  'karaoke.maker.lyricsEyebrow': 'LETRA',
  'karaoke.maker.lyricsTitle': 'Cole ou edite uma linha da letra por linha',
  'karaoke.maker.lyricsWarning':
    'Substituir o texto remove os vínculos para que as palavras possam ser marcadas ou alinhadas com segurança.',
  'karaoke.maker.lyricsReferenceHint':
    'Forneça a letra completa, incluindo linhas repetidas e marcadores como [Verso] ou [Refrão]. O FluidEQ mantém esse texto e usa reconhecimento de voz local para encontrar o tempo.',
  'karaoke.maker.referenceLyrics': 'Letra de referência',
  'karaoke.maker.wordTiming': 'Tempo da palavra',
  'karaoke.maker.lyricsWordCount': '{count} palavras na referência',
  'karaoke.maker.lyricsTimedCount': '{timed} de {total} com tempo',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Detecte a nova letra antes de editar o tempo das palavras',
  'karaoke.maker.lyricsNoTimedWords': 'Ainda não há palavras com tempo',
  'karaoke.maker.lyricsTimingEditorHint':
    'Após a detecção, selecione qualquer palavra para corrigir o texto, o início ou a duração.',
  'karaoke.maker.lyricsSelectWord':
    'Selecione uma palavra para editar seu tempo.',
  'karaoke.maker.lyricsSelectedWord': 'Palavra selecionada',
  'karaoke.maker.lyricsWordNavigation': 'Navegação por palavras',
  'karaoke.maker.previousWord': 'Palavra anterior',
  'karaoke.maker.nextWord': 'Próxima palavra',
  'karaoke.maker.lyricsPlaceholder':
    'Cole a letra completa aqui…\n\n[Verso]\nPrimeira linha\nSegunda linha',
  'karaoke.maker.loadLyricsFile': 'Carregar arquivo de letra',
  'karaoke.maker.lyricsFileLoaded': 'Letra carregada de {file}.',
  'karaoke.maker.lyricsRequired':
    'Adicione ou cole a letra completa antes de detectar o tempo e a melodia.',
  'karaoke.maker.detectTimingMelody': 'Detectar tempo e melodia',
  'karaoke.maker.acceptLyrics': 'Aceitar letra',
  'karaoke.maker.acceptAndRecordLines': 'Aceitar e gravar tempos',
  'karaoke.maker.continueInBackground': 'Continuar em segundo plano',
  'karaoke.maker.clearLyrics': 'Limpar letra',
  'karaoke.maker.clearLyricsTitle': 'Limpar toda a letra?',
  'karaoke.maker.clearLyricsBody':
    'Isso remove toda a letra e seus tempos. As notas da melodia permanecem, mas seus vínculos com palavras são removidos. É possível desfazer depois.',
  'karaoke.maker.clearNotes': 'Limpar notas',
  'karaoke.maker.clearNotesTitle': 'Limpar todas as notas da melodia?',
  'karaoke.maker.clearNotesBody':
    'Isso remove todas as notas da melodia e mantém a letra e o tempo das palavras. É possível desfazer depois.',
  'karaoke.maker.notesCleared': 'Todas as notas da melodia foram removidas.',
  'karaoke.maker.lyricsCleared':
    'Toda a letra foi removida. As notas existentes foram mantidas sem vínculos com palavras.',
  'karaoke.maker.restore': 'Restaurar original',
  'karaoke.maker.restoreTitle': 'Restaurar o karaokê original?',
  'karaoke.maker.restoreBody':
    'Isso descarta todas as edições desta sessão e reconstrói o karaokê como foi importado, incluindo seu rascunho salvo. É possível desfazer depois de restaurar.',
  'karaoke.maker.restored': 'O original importado foi restaurado.',
  'karaoke.maker.replaceLyricsWarning':
    'As palavras mudaram. Substituí-las recria os identificadores e o tempo automático; as correções manuais existentes não podem ser transferidas com segurança. As notas permanecem e serão vinculadas novamente.',
  'karaoke.maker.replaceAndDetect': 'Substituir e detectar',
  'karaoke.maker.wordText': 'Palavra',
  'karaoke.maker.wordStart': 'Início (ms)',
  'karaoke.maker.wordPosition': 'Posição',
  'karaoke.maker.wordDuration': 'Duração (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Ajusta o limite compartilhado; a palavra vizinha cede ou recebe tempo sem alterar o intervalo da linha.',
  'karaoke.maker.usePlayhead': 'Usar cursor de reprodução',
  'karaoke.maker.playWord': 'Reproduzir palavra',
  'karaoke.maker.allowAutoTiming': 'Permitir tempo automático',
  'karaoke.maker.replaceLyrics': 'Substituir letra',
  'karaoke.maker.lyricsAutoAligned':
    'Nova letra aplicada e alinhada à melodia disponível.',
  'karaoke.maker.lyricsNeedPreparation':
    'Nova letra aplicada. Escolha Preparar karaokê para detectar seu tempo.',
  'karaoke.maker.transcriptionEyebrow': 'TRANSCRIÇÃO LOCAL OPCIONAL',
  'karaoke.maker.transcriptionTitle': 'Baixar o modelo de voz local?',
  'karaoke.maker.transcriptionBody':
    'O FluidEQ vai baixar o modelo {model} com licença MIT do Hugging Face e guardá-lo neste PC — uma única vez, cerca de 570 MB com aceleração gráfica e cerca de 1,1 GB sem ela. Seu áudio nunca sai deste computador. A primeira execução leva alguns minutos e usa bastante memória.',
  'karaoke.maker.transcriptionReview':
    'O reconhecimento é apenas um ponto de partida. O FluidEQ mantém a grafia da sua letra ao comparar texto e todos os tempos continuam editáveis.',
  'karaoke.maker.notNow': 'Agora não',
  'karaoke.maker.downloadTranscribe': 'Baixar e transcrever',
  'karaoke.maker.downloadPrepare': 'Baixar e preparar a letra',
  'karaoke.maker.downloadingWhisper': 'Baixando o modelo Whisper',
  'karaoke.maker.downloadOverall': 'Download geral',
  'karaoke.maker.downloadFiles': '{complete} de {total} arquivos',
  'karaoke.maker.loadingWhisper': 'Carregando o modelo Whisper',
  'karaoke.maker.analysisRunning': 'Analisando afinação localmente',
  'karaoke.maker.analysisAligned':
    '{count} regiões de notas detectadas foram alinhadas às palavras não editadas. O tempo manual foi preservado.',
  'karaoke.maker.analysisFound':
    'A análise encontrou {count} regiões de notas.',
  'karaoke.maker.basicPitchRunning': 'Detectando as notas da melodia',
  'karaoke.maker.basicPitchFound':
    '{count} notas de melodia editáveis encontradas a partir da voz.',
  'karaoke.maker.whisperPreparing': 'Preparando o Whisper',
  'karaoke.maker.whisperDecoding': 'Decodificando o áudio localmente',
  'karaoke.maker.whisperTranscribing': 'Transcrevendo localmente',
  'karaoke.maker.whisperTranscribingProgress':
    'Detectando tempo · passagem {pass}/{passes} · bloco {chunk}/{chunks}',
  'karaoke.maker.whisperAligning': 'A ajustar a letra ao canto',
  'karaoke.maker.whisperComplete': 'Transcrição concluída',
  'karaoke.maker.whisperMatched':
    'O Whisper associou {count} palavras reconhecidas. Revise os tempos editáveis antes de exportar.',
  'karaoke.maker.autoAlignComplete':
    'A letra não editada foi alinhada à melodia detectada. O tempo manual foi preservado.',
  'karaoke.maker.speechMemory': 'Memória dos modelos de IA',
  'karaoke.maker.speechMemoryReady': 'Pronto na RAM',
  'karaoke.maker.speechMemoryCached': 'Em cache no disco',
  'karaoke.maker.speechMemoryMissing': 'Não baixado',
  'karaoke.maker.modelWhisper': 'Voz (Whisper)',
  'karaoke.maker.modelPitch': 'Tom (RMVPE)',
  'karaoke.maker.modelSeparation': 'Separação (RoFormer)',
  'karaoke.maker.freeMemory': 'Liberar RAM agora',
  'karaoke.maker.memoryReleased':
    'O modelo de voz foi removido da RAM. Os arquivos baixados continuam em cache.',
  'karaoke.maker.memoryReleaseBusy':
    'O modelo de voz está ocupado e ainda não pode ser liberado.',
  'karaoke.maker.memoryAfterUse': 'Quando estiver ocioso',
  'karaoke.maker.memoryPolicy.ask': 'Perguntar',
  'karaoke.maker.memoryPolicy.auto': 'Liberar automaticamente',
  'karaoke.maker.memoryPolicy.keep': 'Manter carregado',
  'karaoke.maker.memoryAfter': 'Depois de',
  'karaoke.maker.memoryMinutes': '{count} min',
  'karaoke.maker.memoryPromptTitle': 'Liberar a memória do modelo de voz?',
  'karaoke.maker.memoryPromptBody':
    'O modelo de voz local está ocioso. Liberá-lo economiza RAM; seus arquivos continuam em cache para recarregar mais rápido.',
  'karaoke.maker.keepLoaded': 'Manter carregado',
  'karaoke.maker.exported': '{file} foi exportado',
  'karaoke.maker.exportedPartialLrc':
    '{file} foi exportado, sem {lines} linhas da letra: o LRC precisa de um tempo na linha ou em uma de suas palavras, e estas não têm nenhum. Marque o tempo delas no Maker e exporte de novo para obter um arquivo completo.',
  'karaoke.maker.exportedPartialUltraStar':
    '{file} foi exportado, sem {words} palavras da letra: o UltraStar só leva uma palavra onde a melodia tem uma nota, e estas não têm nenhuma. Detecte ou desenhe as notas delas e exporte de novo para obter um arquivo completo.',
  'karaoke.maker.exportFallback': 'arquivo de karaokê',
  'karaoke.maker.projectTooLarge': 'O projeto ultrapassa 16 MB.',
  'karaoke.maker.previewResize': 'Redimensionar a prévia ao vivo',
  'karaoke.maker.seekBack': 'Voltar {seconds} segundos',
  'karaoke.maker.seekForward': 'Avançar {seconds} segundos',
  'karaoke.maker.jumpToStart': 'Ir para o início da música',
  'karaoke.maker.jumpToEnd': 'Ir para o fim da música',
  'karaoke.maker.errorAudioLimits':
    'A análise local aceita áudios de até 1 GB e gravações com menos de 30 minutos.',
  'karaoke.maker.errorComponentUnavailable':
    'Um componente necessário para a análise local não está disponível. Reinicie o FluidEQ e tente novamente.',
  'karaoke.maker.errorAnalysis':
    'O FluidEQ não conseguiu analisar este áudio localmente.',
  'karaoke.maker.errorExportNeedsNotes':
    'A exportação UltraStar precisa de pelo menos uma nota de melodia.',
  'karaoke.maker.errorExport': 'O FluidEQ não conseguiu exportar este karaokê.',
  'karaoke.maker.errorProjectVersion':
    'Este projeto foi criado por uma versão não compatível do FluidEQ.',
  'karaoke.maker.errorImport':
    'O FluidEQ não conseguiu importar este karaokê ou projeto.',
  'karaoke.maker.errorParse':
    'Não foi possível interpretar o arquivo de letra ou karaokê selecionado.',
  'karaoke.maker.downloadFailed': 'Falha ao baixar o modelo Whisper',
  'karaoke.maker.localAnalysisFailed': 'Falha na análise local',
  'karaoke.maker.whisperDownloadError':
    'O FluidEQ não conseguiu baixar o modelo do Hugging Face. Verifique a conexão ou o firewall e tente novamente.',
  'karaoke.maker.tryAgain': 'Tentar novamente',
  'karaoke.maker.dismiss': 'Fechar erro',
  'karaoke.maker.analysisSource':
    'Usando “{file}” apenas como fonte de análise local.',
  'karaoke.maker.rightsRequired':
    'Confirme que você tem os direitos do áudio e da letra antes de publicar uma exportação.',
  'karaoke.maker.draftRestored': 'Rascunho restaurado',
  'karaoke.maker.playerTimingLoaded':
    'Usando o tempo atual do player. Desfazer restaura o rascunho salvo.',
};

export default karaoke;
