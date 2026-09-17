const engineHealth = {
  'engineHealth.offTitle': 'Le moteur FluidEQ ne tourne pas sur {device}',
  'engineHealth.offBody':
    'Cette sortie joue du son sans votre EQ. Redémarrer l’audio de Windows ramène généralement le moteur, et tout le reste de FluidEQ continue de fonctionner en attendant.',
  'engineHealth.neverRanTitle': 'Windows n’a jamais démarré le moteur FluidEQ',
  'engineHealth.neverRanBody':
    'Le moteur est installé et placé sur {device}, et Windows ne l’y a pas chargé une seule fois : redémarrer l’audio ne le ramènera donc pas. FluidEQ a déjà corrigé tout ce qu’il peut atteindre ; si cela persiste, c’est votre logiciel de sécurité ou le pilote de votre carte son qui l’en empêche. Equalizer APO traite votre son en attendant.',
  'engineHealth.bypassedTitle':
    'Votre son ne passe pas par FluidEQ sur {device}',
  'engineHealth.bypassedBody':
    'Le moteur est installé et activé pour cette sortie, et Windows joue la musique à côté de lui : aucun son ne lui est parvenu. Une sortie a plusieurs emplacements pour un effet, et Windows en choisit un différent selon le type de lecture ; FluidEQ occupe un emplacement par lequel cette musique ne passe pas. En changer demande une autorisation Windows et une seconde de silence.',
  'engineHealth.tryAnotherSlot': 'Essayer un autre emplacement',
  'engineHealth.partlyOff': 'EN PARTIE DÉSACT.',
  'engineHealth.problemsTitle':
    'Une partie de votre son n’atteint pas {device}',
  'engineHealth.problem.convolution':
    'La convolution est désactivée : le moteur n’a pas pu charger la réponse impulsionnelle. Essayez un autre fichier.',
  'engineHealth.problem.eq-phase':
    'L’EQ à phase linéaire n’a pas pu démarrer ; les filtres d’origine restent actifs.',
  'engineHealth.problem.graphic-eq':
    'L’EQ graphique est désactivé : le moteur n’a pas pu construire sa courbe.',
  'engineHealth.problem.dsp-rack':
    'Les effets DSP sont désactivés : le moteur n’a pas pu les démarrer.',
  'engineHealth.problem.reload-failed':
    'Votre dernière modification ne s’est pas chargée ; la précédente est toujours active.',
  'engineHealth.problem.unwatched':
    'Le moteur ne voit pas les modifications que vous faites pour cette sortie.',
  'engineHealth.problem.other':
    'Une autre tâche demandée au moteur ne s’exécute pas.',
  'engineHealth.engineIsOld':
    'Le moteur FluidEQ installé sur ce PC n’est pas celui que cette version de FluidEQ apporte.',
  'engineHealth.rackNeedsEngine':
    'Les effets DSP tournent dans le moteur lui-même : redémarrer l’audio de Windows relance donc le même moteur. Ce qui répare, c’est de mettre en place le moteur propre à FluidEQ — une autorisation Windows et une seconde de silence.',
  'engineHealth.useApo': 'Utiliser Equalizer APO…',
} as const;

export default engineHealth;
