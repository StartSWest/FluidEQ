const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Conditions, et ce que l’application envoie',
  'terms.meta': 'Version {version} · En vigueur depuis le {date}',
  'terms.intro':
    'Tout, en termes simples. C’est ce que vous acceptez en vous abonnant, et la liste de chaque information que l’application envoie, quand elle part et qui peut la voir.',
  'terms.link': 'Conditions de Plus et ce que l’application envoie',

  'terms.short.title': 'La version courte',
  'terms.short.price.title': '{price}, résiliable à tout moment',
  'terms.short.price.body':
    'Payé sur Buy Me a Coffee. FluidEQ ne voit jamais votre carte.',
  'terms.short.free.title': 'Rien de gratuit n’est retiré',
  'terms.short.free.body':
    'FluidEQ continue de fonctionner hors ligne et sans compte, comme toujours.',
  'terms.short.choice.title': 'Vous choisissez ce qui est partagé',
  'terms.short.choice.body':
    'Le classement est désactivé tant que vous ne le rejoignez pas, et vous décidez de ce que vous publiez et des scènes que vous partagez.',
  'terms.short.music.title': 'Jamais votre musique',
  'terms.short.music.body':
    'Aucun titre, fichier, son ou appareil ne quitte jamais votre ordinateur.',

  'terms.membership.title': 'L’abonnement',
  'terms.membership.p1':
    'Plus ajoute à FluidEQ des visualiseurs premium, le Studio pour créer les vôtres et les partager avec d’autres membres, la publication dans la communauté et le classement. Il coûte {price} et se renouvelle à la fin de chaque période payée jusqu’à ce que vous le résiliiez.',
  'terms.membership.p2':
    'Le paiement est géré par Buy Me a Coffee, selon ses propres conditions. FluidEQ ne voit jamais votre carte ni vos coordonnées bancaires. Vous pouvez résilier à tout moment sur Buy Me a Coffee : Plus reste actif jusqu’à la fin de la période payée, et rien d’autre n’est prélevé.',
  'terms.membership.p3':
    'Si un prélèvement était une erreur, ou si Plus n’est pas pour vous, demandez-le dans les {refundDays} jours qui suivent ce prélèvement et il est remboursé intégralement, sans question.',
  'terms.membership.p4':
    'Quand un abonnement prend fin, les styles Plus et les scènes des membres se verrouillent à nouveau et FluidEQ revient à ses styles gratuits ; rien de ce que vous avez créé n’est supprimé. Plus continue de fonctionner hors ligne jusqu’à {graceDays} jours après la dernière confirmation de votre abonnement par l’application. Rien de gratuit n’est jamais touché.',

  'terms.account.title': 'Votre compte',
  'terms.account.p1':
    'Un compte, c’est une adresse e-mail et un mot de passe, et il faut avoir au moins {age} ans pour en créer un. Le mot de passe voyage chiffré jusqu’au service de connexion, qui ne le conserve que sous forme d’empreinte à sens unique, illisible pour quiconque, créateur compris.',
  'terms.account.p2':
    'Votre e-mail reçoit les codes qui confirment votre adresse et réinitialisent votre mot de passe. Il n’est jamais montré aux autres membres : dans la communauté, vous apparaissez sous l’identifiant et le nom d’affichage que vous choisissez.',
  'terms.account.p3':
    'Sur votre ordinateur, l’application conserve votre session chiffrée par le système d’exploitation. Les comptes sont personnels : gardez votre mot de passe pour vous.',

  'terms.sent.title': 'Ce que l’application envoie, et quand',
  'terms.sent.intro':
    'Uniquement pour les fonctions que vous utilisez, et toujours par une connexion chiffrée. Sans compte, la seule requête est celle de la liste publique des styles Plus, et elle ne contient rien sur vous.',
  'terms.sent.when': 'Quand',
  'terms.sent.who': 'Qui peut le voir',
  'terms.sent.signIn.what': 'Votre e-mail et votre mot de passe',
  'terms.sent.signIn.when':
    'Quand vous créez un compte, vous connectez ou confirmez votre adresse',
  'terms.sent.signIn.who':
    'Le service de connexion conserve votre e-mail, et le mot de passe seulement sous forme d’empreinte illisible.',
  'terms.sent.membership.what': 'Votre jeton de connexion',
  'terms.sent.membership.when':
    'Au démarrage de l’application, quand vous revenez à l’ordinateur et quand vous ouvrez une fonction Plus',
  'terms.sent.membership.who':
    'Rien n’est conservé. Le serveur répond seulement si votre abonnement est actif.',
  'terms.sent.payment.what':
    'Votre e-mail de paiement et l’état de l’abonnement, envoyés par Buy Me a Coffee',
  'terms.sent.payment.when': 'Quand vous payez, renouvelez ou résiliez',
  'terms.sent.payment.who':
    'Le créateur, pour relier le paiement à votre compte. Payez avec l’e-mail de votre connexion.',
  'terms.sent.looks.what': 'Votre jeton de connexion',
  'terms.sent.looks.when':
    'Quand des styles Plus sont téléchargés ou mis à jour, et quand l’application vérifie quelles scènes partagées ont été retirées',
  'terms.sent.looks.who':
    'Rien n’est conservé. Chaque style est signé, et votre ordinateur vérifie la signature avant de le lire.',
  'terms.sent.catalogue.what': 'Rien sur vous',
  'terms.sent.catalogue.when':
    'Quand le sélecteur de styles montre les styles Plus existants, avec ou sans compte',
  'terms.sent.catalogue.who':
    'Rien n’est conservé. La requête récupère seulement la liste publique des styles.',
  'terms.sent.community.what':
    'Votre identifiant et votre nom d’affichage, vos messages et leurs @mentions, les signalements que vous faites et les personnes que vous bloquez',
  'terms.sent.community.when':
    'Quand vous créez votre profil, publiez, signalez ou bloquez',
  'terms.sent.community.who':
    'Messages, identifiants et noms d’affichage : tous les membres connectés. Signalements : le créateur. Blocages : vous seul.',
  'terms.sent.board.what':
    'Un nombre par jour : les minutes entières de musique jouée, jusqu’à {capHours} heures, avec sa date',
  'terms.sent.board.when':
    'Seulement si vous rejoignez le classement : quand vous revenez à l’ordinateur, au plus toutes les {uploadHours} heures, et quand vous ouvrez le classement',
  'terms.sent.board.who':
    'Votre identifiant, votre nom d’affichage, vos points et leur composition : tous les membres connectés.',
  'terms.sent.sceneExport.what':
    'Une scène que vous exportez, avec votre nom d’affichage et l’identifiant de votre compte',
  'terms.sent.sceneExport.when':
    'Quand vous cliquez sur Exporter dans le Studio',
  'terms.sent.sceneExport.who':
    'Rien de la scène n’est conservé. Le créateur garde une trace de la scène et de la version exportées, de la date et d’une empreinte, pour reconnaître une scène bloquée. La personne qui reçoit le fichier voit votre nom d’affichage et l’identifiant de votre compte.',
  'terms.sent.sceneLike.what':
    'Quelle scène d’un membre est à l’écran, et votre J’aime sur elle',
  'terms.sent.sceneLike.when':
    'Quand la scène d’un membre est jouée, pour afficher ses J’aime, et quand vous cliquez sur le cœur ou retirez un J’aime',
  'terms.sent.sceneLike.who':
    'Rien de ce qui est à l’écran n’est conservé. Les membres voient combien de J’aime a une scène, jamais qui les a donnés.',
  'terms.sent.scenePublish.what':
    'Une scène que vous publiez, son image, la catégorie choisie, votre nom d’affichage et l’identifiant de votre compte',
  'terms.sent.scenePublish.when':
    'Quand vous cliquez sur Publier dans le Studio',
  'terms.sent.scenePublish.who':
    'Tous les membres Plus, dans Visualiseurs, jusqu’à ce que vous la dépubliiez : la scène, son image, sa catégorie et votre nom d’affichage. Le créateur garde la trace de votre publication, comme pour un export.',
  'terms.sent.gallery.what':
    'Dans Visualiseurs : ce que vous recherchez, les scènes que vous ouvrez et ajoutez, et toute scène que vous signalez avec son motif',
  'terms.sent.gallery.when':
    'Quand vous parcourez Visualiseurs, cliquez sur Ajouter ou envoyez un signalement',
  'terms.sent.gallery.who':
    'Les recherches et ce que vous ouvrez ne sont pas conservés. Les membres voient combien ont ajouté une scène, jamais qui. Signalements : le créateur seulement.',

  'terms.never.title': 'Ce qui ne quitte jamais votre ordinateur',
  'terms.never.p1':
    'Votre son, et tout ce qui concerne ce que vous écoutez : titres, artistes, fichiers, dossiers et playlists.',
  'terms.never.p2': 'Vos réglages d’égaliseur, vos presets et vos profils.',
  'terms.never.p3':
    'Vos périphériques audio et leurs noms, et les autres applications de votre ordinateur.',
  'terms.never.p4':
    'Les scènes que vous créez et vos dossiers du Studio, sauf si vous exportez ou publiez une scène.',

  'terms.protect.title': 'Comment c’est protégé',
  'terms.protect.p1': 'Chaque requête voyage chiffrée.',
  'terms.protect.p2':
    'Les règles vivent sur le serveur, pas dans l’application : chaque compte ne peut modifier que ses propres données, et une copie modifiée de FluidEQ reçoit exactement les mêmes réponses.',
  'terms.protect.p3':
    'Le classement et le chat affichent des identifiants, jamais d’adresses e-mail ni d’identifiants de compte.',
  'terms.protect.p4':
    'Le créateur administre le serveur et peut voir ce qu’il conserve, pour le faire fonctionner et modérer la communauté. Rien n’est vendu, partagé ni utilisé pour la publicité, et il n’y a ni pistage ni statistiques d’usage.',
  'terms.protect.p5':
    'Le service repose sur Supabase (connexion, base de données et fichiers) et envoie les e-mails via Resend ; les paiements passent par Buy Me a Coffee. Chacun ne reçoit que ce dont sa partie a besoin.',
  'terms.protect.p6':
    'FluidEQ ne conserve aucune adresse IP. L’hébergeur enregistre les requêtes, adresses comprises, dans des journaux de courte durée pour faire fonctionner et protéger le service.',

  'terms.fair.title': 'Fair-play au classement',
  'terms.fair.p1':
    'Le temps d’écoute est compté par l’application sur votre ordinateur, donc le serveur ne peut pas le voir se produire. Il vérifie plutôt chaque nombre : pas plus de {capHours} heures par jour, aucun jour qui n’a pas encore commencé, rien de plus ancien que {windowDays} jours, et aucun jour qui augmente plus vite que l’horloge. Les messages et les mentions sont comptés sur le serveur, à partir de ce qui a vraiment été publié.',
  'terms.fair.p2':
    'Tout le monde gagne ses points de la même façon, le créateur compris. Modifier l’application ou ce qu’elle envoie, automatiser l’écoute ou les messages, ou grimper avec plusieurs comptes vous retire du classement, et peut vous exclure de la communauté.',
  'terms.fair.p3':
    'Chaque J’aime sur vos scènes rapporte {likePoints} points. Un J’aime compte une fois par membre et par scène, seulement de la part de membres Plus, et jamais de votre propre compte. Des J’aime venant d’un second compte à vous comptent comme grimper avec plusieurs comptes.',

  'terms.community.title': 'Règles de la communauté',
  'terms.community.p1':
    'Soyez bienveillant. Pas de harcèlement, de haine, de menaces, de spam, de contenu illégal ni d’informations personnelles sur qui que ce soit. Tous les membres peuvent lire ce que vous publiez : ne partagez que ce que vous acceptez de voir lu.',
  'terms.community.p2':
    'Vous pouvez supprimer vos propres messages à tout moment. Le créateur peut retirer des messages et suspendre les comptes qui enfreignent ces règles. Signalez un message pour l’indiquer ; seul le créateur voit les signalements.',

  'terms.keep.title': 'Ce qui est conservé, et comment l’effacer',
  'terms.keep.p1':
    'Classement : « Supprimer toutes mes données » dans le panneau Compte efface d’un coup chaque jour que vous avez envoyé. Votre ordinateur ne garde que les totaux des {windowDays} derniers jours.',
  'terms.keep.p2':
    'Messages : ils restent jusqu’à ce que vous ou le créateur les supprimiez.',
  'terms.keep.p3':
    'Abonnement : votre e-mail de paiement et son état sont conservés pour relier les paiements à votre compte, et sont effacés avec lui.',
  'terms.keep.p4':
    'Votre compte : demandez sa suppression et il disparaît sous {deletionDays} jours, avec votre profil, vos messages, vos jours au classement et la trace de votre abonnement.',
  'terms.keep.p5':
    'Scènes : une scène publiée reste dans Visualiseurs jusqu’à ce que vous la dépubliiez, ce qui la retire aussitôt avec son image. Ce que vous avez publié, la trace de ce que vous avez exporté, les scènes que vous avez ajoutées, les J’aime que vous avez donnés et ceux que vos scènes ont reçus sont supprimés avec votre compte. Une scène bloquée pour non-respect de ces conditions ne garde que son empreinte, sans votre nom, pour rester bloquée.',

  'terms.looks.title': 'Les styles Plus',
  'terms.looks.p1':
    'Les styles Plus sont l’œuvre du créateur, concédés pour votre usage personnel tant que vous êtes membre. Merci de ne pas les copier, les partager ni les revendre.',
  'terms.looks.p2':
    'FluidEQ reste un logiciel libre sous licence GPL. Rien ici ne change un droit que la GPL vous accorde.',

  'terms.scenes.title': 'Les scènes que vous créez',
  'terms.scenes.p1':
    'Une scène que vous créez dans le Studio est à vous. FluidEQ n’en est pas propriétaire, et la GPL qui couvre FluidEQ ne la couvre pas.',
  'terms.scenes.p2':
    'Elle reste sur votre ordinateur jusqu’à ce que vous choisissiez de l’exporter. Rien de ce que vous créez n’est partagé si vous ne le partagez pas.',
  'terms.scenes.p3':
    'En exportant une scène, vous laissez FluidEQ la vérifier, retirer les commentaires de son shader et la signer de votre nom, pour que d’autres membres Plus puissent la jouer et voir que vous l’avez faite. C’est toute la permission. Le créateur ne vendra pas votre scène, ne l’utilisera pas dans de la publicité et n’en fera pas l’un des styles Plus sans vous le demander d’abord, et cela ne vous empêche de rien faire d’autre avec votre propre travail.',
  'terms.scenes.p4':
    'Partager fait partie de Plus, ce n’est pas un travail : personne n’est payé pour une scène et personne n’en paie une. Ce que vous recevez en retour, ce sont toutes les scènes que les autres membres partagent.',
  'terms.scenes.p5':
    'Les membres qui aiment votre scène vous donnent des points au classement, si vous l’avez rejoint. Les J’aime sont comptés par le serveur ; voir Fair-play.',
  'terms.scenes.p6':
    'Ne partagez que ce que vous avez le droit de partager : vos propres photos et dessins, ou ceux dont le propriétaire l’autorise. Les règles de la communauté s’appliquent aux scènes comme aux messages. Le créateur peut empêcher une scène de s’ouvrir si elle enfreint ces conditions ou les droits de quelqu’un d’autre.',
  'terms.scenes.p7':
    'Une scène qu’un autre membre partage est son œuvre, concédée pour votre usage personnel tant que vous êtes membre. Vous pouvez la jouer, l’aimer et transmettre le fichier sans le modifier à d’autres membres Plus. Merci de ne pas la modifier, la présenter comme la vôtre, la publier ailleurs ou la vendre.',
  'terms.scenes.p8':
    'Un fichier que vous avez envoyé reste chez ceux qui l’ont. Si vous voulez qu’une scène cesse de s’ouvrir partout, demandez-le au créateur, qui peut la bloquer comme une scène qui enfreint les règles.',
  'terms.scenes.p9':
    'Si vous publiez une scène dans Visualiseurs, vous permettez aussi à FluidEQ de l’y garder et de la montrer — avec son image, sa catégorie et votre nom d’affichage — aux membres Plus jusqu’à ce que vous la dépubliiez. Vous pouvez la dépublier à tout moment, avec ou sans Plus. Ceux qui l’ont déjà ajoutée gardent leur copie, aux mêmes conditions qu’un fichier que vous leur auriez envoyé.',
  'terms.scenes.p10':
    'Publier est facultatif et distinct de l’export d’un fichier. Tout membre peut signaler une scène publiée ; seul le créateur lit les signalements et peut retirer une scène qui enfreint ces conditions ou les droits de quelqu’un d’autre.',

  'terms.changes.title': 'Changements, et les petits caractères',
  'terms.changes.p1':
    'Si ces conditions changent, la nouvelle version apparaît ici avec sa date, et l’application vous prévient avant qu’elle s’applique à vous.',
  'terms.changes.p2':
    'FluidEQ et Plus sont fournis tels quels, sans garantie, dans la mesure permise par la loi. Le créateur n’est pas responsable au-delà de ce que vous avez payé pour Plus au cours des douze derniers mois. Rien ici ne vous retire les droits que la loi vous accorde en tant que consommateur.',

  'terms.contact.title': 'Contact',
  'terms.contact.p1':
    'Questions, remboursements, suppression de votre compte ou signalement d’une scène qui utilise votre travail : {contact}.',

  'terms.agree.check':
    'J’ai lu ces conditions, y compris ce que l’application envoie, et je les accepte.',
  'terms.agree.continue': 'Accepter et passer au paiement',
  'terms.agree.opening': 'Ouverture de Buy Me a Coffee…',
  'terms.agree.hint':
    'Le paiement s’ouvre dans votre navigateur. Utilisez le même e-mail que votre compte FluidEQ.',
  'terms.back': 'Retour',
  'terms.error.outdated':
    'Ces conditions ont changé. Mettez FluidEQ à jour pour lire la nouvelle version avant de vous abonner.',
  'terms.error.priceOutdated':
    'Le prix a changé. Mettez FluidEQ à jour pour voir le prix actuel avant de vous abonner.',
};

export default terms;
