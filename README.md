# Töki Autó Kft. · Belső jegyzetek

Magyar nyelvű, offline autóbolti belső jegyzetelő Windowsra. A bejegyzések év → hónap → nap szerint rendeződnek, egy napon belül minden névhez külön strukturált adatlap tartozik.

## Megjelenés

A felület a küldött Töki Autó Alkatrész logó fekete–fehér–élénkzöld színvilágát követi: sötét oldalsáv, zöld kiemelések és világos adatlapok. A fejléc helyi `app/assets/toki-logo.png` képe a felhasználó logója alapján képgenerálóval előkészített, tisztított változat, nem az eredeti feltöltött képfájl. A `toki-mark.svg` az alkalmazás kis ikonja. A megjelenés nem használ külső betűkészletet vagy hálózatról betöltött képet.

## Évek, hónapok, napok és nevek

- Kezdetben 2024, 2025 és 2026 év mappája látható. A „＋ Év” gombbal további év hozható létre; minden év alatt mind a 12 hónap elérhető.
- Nyisd le az évet, majd a hónapot. A „Nap hozzáadása” gombbal válassz dátumot. Meglévő nap megnyitása nem készít másolatot. Az új üres évek és napok is megmaradnak újraindítás után.
- A kiválasztott napon az „Új név a naphoz” gombbal több név és külön adatlap vehető fel. Fent a névkártyákkal válthatsz köztük.
- Az adatlap mezői: név, alvázszám, cikkszámok (több sorban), opcionális olaj (típus és mennyiség), teli ár, kedvezményes ár (Ft), megjegyzés. Az árak az adott adatlap egészére vonatkoznak.
- A kereső minden év minden adatlapjának mezőiben keres, ékezet nélkül is. A találatra kattintva annak napjához és adatlapjához jutsz.
- A mentés automatikus és helyi. Egy név adatlapjának törlése nem törli a napot vagy a többi név adatait.

A régi bejegyzések külön adatlapként megmaradnak, a rögzítési dátumuk szerinti naphoz kerülnek. Korábbi rögzítési dátum hiányában a meglévő módosítási időt használja. A későbbi szerkesztés nem változtatja meg a bejegyzés napját. A korábbi általános jegyzet címe a Név mezőben, szövege a Megjegyzésben marad.

Az alkalmazás egy számítógép helyi adataival dolgozik; többgépes közös használatot és változattörténetet nem tartalmaz. Az autóbolti felület még egyeztetés alatt van; a meglévő ZIP a korábbi általános jegyzetelő buildje, az új felület véglegesítése után újra kell csomagolni.

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

A Windows-felhasználónak ehhez nem kell Python: a csomag a már feldolgozott adatokat tölti be.

## Windows letöltés és indítás

1. Töltsd le a tároló ZIP-archívumát, és csomagold ki az egész mappát.
2. Kattints duplán a `TokiAuto-Inditas.cmd` fájlra. A program ellenőrzött csomagja a `downloads` részekből helyben összeáll, a saját felhasználód AppData könyvtárába kerül, és elindul. A részeket hagyd a helyükön. Internet csak a ZIP letöltéséhez kell.
3. Az appban kattints a **Jegyzetmappa betöltése** gombra, és válaszd a saját **Napi jegyzetek** mappádat (amelyben a 2024, 2025, 2026 almappák vannak).
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
```

A Windows-csomag a `dist/Jegyzetfuzet-win32-x64` könyvtárba kerül. Proxyt igénylő környezetben az Electron letöltéséhez `ELECTRON_GET_USE_PROXY=1`, valamint a `GLOBAL_AGENT_HTTP_PROXY` és `GLOBAL_AGENT_HTTPS_PROXY` beállítása szükséges a meglévő proxycímekre. A TLS- és checksum-ellenőrzést hagyd bekapcsolva.

Ellenőrzés: adattárolási, archívum- és DOM funkcionális tesztek Linuxon; böngészőben a mappák, több név, új év és nap, keresés és újratöltés ellenőrizve mintaadatokkal. A Windows bináris futtatása külön Windows gépen ellenőrizendő.
