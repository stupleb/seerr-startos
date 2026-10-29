import { smtpPrefill } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec } = sdk

const inputSpec = InputSpec.of({
  smtp: sdk.inputSpecConstants.smtpInputSpec,
})

export const configureSmtp = sdk.Action.withInput(
  'configure-smtp',

  async ({ effects }) => ({
    name: i18n('Configure SMTP'),
    description: i18n(
      'Let Seerr send email: request notifications, password resets, and passwords for new local users. While email is on, Seerr asks everyone without an email address in their profile, the owner included, to add one. Seerr restarts to apply the change.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: i18n('Notifications'),
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => {
    const smtp = await storeJson.read((s) => s.smtp).once()
    if (!smtp || smtp.selection === 'disabled') return {}
    return { smtp: smtpPrefill(smtp) }
  },

  async ({ effects, input }) => storeJson.merge(effects, { smtp: input.smtp }),
)
