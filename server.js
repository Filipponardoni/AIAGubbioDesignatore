/**
 * ============================================================
 *  AIA — Server designazioni arbitrali v2.4
 *  © 2026 Nardoni Filippo — Tutti i diritti riservati
 *  Uso riservato alla Sezione AIA di Gubbio
 * ============================================================
 */

const express      = require('express');
const cors         = require('cors');
const fs           = require('fs');
const path         = require('path');
const { chromium } = require('playwright');

const app  = express();
const PORT = 3456;
app.use(cors());
app.use(express.json());

// ─── Cartella storico ─────────────────────────────────────────
const STORICO_DIR = path.join(__dirname, 'storico');
if (!fs.existsSync(STORICO_DIR)) fs.mkdirSync(STORICO_DIR);

// ─── Job attivi (per il pulsante "Ferma ricerca") ──────────────
const activeJobs = new Map(); // jobId -> { stopped: boolean }

// ─── Regioni ──────────────────────────────────────────────────
const BASE = 'https://www.aia-figc.it';

const REGIONI = [
  { nome: 'Abruzzo',               slug: 'abruzzo' },
  { nome: 'Basilicata',            slug: 'basilicata' },
  { nome: 'Calabria',              slug: 'calabria' },
  { nome: 'Campania',              slug: 'campania' },
  { nome: 'Emilia Romagna',        slug: 'emilia-romagna' },
  { nome: 'Friuli Venezia Giulia', slug: 'friuli-venezia-giulia' },
  { nome: 'Lazio',                 slug: 'lazio' },
  { nome: 'Liguria',               slug: 'liguria' },
  { nome: 'Lombardia',             slug: 'lombardia' },
  { nome: 'Marche',                slug: 'marche' },
  { nome: 'Molise',                slug: 'molise' },
  { nome: 'Piemonte VdA',          slug: 'piemonte-vda' },
  { nome: 'Puglia',                slug: 'puglia' },
  { nome: 'Sardegna',              slug: 'sardegna' },
  { nome: 'Sicilia',               slug: 'sicilia' },
  { nome: 'Toscana',               slug: 'toscana' },
  { nome: 'Trentino Alto Adige',   slug: 'trentino-alto-adige' },
  { nome: 'Umbria',                slug: 'umbria' },
  { nome: 'Veneto',                slug: 'veneto' },
  { nome: 'CAP Bolzano',           slug: 'alto-adige' },
  { nome: 'CAP Trento',            slug: 'trento' },
];

// ─── Campionati nazionali (URL reali verificati) ──────────────
const NAZIONALI = [
  { nome: 'CAN D',       url: `${BASE}/designazioni/cand/`     },
  { nome: 'CAN PRO',     url: `${BASE}/designazioni/canpro/`   },
  { nome: 'CAN 5',       url: `${BASE}/designazioni/can5/`     },
  { nome: 'CAN 5 Elite', url: `${BASE}/designazioni/can5elite/`},
  { nome: 'CAN BS',      url: `${BASE}/designazioni/canbs/`    },
];

// ─── Helpers ──────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function createBrowser() {
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled']
  });
}

async function newPage(browser) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'it-IT',
  });
  return ctx.newPage();
}

// ─── Goto con retry ───────────────────────────────────────────
async function goto(page, url, maxTry = 3) {
  for (let i = 1; i <= maxTry; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(500 + Math.random() * 400);
      return true;
    } catch(e) {
      if (i === maxTry) return false;
      await sleep(1500 * i);
    }
  }
}

// ─── Estrai link da pagina ────────────────────────────────────
async function getLinks(page, base) {
  return page.evaluate(({ base }) => {
    return Array.from(document.querySelectorAll('a'))
      .filter(a => {
        const h = a.getAttribute('href') || '';
        return h.includes('des.asp') || h.includes('gir.asp') || h.includes('default.asp');
      })
      .map(a => ({
        testo: a.textContent.trim(),
        href:  a.href.startsWith('http') ? a.href : base + a.getAttribute('href'),
        isDes: (a.getAttribute('href') || '').includes('des.asp'),
        isGir: (a.getAttribute('href') || '').includes('gir.asp'),
      }))
      .filter(l => l.testo && l.href);
  }, { base });
}

// ─── Scraping designazioni singola pagina ─────────────────────
async function scrapeDesignazioni(page, url, categoriaBase, filtro, campo = 'sezione') {
  const ok = await goto(page, url);
  if (!ok) return [];

  return page.evaluate(({ catBase, filtro, campo }) => {
    const rows = Array.from(document.querySelectorAll('table tr'));
    const partite = [];
    let corrente = null;
    let categoriaCorrente = catBase; // cambia ad ogni header-designazioni

    // Cerca la riga header con i RUOLI (Gara | Arbitro | Arbitro 2 ...)
    // Esclude le righe "table-header-designazioni" che contengono il nome girone
    let colonneRuoli = [];
    const hRow = rows.find(r => {
      if (r.classList.contains('table-header-designazioni')) return false;
      const ths = r.querySelectorAll('th');
      return ths.length > 0 && Array.from(ths).some(th =>
        th.textContent.toLowerCase().includes('arbitro') ||
        th.textContent.toLowerCase().includes('gara')
      );
    });
    if (hRow) {
      colonneRuoli = Array.from(hRow.querySelectorAll('th'))
        .map(th => th.textContent.trim())
        .filter(t => t && t.toLowerCase() !== 'gara');
    }

    rows.forEach(row => {
      // Riga intestazione girone: <tr class="table-header-designazioni">
      // Aggiorna la categoria corrente con il nome del girone
      if (row.classList.contains('table-header-designazioni')) {
        const th = row.querySelector('th');
        if (th) {
          const nomeGirone = th.textContent.trim();
          categoriaCorrente = nomeGirone
            ? `${catBase} — ${nomeGirone}`
            : catBase;
        }
        return; // non processare come riga gara
      }

      const cells = Array.from(row.querySelectorAll('td'));
      if (!cells.length) return;
      const first = cells[0].textContent.trim();

      if (first && cells.length >= 2) {
        const casa   = cells[0].textContent.trim();
        const ospite = cells[1] ? cells[1].textContent.trim() : '';
        if (!casa) return;
        corrente = { categoria: categoriaCorrente, partita: `${casa} - ${ospite}`, arbitri: [] };
        for (let i = 2; i < cells.length; i++) {
          const lines = cells[i].innerHTML
            .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
            .split('\n').map(l => l.trim()).filter(l => l);
          if (lines[0]) corrente.arbitri.push({
            nome: lines[0], sezione: lines[1] || '',
            ruolo: colonneRuoli[i-2] || `Arbitro ${i-1}`
          });
        }
        partite.push(corrente);
      } else if (!first && corrente && cells.length >= 2) {
        for (let i = 1; i < cells.length; i++) {
          const lines = cells[i].innerHTML
            .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
            .split('\n').map(l => l.trim()).filter(l => l);
          if (lines[0]) {
            const ruolo = colonneRuoli[i-1] || `Arbitro ${i}`;
            if (!corrente.arbitri.find(a => a.ruolo === ruolo))
              corrente.arbitri.push({ nome: lines[0], sezione: lines[1] || '', ruolo });
          }
        }
      }
    });

    if (!filtro) return partite.filter(p => p.arbitri.length);
    return partite.map(p => ({
      ...p,
      arbitri: p.arbitri.filter(a => (campo === 'nome' ? a.nome : a.sezione).toLowerCase().includes(filtro.toLowerCase()))
    })).filter(p => p.arbitri.length);
  }, { catBase: categoriaBase, filtro: filtro || null, campo });
}

// ─── Leggi titolo completo dalla pagina ──────────────────────
async function getTitoloPagina(page) {
  return page.evaluate(() => {
    // Il sito AIA usa h1 per campionato e h2 per "girone X — giornata N — gare del DD/MM/YYYY"
    const h1 = document.querySelector('h1');
    const h2 = document.querySelector('h2');
    if (h1) {
      const t1 = h1.textContent.trim();
      const t2 = h2 ? h2.textContent.trim() : '';
      // Rimuovi prefisso ridondante "DESIGNAZIONI ARBITRI UMBRIA" se presente
      const clean1 = t1.replace(/^DESIGNAZIONI ARBITRI[^\n]*/i, '').trim() || t1;
      return t2 ? `${clean1} — ${t2}` : clean1;
    }
    // Fallback: titolo pagina ripulito
    return (document.title || '').replace(/Designazioni Arbitri[^-–—]*/i, '').replace(/^[-–—\s]+/, '').trim();
  });
}

// ─── Visita un campionato e tutti i suoi gironi ───────────────
//
// Struttura pagine AIA:
//   default.asp  → lista campionati (link a gir.asp o des.asp)
//   gir.asp      → lista gironi+giornate sulla STESSA pagina:
//                    <tr class="table-header-designazioni"><th>Girone FI</th>
//                    <tr><td><a href="des.asp?...">Giornata 1</a></td>
//                    <tr class="table-header-designazioni"><th>Girone SF</th>
//                    <tr><td><a href="des.asp?...">Giornata 1</a></td>
//   des.asp      → designazioni effettive
//
// Strategia: sulla pagina gir.asp leggo PRIMA tutti i link des.asp
// e per ciascuno trovo quale girone (table-header-designazioni) lo precede.
// Poi entro in ogni des.asp con già il nome girone corretto.

async function visitaCampionato(page, nomeCamp, linkCamp, filtro, base, send, risultati, ctx = null, campo = 'sezione') {
  if (ctx && ctx.stopped) return;
  send({ step: 'progress', tipo: 'campionato', msg: `📂 ${nomeCamp}`, stato: 'inizio' });

  const ok = await goto(page, linkCamp);
  if (!ok) {
    send({ step: 'progress', tipo: 'campionato', msg: `📂 ${nomeCamp}`, stato: 'errore' });
    return;
  }

  // Leggo la struttura della pagina corrente:
  // - se ha colonne Gara/Arbitro è già una des.asp
  // - altrimenti è una gir.asp con gironi e link
  const struttura = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tr'));

    // Controlla se è pagina designazioni (ha header Gara/Arbitro)
    const isDesPage = rows.some(r => {
      if (r.classList.contains('table-header-designazioni')) return false;
      return Array.from(r.querySelectorAll('th')).some(th =>
        th.textContent.toLowerCase().includes('arbitro') ||
        th.textContent.toLowerCase().includes('gara')
      );
    });

    if (isDesPage) return { tipo: 'des', voci: [] };

    // È una pagina con gironi e link. Scorro le righe e costruisco la lista:
    // [ { girone: 'Girone FI', href: 'des.asp?...', testo: 'Giornata 1' }, ... ]
    const voci = [];
    let gironeCorrente = '';

    rows.forEach(row => {
      if (row.classList.contains('table-header-designazioni')) {
        // Riga intestazione girone
        const th = row.querySelector('th');
        if (th) gironeCorrente = th.textContent.trim();
        return;
      }
      // Righe con link
      const links = Array.from(row.querySelectorAll('a')).filter(a => {
        const h = a.getAttribute('href') || '';
        return h.includes('des.asp') || h.includes('gir.asp');
      });
      links.forEach(a => {
        voci.push({
          girone: gironeCorrente,
          href:   a.href,
          testo:  a.textContent.trim(),
          isDes:  (a.getAttribute('href') || '').includes('des.asp'),
        });
      });
    });

    return { tipo: voci.length > 0 ? 'gir' : 'vuoto', voci };
  });

  // ── Caso 1: pagina diretta des.asp (nessun girone intermedio)
  if (struttura.tipo === 'des') {
    const res = await scrapeDesignazioni(page, linkCamp, nomeCamp, filtro, campo);
    risultati.push(...res);
    send({ step: 'progress', tipo: 'girone', msg: `  ✓ ${nomeCamp}`, stato: 'ok', trovati: res.length });
    send({ step: 'progress', tipo: 'campionato', msg: `📂 ${nomeCamp}`, stato: 'completato' });
    return;
  }

  // ── Caso 2: pagina con lista gironi/giornate
  if (struttura.tipo === 'vuoto') {
    send({ step: 'progress', tipo: 'girone', msg: `  – ${nomeCamp} (nessuna gara)`, stato: 'vuoto' });
    send({ step: 'progress', tipo: 'campionato', msg: `📂 ${nomeCamp}`, stato: 'completato' });
    return;
  }

  // Raggruppa le voci per girone
  const gironiMap = {};
  struttura.voci.forEach(v => {
    const k = v.girone || '(senza girone)';
    if (!gironiMap[k]) gironiMap[k] = [];
    gironiMap[k].push(v);
  });

  for (const [nomeGirone, voci] of Object.entries(gironiMap)) {
    if (ctx && ctx.stopped) break;
    // Label base per questo girone
    const labelGirone = nomeGirone && nomeGirone !== '(senza girone)'
      ? `${nomeCamp} — ${nomeGirone}`
      : nomeCamp;

    const desVoci = voci.filter(v => v.isDes);
    const girVoci = voci.filter(v => !v.isDes); // sub-pagine gir.asp (raro)

    // Entra in ogni des.asp di questo girone
    for (const voce of desVoci) {
      if (ctx && ctx.stopped) break;
      send({ step: 'progress', tipo: 'girone', msg: `  ⏳ ${labelGirone} › ${voce.testo}`, stato: 'inizio' });

      const okD = await goto(page, voce.href);
      if (!okD) {
        send({ step: 'progress', tipo: 'girone', msg: `  ✗ ${labelGirone} › ${voce.testo}`, stato: 'errore' });
        // Torna alla pagina gironi per il prossimo link
        await goto(page, linkCamp);
        continue;
      }

      // Usa labelGirone come categoria — il girone è già incluso
      const res = await scrapeDesignazioni(page, voce.href, labelGirone, filtro, campo);
      risultati.push(...res);
      send({ step: 'progress', tipo: 'girone', msg: `  ✓ ${labelGirone} › ${voce.testo}`, stato: 'ok', trovati: res.length });
      await sleep(300);

      // Torna alla pagina gironi per leggere il prossimo link
      await goto(page, linkCamp);
    }

    // Sub-pagine gir.asp (livello extra, raro ma possibile)
    for (const voce of girVoci) {
      if (ctx && ctx.stopped) break;
      const okG = await goto(page, voce.href);
      if (!okG) continue;
      // Ricorsione: tratta questa sotto-pagina come un campionato
      await visitaCampionato(page, labelGirone, voce.href, filtro, base, send, risultati, ctx, campo);
      await goto(page, linkCamp);
    }
  }

  send({ step: 'progress', tipo: 'campionato', msg: `📂 ${nomeCamp}`, stato: 'completato' });
}

// ─── SCRAPING REGIONE ─────────────────────────────────────────
async function scrapeRegione(page, regioneSlug, sezioneTarget, send, opts = {}) {
  const { ctx = null, filtro = sezioneTarget, campo = 'sezione' } = opts;
  const urlReg  = `${BASE}/designazioni/${regioneSlug}/`;
  const baseReg = `${BASE}/designazioni/${regioneSlug}/`;
  const risultati = [];

  send({ step: 'section', msg: `━━ CAMPIONATI REGIONALI (${regioneSlug.toUpperCase()}) ━━` });
  const ok = await goto(page, urlReg);
  if (!ok) { send({ step: 'warn', msg: 'Impossibile aprire la pagina regionale.' }); return risultati; }

  // Leggi tabella Categorie e tabella Sezioni
  const { linkCategorie, sezioneHref } = await page.evaluate(({ base, target }) => {
    const tables = Array.from(document.querySelectorAll('table'));
    let linkCategorie = [], sezioneHref = null;
    tables.forEach(t => {
      const h = t.querySelector('th');
      if (!h) return;
      const txt = h.textContent.toLowerCase();
      if (txt.includes('categor')) {
        linkCategorie = Array.from(t.querySelectorAll('a'))
          .map(a => ({ testo: a.textContent.trim(), href: a.href.startsWith('http') ? a.href : base + a.getAttribute('href') }))
          .filter(l => l.testo && l.href);
      }
      if (txt.includes('sezion')) {
        const a = Array.from(t.querySelectorAll('a')).find(a =>
          a.textContent.trim().toLowerCase().includes(target.toLowerCase()));
        if (a) sezioneHref = a.href.startsWith('http') ? a.href : base + a.getAttribute('href');
      }
    });
    return { linkCategorie, sezioneHref };
  }, { base: baseReg, target: sezioneTarget });

  send({ step: 'info', msg: `Trovati ${linkCategorie.length} campionati regionali` });
  if (campo === 'sezione') {
    if (sezioneHref) send({ step: 'info', msg: `Sezione "${sezioneTarget}" trovata ✓` });
    else send({ step: 'warn', msg: `Sezione "${sezioneTarget}" non trovata nella tabella sezioni — filtro solo per nome arbitro` });
  } else {
    send({ step: 'info', msg: `Ricerca per nome arbitro: "${filtro}"` });
  }

  // ── Parte 1: categorie regionali
  for (const cat of linkCategorie) {
    if (ctx && ctx.stopped) { send({ step: 'warn', msg: '⏹ Ricerca interrotta dall\'utente.' }); break; }
    await visitaCampionato(page, cat.testo, cat.href, filtro, baseReg, send, risultati, ctx, campo);
    await sleep(400);
  }

  // Nota: NON visitiamo la tabella sezioni separatamente perché
  // le gare sono già incluse nei campionati regionali sopra (evita duplicati).

  return risultati;
}

// ─── SCRAPING NAZIONALI ───────────────────────────────────────
async function scrapeNazionali(page, filtro, send, opts = {}) {
  const { ctx = null, campo = 'sezione' } = opts;
  const risultati = [];

  send({ step: 'section', msg: `━━ CAMPIONATI NAZIONALI ━━` });

  for (const can of NAZIONALI) {
    if (ctx && ctx.stopped) { send({ step: 'warn', msg: '⏹ Ricerca interrotta dall\'utente.' }); break; }
    send({ step: 'section', msg: `▶ ${can.nome}` });
    const ok = await goto(page, can.url);
    if (!ok) { send({ step: 'warn', msg: `Impossibile aprire ${can.nome}` }); continue; }

    // Leggi tutti i campionati nella pagina (es. Serie D, Eccellenza, Primavera 2...)
    const campionati = await page.evaluate(({ base }) => {
      return Array.from(document.querySelectorAll('a'))
        .filter(a => {
          const h = a.getAttribute('href') || '';
          return h.includes('des.asp') || h.includes('gir.asp');
        })
        .map(a => ({
          testo: a.textContent.trim(),
          href:  a.href.startsWith('http') ? a.href : base + a.getAttribute('href'),
          isDes: (a.getAttribute('href') || '').includes('des.asp'),
        }))
        .filter(l => l.testo && l.href);
    }, { base: can.url });

    send({ step: 'info', msg: `${can.nome}: ${campionati.length} campionati trovati` });

    for (const camp of campionati) {
      if (ctx && ctx.stopped) break;
      const nomeCamp = `${can.nome} › ${camp.testo}`;
      await visitaCampionato(page, nomeCamp, camp.href, filtro, can.url, send, risultati, ctx, campo);
      await sleep(400);
    }
  }

  return risultati;
}

// ─── Salva CSV ────────────────────────────────────────────────
function salvaCSV(data, regione, sezione) {
  const now      = new Date();
  const dataStr  = now.toISOString().slice(0, 10);
  const timeStr  = now.toTimeString().slice(0, 5).replace(':', '-');
  const fileName = `${dataStr}_${timeStr}_${regione}_${sezione}.csv`.replace(/\s+/g, '_');
  const filePath = path.join(STORICO_DIR, fileName);
  const esc      = v => `"${(v||'').replace(/"/g,'""')}"`;

  const righe = ['Categoria,Partita,Arbitro,Ruolo,Sezione'];
  data.forEach(p => p.arbitri.forEach(a =>
    righe.push([esc(p.categoria), esc(p.partita), esc(a.nome), esc(a.ruolo), esc(a.sezione)].join(','))
  ));
  fs.writeFileSync(filePath, righe.join('\n'), 'utf8');
  return fileName;
}

// ─── Endpoint: regioni ────────────────────────────────────────
app.get('/regioni', (req, res) => res.json(REGIONI));

// ─── Endpoint: leggi sezioni da una regione (live dal sito) ──
app.get('/sezioni/:regione', async (req, res) => {
  const slug = req.params.regione;
  const url  = `${BASE}/designazioni/${slug}/`;
  const browser = await createBrowser();
  const page    = await newPage(browser);
  try {
    const ok = await goto(page, url);
    if (!ok) return res.json([]);
    const sezioni = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      for (const t of tables) {
        const h = t.querySelector('th');
        if (h && h.textContent.toLowerCase().includes('sezion')) {
          return Array.from(t.querySelectorAll('a'))
            .map(a => a.textContent.trim())
            .filter(s => s);
        }
      }
      return [];
    });
    res.json(sezioni);
  } catch(e) {
    res.json([]);
  } finally {
    await browser.close();
  }
});

// ─── Endpoint: elimina file storico ──────────────────────────
app.delete('/storico/:nome', (req, res) => {
  const fpath = path.join(STORICO_DIR, path.basename(req.params.nome));
  if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'File non trovato' });
  try {
    fs.unlinkSync(fpath);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Endpoint: scraping nazionali per TUTTE le sezioni di una regione (SSE)
app.get('/scrape-nazionali-regione', async (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const regione = req.query.regione || 'umbria';
  const send    = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ step: 'start', msg: `Avvio ricerca nazionali — tutti gli arbitri di ${regione.toUpperCase()}` });

  const browser = await createBrowser();
  const page    = await newPage(browser);

  try {
    // Step 1: leggi tutte le sezioni della regione dal sito
    send({ step: 'info', msg: `Lettura sezioni di ${regione}...` });
    const urlReg = `${BASE}/designazioni/${regione}/`;
    const ok = await goto(page, urlReg);
    if (!ok) throw new Error(`Impossibile aprire la pagina di ${regione}`);

    const sezioni = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      for (const t of tables) {
        const h = t.querySelector('th');
        if (h && h.textContent.toLowerCase().includes('sezion')) {
          return Array.from(t.querySelectorAll('a'))
            .map(a => a.textContent.trim())
            .filter(s => s);
        }
      }
      return [];
    });

    if (sezioni.length === 0) throw new Error('Nessuna sezione trovata per questa regione');
    send({ step: 'info', msg: `Trovate ${sezioni.length} sezioni: ${sezioni.join(', ')}` });

    // Step 2: cerca nei nazionali tutti gli arbitri di TUTTE le sezioni trovate
    send({ step: 'section', msg: `━━ CAMPIONATI NAZIONALI — Arbitri di ${regione.toUpperCase()} ━━` });
    const risultati = [];

    for (const can of NAZIONALI) {
      send({ step: 'section', msg: `▶ ${can.nome}` });
      const okCan = await goto(page, can.url);
      if (!okCan) { send({ step: 'warn', msg: `Impossibile aprire ${can.nome}` }); continue; }

      const campionati = await page.evaluate(({ base }) => {
        return Array.from(document.querySelectorAll('a'))
          .filter(a => {
            const h = a.getAttribute('href') || '';
            return h.includes('des.asp') || h.includes('gir.asp');
          })
          .map(a => ({
            testo: a.textContent.trim(),
            href:  a.href.startsWith('http') ? a.href : base + a.getAttribute('href'),
            isDes: (a.getAttribute('href') || '').includes('des.asp'),
          }))
          .filter(l => l.testo && l.href);
      }, { base: can.url });

      send({ step: 'info', msg: `${can.nome}: ${campionati.length} campionati` });

      for (const camp of campionati) {
        const nomeCamp = `${can.nome} › ${camp.testo}`;
        // Usa filtro multiplo: cerca per ogni sezione
        // Strategia: scrape senza filtro, poi filtra lato Node
        const tmpRis = [];
        await visitaCampionato(page, nomeCamp, camp.href, null, can.url, send, tmpRis);

        // Tieni solo partite con arbitri delle sezioni della regione
        tmpRis.forEach(p => {
          const arbitriFiltrati = p.arbitri.filter(a =>
            sezioni.some(sez => a.sezione.toLowerCase().includes(sez.toLowerCase()))
          );
          if (arbitriFiltrati.length > 0) {
            risultati.push({ ...p, arbitri: arbitriFiltrati });
          }
        });
        await sleep(400);
      }
    }

    const csv = salvaCSV(risultati, regione, 'TUTTI');
    send({ step: 'info',  msg: `Salvato: ${csv}` });
    send({ step: 'done',  msg: `Completato! ${risultati.length} partite trovate.`, data: risultati, csvNome: csv });

  } catch(e) {
    send({ step: 'error', msg: e.message });
  } finally {
    await browser.close();
    res.end();
  }
});

// ─── Endpoint: storico lista ──────────────────────────────────
app.get('/storico', (req, res) => {
  try {
    const files = fs.readdirSync(STORICO_DIR)
      .filter(f => f.endsWith('.csv'))
      .map(f => {
        const fpath   = path.join(STORICO_DIR, f);
        const stat    = fs.statSync(fpath);
        const content = fs.readFileSync(fpath, 'utf8');
        const righe   = content.split('\n').filter(r => r.trim()).length - 1;
        return { nome: f, data: stat.mtime, designazioni: righe };
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    res.json(files);
  } catch(e) { res.json([]); }
});

// ─── Endpoint: leggi CSV storico ──────────────────────────────
app.get('/storico/:nome', (req, res) => {
  const fpath = path.join(STORICO_DIR, path.basename(req.params.nome));
  if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'File non trovato' });
  const lines     = fs.readFileSync(fpath, 'utf8').split('\n').filter(r => r.trim());
  const risultati = [], map = {};
  for (let i = 1; i < lines.length; i++) {
    const cols  = lines[i].match(/("(?:[^"]|"")*"|[^,]+)/g) || [];
    const clean = cols.map(c => c.replace(/^"|"$/g,'').replace(/""/g,'"'));
    const [categoria, partita, nome, ruolo, sezione] = clean;
    const key = `${categoria}||${partita}`;
    if (!map[key]) { map[key] = { categoria, partita, arbitri: [] }; risultati.push(map[key]); }
    map[key].arbitri.push({ nome, ruolo, sezione });
  }
  res.json(risultati);
});

// ─── Endpoint: cerca un arbitro in tutto lo storico ────────────
app.get('/storico/cerca/:nome', (req, res) => {
  const query = (req.params.nome || '').trim().toLowerCase();
  if (!query) return res.json([]);
  try {
    const files = fs.readdirSync(STORICO_DIR).filter(f => f.endsWith('.csv'));
    const risultati = [];
    files.forEach(f => {
      const fpath = path.join(STORICO_DIR, f);
      const stat  = fs.statSync(fpath);
      const lines = fs.readFileSync(fpath, 'utf8').split('\n').filter(r => r.trim());
      for (let i = 1; i < lines.length; i++) {
        const cols  = lines[i].match(/("(?:[^"]|"")*"|[^,]+)/g) || [];
        const clean = cols.map(c => c.replace(/^"|"$/g,'').replace(/""/g,'"'));
        const [categoria, partita, nome, ruolo, sezione] = clean;
        if (nome && nome.toLowerCase().includes(query)) {
          risultati.push({ file: f, data: stat.mtime, categoria, partita, nome, ruolo, sezione });
        }
      }
    });
    risultati.sort((a, b) => new Date(b.data) - new Date(a.data));
    res.json(risultati);
  } catch(e) { res.json([]); }
});

// ─── Endpoint: ferma una ricerca per nome in corso ─────────────
app.post('/scrape-nome/stop/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (job) { job.stopped = true; return res.json({ ok: true }); }
  res.status(404).json({ error: 'Ricerca non trovata o già conclusa' });
});

// ─── Endpoint: ricerca per nome arbitro (SSE, interrompibile) ─
// modalita: solo CRA specifico (default) oppure CRA + nazionali
app.get('/scrape-nome', async (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const nome      = (req.query.nome    || '').trim();
  const regione   = req.query.regione  || 'umbria';
  const nazionali = req.query.nazionali === 'true';

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  if (!nome) {
    send({ step: 'error', msg: 'Inserisci il nome dell\'arbitro da cercare.' });
    return res.end();
  }

  const jobId = 'job' + Date.now() + Math.random().toString(36).slice(2, 8);
  const ctx   = { stopped: false };
  activeJobs.set(jobId, ctx);

  send({ step: 'start', msg: `Ricerca "${nome}" — CRA ${regione.toUpperCase()}${nazionali ? ' + Nazionali' : ''}`, jobId });

  const browser = await createBrowser();
  const page    = await newPage(browser);

  try {
    const resReg = await scrapeRegione(page, regione, nome, send, { ctx, filtro: nome, campo: 'nome' });
    let resNaz = [];
    if (nazionali && !ctx.stopped) {
      resNaz = await scrapeNazionali(page, nome, send, { ctx, campo: 'nome' });
    }

    const tutti = [...resReg, ...resNaz];
    const csv   = salvaCSV(tutti, regione, `ricerca_${nome.replace(/\s+/g,'')}`);
    send({ step: 'info', msg: `Salvato: ${csv}` });
    send({
      step: 'done',
      msg: ctx.stopped
        ? `Ricerca interrotta manualmente. ${tutti.length} partite trovate fino a questo momento.`
        : `Completato! ${tutti.length} partite trovate.`,
      data: tutti,
      csvNome: csv,
      interrotta: ctx.stopped
    });
  } catch(e) {
    send({ step: 'error', msg: e.message });
  } finally {
    activeJobs.delete(jobId);
    await browser.close();
    res.end();
  }
});

// ─── Endpoint: scraping SSE ───────────────────────────────────
app.get('/scrape', async (req, res) => {  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const regione   = req.query.regione   || 'umbria';
  const sezione   = req.query.sezione   || 'Gubbio';
  const nazionali = req.query.nazionali !== 'false'; // default: true

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ step: 'start', msg: `Avvio — Regione: ${regione.toUpperCase()} | Sezione: ${sezione}` });

  const browser = await createBrowser();
  const page    = await newPage(browser);

  try {
    const resReg = await scrapeRegione(page, regione, sezione, send);
    let resNaz   = [];
    if (nazionali) resNaz = await scrapeNazionali(page, sezione, send);

    const tutti = [...resReg, ...resNaz];
    const csv   = salvaCSV(tutti, regione, sezione);
    send({ step: 'info',  msg: `Salvato: ${csv}` });
    send({ step: 'done',  msg: `Completato! ${tutti.length} partite trovate.`, data: tutti, csvNome: csv });
  } catch(e) {
    send({ step: 'error', msg: e.message });
  } finally {
    await browser.close();
    res.end();
  }
});

// ─── Avvio ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   AIA — Server designazioni v2.4 avviato         ║');
  console.log(`║   In ascolto su http://localhost:${PORT}           ║`);
  console.log('║   Apri index.html nel browser per iniziare       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
