import { Hono } from "hono"
import { showRoutes } from "hono/dev"
import { logger } from "hono/logger"
import { analyzeRepositoryStack } from "./analyzer"
import { env } from "./env"

const { NODE_ENV, PORT, API_KEY } = env()

const app = new Hono()
const api = new Hono()

app.use("/*", logger())
app.get("/", c => c.text("OpenAlternative Stack Analyzer API"))

// Auth middleware
api.use("*", async (c, next) => {
  const apiKey = c.req.header("X-API-Key")

  if (!apiKey || apiKey !== API_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  await next()
})

// Analyze a repository by URL
api.post("/analyze", async c => {
  try {
    const body = await c.req.json()
    const { repository } = body

    if (!repository) {
      return c.json({ error: "Repository URL is required" }, 400)
    }

    const result = await analyzeRepositoryStack(repository)
    return c.json(result)
  } catch (error) {
    console.error("Error analyzing repository:", error)
    return c.json(
      { error: "Analysis error", details: error instanceof Error ? error.message : String(error) },
      500,
    )
  }
})

app.route("/api", api)

if (NODE_ENV === "development") {
  showRoutes(app, { verbose: true, colorize: true })
}

const server = {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 255,
}

export default server
