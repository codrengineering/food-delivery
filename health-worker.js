addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Simple health check
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      time: Date.now(),
      db_configured: typeof globalThis.DB !== 'undefined'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Otherwise, use your original handler
  return new Response(JSON.stringify({ error: 'Use /health' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
