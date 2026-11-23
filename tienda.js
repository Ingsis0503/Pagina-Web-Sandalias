// ==========================================
// DATOS INICIALES Y USUARIO ADMIN POR DEFECTO
// ==========================================
const DEFAULT_ADMIN = {
    id: 'admin-1',
    name: 'Administrador Tienda',
    email: 'admin@sandalias.com',
    password: 'admin123',
    phone: '3000000000',
    city: 'Sahagún, Córdoba',
    address: 'Taller Principal',
    role: 'admin'
};

// Imagen SVG liviana de ejemplo para catálogo inicial
const SAMPLE_IMG_1 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23fef3c7'/><text x='50%' y='48%' font-size='22' font-family='sans-serif' fill='%2392400e' text-anchor='middle'>Sandalia Plana Romana</text><text x='50%' y='60%' font-size='14' font-family='sans-serif' fill='%23b45309' text-anchor='middle'>(Sube tus fotos reales en Panel Admin)</text></svg>";
const SAMPLE_IMG_2 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23dbeafe'/><text x='50%' y='48%' font-size='22' font-family='sans-serif' fill='%231e40af' text-anchor='middle'>Sandalia Plataforma Casual</text><text x='50%' y='60%' font-size='14' font-family='sans-serif' fill='%232563eb' text-anchor='middle'>(Sube tus fotos reales en Panel Admin)</text></svg>";

let users = JSON.parse(localStorage.getItem('store_users')) || [DEFAULT_ADMIN];
if (!users.some(u => u.role === 'admin')) {
    users.unshift(DEFAULT_ADMIN);
}

let currentUser = JSON.parse(localStorage.getItem('store_currentUser')) || null;

let products = JSON.parse(localStorage.getItem('store_products')) || [
    {
        id: 'prod-1',
        name: 'Sandalia Romana Dorada',
        color: 'Dorado / Miel',
        price: 48000,
        sizes: ['35', '36', '37', '38', '39'],
        stock: 12,
        description: 'Suela antideslizante liviana, ideal para uso diario.',
        image: SAMPLE_IMG_1
    },
    {
        id: 'prod-2',
        name: 'Sandalia Plataforma Urbana',
        color: 'Negro',
        price: 62000,
        sizes: ['36', '37', '38', '40'],
        stock: 8,
        description: 'Plataforma cómoda de 4 cm con correa ajustable.',
        image: SAMPLE_IMG_2
    }
];

let storeOrders = JSON.parse(localStorage.getItem('store_orders')) || [];
let cart = JSON.parse(localStorage.getItem('store_cart')) || [];
let uploadedImageBase64 = '';

function saveStoreData() {
    localStorage.setItem('store_users', JSON.stringify(users));
    localStorage.setItem('store_currentUser', JSON.stringify(currentUser));
    localStorage.setItem('store_products', JSON.stringify(products));
    localStorage.setItem('store_orders', JSON.stringify(storeOrders));
    localStorage.setItem('store_cart', JSON.stringify(cart));
}

// ==========================================
// NAVEGACIÓN Y AUTENTICACIÓN
// ==========================================
function showSection(sectionName) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));

    document.getElementById(`section-${sectionName}`).classList.add('active');
    const navBtn = document.getElementById(`nav-${sectionName}`);
    if (navBtn) navBtn.classList.add('active');

    if (sectionName === 'mis-pedidos') renderClientOrders();
    if (sectionName === 'admin') {
        renderAdminProducts();
        renderAdminOrders();
    }
}

function updateAuthUI() {
    const authArea = document.getElementById('auth-area');
    const navMisPedidos = document.getElementById('nav-mis-pedidos');
    const navAdmin = document.getElementById('nav-admin');

    if (currentUser) {
        authArea.innerHTML = `
            <div class="user-pill">
                <span>👤 ${currentUser.name.split(' ')[0]}</span>
                <button class="logout-btn" onclick="logoutUser()">Salir</button>
            </div>
        `;
        navMisPedidos.style.display = 'inline-block';
        navAdmin.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
    } else {
        authArea.innerHTML = `<button class="btn-outline" onclick="openAuthModal()">Iniciar Sesión</button>`;
        navMisPedidos.style.display = 'none';
        navAdmin.style.display = 'none';
    }
}

function openAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function switchAuthMode(mode) {
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = mode === 'register' ? 'block' : 'none';
}

document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    const user = users.find(u => u.email.toLowerCase() === email && u.password === password);
    if (!user) {
        alert('Correo o contraseña incorrectos.');
        return;
    }

    currentUser = user;
    saveStoreData();
    updateAuthUI();
    closeAuthModal();
    this.reset();

    if (user.role === 'admin') {
        showSection('admin');
    }
});

document.getElementById('register-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();

    if (users.some(u => u.email.toLowerCase() === email)) {
        alert('Este correo ya está registrado. Inicia sesión.');
        return;
    }

    const newUser = {
        id: 'user-' + Date.now(),
        name: document.getElementById('reg-name').value.trim(),
        email,
        phone: document.getElementById('reg-phone').value.trim(),
        city: document.getElementById('reg-city').value.trim(),
        address: document.getElementById('reg-address').value.trim(),
        password: document.getElementById('reg-password').value,
        role: 'client'
    };

    users.push(newUser);
    currentUser = newUser;
    saveStoreData();
    updateAuthUI();
    closeAuthModal();
    this.reset();
    alert(`¡Bienvenido/a, ${newUser.name}! Tu cuenta y dirección han sido guardadas.`);
});

function logoutUser() {
    currentUser = null;
    saveStoreData();
    updateAuthUI();
    showSection('catalogo');
}

// ==========================================
// COMPRESIÓN Y SUBIDA DE IMÁGENES (ADMIN)
// ==========================================
function compressImage(file, maxWidth = 650, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

document.getElementById('prod-image-file').addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        uploadedImageBase64 = await compressImage(file);
        document.getElementById('image-preview').src = uploadedImageBase64;
        document.getElementById('image-preview-box').style.display = 'block';
    } catch (err) {
        alert('No se pudo procesar la imagen.');
    }
});

document.getElementById('product-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!uploadedImageBase64) {
        alert('Selecciona una imagen de la sandalia.');
        return;
    }

    const sizesArray = document.getElementById('prod-sizes').value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    const newProduct = {
        id: 'prod-' + Date.now(),
        name: document.getElementById('prod-name').value.trim(),
        color: document.getElementById('prod-color').value.trim(),
        price: parseFloat(document.getElementById('prod-price').value),
        sizes: sizesArray.length > 0 ? sizesArray : ['Única'],
        stock: parseInt(document.getElementById('prod-stock').value),
        description: document.getElementById('prod-desc').value.trim(),
        image: uploadedImageBase64
    };

    products.unshift(newProduct);
    saveStoreData();

    this.reset();
    uploadedImageBase64 = '';
    document.getElementById('image-preview-box').style.display = 'none';

    renderCatalog();
    renderAdminProducts();
    alert('¡Sandalia publicada en el catálogo!');
});

function deleteProduct(id) {
    if (confirm('¿Eliminar este producto del catálogo?')) {
        products = products.filter(p => p.id !== id);
        saveStoreData();
        renderCatalog();
        renderAdminProducts();
    }
}

function renderAdminProducts() {
    const container = document.getElementById('admin-products-list');
    if (products.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">No hay productos publicados.</p>';
        return;
    }

    container.innerHTML = products.map(p => `
        <div class="admin-prod-item">
            <div class="admin-prod-info">
                <img src="${p.image}" alt="${p.name}">
                <div>
                    <strong>${p.name}</strong> (${p.color})<br>
                    <small>$${p.price.toLocaleString()} | Tallas: ${p.sizes.join(', ')} | Stock: ${p.stock}</small>
                </div>
            </div>
            <button class="btn-danger" onclick="deleteProduct('${p.id}')">Eliminar</button>
        </div>
    `).join('');
}

// ==========================================
// CATÁLOGO PÚBLICO Y CARRITO
// ==========================================
function renderCatalog() {
    const grid = document.getElementById('catalog-grid');
    const search = document.getElementById('store-search').value.toLowerCase();
    const sizeFilter = document.getElementById('store-size-filter').value;

    const filtered = products.filter(p => {
        const matchText = p.name.toLowerCase().includes(search) || p.color.toLowerCase().includes(search);
        const matchSize = !sizeFilter || p.sizes.includes(sizeFilter);
        return matchText && matchSize;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:#64748b;">No se encontraron sandalias con ese filtro.</p>';
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="product-card">
            <div class="product-img-wrap">
                <img src="${p.image}" alt="${p.name}">
                <span class="stock-tag">${p.stock > 0 ? `Disp: ${p.stock}` : 'Agotado'}</span>
            </div>
            <div class="product-body">
                <div class="product-title">${p.name}</div>
                <div class="product-color">Color: ${p.color}</div>
                <p class="product-desc">${p.description || ''}</p>
                <div class="product-price">$${p.price.toLocaleString()}</div>
                <div class="product-controls">
                    <select id="size-select-${p.id}">
                        ${p.sizes.map(s => `<option value="${s}">Talla ${s}</option>`).join('')}
                    </select>
                    <button class="btn-primary" onclick="addToCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>
                        ${p.stock > 0 ? '+ Agregar' : 'Agotado'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

document.getElementById('store-search').addEventListener('input', renderCatalog);
document.getElementById('store-size-filter').addEventListener('change', renderCatalog);

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return;

    const selectedSize = document.getElementById(`size-select-${productId}`).value;
    const existing = cart.find(item => item.productId === productId && item.size === selectedSize);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            color: product.color,
            size: selectedSize,
            price: product.price,
            quantity: 1
        });
    }

    saveStoreData();
    updateCartBadge();
    alert(`Agregado: ${product.name} (Talla ${selectedSize})`);
}

function updateCartBadge() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = count;
}

function openCartModal() {
    if (!currentUser) {
        alert('Inicia sesión o crea una cuenta rápida para gestionar tu envío y hacer el pedido.');
        openAuthModal();
        return;
    }

    // Autocompletar datos guardados del cliente
    document.getElementById('ship-name').value = currentUser.name || '';
    document.getElementById('ship-phone').value = currentUser.phone || '';
    document.getElementById('ship-city').value = currentUser.city || '';
    document.getElementById('ship-address').value = currentUser.address || '';

    renderCartModal();
    document.getElementById('cart-modal').style.display = 'flex';
}

function closeCartModal() {
    document.getElementById('cart-modal').style.display = 'none';
}

function removeCartItem(index) {
    cart.splice(index, 1);
    saveStoreData();
    updateCartBadge();
    renderCartModal();
}

function getShippingCost() {
    const type = document.getElementById('ship-type').value;
    if (type === 'local') return 5000;
    if (type === 'nacional') return 14000;
    return 0;
}

function renderCartModal() {
    const box = document.getElementById('cart-modal-items');
    if (cart.length === 0) {
        box.innerHTML = '<p style="color:#64748b; text-align:center;">Tu carrito está vacío.</p>';
    } else {
        box.innerHTML = cart.map((item, idx) => `
            <div class="cart-row">
                <div>
                    <strong>${item.quantity}x ${item.name}</strong><br>
                    <small>Talla ${item.size} | ${item.color}</small>
                </div>
                <div>
                    <strong>$${(item.price * item.quantity).toLocaleString()}</strong>
                    <button class="btn-danger" style="margin-left:8px;" onclick="removeCartItem(${idx})">✕</button>
                </div>
            </div>
        `).join('');
    }

    const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const shipping = cart.length > 0 ? getShippingCost() : 0;
    const total = subtotal + shipping;

    document.getElementById('modal-subtotal').textContent = `$${subtotal.toLocaleString()}`;
    document.getElementById('modal-shipping').textContent = `$${shipping.toLocaleString()}`;
    document.getElementById('modal-total').textContent = `$${total.toLocaleString()}`;
}

// ==========================================
// CONFIRMAR PEDIDO Y PROCESO DE ENVÍO
// ==========================================
document.getElementById('checkout-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (cart.length === 0) {
        alert('Agrega al menos un par de sandalias antes de confirmar.');
        return;
    }

    const shipName = document.getElementById('ship-name').value.trim();
    const shipPhone = document.getElementById('ship-phone').value.trim();
    const shipType = document.getElementById('ship-type').options[document.getElementById('ship-type').selectedIndex].text;
    const shipCity = document.getElementById('ship-city').value.trim();
    const shipAddress = document.getElementById('ship-address').value.trim();
    const shipPayment = document.getElementById('ship-payment').value;
    const shipNotes = document.getElementById('ship-notes').value.trim();

    const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const shippingCost = getShippingCost();
    const total = subtotal + shippingCost;

    // Actualizar dirección guardada del usuario
    currentUser.phone = shipPhone;
    currentUser.city = shipCity;
    currentUser.address = shipAddress;
    const userIdx = users.findIndex(u => u.id === currentUser.id);
    if (userIdx !== -1) users[userIdx] = currentUser;

    // Descontar stock
    cart.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod) prod.stock = Math.max(0, prod.stock - item.quantity);
    });

    const newOrder = {
        orderId: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
        userId: currentUser.id,
        userEmail: currentUser.email,
        createdAt: new Date().toLocaleDateString('es-CO'),
        status: 'Recibido',
        items: [...cart],
        subtotal,
        shippingCost,
        total,
        shipping: {
            recipient: shipName,
            phone: shipPhone,
            method: shipType,
            city: shipCity,
            address: shipAddress,
            payment: shipPayment,
            notes: shipNotes
        }
    };

    storeOrders.unshift(newOrder);
    cart = [];
    saveStoreData();

    updateCartBadge();
    renderCatalog();
    closeCartModal();
    showSection('mis-pedidos');
    alert(`¡Pedido ${newOrder.orderId} confirmado! Puedes ver el estado de tu envío en "Mis Pedidos".`);
});

// ==========================================
// VISTAS DE PEDIDOS (CLIENTE Y ADMIN)
// ==========================================
function renderClientOrders() {
    const container = document.getElementById('client-orders-list');
    if (!currentUser) return;

    const myOrders = storeOrders.filter(o => o.userId === currentUser.id);
    if (myOrders.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">Aún no has realizado pedidos en la tienda.</p>';
        return;
    }

    container.innerHTML = myOrders.map(o => `
        <div class="order-box">
            <div class="order-top">
                <div>
                    <strong>Pedido #${o.orderId}</strong> • <small>Fecha: ${o.createdAt}</small>
                </div>
                <span class="status-badge st-${o.status}">${o.status}</span>
            </div>
            <div>
                ${o.items.map(i => `<div>• ${i.quantity}x ${i.name} (Talla ${i.size}, ${i.color}) - $${(i.price * i.quantity).toLocaleString()}</div>`).join('')}
            </div>
            <div class="shipping-box">
                <strong>🚚 Envío a:</strong> ${o.shipping.recipient} (${o.shipping.phone})<br>
                <strong>📍 Dirección:</strong> ${o.shipping.address} — ${o.shipping.city}<br>
                <strong>💳 Pago:</strong> ${o.shipping.payment} | <strong>Modalidad:</strong> ${o.shipping.method}
            </div>
            <div class="order-bottom">
                <strong>Total Pagado: $${o.total.toLocaleString()}</strong>
            </div>
        </div>
    `).join('');
}

function switchAdminTab(tab) {
    document.getElementById('pill-productos').classList.toggle('active', tab === 'productos');
    document.getElementById('pill-pedidos').classList.toggle('active', tab === 'pedidos');
    document.getElementById('admin-tab-productos').classList.toggle('active', tab === 'productos');
    document.getElementById('admin-tab-pedidos').classList.toggle('active', tab === 'pedidos');
}

function updateOrderStatus(orderId, newStatus) {
    const order = storeOrders.find(o => o.orderId === orderId);
    if (!order) return;
    order.status = newStatus;
    saveStoreData();
    renderAdminOrders();
}

function notifyClientWhatsApp(orderId) {
    const o = storeOrders.find(ord => ord.orderId === orderId);
    if (!o) return;

    const msg =
        `Hola *${o.shipping.recipient}*, te saludamos de *Sandalias Store* 👡.\n\n` +
        `Tu pedido *#${o.orderId}* ahora está en estado: *${o.status.toUpperCase()}*.\n` +
        `📍 *Destino:* ${o.shipping.address}, ${o.shipping.city}\n` +
        `💰 *Total:* $${o.total.toLocaleString()} (${o.shipping.payment})\n\n` +
        `¡Gracias por tu compra!`;

    let phone = o.shipping.phone.replace(/\D/g, '');
    if (phone.length === 10 && phone.startsWith('3')) phone = '57' + phone;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function renderAdminOrders() {
    document.getElementById('admin-orders-badge').textContent = storeOrders.length;
    const container = document.getElementById('admin-orders-list');

    if (storeOrders.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">Aún no hay pedidos de clientes.</p>';
        return;
    }

    container.innerHTML = storeOrders.map(o => `
        <div class="order-box">
            <div class="order-top">
                <div>
                    <strong>Pedido #${o.orderId}</strong> — Cliente: <strong>${o.shipping.recipient}</strong> (${o.userEmail})<br>
                    <small>Fecha: ${o.createdAt}</small>
                </div>
                <span class="status-badge st-${o.status}">${o.status}</span>
            </div>
            <div>
                ${o.items.map(i => `<div>• ${i.quantity}x ${i.name} (Talla ${i.size}, ${i.color}) — $${(i.price * i.quantity).toLocaleString()}</div>`).join('')}
            </div>
            <div class="shipping-box">
                <strong>📍 Dirección de entrega:</strong> ${o.shipping.address} (${o.shipping.city})<br>
                <strong>📞 Teléfono:</strong> ${o.shipping.phone} | <strong>🚚 Envío:</strong> ${o.shipping.method}<br>
                <strong>💳 Pago:</strong> ${o.shipping.payment} ${o.shipping.notes ? `| <strong>Nota:</strong> ${o.shipping.notes}` : ''}
            </div>
            <div class="order-bottom">
                <strong>Total: $${o.total.toLocaleString()}</strong>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <select onchange="updateOrderStatus('${o.orderId}', this.value)" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1;">
                        <option value="Recibido" ${o.status === 'Recibido' ? 'selected' : ''}>Estado: Recibido</option>
                        <option value="Preparando" ${o.status === 'Preparando' ? 'selected' : ''}>Estado: Preparando</option>
                        <option value="Enviado" ${o.status === 'Enviado' ? 'selected' : ''}>Estado: Enviado</option>
                        <option value="Entregado" ${o.status === 'Entregado' ? 'selected' : ''}>Estado: Entregado</option>
                    </select>
                    <button class="btn-whatsapp" onclick="notifyClientWhatsApp('${o.orderId}')">Avisar por WhatsApp</button>
                </div>
            </div>
        </div>
    `).join('');
}

// INICIALIZAR TIENDA
updateAuthUI();
updateCartBadge();
renderCatalog();