// Service Worker format (Compatible with direct API upload)
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // 1. HEALTH CHECK
  if (path === '/health' && method === 'GET') {
    return new Response(JSON.stringify({
      status: 'ok',
      time: Date.now(),
      db_configured: typeof DB !== 'undefined'
    }), { headers });
  }

  // 2. CREATE RESTAURANT (POST /api/restaurants)
  if (path === '/api/restaurants' && method === 'POST') {
    try {
      const { name, slug, phone, paybill, delivery_fee, free_delivery_threshold } = await request.json();

      // Check if restaurant exists
      const existing = await DB.prepare(`SELECT id FROM restaurants WHERE slug = ?`).bind(slug).first();
      if (existing) {
        return new Response(JSON.stringify({ error: 'Restaurant ID already taken' }), { status: 400, headers });
      }

      // Insert new restaurant
      await DB.prepare(`
        INSERT INTO restaurants (id, name, slug, phone, paybill, delivery_fee, free_delivery_threshold, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(slug, name, slug, phone, paybill, delivery_fee || 150, free_delivery_threshold || 1000, Date.now()).run();

      return new Response(JSON.stringify({ success: true, slug }), { headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }

  // 3. GET RESTAURANT (GET /api/restaurants/:slug)
  if (path.match(/^\/api\/restaurants\/[^\/]+$/) && method === 'GET') {
    const slug = path.split('/').pop();
    try {
      const restaurant = await DB.prepare(`
        SELECT * FROM restaurants WHERE slug = ? AND is_active = 1
      `).bind(slug).first();

      if (!restaurant) {
        return new Response(JSON.stringify({ error: 'Restaurant not found' }), { status: 404, headers });
      }
      return new Response(JSON.stringify(restaurant), { headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }

  // 4. DEFAULT 404
  return new Response(JSON.stringify({ error: 'Not found', path: path }), { status: 404, headers });
}
