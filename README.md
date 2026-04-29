# DocuVox

DocuVox ist eine testbereite PWA für schnelle Tages-Diktate in der Physiotherapie.

## Lokal starten

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

## Deployment

Die App ist statisch und kann auf Vercel, Netlify oder ähnlichen Hosts veröffentlicht werden. Wichtig ist HTTPS, damit PWA-Installation und Mikrofonzugriff auf mobilen Geräten funktionieren.

### Vercel

Empfohlene Einstellungen beim Import:

- Framework Preset: `Other`
- Build Command: `npm run build`
- Output Directory: `.`
- Install Command: `npm install`

Nach dem Deployment öffnest du die Vercel-URL auf Laptop und Handy. Auf dem Handy kannst du DocuVox über den Browser zum Homescreen hinzufügen.
