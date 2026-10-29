import { SmtpSelection, T } from '@start9labs/start-sdk'
import { uiPort as jellyfinPort } from 'jellyfin-startos/startos/utils'
import { X509Certificate } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import { rootCertificates } from 'node:tls'
import { settingsJson } from './fileModels/settings.json'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'

export const uiPort = 5055
export const configDir = '/app/config'
export const seerrCommand: [string, ...string[]] = ['node', 'dist/index.js']

export const JELLYFIN_ID = 'jellyfin'
export const jellyfinVersionRange = '>=10.11.7:0'
export const NTFY_ID = 'ntfy'
export const ntfyVersionRange = '>=2.26.3:2'

export const jellyfinCaFile = 'jellyfin-ca.crt'

export const jellyfinAddressField = sdk.Value.text({
  name: i18n('Jellyfin Address'),
  description: i18n(
    'The address Seerr reaches Jellyfin at. For Jellyfin on another StartOS, copy its HTTPS LAN address and replace the .local name with that server’s IP address. Give that server a fixed IP address in your router. An http:// address sends Jellyfin passwords unencrypted.',
  ),
  required: true,
  default: null,
  placeholder: 'https://192.168.1.50:49193',
  inputmode: 'url',
})

export const seerrMounts = sdk.Mounts.of().mountVolume({
  volumeId: 'main',
  subpath: null,
  mountpoint: configDir,
  readonly: false,
})

export function jellyfinBridgeAddress(effects: T.Effects) {
  return sdk.host.getBridgeAddress(effects, {
    packageId: JELLYFIN_ID,
    hostId: 'main',
    internalPort: jellyfinPort,
    ssl: false,
  })
}

export function splitAddress(address: string) {
  const i = address.lastIndexOf(':')
  return { ip: address.slice(0, i), port: Number(address.slice(i + 1)) }
}

export function parseJellyfinAddress(address: string) {
  let url: URL | null = null
  try {
    url = new URL(address.trim())
  } catch {}
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:'))
    throw new Error(
      i18n('Enter the full address, starting with https:// or http://'),
    )
  if (url.hostname.replace(/\.$/, '').endsWith('.local'))
    throw new Error(
      i18n(
        '.local names don’t work from inside StartOS services. Use the server’s IP address instead',
      ),
    )
  const useSsl = url.protocol === 'https:'
  const urlBase = url.pathname.replace(/\/+$/, '')
  return {
    url: `${url.protocol}//${url.host}${urlBase}`,
    ip: url.hostname,
    port: Number(url.port) || (useSsl ? 443 : 80),
    useSsl,
    urlBase,
  }
}

export function parseRootCa(pasted: string) {
  const body =
    pasted.match(
      /-----BEGIN CERTIFICATE-----([^-]*)-----END CERTIFICATE-----/,
    )?.[1] ?? ''
  let cert: X509Certificate
  try {
    // Pasting can lose PEM's line breaks, which Node needs.
    cert = new X509Certificate(
      `-----BEGIN CERTIFICATE-----\n${body.replace(/\s+/g, '').replace(/.{1,64}/g, '$&\n')}-----END CERTIFICATE-----`,
    )
  } catch {
    throw new Error(
      i18n(
        'That is not a certificate. Paste all of it, including the BEGIN and END lines',
      ),
    )
  }
  if (!cert.ca)
    throw new Error(
      i18n(
        'That certificate is not a certificate authority. Paste the server’s Root CA',
      ),
    )
  return cert.toString()
}

export async function storedRootCa() {
  const path = sdk.volumes.main.subpath(jellyfinCaFile)
  return existsSync(path) ? readFile(path, 'utf8') : null
}

// Node's `ca` replaces the public roots, so they are passed alongside the given one.
export function jellyfinRequest(
  url: string,
  init: { method?: string; token?: string; ca?: string | null } = {},
): Promise<{ status: number; body: string }> {
  const options: https.RequestOptions = {
    method: init.method ?? 'GET',
    headers: init.token
      ? {
          Authorization: `MediaBrowser Client="Seerr", Device="StartOS", DeviceId="seerr-startos", Version="1", Token="${init.token}"`,
        }
      : {},
    ...(init.ca ? { ca: [...rootCertificates, init.ca] } : {}),
    timeout: 10_000,
  }
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? https : http).request(
      url,
      options,
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
      },
    )
    req.on('timeout', () =>
      req.destroy(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })),
    )
    req.on('error', reject)
    req.end()
  })
}

// Matches Seerr's getHostname().
export function jellyfinUrl(jellyfin: {
  useSsl: boolean
  ip: string
  port: number
  urlBase: string
}) {
  return `${jellyfin.useSsl ? 'https' : 'http'}://${jellyfin.ip}:${jellyfin.port}${jellyfin.urlBase}`
}

export const untrustedCert = (e: unknown) =>
  e instanceof Error &&
  'code' in e &&
  /CERT|SELF_SIGNED|UNABLE_TO_(GET|VERIFY)/.test(String(e.code))

export async function jellyfinServerId(url: string, ca: string | null) {
  const res = await jellyfinRequest(`${url}/System/Info/Public`, { ca })
  let id: unknown
  try {
    id = JSON.parse(res.body).Id
  } catch {}
  return res.status === 200 && typeof id === 'string' && id ? id : null
}

export async function checkJellyfin(url: string, ca: string | null) {
  const id = await jellyfinServerId(url, ca).catch((e) => {
    console.warn(`Jellyfin check of ${url} failed: ${e.code ?? e}`)
    throw new Error(
      untrustedCert(e)
        ? i18n(
            'Seerr doesn’t trust that server’s certificate. Paste its Root CA, which for another StartOS is under About this Server on that server',
          )
        : i18n(
            'Nothing answered at that address. Check it, and that Jellyfin is running there',
          ),
    )
  })
  if (!id)
    throw new Error(i18n('That address doesn’t answer like a Jellyfin server'))
  return id
}

export async function revokeJellyfinKey(effects: T.Effects) {
  const jellyfin = await settingsJson.read((s) => s.jellyfin).once()
  const remote = await storeJson.read((s) => s.remoteJellyfin).once()
  const local = remote ? null : await jellyfinBridgeAddress(effects).once()
  const base = remote
    ? jellyfin && jellyfinUrl(jellyfin)
    : local && `http://${local}`
  if (!base || !jellyfin?.apiKey) return
  const res = await jellyfinRequest(`${base}/Auth/Keys/${jellyfin.apiKey}`, {
    method: 'DELETE',
    token: jellyfin.apiKey,
    ca: await storedRootCa(),
  })
  if (res.status >= 300) throw new Error(`Jellyfin answered ${res.status}`)
}

export function ntfyInstalled(effects: T.Effects) {
  return sdk.getServiceManifest(effects, NTFY_ID, (m) => m !== null)
}

export async function seerrApi<R = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<R> {
  const apiKey = await settingsJson.read((s) => s.main.apiKey).once()
  const res = await fetch(`http://127.0.0.1:${uiPort}/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  if (!res.ok) {
    let code = text
    try {
      code = JSON.parse(text).message ?? text
    } catch {}
    throw new SeerrApiError(res.status, code)
  }
  return (text ? JSON.parse(text) : null) as R
}

export class SeerrApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`Seerr answered ${status}: ${code}`)
  }
}

export async function emailAgent(effects: T.Effects, smtp: SmtpSelection) {
  let creds: T.SmtpValue | null = null
  if (smtp.selection === 'system') {
    creds = await sdk.getSystemSmtp(effects).const()
    if (creds && smtp.value.customFrom) creds.from = smtp.value.customFrom
  } else if (smtp.selection === 'custom') {
    const { host, from, username, password, security } =
      smtp.value.provider.value
    creds = {
      host,
      port: Number(security.value.port),
      from,
      username,
      password: password ?? null,
      security: security.selection,
    }
  }
  if (!creds)
    return {
      enabled: false,
      options: {
        emailFrom: '',
        smtpHost: '',
        smtpPort: 587,
        secure: false,
        requireTls: false,
        ignoreTls: false,
        authUser: '',
        authPass: '',
        userEmailRequired: false,
      },
    }

  const named = creds.from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  return {
    enabled: true,
    options: {
      emailFrom: named ? named[2] : creds.from.trim(),
      ...(named?.[1] ? { senderName: named[1] } : {}),
      smtpHost: creds.host,
      smtpPort: creds.port,
      secure: creds.security === 'tls',
      requireTls: creds.security === 'starttls',
      ignoreTls: false,
      authUser: creds.username,
      authPass: creds.username ? (creds.password ?? '') : '',
      userEmailRequired: true,
    },
  }
}

// Dependent-only actions admit only a declared dependent; on success the store keeps it declared.
export async function withNtfyDeclared<R>(
  effects: T.Effects,
  fn: () => Promise<R>,
): Promise<R> {
  const previous = await effects.getDependencies()
  if (!previous.some((d) => d.id === NTFY_ID))
    await effects.setDependencies({
      dependencies: [
        ...previous,
        {
          id: NTFY_ID,
          kind: 'running',
          versionRange: ntfyVersionRange,
          healthChecks: [],
        },
      ],
    })
  try {
    return await fn()
  } catch (e) {
    await effects.setDependencies({ dependencies: previous })
    throw e
  }
}

export type NtfyAgent = {
  enabled: boolean
  types?: number
  options: Record<string, unknown>
}

export async function revokeNtfyPublisher(effects: T.Effects) {
  await sdk.action.run({
    effects,
    packageId: NTFY_ID,
    actionId: 'revoke-publisher',
    input: () => ({ username: `pkg_${sdk.manifest.id}` }),
  })
}
