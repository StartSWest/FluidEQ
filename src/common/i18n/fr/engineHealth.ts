const engineHealth = {
  'engineHealth.offTitle': 'Le moteur FluidEQ ne tourne pas sur {device}',
  'engineHealth.offBody':
    'Cette sortie joue du son sans votre EQ. Redémarrer l’audio de Windows ramène généralement le moteur, et tout le reste de FluidEQ continue de fonctionner en attendant.',
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
  'engineHealth.useApo': 'Utiliser Equalizer APO…',
} as const;

export default engineHealth;
