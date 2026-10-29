import { settingsJson } from './fileModels/settings.json'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  configDir,
  emailAgent,
  jellyfinBridgeAddress,
  jellyfinCaFile,
  jellyfinServerId,
  jellyfinUrl,
  seerrCommand,
  seerrMounts,
  splitAddress,
  storedRootCa,
  uiPort,
  untrustedCert,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Seerr'))

  if (!(await settingsJson.read((s) => s.public.initialized).once())) {
    throw new Error(i18n('Run Connect Jellyfin before starting Seerr'))
  }

  const store = await storeJson
    .read((s) => ({ smtp: s.smtp, remoteJellyfin: s.remoteJellyfin }))
    .const(effects)
  const local = store?.remoteJellyfin
    ? null
    : await jellyfinBridgeAddress(effects).const()
  await settingsJson.merge(effects, {
    main: { versionCheck: false },
    ...(local && {
      jellyfin: { ...splitAddress(local), useSsl: false, urlBase: '' },
    }),
    ...(store?.smtp && {
      notifications: {
        agents: { email: await emailAgent(effects, store.smtp) },
      },
    }),
  })

  const ca = await storedRootCa()

  const seerrSub = sdk.SubContainer.of(
    effects,
    { imageId: 'seerr' },
    seerrMounts,
    'seerr-sub',
  )

  const daemons = sdk.Daemons.of(effects)
    .addOneshot('chown', {
      subcontainer: seerrSub,
      exec: { command: ['chown', '-R', 'node:node', configDir], user: 'root' },
      requires: [],
    })
    .addDaemon('primary', {
      subcontainer: seerrSub,
      exec: {
        command: seerrCommand,
        cwd: '/app',
        env: {
          LOG_LEVEL: 'info',
          ...(ca
            ? { NODE_EXTRA_CA_CERTS: `${configDir}/${jellyfinCaFile}` }
            : {}),
        },
      },
      ready: {
        display: i18n('Web Interface'),
        fn: () =>
          sdk.healthCheck.checkWebUrl(
            effects,
            `http://127.0.0.1:${uiPort}/api/v1/status`,
            {
              successMessage: i18n('The web interface is ready'),
              errorMessage: i18n('The web interface is not ready'),
            },
          ),
      },
      requires: ['chown'],
    })

  if (!store?.remoteJellyfin) return daemons

  return daemons.addHealthCheck('jellyfin', {
    ready: {
      display: i18n('Jellyfin'),
      fn: async () => {
        const url = await settingsJson
          .read((s) => jellyfinUrl(s.jellyfin))
          .once()
        try {
          if (url && (await jellyfinServerId(url, ca)))
            return {
              result: 'success',
              message: i18n('Seerr can reach Jellyfin'),
            }
        } catch (e) {
          if (untrustedCert(e))
            return {
              result: 'failure',
              message: i18n(
                'Seerr doesn’t trust Jellyfin’s certificate. Run Update Jellyfin Address with that server’s Root CA',
              ),
            }
        }
        return {
          result: 'failure',
          message: i18n(
            'Seerr can’t reach Jellyfin. Check that it’s running and that its address hasn’t changed',
          ),
        }
      },
      gracePeriod: 0,
      trigger: sdk.trigger.statusTrigger(30_000, { starting: 1_000 }),
    },
    requires: ['primary'],
  })
})
