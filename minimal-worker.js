addEventListener('fetch', event => {
  event.respondWith(new Response('Worker is alive!', {
    headers: { 'Content-Type': 'text/plain' }
  }))
})
