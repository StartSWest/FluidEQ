/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Merci de contribuer',
  'tour.rainbow.title': 'Bienvenue dans le mode arc-en-ciel',
  'tour.rainbow.subtitle': 'Active-le en un clic',
  'tour.rainbow.lead':
    'Des couleurs arc-en-ciel, des accents lumineux et une bordure qui parcourt le spectre. Seul l’aspect change, jamais le son.',
  'tour.rainbow.how':
    'Active-le ici immédiatement, sans atteindre ×10. Ton choix est mémorisé et tu peux le désactiver à tout moment. Contribuer est facultatif.',
  'tour.rainbow.enable': 'Activer le mode arc-en-ciel',
  'tour.rainbow.disable': 'Désactiver le mode arc-en-ciel',
  'tour.rainbow.waveform': 'Aperçu de la forme d’onde du haut',
  'tour.rainbow.toggleHint':
    'Clique sur le bouton « RAINBOW MODE » au-dessus pour activer ou désactiver le mode.',
  'tour.eyebrow': 'NOUVEAU DANS CETTE VERSION',
  'tour.title': 'Nouveautés de FluidEQ',
  'tour.close': 'Fermer',
  'tour.rail': 'Nouvelles fonctions',
  'tour.stepOf': '{current} sur {total}',
  'tour.back': 'Retour',
  'tour.next': 'Suivant',
  'tour.done': 'Compris',
  'tour.dontShowAgain': 'Ne plus afficher pour cette version',
  'tour.releaseNotes': 'Notes de version complètes',
  'tour.rail.new': 'NOUVEAU DANS CETTE VERSION',
  'tour.rail.always': 'AUSSI DANS FLUIDEQ',
  'tour.newBadge': 'NOUVEAU',
  'tour.howTitle': 'Pour commencer',
  'tour.beta': 'Bêta',

  'tour.engine.kicker': 'NOTRE PROPRE MOTEUR AUDIO',
  'tour.engine.title': 'Voici le moteur FluidEQ',
  'tour.engine.subtitle': 'EQ et DSP pour tout ce que vous entendez',
  'tour.engine.lead':
    'FluidEQ a désormais son propre moteur audio. Il tourne dans le service audio de Windows, après les effets de votre carte son, et applique votre EQ et l’ensemble du rack DSP à tout ce que joue l’ordinateur : jeux, navigateurs, applications de streaming — pas seulement la Bibliothèque.',
  'tour.engine.point1':
    'Le rack DSP sur tout l’audio du système, sans rien lancer dans FluidEQ.',
  'tour.engine.point2':
    'Un nivellement en direct qui reconnaît chaque morceau, et le Débruitage, qui nettoie pendant la lecture.',
  'tour.engine.point3':
    'Quittez FluidEQ et votre son redevient normal aussitôt, même après un plantage.',
  'tour.engine.how':
    'Choisissez le moteur FluidEQ à l’installation, ou ouvrez le menu des actions pour le choisir. Ouvrez ensuite le DSP et activez un étage pendant la lecture dans n’importe quelle application.',
  'tour.engine.open': 'Ouvrir le DSP',
  'tour.engine.flow.label':
    'Tout ce que joue l’ordinateur passe par le moteur FluidEQ — votre EQ, puis le rack DSP — avant d’arriver à votre casque et à vos enceintes.',
  'tour.engine.flow.games': 'Jeux',
  'tour.engine.flow.browser': 'Navigateurs',
  'tour.engine.flow.music': 'Apps de musique',
  'tour.engine.flow.video': 'Vidéos',
  'tour.engine.flow.inside': 'Dans l’audio de Windows',
  'tour.engine.flow.eq': 'Votre EQ',
  'tour.engine.flow.rack': 'Rack DSP',
  'tour.engine.flow.headphones': 'Casque',
  'tour.engine.flow.speakers': 'Enceintes',

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': 'Bienvenue dans FluidEQ Plus',
  'tour.plus.subtitle': 'Visualiseurs, Studio, éclairage et plus encore',
  'tour.plus.lead':
    'Un abonnement facultatif qui permet à FluidEQ de continuer à grandir, avec un tout nouvel onglet rien que pour lui : des scènes dessinées par votre carte graphique, un Studio pour créer les vôtres, le classement, des arrière-plans du Bureau et l’éclairage dynamique. Tout ce qui était gratuit reste gratuit.',
  'tour.plus.point1':
    'Connectez-vous depuis Compte dans le menu des actions ; le paiement se fait dans votre navigateur, et Plus s’active tout seul.',
  'tour.plus.point2':
    'Mensuel ou annuel, avec des conditions en langage clair avant de payer. L’application ne voit jamais votre carte.',
  'tour.plus.point3':
    'Connexion sur cinq ordinateurs au maximum, et de nouveaux visualiseurs ajoutés au fil du temps.',
  'tour.plus.how':
    'Ouvrez l’onglet Plus : Classement, Visualiseurs, Studio et Éclairage dynamique se trouvent sur sa gauche.',
  'tour.plus.open': 'Ouvrir Plus',
  'tour.plus.imageAlt':
    'L’onglet Plus : Classement, Visualiseurs, Studio et Éclairage dynamique sur le côté, et la galerie Visualiseurs avec Chrome, Floraison, Aurore, Alpin et Ville néon.',
  'tour.scene.alpine': 'Alpin',
  'tour.scene.aurora': 'Aurore',
  'tour.scene.bloom': 'Floraison',
  'tour.scene.chrome': 'Chrome',
  'tour.scene.neonCity': 'Ville néon',

  'tour.visualizers.kicker': 'VISUALISEURS',
  'tour.visualizers.title': 'Des scènes qui bougent avec votre musique',
  'tour.visualizers.subtitle': 'Dessinées par votre carte graphique',
  'tour.visualizers.lead':
    'Les visualiseurs Plus sont des scènes vivantes — des montagnes sous les étoiles, des rideaux d’aurore boréale, une ville néon — dessinées par votre carte graphique sous vos courbes d’EQ. Les basses, le rythme et les aigus font chacun bouger quelque chose de différent, et la fenêtre autour d’elles peut prendre leurs couleurs.',
  'tour.visualizers.point1':
    'Un seul sélecteur pour tout : 38 styles gratuits à façonner et à colorer, et les visualiseurs Plus par catégorie.',
  'tour.visualizers.point2':
    'Parcourez la galerie, essayez dix secondes les scènes d’exemple de FluidEQ et ajoutez celles qui vous plaisent.',
  'tour.visualizers.point3':
    'Changez de style automatiquement, passez en plein écran, et réglez l’attaque et le relâchement d’une scène dans Affichage.',
  'tour.visualizers.how':
    'Sur le graphique, cliquez sur le nom du style et choisissez une scène sous Visualiseurs Plus, ou parcourez-les toutes dans Plus → Visualiseurs.',
  'tour.visualizers.open': 'Ouvrir l’Égaliseur',
  'tour.visualizers.imageAlt':
    'Alpin, un visualiseur Plus montrant des montagnes au-dessus d’un lac de nuit, en lecture sur le graphique sous les courbes d’EQ, avec quatre autres scènes en dessous.',

  'tour.desktop.kicker': 'VISUALISEUR DU BUREAU',
  'tour.desktop.title': 'Votre musique derrière votre Bureau',
  'tour.desktop.subtitle': 'Une scène sur chaque écran',
  'tour.desktop.lead':
    'Placez un visualiseur Plus derrière les icônes du Bureau. Il bouge avec ce que vous écoutez, ou calmement de lui-même, et chaque écran peut afficher sa propre scène.',
  'tour.desktop.point1':
    'Choisissez les écrans sur une carte de votre bureau, chacun avec son propre visualiseur.',
  'tour.desktop.point2':
    'Il se met en pause pour les applications en plein écran, quand le PC est verrouillé et sur batterie.',
  'tour.desktop.point3':
    'Il revient tout seul au prochain démarrage de FluidEQ.',
  'tour.desktop.how':
    'Avec un visualiseur Plus sur le graphique, appuyez sur le bouton en forme d’écran à côté de son nom, ou choisissez Affichage → Définir comme arrière-plan du Bureau.',
  'tour.desktop.open': 'Ouvrir l’Égaliseur',
  'tour.desktop.imageAlt':
    'Trois écrans, chacun avec un visualiseur Plus — Aurore, Alpin et Ville néon — derrière ses icônes du Bureau et sa barre des tâches.',

  'tour.lighting.kicker': 'ÉCLAIRAGE DYNAMIQUE',
  'tour.lighting.title': 'Votre bureau s’illumine avec la scène',
  'tour.lighting.subtitle': 'Bêta · vos appareils RVB suivent le visualiseur',
  'tour.lighting.lead':
    'Votre clavier, votre souris, votre tapis de souris, votre casque et votre support prennent les couleurs et le rythme du visualiseur Plus affiché sur le graphique, via Windows Dynamic Lighting et Razer Chroma.',
  'tour.lighting.point1':
    'Quatre styles pour chaque visualiseur : Scène, Vague de couleur, Spectre et Onde rythmique.',
  'tour.lighting.point2':
    'Réglez chaque appareil séparément, et choisissez ce qui se passe quand la musique s’arrête.',
  'tour.lighting.point3':
    'Un aperçu en direct dessine votre propre bureau pendant qu’il s’illumine. C’est une bêta : dites-nous comment se comportent vos appareils.',
  'tour.lighting.how':
    'Ouvrez Plus → Éclairage dynamique et activez-le, puis mettez un visualiseur Plus sur le graphique.',
  'tour.lighting.open': 'Ouvrir Plus',
  'tour.lighting.imageAlt':
    'Un clavier, une souris et un tapis de souris éclairés aux tons rose, violet et cyan de Ville néon.',

  'tour.theme.kicker': 'UN NOUVEAU LOOK',
  'tour.theme.title': 'Voici le thème Noir',
  'tour.theme.subtitle': 'Noir pur, pour les nuits tardives et les écrans OLED',
  'tour.theme.lead':
    'FluidEQ a désormais un second visage. Noir efface toute trace du bleu ardoise d’origine : panneaux, menus et barres passent en monochrome, l’accent reste, et le spectre est la seule couleur de la pièce.',
  'tour.theme.point1':
    'Fonds noir absolu : sur un écran OLED, les pixels autour du graphe s’éteignent.',
  'tour.theme.point2':
    'Toutes les fenêtres suivent : menus, boîtes de dialogue, la scène karaoké et la Bibliothèque changent ensemble.',
  'tour.theme.point3':
    'Votre couleur d’accent et le mode arc-en-ciel sont conservés. Rien ne change dans votre son : seule la peinture.',
  'tour.theme.howTitle': 'Comment changer',
  'tour.theme.how':
    'Ouvrez le menu derrière l’icône d’impulsion en haut à droite et, tout en bas, choisissez Noir sous Thème. Océan reste à un clic si vous voulez revenir.',
  'tour.theme.tryBlack': 'Passer en Noir maintenant',
  'tour.theme.tryOcean': 'Revenir à Océan',
  'tour.theme.imageAlt':
    'FluidEQ en thème Noir : l’onglet EQ avec quinze bandes et le spectre en direct pendant la lecture d’un morceau.',

  'tour.share.kicker': 'ÉCOUTEZ TOUS VOS PC',
  'tour.share.title': 'Partagez l’audio entre vos ordinateurs',
  'tour.share.subtitle': 'Un casque, toutes les machines de votre bureau',
  'tour.share.lead':
    'Votre PC de jeu, votre portable de travail et votre boîtier multimédia jouent tous dans le casque que vous portez : sur votre propre réseau, sans perte, chiffré, et à travers l’EQ que vous avez déjà réglé.',
  'tour.share.receiverLabel': 'RÉCEPTEUR',
  'tour.share.receiverName': 'Le PC avec votre casque',
  'tour.share.senderLabel': 'ÉMETTEURS',
  'tour.share.senderName': 'Tous les autres ordinateurs',
  'tour.share.wireLabel': 'Sans perte · Chiffré · LAN privé',
  'tour.share.stepsTitle': 'Configurez-le en trois étapes',
  'tour.share.step1Title': 'Sur le PC du casque, créez un code',
  'tour.share.step1':
    'Ouvrez l’onglet Partager l’audio, choisissez « Lire le son sur cet ordinateur » et appuyez sur « Créer le code de connexion ». Copiez le code de votre réseau.',
  'tour.share.step2Title': 'Sur chaque autre PC, collez-le',
  'tour.share.step2':
    'Ouvrez FluidEQ là-bas, allez dans Partager l’audio, choisissez « Envoyer le son de cet ordinateur », sélectionnez Musique ou Jeu/Vidéo, collez le code et appuyez sur « Connecter et envoyer ». Son audio système commence à circuler.',
  'tour.share.step3Title': 'Écoutez, puis réglez le niveau',
  'tour.share.step3':
    'Musique garde un tampon plus large pour une écoute ininterrompue ; Jeu/Vidéo tourne avec le délai le plus court pour la synchronisation labiale. Chaque émetteur est mixé dans la sortie du récepteur, façonné par son EQ et réglé par son Volume. La barre de lecture du récepteur affiche le morceau du dernier émetteur, et ses boutons agissent à travers le réseau.',
  'tour.share.fact1Title': 'Sans perte',
  'tour.share.fact1':
    'PCM Float32 de bout en bout. Aucun codec, aucune perte de génération.',
  'tour.share.fact2Title': 'Chiffré',
  'tour.share.fact2':
    'AES-256-GCM sur chaque paquet. Le code est la clé ; sans lui, personne ne peut écouter.',
  'tour.share.fact3Title': 'Appairage conservé',
  'tour.share.fact3':
    'L’appairage survit aux fermetures et aux redémarrages. Seule la création d’un nouveau code le déconnecte.',
  'tour.share.tip':
    'Commencez doucement : plusieurs ordinateurs s’additionnent vite. Baissez le volume du casque avant la première connexion.',
  'tour.share.open': 'Ouvrir Partager l’audio',

  'tour.library.kicker': 'VOTRE MUSIQUE, VOTRE LECTEUR',
  'tour.library.title': 'Une Bibliothèque pour la musique que vous possédez',
  'tour.library.subtitle': 'Des dossiers en entrée, des albums en sortie',
  'tour.library.lead':
    'Indiquez un dossier à FluidEQ : il lit chaque morceau et chaque vidéo qu’il contient, tags et pochettes compris, et en fait une collection à parcourir par album, artiste, genre, titre ou dossier. La lecture passe par le lecteur de FluidEQ, donc l’EQ et le rack DSP sont toujours sur le chemin.',
  'tour.library.point1':
    'Trois façons de voir la même étagère : liste, grille et cover flow, avec un saut à la lettre pour les grandes collections.',
  'tour.library.point2':
    'Une file « À suivre » avec « Continuer la lecture », qui enchaîne sur le même genre quand la liste est épuisée.',
  'tour.library.point3':
    'Des playlists et une liste Favoris permanente. Clic droit sur un morceau pour l’ajouter à l’une ou l’autre, ou à la file.',
  'tour.library.point4':
    'Mémoire d’EQ par morceau : activez « Enregistrer pour ce morceau » pendant la lecture et la correction est retenue pour ce titre.',
  'tour.library.how':
    'Ouvrez l’onglet Bibliothèque, appuyez sur « Ajouter un dossier » ou déposez un dossier sur la page, et laissez l’analyse se terminer. Choisissez Albums, Artistes, Genres, Chansons, Dossiers ou Arborescence, puis appuyez sur Lire.',
  'tour.library.open': 'Ouvrir la Bibliothèque',

  'tour.dsp.kicker': 'UN RACK DE MASTERING',
  'tour.dsp.title': 'Le rack DSP',
  'tour.dsp.subtitle': 'Neuf étages, chacun avec son graphe',
  'tour.dsp.lead':
    'Un rack d’étages de studio, dans l’ordre : Normaliseur, Débruitage, Exciteur, Forge de basses, Égaliseur, Punch des basses, Dimension, Maximiseur et Master, plus un fondu enchaîné entre les pistes de la Bibliothèque. Avec le moteur FluidEQ, il agit sur tout ce que joue l’ordinateur ; avec Equalizer APO, sur la Bibliothèque. Chaque étage est une carte avec un graphe en direct, des préréglages et un bouton Isoler pour n’entendre que ce qu’il fait.',
  'tour.dsp.point1':
    'Débruitage répare le souffle, le ronflement et les craquements pendant la lecture, et un nettoyeur de voix neuronal agit sur les pistes de la Bibliothèque.',
  'tour.dsp.point2':
    'Forge de basses ajoute une vraie octave sous la basse ; Punch des basses en façonne l’attaque, le maintien et l’éclosion, avec un Mix jusqu’à 200 %.',
  'tour.dsp.point3':
    'Un Égaliseur paramétrique à quinze bandes, phase minimale ou linéaire, mid/side, suréchantillonnage et des dizaines de préréglages nommés.',
  'tour.dsp.point4':
    'Un Master avec cible de sonie LUFS et sécurité true-peak, des préréglages de livraison du Streaming au Vinyle, et un Gain match pour comparer le son, pas le volume.',
  'tour.dsp.how':
    'Ouvrez l’onglet DSP, choisissez une chaîne sous Préréglages, puis cliquez sur un étage dans les onglets latéraux et activez-le. Avec Equalizer APO, lancez d’abord une piste depuis la Bibliothèque.',
  'tour.dsp.open': 'Ouvrir le DSP',

  'tour.output.kicker': 'JOUE À DEUX ENDROITS',
  'tour.output.title': 'Profils de la seconde sortie',
  'tour.output.subtitle':
    'Casque et enceintes en même temps, chacun avec son profil',
  'tour.output.lead':
    'Écoutez au casque et sur les enceintes avec des égalisations séparées. La seconde sortie reçoit le son avant l’égalisation de la sortie principale, puis applique son propre profil enregistré. Aucun pilote de routage nécessaire.',
  'tour.output.point1':
    'Activez un autre appareil dans Seconde sortie et réglez son volume.',
  'tour.output.point2':
    'Choisissez un profil enregistré avec le sélecteur de profil d’égalisation sous cet appareil. La sortie principale garde ses réglages.',
  'tour.output.point3':
    'Un lecteur à la fois : lancer quelque chose dans FluidEQ met le reste de la machine en pause, et inversement.',
  'tour.output.point4':
    'Jeu/Vidéo démarre avec environ 30 ms de réserve et se resynchronise après une interruption ; Musique démarre avec environ 100 ms pour une écoute plus fluide. Le tampon de l’appareil ajoute du retard.',
  'tour.output.how':
    'Ouvrez l’onglet EQ puis Seconde sortie à droite. Activez un appareil, choisissez son profil sous son nom, réglez le volume et sélectionnez Jeu/Vidéo ou Musique.',
  'tour.output.open': 'Ouvrir l’EQ',
  'tour.output.imageAlt':
    'Le panneau Seconde sortie avec un BlackShark V2 Pro activé, son sélecteur de profil, son volume et les modes Jeu/Vidéo et Musique.',

  'tour.looks.kicker': 'VOTRE PROPRE VISUALISEUR',
  'tour.looks.title': 'Des styles à vous pour le graphe',
  'tour.looks.subtitle': 'Trente-huit formes, vos couleurs, votre mouvement',
  'tour.looks.lead':
    'Le spectre sous l’EQ se dessine comme vous voulez. Choisissez une des trente-huit formes, des simples barres et lignes aux terrasses, aux silhouettes de villes et à un pont nocturne avec sa circulation ; colorez-la avec sa propre coloration Auto, par fréquence, par niveau ou par chaleur ; réglez la vitesse d’attaque et la durée de maintien d’un pic ; marquez les pics d’étincelles, de comètes ou d’ondes. Enregistrez-le comme style à vous, et partagez-le en fichier.',
  'tour.looks.point1':
    'Trente-huit formes, chacune avec ses réglages : éléments, écart, remplissage, épaisseur, et remplie ou en contour.',
  'tour.looks.point2':
    'Colorez chaque forme avec sa propre coloration Auto, par fréquence, niveau ou chaleur avec un dégradé de vos propres couleurs, ou d’une seule couleur uniforme.',
  'tour.looks.point3':
    'Attaque et relâchement fixent le mouvement ; les pics lumineux, les crêtes remplies et douze marques de pic décident de l’allure d’un coup.',
  'tour.looks.point4':
    'La lueur fonctionne dans tous les modes, et le mode arc-en-ciel ajoute une bordure qui parcourt toute la roue des couleurs. Les styles s’exportent en fichier et s’importent depuis un fichier.',
  'tour.looks.how':
    'Dans l’onglet EQ, appuyez sur « Nouveau style » dans la barre du graphe. Choisissez une forme avec le sélecteur ou appuyez sur Espace pour les faire défiler, réglez couleurs et mouvement pendant que la musique joue, puis Enregistrer.',
  'tour.looks.open': 'Ouvrir l’EQ',

  'tour.karaoke.kicker': 'UNE SCÈNE À LA MAISON',
  'tour.karaoke.title': 'Le karaoké avec guide de justesse',
  'tour.karaoke.subtitle': 'Vos chansons, vos paroles, votre micro',
  'tour.karaoke.lead':
    'Déposez une chanson avec ou sans fichier de paroles : FluidEQ les associe dans une playlist, affiche les paroles synchronisées sur la pochette ou la vidéo, écoute votre micro et trace votre hauteur face à la mélodie. Tout reste sur cet ordinateur ; le micro n’est jamais enregistré ni rejoué.',
  'tour.karaoke.point1':
    'Un curseur Voix guide qui va de l’original à l’accompagnement seul, retirant la voix principale sans fichier séparé.',
  'tour.karaoke.point2':
    'Une piste de hauteur en vue Notes ou Courbe : les notes de la chanson en blocs, votre voix en ligne vivante, avec retour Haut, Juste et Bas.',
  'tour.karaoke.point3':
    'Un bilan de performance à la fin, avec les passages à travailler et un décompte pour recommencer.',
  'tour.karaoke.point4':
    'Lit LRC, LRC enrichi avec timing par mot et UltraStar avec syllabes et hauteur, sur MP3, FLAC, WAV, OGG, M4A et plus. Paroles traduites et accords de guitare estimés en prime.',
  'tour.karaoke.how':
    'Ouvrez l’onglet Karaoké, appuyez sur « Ouvrir une chanson » ou « Ajouter un dossier », choisissez une piste dans la playlist, activez le micro, affichez le guide de justesse et appuyez sur Lecture.',
  'tour.karaoke.open': 'Ouvrir le Karaoké',

  'tour.maker.kicker': 'CRÉEZ LE VÔTRE',
  'tour.maker.title': 'Le Créateur de karaoké',
  'tour.maker.subtitle': 'N’importe quelle chanson devient un fichier karaoké',
  'tour.maker.lead':
    'Un vrai studio d’édition dans l’onglet Karaoké. Il peut tout faire seul : séparer la voix de la musique, lire les mots et leur timing avec un modèle de parole local, et détecter les notes de la mélodie. Ou vous tapez, enregistrez et dessinez chaque timing à la main sur une timeline zoomable. Tout tourne sur cet ordinateur.',
  'tour.maker.point1':
    '« Configurer cette chanson automatiquement » : séparer la voix, puis lire les mots et le timing, avec l’option de continuer en arrière-plan.',
  'tour.maker.point2':
    'Gardez les pistes séparées : la voix et l’accompagnement, chacune enregistrable, y compris en MP3.',
  'tour.maker.point3':
    'Des outils manuels pour les détails : taper les mots, enregistrer les entrées de ligne, un inspecteur de mot avec début et durée, et couper un mot en syllabes.',
  'tour.maker.point4':
    'Peignez la mélodie sur une grille de hauteur, marquez les notes dorées, puis exportez en projet FluidEQ, UltraStar TXT, LRC, LRC enrichi ou accompagnement seul.',
  'tour.maker.how':
    'Dans Karaoké, chargez une chanson et appuyez sur « Créer ». Acceptez « Configurer automatiquement » dans l’assistant, corrigez les mots sur la timeline, puis « Utiliser dans le lecteur » et « Exporter ».',
  'tour.maker.open': 'Ouvrir le Karaoké',

  'tour.media.kicker': 'LE WEB, À TRAVERS VOTRE EQ',
  'tour.media.title': 'Médias en ligne',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch et Suno',
  'tour.media.lead':
    'Un lecteur intégré pour les sites de streaming, pour que ce que vous regardez et écoutez en ligne passe par votre EQ plutôt que par un autre navigateur. Cinq sites sont câblés, chacun avec sa recherche, et les liens qui mènent ailleurs sont retenus avec le choix « Ouvrir dans le navigateur ».',
  'tour.media.point1':
    'Un seul champ de recherche qui interroge le site ouvert, avec des recherches récentes que vous pouvez effacer.',
  'tour.media.point2':
    '« Bloquer les pubs » saute les publicités vidéo et masque les emplacements publicitaires sur YouTube.',
  'tour.media.point3':
    'Reprise : le lecteur retient la dernière page et l’endroit où vous en étiez, et vous y ramène.',
  'tour.media.point4':
    'Des téléchargements avec pastille de progression et « Afficher dans le dossier » à la fin, et un bouton « Se déconnecter de tous les sites » qui efface chaque cookie et connexion d’un coup.',
  'tour.media.how':
    'Ouvrez l’onglet Médias en ligne, choisissez un site dans la rangée du haut, tapez dans le champ de recherche et appuyez sur Rechercher. Précédent, Suivant et Recharger fonctionnent comme dans un navigateur.',
  'tour.media.open': 'Ouvrir Médias en ligne',
};

export default tour;
