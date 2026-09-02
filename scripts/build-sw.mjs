import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = new URL('../dist/', import.meta.url)

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else if (entry.isFile() && entry.name !== 'sw.js') files.push(full)
  }
  return files
}

const distPath = fileURLToPath(dist)
const files = (await walk(distPath)).sort()
const hash = createHash('sha256')
const urls = []

for (const file of files) {
  const rel = relative(distPath, file).split(sep).join('/')
  const contents = await readFile(file)
  hash.update(rel)
  hash.update(contents)
  urls.push(`./${rel}`)
}

const version = hash.digest('hex').slice(0, 16)
const cacheName = `gheymat-negar-${version}`
const source = `/* Generated at build time. Do not edit manually. */
const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_SHELL = ${JSON.stringify(urls, null, 2)};
const INDEX_URL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL.map(path => new URL(path, self.registration.scope).href));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('gheymat-negar-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        if (response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(INDEX_URL)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
`

await writeFile(new URL('../dist/sw.js', import.meta.url), source)
console.log(`service worker generated: ${cacheName} (${urls.length} assets)`)
