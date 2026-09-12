const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Condizioni e privacy di Plus',
  'terms.meta': 'Versione {version} · In vigore dal {date}',
  'terms.intro':
    'Queste condizioni riguardano il tuo account FluidEQ e Plus: accesso, pagamenti, scene condivise e dati ricevuti dal servizio. Altre funzioni, come la condivisione audio, le segnalazioni di errori o un assistente IA esterno, possono inviare dati quando le usi e non rientrano in questo elenco.',
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
    'La classifica è disattivata finché non partecipi, e decidi tu quali delle tue scene condividere.',
  'terms.short.music.title': 'Mai la tua musica',
  'terms.short.music.body':
    'Il servizio Plus non riceve la tua musica né i titoli dei brani.',

  'terms.membership.title': 'L’abbonamento',
  'terms.membership.p1':
    'Con un account puoi esplorare la galleria e vedere brevi dimostrazioni. Serve Plus per scaricare e conservare le scene, riprodurle per intero, aggiungerle ai tuoi stili e crearne di nuove nello Studio. Plus aggiunge a FluidEQ visualizzatori premium, lo Studio per creare i tuoi e condividerli con gli altri membri, e la classifica. Costa {price} e si rinnova alla fine di ogni periodo pagato finché non disdici.',
  'terms.membership.p2':
    'Il pagamento è gestito da Buy Me a Coffee, secondo le sue condizioni. FluidEQ non vede mai la tua carta né i tuoi dati bancari. Puoi disdire in qualsiasi momento su Buy Me a Coffee: Plus resta attivo fino alla fine del periodo pagato e non viene addebitato altro.',
  'terms.membership.p3':
    'Se un addebito è stato un errore, o Plus non fa per te, chiedilo entro {refundDays} giorni da quell’addebito e viene rimborsato per intero, senza domande.',
  'terms.membership.p4':
    'Quando un abbonamento finisce, i look Plus e le scene dei membri tornano bloccati e FluidEQ torna ai suoi look gratuiti; nulla di ciò che hai creato viene eliminato. Plus continua a funzionare offline fino a {graceDays} giorni dopo l’ultima volta che l’app ha confermato il tuo abbonamento. Nulla di gratuito viene mai toccato.',

  'terms.account.title': 'Il tuo account',
  'terms.account.p1':
    'Un account è un indirizzo email e una password, e devi avere almeno {age} anni per crearne uno. La password viaggia cifrata fino al servizio di accesso e lì viene conservata solo come hash a senso unico, che nessuno può rileggere, nemmeno il creatore.',
  'terms.account.p2':
    'La tua email riceve i codici che confermano l’indirizzo e reimpostano la password. Non viene mai mostrata agli altri membri: in classifica e in Visualizzatori compari con il nome utente e il nome visualizzato che scegli.',
  'terms.account.p3':
    'Sul tuo computer, l’app conserva la sessione cifrata dal sistema operativo. Gli account sono personali: tieni per te la tua password.',
  'terms.account.p4':
    'Plus funziona su un massimo di 5 computer alla volta: a casa e al lavoro, o i computer tra cui suona Condividi audio. Accedere su un sesto disconnette quello usato meno di recente.',

  'terms.sent.title': 'Cosa invia l’app, e quando',
  'terms.sent.intro':
    'Questo elenco descrive le richieste di account e Plus tramite connessioni cifrate. Il catalogo pubblico non richiede un account. I fornitori di hosting possono registrare i metadati delle richieste, inclusi gli indirizzi IP. Il Forum usa GitHub separatamente, come indicato sotto.',
  'terms.sent.when': 'Quando',
  'terms.sent.who': 'Chi può vederlo',
  'terms.sent.signIn.what': 'La tua email e la tua password',
  'terms.sent.signIn.when':
    'Quando crei un account, accedi o confermi il tuo indirizzo',
  'terms.sent.signIn.who':
    'Il servizio di accesso conserva la tua email, e la password solo come hash che nessuno può leggere.',
  'terms.sent.membership.what': 'Il tuo token di accesso',
  'terms.sent.membership.when':
    'All’avvio dell’app, quando torni al computer e quando apri una funzione Plus',
  'terms.sent.membership.who':
    'Il servizio verifica il tuo abbonamento e mantiene le sessioni dei dispositivi per applicare il limite di 5 computer.',
  'terms.sent.payment.what':
    'La tua email di pagamento e lo stato dell’abbonamento, inviati da Buy Me a Coffee',
  'terms.sent.payment.when': 'Quando paghi, rinnovi o disdici',
  'terms.sent.payment.who':
    'Il creatore, per collegare il pagamento al tuo account. Paga con l’email con cui accedi.',
  'terms.sent.looks.what': 'Il tuo token di accesso',
  'terms.sent.looks.when':
    'Quando i look Plus vengono scaricati o aggiornati, e quando l’app controlla quali scene condivise sono state rimosse',
  'terms.sent.looks.who':
    'Ogni look è firmato, e il tuo computer controlla la firma prima di riprodurlo.',
  'terms.sent.catalogue.what':
    'Richiesta del catalogo pubblico (senza account)',
  'terms.sent.catalogue.when':
    'Quando il selettore dei look mostra quali look Plus esistono, con o senza account',
  'terms.sent.catalogue.who':
    'La richiesta scarica solo l’elenco pubblico dei look.',
  'terms.sent.profile.what': 'Il tuo nome utente e nome visualizzato',
  'terms.sent.profile.when': 'Quando li scegli in classifica',
  'terms.sent.profile.who':
    'Tutti i membri che hanno effettuato l’accesso, accanto alla tua posizione in classifica e sulle scene che pubblichi.',
  'terms.sent.board.what':
    'Un numero al giorno da ciascuno dei tuoi computer: i minuti interi di musica riprodotta, fino a {capHours} ore, con la sua data e un numero casuale che distingue i tuoi computer',
  'terms.sent.board.when':
    'Solo se partecipi alla classifica: quando torni al computer, al massimo ogni {uploadHours} ore, e quando apri la classifica',
  'terms.sent.board.who':
    'Il tuo nome utente, il nome visualizzato, i punti e di cosa sono fatti: tutti i membri che hanno effettuato l’accesso.',
  'terms.sent.sceneExport.what':
    'Una scena che esporti, con il tuo nome visualizzato e l’id del tuo account',
  'terms.sent.sceneExport.when': 'Quando premi Esporta nello Studio',
  'terms.sent.sceneExport.who':
    'Della scena non viene conservato nulla. Il creatore conserva un registro di quale scena e versione hai esportato, quando, e un’impronta, per riconoscere una scena bloccata. Chi riceve il file vede il tuo nome visualizzato e l’id del tuo account.',
  'terms.sent.sceneLike.what':
    'Quale scena di un membro è sullo schermo, e il tuo mi piace',
  'terms.sent.sceneLike.when':
    'Quando la scena di un membro è in riproduzione, per mostrarne i mi piace, e quando premi il cuore o togli un mi piace',
  'terms.sent.sceneLike.who':
    'Di ciò che è sullo schermo non viene conservato nulla. I membri vedono quanti mi piace ha una scena, mai chi li ha messi.',
  'terms.sent.scenePublish.what':
    'Una scena che pubblichi, la sua immagine, la categoria che hai scelto, il tuo nome visibile e l’id del tuo account',
  'terms.sent.scenePublish.when': 'Quando premi Pubblica nello Studio',
  'terms.sent.scenePublish.who':
    'In Visualizzatori, finché non la ritiri: chiunque abbia effettuato l’accesso a FluidEQ vede la sua immagine, il nome, la categoria e il tuo nome visibile e può vederla in azione per qualche secondo, e i membri Plus possono riprodurla per intero e aggiungerla. Il creatore conserva il registro della pubblicazione, come per un’esportazione.',
  'terms.sent.gallery.what':
    'In Visualizzatori: cosa cerchi, quali scene apri e aggiungi, e ogni scena che segnali con il motivo',
  'terms.sent.gallery.when':
    'Quando esplori Visualizzatori, premi Aggiungi o invii una segnalazione',
  'terms.sent.gallery.who':
    'Le ricerche e ciò che apri non vengono conservati. I membri vedono quanti hanno aggiunto una scena, mai chi. Segnalazioni: solo il creatore.',
  'terms.sent.forum.what':
    'Nella scheda Forum: ciò che pubblichi, modifichi o elimini e ciò a cui reagisci, con il tuo accesso GitHub',
  'terms.sent.forum.when':
    'Aprire il forum ne scarica gli argomenti pubblici, senza inviare nulla su di te; il resto solo dopo che accedi con GitHub e scrivi',
  'terms.sent.forum.who':
    'GitHub, secondo le sue condizioni. I post sono pubblici nelle GitHub Discussions del progetto; il server di FluidEQ non li riceve mai.',

  'terms.never.title': 'Cosa non raccoglie il servizio Plus',
  'terms.never.p1':
    'Il tuo audio, e tutto ciò che riguarda cosa ascolti: titoli, artisti, file, cartelle e playlist.',
  'terms.never.p2': 'Le tue impostazioni EQ, i preset e i profili.',
  'terms.never.p3':
    'I tuoi dispositivi audio e i loro nomi, e le altre app del tuo computer.',
  'terms.never.p4':
    'Le scene dello Studio rimangono sul tuo computer, salvo quando le esporti, le pubblichi o le condividi con un altro strumento, come il tuo assistente IA.',

  'terms.protect.title': 'Come è protetto',
  'terms.protect.p1': 'Ogni richiesta viaggia cifrata.',
  'terms.protect.p2':
    'Le regole stanno sul server, non nell’app: ogni account può modificare solo i propri dati, e una copia modificata di FluidEQ riceve esattamente le stesse risposte.',
  'terms.protect.p3':
    'Classifica e Visualizzatori mostrano nomi utente e nomi visualizzati, mai indirizzi email né identificativi di account.',
  'terms.protect.p4':
    'Il creatore gestisce il server e può vedere ciò che conserva, per tenerlo in funzione e moderare ciò che i membri pubblicano. Nulla viene venduto o usato per pubblicità, e non c’è tracciamento né analisi.',
  'terms.protect.p5':
    'Il servizio gira su Supabase (accesso, database e file) e invia le email tramite Resend; i pagamenti passano da Buy Me a Coffee. Ognuno riceve solo ciò che serve alla sua parte.',
  'terms.protect.p6':
    'FluidEQ non conserva indirizzi IP. Il fornitore di hosting registra le richieste, indirizzi compresi, in log di breve durata per mantenere il servizio attivo e sicuro.',

  'terms.fair.title': 'Correttezza in classifica',
  'terms.fair.p1':
    'Il tempo di ascolto è contato dall’app sul tuo computer, quindi il server non può vederlo accadere. Controlla invece ogni numero: non più di {capHours} ore al giorno, nessun giorno che non sia ancora iniziato, nulla più vecchio di {windowDays} giorni, e nessun giorno che cresca più veloce dell’orologio. I numeri dei tuoi computer si sommano in un solo giorno, che a sua volta non cresce più veloce dell’orologio: più computer che suonano insieme non possono sommare più tempo di quanto ne sia passato.',
  'terms.fair.p2':
    'Tutti guadagnano punti allo stesso modo, il creatore compreso. Modificare l’app o ciò che invia, automatizzare l’ascolto, o salire con più di un account ti toglie dalla classifica, e può impedire all’account di pubblicare scene e mettere mi piace.',
  'terms.fair.p3':
    'Ogni mi piace alle tue scene vale {likePoints} punti. Un mi piace conta una volta per membro e per scena, solo dai membri Plus e mai dal tuo stesso account. I mi piace da un tuo secondo account contano come salire con più di un account.',

  'terms.rules.title': 'Regole per ciò che pubblichi',
  'terms.rules.p1':
    'Sii gentile. Niente molestie, odio, minacce, spam, contenuti illegali o dati personali di chiunque — in una scena, nel suo nome o nella sua immagine. Chiunque abbia effettuato l’accesso può vedere ciò che pubblichi, quindi condividi solo ciò che ti va di far vedere.',
  'terms.rules.p2':
    'Puoi ritirare le tue scene in qualsiasi momento. Il creatore può rimuovere scene e sospendere gli account che violano queste regole. Segnala una scena per indicarla; solo il creatore vede le segnalazioni.',

  'terms.keep.title': 'Cosa viene conservato, e come cancellarlo',
  'terms.keep.p1':
    'Classifica: «Rimuovi tutti i miei dati» nel pannello Account cancella in un colpo ogni giorno che hai inviato. Il tuo computer conserva solo i totali degli ultimi {windowDays} giorni.',
  'terms.keep.p2':
    'Il tuo nome utente e il nome visualizzato: conservati finché hai un account, e cancellati con esso.',
  'terms.keep.p3':
    'Abbonamento: la tua email di pagamento e lo stato sono conservati per collegare i pagamenti al tuo account, e vengono cancellati con esso.',
  'terms.keep.p4':
    'Il tuo account: chiedi che venga eliminato e sparisce entro {deletionDays} giorni, insieme a profilo, giorni in classifica e dati dell’abbonamento.',
  'terms.keep.p5':
    'Scene: una scena pubblicata resta in Visualizzatori finché non la ritiri, e ritirarla la rimuove subito insieme alla sua immagine. Ciò che hai pubblicato, il registro di ciò che hai esportato, le scene che hai aggiunto, i mi piace che hai messo e quelli ricevuti dalle tue scene vengono eliminati con il tuo account. Una scena bloccata per aver violato queste condizioni conserva solo la sua impronta, senza il tuo nome, per restare bloccata.',

  'terms.looks.title': 'I look Plus',
  'terms.looks.p1':
    'I look Plus sono opera del creatore, concessi in licenza per il tuo uso personale finché sei membro. Per favore non copiarli, condividerli o rivenderli.',
  'terms.looks.p2':
    'FluidEQ resta software libero sotto licenza GPL. Nulla di tutto questo cambia un diritto che la GPL ti dà.',

  'terms.scenes.title': 'Le scene che crei',
  'terms.scenes.p1':
    'Una scena che crei nello Studio è tua. FluidEQ non ne è proprietario, e la GPL che copre FluidEQ non la copre.',
  'terms.scenes.p2':
    'Le scene dello Studio rimangono sul tuo computer, salvo quando le esporti, le pubblichi o le condividi con un altro strumento, come il tuo assistente IA.',
  'terms.scenes.p3':
    'Quando esporti una scena, permetti a FluidEQ di controllarla, togliere i commenti dal suo shader e firmarla con il tuo nome, così che altri membri Plus possano riprodurla e vedere che l’hai fatta tu. Questo è tutto il permesso. Il creatore non venderà la tua scena, non la userà per pubblicità e non la renderà uno dei look Plus senza chiedertelo prima, e questo non ti impedisce di fare altro con il tuo lavoro.',
  'terms.scenes.p4':
    'Condividere fa parte di Plus, non è un lavoro: nessuno viene pagato per una scena e nessuno ne paga una. Quello che ricevi in cambio sono tutte le scene che condividono gli altri membri.',
  'terms.scenes.p5':
    'I membri a cui piace la tua scena ti danno punti in classifica, se vi partecipi. I mi piace vengono contati dal server; vedi Correttezza in classifica.',
  'terms.scenes.p6':
    'Condividi solo lavori che hai il diritto di condividere: le tue foto e i tuoi disegni, o quelli di chi lo permette. Le regole per ciò che pubblichi valgono per ogni scena che condividi. Il creatore può impedire che una scena si apra se viola queste condizioni o i diritti di qualcun altro.',
  'terms.scenes.p7':
    'Una scena condivisa da un altro membro è opera sua, concessa in licenza per il tuo uso personale finché sei membro. Puoi riprodurla, metterle mi piace e passare il file invariato ad altri membri Plus. Per favore non modificarla, non presentarla come tua, non pubblicarla altrove e non venderla.',
  'terms.scenes.p8':
    'Ritirare una scena impedisce nuovi download dalla galleria. Non elimina né revoca le copie già scaricate, che restano concesse in licenza per uso personale con Plus. FluidEQ può bloccare le scene che violano queste condizioni o i diritti altrui.',
  'terms.scenes.p9':
    'Se pubblichi una scena in Visualizzatori, permetti anche a FluidEQ di conservarla lì finché non la ritiri, di mostrare la sua immagine, il nome, la categoria e il tuo nome visibile a chiunque abbia effettuato l’accesso a FluidEQ, di riprodurgliela per qualche secondo, e di offrire la scena stessa ai membri Plus, che possono riprodurla per intero e aggiungerla. Puoi ritirarla quando vuoi, con o senza Plus. Chi l’ha già aggiunta conserva la sua copia, alle stesse condizioni di un file che gli hai inviato.',
  'terms.scenes.p10':
    'Pubblicare è facoltativo e diverso dall’esportare un file. Ogni membro può segnalare una scena pubblicata; solo il creatore legge le segnalazioni e può rimuovere una scena che viola queste condizioni o i diritti di altri.',

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
};

export default terms;
