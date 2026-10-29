import { storeJson } from './fileModels/store.json'
import { jellyfinDescription, ntfyDescription } from './manifest/i18n'
import { sdk } from './sdk'
import {
  JELLYFIN_ID,
  jellyfinVersionRange,
  NTFY_ID,
  ntfyVersionRange,
} from './utils'

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
