#!/bin/bash

# Titolo finestra (funziona nel Terminal.app)
echo -en "\033]0;AIA Gubbio — Server Designazioni\a"

# Chiudi eventuali istanze precedenti sulla porta 3456
echo "Chiusura server precedente (se attivo)..."
PID=$(lsof -ti tcp:3456)
if [ -n "$PID" ]; then
    kill -9 $PID >/dev/null 2>&1
fi
sleep 1

# Vai nella cartella dello script
cd "$(dirname "$0")"

# Avvia il server
echo ""
echo "============================================"
echo "   AIA Gubbio - Avvio server in corso..."
echo "============================================"
echo ""
node server.js

# Se il server si chiude inaspettatamente, mostra l'errore
echo ""
echo "Server terminato. Premi un tasto per chiudere."
read -n 1 -s
