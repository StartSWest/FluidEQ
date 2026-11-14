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
  'account.working': 'Un instant…',
  'account.signOut': 'Se déconnecter',
  'account.signOut.confirm': 'Se déconnecter de ce compte ?',
  'account.signOut.detail': 'Vous pouvez vous reconnecter quand vous voulez.',
  'account.suspended.failed':
    'Le remboursement n’a pas pu être demandé. Réessayez.',
  'account.suspended.until': 'jusqu’au {date}',
  'account.suspended.daysLeft.other': 'Encore {count} jours',
  'account.suspended.daysLeft.many': 'Encore {count} jours',
  'account.suspended.daysLeft.few': 'Encore {count} jours',
  'account.suspended.daysLeft.one': 'Encore {count} jour',
  'account.suspended.asked':
    'Remboursement demandé : {amount}. Vous le recevrez le {date}, lors de la suppression du compte.',
  'account.suspended.ask': 'Demander le remboursement',
  'account.suspended.maker':
    'Vos scènes ne sont plus dans la galerie, et ce qui vous restait à percevoir a été annulé.',
  'account.suspended.paid': 'Payé pendant ces jours',
  'account.suspended.bodyAsked':
    'Votre compte est suspendu pour avoir enfreint les règles. Vous ne pouvez plus l’utiliser ni acheter.',
  'account.suspended.bodyNothing':
    'Votre compte est suspendu pour avoir enfreint les règles. Vous ne pouvez plus l’utiliser ni acheter. Le {until}, votre compte sera supprimé.',
  'account.suspended.body':
    'Votre compte est suspendu pour avoir enfreint les règles. Vous ne pouvez plus l’utiliser ni acheter. Vous pouvez demander le remboursement de ce que vous avez payé entre le {from} et le {to} jusqu’au {until}. Ce jour-là, votre compte sera supprimé.',
  'account.suspended.title': 'Compte suspendu',
  'account.suspended.eyebrow': 'Compte',
  'account.signOut.detailPlus':
    'Vos scènes restent verrouillées ici jusqu’à ce que vous vous reconnectiez.',
  'account.signOut.kept': 'Rien n’est supprimé sur cet ordinateur.',
  'account.cover.onGraph': '{name} sur le graphique',
  'account.stats.owned': 'À vous',
  'account.stats.likes': 'J’aime',
  'account.scenes.title': 'Votre collection',
  'account.scenes.openGallery': 'Ouvrir la galerie',
  'account.scenes.empty':
    'Les scènes que vous obtenez restent à vous et se lancent sur le graphique d’ici.',
  'account.scenes.playing': 'En cours',
  'account.scenes.unpublished': 'Dépubliée',
  'account.scenes.unpublishedHint':
    'Son créateur l’a retirée de la galerie. Elle reste à vous.',
  'account.scenes.play': 'Lancer {name} sur le graphique',
  'account.published.title': 'Publiées',
  'account.published.live': 'Dans la galerie',
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
  'account.field.code': 'Code reçu par e-mail',

  'account.code.sent': 'Nous avons envoyé un code à six chiffres à {email}.',
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

  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Continuer avec Google',
  'account.google.waiting':
    'Terminez la connexion avec Google dans votre navigateur.',
  'account.google.cancel': 'Annuler',
  // The sign-in screens Ivan approved on 2026-11-13 (`AccountWelcome`).
  'account.welcome.createTitle.one': 'Votre {count} scène vous attend',
  'account.welcome.createTitle.few': 'Vos {count} scènes vous attendent',
  'account.welcome.createTitle.many': 'Vos {count} scènes vous attendent',
  'account.welcome.createTitle.other': 'Vos {count} scènes vous attendent',
  'account.welcome.createLine.one':
    'Un compte gratuit commence avec {count} crédit. Il vous donne une scène à garder pour toujours.',
  'account.welcome.createLine.few':
    'Un compte gratuit commence avec {count} crédits. Chacun vous donne une scène à garder pour toujours.',
  'account.welcome.createLine.many':
    'Un compte gratuit commence avec {count} crédits. Chacun vous donne une scène à garder pour toujours.',
  'account.welcome.createLine.other':
    'Un compte gratuit commence avec {count} crédits. Chacun vous donne une scène à garder pour toujours.',
  'account.welcome.step.create': 'Créez votre compte',
  'account.welcome.step.confirm': 'Confirmez votre e-mail',
  'account.welcome.step.pick.one': 'Choisissez votre {count} scène',
  'account.welcome.step.pick.few': 'Choisissez vos {count} scènes',
  'account.welcome.step.pick.many': 'Choisissez vos {count} scènes',
  'account.welcome.step.pick.other': 'Choisissez vos {count} scènes',
  'account.welcome.backTitle': 'Content de vous revoir',
  'account.welcome.backLine':
    'Vos scènes, vos crédits et vos projets du Studio sont là où vous les avez laissés.',
  'account.welcome.back.scenes':
    'Vos scènes jouent sur chaque ordinateur où vous vous connectez',
  'account.welcome.back.credits': 'Vos crédits, prêts à être dépensés',
  'account.welcome.back.studio': 'Vos scènes du Studio et la galerie',
  'account.welcome.free':
    'L’égaliseur et l’audio de FluidEQ restent gratuits, avec ou sans compte.',
  'account.google.note':
    'Le plus rapide : un clic, aucun mot de passe à retenir.',
  'account.or.email': 'ou avec votre e-mail',
  'account.signUp.withEmail': 'Créer un compte avec l’e-mail',
  'account.signIn.withEmail': 'Se connecter avec l’e-mail',
  'account.signUp.terms':
    'En créant un compte, vous acceptez les Conditions et la Politique de confidentialité.',
  'account.code.step': 'Étape 2 sur 3',
  'account.code.title': 'Consultez vos e-mails',
  'account.code.confirmEmail': 'Confirmer mon e-mail',
  'account.error.googleUnfinished':
    'La connexion avec Google n’a pas abouti. Réessayez ou utilisez votre e-mail.',
  'account.google.doneTitle': 'Vous êtes connecté',
  'account.google.doneBody':
    'Vous pouvez fermer cet onglet et revenir à FluidEQ.',
  'account.google.doneInvite.one':
    'Les nouveaux comptes commencent avec {count} crédit gratuit pour des scènes dans FluidEQ.',
  'account.google.doneInvite.few':
    'Les nouveaux comptes commencent avec {count} crédits gratuits pour des scènes dans FluidEQ.',
  'account.google.doneInvite.many':
    'Les nouveaux comptes commencent avec {count} crédits gratuits pour des scènes dans FluidEQ.',
  'account.google.doneInvite.other':
    'Les nouveaux comptes commencent avec {count} crédits gratuits pour des scènes dans FluidEQ.',
  'account.google.failedTitle': 'La connexion n’a pas abouti',
  'account.google.failedBody':
    'Revenez à FluidEQ pour réessayer ou connectez-vous avec votre e-mail.',
} as const;

export default account;
