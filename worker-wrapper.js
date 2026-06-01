// This wrapper makes ES module work with the API
export default {
  async fetch(request, env) {
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

    // Health check endpoint
    if (path === '/health' && method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        time: Date.now(),
        db_configured: typeof env.DB !== 'undefined'
      }), { headers });
    }

    // Test endpoint
    if (path === '/test' && method === 'GET') {
      return new Response(JSON.stringify({ 
        message: 'Worker is running',
        env_keys: Object.keys(env)
      }), { headers });
    }

    // GET /api/restaurants/:slug
    if (path.match(/^\/api\/restaurants\/[^\/]+$/) && method === 'GET') {
      const slug = path.split('/').pop();
      try {
        const restaurant = await env.DB.prepare(`
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

    // POST /api/restaurants
    if (path === '/api/restaurants' && method === 'POST') {
      try {
        const { name, slug, phone, paybill, delivery_fee, free_delivery_threshold } = await request.json();

        const existing = await env.DB.prepare(`SELECT id FROM restaurants WHERE slug = ?`).bind(slug).first();
        if (existing) {
          return new Response(JSON.stringify({ error: 'Restaurant ID already taken' }), { status: 400, headers });
        }

        await env.DB.prepare(`
          INSERT INTO restaurants (id, name, slug, phone, paybill, delivery_fee, free_delivery_threshold, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(slug, name, slug, phone, paybill, delivery_fee || 150, free_delivery_threshold || 1000, Date.now()).run();

        return new Response(JSON.stringify({ success: true, slug }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    // GET /api/restaurants/:slug/menu
    if (path.match(/^\/api\/restaurants\/[^\/]+\/menu$/) && method === 'GET') {
      const slug = path.split('/')[3];
      const { results } = await env.DB.prepare(`
        SELECT id, item_name, item_description, price, category, is_available
        FROM menu_items 
        WHERE restaurant_id = ? AND is_available = 1
        ORDER BY display_order, item_name
      `).bind(slug).all();
      return new Response(JSON.stringify(results), { headers });
    }

    // POST /api/menu-items
    if (path === '/api/menu-items' && method === 'POST') {
      const { restaurant_id, item_name, item_description, price, category } = await request.json();

      await env.DB.prepare(`
        INSERT INTO menu_items (restaurant_id, item_name, item_description, price, category, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(restaurant_id, item_name, item_description, price, category, Date.now()).run();

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // DELETE /api/menu-items/:id
    if (path.match(/^\/api\/menu-items\/\d+$/) && method === 'DELETE') {
      const id = path.split('/')[3];
      await env.DB.prepare(`DELETE FROM menu_items WHERE id = ?`).bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // PUT /api/menu-items/:id/toggle
    if (path.match(/^\/api\/menu-items\/\d+\/toggle$/) && method === 'PUT') {
      const id = path.split('/')[3];
      await env.DB.prepare(`
        UPDATE menu_items SET is_available = NOT is_available, updated_at = ? WHERE id = ?
      `).bind(Date.now(), id).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  }
};
