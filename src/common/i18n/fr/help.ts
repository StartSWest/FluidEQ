/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Aide',
  'help.title': 'Guide utilisateur',
  'help.subtitle': 'Trouvez votre son. Prenez vos marques.',
  'help.intro':
    'Un guide pratique de FluidEQ illustré de captures réelles. Commencez par une première écoute, puis explorez chaque partie de l’application à votre rythme.',
  'help.offline': 'Disponible hors ligne',
  'help.search': 'Rechercher dans le guide',
  'help.searchHint': 'Essayez moteur, basses, visualiseur…',
  'help.contents': 'Dans ce guide',
  'help.results': '{count} chapitres',
  'help.empty':
    'Aucun chapitre trouvé. Essayez une expression plus courte ou effacez la recherche.',
  'help.clear': 'Effacer la recherche',
  'help.close': 'Fermer le guide',
  'help.enlarge': 'Agrandir la capture : {title}',
  'help.closeImage': 'Fermer la capture',
  'help.controlsOf': 'Ce que fait chaque commande : {title}',
  'help.captureNote':
    'Captures réelles de FluidEQ, versions 1.6 et 1.7. Les couleurs, libellés et positions des commandes peuvent varier selon votre version. Les réglages illustrent les fonctions ; ce ne sont pas des préréglages recommandés.',
  'help.steps': 'À essayer',
  'help.tip': 'Bon à savoir',
  'help.back': 'Revenir en haut',

  'help.group.start': 'Premiers pas',
  'help.group.sound': 'Façonnez votre son',
  'help.group.visuals': 'Voyez votre musique',
  'help.group.plus': 'FluidEQ Plus',
  'help.group.listen': 'Écoutez, chantez et partagez',
  'help.group.help': 'Quand vous avez besoin d’aide',

  'help.start.title': 'Vos cinq premières minutes',
  'help.start.intro':
    'Commencez avec un morceau familier à un volume confortable. La colonne de gauche active FluidEQ et contient le préampli ; le centre est votre espace de travail ; la colonne de droite suit votre sortie et ses profils. La barre en bas de la fenêtre contrôle tout ce qui est en lecture.',
  'help.start.steps':
    'Installez FluidEQ et gardez le moteur FluidEQ sélectionné quand l’installation demande comment traiter votre son. Windows demande une autorisation une seule fois, sans redémarrage.\nChoisissez votre appareil d’écoute sous Périphérique de sortie. Activez l’Égaliseur système et laissez la Normalisation auto activée.\nLancez un morceau, ouvrez Égaliseur → Bandes, faites une petite modification et comparez en désactivant puis en réactivant l’Égaliseur système.',
  'help.start.tip':
    'L’EQ système nécessite Windows et un moteur audio : le moteur FluidEQ ou Equalizer APO. Sous macOS et Linux, l’application affiche des sorties de démonstration : un graphique animé n’y prouve donc aucun traitement.',

  'help.window.title': 'Se repérer dans la fenêtre',
  'help.window.intro':
    'L’en-tête vous fait passer d’une page de FluidEQ à l’autre et montre le son en direct. La colonne de gauche contient l’interrupteur général de l’EQ, le préampli et l’indicateur de niveau ; la colonne de droite suit votre sortie et ses profils.',
  'help.window.steps':
    'Appuyez sur une page dans l’en-tête : Médias en ligne, Partager l’audio et Égaliseur avant le signal ; DSP, Bibliothèque, Karaoké et Plus après.\nActivez l’Égaliseur système dans la colonne de gauche et laissez la Normalisation auto activée, pour qu’aucune amplification ne sature.\nAppuyez sur le signal ou sur l’indicateur de niveau pour changer la façon dont il est dessiné, et sur Mode arc-en-ciel pour que les courbes et les vumètres bougent à la pleine fréquence de votre écran.',
  'help.window.tip':
    'Le menu Aide mène à ce guide, à Nouveautés, au dépannage audio et à Signaler un problème. Le bouton d’impulsion, juste à côté, contient la carte du moteur, l’importation de réglages d’égalisation ou d’une réponse impulsionnelle, le redémarrage de l’audio de Windows, et Processus, qui montre ce que chaque partie de FluidEQ utilise.',
  'help.window.headerLeftCaption': 'L’en-tête, jusqu’au signal',
  'help.window.headerRightCaption': 'L’en-tête, après le signal',
  'help.window.railCaption': 'La colonne de gauche',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch et Suno, lus dans FluidEQ à travers votre EQ.',
  'help.window.share':
    'Envoie le son de cet ordinateur vers un autre, ou lit ici celui d’un autre.',
  'help.window.eq':
    'Vos bandes, vos préréglages, la correction du casque, les préréglages de jeu et la config du moteur.',
  'help.window.waveName': 'Signal audio',
  'help.window.wave':
    'Ce qui est en lecture, en direct. Appuyez dessus pour changer la façon dont il est dessiné.',
  'help.window.rainbow':
    'Colore la fenêtre et dessine les courbes et les vumètres à la pleine fréquence de votre écran.',
  'help.window.dsp':
    'Le rack d’effets : les préréglages, la Salle et chaque étage de la chaîne.',
  'help.window.library':
    'Vos fichiers musicaux, vos albums et votre file de lecture.',
  'help.window.karaoke':
    'Chantez en suivant les paroles, et transformez vos propres chansons en karaoké.',
  'help.window.plus':
    'Les visualiseurs, la galerie, le classement et le Studio.',
  'help.window.support': 'Des façons de soutenir le travail sur FluidEQ.',
  'help.window.help':
    'Ce guide, Nouveautés, le dépannage audio et Signaler un problème.',
  'help.window.actions':
    'Le moteur, l’importation de réglages d’égalisation, le redémarrage de l’audio de Windows et Processus.',
  'help.window.systemEq':
    'Active ou désactive le traitement de FluidEQ pour tout ce que joue le PC.',
  'help.window.preamp':
    'Baisse le niveau avant l’EQ pour que les amplifications aient de la marge. La Normalisation auto le règle pour vous.',
  'help.window.autoNormalize':
    'Garde le préampli juste assez bas pour que rien de ce que vous amplifiez ne sature.',
  'help.window.responseGraph': 'Affiche ou masque le graphique sous la page.',
  'help.window.meterName': 'Indicateur de niveau',
  'help.window.meter':
    'Le niveau de sortie des canaux gauche et droit, en décibels réels. Appuyez dessus pour changer son style.',

  'help.requirements.title': 'Ce qu’il faut à votre PC',
  'help.requirements.intro':
    'FluidEQ fonctionne sur n’importe quel PC Windows des dix dernières années. Deux parties demandent davantage : les visualiseurs Plus dessinent sur la carte graphique, et le karaoké par IA télécharge ses modèles à la première utilisation.',
  'help.requirements.steps':
    'Vérifiez votre Windows : Windows 10 version 1803 ou ultérieure, ou Windows 11, en 64 bits, 4 Go de mémoire et environ 600 Mo de disque. Traiter tout ce que joue le PC demande le moteur FluidEQ ou Equalizer APO, et Windows demande l’autorisation une fois pendant l’installation.\nOuvrez un visualiseur : n’importe quelle carte graphique ou graphique intégré à partir de 2013. En 1080p, le graphique intégré suffit ; pour la 4K, ou un fond d’écran sur plusieurs écrans à la fois, une carte dédiée vaut mieux. Quand la carte est chargée, FluidEQ dessine la scène plus petite et libère celles que vous ne voyez pas.\nEssayez le karaoké par IA : séparer la voix télécharge un modèle de 713 Mo la première fois, celui de la justesse ajoute environ 180 Mo et la suppression du bruit 11 Mo. Avec une carte graphique DirectX 12, un morceau de quatre minutes se sépare en une demi-minute environ ; avec le processeur seul, il faut environ quatre minutes. Gardez 2 Go de mémoire libres pendant ce travail.\nVisez ceci si vous le pouvez : Windows 11, 8 Go de mémoire, une carte graphique à partir de 2018 et 3 Go de disque libres si vous utilisez les fonctions par IA.',
  'help.requirements.tip':
    'Tout sauf les modèles d’IA se trouve dans l’installateur ; ceux-ci ne se téléchargent qu’à la première utilisation de la fonction. Processus, dans le menu d’actions, montre ce que chaque partie de FluidEQ utilise sur votre machine en ce moment.',

  'help.engine.title': 'Le moteur FluidEQ',
  'help.engine.intro':
    'FluidEQ traite votre son avec son propre moteur ou avec Equalizer APO. Le moteur FluidEQ tourne dans le service audio de Windows, après les effets de votre carte son, applique votre EQ et le rack DSP à tout ce que joue le PC, et s’efface dès que FluidEQ se ferme.',
  'help.engine.steps':
    'Ouvrez le menu des actions — le bouton d’impulsion en haut à droite — puis cliquez sur la carte du moteur, tout en haut.\nChoisissez Moteur FluidEQ et appuyez sur Appliquer. Windows demande une autorisation, et le son se coupe quelques secondes, le temps que l’audio redémarre.\nSi une sortie affiche DÉSACT., appuyez sur Activer dans son avis. Si un avis indique que le moteur ne tourne pas, appuyez sur Redémarrer l’audio de Windows.',
  'help.engine.tip':
    'Equalizer APO reste disponible pour les commandes APO personnalisées, Peace et les plugins VST. Quand une mise à jour apporte un moteur plus récent, un avis propose Mettre à jour le moteur. Quitter FluidEQ depuis la zone de notification désactive l’EQ sur toutes les sorties.',
  'help.engine.fluid':
    'Recommandé. Les effets de votre carte son continuent de fonctionner, et l’EQ et le rack DSP atteignent toutes les applications.',
  'help.engine.apo':
    'Exécute les commandes APO personnalisées, Peace et les plugins VST. Le rack DSP reste limité à la lecture de la Bibliothèque.',
  'help.engine.apply':
    'Change de moteur. Windows demande une autorisation une fois, et l’audio redémarre en quelques secondes.',

  'help.eq.title': 'Façonnez votre son avec l’Égaliseur',
  'help.eq.intro':
    'Fréquence détermine où agit une bande ; Gain, son amplification ou atténuation ; Q, sa largeur : un Q élevé est plus étroit. Sans bande sélectionnée, Graves, Médiums et Aigus déplacent toute la courbe à la fois. Commencez par de petites corrections larges et comparez souvent.',
  'help.eq.steps':
    'Ouvrez Égaliseur → Bandes. Sans bande sélectionnée, tournez Graves, Médiums ou Aigus pour changer rapidement la tonalité.\nCliquez sur la fréquence d’une bande, ou sur son point dans le graphique, pour la sélectionner. Tournez ses boutons Fréquence, Gain et Facteur Q, choisissez un Filtre, ou désactivez-la avec Active.\nFaites un clic droit sur une bande pour la réinitialiser, la désactiver ou ajouter une bande à côté. Appuyez sur Vider l’égaliseur pour mettre chaque gain à 0 dB tout en gardant vos bandes. Une confirmation est d’abord demandée.',
  'help.eq.tip':
    'Également appliqué montre les couches qui façonnent cette sortie en plus de vos bandes, chacune avec sa propre intensité et son ×. Mode jeu réduit la latence qu’ajoute FluidEQ, pour les jeux et les appels ; les préréglages Jeux l’activent.',
  'help.eq.bandsCaption': 'La page Bandes, sans sélection',
  'help.eq.bandCaption': 'Une bande sélectionnée',
  'help.eq.gameMode':
    'Réduit la latence qu’ajoute FluidEQ, pour les jeux et les appels. Les préréglages Jeux l’activent.',
  'help.eq.layers':
    'Les autres couches qui façonnent cette sortie — une correction du casque, l’Égalisation auto, une convolution — chacune avec son intensité, son interrupteur et son ×.',
  'help.eq.bandName': 'Une bande',
  'help.eq.band':
    'Faites glisser son point pour amplifier ou atténuer. Cliquez sur sa fréquence pour la sélectionner.',
  'help.eq.bass': 'Relève ou abaisse les graves de toute la courbe.',
  'help.eq.mid': 'Relève ou abaisse les médiums, là où se placent les voix.',
  'help.eq.treble': 'Relève ou abaisse les aigus, l’air et le détail.',
  'help.eq.selected':
    'La bande en cours de modification. Cliquez en maintenant Ctrl ou Maj pour en sélectionner plusieurs.',
  'help.eq.filter':
    'Sa forme : Cloche, Shelf grave, Shelf aigu, Coupe-bande, Passe-bas, Passe-haut ou Passe-bande.',
  'help.eq.voicing':
    'Une chaîne toute prête pour le son, comme Musique ou un genre. Aucun ne laisse que vos bandes.',
  'help.eq.smart':
    'Écoute ce qui joue et le corrige : Détail, Équilibre ou Cible.',
  'help.eq.clear':
    'Met chaque gain à 0 dB et garde vos bandes. Demande d’abord confirmation.',
  'help.eq.mode':
    'L’intensité de votre EQ et de vos courbes, le Q des bandes et la phase.',
  'help.eq.add': 'Ajoute une bande à côté de celle sélectionnée.',
  'help.eq.layouts':
    'Les nombres de bandes, et les dispositions de bandes que vous avez enregistrées.',
  'help.eq.frequency': 'Où agit la bande sélectionnée, de 1 Hz à 20 kHz.',
  'help.eq.gain':
    'De combien elle amplifie ou atténue. Ctrl+clic la ramène à 0 dB.',
  'help.eq.q': 'Sa largeur : plus le Q est élevé, plus la bande est étroite.',
  'help.eq.delete':
    'Appuyez deux fois pour supprimer la bande ; Garder annule la suppression.',
  'help.eq.menuCaption': 'Le menu contextuel d’une bande',
  'help.eq.reset': 'Remet le gain à 0 dB et le Q à 2.',
  'help.eq.disable': 'Retire la bande du son et conserve ses réglages.',
  'help.eq.addLeft': 'Ajoute une bande à mi-chemin de sa voisine plus grave.',
  'help.eq.addRight': 'Ajoute une bande à mi-chemin de sa voisine plus aiguë.',

  'help.eqmode.title': 'Mode EQ et dispositions de bandes',
  'help.eqmode.intro':
    'Mode EQ change la façon dont vos bandes et vos courbes de correction sont appliquées, sans les modifier. Les dispositions de bandes conservent les fréquences et le Q d’un agencement qui vous plaît, prêtes pour n’importe quelle sortie.',
  'help.eqmode.steps':
    'Ouvrez Mode EQ dans la barre d’outils de la page Bandes. Essayez un choix d’Intensité, de Q des bandes ou de Lissage des courbes pendant que la musique joue ; le panneau reste ouvert.\nAvec le moteur FluidEQ, choisissez la phase Minimale ou Linéaire. Appuyez sur Réinitialiser pour tout ramener à Normal.\nCliquez sur le bouton des dispositions, à côté d’Ajouter une bande. Choisissez 6, 10, 15, 20 ou 31 bandes, ou appuyez sur Enregistrer… pour nommer la disposition actuelle.',
  'help.eqmode.tip':
    'Une disposition ne stocke que les fréquences et le Q : en charger une remet chaque bande à 0 dB. La phase linéaire ajoute du retard et peut résonner avant les attaques franches.',
  'help.eqmode.modeCaption': 'Mode EQ',
  'help.eqmode.strength':
    'Normal, Studio ×1.5 ou ×2, séparément pour votre EQ et vos courbes.',
  'help.eqmode.q':
    'Constant garde chaque Q ; Proportionnel et Asymétrique resserrent les bandes à mesure qu’elles se renforcent.',
  'help.eqmode.smoothing': 'Adoucit les courbes de correction échantillonnées.',
  'help.eqmode.phase':
    'Minimale ou Linéaire. Avec le moteur FluidEQ uniquement.',
  'help.eqmode.reset': 'Tout revient à Normal.',
  'help.eqmode.designsCaption': 'Dispositions de bandes',
  'help.eqmode.builtIn': 'Dispositions standard de 6, 10, 15, 20 ou 31 bandes.',
  'help.eqmode.save':
    'Donne un nom aux fréquences et au Q actuels pour en faire une disposition, listée sous Mes dispositions.',

  'help.games.title': 'Préréglages de jeu',
  'help.games.intro':
    'Donnez à chaque jeu un son bien à lui. Quand le jeu passe au premier plan, FluidEQ bascule sur ce son et le garde jusqu’à ce que vous fermiez le jeu, même si vous passez à autre chose entre-temps avec Alt+Tab. Puis il remet ce que vous aviez.',
  'help.games.steps':
    'Ouvrez Égaliseur → Préréglages de jeu et appuyez sur Ajouter un jeu. Prenez-en un dans vos lanceurs ou parmi les programmes ouverts en ce moment, ou choisissez vous-même son programme.\nDans le sélecteur de sa ligne, choisissez le son qu’il doit recevoir : un préréglage Jeux, ou n’importe quel autre.\nLancez le jeu. Une carte sur le Bureau indique sur quoi FluidEQ a basculé, et une autre, ce qui est revenu quand vous le fermez.',
  'help.games.tip':
    'Tant qu’un jeu a la main sur le son, la barre en bas de la fenêtre affiche son nom. Choisissez un autre son en cours de partie et il reste : FluidEQ ne défait que ce qu’il a fait lui-même. Les préréglages Jeux activent aussi le Mode jeu.',
  'help.games.tab': 'Vos jeux et le son que reçoit chacun.',
  'help.games.add':
    'Ajoute un jeu de Steam, Epic, EA, GOG, Ubisoft, Battle.net ou Xbox, ou n’importe quel programme ouvert en ce moment.',
  'help.games.gameName': 'Un jeu',
  'help.games.game': 'Le jeu, et le dossier grâce auquel FluidEQ le reconnaît.',
  'help.games.soundName': 'Le son du jeu',
  'help.games.sound':
    'Le son sur lequel FluidEQ bascule quand ce jeu passe au premier plan, ou Ne rien changer.',
  'help.games.removeName': 'Retirer',
  'help.games.remove': 'Oublie le jeu. Le préréglage qu’il utilisait reste.',

  'help.headphones.title': 'Correction du casque et importation',
  'help.headphones.intro':
    'Une correction du casque compense un modèle mesuré et se combine avec vos bandes et vos préréglages. Vérifiez le modèle exact et l’auteur de la mesure.',
  'help.headphones.steps':
    'Ouvrez Égaliseur → Préréglages EQ et cherchez votre modèle de casque. Examinez les mesures disponibles et choisissez l’entrée correspondante.\nPour du texte EQ venant d’un autre outil, utilisez Importer des réglages d’égalisation dans le menu des actions. Vérifiez les bandes et la courbe analysées avant d’appliquer.\nPour Squiglink, collez son export dans le panneau d’importation. Appliquer comme EQ remplace vos bandes ; Appliquer comme courbe l’ajoute comme correction du casque, avec sa propre intensité.',
  'help.headphones.tip':
    'Un aperçu marqué Non appliqué ne change pas le son. Évitez de cumuler accidentellement deux corrections complètes du même casque.',

  'help.convolution.title': 'Utilisez une réponse impulsionnelle',
  'help.convolution.intro':
    'Convolution applique une impulsion WAV comme couche séparée. Cherchez dans le catalogue AutoEq ou importez votre WAV ; les bandes paramétriques restent indépendantes.',
  'help.convolution.steps':
    'Ouvrez Égaliseur → Convolution. Recherchez par modèle ou par auteur de la mesure.\nVérifiez la source, puis utilisez Télécharger et appliquer ; le téléchargement correspond à la fréquence d’échantillonnage de votre sortie. Utilisez Importer un WAV pour un fichier que vous avez déjà.\nÉcoutez avec la couche de convolution activée puis désactivée dans Également appliqué.',
  'help.convolution.tip':
    'Le moteur FluidEQ convertit lui-même la fréquence de n’importe quelle impulsion. Equalizer APO a besoin d’un WAV importé à la fréquence de la sortie. Les téléchargements du catalogue nécessitent une connexion ; le guide, non.',

  'help.profiles.title': 'Appareils, profils et deuxième sortie',
  'help.profiles.intro':
    'Votre EQ suit le périphérique de sortie. Association automatique enregistre les modifications sur la sortie actuelle, tandis que Profils enregistrés vous permet de garder d’autres sons. Deuxième sortie duplique la lecture vers d’autres appareils, avec un niveau distinct pour chacun.',
  'help.profiles.steps':
    'Vérifiez le Périphérique de sortie avant toute modification. Utilisez Nouveau profil pour un son à garder ; Mettre à jour enregistre les changements dans ce profil, et Restaurer rétablit ses réglages enregistrés.\nOuvrez Deuxième sortie, activez un appareil accessible et réglez son niveau. Choisissez le profil d’égalisation enregistré de cet appareil juste en dessous.\nUtilisez Jeu/Vidéo pour un tampon de départ plus court ou Musique pour plus de réserve. Comparez la synchronisation sur vos appareils.',
  'help.profiles.tip':
    'Chaque sortie dupliquée utilise son propre profil, quel que soit le moteur. La duplication fonctionne tant que FluidEQ est ouvert ; changer la sortie principale arrête les anciennes duplications. La latence des appareils influe toujours sur la synchronisation.',
  'help.profiles.list':
    'Les sons que vous avez enregistrés. ACT marque celui qu’utilise cette sortie ; appuyez sur un autre pour changer.',
  'help.profiles.update':
    'Enregistre vos modifications dans le profil en cours.',
  'help.profiles.new':
    'Crée un nouveau profil à partir de l’égalisation actuelle.',
  'help.profiles.restore':
    'Ramène le profil tel que vous l’avez enregistré la dernière fois.',
  'help.profiles.output':
    'La sortie sur laquelle vous écoutez. DÉSACT. signifie que votre EQ ne l’atteint pas ; ACTIF, que Windows joue le son à travers elle.',
  'help.profiles.mapping':
    'Le profil que suit cette sortie. Toute modification que vous faites y est enregistrée d’elle-même.',
  'help.profiles.onePlayer':
    'Lancer quelque chose dans FluidEQ met en pause ce qui joue ailleurs sur le PC, et inversement.',
  'help.profiles.outputs':
    'Vos autres sorties. Activez-en une pour y jouer aussi, avec son propre profil.',
  'help.profiles.driver':
    'Un point de départ doux, selon ce avec quoi vous écoutez — casque, écouteurs, taille ou matériau du transducteur. Laissez-le sur Sans compensation si le son vous convient déjà.',

  'help.config.title': 'Inspectez et sauvegardez une chaîne',
  'help.config.intro':
    'Égaliseur → Config montre ce que le moteur audio a réellement sur le disque. Les cartes de sortie et l’arbre d’inclusions vous aident à voir quels appareils et quelles couches sont concernés. Exportez une chaîne avant une grande expérience ou pour déplacer une configuration.',
  'help.config.steps':
    'Ouvrez Égaliseur → Config, choisissez la sortie et vérifiez état et couches.\nUtilisez Exporter la chaîne pour sauvegarder un fichier .fluideq.\nPour le récupérer, choisissez d’abord la bonne sortie, importez la chaîne et vérifiez le résultat.',
  'help.config.tip':
    'Les fichiers de couches générés sont réécrits quand leurs réglages changent ; placez vos lignes manuelles durables dans le fichier personnalisé de chaque sortie. Le moteur FluidEQ en lit les lignes Filter, Preamp, GraphicEQ et Convolution ; les autres commandes APO et les plugins nécessitent Equalizer APO.',

  'help.dsp.title': 'Explorez le rack DSP',
  'help.dsp.intro':
    'Le rack DSP est une chaîne d’étages de studio. Avec le moteur FluidEQ, il traite tout ce que joue le PC ; avec Equalizer APO, il traite les pistes audio de la Bibliothèque. Il est coupé tant que FluidEQ est désactivé.',
  'help.dsp.steps':
    'Ouvrez l’onglet DSP. Choisissez une chaîne sous Préréglages, ou sélectionnez un étage dans la colonne latérale et activez-le.\nChangez un réglage à la fois et comparez avec l’étage contourné, à volume similaire. Isoler vous fait entendre uniquement ce qu’un étage ajoute.\nEnregistrez un rack qui vous plaît, et utilisez Exporter et Importer pour le partager.',
  'help.dsp.tip':
    'Plus fort paraît souvent meilleur simplement parce que c’est plus fort : comparez donc à niveaux égaux. Faites Ctrl+clic sur un bouton rotatif pour le ramener à sa valeur par défaut.',
  'help.dsp.normalizer':
    'Uniformise la sonie. Sur l’audio en direct, il la nivelle morceau par morceau.',
  'help.dsp.denoise':
    'Répare le souffle, le ronflement et les craquements. Le nettoyeur de voix neuronal agit sur les pistes de la Bibliothèque.',
  'help.dsp.exciter': 'Ajoute des harmoniques pour le corps et l’air.',
  'help.dsp.bassForge':
    'Ajoute une vraie octave sous la basse, ou ses harmoniques pour les petits haut-parleurs.',
  'help.dsp.equaliser':
    'Quinze bandes paramétriques, en phase minimale ou linéaire.',
  'help.dsp.bassPunch':
    'Façonne l’attaque, le maintien et l’éclosion de la basse.',
  'help.dsp.dimension': 'Élargit l’image stéréo sans changer la somme mono.',
  'help.dsp.maximizer':
    'Augmente le niveau sans laisser les crêtes dépasser le plafond.',
  'help.dsp.master': 'Niveau final, cible de sonie et protection des crêtes.',
  'help.dsp.crossfade':
    'Enchaîne une piste de la Bibliothèque sur la suivante.',
  'help.dsp.presets':
    'Des chaînes pour tout le rack : genres, appareils et corrections.',
  'help.dsp.scopeName': 'Tout le système',
  'help.dsp.scope':
    'Où le rack fonctionne, et la latence qu’ajoute la phase linéaire.',

  'help.room.title': 'La Salle : le surround au casque',
  'help.room.intro':
    'La Salle fait d’un casque une salle d’écoute. Chaque canal du son devient une enceinte autour de votre tête, rendue à travers une tête mesurée et les réflexions d’une salle que vous façonnez vous-même : un film se tient devant vous et un jeu vous entoure. Elle demande le moteur FluidEQ et un casque ; sur des enceintes elle ne sert à rien.',
  'help.room.steps':
    'Ouvrez DSP, choisissez Salle dans le rail et activez-la. La stéréo devient deux enceintes devant vous ; un film 5.1, cinq et le sub ; un jeu 7.1, tout l’anneau. La puce à côté de l’interrupteur dit lequel.\nChoisissez une salle en haut — studio, salon, cinéma, salle de concert et plus — ou tournez Taille, Murs et Distance vous-même et faites glisser une enceinte sur l’anneau. Les enceintes que le flux en lecture n’atteint pas sont dessinées endormies.\nAppuyez sur Lancer le test d’écoute et répondez à cinq courtes paires d’écoute : la salle prend la tête qui place les sons devant vous. Petite, Moyenne et Grande se choisissent aussi à la main.\nEnregistrez une salle qui vous plaît sous un nom ; une salle enregistrée revient d’une pression et ne change jamais votre tête.',
  'help.room.tip':
    'Les jeux et les films n’envoient leurs canaux surround qu’à une sortie que Windows croit dotée d’autant d’enceintes : quand le pilote l’accepte, le panneau de sortie propose de passer en 7.1 d’une pression.',
  'help.room.picker':
    'Les salles de départ, groupées comme les profils de chaque autre étage ; Personnalisé dès que vous en façonnez une.',
  'help.room.picture':
    'La salle vue de dessus : des murs qui s’effacent en absorbant, les enceintes sur leur anneau, la tête au milieu. Tout est dessiné à une seule échelle : une enceinte plus éloignée que la salle n’est large se dessine donc hors de ses murs. Faites-en glisser une et sa jumelle suit ; maintenez Maj pour la déplacer seule.',
  'help.room.speaker':
    'Appuyez sur une enceinte de la salle et ce volet devient le sien : son angle en degrés, sa propre distance, son niveau, et Muet ou Solo pour l’écouter seule.',
  'help.room.speakerName': 'L’enceinte choisie',
  'help.room.dialsName': 'Espace, Ambiance, Distance',
  'help.room.dials':
    'Ce que vous entendez des murs, la traîne douce qui suit, et la distance des enceintes. Taille, Murs, ainsi que la longueur et la couleur de la traîne sont dans Caractère de la salle, en dessous.',
  'help.room.fit':
    'Cinq paires d’écoute qui choisissent la tête pour vos oreilles.',
  'help.room.head':
    'La tête mesurée à travers laquelle la salle est rendue : petite, moyenne ou grande.',
  'help.room.saved':
    'Nommez la salle telle qu’elle est ; elle revient d’une pression.',
  'help.room.liveName': 'Ce que fait la salle',
  'help.room.live':
    'Lu depuis le moteur : quelles enceintes le flux en lecture atteint, ou pourquoi la salle est au repos.',

  'help.denoise.title': 'Débruitage et analyse',
  'help.denoise.intro':
    'Débruitage réduit le souffle, le ronflement secteur et les craquements. Avec le moteur FluidEQ, il agit en direct sur tout ce que joue le PC ; le nettoyeur de voix neuronal et le plancher de bruit analysé sont réservés aux pistes de la Bibliothèque. Une réduction plus forte n’est pas forcément meilleure.',
  'help.denoise.steps':
    'Lancez quelque chose qui contient le bruit à réduire et sélectionnez Débruitage dans DSP.\nActivez Souffle, Ronflement ou Craquements avec un réglage léger, et écoutez les passages calmes et les détails musicaux.\nAugmentez la réduction progressivement, puis contournez l’étage pour vérifier que l’amélioration vaut la perte de détail éventuelle.',
  'help.denoise.tip':
    'Guettez les détails adoucis, les textures aqueuses ou le pompage. Ce n’est pas un nettoyage du micro. Si vous n’entendez aucun changement, vérifiez que le rack et l’étage sont tous deux activés.',

  'help.graph.title': 'Le graphique et ses commandes',
  'help.graph.intro':
    'La courbe de réponse trace vos courbes d’EQ sur le son en direct. La barre au-dessus choisit ce qui est dessiné et comment, et elle change selon le style choisi : style standard ou visualiseur Plus.',
  'help.graph.steps':
    'Cliquez sur le nom du style pour choisir un style ou un visualiseur. Les flèches à côté, Espace et Ctrl+Espace les font défiler.\nOuvrez Affichage pour la taille du graphique, ce qu’il montre, et la hauteur et la position de l’onde. La Cadence s’y trouve aussi : toutes les images que votre écran propose, ou 60 ou 30, et 60 sur batterie.\nUn visualiseur Plus ajoute ses propres réglages à Affichage — ce que son auteur vous a laissé régler — et Utiliser son onde d’origine ramène l’onde à la hauteur et à la position choisies par cet auteur.\nDouble-cliquez sur le tracé pour passer en plein écran. Un simple clic masque ou affiche la barre.',
  'help.graph.tip':
    'Tout ceci ne change que le dessin, jamais votre son. Le mode arc-en-ciel (à activer dans Aide → Nouveautés) dessine les styles standard, les vumètres et l’onde à la pleine fréquence de votre écran au lieu de 30 images par seconde. Échap quitte la vue agrandie et le plein écran.',
  'help.graph.stripCaption': 'Avec un style standard',
  'help.graph.live': 'Affiche ou masque l’onde en direct.',
  'help.graph.previous': 'Revient au style précédent.',
  'help.graph.picker': 'Ouvre tous les styles et visualiseurs.',
  'help.graph.next': 'Passe au style suivant.',
  'help.graph.autoName': 'Auto',
  'help.graph.auto': 'Change de style toutes les 10 secondes à 2 minutes.',
  'help.graph.colouring':
    'Colore le style : Auto, Uniforme, Fréquence, Niveau ou Chaleur.',
  'help.graph.newLook': 'Crée un style à vous à partir de celui-ci.',
  'help.graph.bandsName': 'Bandes d’écoute',
  'help.graph.bands': 'Ombre les bandes que vous entendez le plus.',
  'help.graph.bandsMenu':
    'Le même ombrage ; grisé sur un visualiseur Plus, qui ne le dessine jamais.',
  'help.graph.gridName': 'Grille',
  'help.graph.grid': 'Affiche ou masque la grille et les échelles.',
  'help.graph.viewName': 'Affichage',
  'help.graph.view': 'Taille, ce qui est dessiné, et l’onde.',
  'help.graph.plusCaption': 'Avec un visualiseur Plus',
  'help.graph.tintName': 'Couleurs de la fenêtre',
  'help.graph.tint':
    'Le thème de l’application, les couleurs du visualiseur, ou ses couleurs avec sa lumière (Ambiance).',
  'help.graph.lighting': 'Éclaire vos appareils RVB avec cette scène.',
  'help.graph.desktop': 'Place ce visualiseur derrière les icônes du Bureau.',
  'help.graph.viewCaption': 'Le menu Affichage',
  'help.graph.expand': 'Le graphique s’agrandit par-dessus l’éditeur.',
  'help.graph.fullscreen': 'Le graphique remplit l’écran.',
  'help.graph.showingName': 'Affichage',
  'help.graph.showing': 'Fait défiler ce que montre le graphique.',
  'help.graph.waveName': 'L’onde',
  'help.graph.wave': 'Le tracé du spectre en direct.',
  'help.graph.topWaveName': 'Onde supérieure',
  'help.graph.topWave': 'La petite onde dans la barre de titre.',
  'help.graph.meterName': 'Indicateur de niveau',
  'help.graph.meter': 'L’indicateur de sortie dans la colonne de gauche.',
  'help.graph.waveHeight': 'La hauteur à laquelle l’onde est dessinée.',
  'help.graph.wavePosition': 'Du bord inférieur jusqu’au milieu.',
  'help.graph.attack':
    'La vitesse à laquelle un visualiseur Plus monte avec la musique.',
  'help.graph.release':
    'La lenteur avec laquelle il redescend après chaque coup.',
  'help.graph.ownTiming': 'Revient au rythme fourni avec le visualiseur.',
  'help.looks.title': 'Styles et visualiseurs Plus',
  'help.looks.intro':
    'Les styles standard sont des dessins gratuits du son en direct, que vous pouvez colorer et concevoir vous-même : Ligne et Aire pour un tracé net, Blocs LED et Pics pour du punch, Treillis, Horizon et Flammes dansantes pour des scènes entières. Les visualiseurs Plus sont des scènes dessinées par la carte graphique, comme Alpin, Aurore, Floraison et Ville néon, où les basses, le rythme et les aigus font chacun bouger quelque chose de différent.',
  'help.looks.steps':
    'Sur le graphique, cliquez sur le nom du style. Recherchez, ou filtrez les styles par Lignes, Remplissages, Barres, Points ou Scènes.\nChoisissez un visualiseur Plus à droite. Sans Plus, il est verrouillé, et le choisir explique comment l’obtenir.\nSur un style standard, appuyez sur Nouveau style pour changer ses couleurs, son mouvement et ses crêtes, puis enregistrez-le ; il apparaît sous Les vôtres.',
  'help.looks.tip':
    'Un visualiseur Plus apporte ses propres couleurs : réglez son attaque et son relâchement dans Affichage. Si une scène ne peut pas tourner sur cet ordinateur, le graphique dessine un style gratuit au lieu d’un tracé vide.',
  'help.looks.searchName': 'Recherche',
  'help.looks.search':
    'Trouve les styles et visualiseurs par nom, créateur ou catégorie.',
  'help.looks.styles':
    'Les styles gratuits dessinés par FluidEQ, et les styles que vous avez enregistrés.',
  'help.looks.familiesName': 'Filtres de style',
  'help.looks.families':
    'Lignes, Remplissages, Barres, Points, Scènes et Les vôtres.',
  'help.looks.plus':
    'Des scènes de FluidEQ et des membres, chacune avec une image.',
  'help.looks.categoriesName': 'Catégories',
  'help.looks.categories': 'Nature, Villes, Abstrait et plus encore.',

  'help.plus.title': 'FluidEQ Plus et votre compte',
  'help.plus.intro':
    'Un compte est facultatif : tout ce qui était gratuit fonctionne sur cet ordinateur sans compte. FluidEQ Plus, mensuel ou annuel, ajoute les Visualiseurs, le Classement, le Studio, l’Éclairage dynamique et le visualiseur du Bureau. Un nouveau compte peut essayer Plus gratuitement pendant quinze jours, et une scène que vous publiez et qui est approuvée vous offre un mois.',
  'help.plus.steps':
    'Ouvrez Compte dans le menu des actions. Connectez-vous, ou créez un compte et saisissez le code à six chiffres envoyé à votre adresse e-mail.\nAppuyez sur Passer à Plus, lisez les conditions, cochez la case pour les accepter, et payez sur Buy Me a Coffee dans votre navigateur avec la même adresse e-mail.\nOuvrez l’onglet Plus. Sa barre latérale mène au Classement, aux Visualiseurs, au Studio et à l’Éclairage dynamique.',
  'help.plus.tip':
    'L’application ne voit jamais votre carte ; Gérer l’abonnement permet de le modifier ou de l’annuler. L’essai gratuit ne demande aucune carte et ne prélève rien à la fin. Un compte reste connecté sur cinq ordinateurs au maximum, et Plus continue de fonctionner hors ligne pendant un certain temps.',
  'help.plus.leaderboard':
    'Qui écoute le plus, parmi les membres Plus qui y participent.',
  'help.plus.visualizers':
    'Des scènes de FluidEQ et des membres, prêtes pour votre musique.',
  'help.plus.studio': 'Créez vos propres scènes avec votre IA.',
  'help.plus.lighting': 'Vos appareils RVB suivent la scène.',
  'help.plus.fold':
    'Replie la barre latérale sur ses images ; elle se rouvre au survol.',

  'help.gallery.title': 'La galerie Visualiseurs',
  'help.gallery.intro':
    'Visualiseurs rassemble les scènes de FluidEQ et celles que publient les membres. Tout compte peut parcourir la galerie et essayer dix secondes les scènes d’exemple gratuites de FluidEQ ; Plus lance chaque scène sur votre musique et l’ajoute à vos styles.',
  'help.gallery.steps':
    'Ouvrez Plus → Visualiseurs. Recherchez, triez par Les plus aimées, Cette semaine ou Les plus récentes, ou choisissez une catégorie.\nOuvrez une scène, appuyez sur Ajouter à mes styles, puis sur Lancer sur le graphique. Les flèches, ou ← et →, passent d’une scène à l’autre.\nAimez les scènes des membres avec le cœur, et signalez celle qui n’a pas sa place ici.',
  'help.gallery.tip':
    'Les scènes de vos styles se mettent à jour d’elles-mêmes, et la page d’une scène indique ce qui a changé à chaque version. Une scène que vous publiez apparaît une fois qu’un modérateur l’a approuvée. Ouvrir dans le Studio montre comment sont faites les scènes de FluidEQ.',
  'help.gallery.search': 'Trouve des scènes et des créateurs.',
  'help.gallery.sortName': 'Trier',
  'help.gallery.sort':
    'Les plus aimées, les plus aimées cette semaine, ou les plus récentes.',
  'help.gallery.categoriesName': 'Catégories',
  'help.gallery.categories': 'Affiche un seul type de scène.',
  'help.gallery.mine': 'Les scènes que vous avez publiées, avec leurs j’aime.',
  'help.gallery.cardName': 'Une scène',
  'help.gallery.card':
    'Son image ouvre la scène ; Ajouter la met dans vos styles.',
  'help.gallery.manage':
    'Ce que chaque écran affiche en arrière-plan du Bureau.',
  'help.gallery.stop': 'Arrête tous les arrière-plans du Bureau.',
  'help.gallery.sceneCaption': 'La page d’une scène',
  'help.gallery.back': 'Retour à la galerie, là où vous l’aviez laissée.',
  'help.gallery.stepName': 'Précédente et suivante',
  'help.gallery.step':
    'Parcourt la liste depuis laquelle vous avez ouvert la scène.',
  'help.gallery.play':
    'Ajoute la scène à vos styles, ou la lance sur le graphique.',
  'help.gallery.desktop': 'Place la scène derrière les icônes du Bureau.',
  'help.gallery.inspect':
    'Ouvre la scène de FluidEQ dans le Studio pour voir comment elle est faite.',

  'help.leaderboard.title': 'Le classement',
  'help.leaderboard.intro':
    'Le classement range les membres Plus qui le rejoignent selon leur temps d’écoute et les j’aime que reçoivent leurs scènes. Il reste désactivé tant que vous ne le rejoignez pas.',
  'help.leaderboard.steps':
    'Ouvrez le panneau Compte et appuyez sur Rejoindre le classement.\nOuvrez Plus → Classement. Choisissez le pseudo et le nom affichés au classement, puis basculez entre Depuis toujours et Ce mois-ci.\nPour arrêter, appuyez sur Quitter le classement. Supprimer toutes mes données efface tout ce que vous avez envoyé.',
  'help.leaderboard.tip':
    'Un seul nombre par jour quitte votre ordinateur — les minutes de musique jouées — et jamais ce que vous écoutez. Chaque nombre est vérifié sur le serveur. Votre pseudo et votre nom se changent plus tard depuis Compte → Changer de nom ; le classement et vos scènes publiées suivent.',
  'help.leaderboard.periodName': 'Depuis toujours ou Ce mois-ci',
  'help.leaderboard.period': 'Tout l’historique, ou ce mois-ci seulement.',
  'help.leaderboard.standing':
    'Votre rang et vos points, et l’écart avec la place suivante.',
  'help.leaderboard.earn':
    '10 points par heure, 20 par jour d’au moins 30 minutes, 5 par j’aime.',

  'help.studio.title': 'Créez des scènes dans le Studio',
  'help.studio.intro':
    'Le Studio transforme une description en visualiseur. Votre propre assistant IA écrit la scène dans un dossier de projet, et FluidEQ lance chaque version sur votre musique dès qu’elle est enregistrée. Le Studio fait partie de Plus ; un nouveau compte peut l’ouvrir avec l’essai gratuit.',
  'help.studio.steps':
    'Ouvrez Plus → Studio et appuyez sur Nouveau projet… Donnez-lui un nom ; FluidEQ crée son dossier avec une scène qui bouge déjà.\nDécrivez votre idée, ouvrez le dossier dans votre assistant IA et collez le prompt copié avec Copier le prompt IA.\nRegardez l’aperçu à chaque enregistrement de fichier et essayez les signaux de test. Puis Ajouter à mes styles, Publier… ou Exporter…',
  'help.studio.tip':
    'Double-cliquez sur l’aperçu pour le plein écran. Explorer une scène FluidEQ… ouvre l’une des scènes de FluidEQ pour apprendre en l’étudiant ; elle ne peut pas être publiée. Les scènes qui clignotent trop fort ou sont trop lourdes sont retenues. Une scène que vous publiez est d’abord lue par un modérateur, et une scène approuvée vous offre un mois de Plus.',
  'help.studio.project': 'Vos projets, et des scènes FluidEQ à explorer.',
  'help.studio.switchName': 'Projet précédent et suivant',
  'help.studio.switch': 'Passe au projet précédent ou suivant.',
  'help.studio.stageName': 'Aperçu',
  'help.studio.stage':
    'La scène, en direct sur votre musique. Double-cliquez pour le plein écran.',
  'help.studio.code':
    'Le code de la scène, en direct, mis à jour à chaque enregistrement de votre IA.',
  'help.studio.prompt':
    'Copie le prompt qui explique à votre IA comment sont faites les scènes.',
  'help.studio.hears':
    'Ce que reçoit la scène : niveau, temps, basses, médiums, aigus.',
  'help.studio.signals': 'Des signaux de test qui n’animent que cet aperçu.',
  'help.studio.size':
    'Essaie la scène sur un graphique ou sur un panneau étroit, large ou plein écran.',
  'help.studio.wave':
    'Essaie la hauteur et la position de l’onde que les auditeurs peuvent régler.',

  'help.desktop.title': 'Le visualiseur du Bureau',
  'help.desktop.intro':
    'Le visualiseur du Bureau place un visualiseur Plus derrière les icônes du Bureau, sur un écran ou sur chacun d’eux, tant que FluidEQ tourne.',
  'help.desktop.steps':
    'Mettez un visualiseur Plus sur le graphique et appuyez sur le bouton en forme d’écran à côté de son nom, ou choisissez Affichage → Définir comme arrière-plan du Bureau.\nAppuyez sur les écrans de la carte, choisissez Avec la musique ou Calme, et appuyez sur Définir l’arrière-plan.\nPour le modifier ou l’arrêter, ouvrez Plus → Visualiseurs et utilisez Gérer ou Arrêter en haut.',
  'help.desktop.tip':
    'Il se met en pause tant que des fenêtres couvrent l’écran, quand le PC est verrouillé et, si vous le choisissez, sur batterie ; il revient au démarrage de FluidEQ. Quitter FluidEQ l’arrête. Windows uniquement.',
  'help.desktop.monitors':
    'Vos écrans tels que Windows les dispose. Appuyez sur ceux à utiliser.',
  'help.desktop.music': 'Bouge avec ce qui est en lecture.',
  'help.desktop.calm': 'Une animation lente et paisible qui ignore la musique.',
  'help.desktop.battery':
    'Économise l’énergie lorsque l’ordinateur est débranché.',
  'help.desktop.start': 'Le lance sur les écrans choisis.',

  'help.lighting.title': 'Éclairage dynamique (bêta)',
  'help.lighting.intro':
    'L’éclairage dynamique illumine votre clavier, votre souris, votre tapis de souris, votre casque et votre support avec le visualiseur Plus du graphique, via Windows Dynamic Lighting et Razer Chroma. Il est en bêta, alors dites-nous comment se comportent vos appareils.',
  'help.lighting.steps':
    'Ouvrez Plus → Éclairage dynamique et activez-le, ou appuyez sur le bouton d’éclairage à côté d’un visualiseur Plus sur le graphique.\nChoisissez le style lumineux de ce visualiseur — Scène, Vague de couleur, Spectre ou Onde rythmique — et réglez sa luminosité et ce à quoi il réagit.\nCliquez sur un appareil sous Vos appareils pour le régler seul ; Tous les appareils revient au réglage de l’ensemble.',
  'help.lighting.tip':
    'Si Windows réserve un appareil à une autre application, la page indique le paramètre à changer et l’ouvre pour vous. Les appareils Razer ont besoin de Razer Synapse en cours d’exécution, avec Chroma Apps autorisé.',
  'help.lighting.switch':
    'Éclaire vos appareils pendant qu’un visualiseur Plus joue.',
  'help.lighting.browse': 'Ouvre la galerie pour choisir un visualiseur.',
  'help.lighting.previewName': 'Aperçu du bureau en direct',
  'help.lighting.preview':
    'Votre propre bureau, éclairé avec les couleurs qui lui sont envoyées.',
  'help.lighting.devices':
    'Tous les appareils trouvés. Cliquez sur l’un d’eux pour le régler seul.',
  'help.lighting.all': 'Revient au réglage de tous les appareils à la fois.',
  'help.lighting.style':
    'Scène, Vague de couleur, Spectre ou Onde rythmique, mémorisé pour chaque visualiseur.',

  'help.online.title': 'Écoutez avec Médias en ligne',
  'help.online.intro':
    'Médias en ligne place les sites compatibles à côté de votre EQ. La lecture et l’identification sur ces sites dépendent toujours du fournisseur et de votre connexion. La barre en bas de FluidEQ suit le lecteur actif, et son volume est celui du site.',
  'help.online.steps':
    'Ouvrez Médias en ligne, choisissez un site et lancez quelque chose sur la page.\nPassez à l’Égaliseur pour régler en écoutant, puis revenez aux commandes propres à la page.\nActivez Un seul lecteur pour éviter les lectures superposées.',
  'help.online.tip':
    'Avec le moteur FluidEQ, Médias en ligne passe par votre EQ et le rack DSP comme toute autre application. Avec Equalizer APO, le rack reste réservé aux pistes de la Bibliothèque.',

  'help.library.title': 'Constituez votre bibliothèque locale',
  'help.library.intro':
    'Bibliothèque rassemble la musique et les vidéos de vos disques. Parcourez-les par albums, artistes, genres, chansons, dossiers, par arborescence de dossiers ou dans vos playlists. Les pochettes et les informations viennent de vos fichiers : une même collection peut donc sembler différente selon ses tags.',
  'help.library.steps':
    'Ouvrez la Bibliothèque et ajoutez le dossier contenant vos médias. Laissez l’analyse se terminer avant de juger ce qui manque.\nChoisissez un artiste ou un album, ou recherchez une chanson. Lancez une piste depuis les résultats.\nUtilisez la barre en bas de la fenêtre pour mettre en pause, vous déplacer dans le morceau et passer au suivant. Son volume est le même pour tous les lecteurs.',
  'help.library.tip':
    'Survolez le bouton de FluidEQ dans la barre des tâches de Windows pour Précédent, Lire et Suivant, même quand FluidEQ est réduit. Bibliothèque a besoin des fichiers d’origine : rebranchez un disque ou ajoutez de nouveau un dossier déplacé.',

  'help.queue.title': 'Albums et file de lecture',
  'help.queue.intro':
    'La file définit l’ordre d’écoute. Ouvrir un autre album permet de parcourir sans remplacer le morceau courant. Le morceau actif et À suivre vous situent.',
  'help.queue.steps':
    'Ouvrez un album pour voir ses pistes. Lancez le morceau voulu.\nFaites un clic droit sur une chanson pour Ajouter à la file, Ajouter aux Favoris ou Ajouter à une playlist.\nOuvrez À suivre pour voir ce qui vient ensuite, et activez Continuer la lecture pour poursuivre avec d’autres titres du même genre.',
  'help.queue.tip':
    'Lancer la lecture dans la Bibliothèque prend le relais des autres lecteurs de FluidEQ. Fiez-vous au morceau affiché dans la barre pour savoir quelle source a la main sur la lecture.',

  'help.karaoke.title': 'Chantez avec Karaoké',
  'help.karaoke.intro':
    'Karaoké associe audio et paroles locales. Les paroles synchronisées suivent la lecture ; les cibles de hauteur exigent des notes. Un micro configuré ajoute votre hauteur en direct.',
  'help.karaoke.steps':
    'Ouvrez Karaoké et ajoutez fichiers ou dossier contenant audio et paroles correspondantes.\nChoisissez un morceau, lancez-le et vérifiez l’association.\nConfigurez le micro, ajustez la taille des paroles et utilisez le plein écran de la scène.',
  'help.karaoke.tip':
    'Un fichier contenant seulement des paroles n’a pas de notes cibles. Karaoké suit le Volume de l’application ; les niveaux de la mélodie, de l’instrumental et de la voix témoin se trouvent dans Réglages du mixage.',

  'help.maker.title': 'Créez dans le Créateur de karaoké',
  'help.maker.intro':
    'Le Créateur transforme l’audio en projet modifiable avec paroles et notes sur la timeline. Vérifiez toujours les mots et les temps générés automatiquement.',
  'help.maker.steps':
    'Ouvrez Créer depuis Karaoké et chargez l’audio. Choisissez les outils de séparation ou transcription nécessaires.\nSuivez la progression ; la première utilisation de l’IA peut télécharger des modèles. Vérifiez paroles et notes.\nÉcoutez de courts passages, corrigez texte et temps, sauvegardez le projet puis exportez les fichiers.',

  'help.maker.lyricsCaption':
    'Les paroles, et le moment où chaque mot est chanté',
  'help.maker.referenceName': 'Paroles de référence',
  'help.maker.reference':
    'La chanson entière en texte, une ligne par rangée. Collez-la ou chargez un fichier ; FluidEQ en tire le calage.',
  'help.maker.timingName': 'Calage du mot',
  'help.maker.timing':
    'Tous les mots dans l’ordre, avec le nombre déjà calé. Appuyez sur l’un d’eux pour le travailler.',
  'help.maker.wordName': 'Mot sélectionné',
  'help.maker.word':
    'Où commence le mot choisi et combien de temps il dure. Déplacer son bord donne ou prend du temps au mot voisin ; la ligne garde sa durée.',
  'help.maker.toolsCaption': 'Les outils d’IA et les modèles qu’ils demandent',
  'help.maker.separate':
    'Sépare l’enregistrement en voix et musique, pour que le karaoké joue sans le chanteur.',
  'help.maker.loadVocals':
    'Utilisez un fichier de voix seule que vous avez déjà, au lieu d’en séparer un ici.',
  'help.maker.redetectTiming':
    'Réécoute la voix et recalcule le calage des mots déjà présents.',
  'help.maker.redetectNotes':
    'Réécoute la mélodie et réécrit les notes sous les mots.',
  'help.maker.modelsName': 'Mémoire des modèles IA',
  'help.maker.models':
    'Ce dont chaque modèle a besoin et s’il est sur cet ordinateur. Ils sont téléchargés à la première utilisation.',
  'help.maker.idleName': 'Lorsqu’il est inactif',
  'help.maker.idle':
    'Si un modèle reste en mémoire entre deux usages, et combien de temps. Le libérer rend de la mémoire ; le garder fait démarrer la fois suivante aussitôt.',

  'help.makerBar.caption': 'Les outils en haut du créateur',
  'help.makerBar.import':
    'Ouvre un fichier karaoké ou un projet enregistré, en gardant l’audio déjà chargé.',
  'help.makerBar.lyrics': 'Les mots et leur calage, dans une seule fenêtre.',
  'help.makerBar.timing':
    'Déplace les mots et les notes ensemble, pour une chanson en avance ou en retard dès la première seconde.',
  'help.makerBar.pan':
    'Faites glisser la timeline pour parcourir la chanson sans rien modifier.',
  'help.makerBar.language':
    'La langue des paroles, et une seconde à côté pour la chanter dans l’une ou l’autre.',
  'help.makerBar.record':
    'Lancez la chanson et appuyez sur une touche au début et à la fin de chaque ligne. Le calage vient de vos appuis.',
  'help.makerBar.select':
    'Tracez un cadre autour des notes pour les déplacer ou les supprimer ensemble.',
  'help.makerBar.paint':
    'Dessinez la mélodie directement sur la grille des hauteurs.',
  'help.makerBar.split':
    'Coupe un mot en syllabes, pour qu’un mot long porte une note sur chacune.',
  'help.makerBar.repair':
    'Les outils qui écoutent à votre place, et les modèles dont ils ont besoin.',
  'help.makerBar.export':
    'Écrit le karaoké terminé en projet FluidEQ, UltraStar TXT, LRC ou LRC enrichi.',
  'help.maker.tip':
    'Les modèles nécessitent connexion et espace disque. La durée dépend du matériel et du morceau. Utilisez de l’audio autorisé et vérifiez avant de partager.',

  'help.share.title': 'Partagez l’audio entre ordinateurs',
  'help.share.intro':
    'Partager l’audio transmet le son système entre ordinateurs du même réseau privé. Le récepteur porte le casque ou les enceintes ; les autres émettent. Cela diffère d’une seconde sortie sur le même ordinateur.',
  'help.share.steps':
    'Sur l’ordinateur d’écoute, ouvrez Partager l’audio, choisissez Lire le son sur cet ordinateur et appuyez sur Créer le code de connexion. Commencez à faible volume.\nSur chaque ordinateur source, choisissez Envoyer le son de cet ordinateur, collez le code de votre réseau et appuyez sur Connecter et envoyer.\nSurveillez le moniteur de connexion. Appuyez sur Arrêter l’envoi ou Arrêter l’écoute une fois terminé ; Créer un nouveau code déconnecte tous les appairages enregistrés.',
  'help.share.tip':
    'Le code de connexion autorise l’appairage : gardez-le privé. Plusieurs émetteurs se mélangent et augmentent le niveau, et le Volume du récepteur le règle. Avec le moteur FluidEQ, l’audio reçu passe aussi par le rack DSP.',

  'help.trouble.title': 'Quand le son ne va pas',
  'help.trouble.intro':
    'Commencez par la source et la sortie, puis isolez la couche en cause. Un graphique, un préréglage enregistré ou un interrupteur activé ne suffit pas à prouver que le son atteint l’appareil voulu. Le menu Aide mène aussi au dépannage audio, au signalement de problèmes et au Forum.',
  'help.trouble.steps':
    "Aucun son : vérifiez que la lecture est en cours, que la bonne sortie est sélectionnée, que le volume est monté et que l’appareil est connecté. Vérifiez si Un seul lecteur a mis une autre source en pause.\nAucun effet de l’EQ : vérifiez que l’Égaliseur système est activé et que la sortie n’affiche pas le badge DÉSACT. ; si c’est le cas, appuyez sur Activer. Si un avis indique que le moteur ne tourne pas, appuyez sur Redémarrer l’audio de Windows.\nTout semble correct et l'EQ ne fait toujours rien : Windows joue peut-être la musique en dehors du moteur. L'avis le dit et propose de le déplacer d'une pression là où Windows l'utilisera ; cela coûte une autorisation et une seconde de silence.\nDistorsion ou basses excessives : laissez la Normalisation auto activée, réduisez les amplifications et contournez les couches une à une. Si cela persiste, utilisez Signaler un problème et relisez le rapport avant de l’envoyer.",
  'help.trouble.tip':
    'F1 ouvre ce guide. Échap ferme d’abord la capture agrandie, puis le guide. Si l’interface est trop grande, Ctrl + 0 réinitialise le zoom. Processus, dans le menu des actions, montre ce que fait chaque partie de FluidEQ.',

  'help.forum.title': 'Posez vos questions sur le Forum',
  'help.forum.intro':
    'Le Forum intègre les GitHub Discussions de FluidEQ à l’application : annonces, idées, questions et réglages dont les gens sont fiers. Tout le monde peut lire ; pour publier, vous utilisez votre compte GitHub, pas un compte FluidEQ.',
  'help.forum.steps':
    'Ouvrez Aide → Forum et choisissez une catégorie : Annonces, Général, Idées, Sondages, Q&A ou Vitrine.\nRecherchez dans le forum, ou ouvrez un sujet pour lire les réponses.\nAppuyez sur Se connecter avec GitHub, terminez dans votre navigateur, puis publiez un Nouveau sujet ou une réponse.',
  'help.forum.tip':
    'Tout ce qui est publié est public sur GitHub, sous votre nom GitHub. Dans Q&A, marquez la réponse qui a marché pour que la personne suivante la trouve.',
};

export default help;
