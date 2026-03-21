# 🚀 InfraKit – Részletes Coolify Telepítési Útmutató (Mindent Lépésről Lépésre)

Ez a dokumentum a lehető legrészletesebben, az alapoktól kezdve mutatja be, hogyan telepítsd a teljes **InfraKit** (PostgreSQL, Valkey, Garage S3, GlitchTip, Kuma, Filestash, InfraPanel) csomagodat egy friss Coolify (v4) szerverre. Ha még sosem állítottál be egy ilyen rendszert, akkor **pontosan kövesd ezeket a lépéseket!**

---

## 1. Fázis: Előkészületek és DNS beállítások

### 1.1 Szerver és Domain Előkészítése
Ahhoz, hogy minden szolgáltatás elérhető legyen `https://` (SSL) címen, a Coolify szerverednek rendelkeznie kell egy Publikus IP-címmel. Továbbá a domain szolgáltatódnál (Cloudflare, Rackhost, Nethely stb.) be kell állítanod a domain neved alatt úgynevezett **A rekordokat**, amik a szervered IP-jére mutatnak.

**Példa DNS Rekordokra:**
Hozd létre a DNS-ben az alábbi A vagy CNAME rekordokat. Ezek a *publikus* webről is elérhető szolgáltatásokhoz kellenek:
*   `errors` (a GlitchTip-hez) -> IP Cím
*   `s3` (a Garage Public S3 API-hoz) -> IP Cím

*Opcionális Vercel/Next.js kapcsolatokhoz (Ha nem IP címmel, hanem domainnel akarod a Vercel-ből elérni a nyitott adatbázis portokat):*
*   `db` (A PgBouncer TCP-hez) -> IP Cím
*   `cache` (A Valkey TCP-hez) -> IP Cím

*(Megjegyzés: Az Adminer, Uptime Kuma, Filestash és InfraPanel beépített **Tailscale VPN** mögött fut, így hozzájuk nem kell DNS rekordot felvenned, mert nincsenek kint a weben!)*

---

## 2. Fázis: Kód Feltöltése Git Repóba (Lokális Teendők a Gépeden)

A Coolify a GitHub, GitLab, vagy Bitbucket tárolókból szereti leginkább "learatni" és naprakészen tartani a kódokat, ezért első dolgunk ezt az egész projekt mappát egy privát repóba rakni.

1.  Hozd létre egy új **Privát** repository-t a Github-on (Pl.: `TE_FELHASZNALONEVED/infrakit`)
2.  Nyisd meg a parancssort azon a gépeden, ahol most az `infrakit` mappa van.
3.  Futtasd le a következőket szó szerint (csak a repo URL-t írd át a tiédre!):

```bash
# Lépj be a mappába
cd infrakit

# Git bázis inicializálása
git init

# Minden fájl és mappa felvétele (a node_modules kizárásra kerül a .gitignore miatt)
git add .

# Első verzió elnevezése
git commit -m "🚀 Initial commit: Teljes InfraKit Stack és InfraPanel V1.0"

# Main nevű fő ág létrehozása
git branch -M main

# Kössük össze a lokális kódot a GitHub-al (Itt a te saját git indexed kell!)
git remote add origin https://github.com/TE_FELHASZNALONEVED/infrakit.git
# vagy SSH: git remote add origin git@github.com:TE_FELHASZNALONEVED/infrakit.git

# Töltsük fel a repót a felhőbe
git push -u origin main
```

*(Ha jelszót/Token-t kér a GitHub, add meg, vagy használd az ingyenes GitHub Desktop alkalmazást!)*

---

## 3. Fázis: Host Mappák és Jogosultságok a VPS-en (FONTOS!)

Néhány docker konténer (mint a PostgreSQL vagy a S3 tároló) úgynevezett bind-mount térfogatokat (volume-okat) használ, melyet az operációs rendszer mappáiba csatol (`/opt/infrakit/data`).
Mielőtt bármit tennél a felületen, ki kell osztani ezeket a szerveren!

1.  Lépj be SSH-n a VPS kiszolgálódra (azon a gépen, amin a Coolify is pörög!)
    ```bash
    ssh root@<a-szerver-ip-cime>
    ```
2.  Hozzuk létre a mappákat és rendeljük hozzájuk a Postgres hivatalos "UID 999" (és Garage) Linux felhasználóit:
    ```bash
    # 1. Alap mappa létrehozása (a .env-be definiált PROJECT_NAME szerint, default: designflow)
    mkdir -p /opt/infrakit/data/designflow/postgres
    mkdir -p /opt/infrakit/data/designflow/garage/data
    mkdir -p /opt/infrakit/data/designflow/garage/meta
    mkdir -p /opt/infrakit/data/designflow/valkey
    mkdir -p /opt/infrakit/data/designflow/uptime-kuma
    mkdir -p /opt/infrakit/data/designflow/filestash

    # 2. Postgres jogosultság delegálása (az 1000-res és 999-es UID a legtöbb DB image standardja)
    chown -R 999:999 /opt/infrakit/data/designflow/postgres
    chmod -R 700 /opt/infrakit/data/designflow/postgres
    
    # 3. Garage beállítások (a biztoság kedvéért olvasási és írási engedély az alkalmazásnak)
    chmod -R 777 /opt/infrakit/data/designflow/garage
    chmod -R 777 /opt/infrakit/data/designflow/valkey
    ```
Kész, a VPS szerver elő van készítve!

---

## 4. Fázis: Telepítés a Coolify-ból (Kattintásról Kattintásra)

Most már mindent előkészítettünk, jöhet a "varázslat"!

### 4.1 Projekt Hozzáadása
1.  Jelentkezz be a **Coolify Dashboardodba**.
2.  Bal oldali menüben kattints a **Projects**-re, és hozz létre egy új projektet: "DesignFlow InfraKit" vagy valami hasonló néven.
3.  Lépj bele, válaszd ki (vagy hozz létre) a **Production** Environmentet (Környezetet).
4.  Kattints a hatalmas **[ + Add New Resource ]** gombra.
5.  Válasszuk ki a forrást: Klikk a **"Public repository"**-ra, vagy ha privátra tettük a könyvtárat, telepítsd fel és válaszd a **"Private Repository (GitHub App)"** opciót.
6.  Keress rá az `infrakit` nevű repódra, a Branch név pedig **main** legyen.
7.  A "Build Pack" sornál jelöld be, hogy **Docker Compose**! Ez a legkritikusabb!
8.  Nyomd meg a **Save / Continue** gombot.

### 4.2 Környezeti Változók (.env) bevitele (nagyon fontos!)
Amikor letölti a repót a Coolify, behoz egy konfigurációs ablakot hosszas lapfül navigációval. A legelső lépés, ami nélkül azonnal elhasalna a telepítés, a változók betöltése.

1.  A felső lebegő menüben, válaszd ki az **Environment Variables** (Környezeti változók) lapfület.
2.  Látni fogsz egy olyan gombot, hogy **"Switch to Paste (Developer) View"** vagy **Text Editor Mode**. Kattints  rá!
3.  Menj a gépeden található `infrakit/.env.example` fájlhoz, **nyisd meg, és MÁSOLD KI a TELJES tartalmát**.
4.  Illeszd (Paste) be a teljes sablont a Coolify ablakba, majd nyomj **Save**-et, hogy kiparse-olja (szétszedje) a felület nekünk sorokra.
5.  **MOST KITÖLTJÜK a VÁLTOZÓKAT** (Írd is át őket ott helyben):
    - `PROJECT_NAME`: ha szerver mappát csináltál (`designflow`), akkor marad ez.
    - Értelemszerűen a `DOMAIN` részek:
      - S3 API és GlitchTip marad HTTPS-es: `GARAGE_S3_API_DOMAIN=https://s3.designflow.hu` és `GLITCHTIP_DOMAIN=https://errors.designflow.hu`
      - **A belső szolgáltatásokat állítsd át a Tailscale hivatkozásokra:**
        `UPTIME_KUMA_DOMAIN=http://infrakit-secure:3001`
        `FILESTASH_DOMAIN=http://infrakit-secure:8334`
        `INFRAPANEL_DOMAIN=http://infrakit-secure:3000`
        `ADMINER_DOMAIN=http://infrakit-secure:8080`
    - Pörgess le a felület aljára! Ott vannak a # SERVICE_PASSWORD_64.. magic jelszavak.
      Ezek **jelszavak**.  El kell őket nevezned magadnak bonyolult karaktersorozatokra (Coolify amúgy auto is csinálhat belőle magic-et, de jobb, ha te írod ki: pl. `SERVICE_PASSWORD_64_POSTGRES=NagyonTitkos1234$`), és írj be mindenhova fixet. Ezt te fogod kérni később!
    - **ÚJ - EGYSÉGES ADMIN:** Keresd meg és állítsd be az `ADMIN_EMAIL` és `ADMIN_PASSWORD` értékeket. Ezt a jelszót és emailt fogod használni az összes saját műszerfaladhoz (InfraPanel, GlitchTip, Uptime Kuma első regisztráció stb.). Ne hagyd alapértelmezetten!
    - **ÚJ - TAILSCALE AUTHKEY:** Navigálj a [login.tailscale.com](https://login.tailscale.com/admin/settings/keys) oldalra. Generálj egy "Auth key"-t (pipáld be: Reusable). A kapott kulcsot (pl. `tskey-auth-XYZ`) másold be az ablakba a `TAILSCALE_AUTHKEY` értékéhez! **Enélkül nem futnak majd a belső felületek!**
6.  Győződj meg róla, hogy minden sor beállítása a "Is Build Variable?" checkboxban **NEM** van kipipálva (itt nincsenek compile time változók a Változóknál). Mentsd el mégegyszer az Environment Variables panelt!


### 4.3 A Hatalmas "Deploy" Nyomógomb
Ha felvetted az env változókat, és be lettek kötve a Domain címek:
1.  Navigálj vissza a Coolify-ban a projekt **Konfiguráció (Configuration)** fülére.
2.  Görgess teljesen felfelé a kék sarokban.
3.  Nyomd le a **Deploy** (Telepítés) gombot.
4.  Egy log képernyő (Terminál) jelenik meg. Várj nagyjából **2-3 percet**!

Mit csinál közben a Coolify?
- Letölti az Alpine Linuxot a Postgresnek.
- Letölti a Garage-ot.
- **Megépíti az InfraPanel Műszerfaladat (TanStack Start Build)!** Egy teljesen privát és izolált Bun konténert varázsol a repód `infrapanel` mappájából és telepíti bele az `@aws-sdk` -at is. Ez a leghosszabb része a Deploynak.

Hagyd végigfutni a Loadert `Deployed Successfully` üzenetig!

---

## 5. Fázis: Post-Deploy (Végső ellenőrzés és használatba vétel)

Ha lefutott:
1.  Legyél bekapcsolva a **Tailscale** alkalmazásba a saját számítógépeden.
2.  Nyiss meg egy új böngészőt, és menj el a privát dashboardodra: `http://infrakit-secure:3000`
3.  A biztonsági Login fal fogad majd. Írd be a legutolsó lépésben megadott `.env` jelszavad (`PANEL_ADMIN_PASSWORD`).
4.  **Tádá! Bekerültél a saját rendszer áttekintődbe!** A Műszerfal azonnal jelezni fogja: "Postgres 16 -> Online", "Valkey Cache -> Online", "S3 Storage -> Online".
5.  Látni fogsz "Külső Eszközök" gombokat (Uptime Kuma, GlitchTip, Adminer...). **Teszteld le!** Míg a GlitchTip ki fog vinni a webre HTTPS-sel, a többi alkalmazás megnyílik a VPN-en keresztül a belső `http://infrakit-secure:xxxx` portodon. Abszolút inkognitóban dolgozhatsz!

Készen vagy! 🎉  Ezen az InfraKit stacken a RAM memóriádat felokosítottuk legfeljebb 2 GB-ig, garantált az optimális kiszolgálás a kisebb VPS-eden. Most már csatlakoztathatod a DesignFlow frontendedből (Vercel) közvetlenül Postgres-ent, használhatod a Valkey-t, és pakolhatod az AWS kompatibilis S3 storage-ba (Garage) az avatárokat és a file feltöltéseket.

**Egységes belépési fiókok:**
Ahol csak lehet, a rendszer az `.env`-ben megadott `ADMIN_EMAIL` és `ADMIN_PASSWORD` párost használja.
- **InfraPanel**: Belépés a jelszóval önmagában.
- **Glitchtip**: Az admin fiók automatikusan létrejön az `ADMIN_EMAIL` / `ADMIN_PASSWORD` paraméterekkel.
- **Uptime Kuma és Filestash**: Az legelső megnyitáskor kérni fog egy fiók létrehozást. Kérlek regisztrálj ugyanazzal az email/jelszó párossal a kényelem érdekében!
