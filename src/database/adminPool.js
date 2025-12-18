import { Pool } from "pg";

export const adminPool = new Pool({
    host: process.env.DBHOST,
    user: process.env.DBUSER,
    password:process.env.DBPASSWORD,
    port:5432,
    database:'postgres'
})