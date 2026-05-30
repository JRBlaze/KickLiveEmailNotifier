# Kick Live Email Alerts

A local Electron app that runs in the background and sends email when selected Kick streamers go live.

> [!IMPORTANT]
> **Gmail users usually need an App Password, not their normal account password.**

![App Screenshot](HomeScreen.png)

![App Screenshot](EmailSetup.png)

## Features

- Add streamers by Kick username/slug.
- Paste or import a list of streamers.
- Turn email alerts on or off per streamer.
- Store all data locally on your computer.
- Run from the system tray/menu bar.
- Send email through your own SMTP account.

### Mac Installation Note

If you see **"Friendly Chat is damaged and can't be opened"** when launching on Mac, this is due to Apple's Gatekeeper blocking unsigned apps. To fix it, open **Terminal** and run:

```
xattr -cr /Applications/Kick\ Live\ Email\ Alerts.app
```

Then try opening the app again. Alternatively go to **System Settings → Privacy & Security** and click **Open Anyway** if the option appears there.

## Notes

Kick does not currently offer a clean public "import everyone I follow" endpoint for regular users, so this app supports paste/import instead. The app checks Kick periodically and sends one email when a streamer changes from offline to live.
