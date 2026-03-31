import { DAVClient } from 'tsdav'

let client: DAVClient | null = null

export interface CalDAVConfig {
  serverUrl: string
  username: string
  password: string
}

/**
 * Returns a configured, logged-in DAVClient singleton.
 * Reads credentials from the config passed in (sourced from env vars by the caller).
 */
export async function getClient(config: CalDAVConfig): Promise<DAVClient> {
  if (client) return client

  client = new DAVClient({
    serverUrl: config.serverUrl,
    credentials: {
      username: config.username,
      password: config.password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  await client.login()
  return client
}

/** Reset the singleton (useful for testing or re-auth) */
export function resetClient(): void {
  client = null
}
