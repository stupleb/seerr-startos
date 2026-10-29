import { sdk } from './sdk'

export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.withOptions({ exclude: ['/logs', '/cache', '/anime-list.xml'] })
    .addVolume('main')
    .addVolume('startos'),
)
