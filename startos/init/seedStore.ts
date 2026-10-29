import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

export const seedStore = sdk.setupOnInit(async (effects) => {
  await storeJson.merge(effects, {})
})
