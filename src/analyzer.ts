import "@specfy/stack-analyser/dist/autoload.js"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { type AllowedKeys, analyser, FSProvider, flatten } from "@specfy/stack-analyser"
import { $ } from "execa"
import { getRepositoryString } from "./helpers"

const getRepoInfo = (url: string) => {
  const repo = getRepositoryString(url)
  const dir = path.join(os.tmpdir(), "stack-analyzer", repo)

  return { repo, dir }
}

const cloneRepository = async (repo: string, dir: string) => {
  const res = await $`git clone https://github.com/${repo}.git --depth 2 ${dir}`

  if (res.exitCode !== 0) {
    console.error(res.stderr)
    throw new Error(`Error cloning ${repo}`, { cause: res.stderr })
  }
}

export const analyzeRepositoryStack = async (url: string) => {
  const { repo, dir } = getRepoInfo(url)

  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {}

  try {
    console.info(`Cloning repository ${repo}`)

    await cloneRepository(repo, dir)

    console.log(`Analyzing stack for ${repo}`)

    const provider = new FSProvider({ path: dir })
    const payload = await analyser({ provider })
    const { techs, childs } = flatten(payload, { merge: true }).toJson()

    return [...new Set<AllowedKeys>([...techs, ...childs.flatMap(({ techs }) => techs)])]
  } catch (error) {
    console.error(`Error analyzing stack for ${repo}:`, error)
    throw error
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}
