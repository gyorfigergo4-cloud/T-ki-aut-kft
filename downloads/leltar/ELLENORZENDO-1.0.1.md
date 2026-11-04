# Töki Autó Leltár 1.0.1 – kizárólag vizsgálatra szánt forráscsomag

[A módosított, ellenőrzendő ZIP letöltése](https://github.com/gyorfigergo4-cloud/T-ki-aut-kft/raw/refs/heads/main/downloads/leltar/TokiAuto-Leltar-1.0.1-ELLENORZENDO.zip)

A felhasználó külön kérésére megosztott változat **nem Windows Defenderrel ellenőrzött, használatra jóváhagyott kiadás**. A korábbi 1.0.0 ZIP `Trojan:Script/Sabsik.FL.A!ml` riasztásának pontos belső oka továbbra sem ismert. Az eredeti csomagot ne állítsd vissza és ne engedélyezd.

Az új forráscsomagban nincs mellékelt EXE, DLL, MSI, CMD, BAT vagy PowerShell-telepítő. Nem tölt le programot, nem állítja át a PowerShell végrehajtási szabályait, és nem módosít automatikusan tanúsítványbizalmat. A binárisok hiánya nem bizonyít vírusmentességet: a forráskódot is ellenőrizni kell.

**Letöltés után először csak vizsgáltasd át, ne indítsd el.** Fájlkezelő → jobb kattintás a ZIP-en → szükség esetén További lehetőségek megjelenítése → Vizsgálat a Microsoft Defenderrel. Ha a letöltésnél vagy a vizsgálatnál újra riasztás jelenik meg, hagyd blokkolva; ne adj kivételt. A pontos találatot kell kivizsgálni.

Ez forráscsomag, nem dupla kattintásos Windows-telepítő. A vizsgálatot követő kézi beállításához külön, hivatalos forrásból telepített Node.js és a telefonos kamerához megbízható HTTPS szükséges. A lépések és korlátok a ZIP `TELEPITES.md`, `KEZDES-ITT.txt` és `ELLENORZES.md` fájljaiban olvashatók.

A működési ellenőrzések – öt integrációs teszt, két elkülönített mobilméretű böngészővel végzett közös leltárpróba, valamint a node_modules nélküli kibontott csomag indítási ellenőrzése – sikerültek Linuxon. Ezek nem vírusvizsgálatok és nem helyettesítik a Windowsos tesztet.

Méret: 273108 bájt. SHA256: `6823775ec16225b6c50120d2e3c8180a399b4ca30046a465a7a8205ba27921fd`.
