import { sdk } from '../sdk'
import { configureSmtp } from './configureSmtp'
import { connectJellyfin } from './connectJellyfin'
import { connectNtfy } from './connectNtfy'
import { disconnectNtfy } from './disconnectNtfy'
import { updateJellyfinAddress } from './updateJellyfinAddress'

export const actions = sdk.Actions.of()
  .addAction(connectJellyfin)
  .addAction(updateJellyfinAddress)
  .addAction(connectNtfy)
  .addAction(disconnectNtfy)
  .addAction(configureSmtp)
