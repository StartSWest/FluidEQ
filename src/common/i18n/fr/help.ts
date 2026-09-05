/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.share.title': 'Partagez l’audio entre ordinateurs',
  'help.share.intro':
    'Partager l’audio transmet le son système entre ordinateurs du même réseau privé. Le récepteur porte le casque ou les enceintes ; les autres émettent. Cela diffère d’une seconde sortie sur le même ordinateur.',
  'help.share.steps':
    'Sur le poste d’écoute, ouvrez Partager l’audio, choisissez lire sur cet ordinateur et créez un code. Commencez à faible volume.\nSur chaque source, choisissez envoyer depuis cet ordinateur, collez le code du récepteur et connectez-vous. Gardez FluidEQ ouvert des deux côtés.\nVérifiez le moniteur et arrêtez émission ou écoute en terminant. En cas d’échec, vérifiez réseau privé commun et pare-feu.',
  'help.share.tip':
    'Le code autorise l’association : gardez-le privé. Plusieurs émetteurs se mélangent et peuvent augmenter le niveau. L’audio reçu contourne le rack DSP de Bibliothèque.',
  'help.menu': 'Aide',
  'help.title': 'Guide utilisateur',
  'help.subtitle': 'Trouvez votre son. Prenez vos marques.',
  'help.intro':
    'Un guide pratique de FluidEQ illustré de captures réelles. Commencez par une première écoute, puis explorez chaque espace à votre rythme.',
  'help.offline': 'Disponible hors ligne',
  'help.search': 'Rechercher dans le guide',
  'help.searchHint': 'Essayez profils, basses, paroles…',
  'help.contents': 'Dans ce guide',
  'help.results': '{count} chapitres',
  'help.empty':
    'Aucun chapitre trouvé. Essayez une expression plus courte ou effacez la recherche.',
  'help.clear': 'Effacer la recherche',
  'help.close': 'Fermer le guide',
  'help.enlarge': 'Agrandir la capture : {title}',
  'help.closeImage': 'Fermer la capture',
  'help.captureNote':
    'Captures réelles de FluidEQ 1.6.x. Les couleurs, libellés et positions peuvent varier selon votre version. Les réglages illustrent les fonctions ; ce ne sont pas des préréglages recommandés.',
  'help.steps': 'À essayer',
  'help.tip': 'Bon à savoir',
  'help.back': 'Revenir en haut',
  'help.start.title': 'Vos cinq premières minutes',
  'help.start.intro':
    'Commencez avec un morceau familier et un volume confortable. À gauche : EQ système et marge ; au centre : espace de travail ; à droite : sortie et profils. Le transport reste en bas.',
  'help.start.steps':
    'Sous Windows, installez Equalizer APO lorsque proposé, cochez votre appareil dans son sélecteur et redémarrez si demandé.\nChoisissez le même périphérique de sortie. Activez EQ système et laissez la normalisation automatique activée.\nLancez un morceau, ouvrez EQ → Bandes, faites une petite modification et comparez en activant puis désactivant EQ système.',
  'help.start.tip':
    'L’EQ système nécessite Windows et Equalizer APO. macOS et Linux utilisent des sorties de démonstration : un graphique animé ne prouve pas le traitement du son système.',
  'help.eq.title': 'Façonnez votre son avec EQ',
  'help.eq.intro':
    'Fréquence détermine où agit une bande ; Gain, son amplification ou atténuation ; Q, sa largeur : un Q élevé est plus étroit. Les graves donnent du corps, les médiums portent la voix et les aigus apportent de la brillance.',
  'help.eq.steps':
    'Sélectionnez une bande dans EQ → Bandes. Réglez fréquence, gain et Q ou déplacez son point sur le graphique.\nCommencez par une bande large et légère. Comparez avant d’en ajouter une autre ; le sélecteur change la forme du filtre.\nComparez les couches casque, EQ, voicing et Smart EQ avec leurs interrupteurs et intensités. Gardez la normalisation lors des amplifications.',
  'help.eq.tip':
    'La courbe décrit les filtres ; le spectre animé, le signal mesuré. Smart EQ a besoin d’audio. Detail, Balance et Target corrigent différents aspects : comparez un mode à la fois.',
  'help.headphones.title': 'Correction casque et importation',
  'help.headphones.intro':
    'Une correction compense un modèle mesuré et se combine avec vos bandes. Vérifiez le modèle exact et l’auteur de la mesure.',
  'help.headphones.steps':
    'Ouvrez EQ → Préréglages EQ, cherchez votre casque et choisissez la mesure correspondante.\nPour du texte d’un autre outil, utilisez Importer les réglages EQ dans Actions audio. Vérifiez bandes et courbe.\nDans Squiglink, exportez le texte EQ, collez-le dans le panneau et appliquez après vérification de l’aperçu.',
  'help.headphones.tip':
    'Un aperçu non appliqué ne change pas le son. Évitez de cumuler accidentellement deux corrections complètes du même casque.',
  'help.convolution.title': 'Utilisez une réponse impulsionnelle',
  'help.convolution.intro':
    'Convolution applique une impulsion WAV comme couche séparée. Cherchez dans le catalogue AutoEq ou importez votre WAV ; les bandes paramétriques restent indépendantes.',
  'help.convolution.steps':
    'Ouvrez EQ → Convolution et recherchez modèle ou auteur.\nVérifiez source et fréquence d’échantillonnage, puis Téléchargez et appliquez ou Importez un WAV.\nComparez la couche activée et désactivée, puis réglez son intensité.',
  'help.convolution.tip':
    'Pour Equalizer APO, la fréquence de l’impulsion doit correspondre à la sortie. Le téléchargement du catalogue exige internet ; ce guide non.',
  'help.profiles.title': 'Appareils, profils et seconde sortie',
  'help.profiles.intro':
    'L’EQ suit votre sortie. Le mappage automatique enregistre les modifications sur l’appareil courant ; les profils nommés conservent des alternatives. Seconde sortie duplique le son avec un niveau par appareil.',
  'help.profiles.steps':
    'Vérifiez la sortie avant modification. Nouveau profil conserve un son ; Mettre à jour enregistre les changements et Restaurer récupère les réglages sauvegardés.\nOuvrez Seconde sortie, activez un appareil accessible et réglez son niveau. Dans les versions actuelles, choisissez son profil EQ juste dessous.\nJeu/Vidéo réduit la réserve initiale ; Musique en garde davantage. Vérifiez la synchronisation réelle.',
  'help.profiles.tip':
    'Chaque sortie Windows dupliquée utilise son propre profil APO. FluidEQ doit rester ouvert ; changer la sortie principale arrête les anciennes duplications. La latence des appareils compte aussi.',
  'help.config.title': 'Inspectez et sauvegardez une chaîne',
  'help.config.intro':
    'EQ → Config montre ce qu’Equalizer APO possède réellement sur disque. Les sorties et l’arbre d’inclusions identifient appareils et couches. Exportez avant une grande expérience.',
  'help.config.steps':
    'Ouvrez EQ → Config, choisissez la sortie et vérifiez état et couches.\nUtilisez Exporter la chaîne pour sauvegarder un fichier .fluideq.\nPour le récupérer, choisissez d’abord la bonne sortie, importez la chaîne et vérifiez le résultat.',
  'help.config.tip':
    'Les fichiers générés sont réécrits lors des changements. Placez les commandes APO durables dans le fichier personnalisé de la sortie que FluidEQ préserve.',
  'help.online.title': 'Écoutez avec Médias en ligne',
  'help.online.intro':
    'Médias en ligne place les sites compatibles près de l’EQ. Lecture et connexion dépendent du fournisseur et d’internet. Le transport inférieur suit le lecteur actif.',
  'help.online.steps':
    'Ouvrez Médias en ligne, choisissez un site et lancez quelque chose sur la page.\nPassez à EQ pour régler en écoutant, puis revenez aux commandes propres à la page.\nActivez Un lecteur à la fois pour éviter les lectures superposées.',
  'help.online.tip':
    'Le rack DSP traite les pistes audio de Bibliothèque, pas Médias en ligne. Sous Windows, l’EQ système peut toujours agir sur la sortie compatible APO.',
  'help.library.title': 'Constituez votre bibliothèque locale',
  'help.library.intro':
    'Bibliothèque rassemble musique et vidéos de vos disques par albums, artistes, morceaux, dossiers ou vidéos. Pochettes et métadonnées viennent des fichiers.',
  'help.library.steps':
    'Ouvrez Bibliothèque et ajoutez votre dossier multimédia. Attendez la fin de l’indexation.\nChoisissez un artiste ou album, ou recherchez un morceau et lancez-le.\nUtilisez le transport inférieur pour pause, recherche, saut et volume depuis chaque onglet.',
  'help.library.tip':
    'Les fichiers originaux doivent rester accessibles. Rebranchez un disque déconnecté ou ajoutez le nouvel emplacement d’un dossier déplacé.',
  'help.queue.title': 'Albums et file de lecture',
  'help.queue.intro':
    'La file définit l’ordre d’écoute. Ouvrir un autre album permet de parcourir sans remplacer le morceau courant. Le morceau actif et À suivre vous situent.',
  'help.queue.steps':
    'Ouvrez un album et lancez le morceau voulu.\nDans le menu d’un morceau, choisissez lire ensuite ou ajouter à la file.\nVérifiez À suivre et utilisez aléatoire ou répétition selon vos envies.',
  'help.queue.tip':
    'Démarrer Bibliothèque prend le relais des autres lecteurs FluidEQ. Le transport indique le morceau et la source actifs.',
  'help.dsp.title': 'Explorez le rack DSP',
  'help.dsp.intro':
    'DSP traite uniquement les pistes audio de Bibliothèque. Karaoke, vidéos, audio partagé reçu et autres applications le contournent. Il comprend Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Maximizer et Master.',
  'help.dsp.steps':
    'Lancez une piste audio de Bibliothèque, ouvrez DSP et activez le rack. Commencez par un préréglage ou un étage.\nChangez un contrôle et comparez en désactivant l’étage à volume similaire.\nSurveillez les niveaux et sauvegardez le rack. Exporter et Importer échangent des racks complets.',
  'help.dsp.tip':
    'Equaliser DSP et EQ système sont deux étages distincts pouvant agir ensemble sous Windows. Comparez à volume similaire pour juger le timbre.',
  'help.denoise.title': 'Réduction du bruit et analyse',
  'help.denoise.intro':
    'Denoise réduit le bruit de l’audio de Bibliothèque. Le graphique aide à comprendre sa réponse. Une réduction excessive peut effacer des détails ou créer du pompage.',
  'help.denoise.steps':
    'Lancez une piste bruitée de Bibliothèque et sélectionnez Denoise dans DSP.\nActivez une réduction légère et écoutez les passages calmes et les détails.\nAugmentez progressivement et comparez avec l’étage désactivé.',
  'help.denoise.tip':
    'Ce n’est pas un nettoyage du micro ni de Médias en ligne. Sans changement, vérifiez que la source est une piste audio de Bibliothèque et que rack et étage sont actifs.',
  'help.visuals.title': 'Personnalisez le lecteur',
  'help.visuals.intro':
    'Courbe, spectre et vumètre montrent des aspects différents. Les formes, palettes et crêtes du visualiseur changent l’apparence sans modifier l’EQ.',
  'help.visuals.steps':
    'Activez Graphique de réponse à gauche et choisissez sa taille dans Vue.\nChoisissez une forme et ouvrez Nouveau style pour couleurs, remplissage, éclat, espacement et crêtes. Enregistrez un nom.\nDans Actions audio, choisissez thème ou langue. Ctrl + plus, moins ou 0 agrandit, réduit ou réinitialise le zoom.',
  'help.visuals.tip':
    'Un spectre animé ne prouve pas que l’EQ atteint l’appareil. Comparez à l’oreille et vérifiez l’état de la sortie.',
  'help.karaoke.title': 'Chantez avec Karaoke',
  'help.karaoke.intro':
    'Karaoke associe audio et paroles locales. Les paroles synchronisées suivent la lecture ; les cibles de hauteur exigent des notes. Un micro configuré ajoute votre hauteur en direct.',
  'help.karaoke.steps':
    'Ouvrez Karaoke et ajoutez fichiers ou dossier contenant audio et paroles correspondantes.\nChoisissez un morceau, lancez-le et vérifiez l’association.\nConfigurez le micro, ajustez la taille des paroles et utilisez le plein écran de la scène.',
  'help.karaoke.tip':
    'Un fichier contenant seulement des paroles n’a pas de notes cibles. Leur absence ne prouve pas une panne du micro.',
  'help.maker.title': 'Créez dans Karaoke Maker',
  'help.maker.intro':
    'Maker transforme l’audio en projet modifiable avec paroles et notes sur la timeline. Vérifiez toujours les mots et les temps générés automatiquement.',
  'help.maker.steps':
    'Ouvrez Créer depuis Karaoke et chargez l’audio. Choisissez les outils de séparation ou transcription nécessaires.\nSuivez la progression ; la première utilisation de l’IA peut télécharger des modèles. Vérifiez paroles et notes.\nÉcoutez de courts passages, corrigez texte et temps, sauvegardez le projet puis exportez les fichiers.',
  'help.maker.tip':
    'Les modèles nécessitent connexion et espace disque. La durée dépend du matériel et du morceau. Utilisez de l’audio autorisé et vérifiez avant de partager.',
  'help.trouble.title': 'Quand le son ne va pas',
  'help.trouble.intro':
    'Commencez par source et sortie, puis isolez les couches. Un graphique ou interrupteur ne prouve pas le trajet du son. Aide mène au dépannage audio et aux signalements.',
  'help.trouble.steps':
    'Aucun son : vérifiez lecture, sortie, volume et connexion. Un lecteur à la fois a pu mettre une autre source en pause.\nAucun effet EQ : vérifiez EQ système et le périphérique dans Equalizer APO. Utilisez Résoudre les problèmes audio ; les redémarrages interrompent le son.\nDistorsion ou basses excessives : gardez la normalisation, réduisez les amplifications et désactivez les couches une à une. Si cela persiste, relisez le rapport avant envoi.',
  'help.trouble.tip':
    'F1 ouvre le guide. Échap ferme d’abord la capture agrandie, puis le guide. Ctrl + 0 réinitialise le zoom. Testez DSP avec une piste audio de Bibliothèque.',
};

export default help;
