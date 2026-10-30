import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.5.1:1',
  releaseNotes: {
    en_US:
      'New Connect Radarr and Sonarr action sends approved requests to Radarr and Sonarr on this server.',
    es_ES:
      'La nueva acción Conectar Radarr y Sonarr envía las peticiones aprobadas a Radarr y Sonarr en este servidor.',
    de_DE:
      'Die neue Aktion Radarr und Sonarr verbinden schickt genehmigte Anfragen an Radarr und Sonarr auf diesem Server.',
    pl_PL:
      'Nowa akcja Połącz Radarr i Sonarr wysyła zatwierdzone prośby do Radarr i Sonarr na tym serwerze.',
    fr_FR:
      'La nouvelle action Connecter Radarr et Sonarr envoie les demandes approuvées à Radarr et Sonarr sur ce serveur.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
