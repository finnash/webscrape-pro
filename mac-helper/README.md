# Meow Voice — Mac helper

Floating, always-on-top voice panel. Speak a command, it scrapes/searches via Meow Scraper, shows the answer, pings a Mac notification and (optionally) posts to Discord.

## Run
```
cd mac-helper
npm install
npm start
```
Allow microphone access when macOS asks (System Settings → Privacy → Microphone → allow Terminal/VS Code or Meow Voice).

## Use
- **⌥ Space** — start listening; press again to send
- **⌥ ⇧ Space** — show/hide the panel
- Or type a command in the box
- Examples: "scrape techcrunch.com", "latest news on OpenAI models"

## Build a real app (.dmg)
`npm run build` → `dist/Meow Voice.dmg`. Drag to Applications; add to Login Items to start on boot.
