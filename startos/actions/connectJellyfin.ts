import { T } from '@start9labs/start-sdk'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { settingsJson } from '../fileModels/settings.json'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  checkJellyfin,
  configDir,
  jellyfinAddressField,
  jellyfinBridgeAddress,
  jellyfinCaFile,
  parseJellyfinAddress,
  parseRootCa,
  SeerrApiError,
  seerrApi,
  seerrCommand,
  seerrMounts,
  splitAddress,
  uiPort,
} from '../utils'

const { InputSpec, Value, Variants } = sdk

const JELLYFIN = 2

const inputSpec = InputSpec.of({
  server: Value.union({
    name: i18n('Jellyfin Server'),
    description: i18n(
      'Where Jellyfin runs. This choice is permanent: Seerr’s users stay tied to that Jellyfin server.',
    ),
    default: 'local',
    variants: Variants.of({
      local: { name: i18n('This server'), spec: InputSpec.of({}) },
      remote: {
        name: i18n('Another server'),
        spec: InputSpec.of({
          address: jellyfinAddressField,
          rootCa: Value.textarea({
            name: i18n('Root CA'),
            description: i18n(
              'Only for an https:// address whose certificate isn’t public, such as Jellyfin on another StartOS reached at its LAN address. Paste the certificate of the authority that issued it, including the BEGIN and END lines. For another StartOS, that is the Root CA from About this Server on that server: open the downloaded file in a text editor and copy all of it. Leave empty for an address with a public certificate.',
            ),
            required: false,
            default: null,
            placeholder: '-----BEGIN CERTIFICATE-----',
          }),
        }),
      },
    }),
  }),
  username: Value.text({
    name: i18n('Owner’s Jellyfin Username'),
    description: i18n(
      'A Jellyfin administrator account. It becomes Seerr’s owner, so use your own.',
    ),
    required: true,
    default: null,
  }),
  password: Value.text({
    name: i18n('Owner’s Jellyfin Password'),
    description: null,
    required: false,
    default: null,
    masked: true,
  }),
})

function signInFailure(code: string, remote: boolean) {
  if (code === 'INVALID_CREDENTIALS')
    return i18n('Jellyfin rejected that username or password')
  if (code === 'NOT_ADMIN')
    return i18n('That Jellyfin account is not an administrator')
  if (code === 'INVALID_URL' || code === 'CONNECTION_ERROR')
    return remote
      ? i18n('Seerr could not reach Jellyfin at that address')
      : i18n('Seerr could not reach Jellyfin. Make sure Jellyfin is running')
  return null
}

async function localJellyfin(effects: T.Effects) {
  const address = await jellyfinBridgeAddress(effects).once()
  if (!address)
    throw new Error(
      i18n('Install Jellyfin on this server first, or choose Another server'),
    )
  return { ...splitAddress(address), useSsl: false, urlBase: '' }
}

export const connectJellyfin = sdk.Action.withInput(
  'connect-jellyfin',

  async ({ effects }) => ({
    name: i18n('Connect Jellyfin'),
    description: i18n(
      'Choose Seerr’s owner and connect Seerr to Jellyfin. The owner is a Jellyfin administrator account and is permanent: it can’t be deleted, only it can remove other admins, and Seerr reads your Jellyfin libraries through it. Use your own account. Anyone can be made an admin later in Seerr under Users.',
    ),
    warning: null,
    allowedStatuses: 'only-stopped',
    group: null,
    visibility: (await settingsJson
      .read((s) => s.public.initialized)
      .const(effects))
      ? 'hidden'
      : 'enabled',
  }),

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    if (await settingsJson.read((s) => s.public.initialized).once())
      throw new Error(
        i18n(
          'Seerr is already set up. Its owner and Jellyfin server can’t be changed',
        ),
      )

    const remote =
      input.server.selection === 'remote' ? input.server.value : null
    const address = remote && parseJellyfinAddress(remote.address)
    const ca = remote?.rootCa?.trim() ? parseRootCa(remote.rootCa) : null
    if (address) await checkJellyfin(address.url, ca)
    const { ip, port, useSsl, urlBase } =
      address || (await localJellyfin(effects))

    if (ca) await sdk.volumes.main.writeFile(jellyfinCaFile, ca)
    else await rm(sdk.volumes.main.subpath(jellyfinCaFile), { force: true })
    await storeJson.merge(effects, { remoteJellyfin: !!remote })

    const configured = !!(await settingsJson.read((s) => s.jellyfin.ip).once())
    if (configured)
      await settingsJson.merge(effects, {
        jellyfin: { ip, port, useSsl, urlBase },
      })

    const libraries = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'seerr' },
      seerrMounts,
      'seerr-connect',
      async (sub) => {
        await sub.execFail(['chown', '-R', 'node:node', configDir], {
          user: 'root',
        })
        const seerr = await sub.spawn(seerrCommand, {
          cwd: '/app',
          env: {
            HOST: '127.0.0.1',
            PORT: String(uiPort),
            LOG_LEVEL: 'info',
            ...(ca
              ? { NODE_EXTRA_CA_CERTS: `${configDir}/${jellyfinCaFile}` }
              : {}),
          },
          stdio: 'inherit',
        })
        const running = () =>
          seerr.exitCode === null && seerr.signalCode === null
        try {
          // StartOS times an action out after 120 s.
          for (let tries = 0; ; tries++) {
            if (!running() || tries === 40)
              throw new Error(i18n('Seerr did not start'))
            if (
              await seerrApi('/status').then(
                () => true,
                () => false,
              )
            )
              break
            await setTimeout(2_000)
          }

          await seerrApi('/auth/jellyfin', {
            method: 'POST',
            body: {
              username: input.username,
              password: input.password ?? '',
              serverType: JELLYFIN,
              ...(configured ? {} : { hostname: ip, port, useSsl, urlBase }),
            },
          }).catch((e) => {
            const failure =
              e instanceof SeerrApiError && signInFailure(e.code, !!remote)
            throw failure ? new Error(failure) : e
          })

          const synced = await seerrApi<{ id: string }[]>(
            '/settings/jellyfin/library/sync',
            { method: 'POST' },
          ).catch((e) => {
            console.warn(`Could not read Jellyfin's libraries: ${e}`)
            return []
          })
          for (const { id } of synced) {
            await seerrApi(`/settings/jellyfin/library/${id}`, {
              method: 'PUT',
              body: { enabled: true },
            })
          }
          await seerrApi('/settings/initialize', { method: 'POST' })
          return synced.length
        } finally {
          if (running()) {
            const exited = once(seerr, 'exit')
            seerr.kill('SIGTERM')
            await Promise.race([exited, setTimeout(15_000)])
          }
        }
      },
    )

    return {
      version: '1',
      title: i18n('Jellyfin Connected'),
      message: libraries
        ? i18n(
            'Start Seerr and sign in with your Jellyfin account. Libraries you add to Jellyfin later are switched on under Settings → Jellyfin.',
          )
        : i18n(
            'Start Seerr and sign in with your Jellyfin account. No Jellyfin library was switched on: add one in Jellyfin, then click Sync Libraries under Settings → Jellyfin in Seerr and switch it on.',
          ),
      result: null,
    }
  },
)
