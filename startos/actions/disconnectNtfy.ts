import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  NtfyAgent,
  ntfyInstalled,
  revokeNtfyPublisher,
  seerrApi,
} from '../utils'

export const disconnectNtfy = sdk.Action.withoutInput(
  'disconnect-ntfy',

  async ({ effects }) => ({
    name: i18n('Disconnect ntfy'),
    description: i18n(
      'Stop sending Seerr notifications to ntfy, and delete the ntfy account Seerr published with.',
    ),
    warning: null,
    allowedStatuses: 'only-running',
    group: i18n('Notifications'),
    visibility: (await storeJson.read((s) => s.ntfyTopic).const(effects))
      ? 'enabled'
      : 'hidden',
  }),

  async ({ effects }) => {
    const current = await seerrApi<NtfyAgent>('/settings/notifications/ntfy')
    await seerrApi('/settings/notifications/ntfy', {
      method: 'POST',
      body: {
        ...current,
        enabled: false,
        options: { ...current.options, authMethodToken: false, token: '' },
      },
    })
    if (await ntfyInstalled(effects).once()) await revokeNtfyPublisher(effects)
    await storeJson.merge(effects, { ntfyTopic: null })
    return {
      version: '1',
      title: i18n('ntfy Disconnected'),
      message: i18n('Seerr no longer sends notifications to ntfy.'),
      result: null,
    }
  },
)
