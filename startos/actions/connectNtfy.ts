import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  NTFY_ID,
  NtfyAgent,
  ntfyInstalled,
  seerrApi,
  withNtfyDeclared,
} from '../utils'

const { InputSpec, Value } = sdk

const MEDIA_PENDING = 2
const MEDIA_AUTO_APPROVED = 128

const inputSpec = InputSpec.of({
  topic: Value.text({
    name: i18n('Topic'),
    description: i18n(
      'The ntfy topic Seerr publishes to. Subscribe to it in the ntfy app.',
    ),
    required: true,
    default: 'seerr',
    patterns: [
      {
        regex: '^[a-zA-Z0-9_-]{1,64}$',
        description: i18n(
          'Letters, numbers, underscores and hyphens only, up to 64 characters',
        ),
      },
    ],
  }),
})

export const connectNtfy = sdk.Action.withInput(
  'connect-ntfy',

  async ({ effects }) => ({
    name: i18n('Connect ntfy'),
    description: i18n(
      'Send Seerr notifications to a topic on your ntfy server. Seerr gets its own publish-only ntfy account for that topic.',
    ),
    warning: null,
    allowedStatuses: 'only-running',
    group: i18n('Notifications'),
    visibility: (await ntfyInstalled(effects).const())
      ? 'enabled'
      : { disabled: i18n('Install ntfy first') },
  }),

  inputSpec,

  async () => ({
    topic: (await storeJson.read((s) => s.ntfyTopic).once()) ?? undefined,
  }),

  async ({ effects, input }) => {
    const { topic } = input
    await withNtfyDeclared(effects, async () => {
      const res = await sdk.action.run({
        effects,
        packageId: NTFY_ID,
        actionId: 'provision-publisher',
        input: () => ({ packageId: sdk.manifest.id, topic }),
      })
      const fields =
        res?.version === '1' && res.result?.type === 'group'
          ? res.result.value
          : []
      const field = (name: string) => {
        const f = fields.find((v) => v.type === 'single' && v.name === name)
        return f?.type === 'single' ? f.value : null
      }
      const publishUrl = field('publishUrl')
      const token = field('token')
      if (!publishUrl || !token)
        throw new Error(i18n('ntfy did not return a publish address and token'))
      const current = await seerrApi<NtfyAgent>('/settings/notifications/ntfy')
      await seerrApi('/settings/notifications/ntfy', {
        method: 'POST',
        body: {
          ...current,
          enabled: true,
          types: current.types || MEDIA_PENDING | MEDIA_AUTO_APPROVED,
          options: {
            ...current.options,
            url: publishUrl,
            topic,
            authMethodUsernamePassword: false,
            authMethodToken: true,
            token,
          },
        },
      })
      await storeJson.merge(effects, { ntfyTopic: topic })
    })

    return {
      version: '1',
      title: i18n('ntfy Connected'),
      message: i18n(
        'Seerr now notifies the "${topic}" topic about new requests. To receive them, give your ntfy user read access to that topic in ntfy, then subscribe to it in the ntfy app.',
        { topic },
      ),
      result: null,
    }
  },
)
