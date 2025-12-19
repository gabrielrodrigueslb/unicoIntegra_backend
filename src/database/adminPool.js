import { Pool } from "pg";

export const adminPool = new Pool({
    host: process.env.DBHOST,
    user: process.env.DBUSER,
    password:process.env.DBPASSWORD,
    database: process.env.DB_DATABASE || 'unico_integra',
    port:5432
})