const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Termos e privacidade do Plus',
  'terms.meta': 'Versão {version} · Em vigor desde {date}',
  'terms.intro':
    'Estes termos abrangem sua conta FluidEQ e o Plus: acesso, pagamentos, cenas compartilhadas e dados recebidos pelo serviço. Outras funções, como compartilhar áudio, enviar relatos de erros ou usar um assistente de IA externo, podem enviar dados quando usadas e não estão cobertas por esta lista.',
  'terms.link': 'Termos e privacidade do Plus',

  'terms.short.title': 'A versão curta',
  'terms.short.price.title': '{price}, cancela quando quiseres',
  'terms.short.price.body':
    'Pago no Buy Me a Coffee. O FluidEQ nunca vê o teu cartão.',
  'terms.short.free.title': 'Nada gratuito é retirado',
  'terms.short.free.body':
    'O FluidEQ continua a funcionar offline e sem conta, como sempre.',
  'terms.short.choice.title': 'Tu escolhes o que é partilhado',
  'terms.short.choice.body':
    'A classificação está desligada a menos que te juntes, e tu decides quais das tuas cenas partilhas.',
  'terms.short.music.title': 'Nunca a tua música',
  'terms.short.music.body':
    'O serviço Plus não recebe sua música nem os nomes das faixas.',

  'terms.membership.title': 'A subscrição',
  'terms.membership.p1':
    'Com uma conta você pode explorar a galeria e assistir a demonstrações breves. É necessário Plus para baixar e guardar cenas, reproduzi-las por completo, adicioná-las aos seus estilos e criar as suas no Estúdio. O Plus acrescenta ao FluidEQ visualizadores premium, o Estúdio para criares os teus e os partilhares com outros membros, e a classificação. Custa {price} e renova-se no fim de cada período pago até cancelares.',
  'terms.membership.p2':
    'O pagamento é tratado pelo Buy Me a Coffee, segundo os seus próprios termos. O FluidEQ nunca vê o teu cartão nem os teus dados bancários. Podes cancelar a qualquer momento no Buy Me a Coffee: o Plus fica ativo até ao fim do período que pagaste e não é cobrado mais nada.',
  'terms.membership.p3':
    'Se uma cobrança foi um engano, ou se o Plus não é para ti, pede nos {refundDays} dias seguintes a essa cobrança e é reembolsada na totalidade, sem perguntas.',
  'terms.membership.p4':
    'Quando uma subscrição termina, os looks Plus e as cenas dos membros voltam a ficar bloqueados e o FluidEQ volta aos seus looks gratuitos; nada do que criaste é apagado. O Plus continua a funcionar offline até {graceDays} dias depois da última vez que a aplicação confirmou a tua subscrição. Nada do que é gratuito é afetado, nunca.',

  'terms.account.title': 'A tua conta',
  'terms.account.p1':
    'Uma conta é um endereço de email e uma palavra-passe, e precisas de ter pelo menos {age} anos para a criar. A palavra-passe viaja cifrada até ao serviço de início de sessão e só lá é guardada como um hash de sentido único, que ninguém consegue ler, nem o criador.',
  'terms.account.p2':
    'O teu email recebe os códigos que confirmam o teu endereço e repõem a tua palavra-passe. Nunca é mostrado a outros membros: na classificação e em Visualizadores apareces com o nome de utilizador e o nome visível que escolheres.',
  'terms.account.p3':
    'No teu computador, a aplicação guarda a tua sessão cifrada pelo sistema operativo. As contas são pessoais: não partilhes a tua palavra-passe.',
  'terms.account.p4':
    'O Plus funciona em até 5 computadores ao mesmo tempo: em casa e no trabalho, ou os computadores entre os quais o Compartilhar áudio toca. Iniciar sessão num sexto termina a sessão do que está há mais tempo sem uso.',

  'terms.sent.title': 'O que a aplicação envia, e quando',
  'terms.sent.intro':
    'Esta lista descreve as solicitações da conta e do Plus por conexões criptografadas. O catálogo público não exige conta. Os provedores de hospedagem podem registrar metadados das solicitações, incluindo endereços IP. O Fórum usa o GitHub separadamente, como descrito abaixo.',
  'terms.sent.when': 'Quando',
  'terms.sent.who': 'Quem pode ver',
  'terms.sent.signIn.what': 'O teu email e a tua palavra-passe',
  'terms.sent.signIn.when':
    'Quando crias uma conta, inicias sessão ou confirmas o teu endereço',
  'terms.sent.signIn.who':
    'O serviço de início de sessão guarda o teu email, e a palavra-passe só como um hash que ninguém consegue ler.',
  'terms.sent.membership.what': 'O teu token de sessão',
  'terms.sent.membership.when':
    'Quando a aplicação arranca, quando voltas ao computador e quando abres uma funcionalidade Plus',
  'terms.sent.membership.who':
    'O serviço verifica sua assinatura e mantém sessões por dispositivo para aplicar o limite de 5 computadores.',
  'terms.sent.payment.what':
    'O teu email de pagamento e o estado da subscrição, enviados pelo Buy Me a Coffee',
  'terms.sent.payment.when': 'Quando pagas, renovas ou cancelas',
  'terms.sent.payment.who':
    'O criador, para associar o pagamento à tua conta. Paga com o email com que inicias sessão.',
  'terms.sent.looks.what': 'O teu token de sessão',
  'terms.sent.looks.when':
    'Quando os looks Plus são descarregados ou atualizados, e quando a aplicação verifica que cenas partilhadas foram retiradas',
  'terms.sent.looks.who':
    'Cada look é assinado, e o teu computador verifica a assinatura antes de o reproduzir.',
  'terms.sent.catalogue.what': 'Pedido do catálogo público (sem conta)',
  'terms.sent.catalogue.when':
    'Quando o seletor de looks mostra que looks Plus existem, com ou sem conta',
  'terms.sent.catalogue.who':
    'O pedido só descarrega a lista pública de looks.',
  'terms.sent.profile.what': 'O teu nome de utilizador e o teu nome visível',
  'terms.sent.profile.when': 'Quando os escolhes na classificação',
  'terms.sent.profile.who':
    'Todos os membros com sessão iniciada, junto à tua posição na classificação e nas cenas que publicas.',
  'terms.sent.board.what':
    'Um número por dia de cada um dos teus computadores: os minutos inteiros de música que tocou, até {capHours} horas, com a sua data e um número aleatório que distingue os teus computadores',
  'terms.sent.board.when':
    'Só se te juntares à classificação: quando voltas ao computador, no máximo a cada {uploadHours} horas, e quando abres a classificação',
  'terms.sent.board.who':
    'O teu nome de utilizador, o teu nome visível, os teus pontos e de que são feitos: todos os membros com sessão iniciada.',
  'terms.sent.sceneExport.what':
    'Uma cena que exportas, com o teu nome visível e o id da tua conta',
  'terms.sent.sceneExport.when': 'Quando carregas em Exportar no Estúdio',
  'terms.sent.sceneExport.who':
    'Nada da cena é guardado. O criador guarda um registo de que cena e versão exportaste, quando, e uma impressão digital, para reconhecer uma cena bloqueada. Quem receber o ficheiro vê o teu nome visível e o id da tua conta.',
  'terms.sent.sceneLike.what':
    'Que cena de um membro está no ecrã, e a tua curtida nela',
  'terms.sent.sceneLike.when':
    'Quando a cena de um membro é reproduzida, para mostrar as curtidas, e quando carregas no coração ou retiras uma curtida',
  'terms.sent.sceneLike.who':
    'Nada do que está no ecrã é guardado. Os membros veem quantas curtidas uma cena tem, nunca quem as deu.',
  'terms.sent.scenePublish.what':
    'Uma cena que publicas, a sua imagem, a categoria que escolheste, o teu nome visível e o id da tua conta',
  'terms.sent.scenePublish.when': 'Quando carregas em Publicar no Estúdio',
  'terms.sent.scenePublish.who':
    'Em Visualizadores, até a despublicares: qualquer pessoa com sessão iniciada no FluidEQ vê a sua imagem, o nome, a categoria e o teu nome visível e pode vê-la a funcionar durante uns segundos, e os membros Plus podem reproduzi-la por inteiro e adicioná-la. O criador guarda o registo de que a publicaste, como numa exportação.',
  'terms.sent.gallery.what':
    'Em Visualizadores: o que procuras, que cenas abres e adicionas, e qualquer cena que denuncies com o motivo',
  'terms.sent.gallery.when':
    'Quando exploras Visualizadores, carregas em Adicionar ou envias uma denúncia',
  'terms.sent.gallery.who':
    'As pesquisas e o que abres não são guardados. Os membros veem quantos adicionaram uma cena, nunca quem. Denúncias: só o criador.',
  'terms.sent.forum.what':
    'No separador Fórum: o que publicas, editas ou eliminas e as tuas reações, com a tua sessão do GitHub',
  'terms.sent.forum.when':
    'Abrir o fórum descarrega os seus tópicos públicos, o que não leva nada sobre ti; o resto só depois de iniciares sessão com o GitHub e publicares',
  'terms.sent.forum.who':
    'O GitHub, segundo os seus próprios termos. As publicações são públicas no GitHub Discussions do projeto; o servidor do FluidEQ nunca as recebe.',

  'terms.never.title': 'O que o serviço Plus não coleta',
  'terms.never.p1':
    'O teu áudio, e tudo sobre o que ouves: nomes de faixas, artistas, ficheiros, pastas e listas.',
  'terms.never.p2': 'As tuas definições de EQ, presets e perfis.',
  'terms.never.p3':
    'Os teus dispositivos de áudio e os seus nomes, e as outras aplicações do teu computador.',
  'terms.never.p4':
    'Suas cenas do Estúdio ficam no computador, exceto se você as exportar, publicar ou compartilhar com outra ferramenta, como seu assistente de IA.',

  'terms.protect.title': 'Como é protegido',
  'terms.protect.p1': 'Cada pedido viaja cifrado.',
  'terms.protect.p2':
    'As regras vivem no servidor, não na aplicação: cada conta só pode alterar os seus próprios dados, e uma cópia modificada do FluidEQ recebe exatamente as mesmas respostas.',
  'terms.protect.p3':
    'A classificação e Visualizadores mostram nomes de utilizador e nomes visíveis, nunca emails nem identificadores de conta.',
  'terms.protect.p4':
    'O criador gere o servidor e pode ver o que ele guarda, para o manter a funcionar e moderar o que os membros publicam. Nada é vendido ou usado para publicidade, e não há rastreio nem análises.',
  'terms.protect.p5':
    'O serviço funciona no Supabase (início de sessão, base de dados e ficheiros) e envia emails através do Resend; os pagamentos passam pelo Buy Me a Coffee. Cada um recebe só o que a sua parte precisa.',
  'terms.protect.p6':
    'O FluidEQ não guarda endereços IP. O fornecedor de alojamento regista os pedidos, endereços incluídos, em registos de curta duração para manter o serviço a funcionar e seguro.',

  'terms.fair.title': 'Jogo limpo na classificação',
  'terms.fair.p1':
    'O tempo de escuta é contado pela aplicação no teu computador, por isso o servidor não o pode ver acontecer. Em vez disso, verifica cada número: não mais de {capHours} horas por dia, nenhum dia que ainda não tenha começado, nada com mais de {windowDays} dias, e nenhum dia que cresça mais depressa do que o relógio. Os números dos teus computadores somam-se num só dia, que também não cresce mais depressa do que o relógio, por isso vários a tocar ao mesmo tempo não podem somar mais tempo do que o que passou.',
  'terms.fair.p2':
    'Todos ganham pontos da mesma forma, o criador incluído. Alterar a aplicação ou o que ela envia, automatizar a escuta ou subir com mais de uma conta tira-te da classificação, e pode impedir a conta de publicar e curtir cenas.',
  'terms.fair.p3':
    'Cada curtida nas tuas cenas vale {likePoints} pontos. Uma curtida conta uma vez por membro e por cena, só de membros Plus e nunca da tua própria conta. Curtidas de uma segunda conta tua contam como subir com mais de uma conta.',

  'terms.rules.title': 'Regras para o que publicas',
  'terms.rules.p1':
    'Sê simpático. Nada de assédio, ódio, ameaças, spam, conteúdo ilegal ou dados pessoais de quem quer que seja — numa cena, no seu nome ou na sua imagem. Qualquer pessoa com sessão iniciada pode ver o que publicas, por isso partilha só o que não te importas que seja visto.',
  'terms.rules.p2':
    'Podes despublicar as tuas próprias cenas a qualquer momento. O criador pode retirar cenas e suspender contas que violem estas regras. Denuncia uma cena para a assinalar; só o criador vê as denúncias.',

  'terms.keep.title': 'O que é guardado, e como apagar',
  'terms.keep.p1':
    'Classificação: «Remover todos os meus dados» no painel Conta apaga de uma vez cada dia que alguma vez enviaste. O teu computador só guarda os totais dos últimos {windowDays} dias.',
  'terms.keep.p2':
    'O teu nome de utilizador e o teu nome visível: guardados enquanto tiveres conta, e apagados com ela.',
  'terms.keep.p3':
    'Subscrição: o teu email de pagamento e o estado são guardados para associar os pagamentos à tua conta, e são apagados com ela.',
  'terms.keep.p4':
    'A tua conta: pede que seja apagada e desaparece em {deletionDays} dias, com o teu perfil, os teus dias na classificação e o registo da subscrição.',
  'terms.keep.p5':
    'Cenas: uma cena que publicas fica em Visualizadores até a despublicares, o que a remove de imediato com a sua imagem. O que publicaste, o registo do que exportaste, as cenas que adicionaste, as curtidas que deste e as que as tuas cenas receberam são apagados com a tua conta. Uma cena bloqueada por violar estes termos guarda só a sua impressão digital, sem o teu nome, para continuar bloqueada.',

  'terms.looks.title': 'Os looks Plus',
  'terms.looks.p1':
    'Os looks Plus são obra do próprio criador, licenciados para o teu uso pessoal enquanto fores membro. Por favor, não os copies, partilhes nem revendas.',
  'terms.looks.p2':
    'O FluidEQ continua a ser software livre sob a GPL. Nada disto altera nenhum direito que a GPL te dá.',

  'terms.scenes.title': 'As cenas que crias',
  'terms.scenes.p1':
    'Uma cena que crias no Estúdio é tua. O FluidEQ não é dono dela, e a GPL que cobre o FluidEQ não a cobre.',
  'terms.scenes.p2':
    'Suas cenas do Estúdio ficam no computador, exceto se você as exportar, publicar ou compartilhar com outra ferramenta, como seu assistente de IA.',
  'terms.scenes.p3':
    'Ao exportar uma cena, deixas o FluidEQ verificá-la, retirar os comentários do seu shader e assiná-la com o teu nome, para que outros membros Plus a possam reproduzir e ver que foste tu que a fizeste. Essa é toda a permissão. O criador não venderá a tua cena, não a usará em publicidade nem a tornará um dos looks Plus sem te perguntar primeiro, e isso não te impede de fazer mais nada com o teu próprio trabalho.',
  'terms.scenes.p4':
    'Partilhar faz parte do Plus, não é um trabalho: ninguém recebe por uma cena e ninguém paga por uma. O que recebes em troca são todas as cenas que os outros membros partilham.',
  'terms.scenes.p5':
    'Os membros que curtem a tua cena dão-te pontos na classificação, se te juntaste a ela. As curtidas são contadas no servidor; vê Jogo limpo.',
  'terms.scenes.p6':
    'Partilha só trabalho que tens o direito de partilhar: as tuas próprias fotos e desenhos, ou os de alguém que o permita. As regras para o que publicas aplicam-se a cada cena que partilhas. O criador pode impedir que uma cena abra se ela violar estes termos ou os direitos de outra pessoa.',
  'terms.scenes.p7':
    'Uma cena que outro membro partilha é trabalho dele, licenciado para teu uso pessoal enquanto fores membro. Podes reproduzi-la, curti-la e passar o ficheiro sem alterações a outros membros Plus. Por favor, não a alteres, não a apresentes como tua, não a publiques noutro lado nem a vendas.',
  'terms.scenes.p8':
    'Um ficheiro que enviaste fica com quem o tiver. Se quiseres que uma cena deixe de abrir em todo o lado, pede ao criador, que a pode bloquear da mesma forma que uma cena que viola as regras.',
  'terms.scenes.p9':
    'Se publicares uma cena em Visualizadores, também permites que o FluidEQ a guarde lá até a despublicares, que mostre a sua imagem, o nome, a categoria e o teu nome visível a qualquer pessoa com sessão iniciada no FluidEQ, que a reproduza para ela durante uns segundos, e que ofereça a própria cena aos membros Plus, que a podem reproduzir por inteiro e adicionar. Podes despublicá-la quando quiseres, com ou sem Plus. Quem já a adicionou mantém a sua cópia, nas mesmas condições de um ficheiro que lhe enviaste.',
  'terms.scenes.p10':
    'Publicar é opcional e diferente de exportar um ficheiro. Qualquer membro pode denunciar uma cena publicada; só o criador lê as denúncias e pode retirar uma cena que viole estes termos ou os direitos de outra pessoa.',

  'terms.changes.title': 'Alterações, e as letras pequenas',
  'terms.changes.p1':
    'Se estes termos mudarem, a nova versão aparece aqui com a sua data, e a aplicação avisa-te antes de se aplicar a ti.',
  'terms.changes.p2':
    'O FluidEQ e o Plus são fornecidos tal como estão, sem garantias, na medida em que a lei o permita. O criador não responde por mais do que pagaste pelo Plus nos últimos doze meses. Nada disto te tira os direitos que a lei te dá como consumidor.',

  'terms.contact.title': 'Contacto',
  'terms.contact.p1':
    'Perguntas, reembolsos, apagar a tua conta ou denunciar uma cena que usa o teu trabalho: {contact}.',

  'terms.agree.check':
    'Li estes termos, incluindo o que a aplicação envia, e aceito-os.',
  'terms.agree.continue': 'Aceitar e continuar para o pagamento',
  'terms.agree.opening': 'A abrir o Buy Me a Coffee…',
  'terms.agree.hint':
    'O pagamento abre no teu navegador. Usa o mesmo email da tua conta FluidEQ.',
  'terms.back': 'Voltar',
  'terms.error.outdated':
    'Estes termos mudaram. Atualiza o FluidEQ para ler a nova versão antes de subscrever.',
  'terms.error.priceOutdated':
    'O preço mudou. Atualiza o FluidEQ para veres o preço atual antes de subscrever.',
};

export default terms;
