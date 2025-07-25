import postgres from "postgres"
import { env } from "./env"

const { DATABASE_URL } = env()

export const sql = postgres(DATABASE_URL)