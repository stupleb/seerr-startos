import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const arrServer = z.looseObject({
  id: z.number(),
  hostname: z.string(),
  port: z.number(),
  apiKey: z.string(),
})

export const settingsJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './settings.json' },
  z.looseObject({
    main: z.looseObject({
      apiKey: z.string().catch(''),
      versionCheck: z.boolean().catch(true),
    }),
    public: z.looseObject({
      initialized: z.boolean().catch(false),
    }),
    jellyfin: z.looseObject({
      ip: z.string().catch(''),
      port: z.number().catch(8096),
      useSsl: z.boolean().catch(false),
      urlBase: z.string().catch(''),
      apiKey: z.string().catch(''),
      serverId: z.string().catch(''),
    }),
    // No .catch: a fallback would be written back, deleting every server.
    radarr: z.array(arrServer).optional(),
    sonarr: z.array(arrServer).optional(),
    notifications: z.looseObject({
      agents: z.looseObject({
        email: z.looseObject({
          enabled: z.boolean().catch(false),
          options: z.looseObject({
            emailFrom: z.string().catch(''),
            senderName: z.string().catch('Seerr'),
            smtpHost: z.string().catch(''),
            smtpPort: z.number().catch(587),
            secure: z.boolean().catch(false),
            requireTls: z.boolean().catch(false),
            ignoreTls: z.boolean().catch(false),
            authUser: z.string().optional().catch(undefined),
            authPass: z.string().optional().catch(undefined),
            userEmailRequired: z.boolean().catch(false),
          }),
        }),
      }),
    }),
  }),
)
