import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import pkg from '@prisma/client'
const { PrismaClient } = pkg


const connectionString = `${process.env.DATABASE_URL}`

// ponytail: pg's default pool max is 10. Import processing fires batches of
// parallel upserts (see PERSIST_PARALLEL_CHUNK in bancoUnicoImports.service.js)
// well above that, so requests queued for a free connection and blew past
// Postgres's own statement/lock timeout ("Operation has timed out"). Raise
// the ceiling to comfortably cover that batch size plus other concurrent
// queries; revisit if the DB's max_connections can't afford it.
const adapter = new PrismaPg({ connectionString, max: 20 })
const prisma = new PrismaClient({ adapter })

export { prisma }