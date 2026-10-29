import { connectJellyfin } from '../actions/connectJellyfin'
import { settingsJson } from '../fileModels/settings.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const watchSetup = sdk.setupOnInit(async (effects) => {
  if (!(await settingsJson.read((s) => s.public.initialized).const(effects))) {
    await sdk.action.createOwnTask(effects, connectJellyfin, 'critical', {
      reason: i18n('Choose Seerr’s owner and connect it to Jellyfin'),
    })
  } else {
    await sdk.action.clearTask(effects, 'seerr:connect-jellyfin')
  }
})
