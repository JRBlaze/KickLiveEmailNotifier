# Kick Live Email Alerts

A local Electron app that runs in the background and sends email when selected Kick streamers go live.

![App Screenshot](HomeScreen.png)

![App Screenshot](EmailSetup.png)

## Features

- Add streamers by Kick username/slug.
- Paste or import a list of streamers.
- Turn email alerts on or off per streamer.
- Store all data locally on your computer.
- Run from the system tray/menu bar.
- Send email through your own SMTP account.

## Development

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Start the app:

   ```powershell
   npm start
   ```

3. Open Settings and configure SMTP.

For Gmail, users usually need an app password rather than their normal account password.

## Building Installers

This project uses Electron Builder.

Build a Windows installer EXE on Windows:

```powershell
npm run dist:win
```

Build a macOS DMG on macOS:

```bash
npm run dist:mac
```

Build a Linux AppImage on Linux:

```bash
npm run dist:linux
```

Build the default package for the current platform:

```bash
npm run dist
```

Packaged files are written to `dist/`.

Cross-platform note: build each installer on its matching operating system for the most reliable results. Windows EXE builds should be made on Windows, macOS DMG builds on macOS, and Linux AppImage builds on Linux.

## Building a GitHub Release

The repository includes a GitHub Actions workflow (`.github/workflows/release.yml`) that builds Windows, macOS, and Linux release files.

To create a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions will build:

- Windows `.exe`
- macOS `.dmg`
- Linux `.AppImage`

When the tag starts with `v`, the workflow attaches the built files to a GitHub Release automatically.

You can also run the workflow manually from GitHub:

1. Open the repository on GitHub.
2. Go to Actions.
3. Choose Build Release.
4. Click Run workflow.

## Mac Installation Note

If you see "Kick Live Email Alerts is damaged and can't be opened" when launching on Mac, this is due to Apple's Gatekeeper blocking unsigned apps. To fix it, open Terminal and run:

```bash
xattr -cr /Applications/Kick\ Live\ Email\ Alerts.app
```

Then try opening the app again. Alternatively, go to System Settings -> Privacy & Security and click Open Anyway if the option appears there.

## Notes

Kick does not currently offer a clean public "import everyone I follow" endpoint for regular users, so this app supports paste/import instead. The app checks Kick periodically and sends one email when a streamer changes from offline to live.
