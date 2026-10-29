import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'seerr',
  title: 'Seerr',
  license: 'MIT',
  packageRepo: 'https://github.com/stupleb/seerr-startos',
  upstreamRepo: 'https://github.com/seerr-team/seerr',
  marketingUrl: 'https://seerr.dev',
  donationUrl: 'https://opencollective.com/seerr',
  description: { short, long },
  volumes: ['main', 'startos'],
  images: {
    seerr: {
      source: { dockerTag: 'ghcr.io/seerr-team/seerr:v3.5.1' },
      arch: ['x86_64', 'aarch64'],
    },
  },
})
