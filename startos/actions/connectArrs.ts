import { T } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  ArrId,
  arrBridgeAddress,
  arrIds,
  arrs,
  readArrKey,
  SeerrApiError,
  seerrApi,
  splitAddress,
} from '../utils'

const { InputSpec, Value } = sdk

const defaultProfile = 'HD-1080p'

type Server = { id: number; isDefault: boolean; is4k: boolean }

const inputSpec = InputSpec.of({
  apps: Value.multiselect({
    name: i18n('Apps'),
    description: i18n(
      'Untick an app to disconnect it. Requests already sent to it stay there.',
    ),
    default: [],
    values: { radarr: 'Radarr', sonarr: 'Sonarr' },
  }),
})

async function connect(effects: T.Effects, id: ArrId) {
  const app = arrs[id].name
  const address = await arrBridgeAddress(effects, id).once()
  if (!address)
    throw new Error(i18n('Install ${app} on this server first', { app }))
  const unreachable = () =>
    new Error(
      i18n(
        'Seerr could not reach ${app}. Make sure it is running and set up, then run this again',
        { app },
      ),
    )
  const { ip, port } = splitAddress(address)
  const target = {
    hostname: ip,
    port,
    apiKey: await readArrKey(effects, id).catch(() => {
      throw unreachable()
    }),
    useSsl: false,
    baseUrl: '',
  }
  // Seerr's own test route serves these from a cache an hour old.
  const get = async <R>(path: string) => {
    const res = await fetch(`http://${address}/api/v3${path}`, {
      headers: { 'X-Api-Key': target.apiKey },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return (await res.json()) as R
  }
  const [profiles, folders] = await Promise.all([
    get<{ id: number; name: string }[]>('/qualityprofile'),
    get<{ path: string }[]>('/rootfolder'),
  ]).catch(() => {
    throw unreachable()
  })
  const folder = folders[0]
  const profile = profiles.find((p) => p.name === defaultProfile) ?? profiles[0]
  if (!folder || !profile)
    throw new Error(
      i18n(
        '${app} has no library folder yet. Add one in ${app} under Settings → Media Management → Root Folders, then run this again',
        { app },
      ),
    )
  const servers = await seerrApi<Server[]>(`/settings/${id}`)
  const created = await seerrApi<Server>(`/settings/${id}`, {
    method: 'POST',
    body: {
      ...target,
      name: `${app} (StartOS)`,
      activeProfileId: profile.id,
      activeProfileName: profile.name,
      activeDirectory: folder.path,
      tags: [],
      is4k: false,
      isDefault: !servers.some((s) => s.isDefault && !s.is4k),
      externalUrl: '',
      syncEnabled: false,
      preventSearch: false,
      tagRequests: false,
      overrideRule: [],
      ...(id === 'radarr'
        ? { minimumAvailability: 'released' }
        : {
            seriesType: 'standard',
            animeSeriesType: 'anime',
            animeTags: [],
            enableSeasonFolders: false,
            monitorNewItems: 'all',
          }),
    },
  })
  return {
    id: created.id,
    line: i18n(
      '${app}: requests go to "${server}" with the ${profile} profile, saved to ${folder}.',
      {
        app,
        server: `${app} (StartOS)`,
        profile: profile.name,
        folder: folder.path,
      },
    ),
  }
}

export const connectArrs = sdk.Action.withInput(
  'connect-arrs',

  async () => ({
    name: i18n('Connect Radarr and Sonarr'),
    description: i18n(
      'Send approved requests to Radarr (movies) and Sonarr (TV) on this server. Each gets a server in Seerr with its first library folder and the HD-1080p quality profile, which you can change under Settings → Services in Seerr.',
    ),
    warning: null,
    allowedStatuses: 'only-running',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => {
    const servers = await storeJson.read((s) => s.arrServers).once()
    return { apps: arrIds.filter((id) => servers?.[id] != null) }
  },

  async ({ effects, input }) => {
    const servers = {
      radarr: null,
      sonarr: null,
      ...(await storeJson.read((s) => s.arrServers).once()),
    }
    let changed = false
    const lines: string[] = []
    try {
      for (const id of arrIds) {
        const serverId = servers[id]
        const present =
          serverId != null &&
          (await seerrApi<Server[]>(`/settings/${id}`)).some(
            (s) => s.id === serverId,
          )
        if (input.apps.includes(id) && !present) {
          const { id: newId, line } = await connect(effects, id)
          servers[id] = newId
          changed = true
          lines.push(line)
        } else if (!input.apps.includes(id) && serverId != null) {
          if (present)
            await seerrApi(`/settings/${id}/${serverId}`, {
              method: 'DELETE',
            }).catch((e) => {
              if (!(e instanceof SeerrApiError && e.status === 404)) throw e
            })
          servers[id] = null
          changed = true
          lines.push(i18n('${app}: disconnected.', { app: arrs[id].name }))
        }
      }
    } finally {
      // Seerr restarts when this changes, so it is written after every API call.
      if (changed) await storeJson.merge(effects, { arrServers: servers })
    }

    return {
      version: '1',
      title: i18n('Radarr and Sonarr'),
      message: lines.length ? lines.join('\n') : i18n('Nothing changed.'),
      result: null,
    }
  },
)
