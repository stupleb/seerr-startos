import { actions } from '../actions'
import { restoreInit } from '../backups'
import { dependencies } from '../dependencies'
import { storeJson } from '../fileModels/store.json'
import { setInterfaces } from '../interfaces'
import { sdk } from '../sdk'
import { revokeJellyfinKey, revokeNtfyPublisher } from '../utils'
import { versionGraph } from '../versions'
import { seedStore } from './seedStore'
import { suggestSmtp } from './suggestSmtp'
import { watchSetup } from './watchSetup'

export const init = sdk.setupInit(
  restoreInit,
  versionGraph,
  seedStore,
  setInterfaces,
  actions,
  dependencies,
  watchSetup,
  suggestSmtp,
)

export const uninit = sdk.setupUninit(versionGraph, async (effects, target) => {
  if (target !== null) return
  if (await storeJson.read((s) => s.ntfyTopic).once())
    await revokeNtfyPublisher(effects).catch((e) =>
      console.error(`Could not delete Seerr's ntfy account: ${e}`),
    )
  await revokeJellyfinKey(effects).catch((e) =>
    console.error(`Could not delete Seerr's Jellyfin API key: ${e}`),
  )
})
