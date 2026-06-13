# AIA GUBBIO — ISTRUZIONI DI INSTALLAZIONE E UTILIZZO

© 2026 Nardoni Filippo — Uso riservato Sezione AIA di Gubbio

---

## COSA CONTIENE QUESTA CARTELLA

| File          | Descrizione                                      |
|---------------|--------------------------------------------------|
| `index.html`  | L'interfaccia grafica (apri nel browser)         |
| `server.js`   | Il motore di estrazione dati (avvia dal terminale)|
| `package.json`| Configurazione del progetto                      |
| `ISTRUZIONI.md` | Questo file                                    |

---

## PASSO 1 — Installa Node.js (solo la prima volta)

1. Vai su **https://nodejs.org**
2. Clicca sul pulsante verde **"LTS"** (versione consigliata)
3. Scarica il file `.msi` per Windows
4. Apri il file scaricato e segui l'installazione (clicca "Next" su tutto)
5. Al termine, **riavvia il PC** (o almeno chiudi e riapri il terminale)

Per verificare che Node.js sia installato correttamente:
- Apri il **Prompt dei comandi** (cerca "cmd" nel menu Start)
- Digita: `node --version`
- Deve apparire qualcosa tipo: `v20.12.0`

---

## PASSO 2 — Installa le dipendenze (solo la prima volta)

1. Apri il **Prompt dei comandi**
2. Naviga nella cartella del programma con:
   ```
   cd C:\percorso\dove\hai\messo\la\cartella\aia-gubbio
   ```
   *(sostituisci con il percorso reale, es. `cd Desktop\aia-gubbio`)*

3. Installa i pacchetti necessari:
   ```
   npm install
   ```
   *(attendi: scarica i file necessari, può richiedere 1-2 minuti)*

4. Installa il browser Chromium per lo scraping:
   ```
   npx playwright install chromium
   ```
   *(scarica Chrome in modo silenzioso, circa 100 MB, solo la prima volta)*

---

## PASSO 3 — Avvio del programma (ogni volta che si usa)

### ① Avvia il server

1. Apri il **Prompt dei comandi**
2. Vai nella cartella del programma:
   ```
   cd Desktop\aia-gubbio
   ```
3. Avvia il server:
   ```
   node server.js
   ```
4. Vedrai scritto:
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
   *(si aprirà nel browser — consigliato Chrome o Edge)*

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
| "node non è riconosciuto" | Riavvia il PC dopo aver installato Node.js |
| Il browser si apre ma non carica | Controlla la connessione Internet |
| Nessun risultato trovato | Potrebbe non esserci ancora la giornata pubblicata sul sito AIA |
| Errore durante `npm install` | Assicurati di essere nella cartella giusta e ripeti il comando |

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
