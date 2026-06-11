import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import dns from 'node:dns/promises'
import { Client } from 'pg'

const cwd = process.cwd()
const envFiles = ['.env.local', '.env']

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const raw = fs.readFileSync(filePath, 'utf8')

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)

    if (!match) continue

    const [, key, initialValue] = match

    if (process.env[key] !== undefined) continue

    let value = initialValue.trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

for (const envFile of envFiles) {
  loadEnvFile(path.join(cwd, envFile))
}

function getConnectionString() {
  return process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? null
}

function getConnectionHost(connectionString) {
  try {
    return new URL(connectionString).hostname
  } catch {
    return null
  }
}

function getPoolerCandidates(connectionString) {
  const host = getConnectionHost(connectionString)
  if (!host) return []

  const hostParts = host.split('.')
  const projectRef = hostParts[0] === 'db' ? hostParts[1] : hostParts[0]
  const dbPassword = new URL(connectionString).password
  const passwordCandidates = [dbPassword]
  const strippedPassword = dbPassword.replace(/^\[/, '').replace(/\]$/, '')
  if (strippedPassword !== dbPassword) {
    passwordCandidates.push(strippedPassword)
  }
  const baseUsernames = [`postgres.${projectRef}`, 'postgres']
  const regions = [
    'aws-0-eu-central-1.pooler.supabase.com',
    'aws-0-eu-west-2.pooler.supabase.com',
    'aws-0-us-east-1.pooler.supabase.com',
    'aws-0-us-east-2.pooler.supabase.com',
    'aws-0-ap-southeast-1.pooler.supabase.com',
  ]
  const ports = [5432, 6543]

  const candidates = []
  for (const region of regions) {
    for (const port of ports) {
      for (const username of baseUsernames) {
        for (const password of passwordCandidates) {
          candidates.push(
            `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${region}:${port}/postgres`,
          )
        }
      }
    }
  }

  return candidates
}

async function connectWithFallback(connectionString) {
  const primaryHost = getConnectionHost(connectionString) ?? ''
  const shouldTryFallbackPoolers = !primaryHost.includes('pooler.supabase.com')
  const attempts = shouldTryFallbackPoolers
    ? [connectionString, ...getPoolerCandidates(connectionString)]
    : [connectionString]
  let lastError = null

  for (const candidate of attempts) {
    const candidateHost = getConnectionHost(candidate) ?? 'unknown-host'
    const client = new Client({
      connectionString: candidate,
      ssl: candidate.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 6000,
    })

    try {
      await client.connect()
      console.log(`Connected via ${candidateHost}`)
      return client
    } catch (error) {
      lastError = error
      console.log(`Connection failed via ${candidateHost}: ${error instanceof Error ? error.message : error}`)
      try {
        await client.end()
      } catch {
        // ignore cleanup errors from failed connections
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Supabase connection attempts failed')
}

function getFileArgs(argv) {
  return argv.filter((arg) => !arg.startsWith('--'))
}

function printUsage() {
  console.log('Usage:')
  console.log('  npm run db:apply -- <sql-file> [more-sql-files]')
  console.log('  npm run db:ping')
  console.log('')
  console.log('Environment:')
  console.log('  SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require')
}

async function run() {
  const argv = process.argv.slice(2)
  const isPing = argv.includes('--ping')
  const sqlFiles = getFileArgs(argv)
  const connectionString = getConnectionString()

  if (!connectionString) {
    console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env.local/.env.')
    printUsage()
    process.exitCode = 1
    return
  }

  const host = getConnectionHost(connectionString)
  if (host) {
    try {
      const records = await dns.lookup(host, { all: true })
      const recordSummary = records.map((record) => `${record.family === 6 ? 'AAAA' : 'A'} ${record.address}`).join(', ')
      console.log(`Resolved ${host}: ${recordSummary}`)

      if (records.length > 0 && records.every((record) => record.family === 6)) {
        console.log('Note: the Supabase DB host is IPv6-only. This workspace still needs outbound IPv6 to reach PostgreSQL on port 5432.')
      }
    } catch (error) {
      console.log(`DNS lookup for ${host} failed before connect: ${error instanceof Error ? error.message : error}`)
    }
  }

  const client = await connectWithFallback(connectionString)

  try {
    const versionResult = await client.query('select current_database() as database, version() as version')
    const dbName = versionResult.rows[0]?.database ?? 'unknown'

    console.log(`Connected to database: ${dbName}`)

    if (isPing) {
      console.log('Database ping successful.')
      return
    }

    if (sqlFiles.length === 0) {
      console.error('No SQL files supplied.')
      printUsage()
      process.exitCode = 1
      return
    }

    for (const relativeFile of sqlFiles) {
      const fullPath = path.resolve(cwd, relativeFile)

      if (!fs.existsSync(fullPath)) {
        throw new Error(`SQL file not found: ${relativeFile}`)
      }

      console.log(`Applying ${relativeFile} ...`)
      const sql = fs.readFileSync(fullPath, 'utf8')
      await client.query(sql)
      console.log(`Applied ${relativeFile}`)
    }

    console.log('SQL apply complete.')
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error('SQL apply failed.')
  if (error instanceof Error) {
    console.error(error.message)
    if (error.message.includes('ENOTFOUND') || error.message.includes('EAI_AGAIN')) {
      console.error('The DB host resolves as IPv6-only, but this workspace cannot reach Supabase PostgreSQL over IPv6. Use a reachable pooler/IPv4 connection string or run the migration from a network that allows IPv6 to the Supabase DB host.')
    }
  } else {
    console.error(error)
  }
  process.exitCode = 1
})
