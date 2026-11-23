#!/usr/bin/env node

const path = require('path')
const { lstat, readdir } = require('fs').promises

const ONE_GIB = 1024n ** 3n
const EXCLUDED_DIRECTORIES = new Set(['target', 'dist', 'node_modules'])

const rootDirectory = path.resolve(process.argv[2] || process.cwd())
const largeDirectories = []

async function getDirectorySize(directory) {
  let entries

  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    console.warn(`Skipped ${directory}: ${error.message}`)
    return 0n
  }

  let totalSize = 0n

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue

      totalSize += await getDirectorySize(path.join(directory, entry.name))
      continue
    }

    const entryPath = path.join(directory, entry.name)

    try {
      // lstat does not follow symbolic links, so links cannot create cycles.
      const stats = await lstat(entryPath, { bigint: true })
      totalSize += stats.size
    } catch (error) {
      console.warn(`Skipped ${entryPath}: ${error.message}`)
    }
  }

  if (totalSize > ONE_GIB) {
    largeDirectories.push({ directory, size: totalSize })
  }

  return totalSize
}

function formatSize(bytes) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let value = Number(bytes)
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

async function main() {
  let rootStats

  try {
    rootStats = await lstat(rootDirectory)
  } catch (error) {
    console.error(`Cannot access ${rootDirectory}: ${error.message}`)
    process.exitCode = 1
    return
  }

  if (!rootStats.isDirectory()) {
    console.error(`Not a directory: ${rootDirectory}`)
    process.exitCode = 1
    return
  }

  await getDirectorySize(rootDirectory)
  largeDirectories.sort((a, b) => (a.size > b.size ? -1 : a.size < b.size ? 1 : 0))

  if (largeDirectories.length === 0) {
    console.log(`No directories larger than 1 GiB under ${rootDirectory}`)
    return
  }

  console.log(`Directories larger than 1 GiB under ${rootDirectory}:`)
  for (const { directory, size } of largeDirectories) {
    console.log(`${formatSize(size).padStart(10)}  ${directory}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
