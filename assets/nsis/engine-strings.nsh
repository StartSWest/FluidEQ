; Everything the engine page and the two engine paths say, in the ten
; languages the installer is built for (`build.nsis.installerLanguages` in
; package.json).
;
; Kept apart from installer.nsh because of the way makensis reads files, which
; cost a screenful of mangled apostrophes to learn. electron-builder hands
; makensis the main script on stdin with -INPUTCHARSET UTF8, and that flag
; reaches the main script only: an !include without a byte-order mark is read
; in the machine's ANSI code page instead. "Windows’" arrived on the page as
; "Windowsâ€™", and every Cyrillic, Devanagari and CJK string here would have
; arrived as nonsense.
;
; A BOM would fix it and cannot be used: this project's encoding check rejects
; one in every tracked text file, because a BOM written by accident is by far
; the more common bug. So the charset is stated at the !include instead, which
; needs neither a BOM nor a flag from whoever is compiling.
;
; Spanish is ${LANG_SPANISHINTERNATIONAL}, not ${LANG_SPANISH}: app-builder-lib
; maps es_ES onto NSIS's SpanishInternational language file (3082), and a
; LangString set for 1034 would leave 3082 unset. That is a warning, and
; electron-builder runs makensis with -WX, so it is also a failed build.
;
; The engine's own name stays in English in every locale. It is the name in the
; binary's version resource, which is what Windows reads out in the consent
; prompt a moment later, and a name that changes between the page and the UAC
; dialog is a name that earns a "no".
!macro EngineLangStrings
LangString EngineTitle ${LANG_ENGLISH} "How should FluidEQ process your sound?"
LangString EngineTitle ${LANG_SIMPCHINESE} "FluidEQ 该如何处理你的声音？"
LangString EngineTitle ${LANG_HINDI} "FluidEQ आपकी आवाज़ को कैसे प्रोसेस करे?"
LangString EngineTitle ${LANG_SPANISHINTERNATIONAL} "¿Cómo debe procesar FluidEQ tu sonido?"
LangString EngineTitle ${LANG_FRENCH} "Comment FluidEQ doit-il traiter votre son ?"
LangString EngineTitle ${LANG_PORTUGUESEBR} "Como deve o FluidEQ processar o teu som?"
LangString EngineTitle ${LANG_RUSSIAN} "Как FluidEQ должен обрабатывать ваш звук?"
LangString EngineTitle ${LANG_JAPANESE} "FluidEQ で音をどう処理しますか？"
LangString EngineTitle ${LANG_GERMAN} "Wie soll FluidEQ deinen Ton verarbeiten?"
LangString EngineTitle ${LANG_ITALIAN} "Come deve elaborare il suono FluidEQ?"

LangString EngineSubtitle ${LANG_ENGLISH} "One engine runs for the whole PC. You can switch later from the app menu."
LangString EngineSubtitle ${LANG_SIMPCHINESE} "整台电脑只运行一个引擎。之后可以在应用菜单里切换。"
LangString EngineSubtitle ${LANG_HINDI} "पूरे PC के लिए एक ही इंजन चलता है। बाद में ऐप के मेन्यू से बदल सकते हैं।"
LangString EngineSubtitle ${LANG_SPANISHINTERNATIONAL} "Un único motor funciona en todo el PC. Puedes cambiarlo después desde el menú de la aplicación."
LangString EngineSubtitle ${LANG_FRENCH} "Un seul moteur tourne pour tout le PC. Vous pourrez en changer plus tard depuis le menu de l’application."
LangString EngineSubtitle ${LANG_PORTUGUESEBR} "Um único motor funciona em todo o PC. Podes trocar mais tarde no menu da aplicação."
LangString EngineSubtitle ${LANG_RUSSIAN} "Для всего компьютера работает один движок. Позже его можно сменить в меню приложения."
LangString EngineSubtitle ${LANG_JAPANESE} "エンジンは PC 全体で 1 つだけ動きます。あとからアプリのメニューで切り替えられます。"
LangString EngineSubtitle ${LANG_GERMAN} "Eine Engine läuft für den ganzen PC. Du kannst später im App-Menü wechseln."
LangString EngineSubtitle ${LANG_ITALIAN} "Un solo motore lavora su tutto il PC. Puoi cambiarlo più tardi dal menu dell’app."

LangString EngineFluid ${LANG_ENGLISH} "FluidEQ Audio Processing Engine (recommended)"
LangString EngineFluid ${LANG_SIMPCHINESE} "FluidEQ Audio Processing Engine（推荐）"
LangString EngineFluid ${LANG_HINDI} "FluidEQ Audio Processing Engine (अनुशंसित)"
LangString EngineFluid ${LANG_SPANISHINTERNATIONAL} "FluidEQ Audio Processing Engine (recomendado)"
LangString EngineFluid ${LANG_FRENCH} "FluidEQ Audio Processing Engine (recommandé)"
LangString EngineFluid ${LANG_PORTUGUESEBR} "FluidEQ Audio Processing Engine (recomendado)"
LangString EngineFluid ${LANG_RUSSIAN} "FluidEQ Audio Processing Engine (рекомендуется)"
LangString EngineFluid ${LANG_JAPANESE} "FluidEQ Audio Processing Engine（推奨）"
LangString EngineFluid ${LANG_GERMAN} "FluidEQ Audio Processing Engine (empfohlen)"
LangString EngineFluid ${LANG_ITALIAN} "FluidEQ Audio Processing Engine (consigliato)"

LangString EngineFluidHint ${LANG_ENGLISH} "Runs inside Windows’ own audio system, after your sound card’s effects, so Alienware Sound Center, Nahimic, MaxxAudio and Dolby keep working. EQ and the DSP rack apply to everything, with no restart."
LangString EngineFluidHint ${LANG_SIMPCHINESE} "运行在 Windows 自己的音频系统内，位于声卡音效之后，因此 Alienware Sound Center、Nahimic、MaxxAudio 和 Dolby 都能继续工作。均衡器和 DSP 机架作用于所有声音，无需重启。"
LangString EngineFluidHint ${LANG_HINDI} "यह Windows के अपने ऑडियो सिस्टम के भीतर, आपके साउंड कार्ड के इफ़ेक्ट के बाद चलता है, इसलिए Alienware Sound Center, Nahimic, MaxxAudio और Dolby चलते रहते हैं। EQ और DSP रैक हर आवाज़ पर लागू होते हैं, बिना पुनः शुरू किए।"
LangString EngineFluidHint ${LANG_SPANISHINTERNATIONAL} "Funciona dentro del propio sistema de audio de Windows, después de los efectos de tu tarjeta de sonido, así que Alienware Sound Center, Nahimic, MaxxAudio y Dolby siguen funcionando. El EQ y el rack DSP se aplican a todo, sin reiniciar."
LangString EngineFluidHint ${LANG_FRENCH} "Fonctionne dans le système audio de Windows, après les effets de votre carte son, si bien qu’Alienware Sound Center, Nahimic, MaxxAudio et Dolby continuent de fonctionner. L’EQ et le rack DSP s’appliquent à tout, sans redémarrage."
LangString EngineFluidHint ${LANG_PORTUGUESEBR} "Funciona dentro do próprio sistema de áudio do Windows, depois dos efeitos da tua placa de som, por isso Alienware Sound Center, Nahimic, MaxxAudio e Dolby continuam a funcionar. O EQ e o rack DSP aplicam-se a tudo, sem reiniciar."
LangString EngineFluidHint ${LANG_RUSSIAN} "Работает внутри собственной звуковой системы Windows, после эффектов звуковой карты, поэтому Alienware Sound Center, Nahimic, MaxxAudio и Dolby продолжают работать. Эквалайзер и стойка DSP применяются ко всему, без перезапуска."
LangString EngineFluidHint ${LANG_JAPANESE} "Windows 自身のオーディオシステムの中、サウンドカードのエフェクトの後で動くので、Alienware Sound Center、Nahimic、MaxxAudio、Dolby はそのまま使えます。EQ と DSP ラックがすべての音に適用され、再起動は不要です。"
LangString EngineFluidHint ${LANG_GERMAN} "Läuft in Windows’ eigenem Audiosystem, nach den Effekten deiner Soundkarte, sodass Alienware Sound Center, Nahimic, MaxxAudio und Dolby weiterlaufen. EQ und DSP-Rack gelten für alles, ohne Neustart."
LangString EngineFluidHint ${LANG_ITALIAN} "Funziona dentro il sistema audio di Windows, dopo gli effetti della tua scheda audio, così Alienware Sound Center, Nahimic, MaxxAudio e Dolby continuano a funzionare. EQ e rack DSP si applicano a tutto, senza riavvio."

LangString EngineApo ${LANG_ENGLISH} "Equalizer APO"
LangString EngineApo ${LANG_SIMPCHINESE} "Equalizer APO"
LangString EngineApo ${LANG_HINDI} "Equalizer APO"
LangString EngineApo ${LANG_SPANISHINTERNATIONAL} "Equalizer APO"
LangString EngineApo ${LANG_FRENCH} "Equalizer APO"
LangString EngineApo ${LANG_PORTUGUESEBR} "Equalizer APO"
LangString EngineApo ${LANG_RUSSIAN} "Equalizer APO"
LangString EngineApo ${LANG_JAPANESE} "Equalizer APO"
LangString EngineApo ${LANG_GERMAN} "Equalizer APO"
LangString EngineApo ${LANG_ITALIAN} "Equalizer APO"

LangString EngineApoHint ${LANG_ENGLISH} "The classic engine: custom commands, Peace and VST plugins, with the DSP rack in Library playback only. It takes your sound card’s effect slot, so vendor panels can lose controls; its setup opens next and Windows must restart."
LangString EngineApoHint ${LANG_SIMPCHINESE} "经典引擎：自定义命令、Peace 和 VST 插件，DSP 机架仅在媒体库播放时生效。它会占用声卡的音效插槽，厂商面板可能失去部分控制项；接着会打开它自己的安装程序，Windows 需要重启。"
LangString EngineApoHint ${LANG_HINDI} "क्लासिक इंजन: कस्टम कमांड, Peace और VST प्लगइन, DSP रैक केवल लाइब्रेरी प्लेबैक में। यह आपके साउंड कार्ड का इफ़ेक्ट स्लॉट ले लेता है, निर्माता के पैनल से नियंत्रण गायब हो सकते हैं; इसका अपना सेटअप आगे खुलेगा और Windows को पुनः शुरू करना होगा।"
LangString EngineApoHint ${LANG_SPANISHINTERNATIONAL} "El motor clásico: comandos personalizados, Peace y plugins VST, con el rack DSP solo en la reproducción de la Biblioteca. Ocupa la ranura de efectos de tu tarjeta de sonido y los paneles del fabricante pueden perder controles; su instalación se abre después y Windows se reinicia."
LangString EngineApoHint ${LANG_FRENCH} "Le moteur classique : commandes personnalisées, Peace et plugins VST, avec le rack DSP dans la lecture de la Bibliothèque seulement. Il prend la place d’effets de votre carte son et les panneaux du fabricant peuvent perdre des réglages ; son installation s’ouvre ensuite et Windows redémarre."
LangString EngineApoHint ${LANG_PORTUGUESEBR} "O motor clássico: comandos personalizados, Peace e plugins VST, com o rack DSP só na reprodução da Biblioteca. Ocupa a ranhura de efeitos da tua placa de som e os painéis do fabricante podem perder controlos; a instalação dele abre a seguir e o Windows reinicia."
LangString EngineApoHint ${LANG_RUSSIAN} "Классический движок: свои команды, Peace и плагины VST, стойка DSP только при воспроизведении из Библиотеки. Он занимает слот эффектов звуковой карты, панели производителя могут потерять регуляторы; дальше откроется его установка, и Windows перезагрузится."
LangString EngineApoHint ${LANG_JAPANESE} "定番のエンジン。カスタムコマンド、Peace、VST プラグインが使え、DSP ラックはライブラリ再生でのみ動きます。サウンドカードのエフェクト枠を占有してメーカー製パネルの項目が消えることがあり、次に専用のセットアップが開いて Windows は再起動します。"
LangString EngineApoHint ${LANG_GERMAN} "Die klassische Engine: eigene Befehle, Peace und VST-Plugins, mit dem DSP-Rack nur in der Wiedergabe der Bibliothek. Sie belegt den Effekt-Slot deiner Soundkarte, Hersteller-Bedienfelder können Regler verlieren; danach öffnet ihre eigene Einrichtung und Windows startet neu."
LangString EngineApoHint ${LANG_ITALIAN} "Il motore classico: comandi personalizzati, Peace e plugin VST, con il rack DSP solo nella riproduzione della Libreria. Occupa lo slot effetti della tua scheda audio e i pannelli del produttore possono perdere controlli; la sua installazione si apre dopo e Windows si riavvia."

LangString EngineWhy ${LANG_ENGLISH} "Windows will ask for permission next. An audio engine has to be placed inside Windows’ audio system, and only an administrator can do that. Either choice asks once."
LangString EngineWhy ${LANG_SIMPCHINESE} "接下来 Windows 会请求授权。音频引擎必须放进 Windows 的音频系统里，而只有管理员才能这么做。两种选择都只会询问一次。"
LangString EngineWhy ${LANG_HINDI} "आगे Windows अनुमति माँगेगा। ऑडियो इंजन को Windows के ऑडियो सिस्टम के अंदर रखना पड़ता है, और यह केवल एक व्यवस्थापक ही कर सकता है। दोनों में से कोई भी विकल्प एक ही बार पूछता है।"
LangString EngineWhy ${LANG_SPANISHINTERNATIONAL} "A continuación Windows pedirá permiso. Un motor de audio tiene que colocarse dentro del sistema de audio de Windows, y eso solo puede hacerlo un administrador. Cualquiera de las dos opciones lo pide una sola vez."
LangString EngineWhy ${LANG_FRENCH} "Windows va maintenant demander une autorisation. Un moteur audio doit être placé dans le système audio de Windows, et seul un administrateur peut le faire. Les deux choix ne le demandent qu’une fois."
LangString EngineWhy ${LANG_PORTUGUESEBR} "A seguir o Windows vai pedir permissão. Um motor de áudio tem de ser colocado dentro do sistema de áudio do Windows, e só um administrador o pode fazer. Qualquer das opções pergunta uma só vez."
LangString EngineWhy ${LANG_RUSSIAN} "Дальше Windows запросит разрешение. Звуковой движок нужно поместить внутрь звуковой системы Windows, а это может сделать только администратор. Любой из вариантов спросит один раз."
LangString EngineWhy ${LANG_JAPANESE} "次に Windows が許可を求めます。オーディオエンジンは Windows のオーディオシステムの中に置く必要があり、それができるのは管理者だけです。どちらを選んでも、確認は一度だけです。"
LangString EngineWhy ${LANG_GERMAN} "Als Nächstes fragt Windows nach der Erlaubnis. Eine Audio-Engine muss in Windows’ Audiosystem eingesetzt werden, und das kann nur ein Administrator. Beide Möglichkeiten fragen einmal."
LangString EngineWhy ${LANG_ITALIAN} "Ora Windows chiederà il permesso. Un motore audio deve essere inserito nel sistema audio di Windows, e solo un amministratore può farlo. Entrambe le scelte lo chiedono una sola volta."

LangString EngineDeclined ${LANG_ENGLISH} "FluidEQ Engine was not installed – administrator permission is required. FluidEQ will still install; you can install the engine from the button inside the app."
LangString EngineDeclined ${LANG_SIMPCHINESE} "未安装 FluidEQ Engine – 需要管理员权限。FluidEQ 仍会安装；你可以用应用内的按钮安装引擎。"
LangString EngineDeclined ${LANG_HINDI} "FluidEQ Engine इंस्टॉल नहीं हुआ – व्यवस्थापक अनुमति चाहिए। FluidEQ फिर भी इंस्टॉल होगा; इंजन आप ऐप के अंदर दिए बटन से इंस्टॉल कर सकते हैं।"
LangString EngineDeclined ${LANG_SPANISHINTERNATIONAL} "FluidEQ Engine no se instaló – hace falta permiso de administrador. FluidEQ se instalará igualmente; puedes instalar el motor desde el botón que hay dentro de la aplicación."
LangString EngineDeclined ${LANG_FRENCH} "FluidEQ Engine n’a pas été installé – une autorisation d’administrateur est nécessaire. FluidEQ s’installe quand même ; vous pourrez installer le moteur depuis le bouton dans l’application."
LangString EngineDeclined ${LANG_PORTUGUESEBR} "O FluidEQ Engine não foi instalado – é preciso permissão de administrador. O FluidEQ instala-se à mesma; podes instalar o motor no botão dentro da aplicação."
LangString EngineDeclined ${LANG_RUSSIAN} "Движок FluidEQ Engine не установлен – нужны права администратора. FluidEQ всё равно установится; движок можно установить кнопкой внутри приложения."
LangString EngineDeclined ${LANG_JAPANESE} "FluidEQ Engine はインストールされませんでした – 管理者の許可が必要です。FluidEQ のインストールは続きます。エンジンはアプリ内のボタンからインストールできます。"
LangString EngineDeclined ${LANG_GERMAN} "FluidEQ Engine wurde nicht installiert – dafür sind Administratorrechte nötig. FluidEQ wird trotzdem installiert; die Engine kannst du über die Schaltfläche in der App installieren."
LangString EngineDeclined ${LANG_ITALIAN} "FluidEQ Engine non è stato installato – servono i permessi di amministratore. FluidEQ si installa comunque; puoi installare il motore dal pulsante dentro l’app."

; `$2` is the helper's exit code, put there by ${StdUtils.WaitForProcEx} a
; line before the message box. A LangString compiles to an ordinary NSIS
; string, so a variable reference inside one is resolved when the string is
; used rather than when it is defined — which is why the number goes in as a
; variable and not as a placeholder somebody would have to substitute.
LangString EngineFailed ${LANG_ENGLISH} "FluidEQ Engine setup did not finish (code $2). FluidEQ will still install; the app will offer the engine again."
LangString EngineFailed ${LANG_SIMPCHINESE} "FluidEQ Engine 的安装未能完成（代码 $2）。FluidEQ 仍会安装；应用会再次提供该引擎。"
LangString EngineFailed ${LANG_HINDI} "FluidEQ Engine का सेटअप पूरा नहीं हुआ (कोड $2)। FluidEQ फिर भी इंस्टॉल होगा; ऐप इंजन को दोबारा देगा।"
LangString EngineFailed ${LANG_SPANISHINTERNATIONAL} "La instalación de FluidEQ Engine no terminó (código $2). FluidEQ se instalará igualmente; la aplicación volverá a ofrecer el motor."
LangString EngineFailed ${LANG_FRENCH} "L’installation de FluidEQ Engine ne s’est pas terminée (code $2). FluidEQ s’installe quand même ; l’application proposera de nouveau le moteur."
LangString EngineFailed ${LANG_PORTUGUESEBR} "A instalação do FluidEQ Engine não terminou (código $2). O FluidEQ instala-se à mesma; a aplicação voltará a oferecer o motor."
LangString EngineFailed ${LANG_RUSSIAN} "Установка FluidEQ Engine не завершилась (код $2). FluidEQ всё равно установится; приложение снова предложит движок."
LangString EngineFailed ${LANG_JAPANESE} "FluidEQ Engine のセットアップが完了しませんでした（コード $2）。FluidEQ のインストールは続きます。アプリがエンジンを改めて提案します。"
LangString EngineFailed ${LANG_GERMAN} "Die Einrichtung von FluidEQ Engine wurde nicht abgeschlossen (Code $2). FluidEQ wird trotzdem installiert; die App bietet die Engine erneut an."
LangString EngineFailed ${LANG_ITALIAN} "L’installazione di FluidEQ Engine non è stata completata (codice $2). FluidEQ si installa comunque; l’app riproporrà il motore."

LangString EngineBundleMissing ${LANG_ENGLISH} "This build of FluidEQ is missing its copy of the FluidEQ Audio Processing Engine. FluidEQ will install, and it will offer the engine again from the button inside the app."
LangString EngineBundleMissing ${LANG_SIMPCHINESE} "此版本的 FluidEQ 缺少 FluidEQ Audio Processing Engine 的副本。FluidEQ 仍会安装，之后会在应用内的按钮再次提供该引擎。"
LangString EngineBundleMissing ${LANG_HINDI} "FluidEQ के इस बिल्ड में FluidEQ Audio Processing Engine की प्रति नहीं है। FluidEQ इंस्टॉल हो जाएगा और बाद में ऐप के अंदर दिए बटन से इंजन फिर से देगा।"
LangString EngineBundleMissing ${LANG_SPANISHINTERNATIONAL} "A esta versión de FluidEQ le falta su copia del FluidEQ Audio Processing Engine. FluidEQ se instalará y volverá a ofrecer el motor desde el botón que hay dentro de la aplicación."
LangString EngineBundleMissing ${LANG_FRENCH} "Il manque à cette version de FluidEQ sa copie du FluidEQ Audio Processing Engine. FluidEQ s’installe quand même et proposera de nouveau le moteur depuis le bouton dans l’application."
LangString EngineBundleMissing ${LANG_PORTUGUESEBR} "Falta a esta versão do FluidEQ a sua cópia do FluidEQ Audio Processing Engine. O FluidEQ instala-se à mesma e voltará a oferecer o motor no botão dentro da aplicação."
LangString EngineBundleMissing ${LANG_RUSSIAN} "В этой сборке FluidEQ нет копии FluidEQ Audio Processing Engine. FluidEQ всё равно установится и предложит движок снова кнопкой внутри приложения."
LangString EngineBundleMissing ${LANG_JAPANESE} "この FluidEQ のビルドには FluidEQ Audio Processing Engine のコピーがありません。FluidEQ はインストールされ、あとでアプリ内のボタンからエンジンを改めて提案します。"
LangString EngineBundleMissing ${LANG_GERMAN} "Diesem FluidEQ-Build fehlt seine Kopie der FluidEQ Audio Processing Engine. FluidEQ wird installiert und bietet die Engine später über die Schaltfläche in der App erneut an."
LangString EngineBundleMissing ${LANG_ITALIAN} "A questa build di FluidEQ manca la sua copia del FluidEQ Audio Processing Engine. FluidEQ si installa comunque e riproporrà il motore dal pulsante dentro l’app."

LangString EngineNotRemoved ${LANG_ENGLISH} "FluidEQ Engine could not be removed – administrator permission is required. You can remove it by running FluidEQ-Engine-Setup.exe uninstall from the FluidEQ folder."
LangString EngineNotRemoved ${LANG_SIMPCHINESE} "无法移除 FluidEQ Engine – 需要管理员权限。你可以在 FluidEQ 文件夹中运行 FluidEQ-Engine-Setup.exe uninstall 来移除它。"
LangString EngineNotRemoved ${LANG_HINDI} "FluidEQ Engine हटाया नहीं जा सका – व्यवस्थापक अनुमति चाहिए। आप इसे FluidEQ फ़ोल्डर में FluidEQ-Engine-Setup.exe uninstall चलाकर हटा सकते हैं।"
LangString EngineNotRemoved ${LANG_SPANISHINTERNATIONAL} "No se pudo quitar FluidEQ Engine – hace falta permiso de administrador. Puedes quitarlo ejecutando FluidEQ-Engine-Setup.exe uninstall desde la carpeta de FluidEQ."
LangString EngineNotRemoved ${LANG_FRENCH} "FluidEQ Engine n’a pas pu être supprimé – une autorisation d’administrateur est nécessaire. Vous pouvez le supprimer en lançant FluidEQ-Engine-Setup.exe uninstall depuis le dossier FluidEQ."
LangString EngineNotRemoved ${LANG_PORTUGUESEBR} "Não foi possível remover o FluidEQ Engine – é preciso permissão de administrador. Podes removê-lo executando FluidEQ-Engine-Setup.exe uninstall na pasta do FluidEQ."
LangString EngineNotRemoved ${LANG_RUSSIAN} "Не удалось удалить FluidEQ Engine – нужны права администратора. Удалить его можно, запустив FluidEQ-Engine-Setup.exe uninstall из папки FluidEQ."
LangString EngineNotRemoved ${LANG_JAPANESE} "FluidEQ Engine を削除できませんでした – 管理者の許可が必要です。FluidEQ フォルダーで FluidEQ-Engine-Setup.exe uninstall を実行すると削除できます。"
LangString EngineNotRemoved ${LANG_GERMAN} "FluidEQ Engine konnte nicht entfernt werden – dafür sind Administratorrechte nötig. Du kannst sie entfernen, indem du im FluidEQ-Ordner FluidEQ-Engine-Setup.exe uninstall ausführst."
LangString EngineNotRemoved ${LANG_ITALIAN} "Non è stato possibile rimuovere FluidEQ Engine – servono i permessi di amministratore. Puoi rimuoverlo eseguendo FluidEQ-Engine-Setup.exe uninstall dalla cartella di FluidEQ."

; Separate from EngineNotRemoved, which names administrator permission as the
; cause. That is right for a declined consent prompt and a lie for a removal
; that was allowed to run and then failed — and until the exit code was being
; read, those two could not be told apart to write a second message for.
LangString EngineRemoveFailed ${LANG_ENGLISH} "FluidEQ Engine could not be removed (code $2). You can remove it by running FluidEQ-Engine-Setup.exe uninstall from the FluidEQ folder."
LangString EngineRemoveFailed ${LANG_SIMPCHINESE} "无法移除 FluidEQ Engine（代码 $2）。你可以在 FluidEQ 文件夹中运行 FluidEQ-Engine-Setup.exe uninstall 来移除它。"
LangString EngineRemoveFailed ${LANG_HINDI} "FluidEQ Engine हटाया नहीं जा सका (कोड $2)। आप इसे FluidEQ फ़ोल्डर में FluidEQ-Engine-Setup.exe uninstall चलाकर हटा सकते हैं।"
LangString EngineRemoveFailed ${LANG_SPANISHINTERNATIONAL} "No se pudo quitar FluidEQ Engine (código $2). Puedes quitarlo ejecutando FluidEQ-Engine-Setup.exe uninstall desde la carpeta de FluidEQ."
LangString EngineRemoveFailed ${LANG_FRENCH} "FluidEQ Engine n’a pas pu être supprimé (code $2). Vous pouvez le supprimer en lançant FluidEQ-Engine-Setup.exe uninstall depuis le dossier FluidEQ."
LangString EngineRemoveFailed ${LANG_PORTUGUESEBR} "Não foi possível remover o FluidEQ Engine (código $2). Podes removê-lo executando FluidEQ-Engine-Setup.exe uninstall na pasta do FluidEQ."
LangString EngineRemoveFailed ${LANG_RUSSIAN} "Не удалось удалить FluidEQ Engine (код $2). Удалить его можно, запустив FluidEQ-Engine-Setup.exe uninstall из папки FluidEQ."
LangString EngineRemoveFailed ${LANG_JAPANESE} "FluidEQ Engine を削除できませんでした（コード $2）。FluidEQ フォルダーで FluidEQ-Engine-Setup.exe uninstall を実行すると削除できます。"
LangString EngineRemoveFailed ${LANG_GERMAN} "FluidEQ Engine konnte nicht entfernt werden (Code $2). Du kannst sie entfernen, indem du im FluidEQ-Ordner FluidEQ-Engine-Setup.exe uninstall ausführst."
LangString EngineRemoveFailed ${LANG_ITALIAN} "Non è stato possibile rimuovere FluidEQ Engine (codice $2). Puoi rimuoverlo eseguendo FluidEQ-Engine-Setup.exe uninstall dalla cartella di FluidEQ."
!macroend
