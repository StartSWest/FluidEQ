const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Termos e privacidade do Plus',
  'terms.meta': 'Versão {version} · Em vigor desde {date}',
  'terms.intro':
    'Estes termos abrangem a tua conta FluidEQ e o Plus: a subscrição, os pagamentos, Visualizadores, as cenas que partilhas e a classificação. Enumeram tudo o que a aplicação envia ao serviço do FluidEQ, quando é enviado e quem o pode ver e, perto do fim, todos os outros sítios a que o FluidEQ se liga.',
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
    'A classificação está desligada a menos que te juntes, e nada do que crias sai do teu computador a menos que o exportes ou publiques.',
  'terms.short.music.title': 'Nunca a tua música',
  'terms.short.music.body':
    'O serviço do FluidEQ nunca recebe o teu áudio, os nomes das tuas faixas nem o teu EQ.',

  'terms.membership.title': 'A subscrição',
  'terms.membership.p1':
    'Com uma conta gratuita podes explorar Visualizadores, ver a imagem e os detalhes de cada cena publicada, experimentar cada uma das cenas de amostra gratuitas do FluidEQ durante {tasteSeconds} segundos e ver a classificação. Com o Plus, reproduzes e adicionas todas as cenas, desbloqueias os looks Plus, crias cenas no Estúdio e exporta-las ou publica-las, juntas-te à classificação e pões cenas no teu ambiente de trabalho e nas tuas luzes RGB. Custa {price} e renova-se no fim de cada período pago até cancelares.',
  'terms.membership.p2':
    'O pagamento é tratado pelo Buy Me a Coffee, segundo os seus próprios termos. O FluidEQ nunca vê o teu cartão nem os teus dados bancários. Podes cancelar a qualquer momento no Buy Me a Coffee: o Plus fica ativo até ao fim do período que pagaste e não é cobrado mais nada.',
  'terms.membership.p3':
    'Se uma cobrança foi um engano, ou se o Plus não é para ti, pede nos {refundDays} dias seguintes a essa cobrança e é reembolsada na totalidade, sem perguntas.',
  'terms.membership.p4':
    'Quando uma subscrição termina, os looks Plus e as cenas dos membros voltam a ficar bloqueados e o FluidEQ volta aos seus looks gratuitos; nada do que criaste é apagado. Sem ligação, o Plus continua a funcionar até ao fim do período que pagaste e, se a aplicação não tiver conseguido confirmar uma renovação, até {graceDays} dias depois disso. Nada do que é gratuito é afetado, nunca.',
  'terms.membership.p5':
    'O criador pode oferecer o Plus a um endereço de email, como presente. Fica ativo quando uma conta confirma esse endereço e dura até à data de fim que o criador escolheu, se a houver, ou até o criador o retirar.',

  'terms.account.title': 'A tua conta',
  'terms.account.p1':
    'Uma conta é um endereço de email, uma palavra-passe e, se o indicares, um nome, e precisas de ter pelo menos {age} anos para a criar. A palavra-passe viaja cifrada até ao serviço de início de sessão e só lá é guardada como um hash de sentido único, que ninguém consegue ler, nem o criador.',
  'terms.account.p2':
    'O teu email recebe os códigos que confirmam o teu endereço e repõem a tua palavra-passe. Nunca é mostrado a outros membros: na classificação e em Visualizadores apareces com o nome de utilizador e o nome visível que escolheres.',
  'terms.account.p3':
    'No teu computador, a aplicação guarda a tua sessão cifrada pelo sistema operativo. As contas são pessoais: não partilhes a tua palavra-passe.',
  'terms.account.p4':
    'Uma conta mantém a sessão iniciada em até {computers} computadores ao mesmo tempo: em casa e no trabalho, ou os computadores entre os quais o Compartilhar áudio toca. Iniciar sessão em mais um termina, no prazo de uma hora, a sessão do computador que está há mais tempo sem uso.',

  'terms.sent.title': 'O que a aplicação envia, e quando',
  'terms.sent.intro':
    'Tudo o que a aplicação envia ao serviço do FluidEQ, sempre por uma ligação cifrada. Os outros sítios a que o FluidEQ se liga estão listados mais abaixo.',
  'terms.sent.when': 'Quando',
  'terms.sent.who': 'Quem pode ver',
  'terms.sent.signIn.what':
    'O teu email e a tua palavra-passe, e o nome que indicas quando te registas',
  'terms.sent.signIn.when':
    'Quando crias uma conta, inicias sessão, confirmas o teu endereço ou repões a tua palavra-passe',
  'terms.sent.signIn.who':
    'O serviço de início de sessão guarda o teu email e o teu nome, e a palavra-passe só como um hash que ninguém consegue ler.',
  'terms.sent.membership.what': 'O teu token de sessão e o id da tua conta',
  'terms.sent.membership.when':
    'Quando a aplicação arranca, quando inicias sessão, quando voltas ao computador (no máximo uma vez a cada poucas horas) e quando carregas em Verificar de novo',
  'terms.sent.membership.who':
    'Só tu e o criador. O serviço confirma a tua subscrição, procura um pagamento no Buy Me a Coffee feito com o teu email confirmado e lê que versão destes termos aceitaste, para que a aplicação te possa avisar quando mudarem.',
  'terms.sent.payment.what':
    'O email com que pagas, o estado e o período da tua subscrição e os identificadores que o Buy Me a Coffee lhe atribui, enviados pelo Buy Me a Coffee',
  'terms.sent.payment.when': 'Quando pagas, renovas ou cancelas',
  'terms.sent.payment.who':
    'O criador, para associar o pagamento à tua conta. Só é associado a um endereço de email confirmado, por isso paga com o email com que inicias sessão.',
  'terms.sent.agreement.what': 'Que versão destes termos aceitaste, e quando',
  'terms.sent.agreement.when':
    'Quando continuas para o pagamento, exportas uma cena ou publicas uma',
  'terms.sent.agreement.who':
    'O criador. Fica guardado com a tua conta, mesmo que não chegues a pagar.',
  'terms.sent.looks.what':
    'O teu token de sessão, e os ids das cenas do FluidEQ que tens instaladas e que têm uma nova versão, para as descarregar',
  'terms.sent.looks.when':
    'Quando a aplicação arranca, quando voltas ao computador e quando abres a lista de looks, para descarregar novas versões e saber que cenas partilhadas foram retiradas',
  'terms.sent.looks.who':
    'Nada é guardado. Cada look é assinado, e o teu computador verifica a assinatura antes de o reproduzir.',
  'terms.sent.catalogue.what': 'Nada sobre ti',
  'terms.sent.catalogue.when':
    'Quando o FluidEQ arranca, no máximo uma vez a cada poucas horas, para mostrar que looks Plus existem, com ou sem conta',
  'terms.sent.catalogue.who':
    'Nada é guardado. O pedido só descarrega a lista pública de looks.',
  'terms.sent.profile.what':
    'O nome de utilizador e o nome visível que escolhes',
  'terms.sent.profile.when': 'Quando os escolhes na classificação',
  'terms.sent.profile.who':
    'Todas as contas com sessão iniciada: na classificação, nas cenas que publicas e na tua página de criador em Visualizadores, onde podem ser pesquisados. Os nomes que se fazem passar pelo FluidEQ ou pela sua equipa são recusados.',
  'terms.sent.board.what':
    'Um número por dia de cada um dos teus computadores: os minutos inteiros de música que tocou, até {capHours} horas, com a sua data e um número aleatório que distingue os teus computadores',
  'terms.sent.board.when':
    'Só se te juntares à classificação: quando te juntas, quando voltas ao computador no máximo a cada {uploadHours} horas, e quando abres a classificação ou a página de um criador em Visualizadores',
  'terms.sent.board.who':
    'O teu nome de utilizador, o teu nome visível, a tua posição, os teus pontos e de que são feitos: todas as contas com sessão iniciada, na classificação e na tua página de criador.',
  'terms.sent.sceneExport.what':
    'Uma cena que exportas: o seu código, definições, imagens e elementos de ambiente',
  'terms.sent.sceneExport.when': 'Quando carregas em Exportar no Estúdio',
  'terms.sent.sceneExport.who':
    'O serviço verifica a cena, retira os comentários do seu código e assina-a, acrescentando ao ficheiro o teu nome visível e o id da tua conta. Guarda um registo de que cena e versão exportaste, quando, e uma impressão digital do ficheiro. Quem receber o ficheiro vê o teu nome visível e o id da tua conta.',
  'terms.sent.sceneLike.what':
    'Que cena de um membro está no ecrã, e a tua curtida nela',
  'terms.sent.sceneLike.when':
    'Quando a cena de um membro é reproduzida, para mostrar as curtidas, e quando carregas no coração ou retiras uma curtida',
  'terms.sent.sceneLike.who':
    'A tua curtida fica guardada com a tua conta. Os membros veem quantas curtidas uma cena tem, nunca quem as deu. Nada mais sobre o que está no ecrã é guardado.',
  'terms.sent.scenePublish.what':
    'Uma cena que publicas, como numa exportação, com uma imagem de capa, até duas categorias e uma nota sobre o que há de novo, se escreveres uma',
  'terms.sent.scenePublish.when': 'Quando carregas em Publicar no Estúdio',
  'terms.sent.scenePublish.who':
    'Em Visualizadores, até a despublicares, qualquer pessoa com sessão iniciada no FluidEQ vê a sua imagem, o nome, as categorias, as notas de versão, as curtidas e as adições, com o teu nome visível, o teu nome de utilizador e a tua página de criador. Só os membros Plus podem reproduzir a cena e adicioná-la. O criador do FluidEQ guarda a cena e o registo de que a publicaste, como numa exportação.',
  'terms.sent.gallery.what':
    'Em Visualizadores: o que procuras, as cenas e os criadores que abres, as cenas que adicionas e qualquer cena que denuncies, com o motivo',
  'terms.sent.gallery.when':
    'Quando exploras Visualizadores ou carregas em Adicionar ou Denunciar, e quando a aplicação procura novas versões das cenas que adicionaste pedindo as cenas dos seus criadores',
  'terms.sent.gallery.who':
    'As pesquisas e o que abres não são guardados. Uma adição fica guardada com a tua conta; os membros veem quantos adicionaram uma cena, nunca quem. Uma denúncia fica guardada com a tua conta e com uma impressão digital da cena tal como estava; o criador do FluidEQ vê quantas denúncias uma cena tem e porquê, nunca quem as enviou.',
  'terms.sent.forum.what':
    'No Fórum: a tua sessão do GitHub e, depois, o que lês, pesquisas, pré-visualizas, publicas, editas ou aquilo a que reages',
  'terms.sent.forum.when':
    'Abrir o Fórum descarrega os seus tópicos públicos do GitHub, o que não leva nada sobre ti; o resto só depois de iniciares sessão com o GitHub',
  'terms.sent.forum.who':
    'O GitHub, segundo os seus próprios termos; as publicações são públicas no GitHub Discussions do projeto. Iniciar sessão, manter a sessão iniciada e terminar sessão fazem passar a tua sessão do GitHub pelo serviço do FluidEQ, que acrescenta a chave do FluidEQ e não guarda nada.',

  'terms.never.title': 'O que o serviço do FluidEQ nunca recebe',
  'terms.never.p1':
    'O teu áudio, e tudo sobre o que ouves: nomes de faixas, artistas, ficheiros, pastas e listas.',
  'terms.never.p2': 'As tuas definições de EQ, presets e perfis.',
  'terms.never.p3':
    'Os teus dispositivos de áudio, monitores e luzes RGB, os seus nomes, e as outras aplicações do teu computador.',
  'terms.never.p4':
    'Os teus projetos do Estúdio, as suas fotos e as tuas notas, a menos que exportes ou publiques uma cena. O prompt que copias para o teu assistente de IA só vai para onde o colares.',
  'terms.never.p5':
    'O que o FluidEQ memoriza no teu computador para funcionar: os teus fundos do ambiente de trabalho e a iluminação, as versões de cenas que já viste e qualquer cena que tenha feito reiniciar o teu controlador gráfico.',

  'terms.protect.title': 'Como é protegido',
  'terms.protect.p1': 'Cada pedido viaja cifrado.',
  'terms.protect.p2':
    'As regras vivem no servidor, não na aplicação: cada conta só pode alterar os seus próprios dados, e uma cópia modificada do FluidEQ recebe exatamente as mesmas respostas.',
  'terms.protect.p3':
    'A classificação e Visualizadores mostram nomes de utilizador e nomes visíveis, nunca endereços de email. Os ids de conta nunca são mostrados, mas estão dentro dos ficheiros de cenas e no que Visualizadores envia à aplicação.',
  'terms.protect.p4':
    'O criador gere o serviço e pode ver o que ele guarda, para o manter a funcionar, associar pagamentos e moderar o que os membros publicam. Nada é vendido ou usado para publicidade, e não há rastreio nem análises.',
  'terms.protect.p5':
    'O serviço funciona no Supabase (início de sessão, base de dados e ficheiros) e envia emails através do Resend; os pagamentos passam pelo Buy Me a Coffee, e o Fórum pelo GitHub. Cada um recebe só o que a sua parte precisa.',
  'terms.protect.p6':
    'O FluidEQ não guarda endereços IP. O Supabase regista o endereço de cada pedido em registos de curta duração, e guarda o endereço e os dados da aplicação de cada computador com sessão iniciada junto da sessão desse computador e no próprio registo de segurança de início de sessão do Supabase, para manter o início de sessão a funcionar e seguro.',
  'terms.protect.p7':
    'As cenas são assinadas, e o teu computador verifica a assinatura antes de reproduzir uma. Uma atualização da aplicação só é instalada depois de verificada a própria assinatura do FluidEQ nela.',

  'terms.fair.title': 'Jogo limpo na classificação',
  'terms.fair.p1':
    'Os pontos vêm da escuta e das curtidas: {hourPoints} por cada hora de música, {dayPoints} por cada dia com pelo menos {activeMinutes} minutos de música, e {likePoints} por cada curtida nas tuas cenas. A classificação mostra os 100 primeiros e só inclui uma conta enquanto ela tiver Plus; os seus dias ficam guardados e voltam a contar quando o Plus regressar.',
  'terms.fair.p2':
    'O tempo de escuta é contado pela aplicação no teu computador, por isso o servidor não o pode ver acontecer. Em vez disso, verifica cada número: não mais de {capHours} horas por dia, nenhum dia que ainda não tenha começado, nada com mais de {windowDays} dias, e nenhum dia que cresça mais depressa do que o relógio. Os números dos teus computadores somam-se num só dia, que também não cresce mais depressa do que o relógio, por isso vários a tocar ao mesmo tempo não podem somar mais tempo do que o que passou.',
  'terms.fair.p3':
    'Todos ganham pontos da mesma forma, o criador incluído. Alterar a aplicação ou o que ela envia, automatizar a escuta ou subir com mais de uma conta tira-te da classificação, e pode impedir a conta de publicar, curtir e denunciar cenas.',
  'terms.fair.p4':
    'Uma curtida conta uma vez por membro e por cena, só quando é dada por um membro Plus, e nunca da tua própria conta. Não contam as curtidas numa cena que foi retirada, nem as de uma conta que foi banida. Curtidas de uma segunda conta tua contam como subir com mais de uma conta.',

  'terms.rules.title': 'Regras para o que publicas',
  'terms.rules.p1':
    'Sê simpático. Nada de assédio, ódio, ameaças, spam, conteúdo ilegal ou dados pessoais de quem quer que seja — numa cena, no seu nome, na sua imagem ou na sua nota. Qualquer pessoa com sessão iniciada pode ver o que publicas, por isso partilha só o que não te importas que seja visto.',
  'terms.rules.p2':
    'Tira ideias das cenas do FluidEQ, mas faz as tuas: uma cena que seja sobretudo uma cópia de uma delas é recusada quando a exportas ou publicas.',
  'terms.rules.p3':
    'Podes despublicar as tuas próprias cenas a qualquer momento. Qualquer pessoa com sessão iniciada pode denunciar uma cena publicada. O criador do FluidEQ pode retirar uma cena, o que a impede de abrir em qualquer lado, a marca como retirada nas tuas cenas e suspende as tuas exportações e publicações durante {takedownDays} dias, e pode banir uma conta, o que oculta as suas cenas e a impede de publicar, curtir e denunciar.',
  'terms.rules.p4':
    'Para manter o serviço a funcionar para todos, uma conta pode exportar ou publicar até {sharesPerHour} cenas por hora, incluindo tentativas recusadas, e manter até {maxPublished} cenas publicadas.',

  'terms.keep.title': 'O que é guardado, e como apagar',
  'terms.keep.p1':
    'Classificação: os dias que envias ficam na classificação até os removeres. «Remover todos os meus dados» no painel Conta apaga de uma vez cada dia que alguma vez enviaste; sair da classificação apenas faz parar o envio. O teu computador só guarda os totais dos últimos {windowDays} dias.',
  'terms.keep.p2':
    'O teu nome de utilizador e o teu nome visível: guardados enquanto tiveres conta, e apagados com ela.',
  'terms.keep.p3':
    'Subscrição: o teu email de pagamento, o estado e os identificadores da tua subscrição no Buy Me a Coffee são guardados para associar os pagamentos à tua conta, e são apagados com ela. O registo de cada evento de pagamento guarda só os identificadores do Buy Me a Coffee e a hora.',
  'terms.keep.p4':
    'A tua conta: pede que seja apagada e desaparece no prazo de {deletionDays} dias, com o teu perfil, os teus dias na classificação, a subscrição, as aceitações dos termos, as curtidas, as adições, as denúncias e as cenas que publicaste, com os seus ficheiros. Um Plus oferecido ao teu email fica até o criador o remover.',
  'terms.keep.p5':
    'Cenas: despublicar remove uma cena de Visualizadores com a sua imagem, o ficheiro e o histórico de versões. As curtidas, adições e denúncias que recebeu ficam até essas contas serem apagadas, e voltam a contar se a publicares de novo. Uma cena bloqueada por violar estes termos guarda uma impressão digital feita a partir do id da tua conta e do id da cena, com o motivo e a data, para continuar bloqueada.',
  'terms.keep.p6':
    'No teu computador: os looks Plus e as cenas que adicionaste, cifrados; as imagens da galeria, até 128 MB; e a lista de cenas bloqueadas. Ficam até os removeres ou desinstalares o FluidEQ.',

  'terms.looks.title': 'Os looks Plus',
  'terms.looks.p1':
    'Os looks Plus são obra do próprio criador, licenciados para o teu uso pessoal enquanto fores membro. Por favor, não os copies, partilhes nem revendas.',
  'terms.looks.p2':
    'Os membros Plus podem abrir as próprias cenas do FluidEQ no Estúdio para as ver por dentro e tirar ideias. Uma cópia aberta dessa forma não pode ser adicionada aos teus looks, exportada nem publicada.',
  'terms.looks.p3':
    'O FluidEQ continua a ser software livre sob a GPL. Nada disto altera nenhum direito que a GPL te dá.',

  'terms.scenes.title': 'As cenas que crias',
  'terms.scenes.p1':
    'Uma cena que crias no Estúdio é tua. O FluidEQ não é dono dela, e a GPL que cobre o FluidEQ não a cobre.',
  'terms.scenes.p2':
    'Suas cenas do Estúdio ficam no computador, exceto se você as exportar, publicar ou compartilhar com outra ferramenta, como seu assistente de IA.',
  'terms.scenes.p3':
    'Ao exportar uma cena, deixas o FluidEQ verificá-la — incluindo compará-la com as próprias cenas do FluidEQ —, retirar os comentários do seu código e assiná-la com o teu nome visível e o id da tua conta, para que outros membros Plus a possam reproduzir e ver que foste tu que a fizeste. Essa é toda a permissão: o criador do FluidEQ não venderá a tua cena nem a usará em publicidade, não a tornará um dos looks Plus sem te perguntar primeiro e não te impede de fazer qualquer outra coisa com o teu próprio trabalho.',
  'terms.scenes.p4':
    'Partilhar faz parte do Plus, não é um trabalho: ninguém recebe por uma cena e ninguém paga por uma. O que recebes em troca são todas as cenas que os outros membros partilham.',
  'terms.scenes.p5':
    'Os membros que curtem a tua cena dão-te pontos na classificação, se te juntaste a ela. As curtidas são contadas no servidor; vê Jogo limpo.',
  'terms.scenes.p6':
    'Partilha só trabalho que tens o direito de partilhar: as tuas próprias fotos e desenhos, ou os de alguém que o permita. As regras para o que publicas aplicam-se a cada cena que partilhas. O criador do FluidEQ pode impedir que uma cena abra se ela violar estes termos ou os direitos de outra pessoa.',
  'terms.scenes.p7':
    'Uma cena que outro membro partilha é trabalho dele, licenciado para teu uso pessoal enquanto fores membro. Podes reproduzi-la, curti-la e passar o ficheiro sem alterações a outros membros Plus. Por favor, não a alteres, não a apresentes como tua, não a publiques noutro lado nem a vendas.',
  'terms.scenes.p8':
    'Um ficheiro que enviaste fica com quem o tiver, e despublicar não retira as cópias que os membros já adicionaram; essas continuam licenciadas para uso pessoal enquanto esses membros tiverem o Plus. Se quiseres que uma cena deixe de abrir em qualquer lado, pede ao criador do FluidEQ, que a pode bloquear da mesma forma que uma cena que viola as regras.',
  'terms.scenes.p9':
    'Se publicares uma cena em Visualizadores, também permites que o FluidEQ a guarde lá até a despublicares, que mostre a sua imagem, o nome, as categorias e as notas de versão, com o teu nome visível e o teu nome de utilizador, a qualquer pessoa com sessão iniciada no FluidEQ, e que ofereça a própria cena aos membros Plus, que a podem reproduzir e adicionar. Os elementos de ambiente que lhe dás viajam com ela, e os membros que escolhem o modo Ambiente veem-nos à volta da sua janela. Podes despublicá-la quando quiseres, com ou sem Plus.',
  'terms.scenes.p10':
    'Publicar é opcional e diferente de exportar um ficheiro. Uma nota de versão é pública, tal como a cena a que pertence.',

  'terms.elsewhere.title': 'Onde mais o FluidEQ se liga',
  'terms.elsewhere.p1':
    'Atualizações: quando arranca e quando voltas ao computador, o FluidEQ procura uma nova versão no seu feed de lançamentos e só a instala depois de verificar a sua assinatura. O pedido leva um número aleatório que o atualizador guarda neste computador, e nada sobre ti.',
  'terms.elsewhere.p2':
    'Presets de auscultadores: quando o FluidEQ abre, procura no GitHub novos presets de auscultadores, e o separador Convolução descarrega ficheiros AutoEq do GitHub quando o abres ou escolhes uns auscultadores.',
  'terms.elsewhere.p3':
    'Modelos que usas: o Criador de karaokê descarrega do Hugging Face os seus modelos de fala, de vocais e de melodia, e a redução de ruído de voz descarrega o seu modelo do GitHub. O teu áudio é processado no teu computador.',
  'terms.elsewhere.p4':
    'Compartilhar áudio: o áudio, o que está a tocar e o nome deste computador vão só para o computador com que emparelhas na tua rede local, cifrados. O nome deste computador também é anunciado nessa rede, para que o outro computador o possa encontrar.',
  'terms.elsewhere.p5':
    'Mídia online: o YouTube, o Bandcamp, o Twitch e os outros sites que abres dentro do FluidEQ recebem o que lá fazes, segundo os seus próprios termos.',
  'terms.elsewhere.p6':
    'Relatar um problema: abre uma issue pública do GitHub no teu navegador ou um e-mail privado para o criador do FluidEQ na tua aplicação de e-mail, ou copia o relatório para ti, com linhas recentes do registo que podes ler antes de o enviares. O próprio FluidEQ não envia nada.',
  'terms.elsewhere.p7':
    'Iluminação e fundos do ambiente de trabalho: a iluminação comunica só com o Razer Chroma e o Windows neste computador, e os fundos do ambiente de trabalho nunca vão à internet.',
  'terms.elsewhere.p8':
    'O teu navegador: o pagamento, a página da tua subscrição, as ligações de apoio e o início de sessão do GitHub do Fórum abrem lá, segundo os próprios termos desses sites.',

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
} as const;

export default terms;
