import { execFileSync } from "node:child_process"
import path from "node:path"
import type { AnalyserJson } from "@specfy/stack-analyser"
import fs from "fs-extra"
import { getRepositoryString } from "./helpers"

const getRepoInfo = (url: string) => {
  const repo = getRepositoryString(url)

  const repoDir = path.join(process.cwd(), ".repositories", repo)
  const outputFile = path.join(`output-${repo.replace("/", "-")}.json`)

  return { repo, repoDir, outputFile }
}

const cloneRepository = async (repo: string, repoDir: string) => {
  console.time("Cloning repository")

  try {
    fs.ensureDirSync(repoDir)
    // execFileSync("bun", ["x", "tiged", `${repo}`, repoDir, "-f"])
    execFileSync("bun", ["x", "degit", `${repo}`, repoDir, "-f"])
  } catch (error) {
    console.error(`Error cloning ${repo}:`, error)
    throw new Error(`Error cloning ${repo}`)
  } finally {
    console.timeEnd("Cloning repository")
  }
}

const analyzeStack = async (repo: string, repoDir: string, outputFile: string) => {
  console.time("Analyzing stack")

  try {
    execFileSync("bun", ["x", "@specfy/stack-analyser", repoDir, "--flat", "-o", outputFile])
    const output = fs.readFileSync(outputFile, "utf-8")
    return JSON.parse(output) as AnalyserJson
  } catch (error) {
    console.error(`Error analyzing stack for ${repo}:`, error)
    throw error
  } finally {
    console.timeEnd("Analyzing stack")
  }
}

const cleanupDirectories = async (repo: string, repoDir: string, outputFile: string) => {
  console.time("Cleaning up directories")

  try {
    await fs.remove(repoDir)
    await fs.remove(outputFile)
  } catch (error) {
    console.error(`Cleanup error for ${repo}:`, error)
    throw error
  } finally {
    console.timeEnd("Cleaning up directories")
  }
}

export const analyzeRepositoryStack = async (url: string) => {
  const { repo, repoDir, outputFile } = getRepoInfo(url)

  try {
    // Clone repository
    await cloneRepository(repo, repoDir)

    // Get analysis
    const { childs } = await analyzeStack(repo, repoDir, outputFile)

    return [...new Set(childs.flatMap(({ techs }) => techs))]
  } finally {
    await cleanupDirectories(repo, repoDir, outputFile).catch(() => {})
  }
}
