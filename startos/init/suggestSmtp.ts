import { configureSmtp } from '../actions/configureSmtp'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const suggestSmtp = sdk.setupOnInit(async (effects, kind) => {
  if (kind !== 'install') return
  await sdk.action.createOwnTask(effects, configureSmtp, 'optional', {
    reason: i18n(
      'Set up email so Seerr can send request notifications and password resets',
    ),
  })
})
