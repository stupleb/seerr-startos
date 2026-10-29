# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

- **Write `settings.json` only while Seerr is stopped: from `main.ts` before the daemon starts, or from an `only-stopped` action.** Seerr reads the file at startup and rewrites all of it from memory on every settings change, so a write while it runs is lost. An action that changes a setting on a running Seerr goes through its API (`seerrApi`).
- **Keep Seerr's setup wizard unreachable.** Connect Jellyfin runs Seerr bound to `127.0.0.1` in a temporary container, and the critical task keeps the service stopped until `public.initialized` is true. Whoever completes the wizard becomes the owner.
- **Start Seerr as `node dist/index.js`, never `npm start`.** Killing a spawned process kills only that process, so Connect Jellyfin's temporary Seerr would outlive npm.
- **Set `NODE_EXTRA_CA_CERTS` on Connect Jellyfin's temporary Seerr as well as on the daemon.** The action's own address check trusts the pasted root CA directly, so a temporary Seerr without the variable passes that check and then fails to sign in.
- **Keep the Root CA a pasted text field, never `Value.file`.** StartOS action forms submit a picked file as `{}`, so a file field fails validation every time (start-technologies#3585).
