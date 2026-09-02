export type ServiceWorkerState = 'unsupported' | 'dev' | 'installing' | 'ready' | 'error'

export async function registerAppServiceWorker(onState?: (state: ServiceWorkerState) => void) {
  if (!('serviceWorker' in navigator)) {
    onState?.('unsupported')
    return null
  }

  if (!import.meta.env.PROD) {
    onState?.('dev')
    return null
  }

  try {
    onState?.('installing')
    const url = new URL('./sw.js', window.location.href)
    const registration = await navigator.serviceWorker.register(url.href, { scope: './' })
    await navigator.serviceWorker.ready
    onState?.('ready')
    return registration
  } catch (error) {
    console.error('Service worker registration failed', error)
    onState?.('error')
    return null
  }
}
