const account = {
  'account.menu': 'Compte',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Compte',
  'account.close': 'Fermer',

  'account.optional':
    'La connexion est facultative. FluidEQ fonctionne exactement comme toujours sans compte : tout s’exécute sur cette machine et rien n’est suivi. Un compte ne sert qu’aux parties qui en ont réellement besoin.',

  'account.signIn': 'Se connecter',
  'account.signUp': 'Créer un compte',
  'account.signInHint':
    'Votre mot de passe part directement au service de comptes et n’est conservé nulle part dans l’application.',
  'account.signUpHint':
    'Un code à six chiffres est envoyé à cette adresse. Saisissez-le ici pour terminer.',
  'account.working': 'Un instant…',
  'account.signOut': 'Se déconnecter',
  'account.signedIn': 'Connecté',
  'account.backToSignIn': 'Retour à la connexion',

  'account.field.email': 'E-mail',
  'account.field.emailHint':
    'jamais affiché à personne — uniquement pour la connexion et les codes',
  'account.field.password': 'Mot de passe',
  'account.field.passwordHint': 'au moins {count} caractères',
  'account.field.name': 'Nom',
  'account.field.optional': 'facultatif',
  'account.field.code': 'Code reçu par e-mail',

  'account.code.sent': 'Nous avons envoyé un code à six chiffres à {email}.',
  'account.code.confirm': 'Confirmer',
  'account.code.sendAgain': 'Renvoyer le code',
  'account.code.sentAgain': 'Renvoyé',
  'account.code.otherEmail': 'Utiliser une autre adresse',
  'account.code.hint':
    'Rien reçu ? Regardez dans les indésirables. Et si un compte existait déjà avec cette adresse, aucun code n’est envoyé : connectez-vous plutôt.',

  'account.forgot.link': 'Mot de passe oublié ?',
  'account.forgot.lead':
    'Saisissez l’adresse de votre inscription et un code y sera envoyé.',
  'account.forgot.submit': 'Envoyer un code de réinitialisation',
  'account.reset.sent':
    'Nous avons envoyé un code à six chiffres à {email}. Saisissez-le ici avec votre nouveau mot de passe.',
  'account.reset.submit': 'Définir le nouveau mot de passe',

  'account.unavailable': 'La connexion n’est pas disponible sur ce système',
  'account.unavailableHint':
    'Il n’existe aucun endroit sûr pour conserver une connexion sur cette machine, donc FluidEQ n’en enregistre pas. Tout le reste fonctionne normalement.',

  'account.error.network':
    'Impossible de joindre le service de comptes. Vérifiez votre connexion et réessayez.',
  'account.error.rejected':
    'Le service de comptes a refusé. Réessayez dans un instant.',
  'account.error.expired':
    'Cette connexion n’est plus valable. Veuillez vous reconnecter.',
  'account.error.malformed':
    'Le service de comptes a envoyé quelque chose que FluidEQ n’a pas pu lire.',
  'account.error.wrongCredentials': 'E-mail ou mot de passe incorrect.',
  'account.error.unconfirmed':
    'Ce compte n’est pas encore confirmé. Saisissez le code reçu par e-mail pour terminer.',
  'account.error.weakPassword':
    'Ce mot de passe est trop facile à deviner. Essayez-en un plus long, et que vous n’avez pas déjà utilisé.',
  'account.error.badCode':
    'Ce code est faux ou a expiré. Demandez-en un nouveau.',
  'account.error.rateLimited':
    'Trop de tentatives en peu de temps. Attendez une minute et réessayez.',
  'account.error.invalidEmail': 'Cela ne ressemble pas à une adresse e-mail.',
  'account.error.alreadyRegistered':
    'Un compte existe déjà avec cette adresse. Connectez-vous plutôt.',

  'account.plus.eyebrow': 'FluidEQ Plus',
  'account.plus.pitch':
    'Des visualiseurs qui n’existent nulle part ailleurs, publier dans la communauté, le classement, une ligne directe pour demander des fonctions — et chaque nouveauté à partir de maintenant, d’abord pour les membres. Tout ce qui est gratuit aujourd’hui le reste.',
  'account.plus.upgrade': 'Passer à Plus',
  'account.plus.opening': 'Ouverture…',
  'account.plus.checkoutHint':
    'Ouvre Buy Me a Coffee dans votre navigateur. Payez avec la même adresse e-mail que ce compte pour que FluidEQ la reconnaisse ; l’application ne voit jamais votre carte.',
  'account.plus.active': 'Actif',
  'account.plus.renews': 'Renouvellement le {date}',
  'account.plus.ends': 'Fin le {date}',
  'account.plus.manage': 'Gérer l’abonnement',
  'account.plus.grace':
    'Votre abonnement n’a pas pu être confirmé. Il reste actif jusqu’au {date} — connectez-vous à Internet avant pour le conserver.',
  'account.plus.checkAgain': 'Vérifier à nouveau',
  'account.plus.perMonth': '{price} / mois',
  'account.plus.perYear': '{price} / an',
  'account.plus.priceChoice': '{monthly} ou {yearly}',
  'account.plus.checkoutOpened':
    'Buy Me a Coffee est ouvert dans votre navigateur. Revenez ici une fois le paiement fait, et Plus s’active.',
  'account.plus.error.rejected':
    'La page de paiement n’a pas pu s’ouvrir. Réessayez dans un instant.',

  'account.dev.label': 'Développement',
  'account.dev.start': 'Simuler un paiement',
  'account.dev.cancel': 'Simuler une annulation',
  'account.dev.working': 'Envoi…',

  'account.perk.looks': 'Des styles Plus, dessinés par la carte graphique.',
  'account.perk.community':
    'Une communauté que tout le monde peut lire et où les membres publient.',
  'account.perk.board': 'Un classement de qui écoute le plus.',
} as const;

export default account;
