import { rm } from 'node:fs/promises'

await Promise.all([
  rm(new URL('../dist', import.meta.url), { recursive: true, force: true }),
  rm(new URL('../tsconfig.app.tsbuildinfo', import.meta.url), { force: true }),
  rm(new URL('../tsconfig.node.tsbuildinfo', import.meta.url), { force: true }),
])
