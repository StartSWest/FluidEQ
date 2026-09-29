const troubleshoot = {
  'troubleshoot.title': 'Résoudre les problèmes audio',
  'troubleshoot.description':
    'Suivez la liste dans l’ordre et arrêtez-vous à la première étape qui aide. Chacune est plus lourde que la précédente, et la première règle la plupart des problèmes.',
  'troubleshoot.footer':
    'Toujours un problème après tout cela ? Utilisez **{report}** dans le même menu : il rassemble les journaux, en retire tout ce qui pourrait vous identifier et vous montre l’ensemble avant tout envoi.',
  'troubleshoot.tried': 'Essayé',
  'troubleshoot.restart.title': 'Redémarrer l’audio de Windows',
  'troubleshoot.restart.when':
    'Le son s’est arrêté, ou le graphique reste plat alors que quelque chose joue. C’est la solution dans presque tous les cas, et la première à essayer.',
  'troubleshoot.restart.cost':
    'Quelques secondes de silence. Windows demande l’autorisation.',
  'troubleshoot.apo.reselect.title':
    'Resélectionner vos appareils dans Equalizer APO',
  'troubleshoot.apo.reselect.when':
    'Un appareil est égalisé et un autre non, ou un casque que vous venez de brancher est ignoré. Equalizer APO s’attache à chaque sortie séparément, et un nouvel appareil n’est pas pris en charge tant que vous ne l’avez pas coché.',
  'troubleshoot.apo.reselect.cost':
    'Ouvre le Device Selector d’Equalizer APO. Un redémarrage ensuite.',
  'troubleshoot.apo.openSelector': 'Ouvrir le Device Selector',
  'troubleshoot.apo.mode.title': 'Essayer l’autre mode d’installation',
  'troubleshoot.apo.mode.when':
    'Un appareil est coché dans le Device Selector et n’a toujours aucun effet, ou le cocher le rend complètement muet. Equalizer APO peut s’attacher à l’audio de Windows de deux façons, et certains matériels ne fonctionnent qu’avec l’une d’elles.',
  'troubleshoot.apo.mode.cost':
    'Un redémarrage. Réversible : revenez en arrière de la même façon.',
  'troubleshoot.apo.mode.detail':
    'Dans le Device Selector, ouvrez **Troubleshooting options**. Par défaut, l’installation se fait en **APO**, ce qui fonctionne sur la plupart des machines. **Install as SFX/EFX** est l’autre option, à choisir pour les appareils dont les pilotes apportent leurs propres effets — beaucoup d’audio de portables et de gaming. Si un appareil ne fonctionne plus après l’avoir coché, essayez l’autre mode avant de conclure qu’il ne peut pas être égalisé.',
  'troubleshoot.apo.reinstall.title': 'Réinstaller Equalizer APO',
  'troubleshoot.apo.reinstall.when':
    'Les deux premières étapes n’ont rien changé, ou Windows a été mis à jour et l’égaliseur ne fonctionne plus depuis. Son installateur est aussi son outil de réparation : il réenregistre le composant audio et rouvre la liste des appareils.',
  'troubleshoot.apo.reinstall.cost':
    'Une autorisation d’administrateur, et l’ordinateur doit redémarrer ensuite. Vos profils et préréglages FluidEQ ne sont pas modifiés.',
  'troubleshoot.apo.readd.title': 'Retirer l’appareil, redémarrer, le rajouter',
  'troubleshoot.apo.readd.when':
    'Seulement si un appareil précis pose encore problème après une réinstallation. Décochez-le dans le Device Selector, redémarrez l’ordinateur, puis cochez-le de nouveau et redémarrez encore une fois.',
  'troubleshoot.apo.readd.cost': 'Deux redémarrages.',
  'troubleshoot.apo.readd.detail':
    'Les deux redémarrages ne sont pas de la superstition. Equalizer APO s’attache à un point de sortie audio au démarrage de la machine : un appareil détaché pendant que Windows tourne reste à moitié attaché jusqu’au redémarrage, et le rajouter avant remet aussitôt l’état défaillant.',
  'troubleshoot.engine.enable.title':
    'Remettre le moteur FluidEQ sur vos sorties',
  'troubleshoot.engine.enable.when':
    'Un appareil est égalisé et un autre non, ou un casque que vous venez de brancher est ignoré. Le moteur s’attache à chaque sortie séparément, et une mise à jour de Windows peut le détacher d’une sortie où il était déjà.',
  'troubleshoot.engine.permission':
    'Windows demande l’autorisation, et l’audio redémarre un instant. Pas de redémarrage de l’ordinateur.',
  'troubleshoot.engine.remove.title':
    'Retirer le moteur FluidEQ de cette sortie',
  'troubleshoot.engine.remove.when':
    'Seule cette sortie pose un problème qu’aucune étape ci-dessus ne règle, ou vous voulez la rendre à un autre logiciel audio. Le moteur est retiré de la sortie sur laquelle Windows joue en ce moment, et ce qu’il avait remplacé est remis en place.',
  'troubleshoot.engine.remove.cost':
    'Windows demande l’autorisation, et l’audio redémarre un instant. Vos autres sorties ne sont pas touchées, et l’étape ci-dessus le remet en place.',
  'troubleshoot.engine.remove.action': 'Retirer de cette sortie',
} as const;

export default troubleshoot;
