import { DAVClient } from 'tsdav'

let client: DAVClient | null = null

export interface CalDAVConfig {
  serverUrl: string
  username: string
  password: string
}

/**
 * Returns a configured DAVClient singleton.
 *
 * We skip tsdav's automatic service discovery (login()) because it compares
 * hrefs from Radicale's PROPFIND XML responses against the proxy URL — the
 * hostnames differ, so urlContains() fails with "cannot find homeUrl".
 *
 * Instead we construct the account manually. Radicale's URL structure is
 * deterministic: /<username>/ is both the principal URL and the home set URL.
 */
export async function getClient(config: CalDAVConfig): Promise<DAVClient> {
  if (client) return client

  const { serverUrl, username, password } = config
  const base = serverUrl.replace(/\/$/, '')
  const homeUrl = `${base}/${username}/`

  client = new DAVClient({
    serverUrl: base,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  // Set auth headers and account directly, bypassing login() / service discovery.
  const basicAuth = `Basic ${btoa(`${username}:${password}`)}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any
  c.authHeaders = { Authorization: basicAuth }
  c.account = {
    serverUrl: base,
    rootUrl: `${base}/`,
    principalUrl: homeUrl,
    homeUrl,
    accountType: 'caldav',
    credentials: { username, password },
  }

  return client
}

/** Reset the singleton (useful for re-auth after credential change) */
export function resetClient(): void {
  client = null
}
