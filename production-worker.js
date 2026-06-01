// Production Food Delivery Worker - Serves API + HTML
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const DB = env.DB;

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // API Routes
    if (path.startsWith('/api/')) {
      headers['Content-Type'] = 'application/json';
      
      // GET /api/restaurants/:slug
      if (path.match(/^\/api\/restaurants\/[^\/]+$/) && method === 'GET') {
        const slug = path.split('/').pop();
        const restaurant = await DB.prepare(
          'SELECT * FROM restaurants WHERE slug = ? AND is_active = 1'
        ).bind(slug).first();
        if (!restaurant) return new Response(JSON.stringify({ error: 'Restaurant not found' }), { status: 404, headers });
        return new Response(JSON.stringify(restaurant), { headers });
      }

      // POST /api/restaurants
      if (path === '/api/restaurants' && method === 'POST') {
        const { name, slug, phone, paybill, delivery_fee, free_delivery_threshold } = await request.json();
        const existing = await DB.prepare('SELECT id FROM restaurants WHERE slug = ?').bind(slug).first();
        if (existing) return new Response(JSON.stringify({ error: 'Restaurant ID already taken' }), { status: 400, headers });
        await DB.prepare(`INSERT INTO restaurants (id, name, slug, phone, paybill, delivery_fee, free_delivery_threshold, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(slug, name, slug, phone, paybill, delivery_fee || 150, free_delivery_threshold || 1000, Date.now()).run();
        return new Response(JSON.stringify({ success: true, slug }), { headers });
      }

      // GET /api/restaurants/:slug/menu
      if (path.match(/^\/api\/restaurants\/[^\/]+\/menu$/) && method === 'GET') {
        const slug = path.split('/')[3];
        const { results } = await DB.prepare(`SELECT id, item_name, item_description, price, category, is_available FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY display_order, item_name`)
          .bind(slug).all();
        return new Response(JSON.stringify(results), { headers });
      }

      // POST /api/menu-items
      if (path === '/api/menu-items' && method === 'POST') {
        const { restaurant_id, item_name, item_description, price, category } = await request.json();
        await DB.prepare(`INSERT INTO menu_items (restaurant_id, item_name, item_description, price, category, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(restaurant_id, item_name, item_description, price, category, Date.now()).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // DELETE /api/menu-items/:id
      if (path.match(/^\/api\/menu-items\/\d+$/) && method === 'DELETE') {
        await DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(path.split('/')[3]).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // PUT /api/menu-items/:id/toggle
      if (path.match(/^\/api\/menu-items\/\d+\/toggle$/) && method === 'PUT') {
        await DB.prepare('UPDATE menu_items SET is_available = NOT is_available, updated_at = ? WHERE id = ?')
          .bind(Date.now(), path.split('/')[3]).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // POST /api/orders
      if (path === '/api/orders' && method === 'POST') {
        const order = await request.json();
        await DB.prepare(`INSERT INTO orders (id, restaurant_id, customer_name, customer_phone, items, subtotal, delivery_fee, total, what3words, special_instructions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(order.orderId, order.restaurant_id, order.customer_name, order.customer_phone, JSON.stringify(order.items), order.subtotal, order.delivery_fee, order.total, order.what3words, order.special_instructions, Date.now()).run();
        return new Response(JSON.stringify({ success: true, orderId: order.orderId }), { headers });
      }

      // GET /api/restaurants/:slug/orders
      if (path.match(/^\/api\/restaurants\/[^\/]+\/orders$/) && method === 'GET') {
        const slug = path.split('/')[3];
        const { results } = await DB.prepare('SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC').bind(slug).all();
        const orders = results.map(o => ({ ...o, items: JSON.parse(o.items) }));
        return new Response(JSON.stringify(orders), { headers });
      }

      // PUT /api/orders/:id/status
      if (path.match(/^\/api\/orders\/[^\/]+\/status$/) && method === 'PUT') {
        const { status } = await request.json();
        await DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, path.split('/')[3]).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // PUT /api/orders/:id/payment
      if (path.match(/^\/api\/orders\/[^\/]+\/payment$/) && method === 'PUT') {
        await DB.prepare('UPDATE orders SET payment_confirmed = 1 WHERE id = ?').bind(path.split('/')[3]).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    // Serve HTML pages
    const HTML = {
      '/register.html': REGISTER_HTML,
      '/dashboard.html': DASHBOARD_HTML,
      '/restaurant.html': RESTAURANT_HTML,
    };

    if (HTML[path]) {
      return new Response(HTML[path], { headers: { 'Content-Type': 'text/html' } });
    }

    // Redirect root to register
    if (path === '/') {
      return new Response(null, {status: 302, headers: {Location: '/register.html'}});
    }

    return new Response('Not found', { status: 404 });
  }
};

const REGISTER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Register Restaurant</title>
<style>
body{font-family:sans-serif;background:#f5f5f5;padding:20px;margin:0}
.container{max-width:500px;margin:0 auto;background:white;border-radius:20px;padding:30px}
h1{font-size:24px;margin-bottom:8px}
input,button{width:100%;padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:8px}
button{background:#f97316;color:white;border:none;font-weight:bold;cursor:pointer}
.error{color:red;display:none}
.success{color:green;display:none}
</style>
</head>
<body>
<div class="container">
<h1>Register Your Restaurant</h1>
<form id="register-form">
<input type="text" id="name" placeholder="Restaurant Name" required>
<input type="text" id="slug" placeholder="Restaurant ID (e.g., joy-kitchen)" pattern="[a-z0-9-]+" required>
<input type="tel" id="phone" placeholder="Phone Number" required>
<input type="text" id="paybill" placeholder="M-Pesa Paybill">
<input type="number" id="delivery_fee" placeholder="Delivery Fee (KES)" value="150">
<input type="number" id="free_threshold" placeholder="Free Delivery Over (KES)" value="1000">
<button type="submit">Create Restaurant</button>
</form>
<div id="error" class="error"></div>
<div id="success" class="success"></div>
</div>
<script>
document.getElementById('register-form').addEventListener('submit', async (e) => {
e.preventDefault();
const data = {name:document.getElementById('name').value.trim(),slug:document.getElementById('slug').value.trim().toLowerCase(),phone:document.getElementById('phone').value.trim(),paybill:document.getElementById('paybill').value.trim(),delivery_fee:parseFloat(document.getElementById('delivery_fee').value),free_delivery_threshold:parseFloat(document.getElementById('free_threshold').value)};
try {
const res = await fetch('/api/restaurants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const result = await res.json();
if(res.ok){document.getElementById('success').innerText='Restaurant created! Redirecting...';document.getElementById('success').style.display='block';setTimeout(()=>window.location.href='/dashboard.html?restaurant='+data.slug,2000);}
else{document.getElementById('error').innerText=result.error;document.getElementById('error').style.display='block';}
}catch(err){document.getElementById('error').innerText='Network error';document.getElementById('error').style.display='block';}
});
</script>
</body>
</html>`;

const DASHBOARD_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard</title>
<style>
body{font-family:sans-serif;background:#f5f5f5;padding:20px;margin:0}
.container{max-width:800px;margin:0 auto}
.card{background:white;border-radius:12px;padding:20px;margin-bottom:20px}
button{background:#f97316;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer}
input,select{padding:8px;margin:5px;border:1px solid #ddd;border-radius:8px}
.menu-item{display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #eee}
.order-card{border:1px solid #eee;border-radius:8px;padding:12px;margin-bottom:12px}
.tab{display:inline-block;padding:10px 20px;background:white;border-radius:8px;margin-right:10px;cursor:pointer}
.tab.active{background:#f97316;color:white}
.tab-content{display:none}
.tab-content.active{display:block}
</style>
</head>
<body>
<div class="container">
<div class="card"><h1 id="restaurant-name">Loading...</h1></div>
<div><div class="tab active" onclick="showTab('menu')">Menu</div><div class="tab" onclick="showTab('orders')">Orders</div></div>
<div id="menu-tab" class="tab-content active">
<div class="card"><h2>Add Item</h2><input type="text" id="item-name" placeholder="Item name"><input type="text" id="item-desc" placeholder="Description"><input type="number" id="item-price" placeholder="Price"><button onclick="addItem()">Add</button></div>
<div class="card"><h2>Your Menu</h2><div id="menu-list"></div></div>
</div>
<div id="orders-tab" class="tab-content"><div class="card"><h2>Orders</h2><div id="orders-list"></div></div></div>
</div>
<script>
const slug=new URLSearchParams(location.search).get('restaurant');
if(!slug){location.href='/register.html'}
async function loadRestaurant(){const res=await fetch('/api/restaurants/'+slug);const data=await res.json();document.getElementById('restaurant-name').innerText=data.name;}
async function loadMenu(){const res=await fetch('/api/restaurants/'+slug+'/menu');const items=await res.json();document.getElementById('menu-list').innerHTML=items.map(i=>'<div class="menu-item"><div><b>'+i.item_name+'</b> KES '+i.price+'<br><small>'+(i.item_description||'')+'</small></div><div><button onclick="toggleItem('+i.id+')">'+(i.is_available?'Disable':'Enable')+'</button><button onclick="deleteItem('+i.id+')" style="background:#ff4444">Delete</button></div></div>').join('');}
async function addItem(){const name=document.getElementById('item-name').value;const desc=document.getElementById('item-desc').value;const price=parseFloat(document.getElementById('item-price').value);if(!name||!price)return alert('Name and price required');await fetch('/api/menu-items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({restaurant_id:slug,item_name:name,item_description:desc,price:price,category:'Main'})});document.getElementById('item-name').value='';document.getElementById('item-desc').value='';document.getElementById('item-price').value='';loadMenu();}
async function toggleItem(id){await fetch('/api/menu-items/'+id+'/toggle',{method:'PUT'});loadMenu();}
async function deleteItem(id){if(confirm('Delete?'))await fetch('/api/menu-items/'+id,{method:'DELETE'});loadMenu();}
async function loadOrders(){const res=await fetch('/api/restaurants/'+slug+'/orders');const orders=await res.json();document.getElementById('orders-list').innerHTML=orders.map(o=>'<div class="order-card"><b>'+o.customer_name+'</b> '+o.customer_phone+'<br>'+o.what3words+'<br>KES '+o.total+'<br>'+o.items.map(i=>i.item_name+' x'+i.quantity).join(', ')+'<br><div>'+(o.payment_confirmed?'':'<button onclick="confirmPayment(\''+o.id+'\')">Confirm Payment</button>')+(o.status==='pending'?'<button onclick="updateStatus(\''+o.id+'\',\'cooking\')">Start Cooking</button>':'')+'<a href="https://maps.google.com/?q=///'+o.what3words+'" target="_blank">Open Maps</a></div></div>').join('');}
async function confirmPayment(id){await fetch('/api/orders/'+id+'/payment',{method:'PUT'});loadOrders();}
async function updateStatus(id,status){await fetch('/api/orders/'+id+'/status',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});loadOrders();}
function showTab(tab){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));if(tab==='menu'){document.querySelector('.tab').classList.add('active');document.getElementById('menu-tab').classList.add('active');loadMenu();}else{document.querySelectorAll('.tab')[1].classList.add('active');document.getElementById('orders-tab').classList.add('active');loadOrders();}}
loadRestaurant();loadMenu();
setInterval(()=>{if(document.getElementById('orders-tab').classList.contains('active'))loadOrders();},10000);
</script>
</body>
</html>`;

const RESTAURANT_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Order Food</title>
<style>
body{font-family:sans-serif;background:#f5f5f5;margin:0;padding-bottom:100px}
.header{background:linear-gradient(135deg,#f9a826,#f97316);color:white;padding:24px;text-align:center}
.menu-section{padding:20px}
.menu-item{display:flex;justify-content:space-between;align-items:center;background:white;padding:16px;margin-bottom:12px;border-radius:12px}
.cart-section{position:fixed;bottom:0;left:0;right:0;background:white;border-radius:20px 20px 0 0;padding:20px;box-shadow:0 -4px 20px rgba(0,0,0,0.1);transform:translateY(100%);transition:transform 0.3s;z-index:100}
.cart-section.open{transform:translateY(0)}
.floating-cart{position:fixed;bottom:20px;right:20px;background:#f97316;color:white;width:56px;height:56px;border-radius:28px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.2);cursor:pointer;z-index:150}
button{background:#f9a826;border:none;padding:8px 16px;border-radius:25px;color:white;cursor:pointer}
.modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:200;padding:20px}
.modal-content{background:white;max-width:500px;margin:20px auto;padding:20px;border-radius:20px}
input,textarea{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:8px}
.close{float:right;font-size:28px;cursor:pointer}
</style>
</head>
<body>
<div class="header" id="header"><h1>Loading...</h1></div>
<div class="menu-section"><div id="menu"></div></div>
<div class="cart-section" id="cart-section"><div id="cart"></div><button onclick="showCheckout()">Checkout</button></div>
<div class="floating-cart" id="floating-cart" onclick="showCart()">🛒 <span id="cart-count">0</span></div>
<div class="modal" id="modal"><div class="modal-content"><span class="close" onclick="closeModal()">&times;</span><h2>Order Details</h2><div id="modal-content"></div></div></div>
<script>
const slug=new URLSearchParams(location.search).get('restaurant') || location.pathname.split('/').pop();
let cart=[],restaurant=null,menu=[];
async function loadRestaurant(){const res=await fetch('/api/restaurants/'+slug);restaurant=await res.json();document.getElementById('header').innerHTML='<h1>'+restaurant.name+'</h1><div>Free delivery over KES '+restaurant.free_delivery_threshold+'</div>';}
async function loadMenu(){const res=await fetch('/api/restaurants/'+slug+'/menu');menu=await res.json();document.getElementById('menu').innerHTML=menu.map(i=>'<div class="menu-item"><div><b>'+i.item_name+'</b><br>KES '+i.price+(i.item_description?'<br><small>'+i.item_description+'</small>':'')+'</div><button onclick="addToCart('+i.id+')">Add</button></div>').join('');}
function addToCart(id){const item=menu.find(i=>i.id===id);const existing=cart.find(i=>i.id===id);existing?existing.quantity++:cart.push({...item,quantity:1});updateCart();}
function updateCart(){const subtotal=cart.reduce((s,i)=>s+i.price*i.quantity,0);const delivery=subtotal>=restaurant.free_delivery_threshold?0:restaurant.delivery_fee;const total=subtotal+delivery;document.getElementById('cart-count').innerText=cart.reduce((s,i)=>s+i.quantity,0);document.getElementById('cart').innerHTML='<h3>Your Order</h3>'+cart.map(i=>'<div>'+i.item_name+' x'+i.quantity+' = KES '+(i.price*i.quantity)+'</div>').join('')+'<div>Delivery: KES '+delivery+'</div><div><b>Total: KES '+total+'</b></div>';if(cart.length===0)document.getElementById('floating-cart').style.display='none';else document.getElementById('floating-cart').style.display='flex';}
function showCart(){document.getElementById('cart-section').classList.add('open');}
function hideCart(){document.getElementById('cart-section').classList.remove('open');}
function showCheckout(){const subtotal=cart.reduce((s,i)=>s+i.price*i.quantity,0);const delivery=subtotal>=restaurant.free_delivery_threshold?0:restaurant.delivery_fee;const total=subtotal+delivery;document.getElementById('modal-content').innerHTML='<input type="text" id="cust-name" placeholder="Your Name"><input type="tel" id="cust-phone" placeholder="Phone Number"><input type="text" id="w3w" placeholder="what3words address (word.word.word)"><textarea id="instructions" placeholder="Special instructions"></textarea><div>Total: KES '+total+'</div><button onclick="placeOrder('+total+','+delivery+')">Place Order</button>';document.getElementById('modal').style.display='block';hideCart();}
async function placeOrder(total,delivery){const name=document.getElementById('cust-name').value;const phone=document.getElementById('cust-phone').value;const w3w=document.getElementById('w3w').value;if(!name||!phone||!w3w)return alert('Fill all fields');const orderId='ORD'+Date.now()+Math.floor(Math.random()*1000);const order={orderId,restaurant_id:slug,customer_name:name,customer_phone:phone,items:cart.map(i=>({item_name:i.item_name,quantity:i.quantity,price:i.price})),subtotal:cart.reduce((s,i)=>s+i.price*i.quantity,0),delivery_fee:delivery,total:total,what3words:w3w,special_instructions:document.getElementById('instructions').value};const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(order)});const result=await res.json();if(result.success){alert('Order placed!\\nOrder: '+orderId+'\\nTotal: KES '+total+'\\n\\nM-PESA Payment:\\nPaybill: '+(restaurant.paybill||'123456')+'\\nAccount: '+orderId);cart=[];updateCart();closeModal();}else alert('Order failed');}
function closeModal(){document.getElementById('modal').style.display='none';}
loadRestaurant();loadMenu();
</script>
</body>
</html>`;
