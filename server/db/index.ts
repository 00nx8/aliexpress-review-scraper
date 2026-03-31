import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>>

export function useDb() {
  if (!db) {
    const config = useRuntimeConfig()
    const client = postgres(config.databaseUrl as string)
    db = drizzle(client, { schema })
  }
  return db
}
