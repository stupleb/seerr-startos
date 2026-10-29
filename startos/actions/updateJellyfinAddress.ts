import { settingsJson } from '../fileModels/settings.json'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  checkJellyfin,
  jellyfinAddressField,
  jellyfinCaFile,
  jellyfinUrl,
  parseJellyfinAddress,
  parseRootCa,
  storedRootCa,
} from '../utils'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  address: jellyfinAddressField,
  rootCa: Value.textarea({
    name: i18n('Root CA'),
    description: i18n(
      'A new Root CA for that server, including the BEGIN and END lines, if its certificate now comes from a different authority. For another StartOS, download it from About this Server on that server and open it in a text editor. Leave empty to keep the current one.',
    ),
    required: false,
    default: null,
    placeholder: '-----BEGIN CERTIFICATE-----',
  }),
})

export const updateJellyfinAddress = sdk.Action.withInput(
  'update-jellyfin-address',

  async ({ effects }) => ({
    name: i18n('Update Jellyfin Address'),
    description: i18n(
      'Change the address or Root CA Seerr uses for Jellyfin on another server, after that server’s IP address, Jellyfin’s port, or that server’s Root CA changes. It must be the same Jellyfin server Seerr was set up with.',
    ),
    warning: null,
    allowedStatuses: 'only-stopped',
    group: null,
    visibility:
      (await storeJson.read((s) => s.remoteJellyfin).const(effects)) &&
      (await settingsJson.read((s) => s.public.initialized).const(effects))
        ? 'enabled'
        : 'hidden',
  }),

  inputSpec,

  async () => ({
    address:
      (await settingsJson.read((s) => jellyfinUrl(s.jellyfin)).once()) ??
      undefined,
  }),

  async ({ effects, input }) => {
    const address = parseJellyfinAddress(input.address)
    const pasted = input.rootCa?.trim() ? parseRootCa(input.rootCa) : null
    const id = await checkJellyfin(
      address.url,
      pasted || (await storedRootCa()),
    )
    if (id !== (await settingsJson.read((s) => s.jellyfin.serverId).once()))
      throw new Error(
        i18n(
          'That is a different Jellyfin server. Seerr can only move to a new address of the server it was set up with',
        ),
      )

    if (pasted) await sdk.volumes.main.writeFile(jellyfinCaFile, pasted)
    const { ip, port, useSsl, urlBase } = address
    await settingsJson.merge(effects, {
      jellyfin: { ip, port, useSsl, urlBase },
    })

    return {
      version: '1',
      title: i18n('Jellyfin Address Updated'),
      message: i18n(
        'Start Seerr to use the new address. If External URL under Settings → Jellyfin still has the old one, change it there too.',
      ),
      result: null,
    }
  },
)
