<p align="center">
  <img src="icon.svg" alt="Seerr Logo" width="21%">
</p>

# Seerr on StartOS

> Everything not listed in this document should behave the same as upstream
> Seerr. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[Seerr](https://github.com/seerr-team/seerr) is a media request manager: users browse TMDB's catalogue of movies and TV shows, request titles, and an administrator approves them. This package connects it to Jellyfin on the same server or on another one, sets it up without exposing Seerr's first-run wizard, sends approved requests to Radarr and Sonarr on the same server, and wires its ntfy and email notification agents to StartOS.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

One upstream image, unmodified, run as its own `node` user.

| Property      | Value                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image         | `ghcr.io/seerr-team/seerr`                                                                                                                           |
| Architectures | x86_64, aarch64                                                                                                                                      |
| Command       | `node dist/index.js` in `/app` (not the image's `npm start`)                                                                                         |
| Environment   | `LOG_LEVEL=info`, where upstream defaults to `debug`, which logs every title a library scan touches; `NODE_EXTRA_CA_CERTS` while a root CA is stored |

| Subcontainer                           | Purpose                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `seerr-sub`                            | The `primary` daemon, and the `chown` oneshot before it. The one to `attach` to                         |
| `seerr-connect`                        | Temporary; exists only while **Connect Jellyfin** runs a private Seerr on `127.0.0.1` to complete setup |
| `seerr-radarr-key`, `seerr-sonarr-key` | Temporary; exist only while **Connect Radarr and Sonarr** reads that app's API key                      |

## Volume and Data Layout

Seerr keeps everything in one directory, mounted from the `main` volume.

| Volume    | Mount Point   | Contents                                                                                                                                                                  |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`    | `/app/config` | `settings.json`, the SQLite database `db/db.sqlite3`, `logs/`, `cache/`, `anime-list.xml` (an ID mapping Seerr downloads), and `jellyfin-ca.crt` when a root CA was given |
| `startos` | — (host side) | `store.json`; never mounted into a container                                                                                                                              |

The `chown` oneshot gives `/app/config` to `node:node` on every start.

While Radarr or Sonarr is connected and installed, `seerr-sub` also mounts the `share/` directory of that app's `startos` volume, read-only, at `/mnt/radarr` or `/mnt/sonarr`. Each app publishes its API key there as `api-key`.

## File Models

Two files: Seerr's own settings, of which the package re-asserts a few keys, and the package's `store.json`.

**`settings.json`** (`main` volume, JSON) belongs to Seerr, which creates it on first run and rewrites all of it whenever a setting changes. `main.ts` merges these keys in before every start, so editing them in Seerr's UI or by hand doesn't survive a restart:

- `jellyfin.ip`, `jellyfin.port`, `jellyfin.useSsl`, `jellyfin.urlBase`, only for Jellyfin on this server: its address on the StartOS bridge (`10.0.3.1` and its assigned port). It is written only while that address resolves, so it heals after Jellyfin is reinstalled on another port.
- `main.versionCheck`: `false`, since updates come from StartOS.
- `notifications.agents.email`: `enabled`, `emailFrom`, `smtpHost`, `smtpPort`, `secure`, `requireTls`, `ignoreTls`, `authUser`, `authPass` and `userEmailRequired` follow **Configure SMTP**, and are blanked or off while it is off. `senderName` is written only when the From address carries a name. The other email options are Seerr's.
- In `radarr` and `sonarr`, only for the server **Connect Radarr and Sonarr** created: `hostname`, `port`, `apiKey`, `useSsl` and `baseUrl` follow that app's bridge address and published API key, so the server heals after the app is reinstalled or moves port. They are skipped while the app is uninstalled or its key can't be read. That server's profile, folder and other options, and every other server in the lists, are Seerr's.

For Jellyfin on another server, **Connect Jellyfin** writes the address once; after that it is Seerr's, changed under **Settings → Jellyfin** or by **Update Jellyfin Address**, which writes it while Seerr is stopped. That action also reads `jellyfin.serverId`, which Seerr records at setup. Everything else in the file, including Jellyfin's **External URL** and the ntfy agent, is Seerr's alone. **Connect ntfy** and **Disconnect ntfy** change the ntfy agent through Seerr's API while it runs.

**`store.json`** (`startos` volume) holds the **Configure SMTP** selection (`smtp`), the ntfy topic Seerr is connected to (`ntfyTopic`, `null` when not connected), whether Seerr uses Jellyfin on another server (`remoteJellyfin`), saved before **Connect Jellyfin** signs in, and the Seerr server id **Connect Radarr and Sonarr** created for each app (`arrServers.radarr`, `arrServers.sonarr`, `null` when not connected).

**`jellyfin-ca.crt`** (`main` volume, PEM) is the root CA pasted into **Connect Jellyfin** or **Update Jellyfin Address**. While it exists, Seerr starts with `NODE_EXTRA_CA_CERTS` pointing at it, which adds it to the public roots Seerr trusts.

## Dependencies

All four are optional. Jellyfin is declared while Seerr uses Jellyfin on this server, which is also the state before setup; it is dropped once **Connect Jellyfin** picks Jellyfin on another server. ntfy, Radarr and Sonarr are each declared only while Seerr is connected to them.

| Dependency | Required | Health checks | Why                                                                                                                                   |
| ---------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Jellyfin   | no       | `primary`     | Seerr's owner and media-server users sign in through it, and its library scans mark requests available                                |
| ntfy       | no       | none          | Push notifications. **Connect ntfy** mints Seerr's own publish-only account (`pkg_seerr`) through ntfy's `provision-publisher` action |
| Radarr     | no       | `primary`     | Approved movie requests are sent to it to download                                                                                    |
| Sonarr     | no       | `primary`     | Approved TV requests are sent to it to download                                                                                       |

Jellyfin and ntfy mount nothing; Radarr and Sonarr are read through their `share/` directory, as above. Seerr reaches Radarr and Sonarr on the StartOS bridge over HTTP with the key each publishes, which is the key it uses itself. Seerr reaches Jellyfin, on the StartOS bridge or at the address given, with the API key Seerr created in Jellyfin during **Connect Jellyfin**; that key appears in Jellyfin's **API Keys** as `Seerr`. Uninstalling Seerr deletes that key from Jellyfin, at the address in `settings.json` for Jellyfin on another server, and revokes its ntfy account, when each is reachable; a failure is logged and the uninstall goes on, leaving the key to be deleted under Jellyfin's **API Keys** by hand.

## Network Access and Interfaces

One web interface.

| Interface | Id   | Type | Port | Purpose                                              |
| --------- | ---- | ---- | ---- | ---------------------------------------------------- |
| Web UI    | `ui` | ui   | 5055 | Seerr's web app and its API (`/api/v1`, `X-Api-Key`) |

Seerr needs outbound internet to reach TMDB (catalogue data and images, through a key built into Seerr), and, for Jellyfin on another server, a route to that server's address. `.local` names don't resolve inside StartOS containers, and Seerr's proxy setting has no SOCKS support, so `.onion` addresses can't be used. An `http://` address is accepted; Jellyfin passwords and Seerr's API key then cross the network unencrypted.

## Installation and First-Run Flow

The package replaces Seerr's setup wizard with **Connect Jellyfin**, because whoever finishes the wizard becomes the owner, and the wizard accepts any media server on the network.

1. Install raises a critical task for **Connect Jellyfin**, so Seerr can't start yet, and an optional one for **Configure SMTP**.
2. For Jellyfin on another server, the action first checks the address answers as Jellyfin, with the pasted root CA trusted, and fails before starting anything if not.
3. The action starts a private Seerr bound to `127.0.0.1`, signs in to Jellyfin with the administrator's credentials, switches on every Jellyfin library, and marks setup finished. Seerr creates its owner account from that Jellyfin user and an API key for itself in Jellyfin.
4. The task clears, the action hides, and Seerr can start. The owner signs in with their Jellyfin username and password.

The owner is Seerr's user 1. Seerr won't delete it, only it can delete other admins or change their passwords, and library scans read Jellyfin through its Jellyfin user, so Seerr sees what that account can see. Being a Jellyfin administrator matters only during setup; Seerr admins are granted in Seerr. Settings Seerr's wizard would have asked about keep their upstream defaults, including local sign-in, which stays on.

## Actions

Six actions. **Connect Jellyfin** is hidden once setup is finished, and **Update Jellyfin Address** is shown only after setup with Jellyfin on another server.

- **Connect Jellyfin**: run once, when the task asks. Once setup is finished it refuses to run, even from `start-cli`, which can run a hidden action. Takes about ten seconds while a temporary Seerr starts; if that Seerr hasn't answered within 80 seconds, the action fails with "Seerr did not start" and the log shows why. It creates the owner account, Seerr's Jellyfin API key and the library list in `settings.json` and the database. **Jellyfin Server** picks Jellyfin on this server or at an address; an address must start with `http://` or `https://` and must not use a `.local` name, and a pasted root CA must be a CA certificate in PEM form, though line breaks lost in pasting don't matter. A wrong password, a non-administrator account, an untrusted certificate or an unreachable Jellyfin fails with that reason, and the action can simply be run again; a retry after a partial failure writes the newly chosen address over the saved one. If Jellyfin has no library or Seerr can't read them, setup still finishes, with none switched on, and the result says to sync them under **Settings → Jellyfin**; the reason is in the log. The owner's email is their Jellyfin username until they add an address.
- **Update Jellyfin Address**: for Jellyfin on another server, while Seerr is stopped, after that server's IP address, Jellyfin's port or its root CA changes. Prefilled with the address in `settings.json`. It checks the new address answers as Jellyfin, trusting the pasted root CA or else the current one, and that the server ID matches `jellyfin.serverId`; then it writes the address into `settings.json` and replaces `jellyfin-ca.crt` when one was pasted. A different Jellyfin server is refused.
- **Connect Radarr and Sonarr**: while Seerr is running, once Radarr or Sonarr on this server has a library folder. Prefilled with the apps already connected. For each app ticked and not yet in Seerr, it reads the app's quality profiles and root folders from the app's own API, then adds a server to Seerr through `POST /settings/radarr` or `/settings/sonarr` named `Radarr (StartOS)` or `Sonarr (StartOS)`, with the `HD-1080p` profile (or the app's first), its first root folder, and as the default server unless Seerr already has a non-4K default. Movies are requested at minimum availability `released`; series as standard, without season folders, monitoring new seasons. The result lists each server's profile and folder; all of it can be changed under **Settings → Services**. For each app unticked, it deletes that server from Seerr; requests already sent stay in the app. Seerr restarts once the action has changed anything, to mount or unmount the app's key. It refuses with "Install … on this server first", "Seerr could not reach …" (not running, not set up, or its key unreadable) or "… has no library folder yet", and reports "Nothing changed." when there is nothing to do. A server deleted in Seerr's UI is recreated when its app is still ticked.
- **Connect ntfy**: when the user wants push notifications. Calls ntfy's `provision-publisher` for the chosen topic, then turns on Seerr's ntfy agent with that publish URL and token, keeping any event types already chosen (default: request pending approval, request automatically approved). Running it again mints a new token and keeps earlier topic grants. The user still has to grant their own ntfy user read access to the topic in ntfy.
- **Disconnect ntfy**: turns the ntfy agent off and clears its token, then revokes Seerr's ntfy account when ntfy is installed.
- **Configure SMTP**: off, StartOS system SMTP, or a custom server. Restarts Seerr to apply. Needed for per-user email notifications, password-reset email, and emailed passwords for new local users. While email is on, Seerr's **Require user email** is on too: every user whose email isn't an address, Jellyfin users included, sees a banner asking for one.

## Tasks

Two tasks, both raised by the package itself.

- **Connect Jellyfin** (critical): raised on every init while `public.initialized` in `settings.json` is not `true`, which is the state of every fresh install. It blocks Seerr from starting. It is cleared as soon as `public.initialized` turns `true`, near the end of the action, so a run that fails after that point still leaves Seerr ready to start. It does not return unless the volume loses Seerr's settings.
- **Configure SMTP** (optional): raised once, on install. Running the action clears it, whatever is chosen; it never returns.

## Health Checks

One check on the daemon, and one more for Jellyfin on another server.

- **Web Interface** (`primary`): `GET http://127.0.0.1:5055/api/v1/status`, unauthenticated. Seerr answers a few seconds after starting; the `ECONNREFUSED` traces the check logs until then are expected. A failure past the first minute usually means the database migration or settings load failed: read the logs. Jellyfin being down does not fail this check: StartOS reports Jellyfin on this server on the dependency, and Jellyfin on another server on the **Jellyfin** check.
- **Jellyfin** (`jellyfin`), only for Jellyfin on another server: `GET /System/Info/Public` at the address in `settings.json`, trusting `jellyfin-ca.crt`, every 30 seconds once Seerr is up. It fails with "doesn't trust Jellyfin's certificate" when the certificate isn't trusted, and with "can't reach Jellyfin" for anything else, including an answer that isn't Jellyfin. It only reports: Seerr keeps running either way.

## Backups and Restore

The `main` and `startos` volumes are copied whole, without `logs/`, `cache/` and `anime-list.xml`, which Seerr fetches again. StartOS stops Seerr for the backup, so the SQLite database is quiescent when it is copied.

A restore brings back the owner, users, requests, settings and the stored root CA. The Radarr and Sonarr servers come back too, and take the apps' current address and key on the first start where the apps are installed. Seerr's Jellyfin API key lives in Jellyfin, so a restored Seerr needs Jellyfin's data intact (or restored too), on whichever server it runs. Against a freshly installed Jellyfin, sign-ins and library scans fail until Seerr gets a new key. An uninstall before the restore deleted that key from Jellyfin, with the same result.

## Limitations and Differences

1. Seerr's setup wizard is never shown. Jellyfin is the only media server the package sets up; Plex and Emby aren't available.
2. Email settings in Seerr's UI are replaced on every start by **Configure SMTP**.
3. **Connect Radarr and Sonarr** connects only the Radarr and Sonarr on this server, with one non-4K server each. Instances elsewhere, 4K servers and anime settings are added under **Settings → Services** and aren't maintained by the package. Without Radarr or Sonarr, requests stay approved until the title appears in a Jellyfin library scan.
4. The update check against GitHub is off.
5. Libraries added to Jellyfin after setup stay off until synced and switched on under **Settings → Jellyfin**.
6. The Jellyfin server and the owner are fixed once **Connect Jellyfin** succeeds. Seerr's users are tied to that server's user IDs, so moving to another Jellyfin server means starting Seerr over. Only the address and root CA of Jellyfin on another server can change, with **Update Jellyfin Address**; Seerr's own **Settings → Jellyfin** form accepts a different server without checking.
7. Jellyfin on another server can't be given by a `.local` name or a Tor address.
8. The version of Jellyfin on another server isn't checked. The dependency on this server requires 10.11.7 or later.

---

## Quick Reference for AI Consumers

```yaml
package_id: seerr
image: ghcr.io/seerr-team/seerr
architectures: [x86_64, aarch64]
subcontainers: [seerr-sub, seerr-connect, seerr-radarr-key, seerr-sonarr-key]
volumes:
  main: /app/config
  startos: host-side only (store.json)
file_models:
  - settings.json
  - store.json
startos_managed_env_vars:
  - NODE_EXTRA_CA_CERTS
dependencies:
  [jellyfin (optional), ntfy (optional), radarr (optional), sonarr (optional)]
interfaces:
  ui: { type: ui, port: 5055 }
actions:
  - connect-jellyfin
  - update-jellyfin-address
  - connect-arrs
  - connect-ntfy
  - disconnect-ntfy
  - configure-smtp
tasks:
  - { action: connect-jellyfin, severity: critical }
  - { action: configure-smtp, severity: optional }
health_checks:
  - primary
  - jellyfin (Jellyfin on another server only)
```
