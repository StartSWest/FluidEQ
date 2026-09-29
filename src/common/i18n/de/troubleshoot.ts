const troubleshoot = {
  'troubleshoot.title': 'Audioprobleme beheben',
  'troubleshoot.description':
    'Gehen Sie die Liste von oben nach unten durch und hören Sie beim ersten Schritt auf, der hilft. Jeder greift stärker ein als der vorige, und der erste behebt die meisten Probleme.',
  'troubleshoot.footer':
    'Stimmt danach immer noch etwas nicht? Nutzen Sie **{report}** im selben Menü – es sammelt die Protokolle, entfernt alles, was Sie identifizieren könnte, und zeigt Ihnen alles, bevor etwas gesendet wird.',
  'troubleshoot.tried': 'Versucht',
  'troubleshoot.restart.title': 'Windows-Audio neu starten',
  'troubleshoot.restart.when':
    'Der Ton ist weg, oder der Graph bleibt flach, obwohl etwas spielt. Das hilft in fast allen Fällen und ist der erste Schritt.',
  'troubleshoot.restart.cost':
    'Ein paar Sekunden Stille. Windows fragt nach Ihrer Erlaubnis.',
  'troubleshoot.apo.reselect.title': 'Geräte in Equalizer APO neu auswählen',
  'troubleshoot.apo.reselect.when':
    'Ein Gerät wird entzerrt, ein anderes nicht, oder ein gerade angeschlossenes Headset wird ignoriert. Equalizer APO hängt sich an jeden Ausgang einzeln, und ein neues Gerät ist erst dabei, wenn Sie es ankreuzen.',
  'troubleshoot.apo.reselect.cost':
    'Öffnet den Device Selector von Equalizer APO. Danach ist ein Neustart nötig.',
  'troubleshoot.apo.openSelector': 'Device Selector öffnen',
  'troubleshoot.apo.mode.title': 'Den anderen Installationsmodus ausprobieren',
  'troubleshoot.apo.mode.when':
    'Ein Gerät ist im Device Selector angekreuzt und trotzdem ohne Wirkung, oder es verstummt ganz, sobald Sie es ankreuzen. Equalizer APO kann sich auf zwei Arten in Windows-Audio einhängen, und manche Hardware funktioniert nur mit einer davon.',
  'troubleshoot.apo.mode.cost':
    'Ein Neustart. Umkehrbar – auf demselben Weg zurückschalten.',
  'troubleshoot.apo.mode.detail':
    'Öffnen Sie im Device Selector die **Troubleshooting options**. Standard ist die Installation als **APO**, die auf den meisten Rechnern funktioniert. **Install as SFX/EFX** ist die Alternative für Geräte, deren Treiber eigene Effekte mitbringen – viel Laptop- und Gaming-Audio. Wenn ein Gerät nach dem Ankreuzen nicht mehr funktioniert, probieren Sie den anderen Modus, bevor Sie annehmen, dass es sich nicht entzerren lässt.',
  'troubleshoot.apo.reinstall.title': 'Equalizer APO neu installieren',
  'troubleshoot.apo.reinstall.when':
    'Die ersten beiden Schritte haben nichts geändert, oder seit einem Windows-Update funktioniert der Equalizer nicht mehr. Sein Installationsprogramm ist zugleich sein Reparaturwerkzeug: Es registriert die Audiokomponente neu und öffnet die Geräteliste wieder.',
  'troubleshoot.apo.reinstall.cost':
    'Administratorrechte, und danach muss der Computer neu starten. Ihre FluidEQ-Profile und Presets bleiben unverändert.',
  'troubleshoot.apo.readd.title':
    'Gerät entfernen, neu starten, wieder hinzufügen',
  'troubleshoot.apo.readd.when':
    'Nur wenn ein bestimmtes Gerät nach der Neuinstallation immer noch nicht stimmt. Entfernen Sie das Häkchen im Device Selector, starten Sie den Computer neu, setzen Sie das Häkchen wieder und starten Sie noch einmal neu.',
  'troubleshoot.apo.readd.cost': 'Zwei Neustarts.',
  'troubleshoot.apo.readd.detail':
    'Die zwei Neustarts sind kein Aberglaube. Equalizer APO hängt sich beim Start des Rechners an einen Audio-Endpunkt, daher bleibt ein Gerät, das bei laufendem Windows entfernt wird, halb verbunden, bis es das nicht mehr ist – und wer es vorher wieder hinzufügt, stellt den fehlerhaften Zustand gleich wieder her.',
  'troubleshoot.engine.enable.title':
    'Die FluidEQ-Engine wieder auf Ihre Ausgänge setzen',
  'troubleshoot.engine.enable.when':
    'Ein Gerät wird entzerrt, ein anderes nicht, oder ein gerade angeschlossenes Headset wird ignoriert. Die Engine hängt sich an jeden Ausgang einzeln, und ein Windows-Update kann sie von einem Ausgang lösen, an dem sie schon war.',
  'troubleshoot.engine.permission':
    'Windows fragt nach Ihrer Erlaubnis, und der Ton startet kurz neu. Kein Neustart des Computers.',
  'troubleshoot.engine.remove.title':
    'Die FluidEQ-Engine von diesem Ausgang entfernen',
  'troubleshoot.engine.remove.when':
    'Nur dieser eine Ausgang stimmt nicht, und nichts von oben hilft, oder Sie möchten ihn einem anderen Audioprogramm überlassen. Die Engine wird von dem Ausgang entfernt, über den Windows gerade abspielt, und was sie ersetzt hatte, kommt zurück.',
  'troubleshoot.engine.remove.cost':
    'Windows fragt nach Ihrer Erlaubnis, und der Ton startet kurz neu. Ihre anderen Ausgänge bleiben unverändert, und der Schritt darüber setzt die Engine wieder ein.',
  'troubleshoot.engine.remove.action': 'Von diesem Ausgang entfernen',
} as const;

export default troubleshoot;
