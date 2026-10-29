const account = {
  'account.validation.passwordRequired': 'Digite sua senha.',
  'account.validation.passwordShort': 'Use pelo menos {count} caracteres.',
  'account.validation.passwordLong': 'Use no máximo 128 caracteres.',
  'account.validation.nameLong': 'Use no máximo 80 caracteres.',
  'account.validation.code': 'Digite o código de seis dígitos.',
  'account.menu': 'Conta',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Conta',
  'account.checking': 'Verificando sua conta…',
  'account.close': 'Fechar',

  'account.optional':
    'Entrar na conta é opcional. O FluidEQ funciona exatamente como sempre sem conta — tudo roda nesta máquina e nada é rastreado. A conta existe apenas para as partes que realmente precisam dela.',

  'account.signIn': 'Entrar',
  'account.signUp': 'Criar conta',
  'account.signInHint':
    'Sua senha vai diretamente para o serviço de contas e não fica salva em nenhum lugar do app.',
  'account.signUpHint':
    'Um código de seis dígitos segue para esse endereço. Digite-o aqui para terminar.',
  'account.working': 'Um momento…',
  'account.signOut': 'Sair',
  'account.signOut.confirm': 'Sair desta conta?',
  'account.signOut.detail': 'Você pode entrar de novo quando quiser.',
  'account.signOut.detailPlus':
    'Suas cenas ficam bloqueadas aqui até você entrar de novo.',
  'account.signOut.kept': 'Nada é apagado deste computador.',
  'account.cover.onGraph': '{name} no gráfico',
  'account.stats.owned': 'Suas',
  'account.stats.likes': 'Curtidas',
  'account.scenes.title': 'Sua coleção',
  'account.scenes.openGallery': 'Abrir a galeria',
  'account.scenes.empty':
    'As cenas que você obtiver ficam suas para sempre e tocam no gráfico a partir daqui.',
  'account.scenes.playing': 'Tocando',
  'account.scenes.play': 'Tocar {name} no gráfico',
  'account.published.title': 'Publicadas',
  'account.published.live': 'Na galeria',
  'account.name.change': 'Mudar nome',
  'account.name.changeTitle': 'Mude como você aparece',
  'account.name.changeBody':
    'Seu nome de usuário e seu nome nas cenas que você publicou. Mudam em todo lugar ao mesmo tempo; seu email continua privado.',
  'account.name.cancel': 'Cancelar',
  'account.backToSignIn': 'Voltar para o login',

  'account.field.email': 'Email',
  'account.field.emailHint':
    'nunca é mostrado a ninguém — só para entrar e para os códigos',
  'account.field.password': 'Senha',
  'account.field.passwordHint': 'pelo menos {count} caracteres',
  'account.field.name': 'Nome',
  'account.field.optional': 'opcional',
  'account.field.code': 'Código do email',

  'account.code.sent': 'Enviamos um código de seis dígitos para {email}.',
  'account.code.confirm': 'Confirmar',
  'account.code.sendAgain': 'Enviar o código de novo',
  'account.code.sentAgain': 'Enviado de novo',
  'account.code.otherEmail': 'Usar outro email',
  'account.code.hint':
    'Não chegou nada? Veja a pasta de spam. E se você já tinha uma conta com este endereço, nenhum código é enviado: entre em vez disso.',

  'account.forgot.link': 'Esqueceu a senha?',
  'account.forgot.lead':
    'Digite o endereço com que você se cadastrou e um código segue para lá.',
  'account.forgot.submit': 'Enviar código de redefinição',
  'account.reset.sent':
    'Enviamos um código de seis dígitos para {email}. Digite-o aqui com sua nova senha.',
  'account.reset.submit': 'Definir nova senha',

  'account.macKeychainTitle': 'Permita o acesso às Chaves para entrar',
  'account.macKeychainHint':
    'O FluidEQ não conseguiu acessar as Chaves do Mac. Reinicie o FluidEQ para tentar novamente e escolha Permitir na solicitação do macOS. Seus dados salvos continuam criptografados.',
  'account.macKeychainRestart': 'Reiniciar FluidEQ',
  'account.macKeychainRestarting': 'Reiniciando o FluidEQ…',
  'account.macKeychainManual':
    'Encerre o FluidEQ completamente e abra-o novamente para tentar acessar as Chaves.',

  'account.unavailable': 'O login não está disponível neste sistema',
  'account.unavailableHint':
    'Não há um lugar seguro para armazenar uma sessão nesta máquina, por isso o FluidEQ não a armazena. Todo o resto funciona normalmente.',

  'account.error.network':
    'Não foi possível contatar o serviço de contas. Verifique sua conexão e tente de novo.',
  'account.error.rejected':
    'O serviço de contas recusou isso. Tente de novo daqui a um momento.',
  'account.error.expired': 'Essa sessão não é mais válida. Entre de novo.',
  'account.error.signedOutElsewhere':
    'Este computador saiu da conta porque ela entrou em outro. Uma conta fica conectada em até 5 computadores ao mesmo tempo: entre de novo para usá-la aqui, e o computador usado há mais tempo sai no lugar dele.',
  'account.error.malformed':
    'O serviço de contas enviou algo que o FluidEQ não conseguiu ler.',
  'account.error.wrongCredentials': 'Email ou senha errados.',
  'account.error.unconfirmed':
    'Essa conta ainda não foi confirmada. Digite o código do email para terminar.',
  'account.error.weakPassword':
    'Essa senha é fácil demais de adivinhar. Tente uma mais longa, e que você não tenha usado antes.',
  'account.error.badCode': 'Esse código está errado ou expirou. Peça um novo.',
  'account.error.rateLimited':
    'Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.',
  'account.error.invalidEmail': 'Isso não parece um endereço de email.',
  'account.error.alreadyRegistered':
    'Já existe uma conta com esse endereço. Entre em vez disso.',

  'account.plus.eyebrow': 'FluidEQ',

  'account.perk.looks': 'Cenas que são suas para sempre, um crédito cada.',
  'account.perk.visualizers':
    'Visualizadores: as cenas que os membros criam, abertas a todas as contas.',
  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Continuar com o Google',
  'account.or': 'ou',
  'account.google.waiting': 'Termine de entrar com o Google no seu navegador.',
  'account.google.cancel': 'Cancelar',
  'account.error.googleUnfinished':
    'A entrada com o Google não foi concluída. Tente de novo ou use seu e-mail.',
  'account.google.doneTitle': 'Você entrou',
  'account.google.doneBody': 'Você pode fechar esta aba e voltar ao FluidEQ.',
  'account.google.failedTitle': 'A entrada não foi concluída',
  'account.google.failedBody':
    'Volte ao FluidEQ para tentar de novo ou entre com seu e-mail.',
} as const;

export default account;
