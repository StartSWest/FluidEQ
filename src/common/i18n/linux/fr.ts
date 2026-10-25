/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/** French of `./en.ts`, the Linux wording; see there. */
const fr: Partial<Dictionary> = {
  'wallpaper.manage.empty': 'Chaque écran affiche son fond d’écran habituel.',
  'wallpaper.monitor.ordinary': 'Fond d’écran',
  'wallpaper.pause.locked': 'En pause lorsque l’écran est verrouillé',
  'wallpaper.error.unsupported':
    'Les fonds d’écran nécessitent GNOME et l’extension FluidEQ Desktop.',
  'wallpaper.error.host':
    'Le visualiseur n’a pas pu accéder au bureau. Activez FluidEQ Desktop dans Extensions, puis réessayez.',
  'app.menu.restartAudio': 'Redémarrer l’audio',
  'restart.title': 'Redémarrer l’audio',
  'restart.failed': 'L’audio n’a pas pu être redémarré.',
  'notice.restartConfirm':
    'Le son va s’interrompre quelques secondes, le temps que le moteur FluidEQ redémarre. Continuer ?',
  'notice.restartDone':
    'L’audio a redémarré. Rouvrez les applications encore muettes.',
  'troubleshoot.restart.title': 'Redémarrer l’audio',
  'troubleshoot.restart.cost':
    'Quelques secondes de silence, le temps que le moteur FluidEQ redémarre. Aucun mot de passe.',
  'engine.title': 'Comment FluidEQ traite votre son',
  'engine.subtitle':
    'Le moteur FluidEQ tourne à côté de votre serveur de son, PipeWire ou PulseAudio, tant que FluidEQ est ouvert.',
  'engine.fluid.l1':
    'Fonctionne avec PipeWire et PulseAudio, sur toute distribution',
  'engine.fluid.l2':
    'L’EQ et le rack DSP s’appliquent à tout ce que vous entendez, sans redémarrage',
  'engine.fluid.l3':
    'Les lignes Plugin: et les plugins VST de la configuration ne fonctionnent pas',
  'output.hint':
    'Les modifications s’enregistrent dans le profil actif et suivent cette sortie chaque fois que c’est elle qui joue.',
  'extraOutput.ambiguous':
    'Deux sorties portent ce nom, FluidEQ ne peut donc pas savoir laquelle vous visez. Renommez-en une dans vos paramètres de son.',
  'extraOutput.unmatched':
    'Vos paramètres de son listent cette sortie mais FluidEQ ne peut pas l’atteindre, la duplication vers elle est donc impossible.',
  'convolution.eyebrow': 'RÉPONSES IMPULSIONNELLES',
  'convolution.notice.fluid':
    'Le catalogue téléchargeable est fourni par AutoEq. Chaque téléchargement correspond à la fréquence à laquelle fonctionne votre sortie, et le moteur FluidEQ convertit lui-même toute autre fréquence.',
  'graph.scene.gpu.auto': 'Le système décide',
  'settingsReset.body':
    'Le graphique et les visualiseurs, Couleurs de la fenêtre, le lecteur, la Bibliothèque, la langue, les Animations, Démarrer avec la session et le fond d’écran reviennent à l’état d’une nouvelle installation de FluidEQ.',
  'app.processes.hint':
    "Votre système nomme chacun d'eux comme l'application, car c'est le même programme. Voici ce que chacun fait réellement pour FluidEQ.",
  'app.processes.what.engine':
    "Le moteur propre à FluidEQ. Décode ce que vous écoutez et applique l'égaliseur au passage. C'est un programme distinct du reste, pour qu'une fenêtre occupée ne puisse pas bloquer la musique.",
  'app.processes.what.devices':
    "Démarré par Chromium quand l'application demande quels périphériques audio sont présents ; la même requête énumère aussi les périphériques vidéo. Il n'ouvre aucune caméra et n'enregistre rien.",
  'app.processes.name.systemEngine': 'Moteur FluidEQ (audio système)',
  'app.processes.what.systemEngine':
    "L'égaliseur placé entre vos applications et votre serveur de son, lequel l'applique à tout ce que vous entendez. FluidEQ le démarre et l'arrête avec lui-même ; sa mémoire et son processeur sont affichés mais pas ajoutés au total.",
  'dsp.normalizer.liveGuidance':
    'Le nivellement en direct suit le morceau en cours de lecture. Un passage fort baisse le gain pour le reste du morceau ; le suivant garde ce niveau sauf s’il est nettement plus calme. Les morceaux déjà entendus sont nivelés dès la première seconde. Le gain monte d’au plus 6 dB dans la marge des crêtes ; la cible n’est pas garantie. Désactivez puis réactivez pour relancer l’analyse. Il ne répare pas la distorsion existante.',
  'dsp.latency.hint':
    'Délai ajouté par le traitement du moteur. Le serveur de son, le périphérique et le réseau sont exclus.',
  'dsp.latency.note':
    'Tampons signalés par le moteur à la fréquence actuelle. Le serveur de son, le périphérique et le réseau sont exclus.',
  'dsp.surround.onHint':
    'Fait passer le rack sur chaque canal d’une sortie 5.1 ou 7.1, selon le réglage de votre sortie, avec une seule décision de niveau pour tous.',
  'update.mandatory.failedInstall':
    'La mise à jour a été téléchargée, mais le programme d’installation n’a pas démarré. Le fichier téléchargé est peut-être endommagé.',
  'startup.label': 'Démarrer avec la session',
  'startup.blocked':
    'Votre bureau l’a désactivé dans ses applications de démarrage',
  'startup.failed': 'Votre système a refusé ce changement',
  'disclaimer.liability':
    'FluidEQ modifie le traitement du son sur votre ordinateur : son moteur se place entre vos applications et votre serveur de son et traite tout ce que vous entendez. Dans toute la mesure permise par la loi, {author} n’est pas responsable des dommages résultant de son utilisation : à votre audition, à des enceintes, à un casque ou à tout autre matériel, à des données ou à d’autres logiciels, ni à quoi que ce soit d’autre, y compris les pertes que vous n’auriez pas pu prévoir.',
  'provenance.body':
    'Les paquets officiels de FluidEQ sont distribués uniquement via fluideq.com. Les compilations depuis les sources doivent provenir du dépôt officiel. La GPL autorise des tiers à copier, modifier, recompiler et vendre FluidEQ, mais leurs versions ne sont pas vérifiées, prises en charge ni approuvées par FluidEQ. Si un téléchargement se présente comme officiel sans provenir de fluideq.com ni du dépôt officiel, fermez-le et signalez-le.',
  'engineHealth.offBody':
    'Cette sortie joue du son sans votre EQ. Redémarrer l’audio ramène généralement le moteur, et tout le reste de FluidEQ continue de fonctionner en attendant.',
  'engineHealth.rackNeedsEngine':
    'Les effets DSP tournent dans le moteur lui-même. Redémarrer l’audio le relance ; si cela ne suffit pas, réinstaller FluidEQ remet en place son propre moteur.',
  'tour.engine.lead':
    'FluidEQ a désormais son propre moteur audio. Il tourne à côté de votre serveur de son, PipeWire ou PulseAudio, et applique votre EQ et l’ensemble du rack DSP à tout ce que joue l’ordinateur : jeux, navigateurs, applications de streaming — pas seulement la Bibliothèque.',
  'tour.engine.flow.inside': 'À côté de votre serveur de son',
  'tour.dsp.lead':
    'Un rack d’étages de studio : Normaliseur, Débruitage, Exciteur, Forge de basses, Égaliseur, Punch des basses, Dimension, Salle, Maximiseur et Master, plus un fondu enchaîné entre les pistes de la Bibliothèque. Il agit sur tout ce que joue l’ordinateur. Chaque étage a sa propre page avec une vue en direct, la plupart ont des préréglages, et cinq ont un interrupteur Isoler pour n’entendre que ce qu’ils font.',
  'tour.dsp.how':
    'Ouvrez l’onglet DSP, choisissez une chaîne sous Préréglages, puis cliquez sur un étage dans les onglets latéraux et activez-le.',
  'help.start.steps':
    'Installez FluidEQ depuis son .deb ou son AppImage et ouvrez-le : le moteur FluidEQ démarre avec lui, sans mot de passe ni redémarrage.\nChoisissez votre appareil d’écoute sous Périphérique de sortie. Activez l’Égaliseur système et laissez la Normalisation auto activée.\nLancez un morceau, ouvrez Égaliseur → Bandes, faites une petite modification et comparez en désactivant puis en réactivant l’Égaliseur système.',
  'help.start.tip':
    'Sous Linux, l’EQ système nécessite PipeWire ou PulseAudio, qu’utilisent tous les bureaux actuels. Tant que FluidEQ est ouvert, tout ce que vous jouez passe par lui ; le quitter vous rend votre son intact.',
  'help.window.tip':
    'Le menu Aide mène à ce guide, à Nouveautés, au dépannage audio et à Signaler un problème. Le bouton d’impulsion, juste à côté, contient la carte du moteur, votre compte, l’importation de réglages d’égalisation ou d’une réponse impulsionnelle, le redémarrage de l’audio et Processus, qui montre ce que chaque partie de FluidEQ utilise ; tout en bas se trouvent Luminosité et Transparence, les animations, Démarrer avec la session et la langue. Juste après ces deux boutons, un interrupteur transforme la fenêtre en Lecteur compact.',
  'help.window.actions':
    'Le moteur, votre compte, l’importation de réglages d’égalisation, le redémarrage de l’audio et Processus ; Luminosité et Transparence, les animations, Démarrer avec la session et la langue.',
  'help.player.tip':
    'Le volume du lecteur est celui de votre ordinateur : il règle donc le niveau de tout ce que joue l’ordinateur. Si le lecteur se retrouve hors de l’écran, faites un clic droit sur l’icône de FluidEQ dans la barre supérieure et choisissez Récupérer la fenêtre.',
  'help.player.volume':
    'Le volume de votre ordinateur : il règle le niveau de tout ce que joue l’ordinateur.',
  'help.requirements.intro':
    'FluidEQ fonctionne sur n’importe quel bureau Linux 64 bits de ces dernières années — Ubuntu, Debian, Fedora, Mint, Arch et les autres. Deux parties demandent davantage : les visualiseurs Plus dessinent sur la carte graphique, et le karaoké par IA télécharge ses modèles à la première utilisation.',
  'help.requirements.steps':
    'Vérifiez votre système : Linux 64 bits avec PipeWire ou PulseAudio (tout bureau actuel en a un), 4 Go de mémoire et environ 600 Mo de disque. Le .deb est pour Ubuntu, Debian et leurs dérivées ; l’AppImage fonctionne sur les autres.\nOuvrez un visualiseur : n’importe quelle carte graphique ou graphique intégré à partir de 2013. En 1080p, le graphique intégré suffit ; pour la 4K, une carte dédiée vaut mieux. Quand la carte est chargée, FluidEQ dessine la scène plus petite et libère celles que vous ne voyez pas.\nEssayez le karaoké par IA : séparer la voix télécharge un modèle de 713 Mo la première fois, celui de la justesse ajoute environ 180 Mo et la suppression du bruit 11 Mo. Il tourne sur le processeur, où un morceau de quatre minutes se sépare en environ quatre minutes. Gardez 2 Go de mémoire libres pendant ce travail.\nVisez ceci si vous le pouvez : 8 Go de mémoire, une carte graphique à partir de 2018 et 3 Go de disque libres si vous utilisez les fonctions par IA.',
  'help.requirements.keywords':
    'configuration requise, configuration minimale, configuration recommandée, prérequis, spécifications, matériel, mémoire vive, espace disque, stockage, disque dur, PC portable, vieux PC, performances, lent, ralentissements, consommation, ressources, compatibilité, compatible, GPU, CPU, RAM, lag, Linux, Ubuntu, Debian, Fedora, Mint, Arch, PipeWire, PulseAudio, deb, AppImage',
  'help.engine.intro':
    'FluidEQ traite votre son avec son propre moteur. Le moteur FluidEQ tourne à côté de votre serveur de son (PipeWire ou PulseAudio) : il devient la sortie du système, applique votre EQ et le rack DSP à tout ce que joue l’ordinateur, envoie le résultat vers votre vraie sortie, et s’efface dès que FluidEQ se ferme.',
  'help.engine.steps':
    'Ouvrez le menu des actions — le bouton d’impulsion en haut à droite. La carte du moteur, tout en haut, indique si le moteur tourne.\nChoisissez la sortie sur laquelle vous écoutez dans le panneau Sortie. FluidEQ joue vers elle et vous suit quand vous en choisissez une autre dans vos paramètres de son.\nSi un avis indique que le moteur ne tourne pas, appuyez sur Redémarrer l’audio.',
  'help.engine.tip':
    'Laissez FluidEQ comme sortie du système : choisir des enceintes ou un casque dans vos paramètres de son ne pose aucun problème, FluidEQ les suit. Quitter FluidEQ rend chaque application à la sortie que vous avez choisie.',
  'help.engine.keywords':
    'moteur audio, pilote, égaliseur global, partout, navigateur, traitement audio, driver, FluidEQ Engine, Spotify, Deezer, Discord, PipeWire, PulseAudio, serveur de son, sortie, sortie par défaut, redémarrer l’audio',
  'help.engine.apo':
    'Pas sous Linux : Equalizer APO est un programme Windows, et c’est le moteur FluidEQ qui fait ce travail ici.',
  'help.engine.apply':
    'Inutile sous Linux : le moteur FluidEQ est le seul moteur, et c’est déjà celui qui est utilisé.',
  'help.convolution.tip':
    'Le moteur FluidEQ convertit lui-même la fréquence de n’importe quelle impulsion. Les téléchargements du catalogue nécessitent une connexion ; le guide, non.',
  'help.profiles.output':
    'La sortie sur laquelle vous écoutez, avec sa batterie pour un casque Bluetooth. DÉSACT. signifie que votre EQ ne l’atteint pas ; ACTIF, que c’est la sortie qui joue en ce moment.',
  'help.config.tip':
    'Les fichiers de couches générés sont réécrits quand leurs réglages changent ; placez vos lignes manuelles durables dans le fichier personnalisé de chaque sortie. Le moteur FluidEQ en lit les lignes Filter, Preamp, GraphicEQ et Convolution ; les lignes Plugin: et les plugins VST ne fonctionnent pas sous Linux.',
  'help.dsp.intro':
    'Le rack DSP est une chaîne d’étages de studio. Avec le moteur FluidEQ, il traite tout ce que joue l’ordinateur. Il est coupé tant que FluidEQ est désactivé.',
  'help.room.tip':
    'Les jeux et les films n’envoient leurs canaux surround qu’à une sortie configurée avec autant d’enceintes : si votre appareil en a, choisissez 5.1 ou 7.1 pour lui dans vos paramètres de son.',
  'help.online.tip':
    'Avec le moteur FluidEQ, Médias en ligne passe par votre EQ et le rack DSP comme toute autre application.',
  'help.library.tip':
    'Bibliothèque a besoin des fichiers d’origine : rebranchez un disque ou ajoutez de nouveau un dossier déplacé.',
  'help.share.tip':
    'Le code de connexion autorise la liaison : gardez-le privé. Cet ordinateur garde son DSP pendant qu’il partage, et l’ordinateur qui joue son son applique le sien. Jouer et envoyer à la fois demande Windows, ou le moteur FluidEQ sous Linux, sur cet ordinateur ; ailleurs, une liaison fonctionne dans un seul sens.',
  'help.trouble.steps':
    "Aucun son : vérifiez que la lecture est en cours, que la bonne sortie est sélectionnée, que le volume est monté et que l’appareil est connecté. Vérifiez si Un seul lecteur a mis une autre source en pause.\nAucun effet de l’EQ : vérifiez que l’Égaliseur système est activé et que la sortie n’affiche pas le badge DÉSACT. Si un avis indique que le moteur ne tourne pas, appuyez sur Redémarrer l’audio.\nTout semble correct et l'EQ ne fait toujours rien : vérifiez que FluidEQ est toujours la sortie dans vos paramètres de son ; redémarrer l'audio le remet en place.\nDistorsion ou basses excessives : laissez la Normalisation auto activée, réduisez les amplifications et contournez les couches une à une. Si cela persiste, utilisez Signaler un problème et relisez le rapport avant de l’envoyer.",
  'troubleshoot.description':
    'Sous Linux, une seule étape règle presque tous les problèmes : redémarrer le moteur FluidEQ, ce qui prend quelques secondes.',
  'troubleshoot.footer':
    'Toujours un problème après cela ? Utilisez **{report}** dans le même menu : il rassemble les journaux, en retire tout ce qui pourrait vous identifier et vous montre l’ensemble avant tout envoi.',
  'help.window.plus': 'Les visualiseurs, la galerie et le Studio.',
  'help.plus.intro':
    'Le compte est facultatif : tout ce qui était gratuit fonctionne sur cet ordinateur sans compte. Une fois connecté, l’onglet Plus réunit Visualiseurs et le Studio. Une scène de Visualiseurs coûte un crédit et vous appartient pour de bon ; un compte confirmé reçoit quelques crédits gratuits, et les packs de crédits se paient une seule fois.',
  'help.library.steps':
    'Ouvrez la Bibliothèque et ajoutez le dossier contenant vos médias. Laissez l’analyse se terminer avant de juger ce qui manque.\nChoisissez un artiste ou un album, ou recherchez une chanson. Lancez une piste depuis les résultats.\nUtilisez la barre en bas de la fenêtre pour mettre en pause, vous déplacer dans le morceau et passer au suivant. Son volume est celui de votre ordinateur.',
};

export default fr;
