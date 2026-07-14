# AIA GUBBIO — ISTRUZIONI DI INSTALLAZIONE E UTILIZZO

© 2026 Nardoni Filippo — Uso riservato Sezione AIA di Gubbio

---

## COSA CONTIENE QUESTA CARTELLA

| File          | Descrizione                                      |
|---------------|--------------------------------------------------|
| `index.html`  | L'interfaccia grafica (apri nel browser)         |
| `server.js`   | Il motore di estrazione dati (avvia dal terminale)|
| `package.json`| Configurazione del progetto                      |
| `avvia_server.bat` | Avvio rapido del server — **solo Windows** (doppio clic) |
| `avvia_server.command` | Avvio rapido del server — **solo Mac** (doppio clic) |
| `ISTRUZIONI.md` | Questo file                                    |

Queste istruzioni valgono sia per **Windows** che per **Mac**. Segui la colonna/sezione relativa al tuo sistema.

---

## PASSO 1 — Installa Node.js (solo la prima volta)

### 🪟 Windows

1. Apri il **Prompt dei comandi** (cerca "cmd" nel menu Start) oppure **PowerShell**
2. Digita questo comando e premi Invio:
   ```
   winget install OpenJS.NodeJS.LTS
   ```
3. Segui le eventuali richieste a schermo (accetta i termini se richiesto)
4. Al termine, **chiudi e riapri il terminale**

> Se `winget` non è disponibile (Windows datato), scarica il file `.msi` da **https://nodejs.org** (pulsante verde "LTS") e installalo cliccando "Next" su tutto.

### 🍎 Mac

1. Apri l'app **Terminale** (cerca "Terminale" con Spotlight, `Cmd + Spazio`)
2. Se non hai **Homebrew** installato, digita:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   ```
   e segui le istruzioni a schermo (potrebbe chiedere la password del Mac)
3. Installa Node.js con:
   ```
   brew install node
   ```
4. Attendi il completamento (1-2 minuti)

### ✅ Verifica installazione (entrambi i sistemi)

Nel terminale, digita:
```
node --version
```
Deve apparire qualcosa tipo: `v20.12.0` (o superiore)

---

## PASSO 2 — Installa le dipendenze (solo la prima volta)

### 🪟 Windows — Prompt dei comandi

```
cd C:\percorso\dove\hai\messo\la\cartella\aia-gubbio
```
*(esempio: `cd Desktop\aia-gubbio`)*

### 🍎 Mac — Terminale

```
cd /percorso/dove/hai/messo/la/cartella/aia-gubbio
```
*(esempio: `cd ~/Desktop/aia-gubbio` — puoi anche digitare `cd ` con lo spazio e poi trascinare la cartella dal Finder dentro la finestra del Terminale)*

### Poi, su entrambi i sistemi:

1. Installa i pacchetti necessari:
   ```
   npm install
   ```
   *(attendi: scarica i file necessari, può richiedere 1-2 minuti)*

2. Installa il browser Chromium per lo scraping:
   ```
   npx playwright install chromium
   ```
   *(scarica Chrome in modo silenzioso, circa 100 MB, solo la prima volta)*

---

## PASSO 3 — Avvio del programma (ogni volta che si usa)

### ① Avvia il server

**Modo rapido (consigliato):** fai doppio clic su:
- `avvia_server.bat` su **Windows**
- `avvia_server.command` su **Mac** *(la prima volta potrebbe servire clic destro → Apri, per via delle protezioni di sicurezza macOS)*

Questi script chiudono automaticamente eventuali server già attivi sulla porta 3456 e avviano `node server.js` senza bisogno di aprire il terminale manualmente.

Nota Mac: se al doppio clic appare l'errore "non hai i privilegi di accesso appropriati", apri il Terminale, digita chmod +x  (con lo spazio dopo), trascina il file avvia_server.command dentro la finestra del Terminale e premi Invio. Basta farlo una sola volta.

**Modo manuale, da terminale:**

Windows (Prompt dei comandi):
```
cd Desktop\aia-gubbio
node server.js
```

Mac (Terminale):
```
cd ~/Desktop/aia-gubbio
node server.js
```

In entrambi i casi vedrai scritto:
```
╔══════════════════════════════════════════════════╗
║   AIA GUBBIO — Server designazioni avviato       ║
║   In ascolto su http://localhost:3456             ║
╚══════════════════════════════════════════════════╝
```
**Lascia questa finestra aperta per tutto il tempo.**

### ② Apri l'interfaccia

1. Vai nella cartella `aia-gubbio`
2. Fai **doppio clic** su `index.html`
   *(si aprirà nel browser — consigliato Chrome o Edge su Windows, Chrome o Safari su Mac)*

### ③ Estrai le designazioni

1. Clicca il bottone **"Estrai Designazioni dal Sito AIA"**
2. Attendi: il programma naviga automaticamente tutte le pagine
   *(può richiedere 1-3 minuti a seconda della connessione)*
3. I risultati appaiono suddivisi per categoria
4. Clicca **"Esporta PDF"** per scaricare la lista pronta per il grafico

---

## RISOLUZIONE PROBLEMI

| Problema | Soluzione |
|----------|-----------|
| "Impossibile connettersi al server" | Assicurati di aver avviato `node server.js` nel terminale |
| "node non è riconosciuto" / "command not found: node" | Chiudi e riapri il terminale dopo l'installazione; su Mac assicurati che Homebrew abbia terminato senza errori |
| Il browser si apre ma non carica | Controlla la connessione Internet |
| Nessun risultato trovato | Potrebbe non esserci ancora la giornata pubblicata sul sito AIA |
| Errore durante `npm install` | Assicurati di essere nella cartella giusta e ripeti il comando |
| Su Mac appare "sviluppatore non verificato" | Vai su **Impostazioni di Sistema → Privacy e Sicurezza** e clicca "Apri comunque" |

---

## AGGIORNAMENTI SETTIMANALI

Ogni settimana:
1. Avvia il server (`node server.js`)
2. Apri `index.html`
3. Clicca "Estrai Designazioni"
4. Esporta il PDF

Il programma scarica sempre i dati aggiornati dal sito AIA.

---

## NOTE TECNICHE

- Il server gira solo sul PC locale (porta 3456), non è accessibile da Internet
- Nessun dato viene salvato o trasmesso a terzi
- Il PDF viene generato direttamente nel browser e salvato in locale
- Compatibile con Windows 10/11, macOS, Linux

---

*Sviluppato da Nardoni Filippo — 2026*
*Tutti i diritti riservati — Uso esclusivo Sezione AIA di Gubbio*
