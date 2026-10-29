import { FileHelper, smtpShape, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const storeJson = FileHelper.json(
  { base: sdk.volumes.startos, subpath: './store.json' },
  z.looseObject({
    smtp: smtpShape,
    ntfyTopic: z.string().nullable().catch(null),
    remoteJellyfin: z.boolean().catch(false),
  }),
)
