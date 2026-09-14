const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Condizioni e privacy di Plus',
  'terms.meta': 'Versione {version} · In vigore dal {date}',
  'terms.intro':
    'Queste condizioni riguardano il tuo account FluidEQ e Plus: abbonamento, pagamenti, Visualizzatori, le scene che condividi e la classifica. Elencano tutto ciò che l’app invia al servizio di FluidEQ, quando viene inviato e chi può vederlo e, verso la fine, ogni altra destinazione a cui FluidEQ si collega.',
  'terms.link': 'Condizioni e privacy di Plus',

  'terms.short.title': 'La versione breve',
  'terms.short.price.title': '{price}, disdici quando vuoi',
  'terms.short.price.body':
    'Si paga su Buy Me a Coffee. FluidEQ non vede mai la tua carta.',
  'terms.short.free.title': 'Nulla di gratuito viene tolto',
  'terms.short.free.body':
    'FluidEQ continua a funzionare offline e senza account, come sempre.',
  'terms.short.choice.title': 'Scegli tu cosa condividere',
  'terms.short.choice.body':
    'La classifica è disattivata finché non partecipi, e nulla di ciò che crei lascia il tuo computer se non lo esporti o lo pubblichi.',
  'terms.short.music.title': 'Mai la tua musica',
  'terms.short.music.body':
    'Il servizio di FluidEQ non riceve mai il tuo audio, i titoli dei tuoi brani né il tuo EQ.',

  'terms.membership.title': 'L’abbonamento',
  'terms.membership.p1':
    'Con un account gratuito puoi esplorare Visualizzatori, vedere l’immagine e i dettagli di ogni scena pubblicata, provare per {tasteSeconds} secondi ciascuna delle scene di prova gratuite di FluidEQ e vedere la classifica. Plus ti permette di riprodurre e aggiungere ogni scena, sblocca i look Plus, ti permette di creare scene nello Studio ed esportarle o pubblicarle e di partecipare alla classifica, e porta le scene sul tuo desktop e sulle tue luci RGB. Costa {price} e si rinnova alla fine di ogni periodo pagato finché non disdici.',
  'terms.membership.p2':
    'Il pagamento è gestito da Buy Me a Coffee, secondo le sue condizioni. FluidEQ non vede mai la tua carta né i tuoi dati bancari. Puoi disdire in qualsiasi momento su Buy Me a Coffee: Plus resta attivo fino alla fine del periodo pagato e non viene addebitato altro.',
  'terms.membership.p3':
    'Se un addebito è stato un errore, o Plus non fa per te, chiedilo entro {refundDays} giorni da quell’addebito e viene rimborsato per intero, senza domande.',
  'terms.membership.p4':
    'Quando un abbonamento finisce, i look Plus e le scene dei membri tornano bloccati e FluidEQ torna ai suoi look gratuiti; nulla di ciò che hai creato viene eliminato. Senza connessione, Plus continua a funzionare fino alla fine del periodo pagato, e fino a {graceDays} giorni dopo se l’app non è riuscita a confermare un rinnovo. Nulla di gratuito viene mai toccato.',
  'terms.membership.p5':
    'Il creatore può regalare Plus a un indirizzo email. Si attiva quando un account conferma quell’indirizzo e dura fino alla data di fine scelta dal creatore, se c’è, o finché il creatore non lo ritira.',

  'terms.account.title': 'Il tuo account',
  'terms.account.p1':
    'Un account è un indirizzo email, una password e, se lo indichi, un nome, e devi avere almeno {age} anni per crearne uno. La password viaggia cifrata fino al servizio di accesso e lì viene conservata solo come hash a senso unico, che nessuno può rileggere, nemmeno il creatore.',
  'terms.account.p2':
    'La tua email riceve i codici che confermano l’indirizzo e reimpostano la password. Non viene mai mostrata agli altri membri: in classifica e in Visualizzatori compari con il nome utente e il nome visualizzato che scegli.',
  'terms.account.p3':
    'Sul tuo computer, l’app conserva la sessione cifrata dal sistema operativo. Gli account sono personali: tieni per te la tua password.',
  'terms.account.p4':
    'Un account resta connesso su un massimo di {computers} computer alla volta: a casa e al lavoro, o i computer tra cui suona Condividi audio. Se accedi su un computer in più, quello usato meno di recente viene disconnesso entro un’ora.',

  'terms.sent.title': 'Cosa invia l’app, e quando',
  'terms.sent.intro':
    'Tutto ciò che l’app invia al servizio di FluidEQ, sempre tramite una connessione cifrata. Le altre destinazioni a cui FluidEQ si collega sono elencate più avanti.',
  'terms.sent.when': 'Quando',
  'terms.sent.who': 'Chi può vederlo',
  'terms.sent.signIn.what':
    'La tua email e la tua password, e il nome che indichi quando ti registri',
  'terms.sent.signIn.when':
    'Quando crei un account, accedi, confermi il tuo indirizzo o reimposti la password',
  'terms.sent.signIn.who':
    'Il servizio di accesso conserva la tua email e il tuo nome, e la password solo come hash che nessuno può leggere.',
  'terms.sent.membership.what':
    'Il tuo token di accesso e l’id del tuo account',
  'terms.sent.membership.when':
    'All’avvio dell’app, quando accedi, quando torni al computer (al massimo ogni poche ore) e quando premi Controlla di nuovo',
  'terms.sent.membership.who':
    'Solo tu e il creatore. Il servizio conferma il tuo abbonamento, cerca un pagamento su Buy Me a Coffee effettuato con la tua email confermata e legge quale versione di queste condizioni hai accettato, così l’app può avvisarti quando cambiano.',
  'terms.sent.payment.what':
    'L’email con cui paghi, lo stato e il periodo del tuo abbonamento, e gli id di Buy Me a Coffee per il tuo abbonamento, inviati da Buy Me a Coffee',
  'terms.sent.payment.when': 'Quando paghi, rinnovi o disdici',
  'terms.sent.payment.who':
    'Il creatore, per collegare il pagamento al tuo account. Viene collegato solo a un indirizzo email confermato, quindi paga con l’email con cui accedi.',
  'terms.sent.agreement.what':
    'Quale versione di queste condizioni hai accettato, e quando',
  'terms.sent.agreement.when':
    'Quando vai al pagamento, esporti una scena o ne pubblichi una',
  'terms.sent.agreement.who':
    'Il creatore. L’informazione viene conservata con il tuo account, anche se poi non procedi al pagamento.',
  'terms.sent.looks.what':
    'Il tuo token di accesso, e gli id delle scene di FluidEQ che hai installato e che hanno una nuova versione, per scaricarle',
  'terms.sent.looks.when':
    'All’avvio dell’app, quando torni al computer e quando apri l’elenco dei look, per scaricare le nuove versioni e sapere quali scene condivise sono state rimosse',
  'terms.sent.looks.who':
    'Non viene conservato nulla. Ogni look è firmato, e il tuo computer controlla la firma prima di riprodurlo.',
  'terms.sent.catalogue.what': 'Nulla su di te',
  'terms.sent.catalogue.when':
    'All’avvio di FluidEQ, al massimo ogni poche ore, per mostrare quali look Plus esistono, con o senza account',
  'terms.sent.catalogue.who':
    'Non viene conservato nulla. La richiesta scarica solo l’elenco pubblico dei look.',
  'terms.sent.profile.what': 'Il nome utente e il nome visualizzato che scegli',
  'terms.sent.profile.when': 'Quando li scegli in classifica',
  'terms.sent.profile.who':
    'Ogni account che ha effettuato l’accesso: in classifica, sulle scene che pubblichi e sulla tua pagina di autore in Visualizzatori, dove si possono cercare. I nomi che si spacciano per FluidEQ o per il suo staff vengono rifiutati.',
  'terms.sent.board.what':
    'Un numero al giorno da ciascuno dei tuoi computer: i minuti interi di musica riprodotta, fino a {capHours} ore, con la sua data e un numero casuale che distingue i tuoi computer',
  'terms.sent.board.when':
    'Solo se partecipi alla classifica: quando ti unisci, quando torni al computer al massimo ogni {uploadHours} ore, e quando apri la classifica o la pagina di un autore in Visualizzatori',
  'terms.sent.board.who':
    'Il tuo nome utente, il nome visualizzato, la posizione, i punti e di cosa sono fatti: ogni account che ha effettuato l’accesso, in classifica e sulla tua pagina di autore.',
  'terms.sent.sceneExport.what':
    'Una scena che esporti: il suo codice, le impostazioni, le immagini e gli elementi d’ambiente',
  'terms.sent.sceneExport.when': 'Quando premi Esporta nello Studio',
  'terms.sent.sceneExport.who':
    'Il servizio controlla la scena, toglie i commenti dal suo codice e la firma, aggiungendo al file il tuo nome visualizzato e l’id del tuo account. Conserva un registro di quale scena e versione hai esportato, quando, e un’impronta del file. Chi riceve il file vede il tuo nome visualizzato e l’id del tuo account.',
  'terms.sent.sceneLike.what':
    'Quale scena di un membro è sullo schermo, e il tuo mi piace',
  'terms.sent.sceneLike.when':
    'Quando la scena di un membro è in riproduzione, per mostrarne i mi piace, e quando premi il cuore o togli un mi piace',
  'terms.sent.sceneLike.who':
    'Il tuo mi piace viene conservato con il tuo account. I membri vedono quanti mi piace ha una scena, mai chi li ha messi. Nient’altro di ciò che è sullo schermo viene conservato.',
  'terms.sent.scenePublish.what':
    'Una scena che pubblichi, come per un’esportazione, con un’immagine di copertina, fino a due categorie e una nota sulle novità, se ne scrivi una',
  'terms.sent.scenePublish.when': 'Quando premi Pubblica nello Studio',
  'terms.sent.scenePublish.who':
    'In Visualizzatori, finché non la ritiri, chiunque abbia effettuato l’accesso a FluidEQ vede la sua immagine, il nome, le categorie, le note di versione, i mi piace e le aggiunte, con il tuo nome visualizzato, il tuo nome utente e la tua pagina di autore. Solo i membri Plus possono riprodurre la scena e aggiungerla. Il creatore di FluidEQ conserva la scena e il registro della pubblicazione, come per un’esportazione.',
  'terms.sent.gallery.what':
    'In Visualizzatori: cosa cerchi, le scene e gli autori che apri, le scene che aggiungi, e ogni scena che segnali con il motivo',
  'terms.sent.gallery.when':
    'Quando esplori Visualizzatori o premi Aggiungi o Segnala, e quando l’app cerca nuove versioni delle scene che hai aggiunto chiedendo le scene dei loro autori',
  'terms.sent.gallery.who':
    'Le ricerche e ciò che apri non vengono conservati. Un’aggiunta viene conservata con il tuo account; i membri vedono quanti hanno aggiunto una scena, mai chi. Una segnalazione viene conservata con il tuo account e con un’impronta della scena com’era; il creatore di FluidEQ vede quante segnalazioni ha una scena e perché, mai chi le ha inviate.',
  'terms.sent.forum.what':
    'Nel Forum: il tuo accesso GitHub, e poi ciò che leggi, cerchi, visualizzi in anteprima, pubblichi, modifichi o a cui reagisci',
  'terms.sent.forum.when':
    'Aprire il Forum ne scarica gli argomenti pubblici da GitHub, senza inviare nulla su di te; il resto solo dopo che accedi con GitHub',
  'terms.sent.forum.who':
    'GitHub, secondo le sue condizioni; i post sono pubblici nelle GitHub Discussions del progetto. Quando accedi, resti connesso o ti disconnetti, il tuo accesso GitHub passa dal servizio di FluidEQ, che aggiunge la chiave di FluidEQ e non conserva nulla.',

  'terms.never.title': 'Cosa non riceve mai il servizio di FluidEQ',
  'terms.never.p1':
    'Il tuo audio, e tutto ciò che riguarda cosa ascolti: titoli, artisti, file, cartelle e playlist.',
  'terms.never.p2': 'Le tue impostazioni EQ, i preset e i profili.',
  'terms.never.p3':
    'I tuoi dispositivi audio, i monitor e le luci RGB, i loro nomi, e le altre app del tuo computer.',
  'terms.never.p4':
    'I tuoi progetti dello Studio, le loro foto e le tue note, a meno che tu non esporti o pubblichi una scena. Il prompt che copi per il tuo assistente IA va solo dove lo incolli.',
  'terms.never.p5':
    'Ciò che FluidEQ ricorda sul tuo computer per funzionare: i tuoi sfondi del desktop e l’illuminazione, le versioni delle scene che hai visto, e ogni scena che ha fatto ripristinare il tuo driver grafico.',

  'terms.protect.title': 'Come è protetto',
  'terms.protect.p1': 'Ogni richiesta viaggia cifrata.',
  'terms.protect.p2':
    'Le regole stanno sul server, non nell’app: ogni account può modificare solo i propri dati, e una copia modificata di FluidEQ riceve esattamente le stesse risposte.',
  'terms.protect.p3':
    'Classifica e Visualizzatori mostrano nomi utente e nomi visualizzati, mai indirizzi email. Gli id degli account non vengono mai mostrati, ma si trovano nei file delle scene e in ciò che Visualizzatori invia all’app.',
  'terms.protect.p4':
    'Il creatore gestisce il servizio e può vedere ciò che conserva, per tenerlo in funzione, collegare i pagamenti e moderare ciò che i membri pubblicano. Nulla viene venduto o usato per pubblicità, e non c’è tracciamento né analisi.',
  'terms.protect.p5':
    'Il servizio gira su Supabase (accesso, database e file) e invia le email tramite Resend; i pagamenti passano da Buy Me a Coffee, e il Forum da GitHub. Ognuno riceve solo ciò che serve alla sua parte.',
  'terms.protect.p6':
    'FluidEQ non conserva indirizzi IP. Supabase registra l’indirizzo di ogni richiesta in log di breve durata, e conserva l’indirizzo e i dettagli dell’app di ogni computer connesso insieme alla sessione di quel computer e nel registro di sicurezza degli accessi di Supabase stesso, per mantenere l’accesso funzionante e sicuro.',
  'terms.protect.p7':
    'Le scene sono firmate, e il tuo computer controlla la firma prima di riprodurne una. Un aggiornamento dell’app si installa solo dopo che la firma di FluidEQ su di esso è stata controllata.',

  'terms.fair.title': 'Correttezza in classifica',
  'terms.fair.p1':
    'I punti vengono dall’ascolto e dai mi piace: {hourPoints} per ogni ora di musica, {dayPoints} per ogni giorno con almeno {activeMinutes} minuti di musica, e {likePoints} per ogni mi piace alle tue scene. La classifica mostra i primi 100.',
  'terms.fair.p2':
    'Il tempo di ascolto è contato dall’app sul tuo computer, quindi il server non può vederlo accadere. Controlla invece ogni numero: non più di {capHours} ore al giorno, nessun giorno che non sia ancora iniziato, nulla più vecchio di {windowDays} giorni, e nessun giorno che cresca più veloce dell’orologio. I numeri dei tuoi computer si sommano in un solo giorno, che a sua volta non cresce più veloce dell’orologio: più computer che suonano insieme non possono sommare più tempo di quanto ne sia passato.',
  'terms.fair.p3':
    'Tutti guadagnano punti allo stesso modo, il creatore compreso. Modificare l’app o ciò che invia, automatizzare l’ascolto, o salire con più di un account ti toglie dalla classifica, e può impedire all’account di pubblicare, mettere mi piace e segnalare scene.',
  'terms.fair.p4':
    'Un mi piace conta una volta per membro e per scena, solo quando lo mette un membro Plus, e mai dal tuo stesso account. I mi piace su una scena rimossa, o da un account bloccato, non contano. I mi piace da un tuo secondo account contano come salire con più di un account.',

  'terms.rules.title': 'Regole per ciò che pubblichi',
  'terms.rules.p1':
    'Sii gentile. Niente molestie, odio, minacce, spam, contenuti illegali o dati personali di chiunque — in una scena, nel suo nome, nella sua immagine o nella sua nota. Chiunque abbia effettuato l’accesso può vedere ciò che pubblichi, quindi condividi solo ciò che ti va di far vedere.',
  'terms.rules.p2':
    'Prendi pure idee dalle scene di FluidEQ, ma crea le tue: una scena che è in gran parte una copia di una di esse viene rifiutata quando la esporti o la pubblichi.',
  'terms.rules.p3':
    'Puoi ritirare le tue scene in qualsiasi momento. Chiunque abbia effettuato l’accesso può segnalare una scena pubblicata. Il creatore di FluidEQ può rimuovere una scena, il che ne impedisce l’apertura ovunque, la segna come rimossa nelle tue scene e sospende le tue esportazioni e pubblicazioni per {takedownDays} giorni, e può bloccare un account, il che ne nasconde le scene e gli impedisce di pubblicare, mettere mi piace e segnalare.',
  'terms.rules.p4':
    'Per mantenere il servizio funzionante per tutti, un account può esportare o pubblicare fino a {sharesPerHour} scene all’ora, tentativi rifiutati compresi, e tenere pubblicate fino a {maxPublished} scene.',

  'terms.keep.title': 'Cosa viene conservato, e come cancellarlo',
  'terms.keep.p1':
    'Classifica: i giorni che invii restano in classifica finché non li rimuovi. «Rimuovi tutti i miei dati» nel pannello Account cancella in un colpo ogni giorno che hai inviato; lasciare la classifica interrompe solo l’invio. Il tuo computer conserva solo i totali degli ultimi {windowDays} giorni.',
  'terms.keep.p2':
    'Il tuo nome utente e il nome visualizzato: conservati finché hai un account, e cancellati con esso.',
  'terms.keep.p3':
    'Abbonamento: la tua email di pagamento, lo stato e gli id di Buy Me a Coffee per il tuo abbonamento sono conservati per collegare i pagamenti al tuo account, e vengono cancellati con esso. Il registro di ogni evento di pagamento conserva solo gli id di Buy Me a Coffee e l’ora.',
  'terms.keep.p4':
    'Il tuo account: chiedi che venga eliminato e sparisce entro {deletionDays} giorni, insieme a profilo, giorni in classifica, abbonamento, accettazioni delle condizioni, mi piace, aggiunte, segnalazioni e le scene che hai pubblicato con i loro file. Un Plus regalato alla tua email resta finché il creatore non lo rimuove.',
  'terms.keep.p5':
    'Scene: ritirare una scena la rimuove da Visualizzatori insieme alla sua immagine, al suo file e alla cronologia delle versioni. I mi piace, le aggiunte e le segnalazioni che ha ricevuto restano finché quegli account non vengono eliminati, e tornano a contare se la pubblichi di nuovo. Una scena bloccata per aver violato queste condizioni conserva un’impronta ricavata dall’id del tuo account e dall’id della scena, con il motivo e la data, così resta bloccata.',
  'terms.keep.p6':
    'Sul tuo computer: i look Plus e le scene che hai aggiunto, cifrati; le immagini della galleria, fino a 128 MB; e l’elenco delle scene bloccate. Restano finché non li rimuovi o non disinstalli FluidEQ.',

  'terms.looks.title': 'I look Plus',
  'terms.looks.p1':
    'I look Plus sono opera del creatore, concessi in licenza per il tuo uso personale finché sei membro. Per favore non copiarli, condividerli o rivenderli.',
  'terms.looks.p2':
    'I membri Plus possono aprire nello Studio le scene di FluidEQ per guardarci dentro e prendere idee. Una copia aperta in questo modo non si può aggiungere ai tuoi look, esportare o pubblicare.',
  'terms.looks.p3':
    'FluidEQ resta software libero sotto licenza GPL. Nulla di tutto questo cambia un diritto che la GPL ti dà.',

  'terms.scenes.title': 'Le scene che crei',
  'terms.scenes.p1':
    'Una scena che crei nello Studio è tua. FluidEQ non ne è proprietario, e la GPL che copre FluidEQ non la copre.',
  'terms.scenes.p2':
    'Le scene dello Studio rimangono sul tuo computer, salvo quando le esporti, le pubblichi o le condividi con un altro strumento, come il tuo assistente IA.',
  'terms.scenes.p3':
    'Quando esporti una scena, permetti a FluidEQ di controllarla — anche confrontandola con le scene di FluidEQ stesso — di togliere i commenti dal suo codice e di firmarla con il tuo nome visualizzato e l’id del tuo account, così che altri membri Plus possano riprodurla e vedere che l’hai fatta tu. Questo è tutto il permesso: il creatore di FluidEQ non venderà la tua scena né la userà per pubblicità, non la renderà uno dei look Plus senza chiedertelo prima, e non ti impedisce di fare altro con il tuo lavoro.',
  'terms.scenes.p4':
    'Condividere fa parte di Plus, non è un lavoro: nessuno viene pagato per una scena e nessuno ne paga una. Quello che ricevi in cambio sono tutte le scene che condividono gli altri membri.',
  'terms.scenes.p5':
    'I membri a cui piace la tua scena ti danno punti in classifica, se vi partecipi. I mi piace vengono contati dal server; vedi Correttezza in classifica.',
  'terms.scenes.p6':
    'Condividi solo lavori che hai il diritto di condividere: le tue foto e i tuoi disegni, o quelli di chi lo permette. Le regole per ciò che pubblichi valgono per ogni scena che condividi. Il creatore di FluidEQ può impedire che una scena si apra se viola queste condizioni o i diritti di qualcun altro.',
  'terms.scenes.p7':
    'Una scena condivisa da un altro membro è opera sua, concessa in licenza per il tuo uso personale finché sei membro. Puoi riprodurla, metterle mi piace e passare il file invariato ad altri membri Plus. Per favore non modificarla, non presentarla come tua, non pubblicarla altrove e non venderla.',
  'terms.scenes.p8':
    'Un file che hai inviato resta a chi lo ha, e ritirare una scena non riprende le copie che i membri hanno già aggiunto; restano concesse in licenza per uso personale finché quei membri hanno Plus. Se vuoi che una scena smetta di aprirsi ovunque, chiedilo al creatore di FluidEQ, che può bloccarla allo stesso modo di una scena che viola le regole.',
  'terms.scenes.p9':
    'Se pubblichi una scena in Visualizzatori, permetti anche a FluidEQ di conservarla lì finché non la ritiri, di mostrare la sua immagine, il nome, le categorie e le note di versione, con il tuo nome visualizzato e il tuo nome utente, a chiunque abbia effettuato l’accesso a FluidEQ, e di offrire la scena stessa ai membri Plus, che possono riprodurla e aggiungerla. Gli elementi d’ambiente che le assegni viaggiano con lei, e i membri che scelgono la modalità Ambiente li vedono intorno alla loro finestra. Puoi ritirarla quando vuoi, con o senza Plus.',
  'terms.scenes.p10':
    'Pubblicare è facoltativo e diverso dall’esportare un file. Una nota di versione è pubblica come la scena a cui appartiene.',

  'terms.elsewhere.title': 'Dove altro si collega FluidEQ',
  'terms.elsewhere.p1':
    'Aggiornamenti: all’avvio e quando torni al computer, FluidEQ controlla il suo feed delle versioni per trovarne una nuova, e la installa solo dopo averne controllato la firma. La richiesta porta con sé un numero casuale che il programma di aggiornamento conserva su questo computer, e nulla su di te.',
  'terms.elsewhere.p2':
    'Preset per cuffie: quando FluidEQ si apre, controlla su GitHub se ci sono nuovi preset per cuffie, e la scheda Convoluzione scarica file AutoEq da GitHub quando la apri o scegli delle cuffie.',
  'terms.elsewhere.p3':
    'Modelli che usi: Karaoke Maker scarica da Hugging Face i suoi modelli per il parlato, la voce e la melodia, e la riduzione del rumore per la voce scarica il suo modello da GitHub. Il tuo audio viene elaborato sul tuo computer.',
  'terms.elsewhere.p4':
    'Condividi audio: l’audio, ciò che è in riproduzione e il nome di questo computer vanno, cifrati, solo al computer che abbini sulla tua rete locale. Il nome di questo computer viene anche annunciato su quella rete, così l’altro computer può trovarlo.',
  'terms.elsewhere.p5':
    'Media online: YouTube, Bandcamp, Twitch e gli altri siti che apri dentro FluidEQ ricevono ciò che fai lì, secondo le loro condizioni.',
  'terms.elsewhere.p6':
    'Segnala un problema: apre una issue di GitHub nel tuo browser, o copia la segnalazione per te, con le righe di log recenti che puoi leggere prima di inviarla. FluidEQ non invia nulla da sé.',
  'terms.elsewhere.p7':
    'Illuminazione e sfondi del desktop: l’illuminazione comunica solo con Razer Chroma e Windows su questo computer, e gli sfondi del desktop non vanno mai online.',
  'terms.elsewhere.p8':
    'Il tuo browser: il pagamento, la pagina del tuo abbonamento, i link di supporto e l’accesso GitHub del Forum si aprono lì, secondo le condizioni di quei siti.',

  'terms.changes.title': 'Modifiche, e le clausole in piccolo',
  'terms.changes.p1':
    'Se queste condizioni cambiano, la nuova versione compare qui con la sua data, e l’app ti avvisa prima che si applichi a te.',
  'terms.changes.p2':
    'FluidEQ e Plus sono forniti così come sono, senza garanzie, nei limiti consentiti dalla legge. Il creatore non risponde oltre quanto hai pagato per Plus negli ultimi dodici mesi. Nulla di tutto questo ti toglie i diritti che la legge ti riconosce come consumatore.',

  'terms.contact.title': 'Contatti',
  'terms.contact.p1':
    'Domande, rimborsi, eliminazione dell’account o segnalazione di una scena che usa il tuo lavoro: {contact}.',

  'terms.agree.check':
    'Ho letto queste condizioni, compreso ciò che l’app invia, e le accetto.',
  'terms.agree.continue': 'Accetta e vai al pagamento',
  'terms.agree.opening': 'Apertura di Buy Me a Coffee…',
  'terms.agree.hint':
    'Il pagamento si apre nel browser. Usa la stessa email del tuo account FluidEQ.',
  'terms.back': 'Indietro',
  'terms.error.outdated':
    'Queste condizioni sono cambiate. Aggiorna FluidEQ per leggere la nuova versione prima di abbonarti.',
  'terms.error.priceOutdated':
    'Il prezzo è cambiato. Aggiorna FluidEQ per vedere il prezzo attuale prima di abbonarti.',
} as const;

export default terms;
