# Töki Autó Kft. · Belső jegyzetek

Magyar nyelvű, offline használható autóbolti belső jegyzetelő Windowsra, külön helyi hálózaton megosztható autónyilvántartóval. A bejegyzések év → hónap → nap szerint rendeződnek, egy napon belül minden névhez külön strukturált adatlap tartozik.

## Windows-indítás és tálca · 1.24.0

A bal alsó **Indítás és tálca** gomb saját, gépenkénti beállításokat nyit. Az **Induljon a Windowsszal** kapcsoló alapból kikapcsolt; mentés után a Windows-felhasználó bejelentkezésekor az óra mellett indul a program. A **Bezáráskor fusson tovább az óra mellett** kapcsoló Windows alatt alapból bekapcsolt. Az X a jegyzetek és munkalapok mentése után elrejti az ablakot; a raktár, a telefonos HTTPS és az emlékeztetők futnak tovább. A tálcaikon megnyitja az ablakot; jobb kattintásból a beállítások és a **Kilépés** érhetők el. Rejtett ikon esetén a Windows **^** menüjében található.

A végső ellenőrző kérdés csak a teljes kilépésnél jelenik meg. A Vissza és az Escape megszakítja a kilépést, mentési hiba vagy hibás ár mellett az ablak nyitva marad. Kikapcsolt tálcára rejtéskor az X is teljes kilépést kezdeményez. Ha a tálcaikon létrehozása sikertelen, a program látható ablakkal indul és teljes bezárásra vált; háttérindítás sem teheti elérhetetlenné. Második indítás a már futó, akár elrejtett ablakot hozza elő.

Az automatikus indítás Electron `setLoginItemSettings` / `getLoginItemSettings` API-val, a saját `TokiAuto` nevű felhasználói bejegyzéssel működik, `--toki-background` argumentummal. A mentés a tényleges Windows-állapotot is ellenőrzi. A `desktop-settings.json` külön, atomi cserével és `.bak` másolattal mentett beállításfájl a meglévő `jegyzetfuzet` profilban. Sikertelen fájlmentés visszaállítja az előző indítási bejegyzést. A csomagolt EXE verziónként változó útvonalát a következő verzió első futása frissíti; a Feladatkezelőben letiltott vagy eltávolított automatikus indítást nem kapcsolja vissza magától. A beállítás-IPC csak a saját főablak főkeretétől fogad két logikai kapcsolót, futtatandó útvonalat nem.

Frissítés előtt **teljesen lépj ki a régi programból a tálcaikon Kilépés menüjével**; az X már háttérben tartja. Ezután a teljes ZIP kibontása és a `TokiAuto-Inditas.cmd` indítása frissíti az asztali parancsikont. Az ügyféladatok, hálózati beállítások és a helyi telefonos tanúsítvány az eredeti helyükön maradnak.

Ellenőrzés: **166 sikeres teszt**, továbbá valódi Electron-ablak, preload és IPC elkülönített mintaadatokkal: mentés előtti ablakbezárás megállítása, ismételt rejtés és visszaállítás, mentési hiba, végső kérdés és Vissza, beállítások újranyitása, háttérindítás és második példány. A hitelesített telefonos HTTPS-leltározó rejtett ablak mellett is elérhető maradt. A natív Windows-indítási és tálca-API-kat a Linux-környezetben helyettesített adapterrel ellenőriztük; fizikai Windows-bejelentkezést itt nem futtattunk.

## Alvázszám felismerése · 1.23.0

A jegyzet alvázszámmezője a **saját, helyben tárolt jegyzetek** minden évében keres. Legalább hat karakter megadása után felajánlja a korábban rögzített autókat, márkával, ügyféllel és a legutóbbi bejegyzésekkel. A teljes VIN egyezését külön jelzi; részletre, például az utolsó hat karakterre is lehet keresni. A keresés kisbetűt, szóközt és kötőjelet figyelmen kívül hagy. A nyitott jegyzetet kizárja a saját előzményei közül.

A **Megnyitás** a kapcsolódó napot és a megfelelő autót választja ki, többautós jegyzetnél is. Az **Összes előzmény** ablak 30 bejegyzésenként lapozható. Az **Új jegyzet mára** az adott előzmény nevével, telefonszámával, alvázszámával és márkájával készít új bejegyzést; a tételek, olaj, megjegyzések, emlékeztetők és belső pipák nem kerülnek át. Eltérő korábbi ügyfelek vagy telefonszámok esetén külön előzményválasztás szükséges. A keresés önmagában nem írja felül az aktuális név- és márkamezőket.

A találati panel a beviteli mező alatt jelenik meg, billentyűzettel is kezelhető: lefelé nyíl a megnyitásra lép, Escape bezár, a tabulátor a gombok között mozog. Hibás ármező mellett az előzmény megnyitása és az új jegyzet készítése is megvárja a javítást. A nevek és szövegek kizárólag szövegként jelennek meg. Nincs külső VIN-adatbázis vagy új hálózati adatküldés; a gépenként külön jegyzetek továbbra is külön maradnak.

A névkártya alatti VIN a név vagy olaj szerkesztése után is megmarad. A kézi / óránkénti mentés, a raktár 50-es lapozása, a megrendelt tételek szerinti jegyzetösszesítés és a munkalap nyomtatási szabályai változatlanul működnek.

Ellenőrzés: **150 sikeres teszt**, továbbá valódi Electron-próba 35 szintetikus előzménnyel: formázott VIN és részlet keresése, megfelelő régi nap és autó megnyitása, lapozás, új mai jegyzet, mentés és újranyitás, több ügyfél választása, billentyűzet és a kilépés megszakítása. Az alkalmazás továbbra is a `jegyzetfuzet` adatkönyvtárat használja.

## Frissítés · 1.22.0

A raktári terméklista oldalanként legfeljebb **50 terméket** mutat. A lapozás minden terméket elérhetően tart; keresés és kategóriaváltás visszalép az első oldalra. Ez a megjelenített sorok korlátja, a készlet mennyiségét nem módosítja.

A jegyzetek névkártyáin a név alatt a bejegyzés kitöltött **alvázszámai** láthatók, teljes szöveggel a rámutatáskor. Kereséskor az alvázszámok mellett a nap is megmarad; hiányzó alvázszámot külön felirat jelez. Cikkszámra továbbra is lehet keresni.

A jegyzet alatti teli ár, kedvezmény és kedvezményes ár összesítése csak a **Megrendelve** pipás tételekre vonatkozik, a kiválasztott autó szerint, darabszámmal szorozva. Például 75 000 Ft-os, nem megrendelt sor és 4 × 86 000 Ft-os, megrendelt sor esetén **344 000 Ft** jelenik meg. Pipa nélkül 0 Ft látszik, ismeretlen árnál „—”, részlegesen ismert áraknál részösszeg. Más belső pipa nem helyettesíti a megrendelést. A teljes tárolt tétellista, a munkalap árajánlati összege és az Excel-export minden tétele megmarad.

Ellenőrzés: a teljes 140 teszt sikeres, köztük 123 termék 50/50/23-as lapozása, szűrés és frissítés, az alvázszámos névkártyák, a megrendelés szerinti összegek, darabszám, autónkénti elkülönítés és hiányzó árak. A program az 1.21.0-s forrásverzióra épül. A csomagnév továbbra is `jegyzetfuzet`, ezért a korábbi Windows-adatkönyvtárat használja.

## Telefonos kamerafelismerés · 1.14.1

Az élő videó leolvasása megvárja a tényleges képméretet és az olvasható képkockát, nem tart fenn egy kezdetben nulla vagy elfordulás után elavult méretű dekódolóvásznat. Minden képkocka aktuális mérettel készül, TRY_HARDER móddal, külön 90 fokos próbával és időnként középső kivágással. A kérés 1920×1080-as hátlapi képet preferál; a tényleges beállítás a telefon képességétől függ. A támogatott fókusz, nagyítás, lámpa és kameralista opcionális: hiányuk nem állítja le a felismerést. Az aktív kameráról és a sikertelen olvasásról látható visszajelzés van. Stop, kameracsere és kilépés megszünteti a streamet és a feldolgozó időzítőt.

Új **Fotó készítése / kép beolvasása** útvonal a készülék natív fényképezőjéhez/képválasztójához. Az állókép két méretben, teljes képpel és középső kivágással, elforgatva is olvasható; a fájl és a képpontok a telefonon maradnak. A CSP csak a saját ideiglenes blob-képforrást engedi még hozzá. A felismerés nem készít készletműveletet; a termék és darabszám jóváhagyása megmaradt. A szerver címe, a helyi CA, a telefonos kód, a készlet és a jegyzetadatok változatlan helyen maradnak.

A valódi Chromium-próba későn olvasható videóméretet, vízszintes és függőleges EAN-13-at, Code 128-at és fájlválasztóból érkező elfordított fotót is tesztel. Fizikai iPhone-on a felhasználó konkrét címkéjét továbbra is helyben kell kipróbálni.

## Közös raktár, vonalkód és jegyzetkapcsolat · 1.14.0

A **Raktár / leltár** részleg közös terméklistát, cikkszámot, több vonalkódot és egész darabszámú készletet kezel. Az autónyilvántartó működő központ/csatlakozó beállítását használja, annak portja+1-en; a külön telefonos HTTPS-felület portja+2. Az eredeti autólista protokollja és portja változatlan. A központ első Raktár-megnyitása engedélyezi az induláskor automatikusan elinduló készletszolgáltatást. Beállítatlan autóhálózatnál helyi próbakészletet jelez, ezeket nem egyesíti automatikusan. Kezelés és tanúsítványtelepítés: [RAKTAR-UTMUTATO.txt](RAKTAR-UTMUTATO.txt). Képernyőképes lépések: [képes útmutató](RAKTAR-KEPES-UTMUTATO.md), [letölthető PDF](downloads/raktar-utmutato/TokiAuto-Kepes-Beallitas.pdf).

A billentyűzetként működő vonalkódolvasó Enterrel küldi a kódot. Ismert kódnál új bevételezés készül, ismeretlennél termékfelvitel szükséges. A gyors egymás utáni beolvasások tartós, műveletazonosítóval ellátott helyi sorba kerülnek; újraindítás utáni folytatás nem számol újra egy már sikeres bevételezést. Terméknévre, cikkszámra és vonalkódra is lehet keresni; a lista az 1.22.0-s verziótól 50-es lapozású. Termékadat szerkesztése összehasonlított adatbázis-revízióval védett; a készlet külön, idempotens műveletekkel változik. Korrekcióhoz indok kell; negatív készlet és aktív készletkapcsolattal rendelkező termék törlése tiltott. Egy termékhez több kód tartozhat, a kódok és cikkszámok egyediek.

A jegyzetek tételsorának **Raktárról** pipája (`fromStock`, `stockProductId`) kizárólag jelölt tételeket kapcsol a készlethez. A pipa azonnali explicit mentés, a mennyiségkorrekció a mező change eseményén ment, más szöveggépelés továbbra is csak memóriát módosít. Kivétel, mennyiségcsökkentés, tétel/jegyzet törlése visszaadja a korábban levont darabszámot a sikeres mentéskor. Cikkszámcsere bontja a kapcsolatot; az új termékhez új jelölés kell. Munkalap-készítés nem terhel másodszor készletet. A helyi mentés nem használ készletkapcsolatot, ha nincs módosult raktári hivatkozás; az egyszerű saját jegyzetek központ nélkül is menthetők.

A központ az eszköz azonosítója és monoton műveletsorszáma szerint tárolja az összes aktuális készletfoglalást. A forrásazonosítók a jegyzet/tétel azonosítóinak SHA-256 kivonatai; ügyfélnév, telefon, VIN és jegyzetszöveg nem utazik a raktárba. A különbséget egyetlen szerializált, atomi adatbáziscsere alkalmazza, az elégtelen készlet teljes műveletet elutasít. A helyi jegyzet–raktár napló hálózati válaszvesztés és lemezhiba után újrapróbálható; azonos sorszám és tartalom nem von le másodszor. Függő journal mellett a régi lemezállapotból új mentés nem indul. A bevételezés külön tartós műveletazonosítóval idempotens, a telefon bizonytalan kérését localStorage őrzi. Sérült adatbázis nem válik üres készletté.

A telefon külön, 128 bites helyi kóddal kapcsolódik, csak termékfelvételt és bevételezést végezhet. Terméknévre, cikkszámra és vonalkódra is kereshet; névrészletnél választható találati listát kap. A helyben csomagolt ZXing dekódolja a kamera képét, egy kód után leállítja a kamerát, majd a kezelő ellenőrzi és jóváhagyja a darabszámot. A kamera engedélyezéséhez a főgép saját CA-tanúsítványát a telefonon telepíteni és megbízhatónak jelölni kell; enélkül kézi kódbevitel érhető el, amennyiben a böngésző az oldalt megnyitja. A saját CA kulcsa a főgépen marad, az IP-címek a szervertanúsítvány SAN mezőjében vannak; IP-váltás utáni újraindítás azonos CA-val új szervertanúsítványt készít. Idegen Origin, helyi hálózaton kívüli cím és hibás kód tiltott. A telefonos API nem fogad jegyzetfoglalást, törlést vagy készletkorrekciót. Nincs internetre nyitott szolgáltatás vagy külső termékkatalógus.

Excel-exportban a közös raktár külön adatkör, aktuális készlettel és az utolsó 100 mozgással. A jegyzet-export tartalmazza a Raktárról jelölést is. Teljes raktármentés csak a központon kérhető, tartalmazza a teljes idempotencia- és foglalási állapotot. A saját JSON-mentés az adott gép készlethivatkozási metaadatait is őrzi. A központi mentés és a gépenkénti hivatkozások összetartoznak; visszaállítás előtt minden gépen be kell zárni a programot és összehangolt helyreállítást kell végezni.

Ellenőrzés: készletmotor és HTTPS-hálózat tesztjei, négy futó Electron-alkalmazás külön profilokkal (`scripts/verify-inventory.cjs`), ismételt és párhuzamos eladások, mennyiségi korrekció, visszaadás, elégtelen készlet, magánadatok elkülönítése és Excel-visszaolvasás. A `scripts/verify-phone-camera.cjs` valóban biztonságos Chromium-környezetben, kizárólag a teszt CA-ját megbízva dekódol EAN-13 videóképet, majd válaszvesztést és idempotens telefonos újrapróbálást is ellenőriz. Ez nem helyettesíti az adott fizikai telefon kamera-/tanúsítványbeállításának helyszíni próbáját. A korábbi jegyzet-, nyomtatási-, ébresztő- és autóhálózati tesztek is futnak.

## Excel-export és tételenkénti Felírva · 1.13.0

A bal alsó **Mentés Excelbe** gomb saját jegyzeteket, saját munkalapokat vagy közös autónyilvántartót exportál `.xlsx` munkafüzetbe. Saját adatoknál minden vagy a kiválasztott bejegyzés menthető; a kiválasztott jegyzet minden autója és tétele bekerül, a keresőszűrés nem szűkíti az összes adat exportját. Az export előtt a saját módosítások kézi mentése lefut; hibánál nem készül régi adatokat tartalmazó export. A közös lista az aktuális hálózati szolgáltatásból származik, a privát jegyzetek soha nem kerülnek abba a munkafüzetbe.

A munkafüzet külön lapokon tartalmazza a bejegyzéseket, autókat, tételeket és emlékeztetőket; munkalapnál a dokumentumokat és tételeket. Az árak számok, az alvázszám/rendszám/cikkszám szöveg, így a vezető nullák megmaradnak. A felhasználói szöveg képletként vagy hivatkozásként nem értelmeződik. A 32 000 karakternél hosszabb szöveg külön **Hosszú szövegek** lapon, forráslappal, sorszámmal, oszloppal és részszámmal teljes egészében megmarad. A fájl ideiglenes fájlból kerül a kiválasztott célra; hiba esetén a korábbi célfájl megmarad. A JSON biztonsági mentés külön megmaradt. Az Excel belső adatokat, cikkszámokat és jelöléseket is tartalmaz; az ügyfélnyomtatás/PDF mezőlistája változatlan.

A jegyzetek tételsorában a Fizetve mellett **Felírva** pipa található. Az opcionális `recorded` logikai mező gépenként külön mentődik, régi soroknál alapból nincs jelölve. A névbuborék piros felkiáltójele akkor látható, ha bármelyik autó valamelyik kitöltött tétele Megrendelve és nincs Felírva. A tételszintű rendelés számít, a név általános munkafolyamat-státuszától függetlenül. Fizetés és megérkezés nem módosítja. Cikkszám/megnevezés cseréje törli, ár vagy darabszám javítása megtartja. A jelölés bekerül a helyi JSON- és Excel-mentésbe, az ügyfélnyomtatásba nem.

Ellenőrzés: XLSX írás és visszaolvasás, vezető nullák, számcellák, képletként kezdődő szöveg, többautós hozzárendelés, jelölések, hosszú szöveg, célfájl megőrzése hibánál; felületi próba több tétellel, pipaváltás és újranyitás. A `scripts/verify-excel-recorded.cjs` valódi Electron ablakban ellenőrzi a jelzést, az exportfelületet és az IPC-n át létrejövő olvasható XLSX fájlt.

## Autó törlése utáni kiválasztás · 1.12.2

A törölt autó üres tételsorai nem hoznak létre hozzárendelés nélküli buborékot. A kiválasztás az előző megmaradt autóra áll vissza (első autó törlésekor az első megmaradtra). A kitöltött sorok adatai és jelölései a hozzárendelés nélküli listában megmaradnak. Korábbi üres hozzárendelés nélküli kiválasztás betöltéskor az első autóra vált, ha nincs ott kitöltött tétel. A kézi és óránkénti mentés változatlan.

## Kiválasztott autó adatmezői · 1.12.1

A jegyzetekben minden felső autóbuborék megmarad; az alvázszám és márka mezői közül csak a kiválasztott autó sora látható. A többi autó adatai a memóriában és mentésben változatlanul megmaradnak. Új autó hozzáadásakor annak sora nyílik meg; törlés után a következő kiválasztott autóé. A hozzárendelés nélküli tételeknél nincs kiválasztott alvázszámsor. A kézi/óránkénti mentés és a hálózati autónyilvántartó változatlan.

## Kézi és óránkénti mentés · 1.12.0

A jegyzetek és munkalapok szerkesztése csak a memóriában jelöli a módosításokat; gépelés és lapváltás nem írja ki őket. A fejléc **Mentés · Ctrl+S** gombja, a Ctrl+S, az óránkénti időzítő és a jóváhagyott normál bezárás menti a legutolsó állapotot. A tiszta állapot óránként sem indít fölösleges kiírást. Sikertelen mentés újrapróbálható, hiba esetén a bezárás nem engedélyezett. Váratlan leálláskor akár egyórányi nem mentett munka elveszhet: fontos javítás után használj kézi mentést.

Az emlékeztető szerkesztőjének Mentés gombja, a Kész/Szundi és az adatcserét megelőző explicit mentések továbbra is azonnal rögzítenek. A közös autónyilvántartó írási és frissítési útvonala változatlan. A privát jegyzetek és munkalapok fájlja, a felhasználói adatkönyvtár neve és a hálózati elkülönítés változatlan.

A felületi tesztek külön ellenőrzik a mentés nélküli, külön eseményekben történő gépelést, a lapváltást, a gombot, Ctrl+S-t, a valódi 3 600 000 ms-os időzítő callbackjét, a tiszta óránkénti ciklust és a bezáráskori utolsó karaktert. A `scripts/verify-manual-save.cjs` valódi Electron ablakban ellenőrzi a lemez változatlanságát gépelés közben, a kézi mentést és az újranyitást.

## Élő gépelés gyorsítása és Megérkezett pipa · 1.11.0

A korábbi, kötegelt beviteli próba mellett most külön időzített leütésekkel is mérünk. A gépelés során a felület már **csak a módosított jegyzeteket és a törölt azonosítókat** adja át a helyi mentési végpontnak, nem a több ezer jegyzetből álló teljes adatállományt. A főfolyamat a legfrissebb helyi fájlba egyesíti a változásokat, megőrizve a többi jegyzetet, az új nevek első helyét és a törléseket. Az adatfájl formátuma, helye, az atomi fájlcsere és a korábbi biztonsági másolatok megmaradnak. Függő mentés közben keletkezett újabb változatot nem törlünk a várólistáról; hibás mentés után a módosítások újrapróbálhatók. Bezáráskor továbbra is megvárjuk a teljes sort.

Név, telefon, olaj és megjegyzés gépelése nem építi újra feleslegesen a teljes napi névsort és nem számolja újra az árakat, ha azokat a mező nem érinti. A kereső gyorsítótára az érintett jegyzet módosításakor továbbra is érvénytelenedik. A `save-note-changes` kizárólag helyi Electron IPC, a hálózati autónyilvántartóhoz sem adatot, sem új végpontot nem ad.

A Jegyzetek cikkszámsoraiban a **Fizetve mellett külön Megérkezett pipa** van. Ez nem jelöli fizetettnek vagy megrendeltnek a tételt, és más pipák sem állítják át. A jelölés tételenként mentődik, újranyitáskor és biztonsági mentésben megmarad. Más cikkszámra váltáskor a korábbi érkezési jelölés is törlődik; ár vagy darabszám javítása megtartja. Régi tételeknél alapból nincs bepipálva. Az opcionális `arrived` mezőt típusellenőrzés védi, a nyomtatási/PDF-adatok mezőlistájába nem kerül bele.

Valódi Electronban a `node scripts/benchmark-paced-typing.cjs` 6000 szintetikus jegyzet mellett 20 leütést küld külön, 80 ms-os időközökkel, és megvárja az utolsó állapot lemezre írását. A kiadott 1.10.1-hez képest azonos környezetben a próba 2704 ms-ról 1646 ms-ra csökkent (az előírt beviteli idő önmagában 1600 ms). A felületi 16 ms-os ellenőrző időzítő legnagyobb kihagyása 101 ms-ról 22 ms-ra csökkent. 120 000 jegyzetrekord helyett 20 ment át az IPC-n. Ezek Linux/Electron tesztmérések, nem minden gépre garantált értékek, és az időzítő nem grafikus FPS-mérés. A próba az utolsó karaktert és az összes többi jegyzet szövegének sértetlenségét is ellenőrzi. Az előző változatot opcionális forráskönyvtár-paraméterrel lehet összehasonlítani. Mérési adatok: [downloads/folyamatos-gepeles-meres.json](downloads/folyamatos-gepeles-meres.json).

A `node scripts/verify-arrival.cjs` tényleges ablakban ellenőrzi a pipák függetlenségét, egymás melletti helyét, a részleges mentést, újranyitást és cikkszámcsere utáni törlést. Az ébresztős és négygépes próbák a részleges mentési útvonallal is futnak. A személyes jegyzetek és munkalapok továbbra is gépenként külön maradnak.

## Gyorsabb gépelés és keresés · 1.10.1

A jegyzetek mentési sora az ugyanahhoz az adatfájlhoz várakozó módosítások közül a legfrissebbet írja ki, a már folyamatban lévő mentés megvárása után. A felület nem készít teljes JSON-másolatot minden leütésnél: pillanatfelvétel csak a tényleges kiírás előtt készül, natív másolással. Nincs mesterséges mentési késleltetés. A bezárás, az importálás és az ébresztő kezelése továbbra is megvárja a teljes mentési sort, és hibánál a program nem hagyja jóvá a bezárást. A fájlformátum, a helyi adatkönyvtár, az atomi fájlcsere és a biztonsági másolatok megmaradtak.

A kereső a már feldolgozott jegyzetek ékezetfüggetlen keresőszövegét újrahasználja; egy jegyzet módosítása csak annak gyorsítótárát érvényteleníti. A mappaszámlálók egy menetben készülnek, az ugyanazt mutató mappafát nem építjük újra minden keresőleütésnél. A márkalista csak szükség esetén épül újra. Nagy keresési találati listánál egyszerre 80 kártya jelenik meg, **Előző/Következő találatok** gombbal; minden találat megmarad és elérhető. A napi névsor működése változatlan.

A helyi tároló a régi tétellista előtti migrációs mentés szükségességét nem ellenőrzi minden alkalommal teljes fájlbeolvasással. A megjegyzett állapotot az aktuális fájl azonosítója, mérete és módosítási ideje védi; kívülről visszaállított fájlnál újra ellenőrzi, kell-e migrációs biztonsági mentés. A tárolandó adatokat továbbra is minden mentéskor validálja.

A `node scripts/benchmark-notes.cjs` szintetikus 6000 jegyzeten futtatható aktív képernyővel. A mért próba 16 gyors beviteli eseményt egy JavaScript-körben ad át, majd megvárja az összes mentést. Azonos tesztkörnyezetben a felületet közvetlenül foglaló szakasz 555,5 ms-ról 9 ms-ra, a teljes próba mentéssel 2946 ms-ról 249,3 ms-ra csökkent; 16 teljes kiírás helyett 1 történt. A négy egyedi keresés ideje 63–73 ms-ról 15–37 ms-ra, a soktalálatos keresés 96,4 ms-ról 4,6 ms-ra csökkent. Ezek tesztértékek, nem minden gépre garantált sebességek. A mérési adatok: [downloads/sebessegmeres.json](downloads/sebessegmeres.json).

A funkciótesztek külön ellenőrzik a folyamatban lévő és az utolsó mentési állapot sértetlenségét, a bezárás várakozását, a hibakezelést, a kereső frissülését szerkesztés után, az összes lapozott találat elérhetőségét, valamint a kívülről visszaállított régi jegyzet migrációs másolatát. A jegyzetek és ébresztők továbbra is gépenként külön maradnak, csak az autónyilvántartó közös.

## Jegyzetek kezdőlap és saját ébresztők · 1.10.0

Indításkor a **Jegyzetek** felület nyílik meg, az autónyilvántartó a saját füléről továbbra is elérhető. Az emlékeztető szerkesztőjében az **Időzített ébresztő** pipával pontos helyi dátum és idő adható meg. Az esedékes, nem kész emlékeztető a felső fejléc közepén pirosan villog, az ügyfél nevével és a teendő szövegével. A **Kész** gomb készre jelöli; a **Szundi · 5 perc** a megnyomástól számított pontosan 300 000 ezredmásodperccel halasztja. Több esedékes teendő lapozható. A jelzés a Jegyzetek, Munkalapok és Autónyilvántartó fülön is látható.

Az időpont és a szundi kizárólag az adott gép helyi `notes.json` fájljában, az emlékeztető opcionális `dueAt` és `snoozedUntil` ISO-időpontjaiban tárolódik. A régi, időpont nélküli teendők változatlanul használhatók. Szövegjavítás megőrzi a szundit; az időpont módosítása vagy az ébresztő kikapcsolása törli a korábbi szundit. A készre jelölt teendő nem riaszt újra. A közös autónyilvántartó adatfájljai és hálózati protokollja változatlan.

Az ébresztő a **futó programban** jelez, a háttérben futó ablak időzítését sem lassítjuk le, és az esedékesség a tálca ablakjelzését is bekapcsolja. Kikapcsolt/alvó gépen vagy bezárt alkalmazásban nincs háttérszolgáltatás: az elmaradt ébresztő ébredéskor vagy a program következő indításakor megjelenik. Az ellenőrzés másodpercenként történik. A piros animáció csökkentett mozgást kérő rendszerbeállítás mellett folyamatos piros kiemelésre vált.

Ellenőrzés: modell- és felülettesztek pontos határidőre, az ötperces szundira, kész jelölésre, több jelzésre, szerkesztésre, kikapcsolásra és helyi tárolásra. `node scripts/verify-reminder-alarms.cjs` valós Electronban ellenőrzi a Jegyzetek kezdőlapot, valóban lejáró időpontot, a felső sávot mindhárom fülön, a szundi mentését és újraindítását, a kész jelölés tartósságát és az egyéb adatfájlok változatlanságát. Az 5 perc leteltét az újraindítási próbában vezérelt órával szimulálja. Linuxon aktív `DISPLAY` szükséges. A négygépes megosztás integrációs próbája továbbra is külön futtatható.

## Jegyzetek: névsorrend és cikkszámok igazítása · 1.9.2

A rendelési pipa kikapcsolt felirata **Nincs megrendelve** a jegyzetekben és a munkalapokon is. A napi névsorban a legújabban létrehozott név jelenik meg elöl, és az új név a mentett listába is az elejére kerül, a korábbi nevek mentett sorrendjét megtartva. Ez a gépek órájának eltérésétől is független. Régi jegyzet szerkesztése nem változtatja meg a létrehozási időt és a névsorrendet. A cikkszám, teli ár, kedvezmény, kedvezményes ár, darabszám és beszállító mező azonos magasságban, egy vonalban indul; az autóválasztó külön, a cikkszám alatt marad. A mezők igazítása a jelölőnégyzetek méretét nem változtatja meg.

Ellenőrzés: `npm test`; új név első helyen és újranyitás után, régi jegyzet szerkesztése, rendelési pipa oda-vissza. Valódi Electronban `node scripts/verify-notes-layout.cjs` aktív képernyővel (Linuxon `DISPLAY` szükséges) méri a hat mező felső pozíciójának és magasságának egyezését 1760 és 1100 képpont széles ablaknál. A próba szintetikus adatokkal dolgozik, az eredeti tételek változatlanságát is ellenőrzi.

## Görgetés nélkül megnyíló autóbuborékok · 1.9.1

A névbuborék középre nyíló ablakban mutatja az ügyfél autóit. Egy autóbuborékra kattintva külön felugró adatlapban látszik a teljes autóleírás, alvázszám és rendszám, a módosítás és törlés gombjával. Az autólistában keresés és hatos lapozás helyettesíti a hosszú görgetést. Bezáráskor megmarad a háttérlista görgetési helye; az Escape először csak az autó adatlapját zárja be, az ügyfél autói nyitva maradnak. A négygépes megosztás és a külön helyi jegyzetek tárolása változatlan.

Ellenőrzés: `node scripts/verify-garage-bubbles.cjs` aktív képernyővel (Linuxon `DISPLAY` szükséges). Valódi Electronban 1000×600-as ablak, 300 karakteres autóleírás, görgetés nélküli adatlap és autóválasztó, lapozás, Escape, változatlan háttérpozíció és adatfájl; továbbá a meglévő négygépes integrációs próba.

## Közös autónyilvántartó · 1.9.0

A felhasználó által feltöltött ZIP fájlnevében megadott `eabbd9af4364534610329326b602eddc6fd09412` verzióra épül. A nagy ZIP a fájlátviteli méretkorlát miatt nem volt közvetlenül beolvasható; a pontos Git-verziót a projekt eredeti tárolójából kértük le. Megmaradt az alvázszámonkénti cikkszámkezelés. A jegyzetek, cikkszámok, archívum és munkalapok tárolója, illetve a jegyzetszerkesztő a fenti verzióval azonos.

A Töki Autó fekete–zöld autónyilvántartójában a névbuborékok az ügyfél autóit nyitják meg. Márka/típus, alvázszám és rendszám rögzíthető, kereshető, módosítható és megerősítés után törölhető. Excelből Ctrl+C/Ctrl+V segítségével, oszloppárosítással és előnézettel olvashatók be az adatok. Egy sor egy autó; azonos névhez több autó tartozhat. Azonos nevű különböző ügyfelekhez használj megkülönböztető nevet. A teljesen azonos sorokat kihagyja, hibás sor esetén semmit nem ment.

**Csak az autónyilvántartó közös; a jegyzetek és munkalapok gépenként külön maradnak.** A Kapcsolat beállítása ablakban az egyik gép központ, a másik három kliens lehet. A központ az alkalmazás futása alatt szolgálja ki a helyi hálózati kéréseket, a lista körülbelül 3 másodpercenként frissül. A központ beállítása és az adatok újraindítás után is megmaradnak. A lépésenkénti Windows-útmutató: [HALOZAT-BEALLITAS.txt](HALOZAT-BEALLITAS.txt).

A hálózati szolgáltatás egyetlen, kapcsolódási kóddal védett `/garage` végpontja csak a név és jármű mezőit fogadja el; nem kínál jegyzet-, munkalap- vagy tetszőleges fájlelérést. Kizárólag helyi IPv4-címre lehet csatlakozni. A kliensgépek nem töltenek fel saját jegyzetet vagy régi helyi autólistát. A központ adatfájlja külön `shared-garage/people.json`, tartós módosítási verzióval, atomi cserével és az előző állapot `.bak` mentésével. Elavult verzió mentése ütközési hibát ad, felülírás nélkül. Szerkesztés közben a felület nem cseréli le a megnyitott adatokat. Kapcsolat nélkül nincs helyi, később veszélyesen összefésülhető hálózati mentés; a saját jegyzetek és munkalapok tovább használhatók.

Az alkalmazás neve és a korábbi felhasználói könyvtár változatlan. A jegyzetek korábbi **Biztonsági mentés** gombja továbbra is kizárólag a gép saját adatait menti; a külön **Autólista mentése** a nyilvántartóról készít JSON-mentést. A korábbi `garage.json` helyi autólista megmarad; az első központi beállítás csak ennek az autóadatait másolja át. A két adatforrás később nem írja felül automatikusan egymást.

Ellenőrzések: `npm test` (négy külön szolgáltatás, egyidejű mentések, hitelesítés, tiltott végpontok, sérült fájl védelme, valamint a jegyzetek/archívumok/munkalapok bájtpontos változatlansága); Python importtesztek; négy valódi, elkülönített Linux Electron-folyamatban a beállítófelület, közös Excel-beillesztés, automatikus frissülés, ütközésvédelem, megszakított bezárás és központ nélküli saját jegyzetmentés. A Windows natív futtatása és a bolti hálózat/tűzfal külön helyszíni ellenőrzést igényel.

## Alvázszámonkénti cikkszámok az 1.8-as verzióban

Egy név alatt több autó külön tétellistát kap. A Járművek részen az alvázszámos gomb vagy a szerkeszthető alvázszámmező kiválasztja az autót; az alatta lévő táblázat és összesítés annak cikkszámait mutatja. Új sor a kiválasztott autóhoz kerül, új autó üres saját sorral indul. Azonos cikkszám két autónál is megadható, külön árral, darabszámmal, rendelési és fizetési pipával. A hozzárendelés és az utolsó kiválasztás újraindítás után is megmarad; az alvázszám szövegének javítása nem választja le a tételeket. A név, telefon és megjegyzés közös marad.

A tárolás a meglévő, teljes `note.items` listát őrzi meg; a sor opcionális `vehicleId` mezője az adott jegyzet stabil járműazonosítójára mutat. A régi, egyautós jegyzet egyértelmű tételei az autóhoz kerülnek. Többautós jegyzet korábbi közös sorai **Hozzárendelés nélkül** maradnak, és az **Autó** választóval soronként átsorolhatók. Az explicit közös sorok újranyitáskor sem sorolódnak át automatikusan. Autó törlése annak tételeit áthelyezi a hozzárendelés nélküli listába, árat vagy jelölést nem töröl. A tároló az érvénytelen járműhivatkozást írás előtt elutasítja.

A kereső minden autóban keres, és a találat autóját nyitja meg. A **Munkalap – kiválasztott autó** kizárólag annak alvázszámát, márkáját és tételeit másolja át; a telefon továbbra is átkerül. A PDF és a nyomtatás engedélyezett mezőkből készül, cikkszám és belső jelölések nélkül. A fejléc **Fizetve – teljes bejegyzés** pipája az összes autó tételeire vonatkozik, a táblázat alatti összegek a kiválasztott autóra. A teljes bejegyzés eredeti összesített adatai és forrásszövegei megmaradnak a mentésben.

Valódi Electron-folyamatban ellenőrizve: régi egy- és többautós jegyzetek, két autón azonos cikkszám külön adatokkal, alvázszámra kattintás, új autó, átsorolás, törlés adatmegőrzéssel, mentés/újratöltés, keresés, hibás ár miatti váltásmegállítás, kizárólag egy autót tartalmazó tényleges PDF, valamint a végső bezárás.

## Telefonszám és egyetlen záró ellenőrzés az 1.7-es verzióban

Minden jegyzetben a Név mellett külön **Telefonszám** mező van. A megadott szöveget formázással együtt, névenként a kézi vagy óránkénti mentés rögzíti; újranyitáskor megmarad és a globális keresőben is kereshető. A régebbi jegyzeteknél alapból üres. A **Munkalap készítése** a telefonszámot is átmásolja a munkalap Telefon mezőjébe.

Az **„Biztosan minden tételt felírtál?”** kérdés kizárólag a program bezárásakor, egyszer, közös ablakban jelenik meg. Név-, nap-, mappa- és fülváltáskor, kereséskor vagy új jegyzet létrehozásakor nem kérdez. A záró ablak az összes jegyzet nyitott emlékeztetőit együtt mutatja, névvel. A Vissza és Escape megszakítja a bezárást; az Igen után megvárja az összes mentést. A piros Emlékeztetők gomb és a Töki Autó arculat megmarad.

Valódi Electron-folyamatban ellenőrizve: telefonszám mentése, keresése, újranyitása, munkalapra másolása, kérdés nélküli név- és fülváltás, egyszeri közös megerősítés, Vissza/Escape, folyamatban lévő és hibás mentések.

## Arculatos kérdésablak és javított bezárás az 1.6.1-es verzióban

A kilépési ellenőrzés Töki Autó logós, fekete–zöld párbeszédablakban jelenik meg. A **Vissza a jegyzethez** és az Escape ténylegesen megszakítja a natív ablakbezárást. A bal oldali **Emlékeztetők** gomb állandó piros kiemelést és jól olvasható darabszámot kapott.

A főfolyamat az X és az alkalmazásból való kilépés eseményét azonnal megállítja, majd külön, az adott kéréshez tartozó jóváhagyást vár. A felület csak ellenőrzött mezők és az összes jegyzet- és munkalapmentés befejezése után hagyja jóvá a bezárást. A korábbi, mentés végén meghívott automatikus `window.close()` eltűnt; így egy befejeződő mentés nem írhatja felül a Vissza választást. Ismételt bezárás egyetlen kérdést mutat, régi vagy másik ablakból érkező válasz nem zárhatja be a programot. Mentési hiba esetén arculatos hibaablak jelenik meg, az app nyitva marad. A gyorsan újranyitott kérdést az előző ablak késői close eseménye sem zárja be.

A natív bezárási folyamat valódi Linux Electron 45.2.2 futtatókörnyezetben, elkülönített szintetikus adatokkal ellenőrizve: X, Vissza, Escape, ismételt X, app.quit, folyamatban lévő jegyzet- és munkalapmentés, mentési hiba és újranyitás. A Windows-csomag ugyanazt az ellenőrzött programforrást tartalmazza; a Windows natív futtatása ebben a környezetben nem elérhető.

## Kilépési ellenőrzés és emlékeztetők az 1.6-os verzióban

Az 1.6-os verzió még a szerkesztett jegyzetek közötti váltáskor is rákérdezett. Az 1.7-es verzióban ez kizárólag a program bezárásakor jelenik meg: **Biztosan minden tételt felírtál?** Az **Igen, minden felírva** továbblép, a **Vissza a jegyzethez** megszakítja a bezárást. Enter és Escape alapértelmezésben a visszatérést választja. A záró ellenőrzés a teljes munkamenetre vonatkozik. A mentés kézzel, óránként és normál bezáráskor történik; a kérdés jóváhagyása a mentés befejezését nem kerüli meg.

Minden névhez több saját teendő vehető fel az **Emlékeztetők** részen, gyors szövegekkel (például **Felhívni az ügyfelet**) és külön **Kész** pipával. A szöveg szerkeszthető, a teendő törölhető. A bal oldali gomb az összes nyitott vagy kész teendőt megmutatja, és a kapcsolódó jegyzet megnyitható belőle. A nyitott teendők a kilépési ellenőrzésben is megjelennek, korábban mentett jegyzetnél is. A jóváhagyás nem jelöli készre őket; a pipát kézzel kell beállítani. A teendők a helyi JSON-tárolóban és a biztonsági mentésben megmaradnak; ügyfélnyomtatásba nem kerülnek.

## Fizetési pipák és több jármű az 1.5-ös verzióban

Minden kitöltött tételnek külön **Fizetve** pipája van. A Bejegyzés adatai mellett, a Megrendelve alatt lévő közös pipa az összes kitöltött tételt egyszerre jelöli vagy törli; részleges fizetésnél köztes állapotot mutat. Üres tétellista mellett az egész bejegyzés fizetése önállóan jelölhető. A fizetés nem változtatja meg a névkártyák színét és nem állít rendelési állapotot. A munkalapokon is van soronkénti és közös pipa. Más cikkszám beírása törli az adott sor korábbi fizetési jelölését. A jelöléseket a kézi vagy óránkénti mentés rögzíti, ügyfélnyomtatásba és PDF-be nem kerülnek.

Egy jegyzethez több alvázszám és soronként külön autómárka adható. Az **Alvázszám hozzáadása** gomb új sort vesz fel; a sor végén törölhető. A korábbi alvázszámok és eredeti forrásszövegek megmaradnak, az explicit törölt járművek újranyitáskor sem térnek vissza. A kereső minden jármű alvázszámát és márkáját figyeli. A 433 márkát tartalmazó, offline használható lista saját márkanévvel kiegészíthető. A névjegyzék forrását és licencét az [adatforrás megjelölése](app/assets/car-brands-NOTICE.txt) tartalmazza; gyártói emblémákat nem használunk. Az 1.8-as verziótól a **Munkalap készítése** a kiválasztott autót és annak tételeit viszi át.

## Önálló árösszesítés javítása az 1.4.1-es verzióban

A megadott teli és kedvezményes árak külön-külön számítanak bele az összesítésbe. Ha csak 13 500 Ft kedvezményes egységár van megadva, a végösszeg 1 db-nál 13 500 Ft, 2 db-nál 27 000 Ft. A hiányzó teli ár nem rejti el az ismert kedvezményes végösszeget. Részösszegnek csak azt az oldalt jelöli, amelyen valóban hiányzik ár. Nulla forint ismert árként jelenik meg.

A kedvezmény összege csak az azonos soron ismert árpárokból számolható; különböző sorok hiányzó árait nem vonja ki egymásból. A ki nem számítható százalék helyén „—” jelenik meg. A mentés a teljesen ismert kedvezményes végösszeget teli ár nélkül is megőrzi; az eredeti tételek és forrásszövegek megmaradnak. A munkalap szerkesztőjének összesítése is javítva van. Az ügyfélnek készülő dokumentum továbbra is csak teljesen kitöltött árakkal nyomtatható, cikkszám és belső jelölések nélkül.

## Színes bejegyzések és kézi kedvezményes ár az 1.4-es verzióban

A **Bejegyzés adatai** mellett négy, egymást kizáró állapot választható: **Megrendelve** (zöld), **Ajánlat** (kék), **Félbehagyott** (piros), **Felírva** (citromsárga). A felső névkártya teljes háttere, kerete és felirata követi az állapotot; az aktuális kártya kijelölése külön is látszik. A választás névenként mentődik és újranyitáskor megmarad. Az új és korábban nem jelölt bejegyzések alapállapota Felírva. A bejegyzés állapota kézzel választható, a tételenkénti rendelésjelöléstől függetlenül. A kereső az állapot nevére is keres.

A **kedvezményes egységár** a jegyzetekben és munkalapokon is írható. A teli ár és a kézzel megadott kedvezményes ár alapján a százalék automatikusan számolódik. Ebben az esetben a teli ár módosítása megtartja a kézi kedvezményes összeget, és a százalékot frissíti. Százalék megadásakor visszatér a százalék alapján számoló módhoz. A kézi összeget mentéskor és újranyitáskor nem számolja újra kerekített százalékból. A százalék legfeljebb hat tizedesre kerekített; az egységár két tizedes pontosságú. Hiányzó árnál a százalék üres, 0 Ft / 0 Ft esetén 0%, teljes kedvezménynél 100%; a kézi kedvezményes ár nem lehet magasabb a teli árnál. A korábbi eredeti árpárok megmaradnak.

A beszállító egységes neve **Unitrak**. A régi „Unitrack” külön mezőértékek, az automatikus TXT-felismerés és az Excel-import is ezt a nevet használják; az eredeti forrásszöveget nem írjuk át. Az ügyfélnek készülő PDF és nyomtatás továbbra sem tartalmaz cikkszámot és belső jelöléseket. A meglévő jegyzetek, munkalapok és a Töki Autós ikon megmaradnak.

## Rendelésjelölés az 1.3-as verzióban

A napi jegyzetek és a munkalapok minden tételsorában külön **Rendelés** mező található. A Megrendelve pipa zöld jelzést ad, és elmenti a kézi jelölés időpontját. A pipa visszavonható; új jelöléskor új időpontot kap. Az ár vagy darabszám módosítása nem változtatja meg a jelölést, más cikkszámra váltás törli azt, hogy új terméken ne maradjon téves visszaigazolás. Üres cikkszám és megnevezés mellett nem jelölhető rendelés. Az összesítés mutatja, hány tétel van megjelölve.

A régi cikkszámsor végén álló egyértelmű „Rendelve” vagy „Megrendelve” jelzés automatikusan megjelenik. Ezekhez időpontot nem talál ki: „Korábbi jelölés” látszik. A „nincs rendelve”, „nem megrendelve” és jövőbeli vagy kérdéses szöveget nem tekinti visszaigazolásnak. A korábbi adatokhoz az új mezők opcionálisak; eredeti szövegük megmarad. A JSON-mentés a jelölést és az időpontot is tartalmazza. A jegyzetből készített munkalap átveszi a tétel pillanatnyi jelölését.

A rendelés állapota belső adat, a külön nyomtatási és PDF-dokumentum nem kapja meg. A pipa az üzletben már elvégzett rendelés kézi nyilvántartására szolgál. A korábbi Töki Autós ikon és minden meglévő funkció megmarad.

## Saját Windows-ikon az 1.2.2-es verzióban

Az alkalmazás fekete-zöld Töki Autó ikont kapott, autós jelképpel. A Windows EXE erőforrásaiba több felbontású ICO kerül, az ablak ugyanennek a PNG-változatát használja. Az indító az általa kezelt asztali parancsikon ikonforrását is beállítja.

A `downloads/TokiAuto-Asztali-Ikon.zip` kis helyi ikonfrissítő a már telepített app `TokiAuto - Jegyzetek` asztali parancsikonjához másolja az ICO-t a saját LocalAppData könyvtárba. Kicsomagolás után a benne lévő `TokiAuto-Ikon-Frissites.cmd` indítandó. Csak az ismert TokiAuto telepítési helyre mutató parancsikont módosítja; más célra mutató ikonhoz nem nyúl. Helyi fájlokkal dolgozik, nem igényel rendszergazdai jogosultságot és nem módosítja a jegyzeteket. A PowerShell végrehajtási házirendjét nem írja át. A parancsikon COM-hívását Windows alatt kell ellenőrizni; a Linux-környezetben az ICO-t, a beépített EXE-erőforrásokat és a csomag tartalmát vizsgáljuk.

## Javítás az 1.2.1-es verzióban

A TXT-jegyzetmappa betöltése külön ablakban mutatja a folyamatot, a hibát és az eredményt. Ha egy névvel elmentett TXT-fájlnál a mentési dátum nem egyezik az év- és hónapmappával, a felhasználó kiválaszthatja a helyes napot. Csak az adott hónap valós napjai fogadhatók el; a program nem talál ki dátumot, és a teljes dátumellenőrzés előtt nem ír át adatot. A dátumválasztás idejére a beolvasott fájlok helyi pillanatképét tartja meg, az eredeti fájlokat nem módosítja. A kiválasztott dátum eredete az adatlap forrásadataiban megmarad.

Sikeres betöltés után törli a keresési szűrőt és megnyit egy átvett bejegyzést. Az import előtt bevárja a függő mentéseket. A korábbi jegyzetek és munkalapok megmaradnak, az ismételt import továbbra sem írja felül a szerkesztett jegyzeteket és nem duplázza a már betöltött tételeket. A korábbi 571 TXT-fájl beolvasási eredménye változatlan.

## Újdonság az 1.2-es verzióban

### Excel-beolvasás

A bal alsó **Excel beolvasása** gomb helyi `.xlsx` fájlt nyit meg. Excel telepítése nem kell. A régi `.xls` fájlt előbb `.xlsx` formátumban kell menteni. Kiválasztható az Excel-munkalap, a fejléc sora és az oszlopok párosítása. Előnézet mutatja a tételeket, ügyfeleket, napokat és hibákat; hibás sorokkal nem történik import. Dátum nélküli sorokhoz külön nap és név állítható be. Az üres név/dátum előző sorból való kitöltése opcionális.

A cél lehet a napi jegyzetek vagy a megnyitott munkalap. A napi jegyzetek név/alvázszám/nap szerint külön csoportokat kapnak. Egy munkalaphoz egy ügyfél és egy jármű tételei adhatók. A százalékként formázott Excel-cellát helyesen értelmezi (0,2 = 20%); a darabszám, beszállító, megnevezés és eredeti cellatartalom is megmarad. A képletek nem futnak: mentett eredményük olvasható, hiányzó eredménynél hibát jelez. Az eredeti fájl nem módosul. Azonos fájl azonos sorainak ismételt importja nem duplázza a tételeket. Excel-mintafájl is menthető az importablakból.

Legfeljebb 20 MB-os fájl, 50 000 sor és 256 oszlop támogatott. A ZIP-tartalom mérete és kicsomagolt adatfolyama külön ellenőrzött, korlátos. Az adatok helyben maradnak; az import nem használ külső szolgáltatást.

### Munkalapok / árajánlatok

Külön fülön szerkeszthetők és kereshetők, kézi vagy óránkénti mentéssel a `%APPDATA%\jegyzetfuzet\workorders.json` fájlba. Sorszámot kapnak, típusuk árajánlat vagy munkalap lehet. Mezők: ügyfélnév, telefon, alvázszám, rendszám, jármű, dátum és opcionális érvényesség. A napi jegyzetből a **Munkalap készítése** gombbal is indítható új dokumentum. Az árak és a darabszám ugyanúgy számolódnak, mint a cikkszámtáblázatban.

**A cikkszám nem kerül a nyomtatási dokumentumba.** A nyomtatás külön, engedélyezett mezőkből összeállított dokumentumot használ; a cikkszám, beszállító, eredeti forrássor és belső megjegyzés át sem kerül annak adatai közé. Az ügyfélnek a külön **Megnevezés** mező látszik, üres megnevezésnél „Alkatrész”. A megadott cikkszámokat a szabad szöveges mezőkből is eltávolítja. A nyomtatás előnézettel, natív nyomtatási ablakkal és PDF-mentéssel kérhető. A Ctrl+P erre a biztonságos útvonalra irányít, a fő szerkesztő közvetlen nyomtatását külön CSS-védelem is megakadályozza.

Ügyfélnév és árazott tétel szükséges a nyomtatáshoz. Az összes tétel árát ki kell tölteni. A nyomtatás A4-es, több oldalra is tördelődik. A PDF-et ténylegesen elkészítettük és kinyert szövegében ellenőriztük a cikkszámok és belső megjegyzések hiányát, az alvázszám és összegek megmaradását. A fizikai Windows-nyomtató párbeszédét a Linux-környezetben nem tudjuk közvetlenül tesztelni.

A munkalapok az általános JSON-biztonsági mentésbe is bekerülnek. Frissítéskor a korábbi jegyzetek és adatok ugyanott maradnak. Egy időben egy apppéldány fut; újbóli indítás a meglévő ablakot hozza előtérbe.

## Újdonság az 1.1-es verzióban

A cikkszámok külön sorokban, hat oszlopban kezelhetők: cikkszám, teli egységár (Ft/db), kedvezmény (%), automatikusan számított kedvezményes egységár (Ft/db), darabszám és beszállító. Új sor vehető fel, a sorok egyenként törölhetők. A beszállító szabadon írható, a gyakori nevekhez felajánlás tartozik.

Példa: 10 000 Ft és 20% kedvezmény = 8000 Ft/db. Három darab kedvezményes összege 24 000 Ft. A számítás két tizedesre kerekít, a sorok egységárát szorozza a darabszámmal. A darabszám pozitív egész szám, a kedvezmény 0–100% lehet. Hiányzó árú soroknál csak a teljesen ismert tételek részösszegét mutatja, és ezt külön jelzi.

A régi cikkszámsorok automatikusan átkerülnek a táblázatba. A felismerhető beszállító, árpár és darabszám külön mezőbe kerül. A korábbi kedvezményes ár változatlan marad, amíg a teli árat vagy a százalékot nem módosítják; a százalék ilyenkor a régi árpárból számított közelítés. Nem egyértelmű részleteknél az eredeti sor marad olvasható. A „Korábbi cikkszámmező és árak” rész és az importált eredeti szöveg is megmarad.

Az első táblázatos mentés előtt a korábbi teljes adatfájlról `notes.json.before-items-v1.json` másolat készül a saját adatkönyvtárban. A frissítés ugyanazt a `%APPDATA%\jegyzetfuzet` könyvtárat használja, újraimportálás nem kell. Az indító a korábban általa létrehozott asztali parancsikont az új verzióra igazítja; más célra mutató, azonos nevű parancsikont megőriz.

**Frissítés:** zárd be a régi appot, csomagold ki az új letöltést, majd indítsd a benne lévő `TokiAuto-Inditas.cmd` fájlt.

## Megjelenés

A felület a küldött Töki Autó Alkatrész logó fekete–fehér–élénkzöld színvilágát követi: sötét oldalsáv, zöld kiemelések és világos adatlapok. A fejléc helyi `app/assets/toki-logo.png` képe a felhasználó logója alapján képgenerálóval előkészített, tisztított változat, nem az eredeti feltöltött képfájl. Az alkalmazás és az asztali parancsikon kis ikonja az ugyanezen márkastílus alapján képgenerálóval készített `toki-icon.png` / `toki-icon.ico`. A korábbi `toki-mark.svg` megmarad a források között. A megjelenés nem használ külső betűkészletet vagy hálózatról betöltött képet.

## Évek, hónapok, napok és nevek

- Kezdetben 2024, 2025 és 2026 év mappája látható. A „＋ Év” gombbal további év hozható létre; minden év alatt mind a 12 hónap elérhető.
- Nyisd le az évet, majd a hónapot. A „Nap hozzáadása” gombbal válassz dátumot. Meglévő nap megnyitása nem készít másolatot. Az új üres évek és napok is megmaradnak újraindítás után.
- A kiválasztott napon az „Új név a naphoz” gombbal több név és külön adatlap vehető fel. Fent a névkártyákkal válthatsz köztük.
- Az adatlap mezői: név, több alvázszám külön márkával, cikkszámok (több sorban), opcionális olaj (típus és mennyiség), teli ár, kedvezményes ár (Ft), megjegyzés. Az árak darabonkénti egységárak, az összesítés figyelembe veszi a darabszámot.
- A kereső minden év minden adatlapjának mezőiben keres, ékezet nélkül is. A találatra kattintva annak napjához és adatlapjához jutsz.
- A mentés automatikus és helyi. Egy név adatlapjának törlése nem törli a napot vagy a többi név adatait.

A régi bejegyzések külön adatlapként megmaradnak, a rögzítési dátumuk szerinti naphoz kerülnek. Korábbi rögzítési dátum hiányában a meglévő módosítási időt használja. A későbbi szerkesztés nem változtatja meg a bejegyzés napját. A korábbi általános jegyzet címe a Név mezőben, szövege a Megjegyzésben marad.

A jegyzetek és munkalapok egy-egy számítógép helyi adataival dolgoznak, és külön maradnak. Az 1.9.0-s csomagban kizárólag az autónyilvántartó osztható meg a négy gép között; a napi jegyzeteket és az autónkénti cikkszámokat nem szinkronizálja.

## Korábbi TXT-jegyzetek átvitele

A felhasználó ZIP-jének mind az 571 szöveges fájlja feldolgozva: 567 nap, 5664 bejegyzés (2024: 139 fájl; 2025: 229; 2026: 203). A két dátum nélküli fájl napját a felhasználó megerősítette, a helyi `imports/date-overrides.json` rögzíti. A `.lnk` és `desktop.ini` nem jegyzet; nem kerülnek be és nem futnak le.

A név szerinti szétbontás a szövegbeli fejléceket és elválasztó sorokat használja; bizonytalan címeket nem talál ki. Az eredeti teljes szöveg minden adatlap `source.originalText` mezőjében megmarad, az „Átvett jegyzet · eredeti szöveg megtekintése” alatt olvasható. A Megjegyzés kezdetben szintén megőrzi az adott szakasz teljes tartalmát. Az egységárak, darabszámok, beszállítók és állapotok az eredeti tételsorok mellett maradnak. Több tételre vagy több autóra vonatkozó árakat nem összesít automatikusan; az összesített ármezők ilyenkor üresek. Egyértelmű, egyetlen áras tétel esetén az árpár kitölthető.

A privát `app/private-data/initial-import.json` a készülő app kezdeti adatkészlete. Az alkalmazás első betöltéskor hozzáfűzi a már meglévő adatokhoz, külön `import-backups` mappába menti az import előtti állapotot, és az `imports.json` naplóban jelzi a befejezést. Újraindítás nem duplázza a bejegyzéseket, nem írja felül a felhasználó módosításait, és nem hoz vissza törölt importált jegyzetet. A felhasználói könyvtárban az importált jegyzetek továbbra is a szokásos `notes.json` és `archive.json` fájlokban vannak.

A privát adatkészlet és az `imports` jelentései Gitből kizártak. A nyilvánosan letölthető Windows-csomag nem tartalmaz sem nyers, sem titkosított ügyféladatot. A felhasználó a saját gépén a „Jegyzetmappa betöltése” gombbal választhatja ki az eredeti TXT-mappát. A helyi beolvasó az összes 571 fájlon ellenőrizve ugyanazokat a neveket, napokat, szövegeket és adatmezőket állítja elő, mint az előkészített import. Az eredeti ZIP változatlanul megmaradt a feltöltések között. A helyi `imports/verification.json` igazolja mind az 571 fájl bájtpontos visszaállíthatóságát és az összes forrássor hiánytalan lefedését; a `validated-app-data` az alkalmazás tényleges tárolójával ellenőrzött import.

Reprodukálás Python 3-mal, a forrás ZIP és a szükséges dátumok megadásával:

```sh
python3 scripts/import-notes.py /path/to/notes.zip --date-overrides imports/date-overrides.json --output app/private-data/initial-import.json --report imports/import-report.json
python3 scripts/verify-import.py /path/to/notes.zip app/private-data/initial-import.json imports/verification.json
python3 -m unittest discover -s test -p 'test_import_*.py'
```

A Windows-felhasználónak ehhez nem kell Python: az app helyi beolvasója az eredeti TXT-mappát dolgozza fel.

## Windows letöltés és indítás

1. Töltsd le a tároló ZIP-archívumát, és csomagold ki az egész mappát.
2. Kattints duplán a `TokiAuto-Inditas.cmd` fájlra. A program ellenőrzött csomagja a `downloads` részekből helyben összeáll, a saját felhasználód AppData könyvtárába kerül, és elindul. A részeket hagyd a helyükön. Internet csak a ZIP letöltéséhez kell.
3. Első használatkor az appban kattints a **Jegyzetmappa** gombra, és válaszd a saját **Napi jegyzetek** mappádat (amelyben a 2024, 2025, 2026 almappák vannak). Frissítéskor a meglévő jegyzeteid automatikusan megmaradnak.
4. A későbbiekhez asztali parancsikon is készül, ha a Windows engedélyezi.

Windows 10/11 x64 Intel/AMD géphez készült. Rendszergazdai telepítés nem szükséges; a program nincs digitálisan aláírva. A Windows alatti indítást ebben a Linux-környezetben nem tudtuk közvetlenül kipróbálni. A csomag, az összes jegyzet helyi feldolgozása és a felület tesztjei ellenőrizve vannak.

A helyi jegyzetek: `%APPDATA%\jegyzetfuzet\notes.json`, a mappák: `archive.json`. A „Biztonsági mentés” helyi JSON-fájlt készít. Import előtt külön másolat készül az `import-backups` mappába. Az eredeti TXT-k változatlanok maradnak. Felhőszinkron nincs.

## Fejlesztés

Node.js 22 vagy újabb, npm. A meglévő checkoutot használd; külön Git worktree nem szükséges.

```sh
npm ci
npm test
npm start
npm run package:win
python3 scripts/build-windows-downloads.py
```

Négy elkülönített Electron-folyamat hálózati próbája aktív grafikus képernyő mellett: `node scripts/verify-garage-lan.cjs`. Fej nélküli Linuxon előbb indíts Xvfb-t, és add meg a `DISPLAY` változót. A teszt kizárólag ideiglenes, szintetikus jegyzetekkel dolgozik. A letölthető csomag az eredeti ellenőrzött `TokiAuto-Inditas.cmd` indítót és a hálózati útmutatót is tartalmazza.

A Windows-csomag a `dist/TokiAuto-win32-x64` könyvtárba kerül. Proxyt igénylő környezetben az Electron letöltéséhez `ELECTRON_GET_USE_PROXY=1`, valamint a `GLOBAL_AGENT_HTTP_PROXY` és `GLOBAL_AGENT_HTTPS_PROXY` beállítása szükséges a meglévő proxycímekre. A TLS- és checksum-ellenőrzést hagyd bekapcsolva.

Ellenőrzés: adattárolási, archívum- és DOM funkcionális tesztek Linuxon; böngészőben a mappák, több név, új év és nap, keresés és újratöltés ellenőrizve mintaadatokkal. A Windows bináris futtatása külön Windows gépen ellenőrizendő.

## Szűrőkatalógus (1.15.0)


SZŰRŐKATALÓGUS ÉS SAJÁT VONALKÓDOK – 1.15.0
1. A központi gépen: Raktár / leltár → Termékkatalógus → 2019-es lista letöltése.
   Internet kell az első letöltéshez: körülbelül 710 MB forrás feldolgozása történik.
   A kiválogatott helyi lista 138 988 olaj-, lég- és pollenszűrő referenciaadata.
   A letöltés állapota látható, megszakítható. Nem növeli a raktárkészletet.
2. Keress cikkszámra, gyártóra vagy szűrőtípusra. Ellenőrizd a gyártót és cikkszámot!
   A csomagolás vonalkódját olvasd be vagy írd be, majd mentsd a termékhez.
   Új termék készlete ekkor 0; meglévő termék mennyisége és vonalkódjai megmaradnak.
3. Következő beolvasáskor a mentett vonalkódot a közös raktár már felismeri,
   mind a négy csatlakoztatott gépen és a telefonon is.
   Egy termékhez több külön csomagolási vonalkód menthető.
4. Telefonon is kiválasztható a katalógustermék ismeretlen vonalkódhoz.
   A bevételezést alapból külön jóvá kell hagyni. Az opcionális automatikus
   kamerás bevételezés egy sikeres beolvasásra 1 db-ot ad hozzá; a kamera megáll.
5. A főgépen a katalógus külön JSON-fájlba exportálható, másik főgépen importálható.
   Így az otthon letöltött listát átviheted a boltba újabb letöltés nélkül.
   Ez csak a referencialista: a saját vonalkódok és készlet a Raktár biztonsági
   mentésében vannak. Az otthoni és bolti készlet nem szinkronizál egymással.
6. Minden gépen frissítsd az alkalmazást; telefonon töltsd újra a Safari-oldalt.
   A meglévő hálózati és tanúsítványbeállításokat nem kell újra elvégezni.

A lista 2019-es, nem hivatalos, nyilvános referenciaforrásból származik;
nem teljes és nem friss gyártói katalógus, EAN-kódokat nem tartalmaz.
Forrás: https://github.com/tecdocSQL/tecdocdatabase1Q2019
Forrásverzió: 7b9828809040b647d46998b65870b3831e858aa1
Újrafelhasználási engedélye nem ellenőrzött; a forrásadatot az alkalmazás
nem tartalmazza, azt a főgép külön tölti le. A saját hozzárendelések külön maradnak.
A jegyzetek és munkalapok továbbra is gépenként külön vannak; a kézi és
óránkénti jegyzetmentés működése változatlan.


1.16.0 – NÉV SZERINTI KÖZÖS RAKTÁR, USB-OLVASÓ, AUTÓNKÉNTI OLAJ
A frissítést mind a négy gépen telepítsd a meglévő adatmappák megtartásával.
Telefonon frissítsd a Safari-oldalt; a tanúsítvány és a hálózat változatlan.
A telefonos kapcsolódási kód most: tokiautoleltar
A régi hosszú telefonos kód helyett ezt használd; a gépek kapcsolódási kódja nem változik.
Telefonos belépésnél mindenki írja be a saját nevét. Névváltáshoz lépj ki és vissza.
A számítógép Raktár részében is add meg egyszer a Raktáros neve mezőt.
A bevételezés, korrekció és az ezután mentett jegyzetből eredő készletmozgás
mellett látható a kiválasztott név. A név műveleti címke, nem külön jelszavas fiók.
A régi készletmozgásokhoz nem találunk ki nevet: Korábbi / név nélkül jelzést kapnak.
A készlet közös, a négy gép egyszerre dolgozhat. A jegyzetek és munkalapok
változatlanul gépenként külön maradnak; csak a választott raktárosnév kerül a naplóba.
USB: csatlakoztasd az olvasót, add meg a neved és a darabszámot, majd kattints
az USB-s vonalkódolvasó indítása gombra. Olvasáskor az Enter automatikusan
bevételez. Az olvasót billentyűzet üzemmódban, Enter lezárással használd.
Ismeretlen kódnál rögzítsd a terméket / válaszd a katalógusból, majd olvasd be újra.
Olaj: válassz autóbuborékot, az olajmező az adott autóhoz tartozik.
A régi közös olajszöveg az első autóhoz kerül megőrzésre; a többihez külön írható.
Az Excel Járművek lapja is tartalmazza az autónkénti olajat.
A névbuborék alatti sárga Felírva állapotgomb és felirat eltűnt. A cikkszámok
Felírva pipája és a megrendelt, fel nem írt tételekre figyelmeztető ! megmaradt.
A kézi / Ctrl+S és óránkénti jegyzetmentés változatlan.


1.17.0 – RAKTÁRTÉRKÉP ÉS TERMÉKHELYEK
A kapott alaprajz polcai, pultjai és számozott helyei kattinthatók.
A rajzon a bejárat felül, középen van; a kijelölt helyek piros kiemelést kapnak.
Telefonon az alaprajz oldalra is húzható.

HELY MEGADÁSA KÉZZEL
Raktár / leltár → termék sorában Szerkesztés → Hely kiválasztása a térképen.
Kattints a megfelelő pontra / pontokra (pl. bf polc 03, 01 vagy h rakt 02).
Újabb kattintás a kijelölést leveszi. Egy termékhez több hely is megadható.
Kijelölt helyek átvétele → szükség esetén pontosítás, pl. felső polc → Termék mentése.
A hely önmagában nem változtatja meg a készlet darabszámát.
A térkép bezárása átvétel nélkül eldobja az ottani kijelölést.
A termék Mégse gombja az összes nem mentett szerkesztést eldobja.

KERESÉS ÉS MEGTALÁLÁS
A Raktár Keresés mezőjébe írd a cikkszámot, ne a bevételező mezőbe!
A találat Hely oszlopában látszik a polc neve és a pontosítás.
Kattints rá: megnyílik a térkép és pirossal mutatja a termék mentett helyeit.
Helynévre is kereshetsz. OC295 és OC 295 keresés egyaránt használható.
A Jegyzetek cikkszámsorában a Hely gomb ugyanazt a közös raktári terméket keresi.
Ha nincs egyértelmű raktári termék, előbb a Raktárban kell azt rögzíteni.
Telefonon termékkeresés / vonalkód beolvasása után a Hely gomb is megjelenik.
A helyek megtekintése nem vételez be és nem von le készletet.

A helyek a közös raktár termékadataihoz tartoznak. A főgépen és a többi gépen
ugyanazok jelennek meg, a mentés után legkésőbb a következő frissítéskor.
A közös raktár biztonsági mentése és a Raktár Excel-exportja is tartalmazza őket.
A meglévő termékek helye kezdetben üres, semmilyen helyet nem találunk ki hozzájuk.
Frissítsétek mind a négy gépet; telefonon töltsétek újra a Safari-oldalt.
A jegyzetek, munkalapok és a kézi / óránkénti mentés gépenként külön maradnak.


1.18.0 – RAKTÁRI TÉTELTÍPUSOK
A bal oldali menü felső sorában egymás mellett van az Autónyilvántartó
és a Raktár / leltár; a Jegyzetek és Munkalapok az alattuk lévő sorban.
A jegyzetek maradnak az induló nézet.

A raktári listában a Cikkszám melletti Tételtípus listából válassz.
Az itt kiválasztott besorolás azonnal mentődik a közös raktárba.
Új terméknél vagy Szerkesztésnél is kiválasztható, ott Termék mentése rögzíti.
A 25 választható típus:
Légszűrő, Pollenszűrő, Olajszűrő, Motorolaj, Akkumulátor, Ponyva, Égő,
Illatosító, Ragasztó, Egyéb kiegészítő, Kozmetikum, Fagyálló, Ablakmosó folyadék,
Adalék anyagok, Ablaktörlő, Ad blue, Váltóolaj, Fékolaj, Sprayk, Antenna,
Elem, Kipufogó alkatrészek, Vezérlés, FAP adalék, Gyújtáskapcsoló betétek.

A kereső mellett a Tételtípus szűrővel választhatod ki, melyik csoportot lásd.
A szűrés és a szöveges cikkszám-/terméknév-/helykeresés együtt használható.
A meglévő termékek Nincs besorolva állapotban maradnak, amíg kézzel nem választasz.
Új katalógusos szűrőnél a megfelelő Olajszűrő, Légszűrő vagy Pollenszűrő típus
előre kitöltődik, de módosítható. Meglévő termék saját besorolása megmarad.
Telefonon a termék adatai között látható a típus; új terméknél is kiválasztható.
A Raktár Excel-exportja és teljes biztonsági mentése tartalmazza a besorolást.
A besorolás módosítása nem változtatja meg a darabszámot, vonalkódot vagy helyet.
Frissítsétek a négy gépet, telefonon töltsétek újra a Safari-oldalt.
A jegyzetek és munkalapok továbbra is gépenként külön maradnak.


1.19.0 – KÉSZLETFIGYELŐ ÉS RAKTÁRI ÁR
Raktár → termék Szerkesztése:
- Ár (Ft/db): ez a jegyzet Teli ár mezőjéhez használható egységár.
- Készletfigyelés bekapcsolása: pipáld be, majd add meg a darabhatárt.
- Termék mentése: az ár és a határ a közös raktárban mentődik.
Példa: 3 db határnál 3, 2, 1 és 0 db esetén jelez. 0-s határ csak kifogyáskor jelez.
Pipa nélkül nincs készletfigyelés az adott termékre; a régi termékeknél kezdetben ki van kapcsolva.
A figyelmeztetés fent, pirosan villog, minden részlegen az emlékeztető mellett / alatt.
A Megnézem gomb felsorolja a termékeket, készletüket és a beállított határokat.
Innen a Termék beállítása gomb megnyitja a szerkesztést.
Feltöltés vagy a figyelés kikapcsolása után automatikusan eltűnik a jelzés.
A háttérben legfeljebb 10 másodpercenként ellenőrzi a közös készletet.
Megszakadt kapcsolatnál sárga jelzés közli, hogy a készlet nem ellenőrizhető;
a korábbi figyelmeztetést nem tekinti megoldottnak egy hálózati hiba miatt.

JEGYZET ÁRAZÁSA
Írd be a raktárban már létező cikkszámot, majd lépj ki a mezőből (Tab vagy kattintás).
Ha a Teli ár üres, a mentett raktári Ft/db ár automatikusan bekerül.
A kedvezmény százaléka megmarad, a kedvezményes ár újraszámolódik.
A már kézzel kitöltött árat nem írja felül automatikusan.
A cikkszám melletti Raktári ár gombbal kifejezetten lecserélheted a meglévő árat is.
A Raktárról pipa bekapcsolásakor is kitölti az üres árat, ha van mentett raktári ár.
Az ár átvétele önmagában nem von le készletet; csak a Raktárról pipa számít.
Az ár átvétele után a jegyzet a szokásos kézi / Ctrl+S vagy óránkénti mentéssel rögzül.
A Raktárról pipa továbbra is azonnal menti a készletmódosítást.
Egy raktári árváltozás nem írja át a korábbi jegyzetek árait.
A Raktár táblázatában látszik az Ár és a Készlethatár; az Excel-export és a teljes
raktármentés is tartalmazza őket. Telefonon a termék ára és az alacsony készlet is látszik.
Mind a négy gépen frissíts, telefonon töltsd újra a Safari-oldalt.
A jegyzetek és munkalapok továbbra is gépenként külön maradnak.


1.20.0 – KÉSZLETFIGYELŐ: MEGRENDELEM / MEGRENDELVE
A készletjelzés ugyanott fent marad, minden részlegen.
Piros: a készlet a beállított határon vagy alatta van, még senki nem vállalta.
Megrendelem: kattints rá a felső jelzésnél, a jelzés sárga lesz a vállaló nevével.
Ha még nincs saját raktárosneved, az ablakban előbb megadhatod.
Megrendelve pipa: akkor jelöld be, amikor ténylegesen leadtad a rendelést.
A jelzés bepipálva is sárga marad, amíg a készletet a jelzési határ fölé nem töltitek.
A vállaló és a rendelést leadó személy neve külön megmarad, ha nem ugyanaz.
A Megrendelve pipa visszavehető; ilyenkor vállalt, még le nem adott rendelésként,
sárgán marad. A vállaló neve nem változik.

TÖBB TERMÉK ÉS KÖZÖS MUNKA
A felső jelzésnél a nyilakkal lapozhatsz; a Megnézem gomb az összes jelzést mutatja.
Az új piros készlethiány automatikusan előre kerül, nem bújik el a sárgák mögött.
Az összes gép ugyanazt az állapotot látja, legfeljebb a következő frissítéskor.
Két egyidejű Megrendelem kattintásból csak az első vállalás mentődik;
a másik munkatárs látja, ki vállalta már a rendelést.
A rendelés jelölése nem változtat készletet, árat vagy jegyzetet.

FELTÖLTÉS ÉS ÚJ KÉSZLETHIÁNY
Részleges feltöltésnél, ha a készlet még a határon / alatta marad, a sárga jelzés megmarad.
A határ fölé töltve a figyelmeztetés és a hozzá tartozó aktuális rendelésjelölés lezárul.
Újabb készlethiánynál új piros jelzés indul, Megrendelve pipa nélkül.
A régi, késve beérkező kattintás nem módosíthatja az új készlethiány állapotát.
A készletfigyelés kikapcsolása szintén lezárja az aktuális jelzést.
A közös raktár mentése és az Excel-export is tartalmazza az aktuális rendelés állapotát.
A vállalás és a pipa újraindítás után is megmarad.

Frissítsétek a főgépet és a másik három gépet is. Telefonon töltsétek újra az oldalt.
A jegyzetek, munkalapok és emlékeztetők továbbra is gépenként külön maradnak.


1.21.0 – MEGRENDELVE ELREJTÉSE ÉS LELTÁR ELLENŐRZŐ
MEGRENDELVE
A Megrendelve pipa után az adott tétel eltűnik a felső készletjelzésekből.
A rendelés állapota megmarad a közös raktárban: a Raktárkészlet listában
az Utánrendelés oszlop mutatja. A Pipa visszavonása gomb újra láthatóvá teszi.
A többi, még meg nem rendelt készlethiány jelzése változatlanul megmarad.
Feltöltés után egy későbbi új készlethiány új piros jelzést indít.
Ez a működés felváltja az 1.20.0-s, megrendelés után is sárgán maradó jelzést.

LELTÁR ELLENŐRZŐ – SZÁMÍTÓGÉP
Raktár / leltár → Leltár ellenőrző → Új ellenőrzés.
Előbb add meg a saját raktárosnevedet, és nevezd el az ellenőrzést.
Indításkor rögzül a mostani terméklista és az induló raktárkészlet.
A vonalkód / cikkszám mezőbe olvass be, és add meg a Hozzáadott darabszámot.
Az Enter vagy a Számláláshoz adom gomb kizárólag a számolt mennyiséghez adja a darabokat.
Ismételt beolvasás összeadódik; ugyanazon termék eltérő mentett vonalkódjai együtt számítanak.
Négy gépről és telefonról ugyanahhoz a nyitott ellenőrzéshez dolgozhattok.
Osszátok fel a megszámolandó árut: ugyanazt a fizikai darabot ne számoljátok többen.
Egy sor Darabszám javítása mezőjébe a teljes helyes szám írható, akár 0 is.
A még meg nem számolt sor külön Nincs számolva állapotú, nem válik automatikusan hiánnyá.
Ismeretlen kódnál hiba jelenik meg. Előbb a Raktárban rendeld hozzá a megfelelő termékhez;
a számlálás nem hoz létre automatikusan új raktári terméket.
Az újonnan létrehozott raktári termék egy következő ellenőrzés induló listájába kerülhet.
A függő USB-s beolvasások megmaradnak; hibánál folytatás vagy hibás beolvasás kihagyása választható.

ELTÉRÉSEK
Induló készlet, Számolt db és Eltérés oszlopok: pl. induló 5, számolt 3 → -2 db.
A Csak eltérések szűrő a már számolt, eltérő tételeket mutatja.
A Beolvasott kódok oszlopban látszanak a rögzített kódok, a számolónál az utolsó raktáros neve.
Ha közben eladás vagy bevételezés történt, külön figyelmeztetés és az aktuális készlet is látható.
Az eltérés mindig az induláskori készlethez képest értendő. Pontos összevetéshez lehetőleg
ne legyen közben készletmozgás; a jelzett változásokat külön ellenőrizzétek.
A számlálás és a javítás NEM írja át a raktár darabszámát.

TELEFON
Jelentkezz be a megszokott telefonos oldalon a saját neveddel.
Művelet → Leltár ellenőrzés – csak számlálás.
A gépen legyen előbb elindított nyitott ellenőrzés. Kamera vagy kézi kódkeresés után
add meg a számolt darabszámot, majd Számláláshoz adom.
Ebben a módban az automatikus kamerás bevételezés sem módosítja a raktárkészletet.
A rendes Bevételezés a raktárba mód továbbra is a tényleges készlethez ad.

MEGŐRZÉS
Mentés Excelbe: az ellenőrzés és az összes sora külön munkafüzetbe kerül.
Ellenőrzés lezárása: a számolás lezárul, a jelentés záró adatai megmaradnak.
Lezárás előtt várjátok meg, hogy minden gépen elfogyjon a függő beolvasási sor.
A korábbi ellenőrzések a legördülő listából újranyithatók megtekintésre.
Legfeljebb 50 ellenőrzés tárolható; lezárt ellenőrzés külön, megerősítéssel törölhető.
A teljes Raktár biztonsági mentése az ellenőrzéseket is tartalmazza.
A saját jegyzetek, munkalapok és emlékeztetők gépenként külön maradnak.
Frissítsétek mind a négy gépet, telefonon töltsétek újra a Safari-oldalt.
