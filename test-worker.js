addEventListener('fetch', event => {
  event.respondWith(new Response('Food delivery worker is alive!', {
    headers: { 'Content-Type': 'text/plain' }
  }))
})
