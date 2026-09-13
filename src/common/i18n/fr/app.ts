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

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
  'recovery.title': 'FluidEQ se rétablit',
  'recovery.working':
    'Arrêt de la lecture et rechargement de la fenêtre avec vos réglages enregistrés. Le travail non enregistré peut être perdu.',
  'recovery.stopped':
    'FluidEQ n’a pas pu se rétablir en toute sécurité. Les tentatives automatiques sont arrêtées. Vous pouvez recharger ou quitter. Le travail non enregistré peut être perdu.',
  'recovery.reload': 'Recharger FluidEQ',
  'recovery.quit': 'Quitter',
  'recovery.copy': 'Copier les détails',
  'recovery.history': 'Échecs précédents',
  'app.tagline': 'Votre son. Sur chaque appareil. Automatiquement.',
  'app.actions': 'Actions FluidEQ',
  'app.actions.title': 'Actions audio',
  'app.status.ready': 'Moteur audio connecté',
  'app.status.checking': 'Vérification du moteur audio…',
  'app.status.error': 'Le moteur audio ne répond pas',
  'app.menu.importEq': 'Importer des réglages d’égalisation…',
  'app.menu.importConvolution': 'Importer une réponse impulsionnelle…',
  'app.menu.restartAudio': 'Redémarrer l’audio de Windows',
  'engine.apo.reconfigure': 'Reconfigurer Equalizer APO',
  'engine.apo.settings': 'Réglages d’Equalizer APO',
  'app.menu.support': 'Soutenir le projet',
  'app.menu.fix': 'Corriger',
  'app.menu.reportProblem': 'Signaler un problème',
  'app.menu.about': 'À propos de {product}…',
  'app.processes.menu': 'Processus…',
  'app.processes.eyebrow': 'Processus',
  'app.processes.hint':
    "Windows nomme chacun d'eux comme l'application, car c'est le même programme. Voici ce que chacun fait réellement pour FluidEQ.",
  'app.processes.hintSplit':
    "La séparation est voulue : l'interface, l'affichage et le son tournent chacun de leur côté, pour qu'une fenêtre occupée ne freine pas la musique et qu'une panne dans l'un n'emporte pas les autres.",
  'app.processes.process': 'Processus',
  'app.processes.pid': 'PID',
  'app.processes.memory': 'Mémoire',
  'app.processes.cpu': 'Processeur',
  'app.processes.thisWindow': 'cette fenêtre',
  'app.processes.total': '{megabytes} Mo au total.',
  'app.processes.unmeasured':
    "Un tiret signale une valeur que rien n'a encore mesurée.",
  'app.processes.name.window': 'Interface',
  'app.processes.what.window':
    "La fenêtre que vous regardez : la courbe, la bibliothèque, le lecteur, toutes les commandes. Un processus par fenêtre, pour qu'un redessin lourd ne freine pas le son. Les visualiseurs Plus y tournent dans un fil d'exécution à part, pour qu'une scène lourde ne bloque pas les commandes.",
  'app.processes.name.core': "Cœur de l'application",
  'app.processes.what.core':
    "La partie sans fenêtre. Conserve vos réglages, dialogue avec les périphériques audio et l'égaliseur du système, cherche les mises à jour et démarre tout le reste de cette liste.",
  'app.processes.name.engine': 'Moteur audio (C++)',
  'app.processes.what.engine':
    "Le moteur propre à FluidEQ. Décode ce que vous écoutez et applique l'égaliseur au passage. C'est un programme distinct, d'où son classement à part par Windows.",
  'app.processes.name.graphics': 'Graphismes',
  'app.processes.what.graphics':
    "Dessine tout ce qui est à l'écran sur la carte graphique : le spectre, la courbe, chaque animation et les scènes des visualiseurs Plus. Occupé dès que quelque chose bouge ; aucun modèle ne tourne ici.",
  'app.processes.name.models': 'Modèles karaoké',
  'app.processes.what.models':
    "Sépare la voix de la musique et suit la justesse du chanteur quand un morceau est préparé pour le karaoké. Démarre la première fois qu'il sert et tourne à part, pour qu'un modèle défaillant n'emporte pas l'application.",
  'app.processes.name.libraryScan': 'Analyse de la bibliothèque',
  'app.processes.what.libraryScan':
    'Lit vos dossiers de musique pendant que la bibliothèque les analyse : tags, durées et pochettes. Démarre pour une analyse et se ferme à la fin.',
  'app.processes.name.sound': 'Son du navigateur',
  'app.processes.what.sound':
    "L'audio propre à Chromium, pour l'onglet Vidéo et les sons joués par une page. Votre musique ne passe pas par là.",
  'app.processes.name.network': 'Réseau',
  'app.processes.what.network':
    "Recherche de mises à jour, pochettes et tout ce que charge l'onglet Vidéo. Rien d'autre ici ne touche au réseau.",
  'app.processes.name.devices': 'Liste des périphériques',
  'app.processes.what.devices':
    "Démarré par Chromium quand l'application demande à Windows quels périphériques audio sont présents ; la même requête énumère aussi les périphériques vidéo. Il n'ouvre aucune caméra et n'enregistre rien.",
  'app.processes.name.page': 'Page web',
  'app.processes.what.page':
    "Une page ouverte dans l'onglet Vidéo. Elle tourne dans son propre processus, à l'écart de l'interface.",
  'app.processes.name.helper': 'Service auxiliaire',
  'app.processes.what.helper':
    'Un service Chromium démarré à la demande. FluidEQ ne le réclame jamais par son nom.',
  'app.menu.reinstallApp': 'Réinstaller {product}…',
  'app.menu.fixAudio': 'Résoudre les problèmes audio…',
  'app.menu.audioEngine': 'Moteur audio…',
  'engine.apo.reinstall': 'Réinstaller Equalizer APO…',
  'engine.title': 'Comment FluidEQ doit-il traiter votre son ?',
  'engine.subtitle':
    'Un seul moteur tourne pour tout le PC. En changer demande une autorisation à Windows, une fois.',
  'engine.now': 'Actuellement : {engine}',
  'engine.recommended': 'RECOMMANDÉ',
  'engine.fluid.name': 'Moteur FluidEQ',
  'engine.fluid.l1':
    'Les effets et le panneau de votre carte son continuent de fonctionner',
  'engine.fluid.l2':
    'L’EQ et le rack DSP s’appliquent à tout, sans redémarrage',
  'engine.fluid.l3':
    'Les commandes personnalisées d’APO, Peace et les plugins VST ne fonctionnent pas',
  'engine.apo.name': 'Equalizer APO',
  'engine.apo.l1': 'Commandes personnalisées, Peace, plugins VST',
  'engine.apo.l2':
    'Prend la place de l’emplacement d’effets de votre carte son ; les panneaux du fabricant peuvent perdre des réglages',
  'engine.apo.l3':
    'Le rack DSP ne fonctionne que dans la lecture de la Bibliothèque. Installation à part, et Windows redémarre.',
  'engine.apply': 'Appliquer',
  'engine.cancel': 'Annuler',
  'engine.close': 'Fermer',
  'engine.switched': 'Passé à {engine}',
  'engine.installing': 'Changement de moteur…',
  'engine.declined': 'L’autorisation Windows a été refusée : rien n’a changé.',
  'engine.failed': 'Le moteur n’a pas pu être changé. Rien n’a changé.',
  'engine.detachFailed':
    'Le moteur FluidEQ n’a pas pu être retiré de cette sortie. Rien n’a changé.',
  'engine.unsupported': 'Nécessite Windows 10 version 1803 ou plus récent.',
  'prereq.title.apo': 'Equalizer APO demande votre attention',
  'prereq.title.fluid': 'Le moteur FluidEQ demande votre attention',
  'prereq.install.apo': 'Installer APO',
  'prereq.install.fluid': 'Installer le moteur FluidEQ',
  'prereq.retry': 'Réessayer',
  'prereq.dismiss': 'Ignorer',
  'prereq.credit.apo':
    'Equalizer APO est fourni avec {product} — rien ne sera téléchargé. Son installation demande quelles sorties audio égaliser, puis un redémarrage. Projet GPLv2 distinct de {author}, inclus sans modification.',
  'prereq.starting': 'Démarrage…',
  'prereq.bundleMissing':
    'Cette version ne contient pas sa copie d’Equalizer APO. Ouverture du projet officiel à la place.',
  'prereq.notStarted':
    'Equalizer APO n’a pas démarré — une autorisation administrateur est nécessaire. Réessayez et acceptez l’invite Windows.',
  'whatsNew.eyebrow': 'HISTORIQUE DES VERSIONS',
  'whatsNew.title': 'Notes de version de FluidEQ',
  'whatsNew.loading': 'Chargement des notes de version…',
  'whatsNew.missing':
    'Les notes de version sont introuvables dans cette build. Elles sont aussi sur GitHub.',
  'whatsNew.ok': 'OK',
  'app.menu.whatsNew': 'Nouveautés',
  'app.menu.language': 'Langue',
  'app.window.minimize': 'Réduire',
  'app.window.maximize': 'Agrandir',
  'app.window.restore': 'Restaurer',
  'app.window.close': 'Fermer',
  'app.tray.open': 'Ouvrir {product}',
  'app.tray.quit': 'Quitter {product}',
  'app.tray.tooltip': '{product} — toujours en cours d’exécution',
  'app.tray.installUpdate': 'Installer la mise à jour et redémarrer',
  'app.tray.checkForUpdates': 'Rechercher des mises à jour',
  'app.tray.tooltip.updateReady':
    '{product} — mise à jour prête à être installée',
  'app.notification.updateReady.title': 'Mise à jour FluidEQ prête',
  'app.notification.updateReady.body':
    'La version {version} est prête. Cliquez pour redémarrer FluidEQ.',
  'app.notification.updateReady.bodyNoVersion':
    'Une mise à jour est prête. Cliquez pour redémarrer FluidEQ.',
  'app.notification.upToDate.title': 'FluidEQ est à jour',
  'app.notification.upToDate.body':
    'Vous avez déjà la version la plus récente.',
  'app.notification.updateFound.title': 'Mise à jour FluidEQ trouvée',
  'app.notification.updateFound.body':
    'La version {version} est en cours de téléchargement. Vous serez prévenu lorsqu’elle sera prête à installer.',
  'app.notification.checkFailed.title':
    'Impossible de rechercher des mises à jour',
  'app.notification.checkFailed.body':
    'Le serveur de mise à jour est injoignable. FluidEQ réessaiera plus tard.',
  'app.notification.installFailed.title':
    'Impossible d’installer la mise à jour',
  'app.notification.installFailed.body':
    'FluidEQ n’a pas pu lancer le programme d’installation. Cliquez pour ouvrir FluidEQ et réessayer.',
  'app.window.minimizeApp': 'Réduire FluidEQ',
  'app.window.maximizeApp': 'Agrandir FluidEQ',
  'app.window.restoreApp': 'Restaurer FluidEQ',
  'app.window.closeApp': 'Fermer FluidEQ',
  'app.media.previous': 'Piste précédente',
  'app.media.playPause': 'Lire ou mettre en pause',
  'app.media.next': 'Piste suivante',
  'app.media.previousAria': 'Piste précédente, partout sur cet ordinateur',
  'app.media.playPauseAria':
    'Lire ou mettre en pause, partout sur cet ordinateur',
  'app.media.nextAria': 'Piste suivante, partout sur cet ordinateur',
  'app.dismiss': 'Fermer',
  'common.search': 'Rechercher…',
  'common.recentSearches': 'Recherches récentes',
  'common.clearRecentSearches': 'Effacer les recherches récentes',
  'common.clearSearch': 'Effacer la recherche',
  'common.noMatches': 'Aucun résultat',
  'common.filterOptions': 'Filtrer les options',
  'common.increase': 'Augmenter {item}',
  'common.decrease': 'Diminuer {item}',
  'common.icon.edit': 'Modifier',
  'common.icon.delete': 'Supprimer',
  'common.icon.trash': 'Retirer',
  'common.icon.accept': 'Accepter',
  'common.icon.cancel': 'Annuler',
  'tabs.aria': 'Espace de travail sonore',
  'tabs.eq': 'Égaliseur',
  'tabs.eqMain': 'Bandes',
  'tabs.presets': 'Préréglages EQ',
  'tabs.voicing': 'Caractère',
  'tabs.convolution': 'Convolution',
  'tabs.config': 'Config',
  'tabs.media': 'Médias en ligne',
  'tabs.mediaShort': 'Médias',
  'tabs.karaoke': 'Karaoké',
  'tabs.plus': 'Plus',
  'tabs.scrollBack': 'Faire défiler les onglets vers la gauche',
  'tabs.scrollForward': 'Faire défiler les onglets vers la droite',
  'notice.apoReconfigured':
    'Equalizer APO vient d’être installé ou reconfiguré. En cas de silence, relancez le service audio de Windows plutôt que de redémarrer le PC.',
  'notice.restartNow': 'Redémarrer l’audio maintenant',
  'notice.importComplete': 'Importation terminée',
  'notice.restartConfirm':
    'Le son va s’interrompre quelques secondes et Windows demandera une autorisation d’administrateur. Continuer ?',
  'restart.title': 'Redémarrer l’audio de Windows',
  'restart.action': 'Redémarrer l’audio',
  'restart.running': 'Redémarrage de l’audio…',
  'restart.failed': 'L’audio de Windows n’a pas pu être redémarré.',
  'restart.tryAgain': 'Réessayer',
  'restart.close': 'Fermer',
  'restart.declined':
    'L’autorisation Windows a été refusée, l’audio n’a donc pas été redémarré.',
  'update.title': 'Mise à jour de FluidEQ',
  'update.available':
    'La version {version} est disponible. Téléchargement en cours.',
  'update.downloading': 'Téléchargement de la mise à jour… {percent} %',
  'update.ready':
    'La version {version} est prête. Redémarrez FluidEQ pour terminer.',
  'update.restart': 'Redémarrer maintenant',
  'update.restarting': 'Redémarrage…',
  'update.mandatory.title': 'Cette version doit être mise à jour',
  'update.mandatory.body':
    'Cette version corrige un problème suffisamment grave pour que FluidEQ ne doive pas continuer à fonctionner en l’état. La mise à jour est en cours de téléchargement.',
  'update.mandatory.notOptional':
    'Cette mise à jour n’est pas facultative. Vous pouvez fermer cet avis et terminer ce que vous faisiez : il reviendra tant que FluidEQ n’aura pas été mis à jour.',
  'update.mandatory.later': 'Pas maintenant',
  'update.mandatory.waiting': 'Récupération de la mise à jour…',
  'update.mandatory.readyPrompt':
    'La mise à jour est téléchargée. FluidEQ va se fermer pendant l’installation, puis se rouvrir.',
  'update.mandatory.install': 'Installer et redémarrer',
  'update.mandatory.installing': 'Installation…',
  'update.mandatory.failedDownload':
    'La mise à jour n’a pas pu être téléchargée. Soit le serveur de téléchargement était injoignable, soit la connexion a été coupée en cours de route.',
  'update.mandatory.failedInstall':
    'La mise à jour a été téléchargée, mais le programme d’installation n’a pas démarré. Windows l’a peut-être refusé, ou le fichier téléchargé est endommagé.',
  'update.mandatory.manual':
    'Vous pouvez aussi l’installer vous-même : téléchargez la dernière version depuis la page des versions et exécutez-la. Vos réglages et vos profils sont conservés.',
  'update.mandatory.releasePage': 'Ouvrir la page de téléchargement',
  'notice.restartDone':
    'L’audio de Windows a redémarré. Rouvrez les applications encore muettes.',
  'sidebar.engine': 'MOTEUR',
  'sidebar.systemEq': 'Égaliseur système',
  'sidebar.preamp': 'Préampli',
  'sidebar.preampAria': 'Gain de préamplification (dB)',
  'sidebar.preampAuto':
    'Réglé pour vous. Désactivez la normalisation auto pour y toucher.',
  'sidebar.headroom': 'MARGE APO',
  'sidebar.headroom.fluid': 'MARGE',
  'sidebar.autoPreamp': 'Normalisation auto',
  'sidebar.visualizer': 'VISUALISEUR',
  'sidebar.graphView': 'Courbe de réponse',
  'config.eyebrow': 'CE QUE LIT LE MOTEUR',
  'config.title': 'Configuration Equalizer APO',
  'config.title.fluid': 'Configuration du moteur FluidEQ',
  'config.lede':
    'Ce qui se trouve sur le disque en ce moment, pas ce que FluidEQ prévoit.',
  'config.reload': 'Actualiser',
  'config.reloadTitle': 'Relire la configuration depuis le disque',
  'config.reading': 'Lecture…',
  'config.absent':
    'FluidEQ n’a encore rien écrit dans cette installation d’Equalizer APO.',
  'config.absent.fluid':
    'FluidEQ n’a pas encore écrit la configuration du moteur FluidEQ.',
  'config.status.notIncluded':
    'Equalizer APO n’inclut pas cette configuration. Rien de ce qui suit n’est appliqué.',
  'config.status.notIncluded.fluid':
    'Le moteur FluidEQ ne lit pas cette configuration. Rien de ce qui suit n’est appliqué.',
  'config.status.engineOff':
    'L’égaliseur système est éteint : cette configuration ne nomme aucune sortie, Equalizer APO n’en applique donc rien.',
  'config.status.engineOff.fluid':
    'L’égaliseur système est éteint : cette configuration ne nomme aucune sortie, le moteur FluidEQ n’en applique donc rien.',
  'config.status.active':
    'Active — Equalizer APO applique cette configuration.',
  'config.status.active.fluid':
    'Active — le moteur FluidEQ applique cette configuration.',
  'config.outputsAria': 'Sorties dans la configuration Equalizer APO',
  'config.outputsAria.fluid': 'Sorties dans la configuration du moteur FluidEQ',
  'config.filters.one': '{count} filtre',
  'config.filters.many': '{count} filtres',
  'config.impulse': 'impulsion',
  'config.playingNow': 'En lecture',
  'config.liveTitle': 'L’égalisation continue tient cette mesure à jour',
  'config.layer.on': 'actif',
  'config.layer.off': 'inactif',
  'config.layers.noFile': 'Sans fichier dédié',
  'config.layers.inFile': 'Écrit dans ce fichier, pas dans un fichier dédié.',
  'config.empty': 'Rien d’inclus : cette sortie est laissée telle quelle.',
  'config.file.missing': 'absent',
  'config.export': 'Exporter la chaîne',
  'config.import': 'Importer une chaîne',
  'config.import.hint': 'L’import s’applique à la sortie que vous écoutez.',
  'config.import.customSkipped':
    'Fichier personnel de l’expéditeur ignoré : une ligne Include: ou Plugin: chargerait du code dans l’audio de Windows.',
  'config.file.yours': 'à vous',
  'config.hint.custom': 'À vous. Jamais écrasé.',
  'config.hint.generated': 'Généré : réécrit au prochain changement.',
  'config.hint.saving':
    'Enregistrer écrit le fichier ; Equalizer APO le reprend.',
  'config.hint.saving.fluid':
    'Enregistrer écrit le fichier ; le moteur FluidEQ le reprend.',
  'config.edit': 'Modifier',
  'config.cancel': 'Annuler',
  'config.save': 'Enregistrer',
  'disclaimer.heading': 'Sans garantie et sans responsabilité',
  'disclaimer.asIs':
    'FluidEQ est fourni tel quel, sans garantie d’aucune sorte. Personne ne promet qu’il fonctionne, qu’il convienne à ce que vous voulez en faire, ni qu’il continuera de fonctionner. C’est ce que disent les sections 15 et 16 de la GNU General Public License, et cela s’applique que cette copie vous ait été donnée ou que vous l’ayez payée.',
  'disclaimer.liability':
    'FluidEQ modifie le traitement du son sur votre ordinateur, et il installe et pilote Equalizer APO, un programme distinct qui s’exécute avec les droits d’administrateur et s’insère dans la chaîne audio de Windows. Dans toute la mesure permise par la loi, {author} n’est pas responsable des dommages résultant de son utilisation : à votre audition, à des enceintes, à un casque ou à tout autre matériel, à des données ou à d’autres logiciels, ni à quoi que ce soit d’autre, y compris les pertes que vous n’auriez pas pu prévoir.',
  'disclaimer.volume':
    'Le son peut être fort, et l’égalisation peut le rendre plus fort que l’enregistrement d’origine. Baissez le volume avant de modifier un réglage, puis remontez-le.',
  'disclaimer.localLaw':
    'Certains pays n’autorisent pas un vendeur à exclure certaines garanties ou responsabilités. Dans ce cas, ce sont ces règles qui s’appliquent, et le présent avis ne vous retire aucun droit que la loi vous donne.',
  'disclaimer.accepting': 'En utilisant FluidEQ, vous acceptez ce qui précède.',
  'disclaimer.language':
    'Cet avis a été rédigé en anglais. Si une traduction diffère du texte anglais, c’est le texte anglais qui s’applique.',
  'disclaimer.accept': 'J’ai compris et j’accepte',
  'disclaimer.decline': 'Quitter',
  'provenance.heading': 'Vérifiez d’où vient cette copie',
  'provenance.body':
    'Le programme d’installation officiel signé de FluidEQ est distribué uniquement via fluideq.com. Les compilations depuis les sources doivent provenir du dépôt officiel. La GPL autorise des tiers à copier, modifier, recompiler et vendre FluidEQ, mais leurs versions ne sont pas automatiquement signées, vérifiées, prises en charge ni approuvées par FluidEQ. Si un téléchargement se présente comme officiel sans signature numérique Windows valide, fermez-le et signalez-le.',
  'provenance.site': 'Site officiel : fluideq.com',
  'provenance.repository':
    'Sources officielles : github.com/StartSWest/FluidEQ',
  'language.title': 'Langue',
  'language.aria': 'Langue de l’interface',
  'theme.aria': 'Thème',
  'theme.ocean': 'Océan',
  'theme.black': 'Noir',
};

export default app;
