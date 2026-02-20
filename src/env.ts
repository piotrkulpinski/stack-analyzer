import { z } from "zod"

export const env = () => {
  return z
    .object({
      NODE_ENV: z.string().default("development"),
      PORT: z.coerce.number().default(3000),
      API_KEY: z.string(),
      GITHUB_TOKEN: z.string(),
    })
    .parse(process.env)
}
