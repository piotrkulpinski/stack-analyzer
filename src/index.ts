import { processBatchWithErrorHandling } from "@primoui/utils"
import { Hono } from "hono"
import { showRoutes } from "hono/dev"
import { logger } from "hono/logger"
import type { Row, RowList } from "postgres"
import { analyzeRepositoryStack } from "./analyzer"
import { sql } from "./db"
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

// Analyze a single repository
api.post("/analyze/single", async c => {
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

// Analyze all scheduled/published tools
api.post("/analyze", async c => {
  try {
    // Query tools with status 'Scheduled' or 'Published'
    const tools = await sql`
      SELECT id, name, "repositoryUrl" 
      FROM "Tool" 
      WHERE status IN ('Scheduled', 'Published') 
        AND "repositoryUrl" IS NOT NULL
      LIMIT 10
    `

    console.log(tools)

    const results: any[] = []

    // Processor to fetch data and update the tool
    const processor = async (tool: RowList<Row[]>[0]) => {
      try {
        console.log(`Analyzing ${tool.name} (${tool.repositoryUrl})`)

        // Analyze the repository
        let techs = await analyzeRepositoryStack(String(tool.repositoryUrl))
        techs = techs.filter(tech => tech !== "github")

        console.log(`Found techs for ${tool.name}:`, techs)

        // Get stack IDs that match the tech slugs
        const stacks = await sql`
              SELECT id, slug 
              FROM "Stack" 
              WHERE slug = ANY(${techs}::text[])
            `

        if (stacks.length > 0) {
          // Delete existing stack relationships for this tool
          await sql`
                DELETE FROM "_StackToTool" 
                WHERE "B" = ${tool.id}
              `

          // Insert new stack relationships
          const stackToolRelations = stacks.map(stack => ({
            A: stack.id,
            B: tool.id,
          }))

          if (stackToolRelations.length > 0) {
            await sql`
                  INSERT INTO "_StackToTool" ("A", "B")
                  VALUES ${sql(stackToolRelations.map(r => [r.A, r.B]))}
                `
          }

          results.push({
            tool: tool.name,
            repository: tool.repositoryUrl,
            techs: techs,
            stacksMatched: stacks.map(s => s.slug),
            status: "success",
          })
        }

        results.push({
          tool: tool.name,
          repository: tool.repositoryUrl,
          techs: techs,
          stacksMatched: [],
          status: "success",
          message: "No matching stacks found in database",
        })
      } catch (error) {
        console.error(`Error analyzing ${tool.name}:`, error)
        results.push({
          tool: tool.name,
          repository: tool.repositoryUrl,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Process tools in batches to not overload the server
    await processBatchWithErrorHandling(tools, processor, {
      batchSize: 3,
      onError: (error, tool) =>
        console.error(`Failed to process tool ${tool.slug}:`, error.message),
    })

    return c.json({
      totalTools: tools.length,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error("Database error:", error)
    return c.json(
      { error: "Database error", details: error instanceof Error ? error.message : String(error) },
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
