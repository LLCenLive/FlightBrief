/* =========================================================
   FlightBrief — traductions de l'interface et du bot (v1.7)
   ---------------------------------------------------------
   Une ligne par texte : FRANÇAIS <tab> ENGLISH <tab> ESPAÑOL
   • la colonne FR doit reprendre le texte affiché tel quel (voir renderer/i18n.js) ;
   • {0}, {1}… = parties variables, à garder (dans l'ordre que l'on veut) côté EN / ES ;
   • une ligne qui commence par # est ignorée.
   Textes manquants : node scripts/i18n-extract.js
   ========================================================= */
(typeof module !== 'undefined' && module.exports ? require('../i18n.js') : FBI18N).load(`
!arrivee 21:47	!arrival 21:47	!llegada 21:47
!maville Lyon	!mycity London	!miciudad Madrid
!maville oublier	!mycity forget	!miciudad olvidar
!pari 180	!bet 180	!apuesta 180
!passeport cacher	!passport hide	!pasaporte ocultar
!rep …	!answer …	!resp …
(15 s après)	(15 s later)	(15 s después)
(30° depuis l'éloignement, côté protégé) pendant 1 min, puis vire {0} pour intercepter le cap d'insertion ({1}°).	(30° from outbound, protected side) for 1 min, then turn {0} to intercept the inbound course ({1}°).	(30° desde el alejamiento, lado protegido) durante 1 min, luego vira {0} para interceptar el rumbo de entrada ({1}°).
(4 s après le toucher)	(4 s after touchdown)	(4 s después de la toma)
(bouton « Ouvrir dans Safari » ou icône boussole) : l'installation du certificat et l'ajout à l'écran d'accueil ne fonctionnent que dans Safari.	(“Open in Safari” button or compass icon): installing the certificate and adding to the home screen only work in Safari.	(botón «Abrir en Safari» o icono de brújula): la instalación del certificado y el acceso en la pantalla de inicio solo funcionan en Safari.
(donnée par	(given by	(dada por
(en haut) →	(at the top) →	(arriba) →
(fermé)	(closed)	(cerrado)
(gratuit, 2 minutes, une seule fois). Elle reste à toi : FlightBrief n'utilise aucun identifiant commun.	(free, 2 minutes, one time only). It stays yours: FlightBrief uses no shared credentials.	(gratis, 2 minutos, una sola vez). Sigue siendo tuya: FlightBrief no usa ningún identificador común.
(joue l'alerte quand tu relâches le curseur)	(plays the alert when you release the slider)	(reproduce la alerta al soltar el control)
(joue le son quand tu relâches le curseur)	(plays the sound when you release the slider)	(reproduce el sonido al soltar el control)
(ou « Ajouter à l'écran d'accueil »).	(or “Add to Home screen”).	(o «Añadir a la pantalla de inicio»).
(parallèle à l'insertion, côté non protégé) pendant 1 min, puis vire {0} (plus de 180°) pour intercepter le cap d'insertion ({1}°).	(parallel to the inbound course, non-protected side) for 1 min, then turn {0} (more than 180°) to intercept the inbound course ({1}°).	(paralelo a la entrada, lado no protegido) durante 1 min, luego vira {0} (más de 180°) para interceptar el rumbo de entrada ({1}°).
(serré)	(tight)	(ajustado)
(une fois, au début)	(once, at the start)	(una vez, al principio)
(variable suspectée : {0})	(suspected variable: {0})	(variable sospechosa: {0})
(vide, non affiché)	(empty, not shown)	(vacío, no se muestra)
({0} des succès + {1} XP par vol)	({0} from achievements + {1} XP per flight)	({0} de logros + {1} XP por vuelo)
({0} réponse{1})	({0} answer{1})	({0} respuesta{1})
({0}e vol)	(flight #{0})	({0}.º vuelo)
(à {0} kt sur {1} NM)	(at {0} kt over {1} NM)	(a {0} kt en {1} NM)
(Échap pour annuler)	(Esc to cancel)	(Esc para cancelar)
) s'affichent ici pendant que les paris sont ouverts.	) show up here while bets are open.	) aparecen aquí mientras las apuestas están abiertas.
) — repli sur la mesure 1 Hz.	) — falling back to the 1 Hz measurement.	) — se usa la medición a 1 Hz.
), connecte-le ici et nomme-le modérateur de ta chaîne (	), connect it here and make it a moderator of your channel (	), conéctala aquí y nómbrala moderadora de tu canal (
). Renseigne les champs manuellement, ou réessaie.	). Fill in the fields manually, or try again.	). Rellena los campos a mano o vuelve a intentarlo.
). Réessaie dans un instant.	). Try again in a moment.	). Vuelve a intentarlo en un momento.
* distance orthodromique départ → arrivée (vol non tracké).	* great-circle distance departure → arrival (untracked flight).	* distancia ortodrómica salida → llegada (vuelo sin seguimiento).
* distance orthodromique départ → arrivée (étape sans vol tracké).	* great-circle distance departure → arrival (leg without a tracked flight).	* distancia ortodrómica salida → llegada (etapa sin vuelo con seguimiento).
, active l'accès puis scanne le QR code avec ce téléphone.	, enable access then scan the QR code with this phone.	, activa el acceso y escanea el código QR con este teléfono.
, avec FlightBrief ouvert.	, with FlightBrief open.	, con FlightBrief abierto.
, correspondance en cours vers {0}	, connection under way to {0}	, conexión en curso hacia {0}
, pile à la minute	, spot on to the minute	, exacto al minuto
, puis	, then	, luego
, puis réinstalle l'icône sur l'écran d'accueil.	, then reinstall the icon on the home screen.	, luego vuelve a instalar el icono en la pantalla de inicio.
, puis réinstalle l'icône sur l'écran d'accueil. Tes données restent consultables en attendant.	, then reinstall the icon on the home screen. Your data stays viewable in the meantime.	, luego vuelve a instalar el icono en la pantalla de inicio. Tus datos siguen disponibles mientras tanto.
, soit	, i.e.	, o sea
, sous la forme « [{0}] … »	, as “[{0}] …”	, con la forma «[{0}] …»
, à {0} min près	, {0} min off	, a {0} min
. L'appli garde une copie des données sur le téléphone : tu la mets à jour d'un appui sur « Synchroniser » quand tu es sur le	. The app keeps a copy of your data on the phone: refresh it with one tap on “Sync” when you're on the	. La app guarda una copia de los datos en el teléfono: la actualizas con un toque en «Sincronizar» cuando estás en el
. Pour éviter de la réinstaller, fixe l'adresse IP de ton PC dans ta box (bail DHCP statique).	. To avoid reinstalling it, give your PC a fixed IP address in your router (static DHCP lease).	. Para no tener que reinstalarla, fija la dirección IP de tu PC en el router (concesión DHCP estática).
. Rien n'est envoyé à Twitch sans ta validation.	. Nothing is sent to Twitch without your approval.	. No se envía nada a Twitch sin tu validación.
. Si plusieurs adresses sont proposées, choisis celle de ta box (souvent 192.168.x.x).	. If several addresses are offered, pick your router's one (often 192.168.x.x).	. Si aparecen varias direcciones, elige la de tu router (a menudo 192.168.x.x).
1 000 h de vol cumulées.	1,000 flight hours logged.	1000 horas de vuelo acumuladas.
1 000 heures	1,000 hours	1000 horas
10 000 milles nautiques parcourus.	10,000 nautical miles flown.	10 000 millas náuticas recorridas.
10 arrivées avec un contrôleur en ligne.	10 arrivals with an online controller.	10 llegadas con un controlador en línea.
10 atterrissages de nuit.	10 night landings.	10 aterrizajes nocturnos.
10 atterrissages trackés d'affilée sans rebond.	10 tracked landings in a row without a bounce.	10 aterrizajes seguidos con seguimiento sin rebote.
10 atterrissages à moins de 100 ft/min.	10 landings under 100 ft/min.	10 aterrizajes por debajo de 100 ft/min.
10 avions dans le hangar.	10 aircraft in the hangar.	10 aviones en el hangar.
10 aéroports français différents.	10 different French airports.	10 aeropuertos franceses distintos.
10 h de vol cumulées.	10 flight hours logged.	10 horas de vuelo acumuladas.
10 heures	10 hours	10 horas
10 touchers entre 500 et 2 000 ft après le seuil.	10 touchdowns between 500 and 2,000 ft past the threshold.	10 tomas entre 500 y 2000 ft pasado el umbral.
10 vols au logbook.	10 flights in the logbook.	10 vuelos en el logbook.
10 vols sur IVAO.	10 flights on IVAO.	10 vuelos en IVAO.
10 vols sur VATSIM.	10 flights on VATSIM.	10 vuelos en VATSIM.
100 aéroports différents.	100 different airports.	100 aeropuertos distintos.
100 h de vol cumulées.	100 flight hours logged.	100 horas de vuelo acumuladas.
100 h sur IVAO	100 h on IVAO	100 h en IVAO
100 h sur VATSIM	100 h on VATSIM	100 h en VATSIM
100 heures	100 hours	100 horas
100 heures de vol sur IVAO.	100 flight hours on IVAO.	100 horas de vuelo en IVAO.
100 heures de vol sur VATSIM.	100 flight hours on VATSIM.	100 horas de vuelo en VATSIM.
100 vols au logbook.	100 flights in the logbook.	100 vuelos en el logbook.
1er vol	1st flight	1.er vuelo
2 colonnes	2 columns	2 columnas
25 atterrissages à moins de 100 ft/min.	25 landings under 100 ft/min.	25 aterrizajes por debajo de 100 ft/min.
25 aéroports différents.	25 different airports.	25 aeropuertos distintos.
25 paris d'atterrissage terminés.	25 landing bets completed.	25 apuestas de aterrizaje completadas.
25 vols en ligne (VATSIM ou IVAO).	25 online flights (VATSIM or IVAO).	25 vuelos en línea (VATSIM o IVAO).
25 vols IFR.	25 IFR flights.	25 vuelos IFR.
25 vols VFR.	25 VFR flights.	25 vuelos VFR.
250 vols au logbook.	250 flights in the logbook.	250 vuelos en el logbook.
3 colonnes	3 columns	3 columnas
3 vols le même jour.	3 flights on the same day.	3 vuelos el mismo día.
3 étapes, à faire une seule fois. Ensuite l'appli s'ouvre même sans ton PC et sans Wi-Fi : tu la mets à jour d'un appui sur « Synchroniser » quand tu es chez toi.	3 steps, done only once. After that the app opens even without your PC or Wi-Fi: refresh it with one tap on “Sync” when you're at home.	3 pasos, solo una vez. Después la app se abre incluso sin tu PC y sin Wi-Fi: la actualizas con un toque en «Sincronizar» cuando estás en casa.
5 avions dans le hangar.	5 aircraft in the hangar.	5 aviones en el hangar.
50 000 milles nautiques parcourus.	50,000 nautical miles flown.	50 000 millas náuticas recorridas.
50 atterrissages de nuit.	50 night landings.	50 aterrizajes nocturnos.
50 aéroports français différents.	50 different French airports.	50 aeropuertos franceses distintos.
50 captures d'écran.	50 screenshots.	50 capturas de pantalla.
50 vols au logbook.	50 flights in the logbook.	50 vuelos en el logbook.
50 vols sur IVAO.	50 flights on IVAO.	50 vuelos en IVAO.
50 vols sur VATSIM.	50 flights on VATSIM.	50 vuelos en VATSIM.
500 h de vol cumulées.	500 flight hours logged.	500 horas de vuelo acumuladas.
500 heures	500 hours	500 horas
500 vols au logbook.	500 flights in the logbook.	500 vuelos en el logbook.
7 dernières	last 7	últimas 7
: clique sur « Lancer le vol & le tracker ». Ton vol apparaîtra ici en direct, sur la carte.	: click “Start flight & tracker”. Your flight will appear here live, on the map.	: haz clic en «Iniciar vuelo y seguimiento». Tu vuelo aparecerá aquí en directo, en el mapa.
: menu ⋮ → « Installer l'application »).	: ⋮ menu → “Install app”).	: menú ⋮ → «Instalar aplicación»).
: Partager → « Sur l'écran d'accueil » ·	: Share → “Add to Home Screen” ·	: Compartir → «Añadir a pantalla de inicio» ·
@{0} aucun vol à l'embarquement pour l'instant. Reviens au prochain départ !	@{0} no flight is boarding right now. Come back for the next departure!	@{0} ningún vuelo está embarcando ahora. ¡Vuelve en la próxima salida!
@{0} donne ta ville pour qu'on te salue en la survolant : !maville Lyon (ou !maville Valence ES)	@{0} tell us your city so we can wave when we fly over it: !mycity London (or !mycity Valencia ES)	@{0} dinos tu ciudad para saludarte al sobrevolarla: !miciudad Madrid (o !miciudad Valencia ES)
@{0} je ne trouve pas « {1} ». Essaie la grande ville la plus proche, ou ajoute le pays : !maville Valence ES	@{0} I can't find “{1}”. Try the nearest big city, or add the country: !mycity Valencia ES	@{0} no encuentro «{1}». Prueba con la ciudad grande más cercana o añade el país: !miciudad Valencia ES
@{0} les portes sont fermées pour ce vol, rendez-vous au prochain !	@{0} doors are closed for this flight, see you on the next one!	@{0} las puertas están cerradas para este vuelo, ¡nos vemos en el próximo!
@{0} pas de voyage en cours. Enchaîne les vols sans en rater un pour cumuler des correspondances (bonus de miles) !	@{0} no trip under way. Join flights back to back without missing one to stack connections (bonus miles)!	@{0} no hay viaje en curso. ¡Encadena vuelos sin perderte ninguno para sumar conexiones (millas extra)!
@{0} pas encore de miles : tape !embarquer au prochain vol pour commencer.	@{0} no miles yet: type !board on the next flight to get started.	@{0} aún no tienes millas: escribe !embarcar en el próximo vuelo para empezar.
@{0} ta ville : {1} {2} — on criera quand on passera au-dessus ! (!maville oublier pour l'effacer)	@{0} your city: {1} {2} — we'll shout when we fly over it! (!mycity forget to remove it)	@{0} tu ciudad: {1} {2} — ¡avisaremos al sobrevolarla! (!miciudad olvidar para borrarla)
@{0} ton passeport est de nouveau visible sur le carnet de vol public.	@{0} your passport is visible again on the public logbook.	@{0} tu pasaporte vuelve a ser visible en el diario de vuelo público.
@{0} ton passeport est encore vierge : embarque (!embarquer) et atterris avec nous pour ton premier tampon !	@{0} your passport is still blank: board (!board) and land with us for your first stamp!	@{0} tu pasaporte sigue en blanco: embarca (!embarcar) y aterriza con nosotros para tu primer sello.
@{0} ton passeport n'apparaîtra plus sur le carnet de vol public.	@{0} your passport will no longer appear on the public logbook.	@{0} tu pasaporte ya no aparecerá en el diario de vuelo público.
@{0} tu es déjà à bord 😉	@{0} you're already on board 😉	@{0} ya estás a bordo 😉
@{0} ville effacée.	@{0} city removed.	@{0} ciudad borrada.
A donné sa ville	Shared their city	Ha dado su ciudad
Accent	Accent	Acento
Accent IFR	IFR accent	Acento IFR
Accent VFR	VFR accent	Acento VFR
Accept	Accept	Aceptar
Actif dans le chat	Active in chat	Activo en el chat
Active VATSIM et/ou IVAO sur la carte pour voir les contrôleurs en ligne.	Turn on VATSIM and/or IVAO on the map to see online controllers.	Activa VATSIM y/o IVAO en el mapa para ver los controladores en línea.
Activer l'accès depuis le téléphone	Enable access from the phone	Activar el acceso desde el teléfono
Activer le bot	Enable the bot	Activar el bot
Activer le rappel	Enable the reminder	Activar el recordatorio
Activer « À bord »	Enable “On board”	Activar «A bordo»
Activité du chat	Chat activity	Actividad del chat
Activé ✓ — installation sur le port {0}, appli sécurisée (HTTPS) sur {1}:{2}.	Enabled ✓ — setup on port {0}, secure app (HTTPS) on {1}:{2}.	Activado ✓ — instalación en el puerto {0}, app segura (HTTPS) en {1}:{2}.
Activé, mais aucune connexion réseau locale détectée sur ce PC (Wi-Fi / Ethernet).	Enabled, but no local network connection was detected on this PC (Wi-Fi / Ethernet).	Activado, pero no se detecta ninguna conexión de red local en este PC (Wi-Fi / Ethernet).
activées	on	activadas
Actualisation impossible ({0}) — affichage de la dernière copie enregistrée.	Couldn't refresh ({0}) — showing the last saved copy.	No se pudo actualizar ({0}) — se muestra la última copia guardada.
Actualiser	Refresh	Actualizar
Adapte les couleurs, les polices et la disposition de la carte de briefing à ton identité de chaîne.	Match the briefing card's colours, fonts and layout to your channel's identity.	Adapta los colores, las fuentes y la disposición de la tarjeta de briefing a la identidad de tu canal.
Admin	Admin	Admin
Adresse de la source navigateur	Browser source address	Dirección de la fuente de navegador
Adresse du site une fois publié	Site address once published	Dirección del sitio una vez publicado
Adresse à ouvrir sur le téléphone	Address to open on the phone	Dirección que abrir en el teléfono
Afficher aussi les réponses sur l'overlay	Also show replies on the overlay	Mostrar también las respuestas en el overlay
Afficher les contrôleurs sur la carte	Show controllers on the map	Mostrar los controladores en el mapa
Afficher les {0} vols	Show all {0} flights	Mostrar los {0} vuelos
affilée	in a row	seguidos
Afrique	Africa	África
Ajoute au moins une étape (une ligne OACI départ;OACI arrivée).	Add at least one leg (one line: departure ICAO;arrival ICAO).	Añade al menos una etapa (una línea OACI salida;OACI llegada).
Ajoute Ctrl, Alt ou Maj (sauf pour les touches F1–F24, Impr. écran et le pavé numérique).	Add Ctrl, Alt or Shift (except for F1–F24, Print Screen and the numeric keypad).	Añade Ctrl, Alt o Mayús (salvo para F1–F24, Impr Pant y el teclado numérico).
Ajoute jusqu'à 2 textes libres à afficher sur l'overlay (ex : ton Discord, un sponsor…). Laisse le champ vide pour qu'il n'apparaisse pas.	Add up to 2 custom texts to show on the overlay (e.g. your Discord, a sponsor…). Leave the field empty to hide it.	Añade hasta 2 textos libres para el overlay (p. ej. tu Discord, un patrocinador…). Deja el campo vacío para que no aparezca.
Ajouter	Add	Añadir
Ajouter ce tour	Add this tour	Añadir este tour
Ajouter des images au vol	Add images to the flight	Añadir imágenes al vuelo
Ajouter un avion	Add an aircraft	Añadir un avión
Ajouter un vol	Add a flight	Añadir un vuelo
Alignement de l'en-tête	Header alignment	Alineación del encabezado
Altitude	Altitude	Altitud
Altitude (max {0} ft)	Altitude (max {0} ft)	Altitud (máx. {0} ft)
Altitude cible (ft)	Target altitude (ft)	Altitud objetivo (ft)
Altitude de croisière (ft)	Cruise altitude (ft)	Altitud de crucero (ft)
Altitude max	Max altitude	Altitud máx.
Altitude max : {0} ft	Max altitude: {0} ft	Altitud máx.: {0} ft
Altitude max atteinte	Max altitude reached	Altitud máx. alcanzada
Altitude pression (ft)	Pressure altitude (ft)	Altitud de presión (ft)
altitude, vitesse sol et phase de vol	altitude, ground speed and flight phase	altitud, velocidad respecto al suelo y fase de vuelo
Amélioré	Improved	Mejorado
Amérique du Nord	North America	América del Norte
Amérique du Sud	South America	América del Sur
Animation d'entrée	Entrance animation	Animación de entrada
Animations de croisière	Cruise animations	Animaciones de crucero
Annonce de {0} impossible ({1}) — utilise l'adresse IP du PC.	Couldn't announce {0} ({1}) — use the PC's IP address.	No se pudo anunciar {0} ({1}) — usa la dirección IP del PC.
Annoncer l'ouverture et le résultat dans le chat	Announce opening and result in chat	Anunciar la apertura y el resultado en el chat
Annuler	Cancel	Cancelar
Annuler le vol	Cancel flight	Cancelar vuelo
août	August	agosto
Aperçu dans le navigateur	Preview in browser	Vista previa en el navegador
Aperçu des alertes	Alerts preview	Vista previa de alertas
Aperçu en direct	Live preview	Vista previa en directo
Aperçu À bord	On board preview	Vista previa A bordo
Aperçu — le rendu réel est servi en direct sur l'adresse OBS ci-contre	Preview — the real output is served live at the OBS address alongside	Vista previa — el resultado real se sirve en directo en la dirección OBS de al lado
Aperçu — overlay Twitch (données live si un vol est suivi)	Preview — Twitch overlay (live data if a flight is tracked)	Vista previa — overlay de Twitch (datos en directo si se sigue un vuelo)
Appareil	Aircraft	Aeronave
Appareil : {0}	Aircraft: {0}	Aeronave: {0}
appareil du vol	flight's aircraft	aeronave del vuelo
Appareil détecté :	Detected aircraft:	Aeronave detectada:
Appareil pas encore renseigné.	Aircraft not set yet.	Aeronave aún sin indicar.
Appareils les plus utilisés	Most used aircraft	Aeronaves más usadas
Appareil{0}	Aircraft{0}	Aeronave{0}
Application déclarée	Registered application	Aplicación registrada
Application Twitch enregistrée ✓ — tu peux maintenant connecter le compte qui parlera dans le chat.	Twitch application saved ✓ — you can now connect the account that will talk in chat.	Aplicación de Twitch guardada ✓ — ya puedes conectar la cuenta que hablará en el chat.
Application Twitch inchangée ✓	Twitch application unchanged ✓	Aplicación de Twitch sin cambios ✓
Application Vibe codée par LLCenLive avec Claude Sonnet 5	App vibe-coded by LLCenLive with Claude Sonnet 5	App vibe-codeada por LLCenLive con Claude Sonnet 5
Appliquer un thème remplace couleurs, polices et disposition ci-dessous — tu peux ensuite les affiner librement.	Applying a theme replaces the colours, fonts and layout below — you can then fine-tune them freely.	Aplicar un tema sustituye colores, fuentes y disposición de abajo — luego puedes ajustarlos libremente.
Approche	Approach	Aproximación
Approche finale	Final approach	Aproximación final
approche finale	final approach	aproximación final
Approche finale en 3D	Final approach in 3D	Aproximación final en 3D
approuver le certificat de ce PC	approve this PC's certificate	aprobar el certificado de este PC
Appuie sur ta combinaison…	Press your key combination…	Pulsa tu combinación…
Après de nouveaux vols : régénère, puis ré-uploade les fichiers (GitHub remplace les anciens).	After new flights: regenerate, then re-upload the files (GitHub replaces the old ones).	Tras nuevos vuelos: regenera y vuelve a subir los archivos (GitHub sustituye los antiguos).
Argent	Silver	Plata
Arrivé	Arrived	Llegado
Arrivée	Arrival	Llegada
arrivée	arrival	llegada
Arrivée (OACI)	Arrival (ICAO)	Llegada (OACI)
Arrivée estimée	Estimated arrival	Llegada estimada
Arrivée: {0}	Arrival: {0}	Llegada: {0}
Arrivées	Arrivals	Llegadas
Arrivés : tampons distribués	Arrived: stamps handed out	Llegados: sellos repartidos
Arrivés à destination 🛬	Arrived at destination 🛬	Llegamos a destino 🛬
arrière	behind	detrás
Arrêt du vol…	Stopping flight…	Deteniendo el vuelo…
Arrêter le vol & envoyer le PIREP	Stop flight & file the PIREP	Detener vuelo y enviar el PIREP
Asie	Asia	Asia
Assidu	Regular	Asiduo
Associé automatiquement par mot-clé	Matched automatically by keyword	Asociado automáticamente por palabra clave
ATC en ligne · VATSIM & IVAO	Online ATC · VATSIM & IVAO	ATC en línea · VATSIM e IVAO
Attention	Warning	Atención
Atterri	Landed	Aterrizado
Atterrissage	Landing	Aterrizaje
Atterrissage (test)	Landing (test)	Aterrizaje (prueba)
Atterrissages	Landings	Aterrizajes
Atterrissage{0}{1}	Landing{0}{1}	Aterrizaje{0}{1}
Atterro	Landing	Aterrizaje
Au centre	Centre	Centro
Au décollage	At takeoff	Al despegar
Au moins un vol sur VATSIM et un sur IVAO.	At least one flight on VATSIM and one on IVAO.	Al menos un vuelo en VATSIM y otro en IVAO.
Au premier lancement, Windows peut demander d'autoriser FlightBrief sur le réseau : accepte pour les	On first launch, Windows may ask to allow FlightBrief on the network: accept for	En el primer arranque, Windows puede pedir que autorices FlightBrief en la red: acepta para las
Au programme	Coming up	En el programa
Au programme de ce vol	On this flight's programme	En el programa de este vuelo
Au sol	On ground	En tierra
au sol	on ground	en tierra
Au sol / roulage	On ground / taxiing	En tierra / rodaje
au-delà). {0} Glisser pour tourner, molette pour zoomer.	beyond). {0} Drag to rotate, scroll to zoom.	más allá). {0} Arrastra para girar, rueda para hacer zoom.
Au-dessus de quel pays volons-nous en ce moment ?	Which country are we flying over right now?	¿Sobre qué país volamos ahora mismo?
Aucun	None	Ninguno
Aucun atterrissage enregistré pour l'instant.	No landing recorded yet.	Aún no hay ningún aterrizaje registrado.
Aucun atterrissage mesuré : les taux de toucher viennent des vols trackés via SimConnect.	No measured landing: touchdown rates come from flights tracked through SimConnect.	Ningún aterrizaje medido: las tasas de toma vienen de los vuelos seguidos con SimConnect.
Aucun compte connecté.	No account connected.	Ninguna cuenta conectada.
aucun contrôleur	no controller	ningún controlador
aucun des codes du logbook n'a été trouvé dans l'index ({0} aéroports). Exemples : {1}.	none of the logbook codes were found in the index ({0} airports). Examples: {1}.	ninguno de los códigos del logbook se encontró en el índice ({0} aeropuertos). Ejemplos: {1}.
Aucun des vols filtrés n'a pu être placé sur le globe (aéroport introuvable dans l'index local).	None of the filtered flights could be placed on the globe (airport not found in the local index).	Ninguno de los vuelos filtrados se pudo situar en el globo (aeropuerto no encontrado en el índice local).
Aucun départ depuis ce terrain.	No departures from this airfield.	Ninguna salida desde este aeródromo.
Aucun passager à bord pour l'instant. !embarquer pour être le premier !	No passengers on board yet. !board to be the first!	Aún no hay pasajeros a bordo. ¡!embarcar para ser el primero!
aucun plan de vol actif pour ce pseudo SimBrief	no active flight plan for this SimBrief username	ningún plan de vuelo activo para este usuario de SimBrief
Aucun plan de vol chargé pour le moment.	No flight plan loaded at the moment.	Ningún plan de vuelo cargado por ahora.
Aucun plan de vol trouvé pour ce pseudo (ou compte SimBrief invalide).	No flight plan found for this username (or invalid SimBrief account).	No se encontró ningún plan de vuelo para este usuario (o cuenta de SimBrief no válida).
Aucun pour l'instant.	None yet.	Ninguno por ahora.
Aucun raccourci	No shortcut	Sin atajo
Aucun raccourci : utilise le bouton du Briefing.	No shortcut: use the Briefing button.	Sin atajo: usa el botón del Briefing.
Aucun résultat.	No results.	Sin resultados.
Aucun succès pour l'instant : enregistre un premier vol !	No achievements yet: log a first flight!	Aún no hay logros: ¡registra un primer vuelo!
Aucun tour en cours — tous tes tours sont terminés 🎉	No tour in progress — all your tours are complete 🎉	Ningún tour en curso — todos tus tours están terminados 🎉
Aucun tour en cours 🎉	No tour in progress 🎉	Ningún tour en curso 🎉
Aucun tour IVAO pour le moment. Crée une carrière de type IVAO puis ajoute un tour ci-dessous.	No IVAO tours yet. Create an IVAO career, then add a tour below.	Aún no hay tours de IVAO. Crea una carrera de tipo IVAO y añade un tour abajo.
Aucun vol associé à cet avion.	No flights linked to this aircraft.	Ningún vuelo asociado a este avión.
Aucun vol associé. Choisis cet avion dans le champ « Avion du hangar » en enregistrant un vol, ou ajoute des mots-clés qui correspondent au champ « Appareil » de tes vols.	No linked flights. Pick this aircraft in the “Hangar aircraft” field when logging a flight, or add keywords that match the “Aircraft” field of your flights.	Ningún vuelo asociado. Elige este avión en el campo «Avión del hangar» al registrar un vuelo, o añade palabras clave que coincidan con el campo «Aeronave» de tus vuelos.
Aucun vol avec départ/arrivée renseignés ne correspond aux filtres actuels.	No flight with departure/arrival filled in matches the current filters.	Ningún vuelo con salida/llegada indicadas coincide con los filtros actuales.
Aucun vol dans ton logbook pour le moment.	No flights in your logbook yet.	Aún no hay vuelos en tu logbook.
Aucun vol du logbook avec ce départ et cette arrivée	No logbook flight with this departure and arrival	Ningún vuelo del logbook con esta salida y llegada
Aucun vol en cours	No flight in progress	Ningún vuelo en curso
Aucun vol en cours à arrêter.	No flight in progress to stop.	No hay ningún vuelo en curso que detener.
Aucun vol en cours.	No flight in progress.	Ningún vuelo en curso.
Aucun vol enregistré pour l'instant.	No flights logged yet.	Aún no hay vuelos registrados.
Aucun vol enregistré pour le moment.	No flights logged yet.	Aún no hay vuelos registrados.
Aucun vol enregistré pour l’instant.	No flights logged yet.	Aún no hay vuelos registrados.
Aucun vol ne correspond.	No matching flights.	Ningún vuelo coincide.
Aucun vol pour le moment	No flights yet	Aún no hay vuelos
Aucun vol pour le moment.	No flights yet.	Aún no hay vuelos.
Aucune	None	Ninguna
Aucune arrivée sur ce terrain.	No arrivals at this airfield.	Ninguna llegada a este aeródromo.
Aucune capture pour ce vol	No screenshots for this flight	Ninguna captura para este vuelo
Aucune carrière définie sur ton PC.	No career set up on your PC.	Ninguna carrera definida en tu PC.
Aucune carrière définie.	No career set up.	Ninguna carrera definida.
Aucune carrière définie. Crée-en une ci-dessous pour suivre ta progression.	No career set up. Create one below to track your progress.	Ninguna carrera definida. Crea una abajo para seguir tu progreso.
Aucune carrière IVAO	No IVAO career	Ninguna carrera de IVAO
Aucune donnée pour ce code — vérifie qu'il s'agit bien d'un aéroport avec station météo publiée.	No data for this code — check it's an airport with a published weather station.	Sin datos para este código — comprueba que es un aeropuerto con estación meteorológica publicada.
Aucune image récupérée (écran verrouillé ou autorisation refusée).	No image captured (screen locked or permission denied).	No se obtuvo ninguna imagen (pantalla bloqueada o permiso denegado).
Aucune note particulière.	No particular notes.	Sin notas particulares.
Aucune sauvegarde pour l'instant — la première sera faite à ta prochaine modification.	No backups yet — the first one will be made at your next change.	Aún no hay copias de seguridad — la primera se hará en tu próxima modificación.
Aucune sauvegarde valide n'a été trouvée. Le fichier abîmé a été copié dans le dossier de données (Admin → Données) : ne le supprime pas.	No valid backup was found. The damaged file was copied to the data folder (Admin → Data): don't delete it.	No se encontró ninguna copia válida. El archivo dañado se copió en la carpeta de datos (Admin → Datos): no lo borres.
Aucune version plus récente trouvée dans la Release.	No newer version found in the Release.	No se encontró ninguna versión más reciente en la Release.
Auto (d'après le nom)	Auto (from the name)	Auto (según el nombre)
Auto (d'après les mots-clés)	Auto (from keywords)	Auto (según las palabras clave)
Autonomie	Endurance	Autonomía
Autonomie totale :	Total endurance:	Autonomía total:
Autonomie utilisable (réserve {0} min déduite) :	Usable endurance ({0} min reserve deducted):	Autonomía utilizable (reserva de {0} min descontada):
Autorisation refusée : reconnecte le compte de ta chaîne.	Permission denied: reconnect your channel account.	Autorización denegada: vuelve a conectar la cuenta de tu canal.
Autoriser	Allow	Permitir
autorité de certification de confiance	trusted certificate authority	autoridad de certificación de confianza
Autre	Other	Otro
Aux instruments	Instrument	Instrumental
avant l'altitude cible	before the target altitude	antes de la altitud objetivo
Avec un taux de {0} ft/min : durée de descente	At {0} ft/min: descent time	Con una tasa de {0} ft/min: duración del descenso
Aviation légère	General aviation	Aviación ligera
Avion	Aircraft	Avión
Avion de ligne	Airliner	Avión de línea
Avion du hangar	Hangar aircraft	Avión del hangar
Avions	Aircraft	Aviones
Avions au hangar	Aircraft in the hangar	Aviones en el hangar
Avions non classés / hors hangar	Unclassified / non-hangar aircraft	Aviones sin clasificar / fuera del hangar
Aéroport	Airport	Aeropuerto
aéroport	airport	aeropuerto
Aéroport d'arrivée	Arrival airport	Aeropuerto de llegada
Aéroport de base (OACI)	Home airport (ICAO)	Aeropuerto base (OACI)
Aéroport de départ	Departure airport	Aeropuerto de salida
Aéroport inconnu : {0}.	Unknown airport: {0}.	Aeropuerto desconocido: {0}.
Aéroports	Airports	Aeropuertos
Aéroports les plus fréquentés	Most frequent airports	Aeropuertos más frecuentes
Aéroports les plus visités	Most visited airports	Aeropuertos más visitados
Aéroports visités	Airports visited	Aeropuertos visitados
Barre	Bar	Barra
Barre de notes	Grade bar	Barra de notas
Barre de temps restant	Time-left bar	Barra de tiempo restante
Base	Base	Base
Beurre	Butter	Mantequilla
Beurre, doux, ferme, dur : seuils réglables pour chaque catégorie d'avion	Butter, soft, firm, hard: adjustable thresholds for each aircraft category	Mantequilla, suave, firme, duro: umbrales ajustables para cada categoría de avión
Bi-réseau	Dual network	Doble red
Bienvenue	Welcome	Bienvenida
Bienvenue dans FlightBrief	Welcome to FlightBrief	Bienvenido a FlightBrief
Bienvenue dans FlightBrief 👋	Welcome to FlightBrief 👋	Bienvenido a FlightBrief 👋
Bienvenue sur IVAO	Welcome to IVAO	Bienvenido a IVAO
Bienvenue sur VATSIM	Welcome to VATSIM	Bienvenido a VATSIM
Bloc	Block	Bloque
Blur	Blur	Desenfoque
Bon élève de la phraséo	Phraseology star pupil	Buen alumno de fraseología
Bons baisers{0} !	Greetings{0}!	¡Recuerdos{0}!
Border	Border	Borde
Bordure	Border	Borde
Bordure de la carte	Card border	Borde de la tarjeta
Bot du chat	Chat bot	Bot del chat
Bouclé en	Completed in	Completado en
Boulanger	Baker	Panadero
Bravo	Well done	Bravo
Bravo {0}, le plus rapide ! +{1} miles	Well done {0}, fastest answer! +{1} miles	¡Bravo {0}, el más rápido! +{1} millas
Briefing	Briefing	Briefing
Briefing de vol	Flight briefing	Briefing de vuelo
Briefing de vol — OBS	Flight briefing — OBS	Briefing de vuelo — OBS
Bronze	Bronze	Bronce
C'est parti !	Let's go!	¡Vamos!
Calculateurs de vol rapides — temps/distance/vitesse, carburant & autonomie, top of descent, et une estimation IAS → TAS. Rien n'est enregistré, ce sont de simples calculatrices.	Quick flight calculators — time/distance/speed, fuel & endurance, top of descent, and an IAS → TAS estimate. Nothing is saved, these are simple calculators.	Calculadoras de vuelo rápidas — tiempo/distancia/velocidad, combustible y autonomía, top of descent y una estimación IAS → TAS. No se guarda nada, son simples calculadoras.
Calculer	Calculate	Calcular
Calé sur ton overlay "Le stream va commencer"	Matched to your "Stream starting soon" overlay	A juego con tu overlay "El stream va a empezar"
Cap	Heading	Rumbo
Cap actuel de l'avion	Aircraft's current heading	Rumbo actual del avión
Cap d'insertion (cap inbound vers le fix)	Inbound course (towards the fix)	Rumbo de entrada (inbound hacia el fijo)
Cap de piste (axe — ex : piste 27 → 270°)	Runway heading (axis — e.g. runway 27 → 270°)	Rumbo de pista (eje — p. ej. pista 27 → 270°)
Capture	Screenshot	Captura
Capture (raccourci)	Screenshot (shortcut)	Captura (atajo)
Capture auto · croisière	Auto screenshot · cruise	Captura auto · crucero
Capture auto · décollage	Auto screenshot · takeoff	Captura auto · despegue
Capture déjà en cours.	Screenshot already in progress.	Captura ya en curso.
Capture impossible	Screenshot failed	Captura imposible
Capture la fenêtre du simulateur (ou l'écran)	Captures the simulator window (or the screen)	Captura la ventana del simulador (o la pantalla)
Captures auto	Auto screenshots	Capturas auto
Captures automatiques	Automatic screenshots	Capturas automáticas
Captures automatiques activées (clic pour les couper)	Automatic screenshots on (click to turn off)	Capturas automáticas activadas (clic para desactivarlas)
Captures automatiques au décollage, en croisière et à l'atterrissage	Automatic screenshots at takeoff, in cruise and at landing	Capturas automáticas al despegar, en crucero y al aterrizar
Captures automatiques désactivées (clic pour les activer)	Automatic screenshots off (click to turn on)	Capturas automáticas desactivadas (clic para activarlas)
Captures automatiques {0}	Automatic screenshots {0}	Capturas automáticas {0}
Captures d'écran du vol	Flight screenshots	Capturas de pantalla del vuelo
Captures du vol	Flight screenshots	Capturas del vuelo
Carburant	Fuel	Combustible
Carburant nécessaire	Fuel required	Combustible necesario
Carburant nécessaire (vol + réserve) :	Fuel required (trip + reserve):	Combustible necesario (vuelo + reserva):
Carburant utilisé : {0} lbs	Fuel used: {0} lbs	Combustible usado: {0} lbs
Carburant à bord	Fuel on board	Combustible a bordo
Carnet	Logbook	Diario
Carnet de vol	Logbook	Diario de vuelo
Carnet de vol public	Public logbook	Diario de vuelo público
Carnet de vol —	Logbook —	Diario de vuelo —
Carrière	Career	Carrera
Carrière IVAO concernée	Related IVAO career	Carrera de IVAO afectada
Carrière liée	Linked career	Carrera vinculada
Carrière — Ctrl+4	Career — Ctrl+4	Carrera — Ctrl+4
Carrières	Careers	Carreras
Carte	Map	Mapa
Carte d'atterrissage	Landing card	Tarjeta de aterrizaje
Carte des vols	Flight map	Mapa de vuelos
Carte postale	Postcard	Postal
Cartes	Cards	Tarjetas
Cartes d'événement	Event cards	Tarjetas de evento
Cartes postales	Postcards	Postales
Case Appareil	Aircraft box	Casilla Aeronave
Case Approche / Repères	Approach / Waypoints box	Casilla Aproximación / Puntos
Case Durée	Duration box	Casilla Duración
Case Météo	Weather box	Casilla Meteo
Case Niveau	Level box	Casilla Nivel
Catégorie	Category	Categoría
Catégorie Twitch	Twitch category	Categoría de Twitch
Ce lien n'est plus valide	This link is no longer valid	Este enlace ya no es válido
Ce n'est pas un ID client Twitch : il fait 30 caractères (lettres minuscules et chiffres).	That's not a Twitch client ID: it is 30 characters long (lowercase letters and digits).	No es un ID de cliente de Twitch: tiene 30 caracteres (minúsculas y cifras).
Ce raccourci est déjà utilisé par une autre application.	This shortcut is already used by another application.	Este atajo ya lo usa otra aplicación.
Ce trajet ne fait partie d'aucun de tes tours.	This route isn't part of any of your tours.	Este trayecto no forma parte de ninguno de tus tours.
Ce téléphone n'est plus autorisé à synchroniser (nouveau lien généré sur le PC). Rescanne le QR code dans	This phone is no longer allowed to sync (new link generated on the PC). Rescan the QR code in	Este teléfono ya no puede sincronizar (nuevo enlace generado en el PC). Vuelve a escanear el código QR en
Ce vol ne sera ni enregistré dans le logbook ni affiché sur ton overlay.	This flight will be neither logged nor shown on your overlay.	Este vuelo no se registrará en el logbook ni se mostrará en tu overlay.
Centrer la carte sur l'avion (touche F)	Centre the map on the aircraft (F key)	Centrar el mapa en el avión (tecla F)
Centré	Centred	Centrado
Certaines étapes validées n'ont pas de vol correspondant dans le logbook.	Some completed legs have no matching flight in the logbook.	Algunas etapas validadas no tienen vuelo correspondiente en el logbook.
Certificat :	Certificate:	Certificado:
Certificat local :	Local certificate:	Certificado local:
Cette adresse est fixe tant que l'application tourne sur cette machine. Colle-la dans OBS → Source → Navigateur → URL. Elle se met à jour en direct dès que tu modifies un champ de l'onglet Briefing.	This address stays the same as long as the app runs on this machine. Paste it into OBS → Source → Browser → URL. It updates live as soon as you change a field in the Briefing tab.	Esta dirección es fija mientras la app funcione en esta máquina. Pégala en OBS → Fuente → Navegador → URL. Se actualiza en directo en cuanto cambias un campo de la pestaña Briefing.
Cette sauvegarde est illisible.	This backup is unreadable.	Esta copia de seguridad es ilegible.
Champs affichés	Displayed fields	Campos mostrados
Chaque type de carte garde sa couleur. Laisse un titre vide pour garder celui par défaut.	Each card type keeps its colour. Leave a title empty to keep the default one.	Cada tipo de tarjeta conserva su color. Deja un título vacío para mantener el predeterminado.
Chargement des coordonnées aéroports…	Loading airport coordinates…	Cargando coordenadas de aeropuertos…
Chargement…	Loading…	Cargando…
Chat Bot	Chat Bot	Chat Bot
Chaîne Twitch à rejoindre	Twitch channel to join	Canal de Twitch al que unirse
Chef pilote	Chief pilot	Jefe de pilotos
Chercher…	Search…	Buscar…
Choisi dans le logbook	Picked from the logbook	Elegido en el logbook
Choisir	Choose	Elegir
Choisis	Choose	Elige
Choisis d'abord un dossier.	Choose a folder first.	Elige primero una carpeta.
Choisis toi-même les informations affichées sur ton overlay Twitch — elles se mettent à jour en direct pendant le suivi du vol.	Choose the information shown on your Twitch overlay — it updates live while the flight is tracked.	Elige tú mismo la información de tu overlay de Twitch — se actualiza en directo durante el seguimiento del vuelo.
Choisis un dossier…	Choose a folder…	Elige una carpeta…
Clair	Light	Claro
classement des meilleurs parieurs	top bettors leaderboard	clasificación de los mejores apostantes
Classement des parieurs	Bettors leaderboard	Clasificación de apostantes
Clic : départs & arrivées · double-clic : zoom	Click: departures & arrivals · double-click: zoom	Clic: salidas y llegadas · doble clic: zoom
Clique sur « Créer », puis sur « Gérer » à côté de ton application, et copie l'	Click “Create”, then “Manage” next to your application, and copy the	Haz clic en «Crear», luego en «Administrar» junto a tu aplicación, y copia el
Clique un vol pour le voir sur la carte	Click a flight to see it on the map	Haz clic en un vuelo para verlo en el mapa
Clôture le vol maintenant (sans attendre la détection automatique du parking) et enregistre directement le PIREP complet dans le logbook, avec tous les champs du briefing.	Closes the flight now (without waiting for automatic parking detection) and logs the full PIREP straight into the logbook, with all the briefing fields.	Cierra el vuelo ahora (sin esperar la detección automática del estacionamiento) y registra directamente el PIREP completo en el logbook, con todos los campos del briefing.
Cockpit Nuit	Night Cockpit	Cabina Nocturna
Code expiré : relance la connexion.	Code expired: restart the connection.	Código caducado: vuelve a iniciar la conexión.
Code OACI	ICAO code	Código OACI
Coin de l'écran où se place l'overlay, et marge par rapport au bord. Pratique si ta source OBS couvre tout l'écran.	Screen corner where the overlay sits, and margin from the edge. Handy if your OBS source covers the whole screen.	Esquina de la pantalla donde se coloca el overlay y margen respecto al borde. Práctico si tu fuente OBS cubre toda la pantalla.
Colle cette adresse dans OBS → Source → Navigateur → URL. C'est une adresse différente de celle du briefing ci-dessus. Elle affiche automatiquement la télémétrie du vol suivi dans l'onglet Briefing.	Paste this address into OBS → Source → Browser → URL. It's a different address from the briefing one above. It automatically shows the telemetry of the flight tracked in the Briefing tab.	Pega esta dirección en OBS → Fuente → Navegador → URL. Es distinta de la del briefing de arriba. Muestra automáticamente la telemetría del vuelo seguido en la pestaña Briefing.
Collectionneur	Collector	Coleccionista
Colonnes des cases (Appareil / Niveau / Durée)	Box columns (Aircraft / Level / Duration)	Columnas de casillas (Aeronave / Nivel / Duración)
Commandant de bord	Captain	Comandante
Commandes	Commands	Comandos
Commandes du chat	Chat commands	Comandos del chat
Commandes du vol : {0} · À bord : !embarquer !miles !passeport !maville !voyage	Flight commands: {0} · On board: !board !miles !passport !mycity !trip	Comandos del vuelo: {0} · A bordo: !embarcar !millas !pasaporte !miciudad !viaje
Commence par déclarer ton application Twitch (étape 1 de l'onglet Twitch).	Start by registering your Twitch application (step 1 of the Twitch tab).	Empieza registrando tu aplicación de Twitch (paso 1 de la pestaña Twitch).
Commencé le	Started on	Empezado el
Comment le mettre en ligne (GitHub Pages)	How to put it online (GitHub Pages)	Cómo publicarlo (GitHub Pages)
Compagnie aérienne	Airline	Aerolínea
Compagnie virtuelle	Virtual airline	Aerolínea virtual
Compte de ta chaîne	Your channel account	Cuenta de tu canal
Compte qui parle dans le chat	Account that talks in chat	Cuenta que habla en el chat
Compte {0} connecté ✓	Account {0} connected ✓	Cuenta {0} conectada ✓
Configuration de l'overlay	Overlay settings	Configuración del overlay
Configurer et activer le bot Twitch.	Set up and enable the Twitch bot.	Configurar y activar el bot de Twitch.
Confirme l'installation et donne-lui un nom, par exemple « FlightBrief ».	Confirm the installation and give it a name, for example “FlightBrief”.	Confirma la instalación y dale un nombre, por ejemplo «FlightBrief».
Connecte d'abord le compte de ta chaîne (bouton ci-dessous).	Connect your channel account first (button below).	Conecta primero la cuenta de tu canal (botón de abajo).
Connecte-toi au simulateur ci-contre pour afficher la carte et la télémétrie en direct.	Connect to the simulator alongside to show the map and live telemetry.	Conéctate al simulador para mostrar el mapa y la telemetría en directo.
Connecte-toi au simulateur ci-contre pour afficher la carte, la télémétrie et le rapport de vol en direct.	Connect to the simulator alongside to show the map, telemetry and live flight report.	Conéctate al simulador para mostrar el mapa, la telemetría y el informe de vuelo en directo.
Connecter un compte	Connect an account	Conectar una cuenta
Connecté	Connected	Conectado
Connecté ({0}).	Connected ({0}).	Conectado ({0}).
Connecté au chat de #{0} en lecture — réponses sur l'overlay Alertes	Connected to #{0}'s chat read-only — replies on the Alerts overlay	Conectado al chat de #{0} en lectura — respuestas en el overlay de Alertas
Connecté au chat de #{0} en tant que {1}	Connected to #{0}'s chat as {1}	Conectado al chat de #{0} como {1}
Connecté à ton PC ✓	Connected to your PC ✓	Conectado a tu PC ✓
Connecté — en attente du décollage	Connected — waiting for takeoff	Conectado — esperando el despegue
Connexion annulée ou refusée ({0}).	Connection cancelled or refused ({0}).	Conexión cancelada o rechazada ({0}).
Connexion annulée.	Connection cancelled.	Conexión cancelada.
Connexion au chat	Chat connection	Conexión al chat
Connexion au chat…	Connecting to chat…	Conectando al chat…
Connexion en cours…	Connecting…	Conectando…
Connexion perdue — nouvel essai dans {0} s	Connection lost — retrying in {0} s	Conexión perdida — nuevo intento en {0} s
Connexion Twitch refusée (jeton expiré ?) — reconnecte le compte du bot.	Twitch connection refused (expired token?) — reconnect the bot account.	Conexión de Twitch rechazada (¿token caducado?) — vuelve a conectar la cuenta del bot.
Consommation horaire	Hourly fuel burn	Consumo horario
Control	Control	Control
Convertisseur d'unités	Unit converter	Conversor de unidades
Copie de ton logbook FlightBrief {0} · stockée uniquement sur ce téléphone	Copy of your FlightBrief logbook {0} · stored only on this phone	Copia de tu logbook de FlightBrief {0} · guardada solo en este teléfono
Copie impossible — sélectionne le champ et copie-le avec Ctrl+C / Cmd+C.	Couldn't copy — select the field and copy it with Ctrl+C / Cmd+C.	No se pudo copiar — selecciona el campo y cópialo con Ctrl+C / Cmd+C.
Copie parfaite	Perfect copy	Colación perfecta
Copier	Copy	Copiar
Copier le code	Copy code	Copiar código
Copier le lien	Copy link	Copiar enlace
Copier le texte	Copy text	Copiar texto
Copilote	First officer	Copiloto
Copilote numérique	Digital copilot	Copiloto digital
Copié ✓	Copied ✓	Copiado ✓
Correctif	Fix	Corrección
Correspondances :	Connections:	Conexiones:
correspondances en cours	ongoing connections	conexiones en curso
Coucou ! (embarque la prochaine fois pour gagner le bonus)	Hello down there! (board next time to earn the bonus)	¡Hola! (embarca la próxima vez para ganar el bonus)
Coucou en bas ! +{0} miles 🎁	Hello down there! +{0} miles 🎁	¡Hola ahí abajo! +{0} millas 🎁
Couleur de cette carte	This card's colour	Color de esta tarjeta
Couleurs	Colours	Colores
coupé	off	desactivado
Croisière	Cruise	Crucero
croisière	cruise	crucero
Croupier	Croupier	Crupier
Crée d'abord une carrière de type IVAO.	Create an IVAO career first.	Crea primero una carrera de tipo IVAO.
Créée automatiquement à chaque atterrissage avec passagers : ta capture d'atterrissage, la ville d'arrivée et la liste des passagers. Elle s'affiche aussi sur l'overlay Alertes.	Created automatically at every landing with passengers: your landing screenshot, the arrival city and the passenger list. It also shows on the Alerts overlay.	Se crea automáticamente en cada aterrizaje con pasajeros: tu captura de aterrizaje, la ciudad de llegada y la lista de pasajeros. También aparece en el overlay de Alertas.
Dans Chrome, menu	In Chrome, menu	En Chrome, menú
Dans FlightBrief sur ton PC : onglet	In FlightBrief on your PC: tab	En FlightBrief en tu PC: pestaña
Dans l'appli qui s'ouvre (dans Safari), touche	In the app that opens (in Safari), tap	En la app que se abre (en Safari), toca
Dans la zone	In the zone	En la zona
dans ton chat pour tester.	in your chat to test it.	en tu chat para probarlo.
Dans ~{0} min : chez {1}	In ~{0} min: {1}'s place	En ~{0} min: casa de {1}
Date	Date	Fecha
de droite	right	por la derecha
de gauche	left	por la izquierda
de retour chez toi pour la mettre à jour.	back home to update it.	de vuelta en casa para actualizarla.
de « {0} »	from “{0}”	de «{0}»
Delete	Delete	Supr
Depuis l'avion	From the aircraft	Desde el avión
Depuis le seuil	From the threshold	Desde el umbral
Dernier	Last	Último
dernier atterrissage : taux, G, note	last landing: rate, G, grade	último aterrizaje: tasa, G, nota
Dernier atterrissage : {0}	Last landing: {0}	Último aterrizaje: {0}
Dernier vol	Last flight	Último vuelo
Dernier vol le	Last flight on	Último vuelo el
Dernière synchro	Last sync	Última sincronización
Dernière visite	Last visit	Última visita
derrière nous	behind us	detrás de nosotros
Des calculateurs de vol rapides : temps/distance/vitesse, carburant, top of descent, entrée en hold, METAR/TAF...	Quick flight calculators: time/distance/speed, fuel, top of descent, holding entry, METAR/TAF...	Calculadoras de vuelo rápidas: tiempo/distancia/velocidad, combustible, top of descent, entrada en espera, METAR/TAF...
Descente	Descent	Descenso
Destination	Destination	Destino
Devine le taux de toucher :	Guess the touchdown rate:	Adivina la tasa de toma:
Devine le taux de toucher : !pari 180	Guess the touchdown rate: !bet 180	Adivina la tasa de toma: !apuesta 180
deviner l'heure du toucher	guess the touchdown time	adivinar la hora de la toma
Diplomate	Diplomat	Diplomático
Disposition	Layout	Disposición
Disposition de la carte	Card layout	Disposición de la tarjeta
Distance	Distance	Distancia
Distance (NM)	Distance (NM)	Distancia (NM)
Distance : {0} NM	Distance: {0} NM	Distancia: {0} NM
Distance au seuil	Distance to threshold	Distancia al umbral
Distance avant descente (règle des 3) :	Distance before descent (rule of 3):	Distancia antes del descenso (regla del 3):
Distance de survol	Flyover distance	Distancia de sobrevuelo
Distance depuis le seuil	Distance from threshold	Distancia desde el umbral
Distance directe (orthodromie) entre départ et arrivée, majorée de 5 % en IFR pour tenir compte des routes aériennes	Direct (great-circle) distance between departure and arrival, plus 5% in IFR to account for airways	Distancia directa (ortodrómica) entre salida y llegada, aumentada un 5 % en IFR para tener en cuenta las aerovías
Distance directe départ → arrivée	Direct distance departure → arrival	Distancia directa salida → llegada
Distance du tour	Tour distance	Distancia del tour
Distance mesurée par le tracker (non modifiable).	Distance measured by the tracker (read-only).	Distancia medida por el seguimiento (no modificable).
Distance moyenne / vol	Average distance / flight	Distancia media / vuelo
Distance parcourue	Distance flown	Distancia recorrida
Distance parcourue :	Distance flown:	Distancia recorrida:
Distance seuil	Threshold distance	Distancia umbral
Distance totale	Total distance	Distancia total
Données	Data	Datos
Données publiques de VATSIM et d'IVAO, actualisées toutes les 45 s quand cet onglet est ouvert. Choisis les réseaux avec les boutons en haut à gauche de la carte : secteurs des centres, cercles d'approche et badges d'aéroport (i ATIS · D sol-prévol · G sol · T tour · A approche). Clique sur un secteur ou un aéroport pour le détail.	Public VATSIM and IVAO data, refreshed every 45 s while this tab is open. Pick networks with the buttons at the top left of the map: centre sectors, approach circles and airport badges (i ATIS · D delivery · G ground · T tower · A approach). Click a sector or airport for details.	Datos públicos de VATSIM e IVAO, actualizados cada 45 s con esta pestaña abierta. Elige las redes con los botones arriba a la izquierda del mapa: sectores de centro, círculos de aproximación e insignias de aeropuerto (i ATIS · D autorizaciones · G rodadura · T torre · A aproximación). Haz clic en un sector o aeropuerto para ver el detalle.
Données à jour (aviationweather.gov / NOAA).	Up-to-date data (aviationweather.gov / NOAA).	Datos actualizados (aviationweather.gov / NOAA).
dont vol : {0} · réserve ({1} min) : {2}	of which trip: {0} · reserve ({1} min): {2}	de ellos vuelo: {0} · reserva ({1} min): {2}
Dossier	Folder	Carpeta
Dossier d'export	Export folder	Carpeta de exportación
Dossier du carnet de vol public	Public logbook folder	Carpeta del diario de vuelo público
Doux	Soft	Suave
Down	Down	Abajo
droit devant	straight ahead	justo delante
Droite	Right	Derecha
Droite (standard)	Right (standard)	Derecha (estándar)
du dossier généré (pas le dossier lui-même), puis « Commit ».	of the generated folder (not the folder itself), then “Commit”.	de la carpeta generada (no la carpeta en sí) y luego «Commit».
Dur	Hard	Duro
Durée	Duration	Duración
Durée (hh:mm)	Duration (hh:mm)	Duración (hh:mm)
Durée d'affichage	Display time	Duración en pantalla
Durée de vol prévue (hh:mm)	Planned flight time (hh:mm)	Duración de vuelo prevista (hh:mm)
Durée est.	Est. time	Duración est.
Durée estimée	Estimated time	Duración estimada
Durée estimée :	Estimated time:	Duración estimada:
Durée moy.	Avg. time	Duración media
Durée moyenne	Average duration	Duración media
Durée pour le boucler	Time to complete it	Tiempo para completarlo
Débloqué le {0}	Unlocked on {0}	Desbloqueado el {0}
Débloqués	Unlocked	Desbloqueados
Début de descente	Top of descent	Inicio del descenso
Début de descente (TOD)	Top of descent (TOD)	Inicio del descenso (TOD)
début de la descente	top of descent	inicio del descenso
décembre	December	diciembre
Déclare d'abord ton application Twitch ci-dessus pour pouvoir connecter un compte.	Register your Twitch application above first to be able to connect an account.	Registra primero tu aplicación de Twitch arriba para poder conectar una cuenta.
Décollage	Takeoff	Despegue
décollage	takeoff	despegue
Décollage, croisière et atterrissage, selon tes réglages.	Takeoff, cruise and landing, depending on your settings.	Despegue, crucero y aterrizaje, según tus ajustes.
Déconnecter	Disconnect	Desconectar
Déconnecté	Disconnected	Desconectado
Délai anti-spam par commande	Anti-spam delay per command	Retardo antispam por comando
Départ	Departure	Salida
Départ (OACI)	Departure (ICAO)	Salida (OACI)
départ, arrivée et route du plan de vol	flight plan departure, arrival and route	salida, llegada y ruta del plan de vuelo
Départ: {0}	Departure: {0}	Salida: {0}
Départs	Departures	Salidas
Désactiver	Disable	Desactivar
Désactivé	Disabled	Desactivado
Désactivé — ton logbook n'est visible que sur ce PC.	Disabled — your logbook is only visible on this PC.	Desactivado — tu logbook solo es visible en este PC.
désactivées	off	desactivadas
Détails	Details	Detalles
Détails ›	Details ›	Detalles ›
Effacer sa ville	Remove their city	Borrar su ciudad
Embarquement	Boarding	Embarque
Embarquement ouvert	Boarding open	Embarque abierto
Embarquement ouvert{0}	Boarding open{0}	Embarque abierto{0}
En attente	Waiting	En espera
En attente : active le bot dans l'onglet Twitch	Waiting: enable the bot in the Twitch tab	En espera: activa el bot en la pestaña Twitch
En attente de données…	Waiting for data…	Esperando datos…
En attente de la position de l'avion…	Waiting for the aircraft position…	Esperando la posición del avión…
En attente du départ	Waiting for departure	Esperando la salida
En bas au centre	Bottom centre	Abajo al centro
En bas à droite	Bottom right	Abajo a la derecha
En bas à gauche	Bottom left	Abajo a la izquierda
en cours · réponds avec	in progress · answer with	en curso · responde con
En cours — {0}/{1} étapes	In progress — {0}/{1} legs	En curso — {0}/{1} etapas
En cours — {0}/{1} étapes validées	In progress — {0}/{1} legs completed	En curso — {0}/{1} etapas validadas
En croisière	Cruising	En crucero
En descente	Descending	En descenso
En direct	Live	En directo
En haut au centre	Top centre	Arriba al centro
En haut à droite	Top right	Arriba a la derecha
en haut à droite pour créer ta première fiche.	at the top right to create your first entry.	arriba a la derecha para crear tu primera ficha.
En haut à gauche	Top left	Arriba a la izquierda
en ligne	online	en línea
En l’air	Airborne	En el aire
en une minute.	in one minute.	en un minuto.
En vol	In flight	En vuelo
En vol{0}	In flight{0}	En vuelo{0}
Encore {0} miles pour {1} {2}.	{0} more miles to {1} {2}.	Faltan {0} millas para {1} {2}.
Enregistrer	Save	Guardar
Enregistrer ce vol dans le logbook	Save this flight to the logbook	Guardar este vuelo en el logbook
Enregistrer l'avion	Save aircraft	Guardar avión
Enregistrer la carrière	Save career	Guardar carrera
Enregistrer le profil	Save profile	Guardar perfil
Enregistrer le vol	Save flight	Guardar vuelo
Enregistrer les modifications	Save changes	Guardar cambios
Enregistrer un premier vol.	Log a first flight.	Registrar un primer vuelo.
Ensuite, l'icône s'ouvre partout, sans PC ni Wi-Fi. Touche	After that, the icon opens anywhere, without PC or Wi-Fi. Tap	Después, el icono se abre en cualquier sitio, sin PC ni Wi-Fi. Toca
Entrée directe	Direct entry	Entrada directa
Entrée en hold (attente)	Holding entry	Entrada en espera
Entrée en teardrop	Teardrop entry	Entrada en lágrima
Entrée parallèle	Parallel entry	Entrada paralela
Envoie le PIREP depuis FlightBrief sur ton PC : le vol rejoindra ton logbook à la prochaine synchro.	File the PIREP from FlightBrief on your PC: the flight will join your logbook at the next sync.	Envía el PIREP desde FlightBrief en tu PC: el vuelo se añadirá a tu logbook en la próxima sincronización.
Envoyer le PIREP dans le logbook	File the PIREP to the logbook	Enviar el PIREP al logbook
Erreur :	Error:	Error:
Erreur chat :	Chat error:	Error del chat:
Erreur de connexion	Connection error	Error de conexión
Erreur inconnue du serveur de l'overlay live.	Unknown live overlay server error.	Error desconocido del servidor del overlay en directo.
Erreur inconnue du serveur mobile.	Unknown mobile server error.	Error desconocido del servidor móvil.
Erreur inconnue du serveur OBS.	Unknown OBS server error.	Error desconocido del servidor OBS.
Erreur SimConnect{0} (code {1}). Le tracking peut ne plus recevoir de données.	SimConnect error{0} (code {1}). Tracking may stop receiving data.	Error de SimConnect{0} (código {1}). Es posible que el seguimiento deje de recibir datos.
Espacement entre les champs	Spacing between fields	Espaciado entre campos
est sorti 🎉	is out 🎉	ya está disponible 🎉
Estimation : {0} NM en direct{1}. Tu peux corriger la valeur.	Estimate: {0} NM direct{1}. You can correct the value.	Estimación: {0} NM en directo{1}. Puedes corregir el valor.
Estimation ISA rapide (≈ +2 % de TAS par 1000 ft) — pratique pour une planification, pas pour la navigation réelle.	Quick ISA estimate (≈ +2% TAS per 1,000 ft) — handy for planning, not for real-world navigation.	Estimación ISA rápida (≈ +2 % de TAS por cada 1000 ft) — práctica para planificar, no para la navegación real.
Estimer	Estimate	Estimar
et !arrivee	and !arrival	y !llegada
et active	and enable	y activa
et gagnent 1 mile par NM parcouru tant qu'ils sont actifs dans le chat (20 min après leur dernier message).	and earn 1 mile per NM flown while they're active in chat (20 min after their last message).	y ganan 1 milla por NM recorrida mientras estén activos en el chat (20 min tras su último mensaje).
et saisis ce code :	and enter this code:	e introduce este código:
et {0} autres	and {0} others	y {0} más
et {0} autres…	and {0} others…	y {0} más…
ETA LFBO : 21:47 (dans 38 min) · 212 NM restants	ETA LFBO: 21:47 (in 38 min) · 212 NM to go	ETA LFBO: 21:47 (en 38 min) · 212 NM restantes
ETA LFBO : 21:47 (dans 38 min) · 212 NM restants · début de descente dans 12 min	ETA LFBO: 21:47 (in 38 min) · 212 NM to go · top of descent in 12 min	ETA LFBO: 21:47 (en 38 min) · 212 NM restantes · inicio del descenso en 12 min
ETA {0} : {1} (dans {2})	ETA {0}: {1} (in {2})	ETA {0}: {1} (en {2})
Europe	Europe	Europa
Evogria (police perso)	Evogria (custom font)	Evogria (fuente personalizada)
ex : 123456	e.g. 123456	p. ej. 123456
ex : 1234567	e.g. 1234567	p. ej. 1234567
ex : 160	e.g. 160	p. ej. 160
ex : 1h05	e.g. 1h05	p. ej. 1h05
ex : 32	e.g. 32	p. ej. 32
ex : A20N	e.g. A20N	p. ej. A20N
ex : A320neo	e.g. A320neo	p. ej. A320neo
ex : abcd1234efgh5678ijkl9012mnop34	e.g. abcd1234efgh5678ijkl9012mnop34	p. ej. abcd1234efgh5678ijkl9012mnop34
ex : AFR23F ou F-HBAA	e.g. BAW23 or G-EUPT	p. ej. IBE23 o EC-MXV
ex : Air France Virtual	e.g. British Airways Virtual	p. ej. Iberia Virtual
ex : Alex	e.g. Alex	p. ej. Alex
ex : Fenix A320, A320neo, F-HBNA	e.g. Fenix A320, A320neo, G-EUYA	p. ej. Fenix A320, A320neo, EC-NFJ
ex : Fenix, iniBuilds, PMDG…	e.g. Fenix, iniBuilds, PMDG…	p. ej. Fenix, iniBuilds, PMDG…
ex : FL350	e.g. FL350	p. ej. FL350
ex : ILS RWY 32L	e.g. ILS RWY 32L	p. ej. ILS RWY 32L
ex : jdupont	e.g. jsmith	p. ej. jgarcia
ex : LFPG	e.g. EGLL	p. ej. LEMD
ex : LFPG BANOX UZ29 TOU LFBO	e.g. LFPG BANOX UZ29 TOU LFBO	p. ej. LFPG BANOX UZ29 TOU LFBO
ex : LLCenLive	e.g. LLCenLive	p. ej. LLCenLive
ex : llcenlive	e.g. llcenlive	p. ej. llcenlive
ex : SID BANOX 4A, piste 27R, transpondeur assigné	e.g. SID BANOX 4A, runway 27R, assigned squawk	p. ej. SID BANOX 4A, pista 27R, transpondedor asignado
ex : suivre la N7, seuil piste 27	e.g. follow the motorway, runway 27 threshold	p. ej. seguir la autovía, umbral pista 27
ex : tonpseudo	e.g. yourname	p. ej. tuusuario
ex : Tour d'Europe 2026	e.g. Europe Tour 2026	p. ej. Tour de Europa 2026
ex : turbulences en approche	e.g. turbulence on approach	p. ej. turbulencias en la aproximación
Exemples : Ctrl+Alt+S, Maj+F10, F9, Impr. écran.	Examples: Ctrl+Alt+S, Shift+F10, F9, Print Screen.	Ejemplos: Ctrl+Alt+S, Mayús+F10, F9, Impr Pant.
Explorateur	Explorer	Explorador
Exploration	Exploration	Exploración
Facteur de charge	Load factor	Factor de carga
Facteur de charge : {0} G	Load factor: {0} G	Factor de carga: {0} G
Facteur G	G-force	Factor G
Faites vos jeux	Place your bets	Hagan sus apuestas
Fenêtre du simulateur	Simulator window	Ventana del simulador
Fenêtre du simulateur (sinon écran principal)	Simulator window (otherwise main screen)	Ventana del simulador (si no, pantalla principal)
Ferme	Firm	Firme
Fermer	Close	Cerrar
Fermer automatiquement en courte finale	Close automatically on short final	Cerrar automáticamente en final corta
Fermer les portes	Close the doors	Cerrar puertas
Fermeture sous (hauteur sol)	Close below (height above ground)	Cierre por debajo de (altura sobre el suelo)
Fermé	Closed	Cerrado
Fichier de données illisible	Unreadable data file	Archivo de datos ilegible
fichier lu mais aucun aéroport reconnu (format inattendu)	file read but no airport recognised (unexpected format)	archivo leído pero ningún aeropuerto reconocido (formato inesperado)
Fidèles	Regulars	Fieles
Filtrer : LFFF, EGLL, CTR, APP, IVAO…	Filter: LFFF, EGLL, CTR, APP, IVAO…	Filtrar: LFFF, EGLL, CTR, APP, IVAO…
Filtrer par indicatif ou appareil	Filter by callsign or aircraft	Filtrar por indicativo o aeronave
Finale	Final	Final
FlightBrief (usage local uniquement)	FlightBrief (local use only)	FlightBrief (solo uso local)
FlightBrief a repris automatiquement la sauvegarde du {0}. Le fichier abîmé a été mis de côté dans le dossier de données.	FlightBrief automatically restored the backup from {0}. The damaged file was set aside in the data folder.	FlightBrief ha recuperado automáticamente la copia del {0}. El archivo dañado se ha apartado en la carpeta de datos.
FlightBrief local - {0} ({1})	FlightBrief local - {0} ({1})	FlightBrief local - {0} ({1})
FlightBrief sur ton téléphone	FlightBrief on your phone	FlightBrief en tu teléfono
FlightBrief — le tracker ne tourne pas	FlightBrief — the tracker isn't running	FlightBrief — el seguimiento no está activo
FlightBrief — overlay live en attente de configuration…	FlightBrief — live overlay waiting for setup…	FlightBrief — overlay en directo esperando configuración…
FlightBrief — À bord	FlightBrief — On board	FlightBrief — A bordo
FlightBrief: lecture du fichier local impossible, valeurs par défaut utilisées.	FlightBrief: couldn't read the local file, using default values.	FlightBrief: no se pudo leer el archivo local, se usan los valores por defecto.
FlightBrief: sauvegarde locale impossible.	FlightBrief: couldn't save locally.	FlightBrief: no se pudo guardar localmente.
Flou d'arrière-plan	Background blur	Desenfoque de fondo
Flou d'arrière-plan (verre dépoli)	Background blur (frosted glass)	Desenfoque de fondo (vidrio esmerilado)
FL{0} ({1} ft)	FL{0} ({1} ft)	FL{0} ({1} ft)
Flèche	Arrow	Flecha
Fond	Background	Fondo
Fond (dégradé)	Background (gradient)	Fondo (degradado)
Fond en dégradé	Gradient background	Fondo degradado
Fond transparent (texte flottant)	Transparent background (floating text)	Fondo transparente (texto flotante)
Fondu	Fade	Fundido
France	France	Francia
Fréquence radio	Radio frequency	Frecuencia de radio
ft (	ft (	ft (
ft à	ft	ft a la
février	February	febrero
Gauche	Left	Izquierda
Gauche (standard)	Left (standard)	Izquierda (estándar)
Glisse les lignes par la poignée ⠿ pour changer l'ordre des blocs sur l'overlay.	Drag rows by the ⠿ handle to reorder the blocks on the overlay.	Arrastra las filas por el asa ⠿ para cambiar el orden de los bloques en el overlay.
Glissement latéral	Side slide	Deslizamiento lateral
Glisser pour déplacer	Drag to move	Arrastrar para mover
Grade maximum atteint	Highest rank reached	Rango máximo alcanzado
Grand voyageur	Frequent flyer	Gran viajero
Gros porteur	Widebody	Fuselaje ancho
Gros porteurs	Widebodies	Fuselaje ancho
Générer le site	Generate site	Generar el sitio
Générer un nouveau lien ? Les téléphones déjà configurés ne pourront plus synchroniser tant qu'ils n'auront pas rescanné le QR code (leurs données restent consultables).	Generate a new link? Phones already set up won't be able to sync until they rescan the QR code (their data stays viewable).	¿Generar un nuevo enlace? Los teléfonos ya configurados no podrán sincronizar hasta volver a escanear el código QR (sus datos siguen disponibles).
Généré	Generated	Generado
Généré par FlightBrief	Generated by FlightBrief	Generado por FlightBrief
Habitué	Regular	Habitual
Habitué d'IVAO	IVAO regular	Habitual de IVAO
Habitué de VATSIM	VATSIM regular	Habitual de VATSIM
Halo lumineux sur les accents	Glow on accents	Halo luminoso en los acentos
Hangar	Hangar	Hangar
Hangar & carrière	Hangar & career	Hangar y carrera
Hangar garni	Well-stocked hangar	Hangar bien surtido
Hauteur	Height	Altura
Hauteur (px)	Height (px)	Altura (px)
Hauteur à 0 = automatique selon le contenu affiché. Sinon, le contenu qui dépasse est masqué (utile pour caler exactement la source OBS).	Height 0 = automatic based on displayed content. Otherwise, overflowing content is hidden (useful to fit the OBS source exactly).	Altura 0 = automática según el contenido. Si no, el contenido que sobresale se oculta (útil para ajustar exactamente la fuente OBS).
Heavy	Heavy	Heavy
Heure d'arrivée	Arrival time	Hora de llegada
Heure d'arrivée (ETA)	Arrival time (ETA)	Hora de llegada (ETA)
heure d'arrivée, distance restante, début de descente	arrival time, remaining distance, top of descent	hora de llegada, distancia restante, inicio del descenso
Heures	Hours	Horas
Heures de vol	Flight hours	Horas de vuelo
Heures sur ces avions	Hours on these aircraft	Horas en estos aviones
Heures totales	Total hours	Horas totales
Historique	History	Historial
Historique de tous tes vols, réseau par réseau, avec le lien vers ta progression de carrière.	History of all your flights, network by network, linked to your career progression.	Historial de todos tus vuelos, red por red, con el enlace a tu progreso de carrera.
Home	Home	Inicio
Hors ligne	Offline	Sin conexión
Hors ligne : les données restent consultables. Synchronise depuis le même Wi-Fi que ton PC, avec FlightBrief ouvert.	Offline: data stays viewable. Sync from the same Wi-Fi as your PC, with FlightBrief open.	Sin conexión: los datos siguen disponibles. Sincroniza desde el mismo Wi-Fi que tu PC, con FlightBrief abierto.
hors ligne ?	offline?	¿sin conexión?
Hors ligne — données du PC synchronisées	Offline — PC data synced	Sin conexión — datos del PC sincronizados
ici :	here:	aquí:
Icônes	Icons	Iconos
ID client	Client ID	ID de cliente
ID client refusé.	Client ID rejected.	ID de cliente rechazado.
Identité	Identity	Identidad
Ignorer 30 min	Ignore for 30 min	Ignorar 30 min
Ignorer ce vol	Ignore this flight	Ignorar este vuelo
Ignorer cette version	Skip this version	Omitir esta versión
Il fonctionne partout, même quand le simulateur est au premier plan.	It works everywhere, even when the simulator is in the foreground.	Funciona en todas partes, incluso con el simulador en primer plano.
Il permet au téléphone d'échanger en toute sécurité avec FlightBrief sur ton PC. Il est limité à FlightBrief sur ton réseau local et ne sert à rien d'autre.	It lets the phone talk securely with FlightBrief on your PC. It's limited to FlightBrief on your local network and is used for nothing else.	Permite que el teléfono se comunique de forma segura con FlightBrief en tu PC. Se limita a FlightBrief en tu red local y no sirve para nada más.
il y a {0} h	{0} h ago	hace {0} h
il y a {0} min	{0} min ago	hace {0} min
Images	Images	Imágenes
Import SimBrief	SimBrief import	Importar de SimBrief
Importer le dernier plan de vol	Import the latest flight plan	Importar el último plan de vuelo
Impossible de récupérer l'OFP ({0}).	Couldn't fetch the OFP ({0}).	No se pudo obtener el OFP ({0}).
Inactif depuis plus de 20 min : ne gagne plus de miles	Inactive for more than 20 min: no longer earning miles	Inactivo desde hace más de 20 min: ya no gana millas
Inclinaison max	Max bank	Inclinación máx.
Indicatif	Callsign	Indicativo
Indicatif / N° de vol	Callsign / Flight no.	Indicativo / N.º de vuelo
Indicatif, OACI, appareil…	Callsign, ICAO, aircraft…	Indicativo, OACI, aeronave…
Indique au moins un nom pour cet avion.	Enter at least a name for this aircraft.	Indica al menos un nombre para este avión.
Indique la chaîne Twitch à rejoindre.	Enter the Twitch channel to join.	Indica el canal de Twitch al que unirse.
Indique ta chaîne Twitch pour démarrer	Enter your Twitch channel to start	Indica tu canal de Twitch para empezar
Indique ton pseudo SimBrief dans la section « Import SimBrief ».	Enter your SimBrief username in the “SimBrief import” section.	Indica tu usuario de SimBrief en la sección «Importar de SimBrief».
Indique ton pseudo SimBrief.	Enter your SimBrief username.	Indica tu usuario de SimBrief.
Indique un code OACI à 4 caractères (ex : LFPG).	Enter a 4-character ICAO code (e.g. EGLL).	Indica un código OACI de 4 caracteres (p. ej. LEMD).
Indique un nom pour cette carrière.	Enter a name for this career.	Indica un nombre para esta carrera.
injoignable :	unreachable:	inaccesible:
Insert	Insert	Insert
Installe ce certificat comme	Install this certificate as	Instala este certificado como
Installer	Install	Instalar
Installer FlightBrief sur ce téléphone	Install FlightBrief on this phone	Instalar FlightBrief en este teléfono
Installer l'application	Install the app	Instalar la aplicación
Installer le certificat de ton PC	Install your PC's certificate	Instalar el certificado de tu PC
Institution	Institution	Institución
Instructeur	Instructor	Instructor
Inter	Inter	Inter
Intercontinental	Intercontinental	Intercontinental
Invalide les liens déjà installés sur tes appareils	Invalidates links already installed on your devices	Invalida los enlaces ya instalados en tus dispositivos
Journée chargée	Busy day	Día ajetreado
Jumbo	Jumbo	Jumbo
Jumbo — très gros porteurs (747, A380)	Jumbo — very large widebodies (747, A380)	Jumbo — aviones muy grandes (747, A380)
juste sous nos ailes	right beneath our wings	justo bajo nuestras alas
kt sol	kt ground	kt suelo
L'embarquement s'ouvre tout seul quand tu lances le tracker. Les viewers tapent	Boarding opens by itself when you start the tracker. Viewers type	El embarque se abre solo al iniciar el seguimiento. Los viewers escriben
L'Hexagone par cœur	France by heart	Francia de memoria
L'historique de tous tes vols, avec les statistiques et le détail de chaque trajet tracké.	The history of all your flights, with statistics and the details of each tracked route.	El historial de todos tus vuelos, con estadísticas y el detalle de cada trayecto con seguimiento.
l'index des aéroports (renderer/data/airports.json) n'a pas pu être chargé{0}.	the airport index (renderer/data/airports.json) couldn't be loaded{0}.	no se pudo cargar el índice de aeropuertos (renderer/data/airports.json){0}.
L'équivalent d'un tour de la Terre (21 600 NM).	The equivalent of a trip around the Earth (21,600 NM).	El equivalente a una vuelta a la Tierra (21 600 NM).
la campagne	countryside	el campo
La carte OBS de ton briefing, et un overlay Twitch entièrement personnalisable pour afficher ta télémétrie en direct.	Your briefing's OBS card, and a fully customisable Twitch overlay to show your live telemetry.	La tarjeta OBS de tu briefing y un overlay de Twitch totalmente personalizable para mostrar tu telemetría en directo.
La distance	The distance	La distancia
La durée	The duration	La duración
la mer	sea	el mar
La page qui s'ouvre te guide pour	The page that opens guides you to	La página que se abre te guía para
La vitesse sol	The ground speed	La velocidad respecto al suelo
Laisser vide pour ne rien afficher	Leave empty to show nothing	Dejar vacío para no mostrar nada
Lance FlightBrief depuis l'icône : la première synchro se fait toute seule.	Launch FlightBrief from the icon: the first sync happens on its own.	Abre FlightBrief desde el icono: la primera sincronización se hace sola.
Lance le tracker (ou « Ouvrir l'embarquement ») pour démarrer un vol avec le chat.	Start the tracker (or “Open boarding”) to begin a flight with chat.	Inicia el seguimiento (o «Abrir embarque») para empezar un vuelo con el chat.
Lancer le tracker	Start tracker	Iniciar seguimiento
Lancer le tracker automatiquement à la place	Start the tracker automatically instead	Iniciar el seguimiento automáticamente en su lugar
Lancer le vol & le tracker	Start flight & tracker	Iniciar vuelo y seguimiento
Largeur	Width	Ancho
Largeur (px)	Width (px)	Ancho (px)
Le bot répond dans le chat avec ce compte{0}.	The bot replies in chat with this account{0}.	El bot responde en el chat con esta cuenta{0}.
Le chat monte à bord de tes vols : miles, passeport tamponné à chaque arrivée, correspondances, cartes postales, et de quoi animer la croisière (survols de chez les viewers, vue du hublot, quiz). Fonctionne avec le bot de l'onglet Twitch.	Chat boards your flights: miles, a passport stamped at every arrival, connections, postcards, and things to liven up the cruise (flying over viewers' homes, window view, quiz). Works with the bot from the Twitch tab.	El chat sube a bordo de tus vuelos: millas, pasaporte sellado en cada llegada, conexiones, postales y entretenimiento para el crucero (sobrevuelos de casas de viewers, vista desde la ventanilla, quiz). Funciona con el bot de la pestaña Twitch.
le compte de ta chaîne	your channel account	la cuenta de tu canal
Le manifeste des passagers, en direct (transparent quand aucun vol n'est en cours). Les annonces (survols, hublot, quiz, carte postale) passent par l'overlay Alertes de l'onglet Twitch. Options d'URL :	The live passenger manifest (transparent when no flight is in progress). Announcements (flyovers, window, quiz, postcard) go through the Alerts overlay in the Twitch tab. URL options:	El manifiesto de pasajeros en directo (transparente cuando no hay vuelo en curso). Los anuncios (sobrevuelos, ventanilla, quiz, postal) pasan por el overlay de Alertas de la pestaña Twitch. Opciones de URL:
Le nom doit être unique sur tout Twitch : garde ton pseudo dedans. « Public » est indispensable, c'est ce qui permet la connexion par code sans mot de passe.	The name must be unique across Twitch: keep your username in it. “Public” is required — it's what allows code-based login without a password.	El nombre debe ser único en todo Twitch: incluye tu usuario. «Público» es imprescindible: es lo que permite conectarse con un código sin contraseña.
Le port {0} est déjà utilisé (une autre instance de FlightBrief tourne peut-être déjà) — la source OBS du briefing est indisponible.	Port {0} is already in use (another FlightBrief instance may already be running) — the briefing OBS source is unavailable.	El puerto {0} ya está en uso (puede que ya haya otra instancia de FlightBrief) — la fuente OBS del briefing no está disponible.
Le port {0} est déjà utilisé — l'overlay live est indisponible.	Port {0} is already in use — the live overlay is unavailable.	El puerto {0} ya está en uso — el overlay en directo no está disponible.
Le port {0} est déjà utilisé — le compagnon mobile est indisponible.	Port {0} is already in use — the mobile companion is unavailable.	El puerto {0} ya está en uso — la app móvil no está disponible.
Le premier grade doit commencer à 0 heure. Les heures totales sont calculées automatiquement à partir des vols du logbook liés à cette carrière.	The first rank must start at 0 hours. Total hours are calculated automatically from the logbook flights linked to this career.	El primer rango debe empezar en 0 horas. Las horas totales se calculan automáticamente a partir de los vuelos del logbook vinculados a esta carrera.
Le rendu OBS du briefing de vol, et un overlay Twitch personnalisable qui affiche ta télémétrie en direct pendant le suivi du vol (onglet Briefing).	The OBS output of the flight briefing, and a customisable Twitch overlay that shows your live telemetry while the flight is tracked (Briefing tab).	La salida OBS del briefing de vuelo y un overlay de Twitch personalizable que muestra tu telemetría en directo durante el seguimiento (pestaña Briefing).
Le suivi en direct lit ton simulateur sur ton PC : ce téléphone doit être sur le	Live tracking reads your simulator on your PC: this phone must be on the	El seguimiento en directo lee tu simulador en tu PC: este teléfono debe estar en el
Le titre est vide.	The title is empty.	El título está vacío.
le {0} à {1}	on {0} at {1}	el {0} a las {1}
Lecture seule	Read-only	Solo lectura
Left	Left	Izquierda
Les 6 continents habités.	All 6 inhabited continents.	Los 6 continentes habitados.
Les captures prises pendant un vol suivi sont rattachées automatiquement à son PIREP (Logbook → 📷).	Screenshots taken during a tracked flight are attached automatically to its PIREP (Logbook → 📷).	Las capturas hechas durante un vuelo con seguimiento se adjuntan automáticamente a su PIREP (Logbook → 📷).
Les passagers apparaîtront ici après leur premier !embarquer.	Passengers will appear here after their first !board.	Los pasajeros aparecerán aquí tras su primer !embarcar.
Les pronostics du chat (	Chat predictions (	Los pronósticos del chat (
Les vols du logbook dont le champ « Appareil » (ou le nom de l'avion détecté dans le simulateur) contient l'un de ces mots sont rattachés automatiquement à cet avion. Le nom et le code OACI comptent aussi comme mots-clés.	Logbook flights whose “Aircraft” field (or the aircraft name detected in the simulator) contains one of these words are linked automatically to this aircraft. The name and ICAO code also count as keywords.	Los vuelos del logbook cuyo campo «Aeronave» (o el nombre del avión detectado en el simulador) contiene una de estas palabras se vinculan automáticamente a este avión. El nombre y el código OACI también cuentan como palabras clave.
Libellés personnalisés	Custom labels	Etiquetas personalizadas
Libre	Free	Libre
Lien	Link	Enlace
Lien copié ✓	Link copied ✓	Enlace copiado ✓
Lien copié ✓ — envoie-le sur ton téléphone ou scanne le QR code.	Link copied ✓ — send it to your phone or scan the QR code.	Enlace copiado ✓ — envíalo a tu teléfono o escanea el código QR.
Lien copié ✓ — OBS → Source → Navigateur → URL, 1920 × 1080.	Link copied ✓ — OBS → Source → Browser → URL, 1920 × 1080.	Enlace copiado ✓ — OBS → Fuente → Navegador → URL, 1920 × 1080.
Lien incomplet ou expiré. Rescanne le QR code affiché dans FlightBrief sur ton PC (Admin → Application mobile).	Incomplete or expired link. Rescan the QR code shown in FlightBrief on your PC (Admin → Mobile app).	Enlace incompleto o caducado. Vuelve a escanear el código QR que muestra FlightBrief en tu PC (Admin → Aplicación móvil).
Lien pour OBS	Link for OBS	Enlace para OBS
Lien refusé par le PC : rescanne le QR code.	Link rejected by the PC: rescan the QR code.	Enlace rechazado por el PC: vuelve a escanear el código QR.
Light	Light	Ligero
Light — monomoteurs, légers (C172, DA40, TBM…)	Light — single-engine, light aircraft (C172, DA40, TBM…)	Ligero — monomotores, ligeros (C172, DA40, TBM…)
Liseré coloré à gauche	Coloured left edge	Borde de color a la izquierda
liste des commandes actives	list of active commands	lista de comandos activos
Logbook	Logbook	Logbook
Légende	Legend	Leyenda
Légende ATC	ATC legend	Leyenda ATC
Légende de l'air	Sky legend	Leyenda del aire
Maintenant	Now	Ahora
Maj	Shift	Mayús
Manuel	Manual	Manual
Masqué du site public	Hidden from the public site	Oculto en el sitio público
Max	Max	Máx.
Me proposer un titre au lancement du vol	Suggest a title when the flight starts	Proponerme un título al iniciar el vuelo
Medium	Medium	Mediano
Medium — régionaux, moyen-courriers (ATR, A320, 737…)	Medium — regional, short/medium-haul (ATR, A320, 737…)	Mediano — regionales, medio radio (ATR, A320, 737…)
Meilleur toucher	Best touchdown	Mejor toma
Membre	Member	Miembro
Mes vols dans le monde	My flights around the world	Mis vuelos por el mundo
Mettre à jour maintenant	Update now	Actualizar ahora
Mettre à jour sur Twitch	Update on Twitch	Actualizar en Twitch
Miles	Miles	Millas
miles ce vol	miles this flight	millas este vuelo
miles, statut, classement	miles, status, ranking	millas, estatus, clasificación
Minimal	Minimal	Mínimo
Mise en page & animation	Layout & animation	Diseño y animación
Mise à jour automatique impossible ({0}). Utilise le bouton « Télécharger depuis la page officielle » ci-dessous.	Automatic update failed ({0}). Use the “Download from the official page” button below.	No se pudo actualizar automáticamente ({0}). Usa el botón «Descargar desde la página oficial» de abajo.
Mise à jour automatique indisponible en mode développement (npm start).	Automatic update unavailable in development mode (npm start).	Actualización automática no disponible en modo desarrollo (npm start).
Mise à jour disponible	Update available	Actualización disponible
Mise à jour installée	Update installed	Actualización instalada
Mode	Mode	Modo
Mode libre : déplace chaque bloc sur l'écran à droite, comme dans ta scène OBS (1920 × 1080).	Free mode: move each block on the screen on the right, like in your OBS scene (1920 × 1080).	Modo libre: mueve cada bloque en la pantalla de la derecha, como en tu escena de OBS (1920 × 1080).
Modifie n'importe quel champ (valeur ou unité) : l'autre se met à jour automatiquement.	Change any field (value or unit): the other updates automatically.	Cambia cualquier campo (valor o unidad): el otro se actualiza automáticamente.
Modifier	Edit	Editar
Modifier l'avion	Edit aircraft	Editar avión
Modifier la carrière	Edit career	Editar carrera
Modifier le tour	Edit tour	Editar tour
Modifier le vol	Edit flight	Editar vuelo
Modèle	Template	Plantilla
Monomoteurs & légers	Single-engine & light	Monomotores y ligeros
Montagnard	Mountaineer	Montañero
Monte à bord :	Come aboard:	Sube a bordo:
Monter au FL400 ou plus (vol suivi).	Climb to FL400 or higher (tracked flight).	Subir a FL400 o más (vuelo con seguimiento).
monter à bord du vol	board the flight	subir a bordo del vuelo
Montée	Climb	Ascenso
montée	climb	ascenso
Montée initiale	Initial climb	Ascenso inicial
montée initiale	initial climb	ascenso inicial
Mots-clés (séparés par des virgules)	Keywords (comma-separated)	Palabras clave (separadas por comas)
Météo	Weather	Meteo
Météo (résumé ou METAR)	Weather (summary or METAR)	Meteo (resumen o METAR)
météo de l'arrivée (ou !metar LFPG)	arrival weather (or !metar EGLL)	meteo de la llegada (o !metar LEMD)
même hors ligne	even offline	incluso sin conexión
même Wi-Fi	same Wi-Fi	mismo Wi-Fi
ne répond pas sur ce réseau : l'appli utilisera l'adresse	isn't responding on this network: the app will use the address	no responde en esta red: la app usará la dirección
Network	Network	Red
Niveau	Level	Nivel
Niveau {0}	Level {0}	Nivel {0}
Niveau {0} · {1} / {2} succès	Level {0} · {1} / {2} achievements	Nivel {0} · {1} / {2} logros
NM restants	NM to go	NM restantes
Noctambule	Night owl	Noctámbulo
Nom	Name	Nombre
Nom affiché	Display name	Nombre mostrado
Nom aéroport arrivée	Arrival airport name	Nombre del aeropuerto de llegada
Nom aéroport départ	Departure airport name	Nombre del aeropuerto de salida
Nom du bot	Bot name	Nombre del bot
Nom du tour	Tour name	Nombre del tour
Non connecté	Not connected	No conectado
Non défini	Not set	Sin definir
Non identifiée	Unidentified	Sin identificar
Non renseigné	Not provided	Sin indicar
non trouvé	not found	no encontrado
Note d'atterrissage	Landing grade	Nota de aterrizaje
Notes opérationnelles	Operational notes	Notas operativas
Nouveau	New	Nuevo
Nouveau lien	New link	Nuevo enlace
Nouveau pays	New country	Nuevo país
Nouveau pays sous nos ailes	New country beneath our wings	Nuevo país bajo nuestras alas
Nouveau rang :	New rank:	Nuevo rango:
Nouveau rang FlightBrief	New FlightBrief rank	Nuevo rango FlightBrief
Nouveau statut	New status	Nuevo estatus
Nouveau tour	New tour	Nuevo tour
Nouveautés de FlightBrief	What's new in FlightBrief	Novedades de FlightBrief
Nouvelle carrière	New career	Nueva carrera
Nouvelle version disponible : v{0}	New version available: v{0}	Nueva versión disponible: v{0}
Nuages	Clouds	Nubes
Néon	Neon	Neón
OACI départ / arrivée	Departure / arrival ICAO	OACI salida / llegada
Observé	Observed	Observado
Océanie	Oceania	Oceanía
OFP SimBrief	SimBrief OFP	OFP de SimBrief
OFP à jour ✓	OFP up to date ✓	OFP actualizado ✓
OFP — plan de vol actif	OFP — active flight plan	OFP — plan de vuelo activo
Oiseau de nuit	Night bird	Ave nocturna
Ombre portée	Drop shadow	Sombra proyectada
On survole chez {0} !	Flying over {0}'s place!	¡Sobrevolamos la casa de {0}!
On survolera chez :	We'll fly over:	Sobrevolaremos la casa de:
Opacité du fond	Background opacity	Opacidad del fondo
Outil Live	Live tool	Live
Outils	Tools	Herramientas
Ouvert	Open	Abierto
Ouverture de Twitch…	Opening Twitch…	Abriendo Twitch…
Ouvre	Open	Abre
Ouvre l'appli puis ajoute-la à l'écran d'accueil (	Open the app then add it to the home screen (	Abre la app y añádela a la pantalla de inicio (
Ouvre la console développeur de Twitch et connecte-toi avec ton compte.	Open the Twitch developer console and log in with your account.	Abre la consola de desarrolladores de Twitch e inicia sesión con tu cuenta.
Ouvre le fichier téléchargé (si rien ne s'ouvre :	Open the downloaded file (if nothing opens:	Abre el archivo descargado (si no se abre nada:
Ouvre le lien depuis ton PC	Open the link from your PC	Abre el enlace desde tu PC
Ouvrir	Open	Abrir
Ouvrir au début de la descente	Open at top of descent	Abrir al inicio del descenso
Ouvrir ce tour dans l'onglet Carrière	Open this tour in the Career tab	Abrir este tour en la pestaña Carrera
Ouvrir et installer l'appli	Open and install the app	Abrir e instalar la app
Ouvrir FlightBrief	Open FlightBrief	Abrir FlightBrief
Ouvrir l'embarquement	Open boarding	Abrir embarque
Ouvrir la console Twitch ↗	Open the Twitch console ↗	Abrir la consola de Twitch ↗
Ouvrir le dossier	Open folder	Abrir carpeta
Ouvrir le PDF	Open the PDF	Abrir el PDF
Ouvrir les paris	Open bets	Abrir apuestas
Overlay Live personnalisable	Customisable live overlay	Overlay en directo personalizable
Overlay « Alertes » pour OBS	“Alerts” overlay for OBS	Overlay «Alertas» para OBS
Panneau	Panel	Panel
Par défaut	Default	Por defecto
Paramètres → Sécurité → Chiffrement et identifiants → Installer un certificat → Certificat CA	Settings → Security → Encryption & credentials → Install a certificate → CA certificate	Ajustes → Seguridad → Cifrado y credenciales → Instalar un certificado → Certificado de CA
Parcouru	Flown	Recorrido
Pari d'atterrissage	Landing bet	Apuesta de aterrizaje
Pari en cours	Bet in progress	Apuesta en curso
Pari gagné !	Bet won!	¡Apuesta ganada!
Pari gagné ! (test)	Bet won! (test)	¡Apuesta ganada! (prueba)
Paris annulés	Bets cancelled	Apuestas canceladas
Paris d'atterrissage	Landing bets	Apuestas de aterrizaje
Paris fermés	Bets closed	Apuestas cerradas
Paris ouverts	Bets open	Apuestas abiertas
Paris ouverts : en attente des pronostics du chat (!pari 180).	Bets open: waiting for chat predictions (!bet 180).	Apuestas abiertas: esperando los pronósticos del chat (!apuesta 180).
Partager	Share	Compartir
Pas assez de points enregistrés sur les 6 derniers NM pour reconstituer l'approche.	Not enough points recorded over the last 6 NM to rebuild the approach.	No hay suficientes puntos registrados en las últimas 6 NM para reconstruir la aproximación.
Pas de donnée de toucher des roues pour ce vol.	No touchdown data for this flight.	No hay datos de toma para este vuelo.
Pas de détails pour cette version.	No details for this version.	Sin detalles para esta versión.
Pas de METAR disponible pour {0}.	No METAR available for {0}.	No hay METAR disponible para {0}.
Pas de passagers du chat sur ce vol.	No chat passengers on this flight.	No hubo pasajeros del chat en este vuelo.
Pas de TAF disponible pour {0} (tous les aéroports n'en publient pas).	No TAF available for {0} (not every airport publishes one).	No hay TAF disponible para {0} (no todos los aeropuertos lo publican).
Pas de ville renseignée.	No city provided.	Ninguna ciudad indicada.
Pas de vol	No flight	Sin vuelo
Pas de vol en cours.	No flight in progress.	No hay vuelo en curso.
Pas encore : le téléphone ne fait pas encore confiance au certificat. Termine l'étape 1 puis réessaie.	Not yet: the phone doesn't trust the certificate yet. Finish step 1 then try again.	Todavía no: el teléfono aún no confía en el certificado. Termina el paso 1 y vuelve a intentarlo.
Pas encore : vérifie que le profil est installé ET que le certificat est activé dans « Réglages de confiance des certificats ».	Not yet: check that the profile is installed AND the certificate is enabled in “Certificate Trust Settings”.	Todavía no: comprueba que el perfil está instalado Y que el certificado está activado en «Ajustes de confianza de certificados».
Pas encore d'ETA calculable vers {0} (vol pas commencé ou vitesse trop faible).	No ETA to {0} yet (flight not started or speed too low).	Aún no se puede calcular la ETA a {0} (vuelo no iniciado o velocidad demasiado baja).
Pas encore de carte postale : elles arrivent après ton prochain atterrissage avec des passagers.	No postcards yet: they arrive after your next landing with passengers.	Aún no hay postales: llegan tras tu próximo aterrizaje con pasajeros.
Pas encore de carte postale.	No postcard yet.	Aún no hay postal.
Pas encore de données.	No data yet.	Aún no hay datos.
Pas encore de notes pour cette version.	No notes for this version yet.	Aún no hay notas para esta versión.
Pas encore de passagers. Rejoins le stream et tape !embarquer pendant un vol !	No passengers yet. Join the stream and type !board during a flight!	Aún no hay pasajeros. ¡Únete al stream y escribe !embarcar durante un vuelo!
Pas encore de tampon.	No stamps yet.	Aún no hay sellos.
Pas encore vérifié.	Not checked yet.	Aún no comprobado.
Passager	Passenger	Pasajero
Passagers	Passengers	Pasajeros
Passagers, passeports et classement	Passengers, passports and leaderboard	Pasajeros, pasaportes y clasificación
Passeport tamponné	Passport stamped	Pasaporte sellado
Passer	Skip	Omitir
passé	past	pasado
Pause	Pause	Pausa
Pays	Countries	Países
PC injoignable : connecte-toi au même Wi-Fi que ton PC, avec FlightBrief ouvert.	PC unreachable: connect to the same Wi-Fi as your PC, with FlightBrief open.	PC inaccesible: conéctate al mismo Wi-Fi que tu PC, con FlightBrief abierto.
Pendant un vol suivi, utilise le bouton « Capture d'écran » du Briefing ou ton raccourci. Tu peux aussi ajouter des images existantes.	During a tracked flight, use the Briefing's “Screenshot” button or your shortcut. You can also add existing images.	Durante un vuelo con seguimiento, usa el botón «Captura de pantalla» del Briefing o tu atajo. También puedes añadir imágenes existentes.
Perfectionniste	Perfectionist	Perfeccionista
Personnalise entièrement l'apparence de la carte de briefing OBS : couleurs, polices, disposition.	Fully customise the look of the OBS briefing card: colours, fonts, layout.	Personaliza por completo la apariencia de la tarjeta de briefing OBS: colores, fuentes, disposición.
Personne n'a encore gagné de pari d'atterrissage. Tente ta chance avec !pari pendant la descente !	Nobody has won a landing bet yet. Try your luck with !bet during the descent!	Nadie ha ganado todavía una apuesta de aterrizaje. ¡Prueba suerte con !apuesta durante el descenso!
Personne n'a encore gagné de pari.	Nobody has won a bet yet.	Nadie ha ganado una apuesta todavía.
Personne n'a tenté sa chance.	Nobody tried their luck.	Nadie probó suerte.
Personne n'a trouvé cette fois	Nobody got it this time	Nadie lo adivinó esta vez
Personne n'a trouvé cette fois.	Nobody got it this time.	Nadie lo adivinó esta vez.
Personne n'avait parié cette fois.	Nobody had bet this time.	Nadie había apostado esta vez.
Personne à bord : tape	Nobody on board: type	Nadie a bordo: escribe
Personne à bord pour l'instant.	Nobody on board yet.	Aún no hay nadie a bordo.
Petit coucou	Quick hello	Saludito
Peu importe l'unité (kg, lbs, gallons…) — utilise juste la même partout, le calcul est un simple ratio.	Any unit works (kg, lbs, gallons…) — just use the same one everywhere, the calculation is a simple ratio.	Da igual la unidad (kg, lbs, galones…) — usa la misma en todas partes, el cálculo es una simple proporción.
Phase	Phase	Fase
Phase de vol	Flight phase	Fase de vuelo
Phases	Phases	Fases
Phases du vol	Flight phases	Fases del vuelo
Phases détaillées	Detailed phases	Fases detalladas
Photographe	Photographer	Fotógrafo
Pilier d'IVAO	IVAO pillar	Pilar de IVAO
Pilier de VATSIM	VATSIM pillar	Pilar de VATSIM
Pilote	Pilot	Piloto
Pilote d'essai	Test pilot	Piloto de pruebas
Pilote de ligne	Airline pilot	Piloto de línea
Pilote privé	Private pilot	Piloto privado
Pilote professionnel	Commercial pilot	Piloto comercial
Piste	Runway	Pista
Piste identifiée	Runway identified	Pista identificada
Piste non identifiée pour ce vol : approche 3D indisponible.	Runway not identified for this flight: 3D approach unavailable.	Pista no identificada en este vuelo: aproximación 3D no disponible.
Plan de vol importé ✓ — vérifie et ajuste les champs si besoin.	Flight plan imported ✓ — check and adjust the fields if needed.	Plan de vuelo importado ✓ — revisa y ajusta los campos si hace falta.
Platine	Platinum	Platino
Plein écran (touche P, Échap pour sortir)	Full screen (P key, Esc to exit)	Pantalla completa (tecla P, Esc para salir)
plein écran ·	full screen ·	pantalla completa ·
Plume	Feather	Pluma
Plus dur	Harder	Más duro
Plus tard	Later	Más tarde
Poids	Weight	Peso
Police	Font	Fuente
Police des données (indicatif, ICAO, chiffres)	Data font (callsign, ICAO, numbers)	Fuente de datos (indicativo, OACI, cifras)
Police des titres / labels	Titles / labels font	Fuente de títulos / etiquetas
Police du texte courant	Body text font	Fuente del texto
Portes fermées	Doors closed	Puertas cerradas
Poser les roues sur 3 continents.	Touch down on 3 continents.	Aterrizar en 3 continentes.
Position	Position	Posición
Position à l'écran	Screen position	Posición en pantalla
Pour changer le titre, Twitch exige le compte de la chaîne elle-même (pas celui du bot). Il utilise ton application Twitch de l'onglet Twitch.	To change the title, Twitch requires the channel's own account (not the bot's). It uses your Twitch application from the Twitch tab.	Para cambiar el título, Twitch exige la cuenta del propio canal (no la del bot). Usa tu aplicación de Twitch de la pestaña Twitch.
pour monter à bord	to come aboard	para subir a bordo
pour qu'on te survole	so we fly over you	para que te sobrevolemos
Pour que le bot puisse parler dans ton chat, Twitch demande que chaque streamer déclare	For the bot to talk in your chat, Twitch requires each streamer to register	Para que el bot pueda hablar en tu chat, Twitch exige que cada streamer registre
Pour récupérer ton logbook, ce téléphone doit être sur le	To get your logbook, this phone must be on the	Para recuperar tu logbook, este teléfono debe estar en el
Pour un vol fait sans le tracker. Vide = distance directe départ → arrivée.	For a flight made without the tracker. Empty = direct distance departure → arrival.	Para un vuelo hecho sin el seguimiento. Vacío = distancia directa salida → llegada.
Premier vol	First flight	Primer vuelo
Première nuit	First night	Primera noche
Première synchronisation	First sync	Primera sincronización
Pression	Pressure	Presión
Prochain :	Next:	Próximo:
Prochaine étape	Next leg	Próxima etapa
Profil	Profile	Perfil
Profil du vol	Flight profile	Perfil del vuelo
Profil enregistré ✓	Profile saved ✓	Perfil guardado ✓
Profil téléchargé	Profile downloaded	Perfil descargado
Programme passagers	Passenger programme	Programa de pasajeros
Progression	Progress	Progreso
pronostic sur le taux de toucher	touchdown rate prediction	pronóstico de la tasa de toma
Pronostique :	Predict:	Pronostica:
Propose à partir de ton briefing. Modifie-le comme tu veux : rien ne change sur Twitch tant que tu n'as pas cliqué sur « Mettre à jour ».	Suggested from your briefing. Edit it as you like: nothing changes on Twitch until you click “Update”.	Propuesto a partir de tu briefing. Modifícalo como quieras: nada cambia en Twitch hasta que hagas clic en «Actualizar».
Provenance	Origin	Procedencia
Précise un aéroport : !metar LFPG	Specify an airport: !metar EGLL	Indica un aeropuerto: !metar LEMD
Précédent	Previous	Anterior
Préfixer ses messages par [nom du bot]	Prefix its messages with [bot name]	Anteponer [nombre del bot] a sus mensajes
Prénom	First name	Nombre
Préparation…	Preparing…	Preparando…
Prépare ton vol ici : import SimBrief, réglages du plan de vol, connexion à ton simulateur, carte et télémétrie en direct.	Prepare your flight here: SimBrief import, flight plan settings, simulator connection, live map and telemetry.	Prepara tu vuelo aquí: importación de SimBrief, ajustes del plan de vuelo, conexión al simulador, mapa y telemetría en directo.
Prévol	Preflight	Prevuelo
Prêt : l'embarquement s'ouvre au lancement du tracker	Ready: boarding opens when the tracker starts	Listo: el embarque se abre al iniciar el seguimiento
Pseudo SimBrief	SimBrief username	Usuario de SimBrief
Pseudo Twitch	Twitch username	Usuario de Twitch
Public	Public	Público
Puis	Then	Luego
Pâtissier étoilé	Star pastry chef	Pastelero estrella
QR code indisponible — copie le lien.	QR code unavailable — copy the link.	Código QR no disponible — copia el enlace.
Qualité des atterrissages	Landing quality	Calidad de los aterrizajes
quand même le chat : ses réponses et les paris s'affichent alors sur l'overlay Alertes. Pour qu'il apparaisse sous son propre nom dans le chat, crée un compte Twitch dédié (ex.	the chat anyway: its replies and bets then show on the Alerts overlay. For it to appear under its own name in chat, create a dedicated Twitch account (e.g.	igualmente el chat: sus respuestas y las apuestas aparecen entonces en el overlay de Alertas. Para que aparezca con su propio nombre en el chat, crea una cuenta de Twitch dedicada (p. ej.
quand Safari propose de télécharger un profil.	when Safari offers to download a profile.	cuando Safari proponga descargar un perfil.
que ce PC (FlightBrief ouvert). Rien ne passe par Internet.	as this PC (FlightBrief open). Nothing goes through the Internet.	que este PC (FlightBrief abierto). Nada pasa por Internet.
que ton PC, avec FlightBrief ouvert et l'accès mobile activé. Ensuite, il reste consultable partout, même hors ligne.	as your PC, with FlightBrief open and mobile access enabled. After that, it stays viewable anywhere, even offline.	que tu PC, con FlightBrief abierto y el acceso móvil activado. Después sigue disponible en todas partes, incluso sin conexión.
Quelle ville se trouve sous nos ailes ? Indice : {0} lettres, commence par « {1} »	Which city is beneath our wings? Hint: {0} letters, starts with “{1}”	¿Qué ciudad está bajo nuestras alas? Pista: {0} letras, empieza por «{1}»
Quelques infos pour personnaliser ton expérience — tout est facultatif et modifiable plus tard depuis l'onglet Profil.	A few details to personalise your experience — everything is optional and can be changed later in the Profile tab.	Algunos datos para personalizar tu experiencia — todo es opcional y se puede cambiar después en la pestaña Perfil.
qui est à bord	who's on board	quién está a bordo
Quitter le plein écran (Échap)	Exit full screen (Esc)	Salir de pantalla completa (Esc)
Quiz du hublot	Window quiz	Quiz de la ventanilla
Quoi de neuf	What's new	Novedades
Raccourci	Shortcut	Atajo
Raccourci actif : {0}	Active shortcut: {0}	Atajo activo: {0}
Raccourci clavier	Keyboard shortcut	Atajo de teclado
Radio	Radio	Radio
Rang & succès	Rank & achievements	Rango y logros
Rang maximal	Top rank	Rango máximo
Rang maximal atteint	Top rank reached	Rango máximo alcanzado
Ranger en colonne	Stack in a column	Ordenar en columna
Ranger en ligne en bas	Line up at the bottom	Ordenar en fila abajo
Rapport détaillé du vol — en direct	Detailed flight report — live	Informe detallado del vuelo — en directo
Rattachée au PIREP de ce vol.	Attached to this flight's PIREP.	Vinculada al PIREP de este vuelo.
Rayon des angles	Corner radius	Radio de las esquinas
Rebond	Bounce	Rebote
Rebonds	Bounces	Rebotes
recherche des aéroports impossible.	airport lookup unavailable.	búsqueda de aeropuertos imposible.
Recherche du fichier de mise à jour…	Looking for the update file…	Buscando el archivo de actualización…
Record d’affilée	Best streak	Récord seguido
Redémarrage…	Restarting…	Reiniciando…
Redémarrer et installer	Restart and install	Reiniciar e instalar
Refusé	Rejected	Rechazado
Remarques	Remarks	Observaciones
Remettre le classement des parieurs à zéro ?	Reset the bettors leaderboard?	¿Reiniciar la clasificación de apostantes?
Remettre à zéro	Reset	Reiniciar
Remplis le formulaire « Enregistrer votre application » :	Fill in the “Register Your Application” form:	Rellena el formulario «Registrar tu aplicación»:
Rendu réel de la source OBS, mis à jour à chaque réglage. Pour l'audio, coche « Contrôler l'audio via OBS » dans les propriétés de la source.	Real output of the OBS source, updated with every setting. For audio, tick “Control audio via OBS” in the source properties.	Resultado real de la fuente OBS, actualizado con cada ajuste. Para el audio, marca «Controlar audio mediante OBS» en las propiedades de la fuente.
Renseigne d'abord les OACI de départ et d'arrivée.	Enter the departure and arrival ICAO codes first.	Indica primero los OACI de salida y llegada.
Renseigne la consommation horaire.	Enter the hourly fuel burn.	Indica el consumo horario.
Renseigne la distance et la durée.	Enter the distance and duration.	Indica la distancia y la duración.
Renseigne la distance et la vitesse sol.	Enter the distance and ground speed.	Indica la distancia y la velocidad respecto al suelo.
Renseigne la durée de vol prévue.	Enter the planned flight time.	Indica la duración de vuelo prevista.
Renseigne la vitesse et la durée.	Enter the speed and duration.	Indica la velocidad y la duración.
Renseigne le cap d'insertion et le cap actuel de l'avion.	Enter the inbound course and the aircraft's current heading.	Indica el rumbo de entrada y el rumbo actual del avión.
Renseigne le carburant à bord.	Enter the fuel on board.	Indica el combustible a bordo.
Renseigne le départ et l'arrivée du vol pour voir les contrôleurs de tes aéroports.	Enter the flight's departure and arrival to see your airports' controllers.	Indica la salida y la llegada del vuelo para ver los controladores de tus aeropuertos.
Renseigne les caps ci-dessus.	Enter the headings above.	Indica los rumbos de arriba.
Renseigne les champs ci-dessus.	Fill in the fields above.	Rellena los campos de arriba.
Renseigne les deux champs nécessaires.	Fill in the two required fields.	Rellena los dos campos necesarios.
Renseigne les réglages de l'onglet Briefing pour commencer.	Fill in the Briefing tab settings to get started.	Rellena los ajustes de la pestaña Briefing para empezar.
Renseigne une altitude de croisière supérieure à l'altitude cible.	Enter a cruise altitude above the target altitude.	Indica una altitud de crucero superior a la altitud objetivo.
Reprend les couleurs, la police, les arrondis, la bordure, l'ombre et le flou de ton overlay (Outil Live) et suit leurs changements.	Uses the colours, font, corners, border, shadow and blur of your overlay (Live tool) and follows their changes.	Usa los colores, la fuente, las esquinas, el borde, la sombra y el desenfoque de tu overlay (Herramienta Live) y sigue sus cambios.
Repères	Waypoints	Puntos
Repères visuels	Visual reference points	Puntos visuales
Restaurer	Restore	Restaurar
Restaurer cette sauvegarde ? Tes données actuelles seront remplacées (une copie de sécurité de l'état actuel est gardée dans le dossier de données), puis l'appli se rechargera.	Restore this backup? Your current data will be replaced (a safety copy of the current state is kept in the data folder), then the app will reload.	¿Restaurar esta copia? Tus datos actuales se sustituirán (se guarda una copia de seguridad del estado actual en la carpeta de datos) y la app se recargará.
Retirer	Remove	Quitar
Retirer l'application	Remove the application	Quitar la aplicación
Retirer ton application Twitch ? Le compte connecté sera déconnecté et le bot repassera en lecture seule.	Remove your Twitch application? The connected account will be disconnected and the bot will go back to read-only.	¿Quitar tu aplicación de Twitch? La cuenta conectada se desconectará y el bot volverá a modo solo lectura.
Retirer « {0} » du hangar ? Les vols restent dans le logbook.	Remove “{0}” from the hangar? The flights stay in the logbook.	¿Quitar «{0}» del hangar? Los vuelos se quedan en el logbook.
Revenir au design FlightBrief par défaut pour les alertes ?	Go back to the default FlightBrief design for alerts?	¿Volver al diseño de FlightBrief por defecto para las alertas?
Revenir à Ctrl+Alt+F12	Reset to Ctrl+Alt+F12	Volver a Ctrl+Alt+F12
Revenir à la vue d'ensemble	Back to overview	Volver a la vista general
Reviens ici une fois le certificat approuvé.	Come back here once the certificate is approved.	Vuelve aquí cuando hayas aprobado el certificado.
Revoir la visite guidée	Replay the guided tour	Ver de nuevo la visita guiada
Rien ici pour l'instant.	Nothing here yet.	Aún no hay nada aquí.
Rien pour l'instant. Tape	Nothing yet. Type	Nada por ahora. Escribe
Rien que le paysage	Just the scenery	Solo el paisaje
Right	Right	Derecha
Roulage	Taxi	Rodaje
Roulage (arrivée)	Taxi (arrival)	Rodaje (llegada)
Roulage (départ)	Taxi (departure)	Rodaje (salida)
Route / points de passage	Route / waypoints	Ruta / puntos de paso
Route prévue	Planned route	Ruta prevista
Route à définir	Route to be defined	Ruta por definir
Règles	Rules	Reglas
Récupération de l’OFP depuis SimBrief…	Fetching the OFP from SimBrief…	Obteniendo el OFP de SimBrief…
Récupération du plan de vol…	Fetching the flight plan…	Obteniendo el plan de vuelo…
Récupération en cours…	Fetching…	Obteniendo…
Récupérer	Fetch	Obtener
Récupéré	Fetched	Obtenido
Réduire	Minimise	Minimizar
Réessayer	Try again	Reintentar
Régionaux & moyen-courriers	Regional & medium-haul	Regionales y medio radio
Réglages	Settings	Ajustes
Réglages des captures	Screenshot settings	Ajustes de capturas
Réglages des captures (raccourci, captures auto, son)	Screenshot settings (shortcut, auto screenshots, sound)	Ajustes de capturas (atajo, capturas auto, sonido)
Réglages du vol	Flight settings	Ajustes del vuelo
Réglages → Général → Informations → Réglages de confiance des certificats	Settings → General → About → Certificate Trust Settings	Ajustes → General → Información → Ajustes de confianza de certificados
Réglé par ton overlay live : désactive « Assortir » pour personnaliser.	Set by your live overlay: turn off “Match” to customise.	Definido por tu overlay en directo: desactiva «A juego» para personalizar.
Réinitialiser le design	Reset design	Restablecer el diseño
Réinitialiser le thème par défaut	Reset to default theme	Restablecer el tema por defecto
Réinitialiser toutes les couleurs, polices et options de disposition ?	Reset all colours, fonts and layout options?	¿Restablecer todos los colores, fuentes y opciones de disposición?
Répartition par réseau	Breakdown by network	Reparto por red
répond à {0}	replies to {0}	responde a {0}
répondre au quiz du hublot	answer the window quiz	responder al quiz de la ventanilla
Réponds avec	Answer with	Responde con
Réponse : {0}	Answer: {0}	Respuesta: {0}
Réponse : {0} {1}.	Answer: {0} {1}.	Respuesta: {0} {1}.
Réponse : {0}.	Answer: {0}.	Respuesta: {0}.
Réponse du bot	Bot reply	Respuesta del bot
Réponses du bot	Bot replies	Respuestas del bot
Réseau	Network	Red
Réseau préféré	Preferred network	Red preferida
Réseaux & ATC	Networks & ATC	Redes y ATC
réseaux privés	private networks	redes privadas
Réserve souhaitée (minutes)	Desired reserve (minutes)	Reserva deseada (minutos)
sa propre application	their own application	su propia aplicación
sa ville, pour être survolé (	their city, to be flown over (	su ciudad, para ser sobrevolado (
Salut	Hi	Hola
Sans catégorie	Uncategorised	Sin categoría
Sans compte connecté, le bot	Without a connected account, the bot	Sin cuenta conectada, el bot
Sans date	No date	Sin fecha
Sans OFP SimBrief pour ce vol : distance directe jusqu'à l'arrivée, début de descente estimé sur une pente de 3°.	No SimBrief OFP for this flight: direct distance to arrival, top of descent estimated on a 3° slope.	Sin OFP de SimBrief para este vuelo: distancia directa hasta la llegada, inicio del descenso estimado con una pendiente de 3°.
Sans rebond	No bounce	Sin rebote
Saut de puce	Short hop	Salto corto
Sauvegarde du jour mise à jour ✓	Today's backup updated ✓	Copia del día actualizada ✓
Sauvegarde restaurée	Backup restored	Copia restaurada
Sauvegarder maintenant	Back up now	Hacer copia ahora
Scanne le QR code avec l'appareil photo du téléphone (sur iPhone, ouvre le lien dans	Scan the QR code with the phone's camera (on iPhone, open the link in	Escanea el código QR con la cámara del teléfono (en iPhone, abre el enlace en
Se poser avec au moins 15 kt de vent traversier.	Land with at least 15 kt of crosswind.	Aterrizar con al menos 15 kt de viento cruzado.
Se poser avec au moins 25 kt de vent traversier.	Land with at least 25 kt of crosswind.	Aterrizar con al menos 25 kt de viento cruzado.
Se poser avec un contrôleur en ligne à l'arrivée (ATC activé sur la carte).	Land with an online controller at arrival (ATC enabled on the map).	Aterrizar con un controlador en línea en la llegada (ATC activado en el mapa).
Se poser dans 10 pays.	Land in 10 countries.	Aterrizar en 10 países.
Se poser dans 30 pays.	Land in 30 countries.	Aterrizar en 30 países.
Se poser sur un terrain à plus de 5 000 ft d'altitude.	Land at an airfield above 5,000 ft elevation.	Aterrizar en un aeródromo a más de 5000 ft de altitud.
Secteur IVAO	IVAO sector	Sector IVAO
Secteur VATSIM	VATSIM sector	Sector VATSIM
Secteurs standard : direct 180°, teardrop 70°, parallèle 110° — comme sur l'Easy Entry Tool IVAO FR.	Standard sectors: direct 180°, teardrop 70°, parallel 110° — as in the IVAO FR Easy Entry Tool.	Sectores estándar: directa 180°, lágrima 70°, paralela 110° — como en el Easy Entry Tool de IVAO FR.
selon la note	by grade	según la nota
Sens des virages du hold	Holding turn direction	Sentido de los virajes de espera
Sens du circuit	Pattern direction	Sentido del circuito
Seuil {0}	Threshold {0}	Umbral {0}
Seuils de toucher par catégorie	Touchdown thresholds by category	Umbrales de toma por categoría
Seules les carrières de type IVAO apparaissent ici. Crée d'abord une carrière IVAO ci-dessous si la liste est vide.	Only IVAO careers show up here. Create an IVAO career below first if the list is empty.	Aquí solo aparecen las carreras de tipo IVAO. Crea primero una carrera IVAO abajo si la lista está vacía.
Seuls le bouton et le raccourci prennent des captures.	Only the button and the shortcut take screenshots.	Solo el botón y el atajo hacen capturas.
Shadow	Shadow	Sombra
Shift	Shift	Mayús
Si Twitch le demande, active d'abord la double authentification sur ton compte.	If Twitch asks, enable two-factor authentication on your account first.	Si Twitch lo pide, activa primero la verificación en dos pasos en tu cuenta.
Signal perdu	Signal lost	Señal perdida
Silhouette	Silhouette	Silueta
SimBrief n'a pas renvoyé d'OFP pour ce plan	SimBrief returned no OFP for this plan	SimBrief no devolvió ningún OFP para este plan
Simulateur connecté	Simulator connected	Simulador conectado
Simulateur non détecté (MSFS doit être lancé et un vol chargé).	Simulator not detected (MSFS must be running with a flight loaded).	Simulador no detectado (MSFS debe estar abierto y con un vuelo cargado).
Sol	Ground	Suelo
Son	Sound	Sonido
Son à l'apparition (audio de la source OBS)	Sound on appearance (OBS source audio)	Sonido al aparecer (audio de la fuente OBS)
Son à la capture	Screenshot sound	Sonido al capturar
sont gardées. Si le fichier principal est un jour illisible, l'appli repart toute seule de la plus récente.	are kept. If the main file ever becomes unreadable, the app restarts from the most recent one on its own.	más recientes. Si el archivo principal deja de ser legible, la app se recupera sola a partir de la más reciente.
Sound	Sound	Sonido
Source	Source	Fuente
Source : aviationweather.gov (NOAA), données publiques en temps réel. Tous les aéroports ne publient pas de TAF.	Source: aviationweather.gov (NOAA), real-time public data. Not every airport publishes a TAF.	Fuente: aviationweather.gov (NOAA), datos públicos en tiempo real. No todos los aeropuertos publican TAF.
Source OBS « À bord »	“On board” OBS source	Fuente OBS «A bordo»
Sous contrôle	Under control	Bajo control
sous {0} ft sol	below {0} ft AGL	por debajo de {0} ft AGL
Souvenir de vol	Flight souvenir	Recuerdo de vuelo
Space	Space	Espacio
Statistiques calculées à partir de ton logbook	Statistics calculated from your logbook	Estadísticas calculadas a partir de tu logbook
Statistiques — calculées à partir de ton logbook	Statistics — calculated from your logbook	Estadísticas — calculadas a partir de tu logbook
Statut	Status	Estatus
Statut PIREP	PIREP status	Estado del PIREP
Statut {0}	{0} status	Estatus {0}
Statuts : 🎫 Membre · 🥈 Argent (1 500) · 🥇 Or (6 000) · 💠 Platine (20 000) · 👑 Légende (60 000 miles). Bonus : atterrissage +100, survol de chez soi +150, quiz +50, heure d'arrivée +100, correspondance +100 par vol enchaîné.	Tiers: 🎫 Member · 🥈 Silver (1,500) · 🥇 Gold (6,000) · 💠 Platinum (20,000) · 👑 Legend (60,000 miles). Bonuses: landing +100, flying over your home +150, quiz +50, arrival time +100, connection +100 per chained flight.	Estatus: 🎫 Miembro · 🥈 Plata (1500) · 🥇 Oro (6000) · 💠 Platino (20 000) · 👑 Leyenda (60 000 millas). Bonus: aterrizaje +100, sobrevuelo de tu casa +150, quiz +50, hora de llegada +100, conexión +100 por vuelo encadenado.
Stratosphère	Stratosphere	Estratosfera
Stream	Stream	Stream
Style	Style	Estilo
Succès	Achievements	Logros
Succès & rangs FlightBrief	FlightBrief achievements & ranks	Logros y rangos de FlightBrief
Succès débloqué	Achievement unlocked	Logro desbloqueado
Succès débloqué (test)	Achievement unlocked (test)	Logro desbloqueado (prueba)
Succès débloqué ·	Achievement unlocked ·	Logro desbloqueado ·
Succès débloqués	Achievements unlocked	Logros desbloqueados
Suis ta progression au sein d'une compagnie virtuelle, d'un réseau IVAO/VATSIM, ou de tout autre parcours basé sur les heures de vol.	Track your progress in a virtual airline, an IVAO/VATSIM network, or any other path based on flight hours.	Sigue tu progreso en una aerolínea virtual, una red IVAO/VATSIM o cualquier otro recorrido basado en horas de vuelo.
Suis ta progression de grade au sein de tes compagnies virtuelles, et gère tes tours.	Track your rank progression in your virtual airlines, and manage your tours.	Sigue tu progreso de rango en tus aerolíneas virtuales y gestiona tus tours.
Suivant	Next	Siguiente
Suivi actif	Tracking on	Seguimiento activo
Suivi du vol (SimConnect)	Flight tracking (SimConnect)	Seguimiento del vuelo (SimConnect)
Suivi en direct indisponible	Live tracking unavailable	Seguimiento en directo no disponible
Suivre	Follow	Seguir
Suivre sur la carte ›	Follow on the map ›	Seguir en el mapa ›
Supprimer	Delete	Eliminar
Supprimer ce tour ?	Delete this tour?	¿Eliminar este tour?
Supprimer ce vol du logbook ?	Delete this flight from the logbook?	¿Eliminar este vuelo del logbook?
Supprimer cette carrière ? Les vols liés resteront dans le logbook mais perdront ce lien.	Delete this career? Linked flights will stay in the logbook but lose this link.	¿Eliminar esta carrera? Los vuelos vinculados se quedarán en el logbook pero perderán este vínculo.
Supprimer définitivement cette capture ?	Permanently delete this screenshot?	¿Eliminar definitivamente esta captura?
sur cet appareil.	on this device.	en este dispositivo.
Sur GitHub, crée un dépôt public, par exemple	On GitHub, create a public repository, for example	En GitHub, crea un repositorio público, por ejemplo
Sur iPhone, ouvre cette page dans	On iPhone, open this page in	En iPhone, abre esta página en
Sur l'axe	On centreline	En el eje
Sur l'écran d'accueil	Add to Home Screen	En la pantalla de inicio
sur la variable	on variable	en la variable
sur le site public)	on the public site)	en el sitio público)
sur notre droite	on our right	a nuestra derecha
sur notre gauche	on our left	a nuestra izquierda
Sur ton PC, onglet	On your PC, tab	En tu PC, pestaña
Survol	Flyover	Sobrevuelo
Survol imminent	Flyover coming up	Sobrevuelo inminente
Synchronisation	Sync	Sincronización
Synchroniser	Sync	Sincronizar
Synchroniser avec FlightBrief sur ton PC	Sync with FlightBrief on your PC	Sincronizar con FlightBrief en tu PC
Synchronisé ✓ — {0} vols	Synced ✓ — {0} flights	Sincronizado ✓ — {0} vuelos
Synchro…	Syncing…	Sincronizando…
Séparateurs entre les champs (mode barre)	Separators between fields (bar mode)	Separadores entre campos (modo barra)
Taille	Size	Tamaño
Taille du texte	Text size	Tamaño del texto
Tampons	Stamps	Sellos
tampons et pays (	stamps and countries (	sellos y países (
Tape	Type	Escribe
TAS estimée :	Estimated TAS:	TAS estimada:
Taux	Rate	Tasa
Taux d'atterrissage	Landing rate	Tasa de aterrizaje
Taux de chute au toucher en ft/min (valeur absolue). Un vol est jugé avec l'échelle de la catégorie de son avion du hangar.	Sink rate at touchdown in ft/min (absolute value). A flight is graded with the scale of its hangar aircraft's category.	Tasa de descenso en la toma en ft/min (valor absoluto). Un vuelo se evalúa con la escala de la categoría de su avión del hangar.
Taux de descente (fpm)	Descent rate (fpm)	Tasa de descenso (fpm)
Taux de descente pour tenir cette pente à {0} kt :	Descent rate to hold this slope at {0} kt:	Tasa de descenso para mantener esta pendiente a {0} kt:
Taux de descente visé (ft/min)	Target descent rate (ft/min)	Tasa de descenso objetivo (ft/min)
Taux de toucher	Touchdown rate	Tasa de toma
Taux moyen au toucher	Average touchdown rate	Tasa media de toma
Temp. / Point de rosée	Temp. / Dew point	Temp. / Punto de rocío
Temps de vol	Flight time	Tiempo de vuelo
Tempête	Storm	Tormenta
Terminer	Finish	Terminar
Terminer 5 tours de carrière.	Complete 5 career tours.	Completar 5 tours de carrera.
Terminer un tour de carrière.	Complete a career tour.	Completar un tour de carrera.
Terminé	Completed	Terminado
Terminé le	Completed on	Terminado el
Terrains reliés	Airfields connected	Aeródromos conectados
Tes avions et leurs statistiques, calculées à partir du logbook : heures de vol, distance, qualité des atterrissages… Les vols sont associés via le champ « Avion du hangar » du logbook, ou automatiquement grâce aux mots-clés de chaque avion.	Your aircraft and their statistics, calculated from the logbook: flight hours, distance, landing quality… Flights are linked through the logbook's “Hangar aircraft” field, or automatically thanks to each aircraft's keywords.	Tus aviones y sus estadísticas, calculadas a partir del logbook: horas de vuelo, distancia, calidad de los aterrizajes… Los vuelos se asocian mediante el campo «Avión del hangar» del logbook, o automáticamente gracias a las palabras clave de cada avión.
Tes avions, avec pour chacun ses heures de vol, sa distance parcourue et la qualité de tes atterrissages.	Your aircraft, each with its flight hours, distance flown and the quality of your landings.	Tus aviones, cada uno con sus horas de vuelo, su distancia recorrida y la calidad de tus aterrizajes.
Tester : atterrissage	Test: landing	Probar: aterrizaje
Tester : pari	Test: bet	Probar: apuesta
Tester : réponse du bot	Test: bot reply	Probar: respuesta del bot
Tester : succès	Test: achievement	Probar: logro
Texte	Text	Texto
Texte de l’OFP copié ✓	OFP text copied ✓	Texto del OFP copiado ✓
Texte de marque (watermark, ex : @tonpseudo)	Brand text (watermark, e.g. @yourname)	Texto de marca (marca de agua, p. ej. @tuusuario)
Texte libre 1	Custom text 1	Texto libre 1
Texte libre 2	Custom text 2	Texto libre 2
Texte personnalisé 1	Custom text 1	Texto personalizado 1
Texte personnalisé 2	Custom text 2	Texto personalizado 2
Texte principal	Main text	Texto principal
Texte secondaire	Secondary text	Texto secundario
Textes personnalisés libres	Free custom texts	Textos personalizados libres
Thème de départ	Starting theme	Tema inicial
Thème par défaut, esthétique avionique	Default theme, avionics look	Tema por defecto, estética aviónica
Thèmes prédéfinis	Preset themes	Temas predefinidos
Timer	Timer	Temporizador
Titre	Title	Título
Titre affiché sur la carte	Title shown on the card	Título mostrado en la tarjeta
Titre du stream	Stream title	Título del stream
TOD et distance restante calculés le long de la route de l'OFP SimBrief.	TOD and remaining distance calculated along the SimBrief OFP route.	TOD y distancia restante calculados a lo largo de la ruta del OFP de SimBrief.
TOD et ETA sont calculés en direct à partir de l'OFP SimBrief (points TOD et route), sinon à partir de la distance restante jusqu'à l'aéroport d'arrivée du Briefing.	TOD and ETA are calculated live from the SimBrief OFP (TOD point and route), otherwise from the remaining distance to the Briefing's arrival airport.	TOD y ETA se calculan en directo a partir del OFP de SimBrief (punto TOD y ruta), o si no, a partir de la distancia restante hasta el aeropuerto de llegada del Briefing.
Ton application Twitch	Your Twitch application	Tu aplicación de Twitch
ton application Twitch doit être de type « Public » (Console Twitch → ton application → Gérer → Type de client).	your Twitch application must be of type “Public” (Twitch Console → your application → Manage → Client Type).	tu aplicación de Twitch debe ser de tipo «Público» (Consola de Twitch → tu aplicación → Administrar → Tipo de cliente).
Ton avion bougeait : le suivi du vol a démarré tout seul.	Your aircraft was moving: flight tracking started by itself.	Tu avión se movía: el seguimiento del vuelo empezó solo.
Ton avion roule	Your aircraft is taxiing	Tu avión está rodando
Ton avion roule mais le vol n'est pas suivi. Clique pour lancer le tracker.	Your aircraft is taxiing but the flight isn't tracked. Click to start the tracker.	Tu avión está rodando pero el vuelo no tiene seguimiento. Haz clic para iniciarlo.
Ton fichier de données était illisible	Your data file was unreadable	Tu archivo de datos era ilegible
Ton hangar est vide. Ajoute tes avions depuis l'onglet Hangar de FlightBrief sur ton PC.	Your hangar is empty. Add your aircraft from the Hangar tab of FlightBrief on your PC.	Tu hangar está vacío. Añade tus aviones desde la pestaña Hangar de FlightBrief en tu PC.
Ton hangar est vide. Clique sur	Your hangar is empty. Click	Tu hangar está vacío. Haz clic en
Ton identité de pilote virtuel, et toutes les statistiques calculées à partir de ton logbook.	Your virtual pilot identity, and all the statistics calculated from your logbook.	Tu identidad de piloto virtual y todas las estadísticas calculadas a partir de tu logbook.
Ton identité pilote, toutes tes statistiques de vol, et un globe 3D de tous tes trajets déjà effectués. Tu peux relancer cette visite ici à tout moment.	Your pilot identity, all your flight statistics, and a 3D globe of every route you've flown. You can replay this tour here at any time.	Tu identidad de piloto, todas tus estadísticas de vuelo y un globo 3D de todos tus trayectos. Puedes repetir esta visita aquí cuando quieras.
Ton logbook, tes carrières, tes tours et ton hangar sur ton téléphone,	Your logbook, careers, tours and hangar on your phone,	Tu logbook, tus carreras, tus tours y tu hangar en tu teléfono,
Ton profil pilote	Your pilot profile	Tu perfil de piloto
Touche	Tap	Toca
Touche un aéroport pour voir ses départs et arrivées.	Tap an airport to see its departures and arrivals.	Toca un aeropuerto para ver sus salidas y llegadas.
Touche une étape pour voir le vol correspondant.{0}	Tap a leg to see the matching flight.{0}	Toca una etapa para ver el vuelo correspondiente.{0}
Touche « {0} » non prise en charge : essaie une lettre, un chiffre ou une touche F.	Key “{0}” not supported: try a letter, a digit or an F key.	Tecla «{0}» no compatible: prueba una letra, una cifra o una tecla F.
Toucher	Touchdown	Toma
Toucher : piste {0}, {1} ft après le seuil, {2} ft à {3}	Touchdown: runway {0}, {1} ft past the threshold, {2} ft {3}	Toma: pista {0}, {1} ft tras el umbral, {2} ft a la {3}
Toucher avec un facteur de charge ≤ 1,10 G.	Touch down with a load factor ≤ 1.10 G.	Tomar tierra con un factor de carga ≤ 1,10 G.
Toucher des roues	Touchdown	Toma de contacto
Toucher des roues :	Touchdown:	Toma de contacto:
Toucher le plus dur	Hardest touchdown	Toma más dura
Toucher moyen	Average touchdown	Toma media
Toucher moyen ici	Average touchdown here	Toma media aquí
Toucher à moins de 5 ft de l'axe de piste.	Touch down within 5 ft of the runway centreline.	Tomar tierra a menos de 5 ft del eje de pista.
Toucher à {0}	Touchdown at {0}	Toma a las {0}
Toucher à −{0} ft/min — personne n'avait parié cette fois.	Touchdown at −{0} ft/min — nobody had bet this time.	Toma a −{0} ft/min — nadie había apostado esta vez.
Toujours connecté	Always connected	Siempre conectado
Tour	Tour	Tour
Tour bouclé	Tour completed	Tour completado
Tour de France	Tour de France	Vuelta a Francia
Tour de piste	Traffic pattern	Circuito de tráfico
Tour du monde	Round the world	Vuelta al mundo
Tour sans nom	Untitled tour	Tour sin nombre
Tours en cours	Tours in progress	Tours en curso
Tours IVAO en cours	IVAO tours in progress	Tours de IVAO en curso
Tours terminés	Completed tours	Tours terminados
Tous	All	Todos
Tous les contrôleurs en ligne	All online controllers	Todos los controladores en línea
Tous les réseaux	All networks	Todas las redes
tout le contenu	all the contents	todo el contenido
Toutes les	Every	Cada
Toutes les cartes utilisent la couleur d'accent ci-dessus.	All cards use the accent colour above.	Todas las tarjetas usan el color de acento de arriba.
Toutes les données (logbook, carrières, thème) sont enregistrées automatiquement dans un fichier sur cet ordinateur :	All data (logbook, careers, theme) is saved automatically to a file on this computer:	Todos los datos (logbook, carreras, tema) se guardan automáticamente en un archivo de este ordenador:
Tracker lancé automatiquement	Tracker started automatically	Seguimiento iniciado automáticamente
Tracker non lancé	Tracker not running	Seguimiento no iniciado
Trackés	Tracked	Con seguimiento
Tracés des vols sur la carte	Flight tracks on the map	Trazados de los vuelos en el mapa
Trajectoire réelle (couleur = écart au plan de descente de 3° :	Actual path (colour = deviation from the 3° glide path:	Trayectoria real (color = desviación respecto a la senda de 3°:
Trajet	Route	Trayecto
Trajet complet (tracé sur la carte), phases et statistiques du vol inclus automatiquement dans le PIREP.	Full route (track on the map), phases and flight statistics included automatically in the PIREP.	Trayecto completo (trazado en el mapa), fases y estadísticas del vuelo incluidos automáticamente en el PIREP.
Trajet du vol	Flight route	Trayecto del vuelo
Trajet estimé	Estimated route	Trayecto estimado
Trajets de tous les vols enregistrés dans ton logbook, projetés sur un globe 3D. Glisse pour orienter, molette pour zoomer, survole un aéroport pour isoler ses trajets, clique dessus pour voir ses départs et arrivées, double-clic pour zoomer.	Routes of every flight in your logbook, projected on a 3D globe. Drag to rotate, scroll to zoom, hover an airport to isolate its routes, click it to see its departures and arrivals, double-click to zoom.	Trayectos de todos los vuelos de tu logbook proyectados en un globo 3D. Arrastra para orientar, rueda para hacer zoom, pasa sobre un aeropuerto para aislar sus trayectos, haz clic para ver sus salidas y llegadas, doble clic para hacer zoom.
Travers	Crosswind	Cruzado
Très gros porteurs	Very large widebodies	Aviones muy grandes
Tu es à jour (v{0}) ✓	You're up to date (v{0}) ✓	Estás al día (v{0}) ✓
Tu utilises actuellement la v{0}. La nouvelle version se télécharge depuis la page officielle de FlightBrief — tes données (logbook, carrières, hangar) sont conservées.	You're currently on v{0}. The new version downloads from FlightBrief's official page — your data (logbook, careers, hangar) is kept.	Usas actualmente la v{0}. La nueva versión se descarga desde la página oficial de FlightBrief — tus datos (logbook, carreras, hangar) se conservan.
Tu voles	You're flying	Estás volando
Tu voles mais le vol n'est pas suivi ! Clique pour lancer le tracker.	You're flying but the flight isn't tracked! Click to start the tracker.	¡Estás volando pero el vuelo no tiene seguimiento! Haz clic para iniciarlo.
Twitch a répondu HTTP	Twitch responded HTTP	Twitch respondió HTTP
Twitch injoignable (	Twitch unreachable (	Twitch inaccesible (
Twitch injoignable :	Twitch unreachable:	Twitch inaccesible:
Twitch ne connaît pas cet ID client. Vérifie le copier-coller depuis la console Twitch.	Twitch doesn't know this client ID. Check what you copied from the Twitch console.	Twitch no reconoce este ID de cliente. Comprueba lo que copiaste de la consola de Twitch.
Type	Type	Tipo
Type d'approche	Approach type	Tipo de aproximación
Type de client	Client type	Tipo de cliente
Type de vol	Flight type	Tipo de vuelo
Typographie	Typography	Tipografía
Téléchargement de la v{0}…	Downloading v{0}…	Descargando la v{0}…
Téléchargement…	Downloading…	Descargando…
Téléchargement… {0} %{1}	Downloading… {0}%{1}	Descargando… {0} %{1}
Télécharger depuis la page officielle	Download from the official page	Descargar desde la página oficial
Télécharger le certificat	Download the certificate	Descargar el certificado
Télémétrie	Telemetry	Telemetría
Ultra long-courrier	Ultra long-haul	Ultra largo radio
Un atterrissage de nuit.	A night landing.	Un aterrizaje nocturno.
Un atterrissage à moins de 100 ft/min.	A landing under 100 ft/min.	Un aterrizaje por debajo de 100 ft/min.
Un bot qui répond aux questions du chat sur ton vol (!eta, !metar…), des paris sur ton taux d'atterrissage, et une 3e source OBS qui affiche les alertes à l'écran.	A bot that answers chat questions about your flight (!eta, !metar…), bets on your landing rate, and a 3rd OBS source that shows alerts on screen.	Un bot que responde a las preguntas del chat sobre tu vuelo (!eta, !metar…), apuestas sobre tu tasa de aterrizaje y una 3.ª fuente OBS que muestra las alertas en pantalla.
Un mini-site statique (vols, carte, passagers, passeports, cartes postales) à publier sur GitHub Pages. Rien ne pointe vers ton PC : ce sont juste des fichiers. Les villes des viewers ne sont jamais publiées, et un viewer peut se retirer avec	A small static site (flights, map, passengers, passports, postcards) to publish on GitHub Pages. Nothing points to your PC: it's just files. Viewers' cities are never published, and a viewer can opt out with	Un minisitio estático (vuelos, mapa, pasajeros, pasaportes, postales) para publicar en GitHub Pages. Nada apunta a tu PC: son solo archivos. Las ciudades de los viewers nunca se publican y un viewer puede retirarse con
Un nouveau lien a été généré sur ton PC. Rescanne le QR code affiché dans	A new link was generated on your PC. Rescan the QR code shown in	Se generó un nuevo enlace en tu PC. Vuelve a escanear el código QR que aparece en
Un point par seconde sous 2 500 ft.	One point per second below 2,500 ft.	Un punto por segundo por debajo de 2500 ft.
Un premier pari d'atterrissage terminé.	A first landing bet completed.	Una primera apuesta de aterrizaje completada.
Un premier vol sur IVAO (réseau du logbook).	A first flight on IVAO (logbook network).	Un primer vuelo en IVAO (red del logbook).
Un premier vol sur VATSIM (réseau du logbook).	A first flight on VATSIM (logbook network).	Un primer vuelo en VATSIM (red del logbook).
Un quiz toutes les	A quiz every	Un quiz cada
Un tour rapide de l'application pour te repérer. Tu peux passer à tout moment, et la relancer plus tard depuis l'onglet Profil.	A quick tour of the app to find your way around. You can skip at any time and replay it later from the Profile tab.	Una visita rápida por la aplicación para orientarte. Puedes saltarla en cualquier momento y repetirla después desde la pestaña Perfil.
Un vol de moins de 20 minutes.	A flight under 20 minutes.	Un vuelo de menos de 20 minutos.
Un vol de plus de 14 heures.	A flight over 14 hours.	Un vuelo de más de 14 horas.
Un vol de plus de 8 heures.	A flight over 8 hours.	Un vuelo de más de 8 horas.
Un vol en avion léger du hangar.	A flight in a light aircraft from the hangar.	Un vuelo en un avión ligero del hangar.
Un vol en avion « heavy » ou « jumbo » du hangar.	A flight in a “heavy” or “jumbo” aircraft from the hangar.	Un vuelo en un avión «heavy» o «jumbo» del hangar.
Une 3e source navigateur, transparente, qui affiche la carte d'atterrissage, les paris, les succès débloqués et les réponses du bot. Place-la où tu veux sur ta scène (1920 × 1080 conseillé).	A 3rd, transparent browser source that shows the landing card, bets, unlocked achievements and bot replies. Place it anywhere in your scene (1920 × 1080 recommended).	Una 3.ª fuente de navegador, transparente, que muestra la tarjeta de aterrizaje, las apuestas, los logros desbloqueados y las respuestas del bot. Colócala donde quieras en tu escena (1920 × 1080 recomendado).
Une copie de tes données est faite chaque jour où tu utilises FlightBrief. Les	A copy of your data is made every day you use FlightBrief. The	Se hace una copia de tus datos cada día que usas FlightBrief. Se conservan las
Une couleur par type d'événement	One colour per event type	Un color por tipo de evento
Une note d'atterrissage A+.	An A+ landing grade.	Una nota de aterrizaje A+.
Une page Twitch s'est ouverte : connecte-toi avec	A Twitch page has opened: log in with	Se ha abierto una página de Twitch: inicia sesión con
Une page Twitch vient de s'ouvrir. Connecte-toi avec le compte qui doit parler (le tien ou celui du bot), puis saisis ce code :	A Twitch page just opened. Log in with the account that should talk (yours or the bot's), then enter this code:	Se acaba de abrir una página de Twitch. Inicia sesión con la cuenta que debe hablar (la tuya o la del bot) e introduce este código:
Une première capture d'écran.	A first screenshot.	Una primera captura de pantalla.
Unité	Unit	Unidad
URL de redirection OAuth	OAuth Redirect URL	URL de redirección OAuth
Utilisée sur la carte de suivi du Briefing et sur le compagnon mobile (après une synchro).	Used on the Briefing tracking map and on the mobile companion (after a sync).	Se usa en el mapa de seguimiento del Briefing y en la app móvil (tras una sincronización).
Valeur	Value	Valor
Valeur convertie	Converted value	Valor convertido
Valeur exacte mesurée par le simulateur à l'impact	Exact value measured by the simulator at impact	Valor exacto medido por el simulador en el impacto
Valeurs en majuscules	Uppercase values	Valores en mayúsculas
Valeurs par défaut	Defaults	Valores por defecto
Valeurs par défaut rétablies — clique sur Enregistrer pour les appliquer.	Defaults restored — click Save to apply them.	Valores por defecto restablecidos — haz clic en Guardar para aplicarlos.
Valide du {0} au {1}	Valid from {0} to {1}	Válido del {0} al {1}
Valider	Confirm	Validar
Validé	Confirmed	Validado
Variables :	Variables:	Variables:
VATSIM, IVAO, Solo…	VATSIM, IVAO, Solo…	VATSIM, IVAO, Solo…
Vent	Wind	Viento
Vent arrière	Downwind	Viento en cola
Vent au toucher	Wind at touchdown	Viento en la toma
Vent au toucher : {0}°/{1} kt{2}	Wind at touchdown: {0}°/{1} kt{2}	Viento en la toma: {0}°/{1} kt{2}
Vent de travers	Crosswind leg	Tramo de viento cruzado
Vent traversier	Crosswind	Viento cruzado
Verre	Glass	Vidrio
Verrouillé — en attente du toucher	Locked — waiting for touchdown	Bloqueado — esperando la toma
Victoires / paris joués.	Wins / bets played.	Victorias / apuestas jugadas.
Virage max	Max turn	Viraje máx.
virage(s) engagé(s) >	steep turn(s) >	viraje(s) pronunciado(s) >
virage(s) serré(s))	tight turn(s))	viraje(s) cerrado(s))
Virages effectués	Turns made	Virajes realizados
Virages engagés (>45°)	Steep turns (>45°)	Virajes pronunciados (>45°)
Virages serrés (>30°)	Tight turns (>30°)	Virajes cerrados (>30°)
Visibilité	Visibility	Visibilidad
Visite guidée	Guided tour	Visita guiada
Vitesse	Speed	Velocidad
Vitesse (IAS)	Speed (IAS)	Velocidad (IAS)
Vitesse IAS (max {0} kt)	IAS (max {0} kt)	Velocidad IAS (máx. {0} kt)
Vitesse indiquée — IAS (kt)	Indicated airspeed — IAS (kt)	Velocidad indicada — IAS (kt)
Vitesse max	Max speed	Velocidad máx.
Vitesse max (IAS)	Max speed (IAS)	Velocidad máx. (IAS)
Vitesse max : {0} kt	Max speed: {0} kt	Velocidad máx.: {0} kt
Vitesse sol	Ground speed	Velocidad suelo
Vitesse sol (kt)	Ground speed (kt)	Velocidad respecto al suelo (kt)
Vitesse sol en descente (kt)	Ground speed in descent (kt)	Velocidad respecto al suelo en descenso (kt)
Vitesse sol nécessaire :	Required ground speed:	Velocidad respecto al suelo necesaria:
Voir le détail du tour	See tour details	Ver el detalle del tour
Voir tous les succès	See all achievements	Ver todos los logros
Voir tout le vol : départ, arrivée et avion (touche V)	See the whole flight: departure, arrival and aircraft (V key)	Ver todo el vuelo: salida, llegada y avión (tecla V)
Vol	Flight	Vuelo
Vol arrêté et PIREP envoyé dans le logbook (tous les champs complétés) ✓	Flight stopped and PIREP filed to the logbook (all fields completed) ✓	Vuelo detenido y PIREP enviado al logbook (todos los campos completados) ✓
Vol au départ	Departing flight	Vuelo en salida
Vol en cours	Flight in progress	Vuelo en curso
Vol en cours de suivi via le simulateur : une fois atterri, envoie le PIREP directement depuis le rapport de vol tracké ci-dessous (un seul envoi, trajet inclus).	Flight being tracked through the simulator: once landed, file the PIREP directly from the tracked flight report below (single submission, route included).	Vuelo con seguimiento desde el simulador: una vez aterrizado, envía el PIREP directamente desde el informe de vuelo de abajo (un solo envío, trayecto incluido).
Vol en cours de suivi — les phases et le rapport détaillé se complètent ci-dessous au fil du vol.	Flight being tracked — the phases and detailed report fill in below as the flight goes on.	Vuelo con seguimiento — las fases y el informe detallado se completan abajo a lo largo del vuelo.
Vol en cours de tracking…	Flight being tracked…	Vuelo con seguimiento…
Vol en cours — {0} écoulées, {1} NM parcourues.	Flight in progress — {0} elapsed, {1} NM flown.	Vuelo en curso — {0} transcurridos, {1} NM recorridas.
Vol en cours{0}	Flight in progress{0}	Vuelo en curso{0}
Vol enregistré avant la v1.5 : un point toutes les 5 s, trajectoire lissée.	Flight logged before v1.5: one point every 5 s, smoothed path.	Vuelo registrado antes de la v1.5: un punto cada 5 s, trayectoria suavizada.
Vol entier	Whole flight	Vuelo completo
vol entier ·	whole flight ·	vuelo completo ·
Vol interrompu : les miles gagnés sont conservés, mais pas de tampon cette fois.	Flight interrupted: miles earned are kept, but no stamp this time.	Vuelo interrumpido: se conservan las millas ganadas, pero esta vez no hay sello.
Vol le plus long	Longest flight	Vuelo más largo
Vol terminé	Flight completed	Vuelo terminado
Vol terminé — {0}, {1} NM parcourues.	Flight completed — {0}, {1} NM flown.	Vuelo terminado — {0}, {1} NM recorridas.
Vol tracké automatiquement —	Flight tracked automatically —	Vuelo con seguimiento automático —
Vol tracké terminé	Tracked flight completed	Vuelo con seguimiento terminado
Vol trop court pour être enregistré (moins de 2 minutes en l'air).	Flight too short to be logged (less than 2 minutes airborne).	Vuelo demasiado corto para registrarse (menos de 2 minutos en el aire).
Voler 7 jours d'affilée.	Fly 7 days in a row.	Volar 7 días seguidos.
Vols	Flights	Vuelos
Vols ({0})	Flights ({0})	Vuelos ({0})
Vols enregistrés	Logged flights	Vuelos registrados
Vols sans avion associé	Flights without a linked aircraft	Vuelos sin avión asociado
Vols trackés	Tracked flights	Vuelos con seguimiento
Volume	Volume	Volumen
Volume de l'alerte	Alert volume	Volumen de la alerta
Vue de 3/4	3/4 view	Vista 3/4
Vue de dessus	Top view	Vista superior
Vue de profil	Side view	Vista de perfil
Vue du ciel	Sky view	Vista del cielo
Vue du hublot	Window view	Vista desde la ventanilla
v{0} prête. FlightBrief va se fermer, s'installer puis se relancer tout seul (tes données sont conservées).	v{0} ready. FlightBrief will close, install and restart on its own (your data is kept).	v{0} lista. FlightBrief se cerrará, se instalará y se volverá a abrir solo (tus datos se conservan).
Vérification auprès de Twitch…	Checking with Twitch…	Comprobando con Twitch…
Vérification impossible (hors ligne ?).	Couldn't check (offline?).	No se pudo comprobar (¿sin conexión?).
Vérification…	Checking…	Comprobando…
Vérifier	Check	Comprobar
Vérifier la connexion sécurisée	Check the secure connection	Comprobar la conexión segura
Vérifier les mises à jour	Check for updates	Buscar actualizaciones
{0} ({1}e vol d'affilée)	{0} (flight #{1} in a row)	{0} ({1}.º vuelo seguido)
{0} : {1} L'ancien raccourci est conservé.	{0}: {1} The previous shortcut is kept.	{0}: {1} Se conserva el atajo anterior.
{0} départ{1}/arrivée{2} · {3} destination{4}	{0} departure{1}/arrival{2} · {3} destination{4}	{0} salida{1}/llegada{2} · {3} destino{4}
{0} ft après le seuil · {1} ft à {2}	{0} ft past the threshold · {1} ft {2}	{0} ft tras el umbral · {1} ft a la {2}
{0} injoignable ({1})	{0} unreachable ({1})	{0} inaccesible ({1})
{0} Nouveau pays sous nos ailes : {1} !	{0} New country beneath our wings: {1}!	{0} ¡Nuevo país bajo nuestras alas: {1}!
{0} passager{1} à bord	{0} passenger{1} on board	{0} pasajero{1} a bordo
{0} pronostic{1} — verdict au toucher	{0} prediction{1} — verdict at touchdown	{0} pronóstico{1} — veredicto en la toma
{0} rebond{1} au toucher	{0} bounce{1} at touchdown	{0} rebote{1} en la toma
{0} sans suivi	{0} untracked	{0} sin seguimiento
{0} vol{1} associé{2} automatiquement par mot-clé.	{0} flight{1} linked automatically by keyword.	{0} vuelo{1} asociado{2} automáticamente por palabra clave.
{0} vol{1} du logbook ne sont associés à aucun avion du hangar.	{0} logbook flight{1} not linked to any hangar aircraft.	{0} vuelo{1} del logbook sin asociar a ningún avión del hangar.
{0} vol{1} · {2} NM	{0} flight{1} · {2} NM	{0} vuelo{1} · {2} NM
{0} vol{1} · {2} trajet{3} distinct{4} · {5} aéroport{6}. Double-clic sur un aéroport pour zoomer dessus.	{0} flight{1} · {2} distinct route{3} · {5} airport{6}. Double-click an airport to zoom in on it.	{0} vuelo{1} · {2} trayecto{3} distinto{4} · {5} aeropuerto{6}. Doble clic en un aeropuerto para acercarte.
{0} XP avant « {1} »	{0} XP before “{1}”	{0} XP para «{1}»
{0} {1} passe au statut {2} ! ({3} miles)	{0} {1} reaches {2} status! ({3} miles)	¡{0} {1} sube al estatus {2}! ({3} millas)
{0} {1} · coucou en bas 👋	{0} {1} · hello down there 👋	{0} {1} · hola ahí abajo 👋
{0} {1} · {2} · {3} miles · {4} vol{5}{6}{7}	{0} {1} · {2} · {3} miles · {4} flight{5}{6}{7}	{0} {1} · {2} · {3} millas · {4} vuelo{5}{6}{7}
{0} étape{1} validée{2} sans vol correspondant dans le logbook (même OACI de départ et d'arrivée) : temps de vol et atterrissage incomplets.	{0} completed leg{1} without a matching logbook flight (same departure and arrival ICAO): flight time and landing incomplete.	{0} etapa{1} validada{2} sin vuelo correspondiente en el logbook (mismos OACI de salida y llegada): tiempo de vuelo y aterrizaje incompletos.
« Add file » → « Upload files » : glisse	“Add file” → “Upload files”: drag	«Add file» → «Upload files»: arrastra
· !voyage · !passagers · en croisière : !rep	· !trip · !passengers · in cruise: !answer	· !viaje · !pasajeros · en crucero: !resp
· catégorie	· category	· categoría
· Correspondance validée pour	· Connection confirmed for	· Conexión validada para
· début de descente dans {0}	· top of descent in {0}	· inicio del descenso en {0}
· encore {0} pour {1}	· {0} more to {1}	· faltan {0} para {1}
· Notes de briefing :	· Briefing notes:	· Notas del briefing:
· prochain rang : {0} à {1} XP	· next rank: {0} at {1} XP	· próximo rango: {0} a {1} XP
· site statique, aucune donnée collectée.	· static site, no data collected.	· sitio estático, no se recopila ningún dato.
· tour terminé	· tour completed	· tour terminado
· {0} du classement	· {0} in the ranking	· {0} de la clasificación
À bord	On board	A bordo
à bord	on board	a bordo
À bord (embarquement, survols, hublot, quiz…)	On board (boarding, flyovers, window, quiz…)	A bordo (embarque, sobrevuelos, ventanilla, quiz…)
À bord :	On board:	A bordo:
À bord : !embarquer · !miles · !passeport · !maville	On board: !board · !miles · !passport · !mycity	A bordo: !embarcar · !millas · !pasaporte · !miciudad
À bord — Ctrl+0	On board — Ctrl+0	A bordo — Ctrl+0
À classer	To sort	Por clasificar
À classer (bouton Modifier)	To sort (Edit button)	Por clasificar (botón Editar)
À combien de milles nautiques (NM) sommes-nous de {0} ? Le plus proche gagne.	How many nautical miles (NM) are we from {0}? Closest guess wins.	¿A cuántas millas náuticas (NM) estamos de {0}? Gana el más cercano.
à droite	right	a la derecha
À faire	To do	Pendiente
à gauche	left	a la izquierda
À jour ·	Up to date ·	Actualizado ·
À l'atterrissage	At landing	Al aterrizar
à l'instant	just now	ahora mismo
À propos	About	Acerca de
À quelle altitude volons-nous (en pieds) ? Le plus proche gagne.	What altitude are we flying at (in feet)? Closest guess wins.	¿A qué altitud volamos (en pies)? Gana el más cercano.
À quelle heure on touche{0} ?	What time do we touch down{0}?	¿A qué hora tomamos tierra{0}?
à {0} km {1}	{0} km {1}	a {0} km {1}
Écart latéral	Lateral offset	Desviación lateral
Écart à l'axe	Centreline offset	Desviación del eje
Échec de l'import (	Import failed (	Error de importación (
Échec de la récupération (connexion indisponible ou service injoignable).	Fetch failed (no connection or service unreachable).	Error al obtener los datos (sin conexión o servicio inaccesible).
Échec du téléchargement ({0}). Réessaie, ou passe par la page officielle.	Download failed ({0}). Try again, or use the official page.	Error de descarga ({0}). Vuelve a intentarlo o usa la página oficial.
Échelle	Scale	Escala
Écoulé	Elapsed	Transcurrido
Écran principal	Main screen	Pantalla principal
Éditeur	Editor	Editor
Éloignement (cap réciproque) : {0}°	Outbound (reciprocal heading): {0}°	Alejamiento (rumbo recíproco): {0}°
Élève pilote	Student pilot	Alumno piloto
Épaisseur de la bordure	Border thickness	Grosor del borde
Étape	Leg	Etapa
Étape 1/7	Step 1/7	Paso 1/7
Étape {0} → {1} — valide aussi les étapes précédentes	Leg {0} → {1} — also completes the previous legs	Etapa {0} → {1} — valida también las etapas anteriores
Étape {0}/{1}	Step {0}/{1}	Paso {0}/{1}
Étapes	Legs	Etapas
étapes	legs	etapas
Étapes & vols associés du logbook	Legs & linked logbook flights	Etapas y vuelos asociados del logbook
Étapes & vols du logbook	Legs & logbook flights	Etapas y vuelos del logbook
— au fix, prends le cap	— at the fix, take heading	— en el fijo, toma el rumbo
— clique sur une étape pour la valider ou revenir en arrière	— click a leg to complete it or go back	— haz clic en una etapa para validarla o volver atrás
— survole le fix et vire {0} directement pour rejoindre l'éloignement ({1}°).	— fly over the fix and turn {0} directly to join the outbound leg ({1}°).	— sobrevuela el fijo y vira {0} directamente para unirte al alejamiento ({1}°).
— à faire une seule fois. Il est limité à FlightBrief sur ton réseau local.	— only once. It's limited to FlightBrief on your local network.	— solo una vez. Se limita a FlightBrief en tu red local.
… {0} autres, affine le filtre.	… {0} more, refine the filter.	… {0} más, afina el filtro.
← Tous les passagers	← All passengers	← Todos los pasajeros
→ Save. Le site est en ligne à	→ Save. The site is live at	→ Save. El sitio está en línea en
⏱️ Devine l'heure d'arrivée :	⏱️ Guess the arrival time:	⏱️ Adivina la hora de llegada:
⏱️ Deviner l'heure d'arrivée (	⏱️ Guess the arrival time (	⏱️ Adivinar la hora de llegada (
⏱️ Heure d'arrivée : {0} pronostic{1}{2}	⏱️ Arrival time: {0} prediction{1}{2}	⏱️ Hora de llegada: {0} pronóstico{1}{2}
⏱️ Pronostics d'arrivée fermés ({0}). Verdict au toucher des roues !	⏱️ Arrival predictions closed ({0}). Verdict at touchdown!	⏱️ Pronósticos de llegada cerrados ({0}). ¡Veredicto en la toma!
⏱️ Toucher à {0} ! Bravo {1} ({2}{3}) +{4} miles	⏱️ Touchdown at {0}! Well done {1} ({2}{3}) +{4} miles	⏱️ ¡Toma a las {0}! Bravo {1} ({2}{3}) +{4} millas
⏱️ À quelle heure va-t-on toucher la piste{0} ? Pronostique jusqu'au début de la descente : !arrivee 21:47 (+{1} miles au plus proche)	⏱️ What time will we touch down{0}? Predict until top of descent: !arrival 21:47 (+{1} miles to the closest)	⏱️ ¿A qué hora tomaremos tierra{0}? Pronostica hasta el inicio del descenso: !llegada 21:47 (+{1} millas al más cercano)
▶ Écouter	▶ Listen	▶ Escuchar
▶ Écouter l'alerte	▶ Play the alert	▶ Escuchar la alerta
▶ Écouter le son	▶ Play the sound	▶ Escuchar el sonido
⚙ Seuils de toucher	⚙ Touchdown thresholds	⚙ Umbrales de toma
⚙ Seuils de toucher par catégorie	⚙ Touchdown thresholds by category	⚙ Umbrales de toma por categoría
⚠ Cet OFP ({0} → {1}) ne correspond pas au briefing en cours ({2} → {3}).	⚠ This OFP ({0} → {1}) doesn't match the current briefing ({2} → {3}).	⚠ Este OFP ({0} → {1}) no coincide con el briefing actual ({2} → {3}).
⚠️ Aucun aéroport placé sur le globe : {0}	⚠️ No airports placed on the globe: {0}	⚠️ Ningún aeropuerto situado en el globo: {0}
⚠️ Vol interrompu (crash/fermeture en plein trajet) — récupération partielle, certaines données (atterrissage, carburant) manquent. Vérifie avant d'envoyer.	⚠️ Flight interrupted (crash/closed mid-flight) — partial recovery, some data (landing, fuel) is missing. Check before filing.	⚠️ Vuelo interrumpido (fallo/cierre en pleno trayecto) — recuperación parcial, faltan algunos datos (aterrizaje, combustible). Revisa antes de enviar.
⚠️ Vol récupéré après une fermeture inattendue — vérifie les infos puis envoie le PIREP (ou ignore-le ci-dessous).	⚠️ Flight recovered after an unexpected shutdown — check the details then file the PIREP (or ignore it below).	⚠️ Vuelo recuperado tras un cierre inesperado — revisa los datos y envía el PIREP (o ignóralo abajo).
✈️ Icône de l'avion sur les cartes	✈️ Aircraft icon on maps	✈️ Icono del avión en los mapas
✈️ {indicatif} · {depart} → {arrivee} · {avion} | !embarquer pour monter à bord	✈️ {indicatif} · {depart} → {arrivee} · {avion} | !board to come aboard	✈️ {indicatif} · {depart} → {arrivee} · {avion} | !embarcar para subir a bordo
✓ Certificat reconnu. Le nom	✓ Certificate recognised. The name	✓ Certificado reconocido. El nombre
✓ Connexion sécurisée établie avec ton PC (	✓ Secure connection established with your PC (	✓ Conexión segura establecida con tu PC (
✓ Déjà faite	✓ Already done	✓ Ya hecho
✓ Terminé le {0}	✓ Completed on {0}	✓ Terminado el {0}
✓ Tour terminé — rangé dans « Tours terminés »	✓ Tour completed — moved to “Completed tours”	✓ Tour terminado — guardado en «Tours terminados»
＋ Ajouter des images	＋ Add images	＋ Añadir imágenes
＋ Ajouter un avion	＋ Add an aircraft	＋ Añadir un avión
🎨 Design des alertes	🎨 Alerts design	🎨 Diseño de las alertas
🎫 Bienvenue à bord {0} ! ({1} passager{2})	🎫 Welcome aboard {0}! ({1} passenger{2})	🎫 ¡Bienvenidos a bordo {0}! ({1} pasajero{2})
🎯 Toucher à −142 ft/min ! Bravo Viewer42 (150, à 8 près) sur 12 pronostics.	🎯 Touchdown at −142 ft/min! Well done Viewer42 (150, 8 off) out of 12 predictions.	🎯 ¡Toma a −142 ft/min! Bravo Viewer42 (150, a 8) de 12 pronósticos.
🎯 Toucher à −{0} ft/min ! Bravo {1} ({2}, à {3} près) sur {4} pronostic{5}.	🎯 Touchdown at −{0} ft/min! Well done {1} ({2}, {3} off) out of {4} prediction{5}.	🎯 ¡Toma a −{0} ft/min! Bravo {1} ({2}, a {3}) de {4} pronóstico{5}.
🏠 On survole chez {0} ({1}) ! {2}	🏠 Flying over {0}'s place ({1})! {2}	🏠 ¡Sobrevolamos la casa de {0} ({1})! {2}
🏠 Survol de chez les viewers (	🏠 Flying over viewers' homes (	🏠 Sobrevuelo de casas de viewers (
🏠 Survols prévus sur la route	🏠 Flyovers planned on the route	🏠 Sobrevuelos previstos en la ruta
👀 Dans ~{0} min on passe au-dessus de chez {1} ({2}). Prépare-toi à faire coucou !	👀 In ~{0} min we fly over {1}'s place ({2}). Get ready to wave!	👀 En ~{0} min pasamos sobre la casa de {1} ({2}). ¡Prepárate para saludar!
👥 {0} passager{1} à bord : {2}{3}	👥 {0} passenger{1} on board: {2}{3}	👥 {0} pasajero{1} a bordo: {2}{3}
📄 Récupérer l'OFP du plan de vol actif	📄 Fetch the active flight plan's OFP	📄 Obtener el OFP del plan de vuelo activo
📍 {0} ({1}) — visible seulement dans l'appli, jamais publiée.	📍 {0} ({1}) — visible only in the app, never published.	📍 {0} ({1}) — visible solo en la app, nunca se publica.
📍 {0} habite près de {1} {2}. On te fera coucou en passant au-dessus !	📍 {0} lives near {1} {2}. We'll wave when we fly over!	📍 {0} vive cerca de {1} {2}. ¡Te saludaremos al pasar por encima!
📝 Proposer un titre maintenant	📝 Suggest a title now	📝 Proponer un título ahora
📝 Titre du stream	📝 Stream title	📝 Título del stream
📝 Voir les nouveautés	📝 See what's new	📝 Ver las novedades
📷 Capture d'écran	📷 Screenshot	📷 Captura de pantalla
📷 Captures d'écran des vols	📷 Flight screenshots	📷 Capturas de pantalla de los vuelos
📷 Réglages des captures d'écran	📷 Screenshot settings	📷 Ajustes de capturas de pantalla
🔒 Paris fermés — {0} pronostic{1}. Réponse au toucher des roues !	🔒 Bets closed — {0} prediction{1}. Answer at touchdown!	🔒 Apuestas cerradas — {0} pronóstico{1}. ¡Respuesta en la toma!
🔔 Rappel « tracker non lancé »	🔔 “Tracker not running” reminder	🔔 Recordatorio «seguimiento no iniciado»
🔗 Assortir à mon overlay live	🔗 Match my live overlay	🔗 A juego con mi overlay en directo
🗺️ Annoncer les survols prévus au décollage	🗺️ Announce planned flyovers at takeoff	🗺️ Anunciar los sobrevuelos previstos al despegar
🗺️ Au programme de ce vol : on survolera chez {0}. Ouvrez l'œil !	🗺️ On this flight we'll fly over: {0}. Keep your eyes peeled!	🗺️ En este vuelo sobrevolaremos la casa de {0}. ¡Atentos!
🙈 Masqué du carnet public (à sa demande).	🙈 Hidden from the public logbook (at their request).	🙈 Oculto en el diario público (a petición suya).
🛂 Passeport de {0} : {1} aéroport{2} ({3}{4}) · {5} pays {6}{7}	🛂 {0}'s passport: {1} airport{2} ({3}{4}) · {5} countries {6}{7}	🛂 Pasaporte de {0}: {1} aeropuerto{2} ({3}{4}) · {5} países {6}{7}
🛫 Départs ({0})	🛫 Departures ({0})	🛫 Salidas ({0})
🛫 Embarquement ouvert pour le vol{0}{1} ! Tape !embarquer pour monter à bord et gagner des miles.	🛫 Boarding open for flight{0}{1}! Type !board to come aboard and earn miles.	🛫 ¡Embarque abierto para el vuelo{0}{1}! Escribe !embarcar para subir a bordo y ganar millas.
🛬 Arrivées ({0})	🛬 Arrivals ({0})	🛬 Llegadas ({0})
🛬 Bienvenue à {0} ! {1} passager{2} reçoi{3} le tampon {4} dans leur passeport (+{5} miles).{6} Plus gros cumul : {7} ({8} miles).	🛬 Welcome to {0}! {1} passenger{2} get the {4} stamp in their passport (+{5} miles).{6} Top earner: {7} ({8} miles).	🛬 ¡Bienvenidos a {0}! {1} pasajero{2} reciben el sello {4} en su pasaporte (+{5} millas).{6} Mayor acumulado: {7} ({8} millas).
🛬 Les paris d'atterrissage sont ouverts ! Devine le taux de toucher en ft/min : !pari 180	🛬 Landing bets are open! Guess the touchdown rate in ft/min: !bet 180	🛬 ¡Las apuestas de aterrizaje están abiertas! Adivina la tasa de toma en ft/min: !apuesta 180
🛬 Posé {0}	🛬 Landed {0}	🛬 Aterrizado {0}
🧭 Quiz du hublot (	🧭 Window quiz (	🧭 Quiz de la ventanilla (
🧭 Quiz du hublot (+{0} miles) : {1} — réponds avec !rep … ({2} s)	🧭 Window quiz (+{0} miles): {1} — answer with !answer … ({2} s)	🧭 Quiz de la ventanilla (+{0} millas): {1} — responde con !resp … ({2} s)
🧭 Quiz du hublot · +50 miles	🧭 Window quiz · +50 miles	🧭 Quiz de la ventanilla · +50 millas
🧭 Quiz en cours : {0}	🧭 Quiz in progress: {0}	🧭 Quiz en curso: {0}
🧳 Voyage de {0} : {1} ({2} vol{3}{4}) · record : {5} vol{6} d'affilée	🧳 {0}'s trip: {1} ({2} flight{3}{4}) · record: {5} flight{6} in a row	🧳 Viaje de {0}: {1} ({2} vuelo{3}{4}) · récord: {5} vuelo{6} seguidos
🪟 Vue du hublot (ville et pays survolés)	🪟 Window view (cities and countries flown over)	🪟 Vista desde la ventanilla (ciudades y países sobrevolados)
🪟 Vue du hublot : pas une ville à l'horizon, juste {0} · {1} · {2} kt sol	🪟 Window view: not a city in sight, just {0} · {1} · {2} kt ground	🪟 Vista desde la ventanilla: ni una ciudad a la vista, solo {0} · {1} · {2} kt suelo
🪟 Vue du hublot : {0} {1} {2} · {3} · {4} kt sol	🪟 Window view: {0} {1} {2} · {3} · {4} kt ground	🪟 Vista desde la ventanilla: {0} {1} {2} · {3} · {4} kt suelo
Déclare d'abord ton application Twitch (onglet Twitch)	Register your Twitch application first (Twitch tab)	Registra primero tu aplicación de Twitch (pestaña Twitch)
{0} viewer{1} donné sa ville ; aucun sous la route prévue de ce vol.	{0} viewer{1} shared a city; none under this flight's planned route.	{0} viewer{1} dado su ciudad; ninguno bajo la ruta prevista de este vuelo.
Alt.	Alt.	Alt.
Aucun pronostic.	No predictions.	Ningún pronóstico.
Aucun vol.	No flights.	Ningún vuelo.
Connexion impossible.	Couldn't connect.	No se pudo conectar.
Conso. moyenne	Avg. fuel burn	Consumo medio
Copie impossible.	Couldn't copy.	No se pudo copiar.
Dossier invalide.	Invalid folder.	Carpeta no válida.
IAS moy.	Avg. IAS	IAS media
Image invalide.	Invalid image.	Imagen no válida.
Passeport introuvable.	Passport not found.	Pasaporte no encontrado.
Raccourci invalide.	Invalid shortcut.	Atajo no válido.
Renseigne l'IAS.	Enter the IAS.	Indica la IAS.
Restauration impossible.	Couldn't restore.	No se pudo restaurar.
Sauvegarde impossible.	Couldn't save.	No se pudo guardar.
Sauvegarde introuvable.	Backup not found.	Copia no encontrada.
Suppr.	Del.	Supr.
Toucher moy.	Avg. touchdown	Toma media
Vit. sol	Ground spd	Vel. suelo
avant l'altitude cible.	before the target altitude.	antes de la altitud objetivo.
overlay Alertes.	Alerts overlay.	overlay de Alertas.
Étapes (une par ligne, format : OACI départ;OACI arrivée)	Legs (one per line, format: departure ICAO;arrival ICAO)	Etapas (una por línea, formato: OACI salida;OACI llegada)
https://ton-compte.github.io/carnet	https://your-account.github.io/logbook	https://tu-cuenta.github.io/diario
carnet	logbook	diario
{0} / {1} succès	{0} / {1} achievements	{0} / {1} logros
{0} · {1} (niveau {2}, {3} XP) — Ctrl+8	{0} · {1} (level {2}, {3} XP) — Ctrl+8	{0} · {1} (nivel {2}, {3} XP) — Ctrl+8
· Piste {0}	· Runway {0}	· Pista {0}
{0} · {1}/100	{0} · {1}/100	{0} · {1}/100
droite	right	derecha
gauche	left	izquierda
FlightBrief — Alertes	FlightBrief — Alerts	FlightBrief — Alertas
FlightBrief — Overlay Live	FlightBrief — Live overlay	FlightBrief — Overlay en directo
· piste {0}	· runway {0}	· pista {0}
Atterrissage · {0} · piste {1}	Landing · {0} · runway {1}	Aterrizaje · {0} · pista {1}
Atterrissage · {0}	Landing · {0}	Aterrizaje · {0}
Prédiction Twitch (points de chaîne)	Twitch prediction (channel points)	Predicción de Twitch (puntos de canal)
Les viewers misent leurs points de chaîne sur une tranche de taux de toucher, dans l'interface de Twitch : ouverte et fermée avec les paris, résultat au toucher, remboursée si le vol est interrompu. Demande une chaîne Affiliée ou Partenaire et le compte de ta chaîne connecté (onglet À bord) : Twitch n'autorise que le compte de la chaîne à lancer une prédiction, pas un compte modérateur comme le bot.	Viewers bet their channel points on a touchdown-rate range, in Twitch's own interface: opened and closed with the bets, resolved at touchdown, refunded if the flight is interrupted. Requires an Affiliate or Partner channel and your channel account connected (On board tab): Twitch only lets the channel account start a prediction, not a moderator account like the bot.	Los viewers apuestan sus puntos de canal a un rango de tasa de toma, en la interfaz de Twitch: se abre y se cierra con las apuestas, se resuelve en la toma y se reembolsa si el vuelo se interrumpe. Requiere un canal Afiliado o Partner y la cuenta de tu canal conectada (pestaña A bordo): Twitch solo permite que la cuenta del canal lance una predicción, no una cuenta de moderador como el bot.
Prédiction en cours sur Twitch	Prediction running on Twitch	Predicción en curso en Twitch
Prédiction verrouillée — en attente du toucher	Prediction locked — waiting for touchdown	Predicción bloqueada — esperando la toma
Prédiction terminée ✓	Prediction completed ✓	Predicción terminada ✓
Prédiction annulée (points remboursés)	Prediction cancelled (points refunded)	Predicción cancelada (puntos reembolsados)
Prête : s'ouvrira avec les paris d'atterrissage	Ready: will open with the landing bets	Lista: se abrirá con las apuestas de aterrizaje
Taux de toucher (ft/min) ?	Touchdown rate (ft/min)?	¿Tasa de toma (ft/min)?
🧈 Beurre (< 100)	🧈 Butter (< 100)	🧈 Mantequilla (< 100)
👌 Doux (100-199)	👌 Soft (100-199)	👌 Suave (100-199)
✈️ Ferme (200-349)	✈️ Firm (200-349)	✈️ Firme (200-349)
😬 Dur (350-599)	😬 Hard (350-599)	😬 Duro (350-599)
💥 Boum (600+)	💥 Boom (600+)	💥 Bum (600+)
Prédiction Twitch ouverte	Twitch prediction opened	Predicción de Twitch abierta
Prédiction Twitch : {0}	Twitch prediction: {0}	Predicción de Twitch: {0}
Prédiction : {0}	Prediction: {0}	Predicción: {0}
Connecte le compte de ta chaîne (onglet À bord) pour lancer des prédictions.	Connect your channel account (On board tab) to run predictions.	Conecta la cuenta de tu canal (pestaña A bordo) para lanzar predicciones.
Reconnecte le compte de ta chaîne (onglet À bord) pour autoriser les prédictions.	Reconnect your channel account (On board tab) to allow predictions.	Vuelve a conectar la cuenta de tu canal (pestaña A bordo) para autorizar las predicciones.
Twitch refuse : les prédictions demandent une chaîne Affiliée ou Partenaire.	Twitch refused: predictions require an Affiliate or Partner channel.	Twitch lo rechaza: las predicciones requieren un canal Afiliado o Partner.
Réponse Twitch inattendue.	Unexpected Twitch response.	Respuesta inesperada de Twitch.
Twitch a répondu HTTP {0}	Twitch responded HTTP {0}	Twitch respondió HTTP {0}
FlightBrief parle anglais et espagnol : interface, overlays OBS, appli mobile, carnet public et messages du bot. Choix de la langue dans l'onglet Profil.	FlightBrief now speaks English and Spanish: interface, OBS overlays, mobile app, public logbook and bot messages. Pick your language in the Profile tab.	FlightBrief habla inglés y español: interfaz, overlays de OBS, app móvil, diario público y mensajes del bot. Elige el idioma en la pestaña Perfil.
Prédictions Twitch : en plus de !pari, ton chat mise ses points de chaîne sur une tranche de taux de toucher, ouverte et fermée avec les paris (chaîne Affiliée ou Partenaire).	Twitch predictions: on top of !bet, your chat wagers channel points on a touchdown-rate range, opened and closed with the bets (Affiliate or Partner channel).	Predicciones de Twitch: además de !apuesta, tu chat apuesta sus puntos de canal a un rango de tasa de toma, que se abre y se cierra con las apuestas (canal Afiliado o Partner).
Commandes du chat aussi en anglais et en espagnol (!board, !bet, !mycity, !embarcar, !apuesta…).	Chat commands in English and Spanish too (!board, !bet, !mycity, !embarcar, !apuesta…).	Comandos del chat también en inglés y español (!board, !bet, !mycity, !embarcar, !apuesta…).
Miles et paris : sauvegarde sûre (copie de secours), plus aucune perte si l'ordinateur s'éteint pendant l'écriture.	Miles and bets: safe saving (backup copy), no more loss if the computer shuts down while writing.	Millas y apuestas: guardado seguro (copia de respaldo), sin pérdidas si el ordenador se apaga durante la escritura.
Le message d'arrivée annonçait 100 miles de trop pour le meilleur passager.	The arrival message announced 100 miles too many for the top passenger.	El mensaje de llegada anunciaba 100 millas de más para el mejor pasajero.
L'export du carnet public ne supprime plus que ses propres cartes postales.	The public logbook export now only removes its own postcards.	La exportación del diario público ya solo borra sus propias postales.
Je fais des lives (Twitch, OBS)	I stream live (Twitch, OBS)	Hago directos (Twitch, OBS)
Affiche les onglets Outil Live, Twitch et À bord (overlays, bot du chat, passagers). Désactivé, FlightBrief reste un pur outil de vol ; tu peux changer d'avis à tout moment dans le Profil.	Shows the Live tool, Twitch and On board tabs (overlays, chat bot, passengers). When off, FlightBrief stays a pure flying tool; you can change your mind at any time in the Profile.	Muestra las pestañas Live, Twitch y A bordo (overlays, bot del chat, pasajeros). Desactivado, FlightBrief es solo una herramienta de vuelo; puedes cambiar de opinión cuando quieras en el Perfil.
Prédiction :	Prediction:	Predicción:
Pas de live ? Profil → « Je fais des lives » : désactivé, les onglets Outil Live, Twitch et À bord disparaissent et le bot est coupé. Demandé au premier lancement.	Not streaming? Profile → “I stream live”: when off, the Live tool, Twitch and On board tabs disappear and the bot is switched off. Asked on first launch.	¿No haces directos? Perfil → «Hago directos»: desactivado, las pestañas Live, Twitch y A bordo desaparecen y el bot se apaga. Se pregunta en el primer arranque.
Activer le copilote vocal	Enable the voice copilot	Activar el copiloto de voz
Alignement & décollage	Line-up & takeoff	Alineación y despegue
Altitude de transition (ft)	Transition altitude (ft)	Altitud de transición (ft)
Altitude de transition : calage standard.	Transition altitude: set standard.	Altitud de transición: reglaje estándar.
Annonces à voix haute : vario positif, 250 kt sous le FL100, calage standard / QNH à la transition, phares d'atterrissage, train non sorti en finale, 1000 / 500 / 100 ft, début de descente et taux au toucher. Voix de Windows, rien ne passe par Internet.	Spoken callouts: positive rate, 250 kt below FL100, standard / QNH at transition, landing lights, gear not down on final, 1000 / 500 / 100 ft, top of descent and touchdown rate. Windows voices, nothing goes through the Internet.	Avisos en voz alta: ascenso positivo, 250 kt por debajo de FL100, estándar / QNH en la transición, faros de aterrizaje, tren no extendido en final, 1000 / 500 / 100 ft, inicio del descenso y tasa de toma. Voces de Windows, nada pasa por Internet.
Après atterrissage	After landing	Después del aterrizaje
Après décollage	After takeoff	Después del despegue
Attention, train non sorti !	Warning, gear not down!	¡Atención, tren no extendido!
Avant démarrage	Before start	Antes del arranque
Avant roulage	Before taxi	Antes del rodaje
Batterie	Battery	Batería
Calage QNH	Altimeter set to QNH	Altímetro en QNH
Calage standard (1013)	Altimeter set to standard (1013)	Altímetro en estándar (1013)
Cent.	One hundred.	Cien.
Checklist	Checklist	Lista de comprobación
Cinq cents.	Five hundred.	Quinientos.
Consignes ceintures allumées	Seat belt signs on	Señal de cinturones encendida
Consignes ceintures éteintes	Seat belt signs off	Señal de cinturones apagada
Copilote vocal activé.	Voice copilot on.	Copiloto de voz activado.
Copilote vocal prêt. Bon vol !	Voice copilot ready. Have a good flight!	Copiloto de voz listo. ¡Buen vuelo!
Début de descente dans deux minutes.	Top of descent in two minutes.	Inicio del descenso en dos minutos.
Feu anticollision (beacon)	Beacon light	Luz anticolisión (beacon)
Feu anticollision éteint	Beacon light off	Luz anticolisión apagada
Feux de navigation	Navigation lights	Luces de navegación
Feux stroboscopiques	Strobe lights	Luces estroboscópicas
Feux stroboscopiques éteints	Strobe lights off	Luces estroboscópicas apagadas
Frein de parking desserré	Parking brake released	Freno de estacionamiento quitado
Frein de parking serré	Parking brake set	Freno de estacionamiento puesto
Les éléments se cochent tout seuls d'après l'état de l'avion dans le simulateur (feux, train, volets, frein de parking, calage…). ✋ = non lu pour cet avion : coche-le à la main. Aussi sur ton téléphone ou ta tablette (EFB).	Items tick themselves based on the aircraft's state in the simulator (lights, gear, flaps, parking brake, altimeter…). ✋ = not read for this aircraft: tick it by hand. Also on your phone or tablet (EFB).	Los elementos se marcan solos según el estado del avión en el simulador (luces, tren, flaps, freno de estacionamiento, altímetro…). ✋ = no se lee en este avión: márcalo a mano. También en tu teléfono o tableta (EFB).
Mille.	One thousand.	Mil.
Moteur(s) coupé(s)	Engine(s) off	Motor(es) apagado(s)
Moteur(s) en marche	Engine(s) running	Motor(es) en marcha
Niveau de transition : calage QNH.	Transition level: set QNH.	Nivel de transición: reglaje QNH.
Non lu pour cet avion : à cocher à la main	Not read for this aircraft: tick by hand	No se lee en este avión: marcar a mano
Parking	Parking	Estacionamiento
Phare de roulage	Taxi light	Luz de rodaje
Phare de roulage éteint	Taxi light off	Luz de rodaje apagada
Phares d'atterrissage	Landing lights	Faros de aterrizaje
Phares d'atterrissage éteints	Landing lights off	Faros de aterrizaje apagados
Phares d'atterrissage éteints sous le niveau 100.	Landing lights off below flight level 100.	Faros de aterrizaje apagados por debajo del nivel 100.
Pilote automatique	Autopilot	Piloto automático
Simulateur non connecté : coche à la main	Simulator not connected: tick by hand	Simulador no conectado: marca a mano
Spoilers armés	Spoilers armed	Spoilers armados
Spoilers désarmés	Spoilers disarmed	Spoilers desarmados
Toucher : {0} pieds par minute.	Touchdown: {0} feet per minute.	Toma: {0} pies por minuto.
Train rentré	Gear up	Tren arriba
Train sorti	Gear down	Tren abajo
Transpondeur en marche (ALT)	Transponder on (ALT)	Transpondedor en marcha (ALT)
Vario positif.	Positive rate.	Ascenso positivo.
Vitesse : 250 nœuds maximum sous le niveau 100.	Speed: 250 knots maximum below flight level 100.	Velocidad: 250 nudos máximo por debajo del nivel 100.
Volets rentrés	Flaps up	Flaps arriba
Volets réglés pour le décollage	Flaps set for takeoff	Flaps en posición de despegue
Volets sortis	Flaps extended	Flaps extendidos
▶ Tester la voix	▶ Test the voice	▶ Probar la voz
🎙️ Copilote vocal	🎙️ Voice copilot	🎙️ Copiloto de voz
{0}/{1} · lecture automatique de l'avion	{0}/{1} · reading the aircraft automatically	{0}/{1} · lectura automática del avión
Aucun OFP : importe ton plan de vol SimBrief dans le Briefing sur ton PC.	No OFP: import your SimBrief flight plan in the Briefing on your PC.	Sin OFP: importa tu plan de vuelo de SimBrief en el Briefing de tu PC.
Cartes d'aéroport	Airport charts	Cartas de aeropuerto
📄 Plan de vol (OFP SimBrief)	📄 Flight plan (SimBrief OFP)	📄 Plan de vuelo (OFP de SimBrief)
Aucune destination trouvée pour cette durée : essaie un autre temps de vol.	No destination found for this duration: try another flight time.	No se encontró ningún destino para esta duración: prueba otro tiempo de vuelo.
Avion léger	Light aircraft	Avión ligero
Aéroport de départ inconnu : indique un code OACI (ou ton aéroport de base dans le Profil).	Unknown departure airport: enter an ICAO code (or your home airport in the Profile).	Aeropuerto de salida desconocido: indica un código OACI (o tu aeropuerto base en el Perfil).
Cartes :	Charts:	Cartas:
Dis combien de temps tu as : FlightBrief propose 3 destinations adaptées à ton avion (distance, longueur de piste), avec la météo réelle, en priorité des terrains où tu ne t'es jamais posé.	Tell FlightBrief how much time you have: it suggests 3 destinations suited to your aircraft (distance, runway length), with real weather, favouring airfields you've never landed at.	Di cuánto tiempo tienes: FlightBrief propone 3 destinos adaptados a tu avión (distancia, longitud de pista), con la meteo real, priorizando aeródromos donde nunca has aterrizado.
Jamais visité	Never visited	Nunca visitado
Pas de METAR pour ce terrain.	No METAR for this airfield.	No hay METAR para este aeródromo.
Proposer des vols	Suggest flights	Proponer vuelos
Préparer ce vol	Prepare this flight	Preparar este vuelo
Recherche de destinations et de la météo…	Looking for destinations and weather…	Buscando destinos y meteo…
Temps disponible	Time available	Tiempo disponible
Très gros porteur	Very large widebody	Avión muy grande
🧭 Où voler aujourd'hui ?	🧭 Where to fly today?	🧭 ¿Adónde volar hoy?
🧭 Pas d'idée ? Où voler aujourd'hui	🧭 No idea? Where to fly today	🧭 ¿Sin ideas? Adónde volar hoy
400 m de piste entre falaises et océan : la plus courte des lignes régulières.	400 m of runway between cliffs and ocean: the shortest on scheduled service.	400 m de pista entre acantilados y océano: la más corta con vuelos regulares.
527 m en pente, un mur au bout, à 2 860 m d'altitude dans l'Himalaya.	527 m uphill, a wall at the end, at 2,860 m elevation in the Himalayas.	527 m en pendiente, un muro al final, a 2860 m de altitud en el Himalaya.
Altiport : 537 m de piste en pente à 18,5 %, pas de remise de gaz possible.	Altiport: 537 m runway on an 18.5% slope, no go-around possible.	Altipuerto: 537 m de pista con un 18,5 % de pendiente, sin motor y al aire posible.
Approche dans la vallée de l'Inn, entre des sommets à plus de 2 500 m.	Approach down the Inn valley, between peaks above 2,500 m.	Aproximación por el valle del Inn, entre cumbres de más de 2500 m.
Approche en virage serré au pied des montagnes corses.	Tight turning approach at the foot of the Corsican mountains.	Aproximación en viraje cerrado al pie de las montañas corsas.
Approche raide entre les Rocheuses, à 2 400 m d'altitude.	Steep approach through the Rockies, at 2,400 m elevation.	Aproximación pronunciada entre las Rocosas, a 2400 m de altitud.
Approche à vue entre les montagnes du Bhoutan, réservée à quelques pilotes au monde.	Visual approach between Bhutan's mountains, flown by only a handful of pilots worldwide.	Aproximación visual entre las montañas de Bután, reservada a unos pocos pilotos en el mundo.
Aucun vol enregistré en {0} pour l'instant.	No flights logged in {0} yet.	Aún no hay vuelos registrados en {0}.
Avion préféré	Favourite aircraft	Avión favorito
Descente plongeante au-dessus d'une colline et d'une route, piste qui finit sur la plage.	Diving descent over a hill and a road, onto a runway that ends on the beach.	Descenso en picado sobre una colina y una carretera, en una pista que termina en la playa.
La seule piste au monde sur une plage… recouverte à marée haute.	The only beach runway in the world… underwater at high tide.	La única pista del mundo en una playa… cubierta con la marea alta.
Le survol de Maho Beach à quelques mètres des baigneurs.	Flying over Maho Beach a few metres above the swimmers.	El sobrevuelo de Maho Beach a pocos metros de los bañistas.
Les terrains les plus redoutés des simmers. Pose-toi dessus pour débloquer le badge ; ton meilleur toucher y est gardé.	The airfields simmers fear most. Land there to unlock the badge; your best touchdown is kept.	Los aeródromos más temidos por los simmers. Aterriza en ellos para desbloquear la insignia; se guarda tu mejor toma.
Madère	Madeira	Madeira
Meilleur atterrissage	Best landing	Mejor aterrizaje
Mois le plus chargé	Busiest month	Mes con más vuelos
Piste coupée par une route, sous le Rocher, vent de travers garanti.	A runway crossed by a road, under the Rock, crosswind guaranteed.	Pista cortada por una carretera, bajo el Peñón, viento cruzado garantizado.
Piste courte au bord de la baie de Rio, au pied du Pain de Sucre.	Short runway on Rio's bay, at the foot of Sugarloaf Mountain.	Pista corta junto a la bahía de Río, al pie del Pan de Azúcar.
Piste courte entre la mer et la colline, survol de la route au seuil.	Short runway between sea and hill, flying over the road at the threshold.	Pista corta entre el mar y la colina, sobrevolando la carretera en el umbral.
Pose-toi quelque part pour gratter ton premier pays !	Land somewhere to scratch off your first country!	¡Aterriza en algún sitio para rascar tu primer país!
Relever le défi	Take the challenge	Aceptar el reto
Saint-Barthélemy	Saint Barthélemy	San Bartolomé
Ton année de pilote en un coup d'œil : heures, distance, pays, avion préféré, meilleur atterrissage… et une image à partager.	Your year as a pilot at a glance: hours, distance, countries, favourite aircraft, best landing… and an image to share.	Tu año de piloto de un vistazo: horas, distancia, países, avión favorito, mejor aterrizaje… y una imagen para compartir.
Ton aéroport	Your airport	Tu aeropuerto
Vallée encaissée et vents forts des Alpes du Sud.	A narrow valley and strong winds in the Southern Alps.	Valle encajonado y vientos fuertes de los Alpes del Sur.
Vents tournants et piste sur pilotis au bord de la falaise.	Swirling winds and a runway on stilts at the cliff's edge.	Vientos arremolinados y pista sobre pilotes al borde del acantilado.
Voir mon année	See my year	Ver mi año
Y retourner	Go back	Volver
aux commandes	at the controls	a los mandos
découverts cette année	discovered this year	descubiertos este año
le tour de la Terre	around the Earth	la vuelta a la Tierra
{0} pays sur ~195 · {1} aéroports	{0} countries out of ~195 · {1} airports	{0} países de ~195 · {1} aeropuertos
{0}× posé	landed {0}×	{0}× aterrizado
À relever	Not yet done	Pendiente
🏔️ Défis aéroports	🏔️ Airport challenges	🏔️ Retos de aeropuertos
🗺️ Gratte-pays	🗺️ Scratch map	🗺️ Mapa para rascar
{0} / {1} aéroports	{0} / {1} airports	{0} / {1} aeropuertos
💾 Enregistrer l'image	💾 Save image	💾 Guardar la imagen
passages	visits	visitas
Fichier vide ou illisible.	Empty or unreadable file.	Archivo vacío o ilegible.
Heure de départ	Departure time	Hora de salida
Importer {0} vols	Import {0} flights	Importar {0} vuelos
{0} vols importés ✓	{0} flights imported ✓	{0} vuelos importados ✓
{0} vols à importer · {1} déjà présents · {2} lignes sans date, départ ou arrivée	{0} flights to import · {1} already there · {2} lines without date, departure or arrival	{0} vuelos para importar · {1} ya presentes · {2} líneas sin fecha, salida o llegada
📥 Importer un historique	📥 Import a flight history	📥 Importar un historial
📥 Importer un historique (CSV)	📥 Import a flight history (CSV)	📥 Importar un historial (CSV)
Exporte tes vols en CSV depuis ton ancien outil (Little Navmap : Logbook → Exporter en CSV ; Volanta : Flights → Export ; ou un simple tableur). FlightBrief reconnaît les colonnes tout seul : vérifie-les, puis importe. Les vols déjà présents ne sont pas ajoutés deux fois.	Export your flights as CSV from your previous tool (Little Navmap: Logbook → Export as CSV; Volanta: Flights → Export; or a simple spreadsheet). FlightBrief recognises the columns by itself: check them, then import. Flights already there aren't added twice.	Exporta tus vuelos en CSV desde tu herramienta anterior (Little Navmap: Logbook → Exportar CSV; Volanta: Flights → Export; o una simple hoja de cálculo). FlightBrief reconoce las columnas solo: revísalas e importa. Los vuelos ya presentes no se añaden dos veces.
vols	flights	vuelos
Créer un nouveau code ? Le plugin déjà installé ne pourra plus piloter FlightBrief : il faudra le réinstaller.	Create a new code? The plugin already installed will no longer be able to control FlightBrief: you'll need to reinstall it.	¿Crear un código nuevo? El plugin ya instalado no podrá controlar FlightBrief: tendrás que reinstalarlo.
Installation impossible.	Installation failed.	No se pudo instalar.
Installer le plugin Stream Deck	Install the Stream Deck plugin	Instalar el plugin de Stream Deck
Nouveau code créé ✓ — réinstalle le plugin pour l'utiliser.	New code created ✓ — reinstall the plugin to use it.	Código nuevo creado ✓ — reinstala el plugin para usarlo.
Nouveau code d'appairage	New pairing code	Nuevo código de emparejamiento
Pilote FlightBrief depuis ton Stream Deck : tracker, capture, checklist, copilote vocal, infos de vol sur les touches, molettes du Stream Deck + pour les volumes. Le plugin s'installe d'un clic, déjà appairé avec ce PC.	Control FlightBrief from your Stream Deck: tracker, screenshot, checklist, voice copilot, flight info on the keys, Stream Deck + dials for volumes. The plugin installs in one click, already paired with this PC.	Controla FlightBrief desde tu Stream Deck: seguimiento, captura, checklist, copiloto de voz, datos de vuelo en las teclas, diales del Stream Deck + para los volúmenes. El plugin se instala con un clic, ya emparejado con este PC.
Plugin prêt ✓ — le Stream Deck propose de l'installer. Sinon, double-clique sur le fichier dans le dossier qui s'est ouvert.	Plugin ready ✓ — Stream Deck offers to install it. Otherwise, double-click the file in the folder that opened.	Plugin listo ✓ — Stream Deck propone instalarlo. Si no, haz doble clic en el archivo de la carpeta que se ha abierto.
Préparation du plugin…	Preparing the plugin…	Preparando el plugin…
Checklists dynamiques : de la mise en route au parking, elles se cochent toutes seules en lisant l'avion dans le simulateur (Briefing, et sur la tablette).	Dynamic checklists: from start-up to parking, they tick themselves by reading the aircraft in the simulator (Briefing, and on the tablet).	Checklists dinámicas: del arranque al estacionamiento, se marcan solas leyendo el avión en el simulador (Briefing y en la tableta).
Copilote vocal (à activer dans le Briefing) : vario positif, 250 kt sous le FL100, calage standard / QNH, phares, train en finale, 1000 / 500 / 100 ft, début de descente, taux au toucher.	Voice copilot (turn it on in the Briefing): positive rate, 250 kt below FL100, standard / QNH, lights, gear on final, 1000 / 500 / 100 ft, top of descent, touchdown rate.	Copiloto de voz (actívalo en el Briefing): ascenso positivo, 250 kt por debajo de FL100, estándar / QNH, faros, tren en final, 1000 / 500 / 100 ft, inicio del descenso, tasa de toma.
EFB sur téléphone ou tablette : carte avec l'ATC VATSIM / IVAO, checklist interactive, plan de vol SimBrief et cartes d'aéroport, mise en page tablette.	EFB on phone or tablet: map with VATSIM / IVAO ATC, interactive checklist, SimBrief flight plan and airport charts, tablet layout.	EFB en teléfono o tableta: mapa con el ATC de VATSIM / IVAO, checklist interactiva, plan de vuelo de SimBrief y cartas de aeropuerto, diseño para tableta.
« Où voler aujourd'hui ? » (Outils) : 3 destinations selon ton temps, ton avion et la météo réelle, en priorité des terrains jamais visités, avec ouverture dans SimBrief.	“Where to fly today?” (Tools): 3 destinations based on your time, aircraft and real weather, favouring airfields never visited, with opening in SimBrief.	«¿Adónde volar hoy?» (Herramientas): 3 destinos según tu tiempo, tu avión y la meteo real, priorizando aeródromos nunca visitados, con apertura en SimBrief.
Cartes d'aéroport en un clic (ChartFox, Navigraph, SkyVector…) sous le départ et l'arrivée du Briefing.	Airport charts in one click (ChartFox, Navigraph, SkyVector…) under the Briefing's departure and arrival.	Cartas de aeropuerto en un clic (ChartFox, Navigraph, SkyVector…) bajo la salida y la llegada del Briefing.
Profil : Flight Wrapped (ton année + image à partager), gratte-pays et défis des aéroports les plus redoutés.	Profile: Flight Wrapped (your year + an image to share), scratch map and the most feared airport challenges.	Perfil: Flight Wrapped (tu año + imagen para compartir), mapa para rascar y retos de los aeropuertos más temidos.
Import d'historique (Logbook) : Little Navmap, Volanta ou tableur, colonnes détectées toutes seules, sans doublons.	History import (Logbook): Little Navmap, Volanta or spreadsheet, columns detected automatically, no duplicates.	Importación de historial (Logbook): Little Navmap, Volanta u hoja de cálculo, columnas detectadas solas, sin duplicados.
Plugin Stream Deck (Profil → Stream Deck) : tracker, capture, checklist, copilote, infos de vol sur les touches, molettes du Stream Deck +. Installé d'un clic.	Stream Deck plugin (Profile → Stream Deck): tracker, screenshot, checklist, copilot, flight info on the keys, Stream Deck + dials. Installed in one click.	Plugin de Stream Deck (Perfil → Stream Deck): seguimiento, captura, checklist, copiloto, datos de vuelo en las teclas, diales del Stream Deck +. Se instala con un clic.
CARNET DE VOL · BILAN ANNUEL	PILOT LOGBOOK · ANNUAL SUMMARY	DIARIO DE VUELO · RESUMEN ANUAL
nouveaux	new	nuevos
Préparation de l'image…	Preparing the image…	Preparando la imagen…
Niveau 100 : vitesse 250.	Flight level 100: speed 250.	Nivel 100: velocidad 250.
Niveau 100 : phares.	Flight level 100: landing lights.	Nivel 100: faros.
Niveau 100 : consignes ceintures.	Flight level 100: seat belt signs.	Nivel 100: señal de cinturones.
Niveau 100 : vitesse 250, phares.	Flight level 100: speed 250, landing lights.	Nivel 100: velocidad 250, faros.
Niveau 100 : vitesse 250, consignes ceintures.	Flight level 100: speed 250, seat belt signs.	Nivel 100: velocidad 250, señal de cinturones.
Niveau 100 : phares, consignes ceintures.	Flight level 100: landing lights, seat belt signs.	Nivel 100: faros, señal de cinturones.
Niveau 100 : vitesse 250, phares, consignes ceintures.	Flight level 100: speed 250, landing lights, seat belt signs.	Nivel 100: velocidad 250, faros, señal de cinturones.
Mille. Instable : taux de descente.	One thousand. Unstable: sink rate.	Mil. Inestable: tasa de descenso.
Mille. Instable : train.	One thousand. Unstable: gear.	Mil. Inestable: tren.
Mille. Instable : volets.	One thousand. Unstable: flaps.	Mil. Inestable: flaps.
Mille. Instable : taux de descente, train.	One thousand. Unstable: sink rate, gear.	Mil. Inestable: tasa de descenso, tren.
Mille. Instable : taux de descente, volets.	One thousand. Unstable: sink rate, flaps.	Mil. Inestable: tasa de descenso, flaps.
Mille. Instable : train, volets.	One thousand. Unstable: gear, flaps.	Mil. Inestable: tren, flaps.
Mille. Instable : taux de descente, train, volets.	One thousand. Unstable: sink rate, gear, flaps.	Mil. Inestable: tasa de descenso, tren, flaps.
100, 50, 40, 30, 20 (« Retard » sur Airbus), 10, taux au toucher, 60 nœuds	100, 50, 40, 30, 20 (“Retard” on Airbus), 10, touchdown rate, 60 knots	100, 50, 40, 30, 20 («Retard» en Airbus), 10, tasa de toma, 60 nudos
80 nœuds, vario positif, train resté sorti	80 knots, positive rate, gear left down	80 nudos, ascenso positivo, tren aún extendido
Alertes	Alerts	Alertas
Annonces cabine	Cabin announcements	Anuncios de cabina
Approche des minimums.	Approaching minimums.	Aproximando mínimos.
Automatique	Automatic	Automática
Bienvenue à bord, croisière, descente, arrivée — façon commandant de bord	Welcome aboard, cruise, descent, arrival — captain style	Bienvenida a bordo, crucero, descenso, llegada — al estilo del comandante
Calage standard, niveau 100, 1000 ft avant le niveau, niveau atteint, début de descente	Standard altimeter, FL100, 1000 ft to level off, level reached, top of descent	Reglaje estándar, nivel 100, 1000 ft antes del nivel, nivel alcanzado, inicio del descenso
Carburant bas.	Low fuel.	Combustible bajo.
Cinq cents. Instable, remise de gaz.	Five hundred. Unstable, go around.	Quinientos. Inestable, motor y al aire.
Cinquante.	Fifty.	Cincuenta.
Dix.	Ten.	Diez.
Débit	Speech rate	Velocidad de voz
Ici le commandant. Nous sommes à notre altitude de croisière, arrivée prévue à {0}.	This is your captain speaking. We have reached our cruising altitude, expected arrival at {0}.	Les habla el comandante. Hemos alcanzado nuestra altitud de crucero, llegada prevista a las {0}.
Ici le commandant. Nous sommes à notre altitude de croisière. Bon vol à tous.	This is your captain speaking. We have reached our cruising altitude. Enjoy the flight.	Les habla el comandante. Hemos alcanzado nuestra altitud de crucero. Buen vuelo a todos.
Inclinaison !	Bank angle!	¡Inclinación!
Mesdames et messieurs, bienvenue à bord. Merci d'attacher vos ceintures, nous allons rouler vers la piste.	Ladies and gentlemen, welcome aboard. Please fasten your seat belts, we are about to taxi to the runway.	Señoras y señores, bienvenidos a bordo. Abróchense los cinturones, vamos a rodar hacia la pista.
Mesdames et messieurs, bienvenue à destination. Merci d'avoir voyagé avec nous.	Ladies and gentlemen, welcome to your destination. Thank you for flying with us.	Señoras y señores, bienvenidos a destino. Gracias por volar con nosotros.
Mesdames et messieurs, bienvenue à {0}. Merci d'avoir voyagé avec nous.	Ladies and gentlemen, welcome to {0}. Thank you for flying with us.	Señoras y señores, bienvenidos a {0}. Gracias por volar con nosotros.
Mille pieds avant le niveau.	One thousand to level off.	Mil pies para el nivel.
Mille. Stabilisé.	One thousand. Stable.	Mil. Estabilizado.
Minimums (ft sol)	Minimums (ft AGL)	Mínimos (ft AGL)
Minimums.	Minimums.	Mínimos.
Montée & croisière	Climb & cruise	Ascenso y crucero
Niveau 100.	Flight level 100.	Nivel 100.
Nous avons commencé notre descente vers {0}. Merci de regagner vos sièges et d'attacher vos ceintures.	We have started our descent towards {0}. Please return to your seats and fasten your seat belts.	Hemos iniciado el descenso hacia {0}. Regresen a sus asientos y abróchense los cinturones.
Nous avons commencé notre descente. Merci de regagner vos sièges et d'attacher vos ceintures.	We have started our descent. Please return to your seats and fasten your seat belts.	Hemos iniciado el descenso. Regresen a sus asientos y abróchense los cinturones.
Pas de vol en cours	No flight in progress	No hay vuelo en curso
Pilote FlightBrief depuis ton Stream Deck : tracker, capture, copilote vocal, infos de vol sur les touches, molettes du Stream Deck + pour les volumes. Le plugin s'installe d'un clic, déjà appairé avec ce PC.	Control FlightBrief from your Stream Deck: tracker, screenshot, voice copilot, flight info on the keys, Stream Deck + dials for volumes. The plugin installs in one click, already paired with this PC.	Controla FlightBrief desde tu Stream Deck: seguimiento, captura, copiloto de voz, datos de vuelo en las teclas, diales del Stream Deck + para los volúmenes. El plugin se instala con un clic, ya emparejado con este PC.
QNH, niveau 100 (vitesse, phares, ceintures), 1000 ft stabilisé ou non, 500, minimums	QNH, FL100 (speed, lights, seat belts), 1000 ft stable or not, 500, minimums	QNH, nivel 100 (velocidad, faros, cinturones), 1000 ft estabilizado o no, 500, mínimos
Quarante.	Forty.	Cuarenta.
Quatre-vingts nœuds.	Eighty knots.	Ochenta nudos.
Soixante nœuds.	Sixty knots.	Sesenta nudos.
Taux de descente !	Sink rate!	¡Tasa de descenso!
Taux de descente, inclinaison, train non sorti, 250 kt sous le FL100, carburant bas	Sink rate, bank angle, gear not down, 250 kt below FL100, low fuel	Tasa de descenso, inclinación, tren no extendido, 250 kt por debajo de FL100, combustible bajo
Toucher : {0} pieds par minute, {1}.	Touchdown: {0} feet per minute, {1}.	Toma: {0} pies por minuto, {1}.
Train toujours sorti.	Gear still down.	Tren todavía extendido.
Trente.	Thirty.	Treinta.
Un copilote qui parle : il annonce les étapes du vol, surveille ce que tu pourrais oublier et lance les annonces radiosonde en finale. Voix de Windows, rien ne passe par Internet.	A copilot that talks: it calls out each stage of the flight, watches what you might forget and makes the radio-altimeter callouts on final. Windows voices, nothing goes through the Internet.	Un copiloto que habla: anuncia las etapas del vuelo, vigila lo que podrías olvidar y hace los avisos del radioaltímetro en final. Voces de Windows, nada pasa por Internet.
Vingt.	Twenty.	Veinte.
Vingt. Retard.	Twenty. Retard.	Veinte. Retard.
Voix	Voice	Voz
arrivée prévue à {0}	expected arrival at {0}	llegada prevista a las {0}
atterrissage doux	a smooth landing	aterrizaje suave
atterrissage dur	a hard landing	aterrizaje duro
atterrissage ferme	a firm landing	aterrizaje firme
un vrai beurre	a real butter	pura mantequilla
vitesse sol {0} nœuds	ground speed {0} knots	velocidad respecto al suelo {0} nudos
{0} milles nautiques restants	{0} nautical miles to go	{0} millas náuticas restantes
🗣️ Point de situation	🗣️ Status report	🗣️ Estado del vuelo
Niveau {0} atteint.	Flight level {0} reached.	Nivel {0} alcanzado.
{0} pieds atteint.	{0} feet reached.	{0} pies alcanzados.
{0} pieds	{0} feet	{0} pies
Flight Wrapped {0}	Flight Wrapped {0}	Flight Wrapped {0}
Mille. Instable : {0}.	One thousand. Unstable: {0}.	Mil. Inestable: {0}.
Niveau 100 : {0}.	Flight level 100: {0}.	Nivel 100: {0}.
Toucher : {0} pieds par minute{1}.	Touchdown: {0} feet per minute{1}.	Toma: {0} pies por minuto{1}.
consignes ceintures	seat belt signs	señal de cinturones
taux de descente	sink rate	tasa de descenso
Avec ATC en ligne de préférence	Prefer online ATC	Preferir ATC en línea
Dis combien de temps tu as : FlightBrief propose 3 destinations adaptées à ton avion (distance, longueur de piste), avec la météo réelle, l'ATC en ligne sur VATSIM et IVAO, et les events VATSIM en cours à ton heure d'arrivée.	Tell FlightBrief how much time you have: it suggests 3 destinations suited to your aircraft (distance, runway length), with real weather, online ATC on VATSIM and IVAO, and VATSIM events running at your arrival time.	Di cuánto tiempo tienes: FlightBrief propone 3 destinos adaptados a tu avión (distancia, longitud de pista), con la meteo real, el ATC en línea en VATSIM e IVAO y los events de VATSIM en curso a tu hora de llegada.
Découvrir des terrains jamais visités	Discover airfields never visited	Descubrir aeródromos nunca visitados
Mes terrains préférés	My favourite airfields	Mis aeródromos favoritos
Peu importe	No preference	Me da igual
Préférence	Preference	Preferencia
Recherche des destinations, de la météo, de l'ATC en ligne et des events…	Looking for destinations, weather, online ATC and events…	Buscando destinos, meteo, ATC en línea y events…
vitesse 250	speed 250	velocidad 250
{0}× visité	visited {0}×	visitado {0}×
🎧 ATC en ligne : {0} · {1}	🎧 Online ATC: {0} · {1}	🎧 ATC en línea: {0} · {1}
📅 Event VATSIM : {0} · {1}–{2}Z	📅 VATSIM event: {0} · {1}–{2}Z	📅 Event de VATSIM: {0} · {1}–{2}Z
Copilote vocal (Briefing) : décollage, montée, croisière, approche stabilisée, minimums, radiosonde 50-40-30-20-10 (« Retard » sur Airbus), alertes façon GPWS, annonces cabine et point de situation. Catégories, voix et débit au choix.	Voice copilot (Briefing): takeoff, climb, cruise, stabilised approach, minimums, radio altimeter 50-40-30-20-10 (“Retard” on Airbus), GPWS-style alerts, cabin announcements and status report. Categories, voice and speed of your choice.	Copiloto de voz (Briefing): despegue, ascenso, crucero, aproximación estabilizada, mínimos, radioaltímetro 50-40-30-20-10 («Retard» en Airbus), alertas tipo GPWS, anuncios de cabina y estado del vuelo. Categorías, voz y velocidad a elegir.
EFB sur téléphone ou tablette : carte avec l'ATC VATSIM / IVAO, plan de vol SimBrief et cartes d'aéroport, mise en page tablette.	EFB on phone or tablet: map with VATSIM / IVAO ATC, SimBrief flight plan and airport charts, tablet layout.	EFB en teléfono o tableta: mapa con el ATC de VATSIM / IVAO, plan de vuelo de SimBrief y cartas de aeropuerto, diseño para tableta.
« Où voler aujourd'hui ? » (Outils) : 3 destinations selon ton temps, ton avion, la météo réelle, l'ATC en ligne et les events VATSIM — terrains jamais visités ou tes préférés —, avec ouverture dans SimBrief.	“Where to fly today?” (Tools): 3 destinations based on your time, aircraft, real weather, online ATC and VATSIM events — airfields never visited or your favourites — with opening in SimBrief.	«¿Adónde volar hoy?» (Herramientas): 3 destinos según tu tiempo, tu avión, la meteo real, el ATC en línea y los events de VATSIM — aeródromos nunca visitados o tus favoritos —, con apertura en SimBrief.
Plugin Stream Deck (Profil → Stream Deck) : tracker, capture, copilote, infos de vol sur les touches, molettes du Stream Deck +. Installé d'un clic.	Stream Deck plugin (Profile → Stream Deck): tracker, screenshot, copilot, flight info on the keys, Stream Deck + dials. Installed in one click.	Plugin de Stream Deck (Perfil → Stream Deck): seguimiento, captura, copiloto, datos de vuelo en las teclas, diales del Stream Deck +. Se instala con un clic.
# ---- v1.8 ----
(joue un exemple quand tu relâches le curseur)	(plays an example when you release the slider)	(reproduce un ejemplo al soltar el control)
Action impossible : le PC est-il joignable ?	Action failed: can the PC be reached?	Acción imposible: ¿se puede acceder al PC?
Activer le copilote	Turn on the copilot	Activar el copiloto
Ajoutée au vol	Added to the flight	Añadida al vuelo
Alertes muettes	Alerts muted	Alertas silenciadas
Annonces actives	Callouts on	Anuncios activos
Annoncé par le copilote	Read out by the copilot	Anunciado por el copiloto
Arrivés	Arrived	Llegados
Arrêté	Stopped	Detenido
Atterrissage le plus doux	Softest landing	Aterrizaje más suave
Aucun défi ne correspond à ces filtres.	No challenge matches these filters.	Ningún reto coincide con estos filtros.
Aucun pari	No bets	Ninguna apuesta
Aucun pari en cours	No bets running	Ninguna apuesta en curso
Aucun pays ne correspond.	No country matches.	Ningún país coincide.
Aucun vol en cours à arrêter	No flight in progress to stop	Ningún vuelo en curso que detener
Aucun vol « À bord » en cours.	No “On board” flight in progress.	Ningún vuelo «A bordo» en curso.
Aucune photo pour l’instant	No photos yet	Todavía no hay fotos
Aéroport fétiche	Favourite airport	Aeropuerto favorito
Aéroports pris sur le vol réel (le briefing indiquait {0}).	Airports taken from the actual flight (the briefing said {0}).	Aeropuertos tomados del vuelo real (el briefing indicaba {0}).
Bot désactivé	Bot disabled	Bot desactivado
Briefing remis à zéro	Briefing cleared	Briefing reiniciado
C'est ici que FlightBrief te prévient (vol terminé, PIREP enregistré, erreur…).	This is where FlightBrief lets you know (flight finished, PIREP saved, error…).	Aquí es donde FlightBrief te avisa (vuelo terminado, PIREP guardado, error…).
Capture d’écran	Screenshot	Captura de pantalla
Captures prises pendant tes vols	Screenshots taken during your flights	Capturas tomadas durante tus vuelos
Chargement des photos…	Loading photos…	Cargando fotos…
Chat du bot	Bot chat	Chat del bot
Chaîne non renseignée	No channel set	Canal no indicado
Chercher un pays ou un aéroport…	Search a country or an airport…	Buscar un país o un aeropuerto…
Clique sur un record pour revoir le vol.	Click a record to see the flight again.	Haz clic en un récord para volver a ver el vuelo.
Connecté au chat	Connected to chat	Conectado al chat
Connecté au simu	Connected to the sim	Conectado al simulador
Connexion à FlightBrief…	Connecting to FlightBrief…	Conectando con FlightBrief…
Connexion…	Connecting…	Conectando…
Couper le copilote	Mute the copilot	Silenciar el copiloto
Couper le son des alertes	Mute alert sounds	Silenciar las alertas
Couper le tracker	Stop the tracker	Detener el seguimiento
Difficile	Hard	Difícil
Enregistrer quand même	Save anyway	Guardar de todos modos
Envoyé à FlightBrief ✓	Sent to FlightBrief ✓	Enviado a FlightBrief ✓
Exemple de pop-up	Example pop-up	Ejemplo de aviso
Extrême	Extreme	Extremo
Fermer les paris	Close bets	Cerrar las apuestas
Fermer l’embarquement	Close boarding	Cerrar el embarque
Fermés	Closed	Cerradas
FlightBrief s'est fermé avant l'envoi du PIREP. Vérifie le résumé puis envoie-le.	FlightBrief closed before the PIREP was sent. Check the summary, then send it.	FlightBrief se cerró antes de enviar el PIREP. Revisa el resumen y luego envíalo.
Hors vol enregistré	Not linked to a flight	Fuera de un vuelo registrado
Ignorer	Ignore	Ignorar
L'onglet Stream fonctionne sur le	The Stream tab works on the	La pestaña Stream funciona en la
Le tracker ne suit aucun vol pour l'instant (avion pas encore parti ?).	The tracker isn't following any flight right now (aircraft not moving yet?).	El seguimiento no sigue ningún vuelo por ahora (¿el avión aún no ha salido?).
Le vol a été coupé en plein trajet : certaines données (atterrissage, carburant) peuvent manquer.	The flight was cut off mid-way: some data (landing, fuel) may be missing.	El vuelo se cortó a mitad de camino: pueden faltar algunos datos (aterrizaje, combustible).
Le vol est de nouveau prêt à être envoyé.	The flight is ready to be sent again.	El vuelo vuelve a estar listo para enviarse.
Les captures restent sur ton PC. Ouvre cet écran sur le	Screenshots stay on your PC. Open this screen on the	Las capturas se quedan en tu PC. Abre esta pantalla en la
Les messages importants (vol terminé, PIREP enregistré, vol trop court, erreur du simulateur) s'affichent en bas de la fenêtre avec un petit son.	Important messages (flight finished, PIREP saved, flight too short, simulator error) appear at the bottom of the window with a short sound.	Los mensajes importantes (vuelo terminado, PIREP guardado, vuelo demasiado corto, error del simulador) aparecen abajo de la ventana con un pequeño sonido.
Meilleure note d'atterrissage	Best landing score	Mejor nota de aterrizaje
Meilleurs parieurs	Top bettors	Mejores apostadores
Mes photos	My photos	Mis fotos
Mes photos de vol	My flight photos	Mis fotos de vuelo
Muet	Muted	Silenciado
Ouverts	Open	Abiertas
Ouvrir l’embarquement	Open boarding	Abrir el embarque
PC injoignable	PC unreachable	PC inaccesible
PIREP annulé	PIREP cancelled	PIREP cancelado
PIREP enregistré dans le logbook	PIREP saved to the logbook	PIREP guardado en el logbook
Paris d’atterrissage {0}	Landing bets {0}	Apuestas de aterrizaje {0}
Pas de gagnant	No winner	Sin ganador
Pas encore relevé	Not done yet	Aún no superado
Photos	Photos	Fotos
Photos du vol	Flight photos	Fotos del vuelo
Photos indisponibles hors du Wi-Fi	Photos unavailable away from Wi-Fi	Fotos no disponibles fuera del Wi-Fi
Plus haute altitude	Highest altitude	Mayor altitud
Plus longue distance	Longest distance	Mayor distancia
Plus visités	Most visited	Más visitados
Point de situation	Status report	Punto de situación
Posé	Landed	Aterrizado
Prends des captures pendant tes vols (raccourci clavier ou captures automatiques) : elles apparaîtront ici, rangées par vol.	Take screenshots during your flights (hotkey or automatic captures): they'll show up here, sorted by flight.	Haz capturas durante tus vuelos (atajo de teclado o capturas automáticas): aparecerán aquí, ordenadas por vuelo.
Problème avec le simulateur	Problem with the simulator	Problema con el simulador
Prochain défi conseillé :	Suggested next challenge:	Próximo reto aconsejado:
Prochain survol :	Next flyover:	Próximo sobrevuelo:
Précédente	Previous	Anterior
Prêt pour le prochain vol.	Ready for the next flight.	Listo para el próximo vuelo.
Relevés	Done	Superados
Rien pour l’instant : les commandes du chat (!eta, !pari…) et les réponses du bot s’afficheront ici.	Nothing yet: chat commands (!eta, !bet…) and the bot's replies will show up here.	Nada por ahora: los comandos del chat (!eta, !apuesta…) y las respuestas del bot aparecerán aquí.
Résolus	Settled	Resueltas
Résultat annoncé	Result announced	Resultado anunciado
Résultat{0}	Result{0}	Resultado{0}
Rétablir	Restore	Restablecer
Rétablir le son des alertes	Unmute alert sounds	Reactivar el sonido de las alertas
Si ton avion roule ou vole dans le simulateur alors que le suivi n'est pas lancé, FlightBrief te prévient par un son et une notification Windows après 5 minutes de roulage ou de vol, puis toutes les minutes.	If your aircraft is taxiing or flying in the simulator while tracking isn't running, FlightBrief warns you with a sound and a Windows notification after 5 minutes of taxiing or flying, then every minute.	Si tu avión rueda o vuela en el simulador sin que el seguimiento esté activo, FlightBrief te avisa con un sonido y una notificación de Windows tras 5 minutos de rodaje o de vuelo, y luego cada minuto.
Son des alertes actif	Alert sounds on	Sonido de alertas activo
Son des pop-ups	Pop-up sound	Sonido de los avisos
Suivante	Next	Siguiente
Technique	Technical	Técnico
Tes records apparaîtront ici après ton premier vol.	Your records will show up here after your first flight.	Tus récords aparecerán aquí tras tu primer vuelo.
Tous niveaux	All levels	Todos los niveles
Télécommande	Remote control	Mando a distancia
Voir	View	Ver
Voir le détail →	See details →	Ver el detalle →
Voir le résumé	View the summary	Ver el resumen
Voir le vol	View the flight	Ver el vuelo
Voir les défis →	See the challenges →	Ver los retos →
Vol interrompu récupéré	Interrupted flight recovered	Vuelo interrumpido recuperado
Vol récupéré	Flight recovered	Vuelo recuperado
Vol trop court pour être enregistré automatiquement	Flight too short to be saved automatically	Vuelo demasiado corto para guardarse automáticamente
Vols illustrés	Flights with photos	Vuelos con fotos
Vérifie que le téléphone est sur le même Wi-Fi que ton PC, avec FlightBrief ouvert.	Check that the phone is on the same Wi-Fi as your PC, with FlightBrief open.	Comprueba que el teléfono está en el mismo Wi-Fi que tu PC, con FlightBrief abierto.
a parié −{0} (écart {1})	bet −{0} (off by {1})	apostó −{0} (diferencia {1})
aéroports	airports	aeropuertos
du monde	of the world	del mundo
défis relevés	challenges done	retos superados
que ton PC, avec FlightBrief ouvert.	as your PC, with FlightBrief open.	que tu PC, con FlightBrief abierto.
relevés	done	superados
sur 15	out of 15	de 15
ton pays le plus visité · {0} aéroport{1}	your most visited country · {0} airport{1}	tu país más visitado · {0} aeropuerto{1}
{0} aéroport{1} · {2} % du monde	{0} airport{1} · {2}% of the world	{0} aeropuerto{1} · {2} % del mundo
{0} passage{1} au départ ou à l'arrivée	{0} visit{1} as departure or arrival	{0} paso{1} como salida o llegada
{0} · {1}{2} — le briefing est remis à zéro.{3}	{0} · {1}{2} — the briefing has been cleared.{3}	{0} · {1}{2} — el briefing se ha reiniciado.{3}
{0} → {1} · {2} · {3} NM. Vérifie le résumé puis envoie le PIREP.	{0} → {1} · {2} · {3} NM. Check the summary, then send the PIREP.	{0} → {1} · {2} · {3} NM. Revisa el resumen y luego envía el PIREP.
{0}{1} s en l'air (minimum 2 min). Tu peux l'enregistrer quand même ou l'ignorer.	{0}{1} s in the air (2 min minimum). You can save it anyway or ignore it.	{0}{1} s en el aire (mínimo 2 min). Puedes guardarlo de todos modos o ignorarlo.
À bord {0}	On board {0}	A bordo {0}
— relevé	— done	— superado
▶ Voir un exemple	▶ See an example	▶ Ver un ejemplo
⚠️ Plus de nouvelles du PC — infos de la dernière minute.	⚠️ No news from the PC — info from the last minute.	⚠️ Sin noticias del PC — datos del último minuto.
✅ Moteurs coupés : clôture du vol…	✅ Engines off: closing the flight…	✅ Motores apagados: cerrando el vuelo…
✈️ En vol	✈️ Airborne	✈️ En vuelo
🅿️ Avion garé : coupe les moteurs pour clôturer le vol (ou utilise le bouton ci-dessus).	🅿️ Aircraft parked: shut down the engines to close the flight (or use the button above).	🅿️ Avión estacionado: apaga los motores para cerrar el vuelo (o usa el botón de arriba).
🅿️ Avion immobile : le vol se clôture tout seul dans quelques secondes.	🅿️ Aircraft stopped: the flight will close by itself in a few seconds.	🅿️ Avión detenido: el vuelo se cerrará solo en unos segundos.
🏅 Tous les défis sont relevés, chapeau !	🏅 All challenges done, hats off!	🏅 Todos los retos superados, ¡enhorabuena!
💬 Pop-ups de l'appli	💬 App pop-ups	💬 Avisos de la aplicación
📶 Les photos s'affichent quand le téléphone est sur le même Wi-Fi que ton PC (FlightBrief ouvert).	📶 Photos show up when the phone is on the same Wi-Fi as your PC (FlightBrief open).	📶 Las fotos aparecen cuando el teléfono está en el mismo Wi-Fi que tu PC (FlightBrief abierto).
# ---- journal des nouveautés 1.8 ----
Confort, records et télécommande sur le téléphone	Comfort, records and a remote control on your phone	Comodidad, récords y mando a distancia en el teléfono
Fin de vol intelligente : le vol se clôture quand tu coupes les moteurs au parking, plus au premier arrêt au point d'attente ou dans une file de roulage. Sous le bouton d'arrêt, l'appli te dit ce qu'elle attend.	Smart flight end: the flight closes when you shut down the engines at the gate, no longer at the first stop at the holding point or in a taxi queue. Below the stop button, the app tells you what it's waiting for.	Fin de vuelo inteligente: el vuelo se cierra cuando apagas los motores en el parking, ya no en la primera parada en el punto de espera o en una cola de rodaje. Bajo el botón de parada, la aplicación te dice qué está esperando.
Pop-ups en bas de l'appli avec un petit son : vol terminé, PIREP enregistré, vol trop court, erreur du simulateur… Son et volume réglables dans le Profil.	Pop-ups at the bottom of the app with a short sound: flight finished, PIREP saved, flight too short, simulator error… Sound and volume adjustable in Profile.	Avisos abajo de la aplicación con un pequeño sonido: vuelo terminado, PIREP guardado, vuelo demasiado corto, error del simulador… Sonido y volumen ajustables en el Perfil.
PIREP enregistré : un bouton « Annuler » pendant 10 secondes, en cas de fausse manip.	PIREP saved: an “Undo” button for 10 seconds, in case of a slip.	PIREP guardado: un botón «Deshacer» durante 10 segundos, por si te equivocas.
Briefing remis à zéro après l'envoi du PIREP, prêt pour le vol suivant (avec « Rétablir »).	Briefing cleared after the PIREP is sent, ready for the next flight (with “Restore”).	Briefing reiniciado tras enviar el PIREP, listo para el siguiente vuelo (con «Restablecer»).
Profil : records personnels (atterrissage le plus doux, meilleure note, vol le plus long, plus longue distance, plus haute altitude, aéroport fétiche). Un clic rouvre le vol.	Profile: personal records (softest landing, best score, longest flight, longest distance, highest altitude, favourite airport). One click opens the flight again.	Perfil: récords personales (aterrizaje más suave, mejor nota, vuelo más largo, mayor distancia, mayor altitud, aeropuerto favorito). Un clic vuelve a abrir el vuelo.
Profil : Gratte-pays et Défis aéroports ramenés à deux tuiles compactes. Le détail s'ouvre dans une fenêtre, avec recherche, tri et filtres par niveau.	Profile: Scratch map and Airport challenges shrunk to two compact tiles. Details open in a window, with search, sorting and level filters.	Perfil: Rasca-países y Retos de aeropuertos reducidos a dos tarjetas compactas. El detalle se abre en una ventana, con búsqueda, orden y filtros por nivel.
Téléphone, pour les streamers : onglet Stream avec l'état du bot, les paris en cours, les passagers à bord, le chat du bot et une télécommande (tracker, capture, paris, embarquement, copilote, alertes).	Phone, for streamers: Stream tab with the bot status, current bets, passengers on board, the bot chat and a remote control (tracker, screenshot, bets, boarding, copilot, alerts).	Teléfono, para streamers: pestaña Stream con el estado del bot, las apuestas en curso, los pasajeros a bordo, el chat del bot y un mando a distancia (seguimiento, captura, apuestas, embarque, copiloto, alertas).
Téléphone : tes photos de vol, rangées par vol, avec une visionneuse plein écran (sur le Wi-Fi de la maison).	Phone: your flight photos, sorted by flight, with a full-screen viewer (on your home Wi-Fi).	Teléfono: tus fotos de vuelo, ordenadas por vuelo, con un visor a pantalla completa (en el Wi-Fi de casa).
Rappel « tracker non lancé » : plus d'alarme au lancement du simulateur. Il attend 5 minutes de roulage ou de vol avant de sonner.	“Tracker not started” reminder: no more alarm when the simulator starts. It waits for 5 minutes of taxiing or flying before ringing.	Aviso «seguimiento no iniciado»: ya no suena al abrir el simulador. Espera 5 minutos de rodaje o de vuelo antes de sonar.
Un vol trop court n'est plus effacé en silence : l'appli te propose de l'enregistrer quand même.	A flight that's too short is no longer silently discarded: the app offers to save it anyway.	Un vuelo demasiado corto ya no se borra en silencio: la aplicación te propone guardarlo de todos modos.
Un roulage rapide (plus de 40 kt au sol) était pris pour un décollage : le vrai vol devenait un rebond et était rejeté comme « trop court ».	A fast taxi (over 40 kt on the ground) was mistaken for a takeoff: the real flight became a bounce and was rejected as “too short”.	Un rodaje rápido (más de 40 kt en tierra) se tomaba por un despegue: el vuelo real se convertía en un rebote y se rechazaba como «demasiado corto».
Des aéroports restés dans le Briefing passaient devant ceux du vol réel dans le PIREP (ex. LFPG → LFBO pour un LEMD → LEPP). Le terrain où l'avion s'est vraiment posé l'emporte désormais.	Airports left in the Briefing took priority over those of the actual flight in the PIREP (e.g. LFPG → LFBO for an LEMD → LEPP). The airfield where the aircraft really landed now wins.	Los aeropuertos que quedaban en el Briefing tenían prioridad sobre los del vuelo real en el PIREP (p. ej. LFPG → LFBO para un LEMD → LEPP). Ahora gana el aeródromo donde el avión aterrizó de verdad.
Replay 3D de l'approche : l'avion se dressait à la verticale au toucher. Il suit maintenant le cap, l'assiette et l'inclinaison réelles.	3D approach replay: the aircraft stood up vertically at touchdown. It now follows the real heading, pitch and bank.	Repetición 3D de la aproximación: el avión se ponía vertical en la toma. Ahora sigue el rumbo, el cabeceo y la inclinación reales.
🏆 Records personnels	🏆 Personal records	🏆 Récords personales
pays	countries	países
sur ~195	out of ~195	de ~195
Sortie audio	Audio output	Salida de audio
Sortie Windows par défaut	Windows default output	Salida predeterminada de Windows
débranchée	disconnected	desconectada
Casque, enceintes ou entrée VoiceMeeter : choisis où le copilote parle, sans changer la sortie par défaut de Windows.	Headset, speakers or a VoiceMeeter input: choose where the copilot speaks, without changing the Windows default output.	Auriculares, altavoces o entrada de VoiceMeeter: elige dónde habla el copiloto, sin cambiar la salida predeterminada de Windows.
Pause minimale entre deux messages automatiques	Minimum gap between two automatic messages	Pausa mínima entre dos mensajes automáticos
Hublot, nouveaux pays, préavis de survol, quiz… : au plus un message toutes les X minutes dans le chat (0 = sans limite). L'overlay Alertes les affiche quand même ; les réponses aux commandes et les résultats passent toujours.	Window view, new countries, flyover heads-ups, quizzes…: at most one message every X minutes in chat (0 = no limit). The Alerts overlay still shows them; command replies and results always go through.	Ventanilla, nuevos países, avisos de sobrevuelo, quiz…: como máximo un mensaje cada X minutos en el chat (0 = sin límite). El overlay de Alertas los muestra igualmente; las respuestas a comandos y los resultados siempre pasan.
Copilote sur ta sortie audio, bot plus discret	Copilot on your audio output, quieter bot	Copiloto en tu salida de audio, bot más discreto
Copilote vocal : choix de la sortie audio (casque, enceintes, entrée VoiceMeeter…), sans changer la sortie par défaut de Windows.	Voice copilot: choose the audio output (headset, speakers, VoiceMeeter input…) without changing the Windows default output.	Copiloto de voz: elige la salida de audio (auriculares, altavoces, entrada de VoiceMeeter…) sin cambiar la salida predeterminada de Windows.
Bot plus discret : pause réglable entre deux messages automatiques (À bord → Animations de croisière, 6 min par défaut), vue du hublot et quiz moins fréquents.	Quieter bot: adjustable gap between two automatic messages (On board → Cruise animations, 6 min by default), less frequent window views and quizzes.	Bot más discreto: pausa ajustable entre dos mensajes automáticos (A bordo → Animaciones de crucero, 6 min por defecto), vistas desde la ventanilla y quiz menos frecuentes.
Moins de messages inutiles dans le chat : plus de vue du hublot sans ville, ni de réponse de quiz, de fermeture ou de résultat de paris quand personne n'a joué.	Fewer pointless chat messages: no more window views with no city, nor quiz answers, bet closing or bet results when nobody played.	Menos mensajes inútiles en el chat: se acabaron las vistas desde la ventanilla sin ciudad, las respuestas de quiz y el cierre o resultado de apuestas cuando nadie ha jugado.
Délai anti-spam par défaut (commandes du vol)	Default anti-spam delay (flight commands)	Retardo antispam por defecto (comandos del vuelo)
Délai anti-spam en secondes (vide = par défaut)	Anti-spam delay in seconds (empty = default)	Retardo antispam en segundos (vacío = por defecto)
Nouveau nom de la commande (vide = !{0})	New command name (empty = !{0})	Nuevo nombre del comando (vacío = !{0})
Renomme une commande (ex.	Rename a command (e.g.	Cambia el nombre de un comando (p. ej.
déjà pris par un autre bot) ou change son délai anti-spam. Une commande renommée ne répond plus à son nom d'origine. Champs vides = réglages d'origine.	already used by another bot) or change its anti-spam delay. A renamed command no longer answers to its original name. Empty fields = original settings.	ya usado por otro bot) o cambia su retardo antispam. Un comando renombrado ya no responde a su nombre original. Campos vacíos = ajustes originales.
Même nom pour plusieurs commandes : {0} — une seule y répondra.	Same name for several commands: {0} — only one will answer.	Mismo nombre para varios comandos: {0} — solo uno responderá.
Vol et paris	Flight and bets	Vuelo y apuestas
À bord (miles, passeport…)	On board (miles, passport…)	A bordo (millas, pasaporte…)
miles, statut et classement du viewer	viewer's miles, status and ranking	millas, estatus y clasificación del viewer
tampons et pays visités	stamps and countries visited	sellos y países visitados
ville du viewer, saluée au survol	viewer's city, greeted when flying over	ciudad del viewer, saludada al sobrevolarla
correspondances enchaînées	chained connections	conexiones encadenadas
liste des passagers à bord	list of passengers on board	lista de pasajeros a bordo
réponse au quiz du hublot	answer to the window quiz	respuesta al quiz de la ventanilla
pronostic de l'heure d'arrivée	arrival time guess	pronóstico de la hora de llegada
aide des commandes À bord	help for the On board commands	ayuda de los comandos A bordo
Alertes dans le chat	Chat alerts	Alertas en el chat
Nouveau METAR à destination	New METAR at destination	Nuevo METAR en destino
Annoncé dans le chat seulement, pendant le vol	Announced in chat only, during the flight	Anunciado solo en el chat, durante el vuelo
Excès de vitesse au roulage	Taxi speeding	Exceso de velocidad en rodaje
Au-dessus de la limite pendant 10 s, au sol	Above the limit for 10 s, on the ground	Por encima del límite durante 10 s, en tierra
Limite de vitesse au roulage	Taxi speed limit	Límite de velocidad en rodaje
Commandes du vol : {0}	Flight commands: {0}	Comandos del vuelo: {0}
Commandes du vol : {0} · À bord : {1}	Flight commands: {0} · On board: {1}	Comandos del vuelo: {0} · A bordo: {1}
🌦️ Nouveau METAR à {0} : {1}	🌦️ New METAR at {0}: {1}	🌦️ Nuevo METAR en {0}: {1}
🚨 Excès de vitesse au roulage : {0} kt (limite {1} kt) !	🚨 Taxi speeding: {0} kt (limit {1} kt)!	🚨 Exceso de velocidad en rodaje: {0} kt (límite {1} kt)!
({0} dépensés)	({0} spent)	({0} gastadas)
: tapez	: type	: escribid
Tapez	Type	Escribid
@{0} article inconnu au duty free. Catalogue : !dutyfree badges, titres ou couleurs.	@{0} unknown duty free item. Catalogue: !dutyfree badges, titles or colors.	@{0} artículo desconocido en el duty free. Catálogo: !dutyfree insignias, títulos o colores.
@{0} c'est retiré (tu le gardes, !acheter pour le remettre).	@{0} removed (you keep it, !buy to wear it again).	@{0} retirado (lo conservas, !comprar para volver a ponértelo).
@{0} précise ce que tu retires : !acheter retirer badge, titre ou couleur.	@{0} say what to remove: !buy remove badge, title or color.	@{0} indica qué quitas: !comprar quitar insignia, título o color.
@{0} {1} {2} coûte {3} miles, ton solde est de {4}. Encore quelques vols !	@{0} {1} {2} costs {3} miles, your balance is {4}. A few more flights!	@{0} {1} {2} cuesta {3} millas, tu saldo es de {4}. ¡Unos vuelos más!
@{0} {1} {2} remis (déjà acheté).	@{0} {1} {2} back on (already bought).	@{0} {1} {2} puesto de nuevo (ya comprado).
Accélération verticale, en montée, croisière et descente	Vertical acceleration, in climb, cruise and descent	Aceleración vertical, en ascenso, crucero y descenso
Active d'abord l'alerte turbulences (réglages à gauche).	Turn on the turbulence alert first (settings on the left).	Activa primero la alerta de turbulencias (ajustes a la izquierda).
Allume le signal ceinture maintenant (alerte turbulences activée, passagers à bord)	Turn the seatbelt sign on now (turbulence alert on, passengers on board)	Enciende la señal de cinturón ahora (alerta de turbulencias activada, pasajeros a bordo)
Attachez vos ceintures !	Fasten your seatbelts!	¡Abróchense los cinturones!
Au plus une alerte automatique toutes les 10 min. Un viewer ne perd jamais les miles qu'il a déjà dépensés au duty free.	At most one automatic alert every 10 min. A viewer never loses miles already spent at the duty free.	Como mucho una alerta automática cada 10 min. Un viewer nunca pierde las millas ya gastadas en el duty free.
Aucun achat.	No purchases.	Ninguna compra.
Badges	Badges	Insignias
Titres	Titles	Títulos
Duty free	Duty free	Duty free
En moyenne toutes les	On average every	De media cada
Faible (fortes secousses seulement)	Low (strong bumps only)	Baja (solo sacudidas fuertes)
Moyenne	Medium	Media
Forte (la moindre secousse)	High (the slightest bump)	Alta (la mínima sacudida)
Impossible maintenant : il faut un vol en cours, pas d'alerte déjà en cours, et au moins un passager actif dans le chat.	Not possible now: you need a flight in progress, no alert already running, and at least one active passenger in chat.	No es posible ahora: hace falta un vuelo en curso, ninguna alerta ya en marcha y al menos un pasajero activo en el chat.
Les achats se paient sur le solde (miles gagnés − miles dépensés) : le statut et le classement ne baissent pas. Les cosmétiques apparaissent dans le chat, sur les overlays et sur le carnet de vol public.	Purchases are paid from the balance (miles earned − miles spent): status and ranking don't drop. Cosmetics show in chat, on the overlays and on the public logbook.	Las compras se pagan con el saldo (millas ganadas − millas gastadas): el estatus y la clasificación no bajan. Los cosméticos aparecen en el chat, en los overlays y en el diario de vuelo público.
Les passagers actifs dans le chat bouclent leur ceinture à temps, sinon ils perdent des miles	Active passengers in chat buckle up in time, or they lose miles	Los pasajeros activos en el chat se abrochan a tiempo, o pierden millas
Les viewers dépensent leurs miles en badges, titres et couleurs de pseudo	Viewers spend their miles on badges, titles and name colors	Los viewers gastan sus millas en insignias, títulos y colores de nombre
Miles perdus sans ceinture	Miles lost without seatbelt	Millas perdidas sin cinturón
Même sans secousses, pour animer le chat	Even without bumps, to liven up the chat	Incluso sin sacudidas, para animar el chat
Prix	Prices	Precios
Sans ceinture : {0}{1}	No seatbelt: {0}{1}	Sin cinturón: {0}{1}
Secousses réelles du simulateur	Real bumps from the simulator	Sacudidas reales del simulador
Sensibilité	Sensitivity	Sensibilidad
Signal ceinture allumé ✓	Seatbelt sign on ✓	Señal de cinturón encendida ✓
Signal ceinture éteint	Seatbelt sign off	Señal de cinturón apagada
Temps pour boucler sa ceinture	Time to buckle up	Tiempo para abrocharse
Tout le monde était attaché, bravo !	Everyone was buckled up, well done!	¡Todos llevaban el cinturón, bravo!
Turbulences	Turbulence	Turbulencias
Turbulences surprises en croisière	Surprise turbulence in cruise	Turbulencias sorpresa en crucero
acheter (ou remettre) un article du duty free	buy (or wear again) a duty free item	comprar (o volver a ponerse) un artículo del duty free
boucler sa ceinture pendant les turbulences	buckle up during turbulence	abrocharse durante las turbulencias
catalogue du duty free et solde de miles	duty free catalogue and miles balance	catálogo del duty free y saldo de millas
dans les {0} s	within {0} s	en {0} s
pas encore de miles (!embarquer au prochain vol)	no miles yet (!board on the next flight)	aún sin millas (!embarcar en el próximo vuelo)
ton solde : {0} miles	your balance: {0} miles	tu saldo: {0} millas
⚠️ Turbulences ! Le signal ceinture s'allume : tapez !ceinture dans les {0} s !	⚠️ Turbulence! The seatbelt sign is on: type !seatbelt within {0} s!	⚠️ ¡Turbulencias! Se enciende la señal de cinturón: ¡escribid !cinturon en {0} s!
⚠️ Turbulences ! Le signal ceinture s'allume : tapez !ceinture dans les {0} s, sinon {1} miles s'envolent !	⚠️ Turbulence! The seatbelt sign is on: type !seatbelt within {0} s, or {1} miles fly away!	⚠️ ¡Turbulencias! Se enciende la señal de cinturón: escribid !cinturon en {0} s, ¡o volarán {1} millas!
⚠️ Turbulences : {0}/{1} ceintures bouclées	⚠️ Turbulence: {0}/{1} seatbelts fastened	⚠️ Turbulencias: {0}/{1} cinturones abrochados
✅ Signal ceinture éteint. Ceintures bouclées : {0}. Tout le monde était attaché, bravo !	✅ Seatbelt sign off. Buckled up: {0}. Everyone was buckled up, well done!	✅ Señal de cinturón apagada. Con cinturón: {0}. ¡Todos llevaban el cinturón, bravo!
✅ Signal ceinture éteint. Ceintures bouclées : {0}. 😵 Sans ceinture (−{1} miles) : {2}.	✅ Seatbelt sign off. Buckled up: {0}. 😵 No seatbelt (−{1} miles): {2}.	✅ Señal de cinturón apagada. Con cinturón: {0}. 😵 Sin cinturón (−{1} millas): {2}.
✅ Signal ceinture éteint. 😵 Sans ceinture (−{0} miles) : {1}.	✅ Seatbelt sign off. 😵 No seatbelt (−{0} miles): {1}.	✅ Señal de cinturón apagada. 😵 Sin cinturón (−{0} millas): {1}.
🛍️ Duty free · @{0} {1} · rayons : !dutyfree badges (dès {2}) · !dutyfree titres (dès {3}) · !dutyfree couleurs (dès {4}) · achat : !acheter + nom de l'article	🛍️ Duty free · @{0} {1} · aisles: !dutyfree badges (from {2}) · !dutyfree titles (from {3}) · !dutyfree colors (from {4}) · buy: !buy + item name	🛍️ Duty free · @{0} {1} · secciones: !dutyfree insignias (desde {2}) · !dutyfree títulos (desde {3}) · !dutyfree colores (desde {4}) · compra: !comprar + nombre del artículo
🛍️ {0} : {1} · {2} · achat : !acheter + nom de l'article	🛍️ {0}: {1} · {2} · buy: !buy + item name	🛍️ {0}: {1} · {2} · compra: !comprar + nombre del artículo
🛍️ {0} s'offre {1} {2} au duty free (−{3} miles, solde {4}) !	🛍️ {0} treats themself to {1} {2} at the duty free (−{3} miles, balance {4})!	🛍️ ¡{0} se regala {1} {2} en el duty free (−{3} millas, saldo {4})!
{0} s'offre {1}	{0} treats themself to {1}	{0} se regala {1}
Avion de tourisme	Light aircraft	Avioneta
Hélico	Chopper	Helicóptero
Café du cockpit	Cockpit coffee	Café de cabina
Parachute	Parachute	Paracaídas
Canard en plastique	Rubber duck	Patito de goma
Globe-trotteur	Globetrotter	Trotamundos
OVNI	UFO	OVNI
Dragon	Dragon	Dragón
Diamant	Diamond	Diamante
Passager clandestin	Stowaway	Polizón
Spotteur	Spotter	Spotter
Personnel de cabine	Cabin crew	Tripulante de cabina
Chef de cabine	Purser	Sobrecargo
Contrôleur aérien	Air traffic controller	Controlador aéreo
As du manche	Flying ace	As del pilotaje
Bleu ciel	Sky blue	Azul cielo
Vert radar	Radar green	Verde radar
Orange balise	Beacon orange	Naranja baliza
Rose aurore	Dawn pink	Rosa aurora
Or	Gold	Oro
Arc-en-ciel	Rainbow	Arcoíris
!acheter canard	!buy duck	!comprar pato
Après chaque vol	After each flight	Después de cada vuelo
Aucun vol ne correspond à ces filtres.	No flight matches these filters.	Ningún vuelo coincide con estos filtros.
Avec tracé	With track	Con trazado
Branche	Branch	Rama
Comment le mettre en ligne à la main (GitHub Pages)	How to put it online by hand (GitHub Pages)	Cómo publicarlo a mano (GitHub Pages)
Créer le jeton GitHub (2 min)	Create the GitHub token (2 min)	Crear el token de GitHub (2 min)
Crée le dépôt public du carnet sur GitHub (par exemple	Create the public logbook repository on GitHub (for example	Crea el repositorio público del diario en GitHub (por ejemplo
). Il peut être vide.	). It can be empty.	). Puede estar vacío.
Repository access :	Repository access:	Repository access:
→ choisis	→ pick	→ elige
uniquement	only	solo
le dépôt du carnet.	the logbook repository.	el repositorio del diario.
Permissions → Repository permissions :	Permissions → Repository permissions:	Permissions → Repository permissions:
. Ajoute	. Add	. Añade
si tu veux que FlightBrief active le site tout seul.	if you want FlightBrief to turn the site on by itself.	si quieres que FlightBrief active el sitio solo.
Copie le jeton (il commence par	Copy the token (it starts with	Copia el token (empieza por
) et colle-le ici. Il est chiffré sur ton PC et ne donne accès à aucun autre dépôt.	) and paste it here. It is encrypted on your PC and gives access to no other repository.	) y pégalo aquí. Se cifra en tu PC y no da acceso a ningún otro repositorio.
→ « Generate new token ».	→ “Generate new token”.	→ «Generate new token».
Dépôt GitHub	GitHub repository	Repositorio de GitHub
Enregistre d'abord ton jeton GitHub.	Save your GitHub token first.	Guarda primero tu token de GitHub.
FlightBrief : carnet de vol mis à jour ({0} vols{1})	FlightBrief: logbook updated ({0} flights{1})	FlightBrief: diario actualizado ({0} vuelos{1})
Jeton GitHub (fine-grained, limité à ce dépôt)	GitHub token (fine-grained, limited to this repository)	Token de GitHub (fine-grained, limitado a este repositorio)
Me demander avant de publier	Ask me before publishing	Preguntarme antes de publicar
Ne rien publier	Don't publish	No publicar
Ouvrir la page des jetons GitHub	Open the GitHub tokens page	Abrir la página de tokens de GitHub
Publication automatique sur GitHub Pages	Automatic publishing to GitHub Pages	Publicación automática en GitHub Pages
Publier automatiquement	Publish automatically	Publicar automáticamente
Publier maintenant	Publish now	Publicar ahora
Publier	Publish	Publicar
Rechercher : indicatif, OACI, appareil, remarque…	Search: callsign, ICAO, aircraft, remark…	Buscar: indicativo, OACI, avión, observación…
Réinitialiser	Reset	Restablecer
Tous les PIREP	All PIREPs	Todos los PIREP
Tous les appareils	All aircraft	Todos los aviones
Toutes les années	All years	Todos los años
Toutes les carrières	All careers	Todas las carreras
VFR et IFR	VFR and IFR	VFR e IFR
Vérifier l'accès	Check access	Comprobar el acceso
{0} vol{1} sur {2} · {3}	{0} flight(s) of {2} · {3}	{0} vuelo(s) de {2} · {3}
Publication sur GitHub…	Publishing to GitHub…	Publicando en GitHub…
Accès en écriture à {0} ✓	Write access to {0} ✓	Acceso de escritura a {0} ✓
Dépôt privé : GitHub Pages demande un dépôt public avec un compte gratuit.	Private repository: GitHub Pages needs a public repository on a free account.	Repositorio privado: GitHub Pages necesita un repositorio público con una cuenta gratuita.
Carnet publié ✓ {0} vols, {1} passagers, {2} fichiers mis à jour.	Logbook published ✓ {0} flights, {1} passengers, {2} files updated.	Diario publicado ✓ {0} vuelos, {1} pasajeros, {2} archivos actualizados.
Déjà à jour sur GitHub ✓	Already up to date on GitHub ✓	Ya actualizado en GitHub ✓
Active GitHub Pages dans les réglages du dépôt (Settings → Pages → Branch : main / root).	Turn GitHub Pages on in the repository settings (Settings → Pages → Branch: main / root).	Activa GitHub Pages en los ajustes del repositorio (Settings → Pages → Branch: main / root).
Jeton enregistré et chiffré ✓	Token saved and encrypted ✓	Token guardado y cifrado ✓
Jeton supprimé de ce PC. Pense à le révoquer aussi sur GitHub.	Token removed from this PC. Remember to revoke it on GitHub too.	Token borrado de este PC. Recuerda revocarlo también en GitHub.
Aucun jeton enregistré.	No token saved.	Ningún token guardado.
Jeton enregistré ({0}) ·	Token saved ({0}) ·	Token guardado ({0}) ·
supprimer	remove	borrar
Nouveau vol enregistré. Publier le carnet sur GitHub Pages ?	New flight saved. Publish the logbook to GitHub Pages?	Nuevo vuelo guardado. ¿Publicar el diario en GitHub Pages?
Publication impossible : {0}	Publishing failed: {0}	No se pudo publicar: {0}
Ce jeton est un jeton « classique » : il donne accès à tous tes dépôts. Crée plutôt un jeton « fine-grained » limité au seul dépôt du carnet.	This is a “classic” token: it gives access to all your repositories. Create a “fine-grained” token limited to the logbook repository instead.	Este es un token «clásico»: da acceso a todos tus repositorios. Crea mejor un token «fine-grained» limitado al repositorio del diario.
Jeton non reconnu : un jeton « fine-grained » commence par github_pat_.	Token not recognised: a “fine-grained” token starts with github_pat_.	Token no reconocido: un token «fine-grained» empieza por github_pat_.
Indique le dépôt sous la forme compte/dépôt (ex : LLCenLive/carnet).	Enter the repository as account/repository (e.g. LLCenLive/carnet).	Indica el repositorio como cuenta/repositorio (p. ej. LLCenLive/carnet).
Jeton refusé par GitHub (expiré ou révoqué ?). Crée-en un nouveau.	Token rejected by GitHub (expired or revoked?). Create a new one.	Token rechazado por GitHub (¿caducado o revocado?). Crea uno nuevo.
Le jeton n'a pas le droit d'écrire dans {0} : donne-lui « Contents : Read and write » sur ce dépôt.	The token may not write to {0}: give it “Contents: Read and write” on this repository.	El token no puede escribir en {0}: dale «Contents: Read and write» en este repositorio.
Dépôt {0} introuvable avec ce jeton : vérifie le nom (compte/dépôt) et que le jeton a bien accès à ce dépôt.	Repository {0} not found with this token: check the name (account/repository) and that the token has access to it.	Repositorio {0} no encontrado con este token: comprueba el nombre (cuenta/repositorio) y que el token tenga acceso.
Ton compte ne peut pas écrire dans {0}.	Your account cannot write to {0}.	Tu cuenta no puede escribir en {0}.
Publication déjà en cours.	Publishing already in progress.	Publicación ya en curso.
Le site n'a pas été généré (index.html manquant).	The site was not generated (index.html missing).	El sitio no se generó (falta index.html).
({0} en ligne)	({0} online)	({0} en línea)
@{0} donne ton {1} {2} pour apparaître sur la carte quand tu voles : !{3} {4}	@{0} give your {2} {1} to show up on the map when you fly: !{3} {4}	@{0} da tu {1} de {2} para aparecer en el mapa cuando vueles: !{3} {4}
@{0} ton {1} {2} : {3} (!{4} retirer pour l'effacer)	@{0} your {2} {1}: {3} (!{4} remove to delete it)	@{0} tu {1} de {2}: {3} (!{4} quitar para borrarlo)
@{0} ton {1} {2} est effacé : tu n'apparais plus sur la carte.	@{0} your {2} {1} is deleted: you no longer show up on the map.	@{0} tu {1} de {2} está borrado: ya no apareces en el mapa.
@{0} un {1} {2} fait de 3 à 9 chiffres : !{3} {4}	@{0} a {2} {1} is 3 to 9 digits: !{3} {4}	@{0} un {1} de {2} tiene de 3 a 9 cifras: !{3} {4}
Afficher les amis et les viewers qui volent en ligne	Show friends and viewers flying online	Mostrar amigos y viewers que vuelan en línea
Afficher les viewers inscrits depuis le chat	Show viewers registered from chat	Mostrar los viewers inscritos desde el chat
Aucun ami pour l'instant.	No friends yet.	Aún no hay amigos.
CID VATSIM invalide : 3 à 9 chiffres (ex : 1234567).	Invalid VATSIM CID: 3 to 9 digits (e.g. 1234567).	CID de VATSIM no válido: de 3 a 9 cifras (p. ej. 1234567).
VID IVAO invalide : 3 à 9 chiffres (ex : 123456).	Invalid IVAO VID: 3 to 9 digits (e.g. 123456).	VID de IVAO no válido: de 3 a 9 cifras (p. ej. 123456).
Déjà dans ta liste.	Already in your list.	Ya está en tu lista.
Nom (facultatif)	Name (optional)	Nombre (opcional)
Tes amis apparaissent sur la carte quand ils volent sur VATSIM ou IVAO. Les viewers peuvent s'ajouter eux-mêmes depuis le chat avec	Your friends show up on the map when they fly on VATSIM or IVAO. Viewers can add themselves from chat with	Tus amigos aparecen en el mapa cuando vuelan en VATSIM o IVAO. Los viewers pueden añadirse ellos mismos desde el chat con
Viewers en vol	Viewers in flight	Viewers en vuelo
apparaître sur la carte du Briefing quand le viewer vole sur IVAO	show up on the Briefing map when the viewer flies on IVAO	aparecer en el mapa del Briefing cuando el viewer vuela en IVAO
apparaître sur la carte du Briefing quand le viewer vole sur VATSIM	show up on the Briefing map when the viewer flies on VATSIM	aparecer en el mapa del Briefing cuando el viewer vuela en VATSIM
hors ligne	offline	desconectado
✈️ @{0} {1} {2} {3} enregistré : tu apparaîtras sur la carte du stream quand tu voles sur {4}.	✈️ @{0} {2} {1} {3} saved: you will show up on the stream map when you fly on {4}.	✈️ @{0} {1} de {2} {3} guardado: aparecerás en el mapa del stream cuando vueles en {4}.
👥 Amis sur la carte	👥 Friends on the map	👥 Amigos en el mapa
voir	show	ver
Bug	Bug	Error
Signaler un bug	Report a bug	Informar de un error
🐞 Signaler un bug	🐞 Report a bug	🐞 Informar de un error
Résumé	Summary	Resumen
ex : le bot ne répond plus après un atterrissage	e.g. the bot stops answering after a landing	p. ej.: el bot deja de responder tras un aterrizaje
Ce qui se passe	What happens	Qué pasa
Pour le reproduire	To reproduce it	Para reproducirlo
1. Lancer le tracker 2. …	1. Start the tracker 2. …	1. Iniciar el tracker 2. …
Ce que tu attendais	What you expected	Qué esperabas
Joindre les infos techniques	Attach technical info	Adjuntar la información técnica
Versions, système, états (simulateur, bot…) : aucune donnée de vol ni de compte	Versions, system, states (simulator, bot…): no flight or account data	Versiones, sistema, estados (simulador, bot…): ningún dato de vuelo ni de cuenta
Joindre les dernières erreurs	Attach the latest errors	Adjuntar los últimos errores
Chemins du PC, nom de session, jetons et e-mails retirés	PC paths, session name, tokens and e-mails removed	Rutas del PC, nombre de sesión, tokens y e-mails eliminados
Voir exactement ce qui sera joint	See exactly what will be attached	Ver exactamente qué se adjuntará
Ouvrir le rapport sur GitHub	Open the report on GitHub	Abrir el informe en GitHub
Copier le rapport	Copy the report	Copiar el informe
GitHub s'ouvre avec le rapport déjà rempli : connecte-toi puis clique « Submit new issue ». Pas de compte GitHub ? « Copier le rapport » et colle-le où tu veux (Discord, e-mail…).	GitHub opens with the report already filled in: sign in, then click “Submit new issue”. No GitHub account? “Copy the report” and paste it wherever you like (Discord, e-mail…).	GitHub se abre con el informe ya rellenado: inicia sesión y pulsa «Submit new issue». ¿Sin cuenta de GitHub? «Copiar el informe» y pégalo donde quieras (Discord, e-mail…).
Donne au moins un résumé et ce qui se passe.	Give at least a summary and what happens.	Indica al menos un resumen y qué pasa.
Décris d'abord ce qui se passe.	Describe what happens first.	Describe primero qué pasa.
Impossible d'ouvrir GitHub.	Could not open GitHub.	No se pudo abrir GitHub.
GitHub est ouvert. Le rapport est trop long pour l'adresse : il est copié, colle-le dans l'issue (Ctrl+V).	GitHub is open. The report is too long for the address: it has been copied, paste it into the issue (Ctrl+V).	GitHub está abierto. El informe es demasiado largo para la dirección: se ha copiado, pégalo en la issue (Ctrl+V).
GitHub est ouvert avec ton rapport : vérifie-le, puis « Submit new issue ». Merci !	GitHub is open with your report: check it, then “Submit new issue”. Thank you!	GitHub está abierto con tu informe: revísalo y pulsa «Submit new issue». ¡Gracias!
Rapport copié ✓ Colle-le où tu veux (Discord, e-mail…).	Report copied ✓ Paste it wherever you like (Discord, e-mail…).	Informe copiado ✓ Pégalo donde quieras (Discord, e-mail…).
🛫 EFB de MSFS 2024	🛫 MSFS 2024 EFB	🛫 EFB de MSFS 2024
Installer l'appli EFB	Install the EFB app	Instalar la app EFB
Installation…	Installing…	Instalando…
Appli EFB installée ✓ Relance MSFS 2024 : « FlightBrief » apparaît dans les applis de la tablette.	EFB app installed ✓ Restart MSFS 2024: “FlightBrief” shows up in the tablet apps.	App EFB instalada ✓ Reinicia MSFS 2024: «FlightBrief» aparece en las apps de la tableta.
Dossier Community de MSFS 2024 introuvable : le bouton préparera le paquet dans Téléchargements, à glisser toi-même dans Community.	MSFS 2024 Community folder not found: the button will prepare the package in Downloads, to drag into Community yourself.	Carpeta Community de MSFS 2024 no encontrada: el botón preparará el paquete en Descargas, para que lo arrastres tú a Community.
Installée (v{0}) : réinstalle pour passer à la v{1}.	Installed (v{0}): reinstall to move to v{1}.	Instalada (v{0}): reinstala para pasar a la v{1}.
Installée (v{0}) dans {1}	Installed (v{0}) in {1}	Instalada (v{0}) en {1}
Pas encore installée. Dossier Community trouvé : {0}	Not installed yet. Community folder found: {0}	Aún no instalada. Carpeta Community encontrada: {0}
Paquet prêt dans le dossier FlightBrief de tes Téléchargements ✓ Glisse le dossier llcenlive-efb-flightbrief dans le dossier Community de MSFS 2024, puis relance le simulateur.	Package ready in the FlightBrief folder of your Downloads ✓ Drag the llcenlive-efb-flightbrief folder into the MSFS 2024 Community folder, then restart the simulator.	Paquete listo en la carpeta FlightBrief de tus Descargas ✓ Arrastra la carpeta llcenlive-efb-flightbrief a la carpeta Community de MSFS 2024 y reinicia el simulador.
Paquet prêt dans le dossier FlightBrief de tes Téléchargements ✓ La version Microsoft Store de FlightBrief ne peut pas écrire dans le dossier du simulateur : glisse le dossier llcenlive-efb-flightbrief dans ton dossier Community.	Package ready in the FlightBrief folder of your Downloads ✓ The Microsoft Store version of FlightBrief can't write to the simulator's folder: drag the llcenlive-efb-flightbrief folder into your Community folder.	Paquete listo en la carpeta FlightBrief de tus Descargas ✓ La versión Microsoft Store de FlightBrief no puede escribir en la carpeta del simulador: arrastra la carpeta llcenlive-efb-flightbrief a tu carpeta Community.
Version Microsoft Store (v{0}) : les mises à jour arrivent par le Store.	Microsoft Store version (v{0}): updates come through the Store.	Versión Microsoft Store (v{0}): las actualizaciones llegan por la Store.
Version Microsoft Store : les mises à jour arrivent par le Store.	Microsoft Store version: updates come through the Store.	Versión Microsoft Store: las actualizaciones llegan por la Store.
Ajoute FlightBrief à la tablette (EFB) de tous les avions de MSFS 2024, avec les mêmes rubriques que l'appli : Briefing (vol, météo, ATC, amis, OFP), Logbook, Carrière et Live (bot, paris, passagers, classement, chat). FlightBrief doit tourner sur ce PC pendant le vol. Relance le simulateur après l'installation.	Adds FlightBrief to the tablet (EFB) of every MSFS 2024 aircraft, with the same sections as the app: Briefing (flight, weather, ATC, friends, OFP), Logbook, Career and Live (bot, bets, passengers, ranking, chat). FlightBrief must be running on this PC during the flight. Restart the simulator after installing.	Añade FlightBrief a la tableta (EFB) de todos los aviones de MSFS 2024, con las mismas secciones que la app: Briefing (vuelo, meteo, ATC, amigos, OFP), Logbook, Carrera y Live (bot, apuestas, pasajeros, clasificación, chat). FlightBrief debe estar abierto en este PC durante el vuelo. Reinicia el simulador tras la instalación.
Commandes du chat à ta main, duty free, EFB dans MSFS 2024	Your own chat commands, duty free, EFB in MSFS 2024	Tus propios comandos del chat, duty free, EFB en MSFS 2024
Appli FlightBrief dans la tablette (EFB) de MSFS 2024 : Briefing, Logbook, Carrière et Live (bot, paris, passagers, classement, chat). Installation en un clic depuis le Profil.	FlightBrief app on the MSFS 2024 tablet (EFB): Briefing, Logbook, Career and Live (bot, bets, passengers, ranking, chat). One-click install from the Profile.	App FlightBrief en la tableta (EFB) de MSFS 2024: Briefing, Logbook, Carrera y Live (bot, apuestas, pasajeros, clasificación, chat). Instalación con un clic desde el Perfil.
Commandes du chat personnalisables (onglet Twitch) : renomme chaque commande et règle son délai anti-spam. Une commande renommée ne répond plus à son ancien nom.	Customisable chat commands (Twitch tab): rename each command and set its anti-spam delay. A renamed command no longer answers to its old name.	Comandos del chat personalizables (pestaña Twitch): cambia el nombre de cada comando y ajusta su retardo antispam. Un comando renombrado ya no responde a su nombre anterior.
Turbulences : le chat doit taper !ceinture à temps, sinon il perd des miles. Secousses réelles du simulateur, turbulences surprises ou bouton.	Turbulence: chat must type !seatbelt in time or lose miles. Real simulator bumps, surprise turbulence or a button.	Turbulencias: el chat debe escribir !cinturon a tiempo o pierde millas. Sacudidas reales del simulador, turbulencias sorpresa o un botón.
Duty free : les viewers dépensent leurs miles en badges, titres et couleurs de pseudo (!dutyfree, !acheter), visibles dans le chat, sur les overlays et le carnet public.	Duty free: viewers spend their miles on badges, titles and name colors (!dutyfree, !buy), shown in chat, on the overlays and the public logbook.	Duty free: los viewers gastan sus millas en insignias, títulos y colores de nombre (!dutyfree, !comprar), visibles en el chat, en los overlays y en el diario público.
Alertes dans le chat (au choix) : nouveau METAR à destination et excès de vitesse au roulage.	Chat alerts (optional): new METAR at destination and taxi speeding.	Alertas en el chat (opcionales): nuevo METAR en destino y exceso de velocidad en rodaje.
Amis sur la carte du Briefing grâce à leur CID VATSIM / VID IVAO, et les viewers s'y ajoutent eux-mêmes avec !vatsim ou !ivao.	Friends on the Briefing map from their VATSIM CID / IVAO VID, and viewers add themselves with !vatsim or !ivao.	Amigos en el mapa del Briefing gracias a su CID de VATSIM / VID de IVAO, y los viewers se añaden ellos mismos con !vatsim o !ivao.
Carnet de vol public publié automatiquement sur GitHub Pages (jeton limité au dépôt), après chaque vol ou en le demandant.	Public logbook published automatically to GitHub Pages (token limited to the repository), after each flight or on request.	Diario de vuelo público publicado automáticamente en GitHub Pages (token limitado al repositorio), tras cada vuelo o bajo petición.
Recherche et filtres dans le logbook : texte libre, année, réseau, appareil, règles, PIREP, carrière, vols tracés.	Logbook search and filters: free text, year, network, aircraft, rules, PIREP, career, tracked flights.	Búsqueda y filtros en el logbook: texto libre, año, red, avión, reglas, PIREP, carrera, vuelos con trazado.
Bouton « Signaler un bug » : rapport prérempli sur GitHub ou à copier, infos techniques nettoyées de toute donnée personnelle.	“Report a bug” button: report prefilled on GitHub or to copy, technical info cleaned of any personal data.	Botón «Informar de un error»: informe prerrellenado en GitHub o para copiar, información técnica sin datos personales.
Carte du Briefing plus fluide au zoom quand les ATC sont affichés.	Smoother Briefing map zoom when ATC is shown.	Mapa del Briefing más fluido al hacer zoom con el ATC visible.
Version Microsoft Store en préparation (paquet MSIX) : les mises à jour y passeront par le Store.	Microsoft Store version in preparation (MSIX package): updates there will come through the Store.	Versión Microsoft Store en preparación (paquete MSIX): allí las actualizaciones llegarán por la Store.
L'onglet À bord se charge à nouveau correctement : réglages appliqués au bot, vol en cours, classement et cartes postales.	The On board tab loads correctly again: settings applied to the bot, current flight, ranking and postcards.	La pestaña A bordo vuelve a cargarse bien: ajustes aplicados al bot, vuelo en curso, clasificación y postales.
Les overlays affichent les bons noms de commandes, dans la langue de l'appli.	Overlays show the right command names, in the app language.	Los overlays muestran los nombres de comandos correctos, en el idioma de la app.
EFB lisible dans MSFS 2024	Readable EFB in MSFS 2024	EFB legible en MSFS 2024
EFB de MSFS 2024 : lettres accentuées, flèches et symboles s'affichent enfin (polices complètes fournies par FlightBrief).	MSFS 2024 EFB: accented letters, arrows and symbols finally show up (full fonts provided by FlightBrief).	EFB de MSFS 2024: las letras con acento, las flechas y los símbolos por fin se muestran (fuentes completas proporcionadas por FlightBrief).
EFB : l'OFP SimBrief se ferme avec un gros bouton toujours visible ou en touchant le fond, et ses colonnes sont alignées.	EFB: the SimBrief OFP closes with a large always-visible button or by tapping the background, and its columns are aligned.	EFB: el OFP de SimBrief se cierra con un botón grande siempre visible o tocando el fondo, y sus columnas están alineadas.
EFB : statut des passagers en toutes lettres (Argent, Or…) au lieu des emojis, que le simulateur n'affiche pas.	EFB: passenger status in plain words (Silver, Gold…) instead of emojis, which the simulator can't show.	EFB: estatus de los pasajeros en texto (Plata, Oro…) en lugar de emojis, que el simulador no muestra.
`);
