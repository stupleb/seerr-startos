import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.5.2:0',
  releaseNotes: {
    en_US:
      'Updated Seerr to 3.5.2, which fixes three security vulnerabilities. Requires StartOS 0.4.2 or later. Full release notes: https://github.com/seerr-team/seerr/releases/tag/v3.5.2',
    es_ES:
      'Seerr actualizado a 3.5.2, que corrige tres vulnerabilidades de seguridad. Requiere StartOS 0.4.2 o posterior. Notas de la versión completas: https://github.com/seerr-team/seerr/releases/tag/v3.5.2',
    de_DE:
      'Seerr auf 3.5.2 aktualisiert. Behebt drei Sicherheitslücken. Erfordert StartOS 0.4.2 oder neuer. Vollständige Versionshinweise: https://github.com/seerr-team/seerr/releases/tag/v3.5.2',
    pl_PL:
      'Zaktualizowano Seerr do 3.5.2, który naprawia trzy luki bezpieczeństwa. Wymaga StartOS 0.4.2 lub nowszego. Pełne informacje o wydaniu: https://github.com/seerr-team/seerr/releases/tag/v3.5.2',
    fr_FR:
      'Seerr mis à jour vers 3.5.2, qui corrige trois failles de sécurité. Nécessite StartOS 0.4.2 ou une version ultérieure. Notes de version complètes : https://github.com/seerr-team/seerr/releases/tag/v3.5.2',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
