# DocuVox

DocuVox ist eine testbereite PWA für schnelle Tages-Diktate in der Physiotherapie.

## Lokal starten

Lege zuerst eine lokale `.env` Datei an:

```bash
cp .env.example .env
```

Trage dort deinen OpenAI API-Key ein:

```text
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4.1
```

Dann starten:

```bash
npm install
npm run dev
```

Danach öffnen:

```text
http://127.0.0.1:5173
```

Mikrofonzugriff funktioniert zuverlässig nur über `localhost` oder `HTTPS`.

## Handy-Test

Für echte Handy-Tests mit Mikrofon und PWA-Installation nutze eine HTTPS-Adresse:

- Späteres Deployment auf Vercel, Netlify oder ähnlichem
- Oder temporär ein HTTPS-Tunnel zu deinem lokalen Server

Dann auf dem Handy öffnen und installieren:

- iPhone: Teilen -> Zum Home-Bildschirm
- Android/Chrome: Menü -> App installieren oder Zum Startbildschirm hinzufügen

## Daten

Der aktuelle Testmodus speichert Tagesdaten per `LocalStorage` im jeweiligen Browser.

Für gemeinsame Daten zwischen Handy und PC ist die Cloud-Schicht vorbereitet:

- `storage.js`: zentrale lokale Speicher-API
- `cloud-sync.js`: Platzhalter für Supabase/Firebase

Damit Handy und PC wirklich synchronisiert sind, muss noch ein echter Cloud-Provider verbunden werden.

## KI-Verarbeitung

Das Frontend sendet Rohdiktate an `/api/document`. Dort wird serverseitig die OpenAI Responses API verwendet. Der API-Key bleibt in `OPENAI_API_KEY` und wird nie an den Browser ausgeliefert.

## Deployment

Die App ist statisch und kann auf Vercel, Netlify oder ähnlichen Hosts veröffentlicht werden. Wichtig ist HTTPS, damit PWA-Installation und Mikrofonzugriff auf mobilen Geräten funktionieren.

### Vercel

Empfohlene Einstellungen beim Import:

- Framework Preset: `Other`
- Build Command: `npm run build`
- Output Directory: `.`
- Install Command: `npm install`

Nach dem Deployment öffnest du die Vercel-URL auf Laptop und Handy. Auf dem Handy kannst du DocuVox über den Browser zum Homescreen hinzufügen.

Environment Variables in Vercel:

- `OPENAI_API_KEY`
- optional `OPENAI_MODEL`, z. B. `gpt-4.1` oder `gpt-5`
