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

        // GET /api/restaurants/:slug
        if (path.match(/^\/api\/restaurants\/[^\/]+$/) && method === 'GET') {
            const slug = path.split('/').pop();
            const restaurant = await env.DB.prepare(`
                SELECT * FROM restaurants WHERE slug = ? AND is_active = 1
            `).bind(slug).first();
            
            if (!restaurant) {
                return new Response(JSON.stringify({ error: 'Restaurant not found' }), { status: 404, headers });
            }
            return new Response(JSON.stringify(restaurant), { headers });
        }

        // POST /api/restaurants
        if (path === '/api/restaurants' && method === 'POST') {
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

        // POST /api/orders
        if (path === '/api/orders' && method === 'POST') {
            const order = await request.json();
            
            await env.DB.prepare(`
                INSERT INTO orders (
                    id, restaurant_id, customer_name, customer_phone, 
                    items, subtotal, delivery_fee, total, 
                    what3words, special_instructions, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                order.orderId, order.restaurant_id, order.customer_name, order.customer_phone,
                JSON.stringify(order.items), order.subtotal, order.delivery_fee, order.total,
                order.what3words, order.special_instructions, Date.now()
            ).run();
            
            return new Response(JSON.stringify({ success: true, orderId: order.orderId }), { headers });
        }

        // GET /api/restaurants/:slug/orders
        if (path.match(/^\/api\/restaurants\/[^\/]+\/orders$/) && method === 'GET') {
            const slug = path.split('/')[3];
            const { results } = await env.DB.prepare(`
                SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC
            `).bind(slug).all();
            
            const orders = results.map(order => ({
                ...order,
                items: JSON.parse(order.items)
            }));
            
            return new Response(JSON.stringify(orders), { headers });
        }

        // PUT /api/orders/:id/status
        if (path.match(/^\/api\/orders\/[^\/]+\/status$/) && method === 'PUT') {
            const orderId = path.split('/')[3];
            const { status } = await request.json();
            
            await env.DB.prepare(`UPDATE orders SET status = ? WHERE id = ?`).bind(status, orderId).run();
            return new Response(JSON.stringify({ success: true }), { headers });
        }

        // PUT /api/orders/:id/payment
        if (path.match(/^\/api\/orders\/[^\/]+\/payment$/) && method === 'PUT') {
            const orderId = path.split('/')[3];
            await env.DB.prepare(`UPDATE orders SET payment_confirmed = 1 WHERE id = ?`).bind(orderId).run();
            return new Response(JSON.stringify({ success: true }), { headers });
        }

        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }
};
