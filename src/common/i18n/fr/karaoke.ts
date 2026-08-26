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
  'karaoke.eyebrow': 'KARAOKÉ LOCAL',
  'karaoke.title': 'Une scène conçue autour de votre musique',
  'karaoke.intro':
    'Cet espace réunira les morceaux, les paroles synchronisées, le retour micro et le suivi de justesse, entièrement en local sur votre PC.',
  'karaoke.fullscreen.enter': 'Passer en plein écran',
  'karaoke.fullscreen.exit': 'Quitter le plein écran',
  'karaoke.fullscreen.hideHeader': 'Masquer l’en-tête FluidEQ',
  'karaoke.fullscreen.showHeader': 'Afficher l’en-tête FluidEQ',
  'karaoke.actions': 'Actions du karaoké',
  'karaoke.readiness.resize':
    'Redimensionner les panneaux du micro et de justesse',
  'karaoke.empty.title': 'Votre scène est prête',
  'karaoke.empty.body':
    'Ouvrez des fichiers audio avec des paroles facultatives ou ajoutez un dossier entier. FluidEQ associe les fichiers de même nom dans une liste.',
  'karaoke.import.pending': 'Prochaine étape : importer',
  'karaoke.import.open': 'Ouvrir une chanson',
  'karaoke.import.replace': 'Remplacer la chanson',
  'karaoke.import.addFiles': 'Ajouter des fichiers',
  'karaoke.import.folder': 'Ajouter un dossier',
  'karaoke.import.clear': 'Retirer',
  'karaoke.import.loading': 'Préparation de la chanson…',
  'karaoke.import.formats':
    'Audio : MP3, WAV, OGG, Opus, FLAC, M4A ou AAC · Paroles : LRC, eLRC ou TXT UltraStar · Ajoutez aussi pochette et vidéo',
  'karaoke.import.drop': 'Déposez chansons, paroles ou dossiers ici',
  'karaoke.error.missingAudio':
    'Ajoutez un fichier audio avec ce fichier de paroles.',
  'karaoke.error.ambiguous':
    'Plusieurs associations sont possibles. Sélectionnez un fichier audio et, éventuellement, un fichier de paroles.',
  'karaoke.error.unsupported':
    'Aucun de ces fichiers n’est encore un format audio ou de paroles Karaoke pris en charge. La pochette et la vidéo ont besoin d’une chanson à côté d’elles.',
  'karaoke.error.read':
    'FluidEQ n’a pas pu lire les fichiers locaux sélectionnés.',
  'karaoke.error.playback':
    'Cette version de Chromium n’a pas pu lire ce fichier ou codec audio.',
  'karaoke.warning.lyrics': 'n’a pas pu être interprété.',
  'karaoke.warning.lyricsEmpty': 'est vide.',
  'karaoke.warning.lyricsMissingTiming':
    'ne contient aucun minutage lisible par FluidEQ.',
  'karaoke.warning.lyricsMissingBpm':
    'ne déclare aucun BPM, pourtant nécessaire à un fichier UltraStar.',
  'karaoke.warning.lyricsInvalidBpm':
    'déclare un BPM qui n’est pas un nombre exploitable.',
  'karaoke.warning.lyricsMalformedNote':
    'contient une ligne de note que FluidEQ n’a pas pu lire.',
  'karaoke.warning.lyricsUnsupportedVariant':
    'utilise une variante de karaoké que FluidEQ ne sait pas encore chanter, comme un duo.',
  'karaoke.warning.lyricsAtLine': 'Ligne {line}.',
  'karaoke.warning.lyricsAudioIntact':
    'L’audio reste disponible sans paroles synchronisées.',
  'karaoke.warning.setAside':
    'FluidEQ ne sait pas encore lire ces fichiers en karaoké ; ils ont donc été mis de côté : {formats}.',
  'karaoke.warning.unpairedLyrics':
    'Aucun fichier audio ne correspond à ces fichiers de paroles ; ils n’ont donc pas été utilisés : {files}.',
  'karaoke.warning.ambiguousLyrics':
    'Deux fichiers de paroles correspondaient à la même chanson ; aucun n’a donc été utilisé : {files}.',
  'karaoke.warning.andMore': 'et {count} de plus',
  'karaoke.countdown.sing': 'Chante',
  'karaoke.song.unknownArtist': 'Chanson locale',
  'karaoke.stage.videoUnsupported':
    'Les vidéos {format} ne peuvent pas être lues ici',
  'karaoke.stage.videoFailed': 'La vidéo {format} n’a pas pu être décodée ici',
  'karaoke.stage.hideArt': 'Masquer la pochette',
  'karaoke.stage.showArt': 'Afficher la pochette',
  'karaoke.stage.noArt': 'Ce morceau n’a pas de pochette',
  'karaoke.playlist.title': 'Liste de lecture',
  'karaoke.playlist.groupFolders': 'Regrouper par dossier',
  'karaoke.playlist.looseFiles': 'Fichiers non classés',
  'karaoke.playlist.resize': 'Redimensionner la playlist et la scène',
  'karaoke.playlist.collapse': 'Réduire la playlist',
  'karaoke.playlist.expand': 'Développer la playlist',
  'karaoke.playlist.select': 'Sélectionner {title}',
  'karaoke.playlist.moveUp': 'Monter {title}',
  'karaoke.playlist.moveDown': 'Descendre {title}',
  'karaoke.playlist.remove': 'Supprimer {title}',
  'karaoke.source.audioOnly': 'Audio uniquement',
  'karaoke.source.lrc': 'LRC · synchronisation par ligne',
  'karaoke.source.elrc': 'eLRC · synchronisation par mot',
  'karaoke.source.ultrastar': 'UltraStar · syllabes + hauteur',
  'karaoke.lyrics.none':
    'Aucune parole synchronisée sélectionnée. La lecture et l’accordeur restent disponibles.',
  'karaoke.lyrics.line': 'Ligne de paroles {number}',
  'karaoke.lyrics.previous': 'Paroles précédentes',
  'karaoke.lyrics.next': 'Paroles suivantes',
  'karaoke.lyrics.follow': 'Suivre les paroles',
  'karaoke.lyrics.textSize': 'Taille du texte des paroles',
  'karaoke.transport.title': 'Commandes de lecture Karaoke',
  'karaoke.transport.restart': 'Recommencer la chanson',
  'karaoke.transport.play': 'Lire',
  'karaoke.transport.pause': 'Pause',
  'karaoke.transport.spaceShortcut': '{action} · Espace',
  'karaoke.transport.seek': 'Position dans la chanson',
  'karaoke.transport.volume': 'Volume',
  'karaoke.transport.vocalLevel': 'Voix témoin',
  'karaoke.transport.vocalOff': 'Instrumental seul',
  'karaoke.transport.vocalFull': 'Original',
  'karaoke.transport.mixSettings': 'Réglages du mixage',
  'karaoke.transport.openMixSettings':
    'Ouvrir les réglages du mixage pour {channel}',
  'karaoke.mic.title': 'Microphone',
  'karaoke.mic.settings': 'Réglages du microphone',
  'karaoke.mic.off': 'Désactivé',
  'karaoke.mic.hint':
    'Choisissez une entrée. FluidEQ ne demande l’accès au micro que lorsque vous l’activez.',
  'karaoke.mic.select': 'Entrée microphone',
  'karaoke.mic.default': 'Par défaut du système',
  'karaoke.mic.unnamed': 'Microphone {number}',
  'karaoke.mic.turnOn': 'Activer le micro',
  'karaoke.mic.turnOff': 'Désactiver le micro',
  'karaoke.mic.requesting': 'Connexion…',
  'karaoke.mic.live': 'Actif',
  'karaoke.mic.denied': 'Autorisation refusée',
  'karaoke.mic.unavailable': 'Aucun microphone',
  'karaoke.mic.disconnected': 'Déconnecté',
  'karaoke.mic.error': 'Échec du démarrage',
  'karaoke.mic.level': 'Niveau d’entrée du microphone',
  'karaoke.mic.levelValue': 'Niveau d’entrée du microphone : {percent} %',
  'karaoke.mic.privacy':
    'Analyse locale du niveau et de la justesse uniquement. FluidEQ n’enregistre pas le micro et ne le diffuse pas dans les haut-parleurs.',
  'karaoke.mic.volume': 'Volume du micro',
  'karaoke.mic.volumeValue': 'Volume du micro : {percent} %',
  'karaoke.pitch.title': 'Suivi de justesse',
  'karaoke.pitch.resize': 'Redimensionner la piste de hauteur',
  'karaoke.pitch.show': 'Afficher le guide de hauteur',
  'karaoke.pitch.hide': 'Masquer le guide de hauteur',
  'karaoke.pitch.guide': 'Guide mélodique',
  'karaoke.pitch.toneGuide': 'Ton mélodique',
  'karaoke.pitch.toneEnable': 'Lire le ton de la mélodie',
  'karaoke.pitch.toneDisable': 'Arrêter le ton de la mélodie',
  'karaoke.pitch.toneVolume': 'Volume du ton mélodique',
  'karaoke.pitch.scrubHint':
    'Faites glisser à gauche ou à droite pour parcourir le morceau ; relâchez pour rester en pause.',
  'karaoke.pitch.viewSelector': 'Affichage de la hauteur',
  'karaoke.pitch.viewNotes': 'Notes',
  'karaoke.pitch.viewWave': 'Courbe',
  'karaoke.pitch.waveCanvas':
    'Courbe de hauteur du chanteur en temps réel sur les notes du morceau',
  'karaoke.pitch.waveSong': 'Morceau',
  'karaoke.pitch.waveVoice': 'Votre voix',
  'karaoke.pitch.waveFooter':
    'Les blocs bleus sont les notes du morceau ; la fine courbe en direct est la hauteur captée par votre micro.',
  'karaoke.pitch.review': 'Bilan de la performance',
  'karaoke.pitch.reviewCount': '{count} passages à travailler',
  'karaoke.pitch.issueHigh':
    'Hauteur trop élevée à {time}. Retravaillez ce passage.',
  'karaoke.pitch.issueLow':
    'Hauteur trop basse à {time}. Retravaillez ce passage.',
  'karaoke.pitch.issueMissed':
    'Notes manquées à {time}. Retravaillez ce passage.',
  'karaoke.practice.go': 'C’EST PARTI !',
  'karaoke.practice.ready': 'Préparez-vous à chanter de nouveau',
  'karaoke.countIn.ready': 'Préparez-vous — le morceau commence après GO',
  'karaoke.pitch.canvas': 'Piste en direct du micro et des notes cibles',
  'karaoke.pitch.micOff':
    'Activez le micro pour voir la hauteur de votre voix.',
  'karaoke.pitch.loading': 'Démarrage de l’analyse de hauteur…',
  'karaoke.pitch.unavailable':
    'L’analyse de hauteur est indisponible. Le niveau du micro fonctionne toujours.',
  'karaoke.pitch.noSignal':
    'Chantez dans le micro pour tracer la hauteur de votre voix.',
  'karaoke.pitch.empty':
    'Les notes cibles n’apparaîtront que si le morceau importé en contient réellement.',
  'karaoke.pitch.high': 'Trop haut',
  'karaoke.pitch.tuned': 'Juste',
  'karaoke.pitch.low': 'Trop bas',
  'karaoke.pitch.ultrastar':
    'Les barres bleues sont les notes cibles ; la courbe indique si votre voix est trop haute, juste ou trop basse.',
  'karaoke.chords.aria':
    'Accords de guitare estimés à partir de l’accompagnement',
  'karaoke.chords.analyzing': 'Recherche des accords… {percent} %',
  'karaoke.chords.estimate': 'Accord estimé',
  'karaoke.chords.next': 'Suivant',
  'karaoke.chords.in': 'dans {seconds} s',
  'karaoke.chords.none': 'Aucun accord stable détecté',
  'karaoke.chords.confidence': 'Fiabilité de l’estimation audio : {percent} %',
  'karaoke.maker.open': 'Créer',
  'karaoke.maker.openTitle': 'Créer ou modifier ce karaoké',
  'karaoke.maker.dialog': 'Créateur de karaoké',
  'karaoke.maker.eyebrow': 'CRÉATEUR DE KARAOKÉ FLUIDEQ',
  'karaoke.maker.close': 'Fermer le créateur',
  'karaoke.maker.exitBusy':
    'Un modèle local est encore en cours. Annulez-le ou attendez la fin avant de quitter l’éditeur.',
  'karaoke.maker.songTitle': 'Titre de la chanson',
  'karaoke.maker.untitled': 'Karaoké sans titre',
  'karaoke.maker.undo': 'Annuler',
  'karaoke.maker.redo': 'Rétablir',
  'karaoke.maker.preview': 'Aperçu · 1, 2, 3',
  'karaoke.maker.apply': 'Utiliser dans le lecteur',
  'karaoke.maker.applyHint':
    'Utilisez ces modifications dans le lecteur. Le fichier original reste inchangé ; Exporter crée un nouveau fichier.',
  'karaoke.maker.lyrics': 'Paroles',
  'karaoke.maker.toolsEdit': 'Outils d’édition',
  'karaoke.maker.toolsAnalysis': 'Outils d’analyse',
  'karaoke.maker.lyricsTiming': 'Calage des paroles',
  'karaoke.maker.timingAll': 'Chanson entière',
  'karaoke.maker.timingFromWord': 'Depuis le mot choisi',
  'karaoke.maker.timingAllHint':
    'Déplace ensemble tous les mots et toutes les notes synchronisés.',
  'karaoke.maker.timingFromWordHint':
    'Déplace « {word} » et la suite. Le calage précédent reste fixe.',
  'karaoke.maker.earlier': 'Avancer toutes les paroles',
  'karaoke.maker.later': 'Retarder toutes les paroles',
  'karaoke.maker.openProject': 'Importer un karaoké',
  'karaoke.maker.projectLoaded': 'Projet chargé. Le son actuel reste associé.',
  'karaoke.maker.karaokeImported':
    'Calage importé. Le son actuel reste associé.',
  'karaoke.maker.tapWords': 'Caler les mots',
  'karaoke.maker.recordLines': 'Enregistrer les débuts de lignes',
  'karaoke.maker.syncLinesFromHere': 'Caler les lignes à partir d’ici',
  'karaoke.maker.syncWordsFromHere': 'Caler les mots à partir d’ici',
  'karaoke.maker.syncNow': 'Maintenant',
  'karaoke.maker.syncNext': 'Suivant : {item}',
  'karaoke.maker.markLine': 'Marquer le début',
  'karaoke.maker.markLineEnd': 'Marquer la fin',
  'karaoke.maker.captureEnd': 'Écoute de la fin',
  'karaoke.maker.capturePressStart': 'Étape 1 · Entrée au DÉBUT',
  'karaoke.maker.captureReplaceStart':
    'Paroles suivantes prêtes · Entrée remplace le DÉBUT',
  'karaoke.maker.captureStartSaved':
    'Début enregistré à {time} · Entrée à la FIN',
  'karaoke.maker.captureAutomaticStart':
    'Début automatique {time} · Entrée à la FIN',
  'karaoke.maker.captureAutomaticSuggestion':
    'Début suggéré {time} · Entrée enregistre le DÉBUT',
  'karaoke.maker.captureFixEnd': 'Ligne enregistrée · Entrée corrige la FIN',
  'karaoke.maker.captureStartPoint': 'DÉBUT',
  'karaoke.maker.captureEndPoint': 'FIN',
  'karaoke.maker.captureGuideTitle': 'Calage de ligne',
  'karaoke.maker.captureSetupTitle':
    'Prêt à enregistrer le minutage des paroles ?',
  'karaoke.maker.captureSetupBody':
    'Écoutez le chanteur. Appuyez sur Entrée au début de la ligne, éventuellement sur Tab à chaque nouveau mot, puis encore sur Entrée à la fin. Le dernier mot peut ainsi garder toute sa durée.',
  'karaoke.maker.captureSetupStatus':
    'Lisez le guide dans l’aperçu en direct, puis lancez l’enregistrement.',
  'karaoke.maker.captureStartRecording': 'Démarrer l’enregistrement',
  'karaoke.maker.captureMoveGuide':
    'Faites glisser ce guide. Double-cliquez pour rétablir sa position.',
  'karaoke.maker.selectionPanel': 'Outils de sélection',
  'karaoke.maker.selectionMoveGuide':
    'Faites glisser les outils. Double-cliquez pour rétablir leur position.',
  'karaoke.maker.dismissSelection': 'Fermer les outils de sélection',
  'karaoke.maker.captureCountdownReady': 'Préparez-vous pour la première ligne',
  'karaoke.maker.captureGuideNext': 'À suivre',
  'karaoke.maker.captureGuideAudio':
    'déplace l’audio de 2 secondes · Maj : 1 seconde',
  'karaoke.maker.captureGuideLyrics': 'choisit la ligne de paroles',
  'karaoke.maker.captureGuidePlayback': 'lit ou met en pause',
  'karaoke.maker.captureGuideWords': 'marquer le mot suivant',
  'karaoke.maker.captureGuideUndo': 'annule le dernier repère',
  'karaoke.maker.stopRecording': 'Arrêter l’enregistrement',
  'karaoke.maker.markWord': 'Marquer le mot',
  'karaoke.maker.markNextWord': 'Mot suivant',
  'karaoke.maker.done': 'Terminer',
  'karaoke.maker.ignoreLine': 'Ignorer la ligne',
  'karaoke.maker.lineTimingComplete':
    'Synchronisation des lignes terminée. Prête à vérifier et à utiliser dans le lecteur.',
  'karaoke.maker.recordLinesHint':
    'ENTRÉE marque début/fin · ↑/↓ choisit la ligne · ←/→ déplace seulement l’audio de 2 s · ESPACE lit ou met en pause · Retour arrière annule',
  'karaoke.maker.panView': 'Main · déplacer la timeline',
  'karaoke.maker.panHint':
    'Outil main : faites glisser le canevas pour parcourir le morceau sans modifier.',
  'karaoke.maker.scrubHint':
    'Cliquez ou faites glisser la tête de lecture pour parcourir le morceau.',
  'karaoke.maker.addNote': 'Note',
  'karaoke.maker.selectNotes': 'Sélectionner des notes',
  'karaoke.maker.paintNotes': 'Dessiner des notes',
  'karaoke.maker.selectNotesHint':
    'Tracez un cadre autour des notes. Faites glisser une note sélectionnée pour déplacer le groupe. Maintenez Ctrl et faites-la glisser sur un mot ou une syllabe pour l’attacher.',
  'karaoke.maker.paintNotesHint':
    'Faites glisser sur la grille de hauteur pour dessiner une note. L’outil reste actif pour en ajouter plusieurs.',
  'karaoke.maker.notesSelected': 'notes sélectionnées',
  'karaoke.maker.copyNotes': 'Copier les notes sélectionnées',
  'karaoke.maker.pasteNotes': 'Coller les notes à la tête de lecture',
  'karaoke.maker.notePasted': 'Note collée à la tête de lecture.',
  'karaoke.maker.notesPasted': '{count} notes collées à la tête de lecture.',
  'karaoke.maker.attachNotesByTime': 'Attacher aux paroles',
  'karaoke.maker.detachNotes': 'Détacher des paroles',
  'karaoke.maker.noteAttachHelp':
    'Maintenez Ctrl et faites glisser une note sur un mot ou une syllabe. Une note attachée suit les paroles et reste verrouillée.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C copie la sélection · Ctrl+V colle sa première note à la tête de lecture.',
  'karaoke.maker.attachedTo': 'Attachée à « {word} »',
  'karaoke.maker.noteUnattached': 'Non attachée aux paroles',
  'karaoke.maker.splitWordSyllables': 'Diviser le mot en syllabes',
  'karaoke.maker.syllableEditorEyebrow': 'Éditeur de syllabes',
  'karaoke.maker.syllableEditorTitle': 'Diviser « {word} »',
  'karaoke.maker.syllableEditorHint':
    'Cliquez entre les lettres pour ajouter ou retirer une coupure syllabique.',
  'karaoke.maker.syllableSplitPoint': 'Basculer la coupure après « {text} »',
  'karaoke.maker.syllableEditorPreview': 'Syllabes obtenues',
  'karaoke.maker.applySyllableSplit': 'Appliquer la division',
  'karaoke.maker.hearNote': 'Écouter la note',
  'karaoke.maker.split': 'Diviser',
  'karaoke.maker.delete': 'Supprimer',
  'karaoke.maker.analyze': 'Analyser la mélodie',
  'karaoke.maker.prepare': 'Préparer le karaoké',
  'karaoke.maker.advanced': 'Avancé',
  'karaoke.maker.prepared':
    'Ce karaoké possède déjà des notes mélodiques synchronisées.',
  'karaoke.maker.repairLyrics': 'Redétecter le calage des paroles',
  'karaoke.maker.repairMelody': 'Redétecter les notes de la mélodie',
  'karaoke.maker.rebuildKaraoke': 'Reconstruire paroles + mélodie',
  'karaoke.maker.autoAlign': 'Alignement auto',
  'karaoke.maker.aiMelody': 'Mélodie par IA',
  'karaoke.maker.transcribe': 'Transcrire',
  'karaoke.maker.vocalStem': 'Utiliser la piste vocale',
  'karaoke.maker.vocalStemLoaded': 'Piste vocale chargée',
  'karaoke.maker.groupVoice': 'Voix et musique',
  'karaoke.maker.stemsTitle': 'Pistes séparées',
  'karaoke.maker.stemBacking': 'Instrumental',
  'karaoke.maker.stemSaveAs': 'Enregistrer {name} en',
  'karaoke.maker.stemSaveFormat': 'Enregistrer {name} en {format}',
  'karaoke.maker.stemMp3Encoding': 'Encodage du MP3…',
  'karaoke.maker.stemMp3Saved': 'MP3 enregistré.',
  'karaoke.maker.stemMp3Failed': 'Le MP3 n’a pas pu être encodé.',
  'karaoke.maker.stemVoice': 'Voix',
  'karaoke.maker.stemSave': 'Enregistrer',
  'karaoke.maker.groupLyrics': 'Paroles et minutage',
  'karaoke.maker.removeBackground': 'Séparer la voix de la musique',
  'karaoke.maker.removeBackgroundDone': 'Voix déjà séparée',
  'karaoke.maker.separationDownloading':
    'Téléchargement du modèle de séparation ({percent}%) · une seule fois, environ 700 Mo',
  'karaoke.maker.separationReading': 'Lecture du morceau',
  'karaoke.maker.separating': 'Séparation de la voix et de la musique',
  'karaoke.maker.separationDone':
    'Voix séparée. La détection des paroles est prête.',
  'karaoke.maker.separationSlow':
    'Pas d’accélération graphique sur cette machine : cela prendra quelques minutes au lieu de moins d’une.',
  'karaoke.maker.separationRequired':
    'Séparez d’abord la voix : la détection des paroles lit la piste vocale isolée.',
  'karaoke.maker.separationRequiredMelody':
    'Séparez d’abord la voix : la détection des notes suit une seule voix, et dans un mixage c’est généralement un instrument.',
  'karaoke.maker.wizardTitle': 'Préparer ce morceau automatiquement',
  'karaoke.maker.wizardIntro':
    'Ce morceau n’a pas encore de minutage. FluidEQ peut séparer la voix de la musique, puis en lire les mots et leur minutage. Tout s’exécute sur cet ordinateur.',
  'karaoke.maker.wizardStepSeparate': 'Séparer la voix',
  'karaoke.maker.wizardStepTranscribe': 'Lire les mots et le minutage',
  'karaoke.maker.wizardLanguage': 'Langue des paroles',
  'karaoke.maker.wizardLanguageAuto': 'Détection automatique',
  'karaoke.maker.wizardStart': 'Préparer automatiquement',
  'karaoke.maker.wizardSkip': 'Je le ferai moi-même',
  'karaoke.maker.wizardCancel': 'Arrêter',
  'karaoke.maker.wizardHide': 'Continuer en arrière-plan',
  'karaoke.maker.wizardCancelled': 'Arrêté. Ce qui est terminé a été conservé.',
  'karaoke.maker.vocalFocus': 'Centrer sur la voix',
  'karaoke.maker.export': 'Exporter',
  'karaoke.maker.exportProject': 'Projet FluidEQ',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'LRC enrichi',
  'karaoke.maker.exportInstrumental': 'Piste instrumentale (sans voix)',
  'karaoke.maker.tapHint':
    'Appuyez sur ESPACE ou ENTRÉE pour « {word} » · Retour arrière annule',
  'karaoke.maker.editHint':
    'Faites glisser les notes pour modifier hauteur/temps. Tirez un bord pour redimensionner. Ctrl + molette zoome.',
  'karaoke.maker.stats':
    '{notes} notes · {words} mots · {checks} vérifications',
  'karaoke.maker.wordStateLegend': 'État du minutage des paroles',
  'karaoke.maker.userAdjustedWords': '{count} ajustés',
  'karaoke.maker.pendingWords': '{count} en attente',
  'karaoke.maker.artist': 'Artiste',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Position dans la chanson',
  'karaoke.maker.previousView': 'Section précédente',
  'karaoke.maker.nextView': 'Section suivante',
  'karaoke.maker.resetZoom': 'Double-cliquer pour ajuster les paroles',
  'karaoke.maker.livePreview': 'Aperçu en direct',
  'karaoke.maker.showPreview': 'Afficher l’aperçu',
  'karaoke.maker.hidePreview': 'Masquer l’aperçu',
  'karaoke.maker.previewEmpty':
    'Ajoutez ou alignez des paroles minutées pour voir l’aperçu.',
  'karaoke.maker.noteNormal': 'Note',
  'karaoke.maker.noteGolden': 'Dorée',
  'karaoke.maker.noteFree': 'Libre',
  'karaoke.maker.untimed': 'Non calé',
  'karaoke.maker.applyUntimed':
    '{count} mots des paroles n’ont toujours pas de timing vocal vérifié. Détectez-les ou placez-les avant d’utiliser ce karaoké dans le lecteur.',
  'karaoke.maker.selectHint':
    'Sélectionnez une parole ou une note pour l’inspecter.',
  'karaoke.maker.rights':
    'J’ai l’autorisation d’utiliser et d’exporter ce son et ces paroles.',
  'karaoke.maker.cancel': 'Annuler',
  'karaoke.maker.localAnalysis': 'Analyse locale',
  'karaoke.maker.lyricsEyebrow': 'PAROLES',
  'karaoke.maker.lyricsTitle':
    'Collez ou modifiez une ligne de paroles par rangée',
  'karaoke.maker.lyricsWarning':
    'Remplacer le texte efface les liens de mots afin de pouvoir les recaler en toute sécurité.',
  'karaoke.maker.lyricsReferenceHint':
    'Fournissez les paroles complètes, y compris les lignes répétées et les repères comme [Couplet] ou [Refrain]. FluidEQ conserve ce texte et utilise la reconnaissance vocale locale pour trouver son calage.',
  'karaoke.maker.referenceLyrics': 'Paroles de référence',
  'karaoke.maker.wordTiming': 'Calage du mot',
  'karaoke.maker.lyricsWordCount': '{count} mots dans la référence',
  'karaoke.maker.lyricsTimedCount': '{timed} sur {total} calés',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Détectez les nouvelles paroles avant de modifier le calage des mots',
  'karaoke.maker.lyricsNoTimedWords': 'Aucun mot calé pour le moment',
  'karaoke.maker.lyricsTimingEditorHint':
    'Après la détection, sélectionnez un mot pour corriger son texte, son début ou sa durée.',
  'karaoke.maker.lyricsSelectWord':
    'Sélectionnez un mot pour modifier son calage.',
  'karaoke.maker.lyricsSelectedWord': 'Mot sélectionné',
  'karaoke.maker.lyricsWordNavigation': 'Navigation entre les mots',
  'karaoke.maker.previousWord': 'Mot précédent',
  'karaoke.maker.nextWord': 'Mot suivant',
  'karaoke.maker.lyricsPlaceholder':
    'Collez les paroles complètes ici…\n\n[Couplet]\nPremière ligne\nDeuxième ligne',
  'karaoke.maker.loadLyricsFile': 'Charger un fichier de paroles',
  'karaoke.maker.lyricsFileLoaded': 'Paroles chargées depuis {file}.',
  'karaoke.maker.lyricsRequired':
    'Ajoutez ou collez les paroles complètes avant de détecter le calage et la mélodie.',
  'karaoke.maker.detectTimingMelody': 'Détecter le calage et la mélodie',
  'karaoke.maker.acceptLyrics': 'Accepter les paroles',
  'karaoke.maker.acceptAndRecordLines': 'Accepter et enregistrer les temps',
  'karaoke.maker.continueInBackground': 'Continuer en arrière-plan',
  'karaoke.maker.clearLyrics': 'Effacer les paroles',
  'karaoke.maker.clearLyricsTitle': 'Effacer toutes les paroles ?',
  'karaoke.maker.clearLyricsBody':
    'Cela supprime toutes les paroles et leur calage. Les notes de mélodie restent, mais leurs liens avec les mots sont retirés. Une annulation reste possible.',
  'karaoke.maker.clearNotes': 'Effacer les notes',
  'karaoke.maker.clearNotesTitle': 'Effacer toutes les notes de mélodie ?',
  'karaoke.maker.clearNotesBody':
    'Cela supprime toutes les notes de mélodie en conservant les paroles et leur calage. Une annulation reste possible.',
  'karaoke.maker.notesCleared': 'Toutes les notes de mélodie ont été effacées.',
  'karaoke.maker.lyricsCleared':
    'Toutes les paroles ont été effacées. Les notes existantes ont été conservées sans lien avec les mots.',
  'karaoke.maker.restore': 'Restaurer l’original',
  'karaoke.maker.restoreTitle': 'Restaurer le karaoké d’origine ?',
  'karaoke.maker.restoreBody':
    'Cela abandonne toutes les modifications de cette session et reconstruit le karaoké tel qu’il a été importé, y compris son brouillon enregistré. Vous pourrez annuler après la restauration.',
  'karaoke.maker.restored': 'L’original importé a été restauré.',
  'karaoke.maker.replaceLyricsWarning':
    'Les mots ont changé. Leur remplacement recrée les identifiants et le calage automatique ; les corrections manuelles existantes ne peuvent pas être transférées de façon fiable. Les notes restent et seront reconnectées.',
  'karaoke.maker.replaceAndDetect': 'Remplacer et détecter',
  'karaoke.maker.wordText': 'Mot',
  'karaoke.maker.wordStart': 'Début (ms)',
  'karaoke.maker.wordPosition': 'Position',
  'karaoke.maker.wordDuration': 'Durée (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Ajuste la limite partagée : le mot voisin cède ou reçoit du temps sans modifier la plage de la ligne.',
  'karaoke.maker.usePlayhead': 'Utiliser la tête de lecture',
  'karaoke.maker.playWord': 'Lire le mot',
  'karaoke.maker.allowAutoTiming': 'Autoriser le calage automatique',
  'karaoke.maker.replaceLyrics': 'Remplacer les paroles',
  'karaoke.maker.lyricsAutoAligned':
    'Nouvelles paroles appliquées et alignées sur la mélodie disponible.',
  'karaoke.maker.lyricsNeedPreparation':
    'Nouvelles paroles appliquées. Choisissez Préparer le karaoké pour détecter leur calage.',
  'karaoke.maker.transcriptionEyebrow': 'TRANSCRIPTION LOCALE FACULTATIVE',
  'karaoke.maker.transcriptionTitle': 'Télécharger le modèle vocal local ?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ téléchargera le modèle {model} sous licence MIT depuis Hugging Face et le gardera sur ce PC — une seule fois, environ 570 Mo avec accélération graphique et environ 1,1 Go sans elle. Votre audio ne quitte jamais cet ordinateur. Le premier passage prend quelques minutes et consomme beaucoup de mémoire.',
  'karaoke.maker.transcriptionReview':
    'La reconnaissance n’est qu’un point de départ. FluidEQ conserve l’orthographe de vos paroles lors de la correspondance et tous les temps restent modifiables.',
  'karaoke.maker.notNow': 'Pas maintenant',
  'karaoke.maker.downloadTranscribe': 'Télécharger et transcrire',
  'karaoke.maker.downloadPrepare': 'Télécharger et préparer les paroles',
  'karaoke.maker.downloadingWhisper': 'Téléchargement du modèle Whisper',
  'karaoke.maker.downloadOverall': 'Téléchargement global',
  'karaoke.maker.downloadFiles': '{complete} fichiers sur {total}',
  'karaoke.maker.loadingWhisper': 'Chargement du modèle Whisper',
  'karaoke.maker.analysisRunning': 'Analyse locale de la hauteur',
  'karaoke.maker.analysisAligned':
    '{count} régions de notes détectées ont été alignées avec les mots non modifiés. Le minutage manuel a été conservé.',
  'karaoke.maker.analysisFound': 'L’analyse a trouvé {count} régions de notes.',
  'karaoke.maker.basicPitchRunning': 'Détection des notes de la mélodie',
  'karaoke.maker.basicPitchFound':
    '{count} notes de mélodie modifiables détectées depuis la voix.',
  'karaoke.maker.whisperPreparing': 'Préparation de Whisper',
  'karaoke.maker.whisperDecoding': 'Décodage local de l’audio',
  'karaoke.maker.whisperTranscribing': 'Transcription locale',
  'karaoke.maker.whisperTranscribingProgress':
    'Détection du minutage · passe {pass}/{passes} · bloc {chunk}/{chunks}',
  'karaoke.maker.whisperAligning': 'Ajustement des paroles au chant',
  'karaoke.maker.whisperComplete': 'Transcription terminée',
  'karaoke.maker.whisperMatched':
    'Whisper a associé {count} mots reconnus. Vérifiez leur minutage modifiable avant l’exportation.',
  'karaoke.maker.autoAlignComplete':
    'Les paroles non modifiées ont été alignées avec la mélodie détectée. Le minutage manuel a été conservé.',
  'karaoke.maker.speechMemory': 'Mémoire des modèles IA',
  'karaoke.maker.speechMemoryReady': 'Prêt en mémoire vive',
  'karaoke.maker.speechMemoryCached': 'En cache sur le disque',
  'karaoke.maker.speechMemoryMissing': 'Non téléchargé',
  'karaoke.maker.modelWhisper': 'Voix (Whisper)',
  'karaoke.maker.modelPitch': 'Hauteur (RMVPE)',
  'karaoke.maker.modelSeparation': 'Séparation (RoFormer)',
  'karaoke.maker.freeMemory': 'Libérer la mémoire vive',
  'karaoke.maker.memoryReleased':
    'Le modèle vocal a été retiré de la mémoire vive. Ses fichiers téléchargés restent en cache.',
  'karaoke.maker.memoryReleaseBusy':
    'Le modèle vocal est occupé et ne peut pas encore être libéré.',
  'karaoke.maker.memoryAfterUse': 'Lorsqu’il est inactif',
  'karaoke.maker.memoryPolicy.ask': 'Me demander',
  'karaoke.maker.memoryPolicy.auto': 'Libérer automatiquement',
  'karaoke.maker.memoryPolicy.keep': 'Garder chargé',
  'karaoke.maker.memoryAfter': 'Après',
  'karaoke.maker.memoryMinutes': '{count} min',
  'karaoke.maker.memoryPromptTitle': 'Libérer la mémoire du modèle vocal ?',
  'karaoke.maker.memoryPromptBody':
    'Le modèle vocal local est inactif. Le libérer économise la mémoire vive ; ses fichiers restent en cache pour un rechargement plus rapide.',
  'karaoke.maker.keepLoaded': 'Garder chargé',
  'karaoke.maker.exported': '{file} a été exporté',
  'karaoke.maker.exportedPartialLrc':
    '{file} a été exporté, sans {lines} lignes de paroles : le LRC exige un timing sur la ligne ou sur l’un de ses mots, et celles-ci n’en ont aucun. Chronométrez-les dans le Créateur, puis exportez de nouveau pour obtenir un fichier complet.',
  'karaoke.maker.exportedPartialUltraStar':
    '{file} a été exporté, sans {words} mots des paroles : UltraStar ne retient un mot que là où la mélodie a une note, et ceux-ci n’en ont aucune. Détectez ou tracez leurs notes, puis exportez de nouveau pour obtenir un fichier complet.',
  'karaoke.maker.exportFallback': 'fichier de karaoké',
  'karaoke.maker.projectTooLarge': 'Le projet dépasse 16 Mo.',
  'karaoke.maker.previewResize': 'Redimensionner l’aperçu en direct',
  'karaoke.maker.seekBack': 'Reculer de {seconds} secondes',
  'karaoke.maker.seekForward': 'Avancer de {seconds} secondes',
  'karaoke.maker.jumpToStart': 'Aller au début du morceau',
  'karaoke.maker.jumpToEnd': 'Aller à la fin du morceau',
  'karaoke.maker.errorAudioLimits':
    'L’analyse locale accepte les fichiers audio jusqu’à 1 Go et les enregistrements de moins de 30 minutes.',
  'karaoke.maker.errorComponentUnavailable':
    'Un composant requis pour l’analyse locale est indisponible. Redémarrez FluidEQ et réessayez.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ n’a pas pu analyser cet audio localement.',
  'karaoke.maker.errorExportNeedsNotes':
    'L’exportation UltraStar nécessite au moins une note mélodique.',
  'karaoke.maker.errorExport': 'FluidEQ n’a pas pu exporter ce karaoké.',
  'karaoke.maker.errorProjectVersion':
    'Ce projet a été créé avec une version de FluidEQ non prise en charge.',
  'karaoke.maker.errorImport':
    'FluidEQ n’a pas pu importer ce karaoké ou ce projet.',
  'karaoke.maker.errorParse':
    'Le fichier de paroles ou de karaoké sélectionné n’a pas pu être interprété.',
  'karaoke.maker.downloadFailed': 'Échec du téléchargement du modèle Whisper',
  'karaoke.maker.localAnalysisFailed': 'Échec de l’analyse locale',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ n’a pas pu télécharger le modèle depuis Hugging Face. Vérifiez la connexion ou le pare-feu, puis réessayez.',
  'karaoke.maker.tryAgain': 'Réessayer',
  'karaoke.maker.dismiss': 'Fermer l’erreur',
  'karaoke.maker.analysisSource':
    '« {file} » est utilisé uniquement comme source d’analyse locale.',
  'karaoke.maker.rightsRequired':
    'Confirmez que vous détenez les droits sur le son et les paroles avant de publier un export.',
  'karaoke.maker.draftRestored': 'Brouillon restauré',
  'karaoke.maker.playerTimingLoaded':
    'Le minutage actuel du lecteur est utilisé. Annuler restaure le brouillon enregistré.',

  'karaoke.translation.picker': 'Langue des paroles',
  'karaoke.translation.original': 'Telles qu’enregistrées',
  'karaoke.translation.add': 'Ajouter une langue',
  'karaoke.translation.remove': 'Supprimer cette langue',
  'karaoke.translation.target': 'Langue des paroles que vous collez',
  'karaoke.translation.paste':
    'Collez les paroles dans cette langue, une ligne par ligne de la chanson.',
  'karaoke.translation.mismatch':
    'La chanson comporte {expected} lignes chantées et ce texte en a {received}. Alignez-les sur les lignes numérotées à côté de la zone de texte.',
  'karaoke.translation.fit': '{syllables} syllabes, {notes} notes',
  'karaoke.translation.fitOk': 'Correspond à la mélodie',
  'karaoke.translation.empty': 'Pas encore de paroles dans cette langue.',
  'karaoke.translation.exportLanguage':
    'Les fichiers de paroles seront écrits en {language}.',
};

export default karaoke;
