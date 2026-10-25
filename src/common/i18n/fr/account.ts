const account = {
  'account.validation.passwordRequired': 'Saisissez votre mot de passe.',
  'account.validation.passwordShort': 'Utilisez au moins {count} caractères.',
  'account.validation.passwordLong': 'Utilisez au maximum 128 caractères.',
  'account.validation.nameLong': 'Utilisez au maximum 80 caractères.',
  'account.validation.code': 'Saisissez le code à six chiffres.',
  'account.menu': 'Compte',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Compte',
  'account.checking': 'Vérification de votre compte…',
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
  'account.signOut.confirm': 'Se déconnecter de ce compte ?',
  'account.signOut.detail': 'Vous pouvez vous reconnecter quand vous voulez.',
  'account.signOut.detailPlus':
    'Vos scènes restent verrouillées ici jusqu’à ce que vous vous reconnectiez.',
  'account.signOut.kept': 'Rien n’est supprimé sur cet ordinateur.',
  'account.name.change': 'Changer de nom',
  'account.name.changeTitle': 'Changer la façon dont vous apparaissez',
  'account.name.changeBody':
    'Votre pseudo et votre nom sur les scènes que vous avez publiées. Ils changent partout à la fois ; votre e-mail reste privé.',
  'account.name.cancel': 'Annuler',
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
  'account.error.signedOutElsewhere':
    'Cet ordinateur a été déconnecté parce que votre compte s’est connecté sur un autre. Un compte reste connecté sur 5 ordinateurs au plus à la fois : reconnectez-vous pour l’utiliser ici, et c’est l’ordinateur utilisé le moins récemment qui sera déconnecté.',
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

  'account.plus.eyebrow': 'FluidEQ',

  'account.perk.looks': 'Des scènes à vous pour de bon, un crédit chacune.',
  'account.perk.visualizers':
    'Visualiseurs : les scènes créées par les membres, ouvertes à tous les comptes.',
  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Continuer avec Google',
  'account.or': 'ou',
  'account.google.waiting':
    'Terminez la connexion avec Google dans votre navigateur.',
  'account.google.cancel': 'Annuler',
  'account.error.googleUnfinished':
    'La connexion avec Google n’a pas abouti. Réessayez ou utilisez votre e-mail.',
  'account.google.doneTitle': 'Vous êtes connecté',
  'account.google.doneBody':
    'Vous pouvez fermer cet onglet et revenir à FluidEQ.',
  'account.google.failedTitle': 'La connexion n’a pas abouti',
  'account.google.failedBody':
    'Revenez à FluidEQ pour réessayer ou connectez-vous avec votre e-mail.',
} as const;

export default account;
