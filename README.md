# Desk Charms (Windows)

Lucky charms that dangle from the top of your screen on a real physics string.
All 8 charms from the charm drawer: Nazar, Nimbu mirchi, Maneki-neko, Hamsa,
Four-leaf clover, Crescent moon, Daruma, and Fortune knot.

## Run it

You need Node.js 18+ (https://nodejs.org).

```
npm install
npm start
```

The charm shows up hanging from the top of your screen, and a Nazar icon appears in the
system tray (bottom-right, you may need to click the ^ arrow).

## Build an .exe

```
npm run dist
```

This makes two files in `dist/`: an installer (`Desk Charms Setup 0.1.0.exe`) and a
portable `.exe` that runs without installing. Windows SmartScreen will warn you because
the app isn't code-signed; click "More info" and then "Run anyway".

## Using it

| Do this | What happens |
|---|---|
| Drag the charm and let go | It gets flung and swings back |
| Click the charm | A small flick |
| Double-click the charm | Switch to the next charm |
| Right-click the charm | Opens the settings menu |
| Drag the little cap at the top of the string | Moves where the charm hangs |
| Click the tray icon | Hides or shows the charm |

The tray menu also has: charm picker, cord (gold chain, silver chain, red thread, cotton
thread), string length, charm size, gentle breeze, and start with Windows.
Your choices are saved automatically.

Everywhere except the charm itself, clicks go straight through to whatever is underneath,
so it never blocks your work.

## How it works

| File | Job |
|---|---|
| `src/main.js` | Creates a transparent, frameless, always-on-top, click-through window across the top of the screen, plus the tray menu and saved settings |
| `src/renderer.js` | Verlet rope physics: each string point keeps its momentum, gravity pulls it down, and distance constraints keep the links a fixed length. The charm is a heavier last point |
| `src/charms.js` | The 8 charms as SVGs (120x160, jump ring at 10px from the top) |
| `src/preload.js` | The small, safe bridge between the window and the main process |

Click-through trick: the window ignores the mouse by default but still receives mouse
*movement*. When the pointer is over the charm or the cap, the renderer tells the main
process to start catching clicks; when it moves away, clicks pass through again.

## Troubleshooting

- **Black box instead of a transparent window:** some GPU drivers don't like transparent
  windows. Add `app.disableHardwareAcceleration();` at the top of `src/main.js`, right after the
  `require` line.
- **Covers a fullscreen game:** click the tray icon to hide it.
- **Kanji on the Maneki-neko coin or Daruma look like boxes:** your system is missing a
  Japanese font. Windows 10/11 include Yu Mincho by default, so this is rare.
