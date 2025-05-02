type Repository = {
  owner: string
  name: string
}

export const githubRegex =
  /^(?:https?:\/\/)?github\.com\/(?<owner>[^/]+)\/(?<name>[a-zA-Z0-9._-]+?)(?:[/?#]|$)/

/**
 * Extracts the repository owner and name from a GitHub URL.
 *
 * @param url The GitHub URL from which to extract the owner and name.
 * @returns An object containing the repository owner and name, or null if the URL is invalid.
 */
export const getRepository = (url: string): Repository => {
  const match = url.toLowerCase().match(githubRegex)

  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`)
  }

  return match.groups as Repository
}

/**
 * Returns the repository owner and name as a string.
 *
 * @param url The GitHub URL from which to extract the owner and name.
 * @returns The repository owner and name as a string.
 */
export const getRepositoryString = (url: string) => {
  const { owner, name } = getRepository(url)

  return `${owner}/${name}`
}
