import { readFile } from 'node:fs/promises'
import { settingsJson } from './fileModels/settings.json'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  ArrId,
  arrBridgeAddress,
  arrIds,
  arrKeyFile,
  configDir,
  emailAgent,
  jellyfinBridgeAddress,
  jellyfinCaFile,
  jellyfinServerId,
  jellyfinUrl,
  mountArr,
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
    .read((s) => ({
      smtp: s.smtp,
      remoteJellyfin: s.remoteJellyfin,
      arrServers: s.arrServers,
    }))
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

  let mounts = seerrMounts
  const arrAddresses: [ArrId, number, string][] = []
  for (const id of arrIds) {
    const serverId = store?.arrServers[id]
    // An app that isn't installed has no volume to mount.
    const address =
      serverId != null ? await arrBridgeAddress(effects, id).const() : null
    if (serverId == null || !address) continue
    mounts = mountArr(mounts, id)
    arrAddresses.push([id, serverId, address])
  }

  const seerrSub = sdk.SubContainer.of(
    effects,
    { imageId: 'seerr' },
    mounts,
    'seerr-sub',
  )

  const fresh = new Map<ArrId, { serverId: number; target: object }>()
  for (const [id, serverId, address] of arrAddresses) {
    // Radarr and Sonarr publish their address before their key during init.
    const apiKey = await readFile(
      `${await seerrSub.rootfs}${arrKeyFile(id)}`,
      'utf8',
    ).catch((e) => console.warn(`Could not read ${id}'s API key: ${e}`))
    if (!apiKey) continue
    const { ip, port } = splitAddress(address)
    fresh.set(id, {
      serverId,
      target: {
        hostname: ip,
        port,
        apiKey: apiKey.trim(),
        useSsl: false,
        baseUrl: '',
      },
    })
  }
  const refresh = <S extends { id: number }>(id: ArrId, servers?: S[]) =>
    servers?.map((server) =>
      server.id === fresh.get(id)?.serverId
        ? { ...server, ...fresh.get(id)!.target }
        : server,
    )
  if (fresh.size)
    await settingsJson.update(
      effects,
      (s) =>
        s && {
          ...s,
          radarr: refresh('radarr', s.radarr),
          sonarr: refresh('sonarr', s.sonarr),
        },
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
