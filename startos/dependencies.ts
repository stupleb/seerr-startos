import { T } from '@start9labs/start-sdk'
import { storeJson } from './fileModels/store.json'
import {
  jellyfinDescription,
  ntfyDescription,
  radarrDescription,
  sonarrDescription,
} from './manifest/i18n'
import { sdk } from './sdk'
import {
  ArrId,
  arrs,
  JELLYFIN_ID,
  jellyfinVersionRange,
  NTFY_ID,
  ntfyVersionRange,
} from './utils'

const arrConnected =
  (id: ArrId) =>
  async ({ effects }: { effects: T.Effects }) =>
    (await storeJson.read((s) => s.arrServers[id]).const(effects)) !== null

export const dependencies = sdk.Dependencies.of()
  .addDependency(
    sdk.Dependency.optional(JELLYFIN_ID, {
      description: jellyfinDescription,
      metadata: {
        title: 'Jellyfin',
        icon: 'https://raw.githubusercontent.com/Start9Labs/jellyfin-startos/c82169764d41909a939e149799611fa8798ad405/icon.svg',
      },
      versionRange: jellyfinVersionRange,
      kind: 'running',
      healthChecks: ['primary'],
      enabled: async ({ effects }) =>
        !(await storeJson.read((s) => s.remoteJellyfin).const(effects)),
    }),
  )
  .addDependency(
    sdk.Dependency.optional(NTFY_ID, {
      description: ntfyDescription,
      metadata: {
        title: 'ntfy',
        icon: 'https://raw.githubusercontent.com/Start9Labs/ntfy-startos/ed9ce89245f0f77a82b8a81440a0882ab01431c9/icon.svg',
      },
      versionRange: ntfyVersionRange,
      kind: 'running',
      healthChecks: [],
      enabled: async ({ effects }) =>
        !!(await storeJson.read((s) => s.ntfyTopic).const(effects)),
    }),
  )
  .addDependency(
    sdk.Dependency.optional('radarr', {
      description: radarrDescription,
      metadata: {
        title: arrs.radarr.name,
        icon: 'https://raw.githubusercontent.com/Start9Labs/radarr-startos/73fd3e144a766f02f9c628e4f31755b75973fbc3/icon.svg',
      },
      versionRange: arrs.radarr.versionRange,
      kind: 'running',
      healthChecks: ['primary'],
      enabled: arrConnected('radarr'),
    }),
  )
  .addDependency(
    sdk.Dependency.optional('sonarr', {
      description: sonarrDescription,
      metadata: {
        title: arrs.sonarr.name,
        icon: 'https://raw.githubusercontent.com/Start9Labs/sonarr-startos/1fd0ca56ec8ad8db79d3fe7f25d2fc026d369a74/icon.svg',
      },
      versionRange: arrs.sonarr.versionRange,
      kind: 'running',
      healthChecks: ['primary'],
      enabled: arrConnected('sonarr'),
    }),
  )
