# Updating the upstream version

"Upstream" is the Seerr Docker image `ghcr.io/seerr-team/seerr`, pinned by tag in `startos/manifest/index.ts` (`images.seerr.source.dockerTag`). Image tags carry a `v` prefix and match the GitHub release tags.

## Determining the upstream version

```bash
gh release view -R seerr-team/seerr --json tagName -q .tagName
docker manifest inspect ghcr.io/seerr-team/seerr:<tag> | jq -r '.manifests[].platform | "\(.os)/\(.architecture)"'
```

Confirm the tag exists for `linux/amd64` and `linux/arm64` before pinning it.

## Applying the bump

1. Set `images.seerr.source.dockerTag` to `ghcr.io/seerr-team/seerr:<tag>`.
2. Set `startos/versions/current.ts` to `<version>:0`, without the `v`, and write release notes per the workspace's release-note rules. When the version already there has an `up` that does work, first move it into its own file under `startos/versions/` and list it in `other` in `index.ts`.
3. Diff what the package depends on between the two tags:

   ```bash
   git -C <seerr clone> diff <old>..<new> -- Dockerfile package.json \
     server/routes/auth.ts server/routes/settings/index.ts server/routes/settings/notifications.ts \
     server/lib/settings/index.ts server/middleware/auth.ts server/constants server/api/jellyfin.ts \
     server/utils/getHostname.ts
   ```

   - The `start` script in `package.json` must still run `node dist/index.js` from `/app`, and `HOST`/`PORT` must still pick the listen address.
   - Connect Jellyfin depends on `POST /auth/jellyfin` (fields `username`, `password`, `serverType`, `hostname`, `port`, `useSsl`, `urlBase`; error codes `INVALID_CREDENTIALS`, `NOT_ADMIN`, `INVALID_URL`, `CONNECTION_ERROR`; the setup branch taking the address from the body only while none is saved), `POST /settings/jellyfin/library/sync`, `PUT /settings/jellyfin/library/:id` and `POST /settings/initialize`, all authenticated with `X-Api-Key`, and on Seerr's Node honouring `NODE_EXTRA_CA_CERTS`.
   - The email agent's `userEmailRequired` option must still raise the "add an email" warning for users without a valid address (`GET /auth/me`).
   - Uninstall depends on Jellyfin's `DELETE /Auth/Keys/{key}` accepting the key itself as the `MediaBrowser Token`. The remote checks in **Connect Jellyfin**, **Update Jellyfin Address** and the `jellyfin` health check depend on Jellyfin's unauthenticated `GET /System/Info/Public` returning an `Id` equal to the `jellyfin.serverId` Seerr records at setup.
   - `jellyfinUrl()` in `startos/utils.ts` must build the same address from `settings.json` as Seerr's `getHostname()`.
   - Connect and Disconnect ntfy depend on `GET`/`POST /settings/notifications/ntfy` replacing the whole agent, and on the ntfy option names `url`, `topic`, `authMethodToken`, `token`, `authMethodUsernamePassword`.
   - `startos/fileModels/settings.json.ts` depends on the `settings.json` keys it models, including the email agent's option names.

4. Build, install over an existing instance, and check that it starts healthy, a Jellyfin sign-in works, a request reaches ntfy, and **Configure SMTP** still delivers a test email. For a change to the setup or Jellyfin routes, also set up a fresh install with Jellyfin on another server and run **Update Jellyfin Address** on it.
