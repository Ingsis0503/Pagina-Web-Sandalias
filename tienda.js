// ==========================================
// DATOS INICIALES, CONFIGURACIÓN Y MIGRACIÓN
// ==========================================
const DEFAULT_ADMIN = {
    id: 'admin-1',
    name: 'Administrador Principal',
    email: 'admin@sandalias.com',
    password: 'admin123',
    phone: '3000000000',
    city: 'Sahagún, Córdoba',
    address: 'Sede Principal',
    role: 'admin',
    blocked: false,
    emailVerified: true,
    registeredAt: 'Sistema Inicial',
    lastLogin: 'Activo',
    loginCount: 1
};

const DEFAULT_STORE_CONFIG = {
    name: 'Catálogo Oficial',
    tagline: 'Directo de fábrica • Envíos a todo Colombia',
    whatsapp: '3000000000',
    paymentInfo: '• Nequi: 300 000 0000\n• Nu Colombia: 300 000 0000\n• Bancolombia Ahorros: 000-000000-00\nPara confirmar tu pedido debes abonar mínimo el 50% del valor de los productos (sin envío) y subir el comprobante.',
    emailjsPublicKey: '',
    emailjsServiceId: '',
    emailjsTemplateId: ''
};

const SAMPLE_IMG_1 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23fef3c7'/><text x='50%' y='48%' font-size='21' font-family='sans-serif' fill='%2392400e' text-anchor='middle'>Sandalia Plana Romana</text><text x='50%' y='60%' font-size='13' font-family='sans-serif' fill='%23b45309' text-anchor='middle'>(Unitario y Mayorista 12+)</text></svg>";
const SAMPLE_IMG_2 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23dbeafe'/><text x='50%' y='48%' font-size='21' font-family='sans-serif' fill='%231e40af' text-anchor='middle'>Bolso Bandolera Casual</text><text x='50%' y='60%' font-size='13' font-family='sans-serif' fill='%232563eb' text-anchor='middle'>(Precio Unitario)</text></svg>";

let storeConfig = {
    ...DEFAULT_STORE_CONFIG,
    ...(JSON.parse(localStorage.getItem('store_config')) || {})
};

let users = JSON.parse(localStorage.getItem('store_users')) || [DEFAULT_ADMIN];
if (!users.some(u => u.role === 'admin')) {
    users.unshift(DEFAULT_ADMIN);
}

let blockedEmails = JSON.parse(localStorage.getItem('store_blocked_emails')) || [];
let currentUser = JSON.parse(localStorage.getItem('store_currentUser')) || null;

let rawProducts = JSON.parse(localStorage.getItem('store_products')) || [
    {
        id: 'prod-1',
        category: 'Calzado / Sandalias',
        name: 'Sandalia Romana Dorada',
        color: 'Dorado / Miel',
        price: 48000,
        wholesalePrice: 38000,
        variantMode: 'sizes',
        variants: ['35', '36', '37', '38', '39'],
        description: 'Suela antideslizante liviana, fabricación directa.',
        image: SAMPLE_IMG_1
    },
    {
        id: 'prod-2',
        category: 'Bolsos y Accesorios',
        name: 'Bolso Bandolera Casual',
        color: 'Azul / Negro',
        price: 55000,
        wholesalePrice: 55000,
        variantMode: 'none',
        variants: [],
        description: 'Material resistente con correa ajustable y cierre metálico.',
        image: SAMPLE_IMG_2
    }
];

let products = rawProducts.map(p => {
    const variants = Array.isArray(p.variants)
        ? p.variants
        : (Array.isArray(p.sizes) ? p.sizes : []);
    const variantMode = p.variantMode || (variants.length > 0 ? 'sizes' : 'none');
    const unitPrice = Number(p.price) || 0;
    const wholesalePrice = (typeof p.wholesalePrice === 'number' && p.wholesalePrice > 0)
        ? p.wholesalePrice
        : unitPrice;

    return {
        ...p,
        category: p.category || 'Calzado / Sandalias',
        color: p.color || '',
        price: unitPrice,
        wholesalePrice,
        variantMode,
        variants
    };
});

let storeOrders = JSON.parse(localStorage.getItem('store_orders')) || [];
let cart = [];
let uploadedImageBase64 = '';
let uploadedProofBase64 = '';
let editingProductId = null;

// Estado temporal para verificación OTP de 4 dígitos
let pendingRegistration = null;
let otpResendInterval = null;

// ==========================================
// CARRITO INDEPENDIENTE POR CUENTA
// ==========================================
function getCartStorageKey() {
    return currentUser ? `store_cart_${currentUser.id}` : 'store_cart_guest';
}

function loadCartForCurrentUser() {
    cart = JSON.parse(localStorage.getItem(getCartStorageKey())) || [];
}

function switchUserCart(user) {
    const guestCart = JSON.parse(localStorage.getItem('store_cart_guest')) || [];
    currentUser = user;
    const userCart = JSON.parse(localStorage.getItem(`store_cart_${user.id}`)) || [];

    guestCart.forEach(gItem => {
        const existing = userCart.find(
            uItem => uItem.productId === gItem.productId && (uItem.variant || '') === (gItem.variant || '')
        );
        if (existing) {
            existing.quantity += gItem.quantity;
        } else {
            userCart.push(gItem);
        }
    });

    localStorage.removeItem('store_cart_guest');
    cart = userCart;
}

function saveStoreData() {
    localStorage.setItem('store_config', JSON.stringify(storeConfig));
    localStorage.setItem('store_users', JSON.stringify(users));
    localStorage.setItem('store_blocked_emails', JSON.stringify(blockedEmails));
    localStorage.setItem('store_currentUser', JSON.stringify(currentUser));
    localStorage.setItem('store_products', JSON.stringify(products));
    localStorage.setItem('store_orders', JSON.stringify(storeOrders));
    localStorage.setItem(getCartStorageKey(), JSON.stringify(cart));
}

function isEmailBlocked(email) {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return false;
    const inBlockedList = blockedEmails.includes(clean);
    const userRecord = users.find(u => u.email.toLowerCase() === clean);
    return inBlockedList || Boolean(userRecord && userRecord.blocked);
}

function formatColombianPhone(rawPhone) {
    let digits = (rawPhone || '').replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('3')) {
        digits = '57' + digits;
    }
    return digits;
}

function applyStoreBranding() {
    document.getElementById('store-brand-name').textContent = storeConfig.name;
    document.getElementById('store-brand-tagline').textContent = storeConfig.tagline;
    document.title = `${storeConfig.name} | Catálogo Oficial`;

    const cfgName = document.getElementById('cfg-store-name');
    const cfgTag = document.getElementById('cfg-store-tagline');
    const cfgWa = document.getElementById('cfg-store-whatsapp');
    const cfgPay = document.getElementById('cfg-payment-info');
    const cfgKey = document.getElementById('cfg-emailjs-key');
    const cfgSvc = document.getElementById('cfg-emailjs-service');
    const cfgTpl = document.getElementById('cfg-emailjs-template');

    if (cfgName) cfgName.value = storeConfig.name;
    if (cfgTag) cfgTag.value = storeConfig.tagline;
    if (cfgWa) cfgWa.value = storeConfig.whatsapp || '';
    if (cfgPay) cfgPay.value = storeConfig.paymentInfo || '';
    if (cfgKey) cfgKey.value = storeConfig.emailjsPublicKey || '';
    if (cfgSvc) cfgSvc.value = storeConfig.emailjsServiceId || '';
    if (cfgTpl) cfgTpl.value = storeConfig.emailjsTemplateId || '';

    const waBtn = document.getElementById('whatsapp-float-btn');
    const ordersSupportBtn = document.getElementById('orders-support-wa-btn');
    const waPhone = formatColombianPhone(storeConfig.whatsapp);

    if (waBtn) {
        if (waPhone) {
            const greeting = `Hola *${storeConfig.name}*, vengo desde el catálogo web y me gustaría hacer una consulta.`;
            waBtn.href = `https://wa.me/${waPhone}?text=${encodeURIComponent(greeting)}`;
            waBtn.style.display = 'flex';
        } else {
            waBtn.style.display = 'none';
        }
    }

    if (ordersSupportBtn) {
        const supportMsg = `Hola *${storeConfig.name}*, quisiera consultar información sobre el estado de mi pedido.`;
        ordersSupportBtn.href = waPhone
            ? `https://wa.me/${waPhone}?text=${encodeURIComponent(supportMsg)}`
            : '#';
    }
}

const storeConfigForm = document.getElementById('store-config-form');
if (storeConfigForm) {
    storeConfigForm.addEventListener('submit', function (e) {
        e.preventDefault();
        storeConfig.name = document.getElementById('cfg-store-name').value.trim() || DEFAULT_STORE_CONFIG.name;
        storeConfig.tagline = document.getElementById('cfg-store-tagline').value.trim();
        storeConfig.whatsapp = document.getElementById('cfg-store-whatsapp').value.trim();
        const cfgPay = document.getElementById('cfg-payment-info');
        if (cfgPay) storeConfig.paymentInfo = cfgPay.value.trim();
        storeConfig.emailjsPublicKey = document.getElementById('cfg-emailjs-key').value.trim();
        storeConfig.emailjsServiceId = document.getElementById('cfg-emailjs-service').value.trim();
        storeConfig.emailjsTemplateId = document.getElementById('cfg-emailjs-template').value.trim();

        saveStoreData();
        applyStoreBranding();
        alert('Ajustes de la tienda, datos de pago, WhatsApp y correo guardados.');
    });
}

// ==========================================
// NAVEGACIÓN Y AUTENTICACIÓN CON OTP 4 DÍGITOS
// ==========================================
function showSection(sectionName) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));

    const target = document.getElementById(`section-${sectionName}`);
    if (target) target.classList.add('active');
    const navBtn = document.getElementById(`nav-${sectionName}`);
    if (navBtn) navBtn.classList.add('active');

    if (sectionName === 'mis-pedidos') renderClientOrders();
    if (sectionName === 'admin') {
        renderAdminProducts();
        renderAdminOrders();
        renderAdminClients();
    }
}

function validateActiveSession() {
    if (!currentUser) return;
    const freshUser = users.find(u => u.id === currentUser.id);
    if (!freshUser || isEmailBlocked(freshUser.email)) {
        currentUser = null;
        saveStoreData();
    } else {
        currentUser = freshUser;
    }
}

function updateAuthUI() {
    validateActiveSession();
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
    backToRegisterForm();
    switchAuthMode('login');
    const forgotBox = document.getElementById('forgot-password-box');
    if (forgotBox) forgotBox.style.display = 'none';
    document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    if (otpResendInterval) clearInterval(otpResendInterval);
}

function switchAuthMode(mode) {
    document.getElementById('auth-mode-tabs').style.display = 'flex';
    document.getElementById('verify-email-step').style.display = 'none';
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = mode === 'register' ? 'block' : 'none';
}

function toggleForgotPasswordBox() {
    const box = document.getElementById('forgot-password-box');
    if (!box) return;
    const isHidden = box.style.display === 'none';
    box.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
        const typedEmail = document.getElementById('login-email').value.trim();
        const forgotInput = document.getElementById('forgot-email-input');
        if (typedEmail) forgotInput.value = typedEmail;
        forgotInput.focus();
    }
}

function sendForgotPasswordWhatsApp() {
    const forgotInput = document.getElementById('forgot-email-input');
    const email = (
        (forgotInput ? forgotInput.value.trim() : '') ||
        document.getElementById('login-email').value.trim()
    ).toLowerCase();

    if (!email) {
        alert('Escribe tu correo electrónico para enviarlo al administrador.');
        if (forgotInput) forgotInput.focus();
        return;
    }

    const adminPhone = formatColombianPhone(storeConfig.whatsapp);
    if (!adminPhone) {
        alert('El administrador aún no ha configurado su número de WhatsApp.');
        return;
    }

    const msg = `Hola *${storeConfig.name}*, olvidé mi contraseña para ingresar a mi cuenta. Mi correo registrado es: *${email}*. ¿Me puedes ayudar por favor?`;
    window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`, '_blank');
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;

        if (isEmailBlocked(email)) {
            alert('🚫 Este correo o cuenta ha sido bloqueado por el administrador.');
            return;
        }

        const user = users.find(u => u.email.toLowerCase() === email && u.password === password);
        if (!user) {
            alert('Correo o contraseña incorrectos.');
            return;
        }

        user.lastLogin = new Date().toLocaleString('es-CO');
        user.loginCount = (user.loginCount || 0) + 1;

        switchUserCart(user);
        saveStoreData();
        updateAuthUI();
        updateCartBadge();
        closeAuthModal();
        this.reset();

        if (user.role === 'admin') {
            showSection('admin');
        }
    });
}

async function dispatchOtpEmail(email, name, code) {
    const noticeEl = document.getElementById('otp-status-notice');
    const hasEmailJS =
        storeConfig.emailjsPublicKey &&
        storeConfig.emailjsServiceId &&
        storeConfig.emailjsTemplateId;

    if (!hasEmailJS) {
        noticeEl.style.display = 'block';
        noticeEl.className = 'otp-notice warn';
        noticeEl.innerHTML = `⚙️ <strong>Modo prueba local:</strong> Aún no has configurado EmailJS en el Panel Admin.<br>Tu código de verificación es: <strong style="font-size:16px;">${code}</strong>`;
        return true;
    }

    try {
        noticeEl.style.display = 'block';
        noticeEl.className = 'otp-notice info';
        noticeEl.textContent = 'Enviando código de seguridad a tu correo...';

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: storeConfig.emailjsServiceId,
                template_id: storeConfig.emailjsTemplateId,
                user_id: storeConfig.emailjsPublicKey,
                template_params: {
                    to_email: email,
                    email: email,
                    to_name: name,
                    code: code,
                    passcode: code,
                    store_name: storeConfig.name
                }
            })
        });

        if (!response.ok) {
            throw new Error('Error en el servicio de correo');
        }

        noticeEl.className = 'otp-notice info';
        noticeEl.textContent = '✅ Código enviado. Revisa tu bandeja de entrada o carpeta de Spam.';
        return true;
    } catch (err) {
        noticeEl.style.display = 'block';
        noticeEl.className = 'otp-notice error';
        noticeEl.innerHTML = `⚠️ No se pudo conectar con EmailJS. Código temporal de respaldo: <strong>${code}</strong>`;
        return false;
    }
}

function startResendCooldown(seconds = 60) {
    if (otpResendInterval) clearInterval(otpResendInterval);
    const btn = document.getElementById('btn-resend-otp');
    let remaining = seconds;
    btn.disabled = true;
    btn.textContent = `Reenviar código (${remaining}s)`;

    otpResendInterval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(otpResendInterval);
            btn.disabled = false;
            btn.textContent = 'Reenviar código';
        } else {
            btn.textContent = `Reenviar código (${remaining}s)`;
        }
    }, 1000);
}

function clearOtpBoxes() {
    for (let i = 1; i <= 4; i++) {
        const box = document.getElementById(`otp-${i}`);
        if (box) box.value = '';
    }
    const firstBox = document.getElementById('otp-1');
    if (firstBox) firstBox.focus();
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = document.getElementById('reg-email').value.trim().toLowerCase();
        const name = document.getElementById('reg-name').value.trim();

        if (isEmailBlocked(email)) {
            alert('🚫 Este correo electrónico está bloqueado y no puede registrarse en la tienda.');
            return;
        }

        if (users.some(u => u.email.toLowerCase() === email)) {
            alert('Este correo ya está registrado. Inicia sesión.');
            return;
        }

        const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
        pendingRegistration = {
            userData: {
                name,
                email,
                phone: document.getElementById('reg-phone').value.trim(),
                city: document.getElementById('reg-city').value.trim(),
                address: document.getElementById('reg-address').value.trim(),
                password: document.getElementById('reg-password').value
            },
            code: generatedCode,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0
        };

        const sendBtn = document.getElementById('btn-send-otp');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Generando código...';

        document.getElementById('auth-mode-tabs').style.display = 'none';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('verify-email-step').style.display = 'block';
        document.getElementById('otp-target-email').textContent = email;

        await dispatchOtpEmail(email, name, generatedCode);
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar Código de Verificación';

        clearOtpBoxes();
        startResendCooldown(60);
    });
}

async function resendOtpCode() {
    if (!pendingRegistration) return;
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    pendingRegistration.code = newCode;
    pendingRegistration.expiresAt = Date.now() + 10 * 60 * 1000;
    pendingRegistration.attempts = 0;

    await dispatchOtpEmail(
        pendingRegistration.userData.email,
        pendingRegistration.userData.name,
        newCode
    );
    clearOtpBoxes();
    startResendCooldown(60);
}

function backToRegisterForm() {
    if (otpResendInterval) clearInterval(otpResendInterval);
    document.getElementById('verify-email-step').style.display = 'none';
    document.getElementById('auth-mode-tabs').style.display = 'flex';
    document.getElementById('register-form').style.display = 'block';
}

for (let i = 1; i <= 4; i++) {
    const box = document.getElementById(`otp-${i}`);
    if (!box) continue;

    box.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 1);
        if (this.value && i < 4) {
            document.getElementById(`otp-${i + 1}`).focus();
        }
    });

    box.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !this.value && i > 1) {
            document.getElementById(`otp-${i - 1}`).focus();
        }
    });

    box.addEventListener('paste', function (e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData)
            .getData('text')
            .replace(/\D/g, '')
            .slice(0, 4);
        pasted.split('').forEach((digit, idx) => {
            const target = document.getElementById(`otp-${idx + 1}`);
            if (target) target.value = digit;
        });
        const focusIdx = Math.min(4, Math.max(1, pasted.length));
        document.getElementById(`otp-${focusIdx}`).focus();
    });
}

const verifyOtpForm = document.getElementById('verify-otp-form');
if (verifyOtpForm) {
    verifyOtpForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!pendingRegistration) return;

        const enteredCode = [1, 2, 3, 4]
            .map(i => document.getElementById(`otp-${i}`).value.trim())
            .join('');

        if (enteredCode.length < 4) {
            alert('Ingresa los 4 dígitos del código.');
            return;
        }

        if (Date.now() > pendingRegistration.expiresAt) {
            alert('El código ha expirado. Haz clic en "Reenviar código" para recibir uno nuevo.');
            return;
        }

        if (pendingRegistration.attempts >= 5) {
            alert('Has superado el límite de intentos. Solicita un nuevo código.');
            return;
        }

        if (enteredCode !== pendingRegistration.code) {
            pendingRegistration.attempts += 1;
            const left = 5 - pendingRegistration.attempts;
            alert(`Código incorrecto. Te quedan ${left} intento(s).`);
            clearOtpBoxes();
            return;
        }

        const nowStr = new Date().toLocaleString('es-CO');
        const newUser = {
            id: 'user-' + Date.now(),
            ...pendingRegistration.userData,
            role: 'client',
            blocked: false,
            emailVerified: true,
            registeredAt: nowStr,
            lastLogin: nowStr,
            loginCount: 1
        };

        users.push(newUser);
        switchUserCart(newUser);
        pendingRegistration = null;
        saveStoreData();

        updateAuthUI();
        updateCartBadge();
        closeAuthModal();
        document.getElementById('register-form').reset();
        alert(`✅ ¡Correo verificado! Bienvenido/a, ${newUser.name}.`);
    });
}

function logoutUser() {
    if (currentUser) {
        localStorage.setItem(`store_cart_${currentUser.id}`, JSON.stringify(cart));
    }
    currentUser = null;
    loadCartForCurrentUser();
    saveStoreData();
    updateAuthUI();
    updateCartBadge();
    showSection('catalogo');
}

// ==========================================
// CONTROLES DEL FORMULARIO DE PRODUCTOS (ADMIN)
// ==========================================
function toggleCustomCategory() {
    const catSelect = document.getElementById('prod-category').value;
    const customBox = document.getElementById('custom-category-box');
    const customInput = document.getElementById('prod-custom-category');

    if (catSelect === 'CUSTOM') {
        customBox.style.display = 'block';
        customInput.required = true;
    } else {
        customBox.style.display = 'none';
        customInput.required = false;
    }
}

function toggleVariantMode() {
    const mode = document.getElementById('prod-variant-mode').value;
    const box = document.getElementById('variant-input-box');
    const presets = document.getElementById('variant-presets');
    const input = document.getElementById('prod-variants');

    if (mode === 'none') {
        box.style.display = 'none';
        input.required = false;
    } else {
        box.style.display = 'block';
        input.required = true;
        presets.style.display = mode === 'sizes' ? 'flex' : 'none';
        input.placeholder = mode === 'sizes'
            ? 'Ej: 35, 36, 37, 38, 39, 40'
            : 'Ej: Pequeño, Mediano, Grande o Unidad, Caja x6';
    }
}

function applyPreset(values) {
    document.getElementById('prod-variants').value = values;
}

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

const prodImgFile = document.getElementById('prod-image-file');
if (prodImgFile) {
    prodImgFile.addEventListener('change', async function (e) {
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
}

function editProduct(id) {
    const p = products.find(prod => prod.id === id);
    if (!p) return;

    editingProductId = id;
    document.getElementById('prod-form-title').textContent = 'Editar Producto';
    document.getElementById('btn-save-product').textContent = 'Guardar Cambios';
    document.getElementById('btn-cancel-product-edit').style.display = 'block';

    const catSelect = document.getElementById('prod-category');
    const optionExists = Array.from(catSelect.options).some(opt => opt.value === p.category);
    if (optionExists) {
        catSelect.value = p.category;
        toggleCustomCategory();
    } else {
        catSelect.value = 'CUSTOM';
        toggleCustomCategory();
        document.getElementById('prod-custom-category').value = p.category;
    }

    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-color').value = p.color || '';
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-wholesale-price').value = (p.wholesalePrice && p.wholesalePrice !== p.price) ? p.wholesalePrice : '';
    document.getElementById('prod-desc').value = p.description || '';

    document.getElementById('prod-variant-mode').value = p.variantMode || 'none';
    toggleVariantMode();
    document.getElementById('prod-variants').value = (p.variants || []).join(', ');

    uploadedImageBase64 = p.image;
    document.getElementById('image-preview').src = p.image;
    document.getElementById('image-preview-box').style.display = 'block';
    document.getElementById('prod-name').focus();
}

function resetProductForm() {
    editingProductId = null;
    document.getElementById('product-form').reset();
    document.getElementById('prod-form-title').textContent = 'Publicar Nuevo Producto';
    document.getElementById('btn-save-product').textContent = 'Publicar en el Catálogo';
    document.getElementById('btn-cancel-product-edit').style.display = 'none';
    document.getElementById('custom-category-box').style.display = 'none';
    document.getElementById('variant-input-box').style.display = 'none';
    document.getElementById('image-preview-box').style.display = 'none';
    uploadedImageBase64 = '';
}

const btnCancelProductEdit = document.getElementById('btn-cancel-product-edit');
if (btnCancelProductEdit) {
    btnCancelProductEdit.addEventListener('click', resetProductForm);
}

const productForm = document.getElementById('product-form');
if (productForm) {
    productForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!uploadedImageBase64) {
            alert('Selecciona una foto del producto.');
            return;
        }

        const catSelect = document.getElementById('prod-category').value;
        const category = catSelect === 'CUSTOM'
            ? document.getElementById('prod-custom-category').value.trim()
            : catSelect;

        const unitPrice = parseFloat(document.getElementById('prod-price').value);
        const rawWholesale = parseFloat(document.getElementById('prod-wholesale-price').value);
        const wholesalePrice = (!isNaN(rawWholesale) && rawWholesale > 0) ? rawWholesale : unitPrice;

        const variantMode = document.getElementById('prod-variant-mode').value;
        const variantsArray = variantMode === 'none'
            ? []
            : document.getElementById('prod-variants').value
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

        const productData = {
            category: category || 'General',
            name: document.getElementById('prod-name').value.trim(),
            color: document.getElementById('prod-color').value.trim(),
            price: unitPrice,
            wholesalePrice,
            variantMode,
            variants: variantsArray,
            description: document.getElementById('prod-desc').value.trim(),
            image: uploadedImageBase64
        };

        if (editingProductId) {
            const idx = products.findIndex(p => p.id === editingProductId);
            if (idx !== -1) {
                products[idx] = { ...products[idx], ...productData };
            }
            alert('¡Producto actualizado!');
        } else {
            products.unshift({
                id: 'prod-' + Date.now(),
                ...productData
            });
            alert('¡Producto publicado en el catálogo!');
        }

        saveStoreData();
        resetProductForm();
        refreshCategoriesUI();
        renderCatalog();
        renderAdminProducts();
    });
}

function deleteProduct(id) {
    if (confirm('¿Eliminar este producto del catálogo?')) {
        products = products.filter(p => p.id !== id);
        saveStoreData();
        refreshCategoriesUI();
        renderCatalog();
        renderAdminProducts();
    }
}

function renderAdminProducts() {
    const container = document.getElementById('admin-products-list');
    if (!container) return;
    if (products.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">No hay productos publicados.</p>';
        return;
    }

    container.innerHTML = products.map(p => {
        const variantSummary = p.variants && p.variants.length > 0
            ? ` | ${p.variantMode === 'sizes' ? 'Tallas' : 'Opciones'}: ${p.variants.join(', ')}`
            : ' | Producto único';
        const wholesaleText = (p.wholesalePrice && p.wholesalePrice < p.price)
            ? ` • Mayor: <strong>$${p.wholesalePrice.toLocaleString()}</strong>`
            : '';

        return `
            <div class="admin-prod-item">
                <div class="admin-prod-info">
                    <img src="${p.image}" alt="${p.name}">
                    <div>
                        <small style="color:#2563eb; font-weight:700;">${p.category}</small><br>
                        <strong>${p.name}</strong> ${p.color ? `(${p.color})` : ''}<br>
                        <small>Und: $${p.price.toLocaleString()}${wholesaleText}${variantSummary}</small>
                    </div>
                </div>
                <div class="admin-prod-actions">
                    <button class="btn-warning" onclick="editProduct('${p.id}')">Editar</button>
                    <button class="btn-danger" onclick="deleteProduct('${p.id}')">Eliminar</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// REGLA DE MAYORISTA POR DOCENA (SOLO SANDALIAS)
// ==========================================
function isSandalItem(itemOrProd) {
    const cat = (itemOrProd.category || '').toLowerCase();
    const name = (itemOrProd.name || '').toLowerCase();
    return cat.includes('sandalia') || cat.includes('calzado') || name.includes('sandalia') || name.includes('chancla');
}

function calculateCartBreakdown() {
    const enrichedItems = cart.map(item => {
        const liveProd = products.find(p => p.id === item.productId);
        const unitPrice = liveProd ? liveProd.price : (item.unitPrice || item.price);
        const wholesalePrice = liveProd ? (liveProd.wholesalePrice || unitPrice) : (item.wholesalePrice || unitPrice);
        const category = liveProd ? liveProd.category : (item.category || '');
        return {
            ...item,
            category,
            unitPrice,
            wholesalePrice
        };
    });

    const totalSandalPairs = enrichedItems.reduce((sum, item) => {
        return isSandalItem(item) ? sum + item.quantity : sum;
    }, 0);

    const qualifiesWholesale = totalSandalPairs >= 12;
    let subtotal = 0;
    let totalSavings = 0;

    const calculatedItems = enrichedItems.map(item => {
        const isSandal = isSandalItem(item);
        const hasDiscount = qualifiesWholesale && isSandal && item.wholesalePrice < item.unitPrice;
        const appliedPrice = hasDiscount ? item.wholesalePrice : item.unitPrice;
        const lineTotal = appliedPrice * item.quantity;
        const lineSavings = hasDiscount ? (item.unitPrice - item.wholesalePrice) * item.quantity : 0;

        subtotal += lineTotal;
        totalSavings += lineSavings;

        return {
            ...item,
            isSandal,
            appliedPrice,
            hasDiscount,
            lineTotal
        };
    });

    const minDeposit = Math.ceil(subtotal * 0.5);

    return {
        items: calculatedItems,
        totalSandalPairs,
        qualifiesWholesale,
        subtotal,
        minDeposit,
        totalSavings
    };
}

// ==========================================
// FILTROS DINÁMICOS Y CATÁLOGO PÚBLICO
// ==========================================
function refreshCategoriesUI() {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    const select = document.getElementById('store-category-filter');
    const pillsBox = document.getElementById('category-pills');
    if (!select || !pillsBox) return;
    const currentSelected = select.value;

    select.innerHTML = `<option value="">Todas las categorías (${products.length})</option>` +
        categories.map(c => `<option value="${c}" ${c === currentSelected ? 'selected' : ''}>${c}</option>`).join('');

    pillsBox.innerHTML = `
        <button class="cat-pill ${currentSelected === '' ? 'active' : ''}" onclick="selectCategoryFilter('')">Todos</button>
        ${categories.map(c => `
            <button class="cat-pill ${currentSelected === c ? 'active' : ''}" onclick="selectCategoryFilter('${c.replace(/'/g, "\\'")}')">${c}</button>
        `).join('')}
    `;
}

function selectCategoryFilter(category) {
    document.getElementById('store-category-filter').value = category;
    refreshCategoriesUI();
    renderCatalog();
}

function renderCatalog() {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;
    const search = document.getElementById('store-search').value.toLowerCase();
    const categoryFilter = document.getElementById('store-category-filter').value;

    const filtered = products.filter(p => {
        const matchText =
            p.name.toLowerCase().includes(search) ||
            (p.color && p.color.toLowerCase().includes(search)) ||
            (p.description && p.description.toLowerCase().includes(search)) ||
            p.category.toLowerCase().includes(search);
        const matchCat = !categoryFilter || p.category === categoryFilter;
        return matchText && matchCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:#64748b;">No se encontraron productos con ese criterio.</p>';
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const hasVariants = p.variants && p.variants.length > 0;
        const prefix = p.variantMode === 'sizes' ? 'Talla ' : '';
        const isSandal = isSandalItem(p);
        const showWholesaleBadge = isSandal && p.wholesalePrice && p.wholesalePrice < p.price;

        const variantSelectorHTML = hasVariants
            ? `<select id="variant-select-${p.id}">
                ${p.variants.map(v => `<option value="${v}">${prefix}${v}</option>`).join('')}
               </select>`
            : '';

        return `
            <div class="product-card">
                <div class="product-img-wrap">
                    <img src="${p.image}" alt="${p.name}">
                    <span class="category-badge">${p.category}</span>
                </div>
                <div class="product-body">
                    <div class="product-title">${p.name}</div>
                    ${p.color ? `<div class="product-color">Color / Estilo: ${p.color}</div>` : ''}
                    <p class="product-desc">${p.description || ''}</p>
                    <div class="price-block">
                        <div class="product-price">$${p.price.toLocaleString()} <small style="font-size:12px; font-weight:500; color:#64748b;">/ und</small></div>
                        ${showWholesaleBadge ? `<span class="wholesale-tag">Al mayor (12+ pares): $${p.wholesalePrice.toLocaleString()} c/u</span>` : ''}
                    </div>
                    <div class="product-controls">
                        ${variantSelectorHTML}
                        <input type="number" id="qty-input-${p.id}" class="qty-input ${!hasVariants ? 'qty-input-wide' : ''}" value="1" min="1" max="999" title="Cantidad">
                        <button class="btn-primary" style="${!hasVariants ? 'flex:1;' : ''}" onclick="addToCart('${p.id}')">+ Pedir</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

const storeSearchInput = document.getElementById('store-search');
if (storeSearchInput) {
    storeSearchInput.addEventListener('input', renderCatalog);
}

const storeCategorySelect = document.getElementById('store-category-filter');
if (storeCategorySelect) {
    storeCategorySelect.addEventListener('change', function () {
        refreshCategoriesUI();
        renderCatalog();
    });
}

// ==========================================
// CARRITO, ANTICIPO 50% Y COMPROBANTE DE PAGO
// ==========================================
function formatVariantLabel(item) {
    const parts = [];
    if (item.variant) {
        parts.push(item.variantMode === 'sizes' ? `Talla ${item.variant}` : item.variant);
    }
    if (item.color) {
        parts.push(item.color);
    }
    return parts.length > 0 ? `(${parts.join(' • ')})` : '';
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const variantEl = document.getElementById(`variant-select-${productId}`);
    const selectedVariant = variantEl ? variantEl.value : '';
    const qtyInput = document.getElementById(`qty-input-${productId}`);
    const quantity = Math.max(1, parseInt(qtyInput.value) || 1);

    const existing = cart.find(item => item.productId === productId && (item.variant || '') === selectedVariant);

    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({
            productId: product.id,
            category: product.category,
            name: product.name,
            color: product.color || '',
            variantMode: product.variantMode || 'none',
            variant: selectedVariant,
            unitPrice: product.price,
            wholesalePrice: product.wholesalePrice || product.price,
            quantity
        });
    }

    qtyInput.value = 1;
    saveStoreData();
    updateCartBadge();

    const detail = selectedVariant ? ` (${product.variantMode === 'sizes' ? 'Talla ' : ''}${selectedVariant})` : '';
    alert(`Agregado: ${quantity}x ${product.name}${detail}`);
}

function updateCartBadge() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = count;
}

function openCartModal() {
    if (!currentUser) {
        alert('Inicia sesión o crea una cuenta verificada para ingresar tu dirección y enviar el pedido.');
        openAuthModal();
        return;
    }

    document.getElementById('ship-name').value = currentUser.name || '';
    document.getElementById('ship-phone').value = currentUser.phone || '';
    document.getElementById('ship-city').value = currentUser.city || '';
    document.getElementById('ship-address').value = currentUser.address || '';

    const payBox = document.getElementById('checkout-payment-instructions');
    if (payBox) {
        payBox.textContent = storeConfig.paymentInfo || 'Comunícate por WhatsApp para solicitar los datos de transferencia.';
    }

    uploadedProofBase64 = '';
    const proofInput = document.getElementById('ship-payment-proof');
    if (proofInput) proofInput.value = '';
    const proofPreviewBox = document.getElementById('proof-preview-box');
    if (proofPreviewBox) proofPreviewBox.style.display = 'none';

    renderCartModal(true);
    document.getElementById('cart-modal').style.display = 'flex';
}

function closeCartModal() {
    document.getElementById('cart-modal').style.display = 'none';
}

function copyPaymentDetails() {
    const text = storeConfig.paymentInfo || '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        alert('Datos de pago copiados al portapapeles.');
    }).catch(() => {
        alert('Selecciona y copia los datos de pago mostrados en el recuadro.');
    });
}

const shipPaymentProofInput = document.getElementById('ship-payment-proof');
if (shipPaymentProofInput) {
    shipPaymentProofInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            uploadedProofBase64 = await compressImage(file, 700, 0.72);
            document.getElementById('proof-preview-img').src = uploadedProofBase64;
            document.getElementById('proof-preview-box').style.display = 'flex';
        } catch (err) {
            alert('No se pudo cargar la imagen del comprobante. Intenta con otra captura.');
        }
    });
}

function changeCartQty(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveStoreData();
    updateCartBadge();
    renderCartModal(true);
}

function removeCartItem(index) {
    cart.splice(index, 1);
    saveStoreData();
    updateCartBadge();
    renderCartModal(true);
}

function renderCartModal(syncDepositField = false) {
    const box = document.getElementById('cart-modal-items');
    const promoBanner = document.getElementById('wholesale-banner');
    const breakdown = calculateCartBreakdown();

    if (breakdown.totalSandalPairs > 0) {
        promoBanner.style.display = 'block';
        if (breakdown.qualifiesWholesale) {
            promoBanner.className = 'wholesale-banner active-promo';
            promoBanner.innerHTML = `🎉 <strong>¡Precio al mayor activado!</strong> Llevas ${breakdown.totalSandalPairs} pares de sandalias` +
                (breakdown.totalSavings > 0 ? ` (Ahorras <strong>$${breakdown.totalSavings.toLocaleString()}</strong>).` : '.');
        } else {
            const faltan = 12 - breakdown.totalSandalPairs;
            promoBanner.className = 'wholesale-banner hint-promo';
            promoBanner.innerHTML = `💡 Llevas <strong>${breakdown.totalSandalPairs} par(es)</strong> de sandalias. Agrega <strong>${faltan} par(es) más</strong> (iguales o surtidos) para activar precio al mayor.`;
        }
    } else {
        promoBanner.style.display = 'none';
    }

    if (breakdown.items.length === 0) {
        box.innerHTML = '<p style="color:#64748b; text-align:center;">Tu carrito está vacío.</p>';
    } else {
        box.innerHTML = breakdown.items.map((item, idx) => {
            const detail = formatVariantLabel(item);
            const priceHTML = item.hasDiscount
                ? `<span class="old-price">$${item.unitPrice.toLocaleString()}</span> <strong>$${item.appliedPrice.toLocaleString()} c/u</strong> <span class="wholesale-pill-mini">Mayorista</span>`
                : `$${item.appliedPrice.toLocaleString()} c/u`;

            return `
                <div class="cart-row">
                    <div>
                        <strong>${item.name}</strong> ${detail ? `<small>${detail}</small>` : ''}<br>
                        <small>${priceHTML}</small>
                    </div>
                    <div class="cart-qty-controls">
                        <button type="button" class="mini-btn" onclick="changeCartQty(${idx}, -1)">-</button>
                        <strong>${item.quantity}</strong>
                        <button type="button" class="mini-btn" onclick="changeCartQty(${idx}, 1)">+</button>
                        <strong style="margin-left:8px;">$${item.lineTotal.toLocaleString()}</strong>
                        <button type="button" class="btn-danger" style="margin-left:6px;" onclick="removeCartItem(${idx})">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    const shipType = document.getElementById('ship-type').value;
    const depositInput = document.getElementById('ship-deposit-amount');
    const minDepositEl = document.getElementById('modal-min-deposit');

    document.getElementById('modal-subtotal').textContent = `$${breakdown.subtotal.toLocaleString()}`;
    if (minDepositEl) minDepositEl.textContent = `$${breakdown.minDeposit.toLocaleString()}`;

    if (depositInput) {
        depositInput.min = breakdown.minDeposit;
        if (syncDepositField || !depositInput.value || Number(depositInput.value) < breakdown.minDeposit) {
            depositInput.value = breakdown.minDeposit;
        }
    }

    if (shipType === 'recoger') {
        document.getElementById('modal-shipping').textContent = 'Gratis (Recoge en punto)';
        document.getElementById('modal-total').textContent = `$${breakdown.subtotal.toLocaleString()}`;
    } else {
        document.getElementById('modal-shipping').textContent = 'Por cotizar según dirección';
        document.getElementById('modal-total').textContent = `$${breakdown.subtotal.toLocaleString()} + envío`;
    }
}

// ==========================================
// CONFIRMAR PEDIDO CON VALIDACIÓN DE ANTICIPO 50% Y COMPROBANTE
// ==========================================
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (cart.length === 0) {
            alert('Agrega al menos un producto antes de enviar el pedido.');
            return;
        }

        const breakdown = calculateCartBreakdown();
        const depositInput = document.getElementById('ship-deposit-amount');
        const depositPaid = depositInput ? parseFloat(depositInput.value) : breakdown.minDeposit;

        if (isNaN(depositPaid) || depositPaid < breakdown.minDeposit) {
            alert(`Para realizar el pedido debes abonar por lo menos el 50% del valor de los productos sin envío ($${breakdown.minDeposit.toLocaleString()}).`);
            if (depositInput) depositInput.focus();
            return;
        }

        if (!uploadedProofBase64) {
            alert('Por favor sube la imagen o captura del comprobante de pago.');
            const proofInput = document.getElementById('ship-payment-proof');
            if (proofInput) proofInput.focus();
            return;
        }

        const shipName = document.getElementById('ship-name').value.trim();
        const shipPhone = document.getElementById('ship-phone').value.trim();
        const shipTypeVal = document.getElementById('ship-type').value;
        const shipTypeText = document.getElementById('ship-type').options[document.getElementById('ship-type').selectedIndex].text;
        const shipCity = document.getElementById('ship-city').value.trim();
        const shipAddress = document.getElementById('ship-address').value.trim();
        const shipPayment = document.getElementById('ship-payment').value;
        const shipNotes = document.getElementById('ship-notes').value.trim();

        const isPickup = shipTypeVal === 'recoger';
        const remainingProductsBalance = Math.max(0, breakdown.subtotal - depositPaid);

        currentUser.phone = shipPhone;
        currentUser.city = shipCity;
        currentUser.address = shipAddress;
        const userIdx = users.findIndex(u => u.id === currentUser.id);
        if (userIdx !== -1) users[userIdx] = currentUser;

        const orderItems = breakdown.items.map(i => ({
            productId: i.productId,
            category: i.category,
            name: i.name,
            color: i.color,
            variantMode: i.variantMode,
            variant: i.variant,
            price: i.appliedPrice,
            unitPrice: i.unitPrice,
            wholesaleApplied: i.hasDiscount,
            quantity: i.quantity
        }));

        const newOrder = {
            orderId: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
            userId: currentUser.id,
            userEmail: currentUser.email,
            createdAt: new Date().toLocaleDateString('es-CO'),
            status: isPickup ? 'Confirmado' : 'Por cotizar envío',
            items: orderItems,
            subtotal: breakdown.subtotal,
            totalSavings: breakdown.totalSavings,
            depositAmount: depositPaid,
            remainingBalance: remainingProductsBalance,
            paymentVerified: false,
            paymentProof: uploadedProofBase64,
            shippingCost: isPickup ? 0 : null,
            total: breakdown.subtotal,
            shipping: {
                recipient: shipName,
                phone: shipPhone,
                method: shipTypeText,
                city: shipCity,
                address: shipAddress,
                payment: shipPayment,
                notes: shipNotes
            }
        };

        storeOrders.unshift(newOrder);
        cart = [];
        uploadedProofBase64 = '';
        saveStoreData();

        updateCartBadge();
        closeCartModal();
        showSection('mis-pedidos');
        alert(`¡Pedido #${newOrder.orderId} registrado con tu comprobante! Recuerda que la fabricación y entrega tarda entre 8 y 15 días hábiles.`);
    });
}

// ==========================================
// VISOR DE COMPROBANTES DE PAGO
// ==========================================
function openProofModal(orderId) {
    const order = storeOrders.find(o => o.orderId === orderId);
    if (!order || !order.paymentProof) return;

    document.getElementById('proof-modal-title').textContent = `Comprobante • Pedido #${order.orderId} ($${(order.depositAmount || 0).toLocaleString()})`;
    document.getElementById('proof-modal-full-img').src = order.paymentProof;
    document.getElementById('proof-viewer-modal').style.display = 'flex';
}

function closeProofModal() {
    document.getElementById('proof-viewer-modal').style.display = 'none';
}

// ==========================================
// VISTAS DE PEDIDOS (CLIENTE Y ADMIN)
// ==========================================
function getStatusBadgeClass(status) {
    if (status === 'Por cotizar envío') return 'st-cotizar';
    if (status === 'Confirmado') return 'st-confirmado';
    if (status === 'En preparación') return 'st-fabricacion';
    if (status === 'Enviado') return 'st-enviado';
    return 'st-entregado';
}

function renderClientOrders() {
    const container = document.getElementById('client-orders-list');
    if (!container || !currentUser) return;

    const myOrders = storeOrders.filter(o => o.userId === currentUser.id);
    if (myOrders.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">Aún no has realizado pedidos en la tienda.</p>';
        return;
    }

    const adminWaPhone = formatColombianPhone(storeConfig.whatsapp);

    container.innerHTML = myOrders.map(o => {
        const hasShippingQuote = o.shippingCost !== null && o.shippingCost !== undefined;
        const depositPaid = Number(o.depositAmount) || 0;
        const pendingTotal = hasShippingQuote
            ? Math.max(0, o.total - depositPaid)
            : Math.max(0, o.subtotal - depositPaid);

        const shippingText = hasShippingQuote
            ? (o.shippingCost === 0 ? '$0 (Recoge en punto)' : `$${o.shippingCost.toLocaleString()}`)
            : 'Pendiente por cotizar según dirección';

        const pendingText = hasShippingQuote
            ? `$${pendingTotal.toLocaleString()}`
            : `$${pendingTotal.toLocaleString()} (+ envío por confirmar)`;

        const orderWaMsg = `Hola *${storeConfig.name}*, quisiera saber más información sobre mi pedido *#${o.orderId}*.`;
        const orderWaHref = adminWaPhone ? `https://wa.me/${adminWaPhone}?text=${encodeURIComponent(orderWaMsg)}` : '#';

        return `
            <div class="order-box">
                <div class="order-top">
                    <div>
                        <strong>Pedido #${o.orderId}</strong> • <small>Fecha: ${o.createdAt}</small>
                    </div>
                    <span class="status-badge ${getStatusBadgeClass(o.status)}">${o.status}</span>
                </div>
                <div>
                    ${o.items.map(i => `
                        <div>
                            • ${i.quantity}x <strong>${i.name}</strong> ${formatVariantLabel(i)} — $${(i.price * i.quantity).toLocaleString()}
                            ${i.wholesaleApplied ? `<span class="wholesale-pill-mini">Precio al mayor</span>` : ''}
                        </div>
                    `).join('')}
                </div>

                <div class="payment-record-box">
                    <div>
                        💳 <strong>Abono enviado (${o.shipping.payment}):</strong> $${depositPaid.toLocaleString()}
                        ${o.paymentVerified
                            ? `<span class="verified-badge" style="margin-left:6px;">✓ Abono Verificado</span>`
                            : `<span class="info-pill" style="margin-left:6px;">En revisión</span>`}
                    </div>
                    ${o.paymentProof ? `
                        <button type="button" class="proof-thumb-btn" onclick="openProofModal('${o.orderId}')">
                            <img src="${o.paymentProof}" alt="Comprobante"> Ver Comprobante
                        </button>
                    ` : ''}
                </div>

                <div class="shipping-box">
                    <strong>🚚 Recibe:</strong> ${o.shipping.recipient} (${o.shipping.phone})<br>
                    <strong>📍 Dirección:</strong> ${o.shipping.address} — ${o.shipping.city}<br>
                    <strong>📦 Modalidad:</strong> ${o.shipping.method}
                </div>

                <div class="order-delivery-note">
                    <span>⏱️ Tu pedido tarda entre <strong>8 y 15 días hábiles</strong>. ¿Quieres más info?</span>
                    <a class="btn-whatsapp" href="${orderWaHref}" target="_blank" rel="noopener noreferrer">Escribir al WhatsApp</a>
                </div>

                <div class="order-bottom">
                    <div class="totals-summary">
                        <div>Subtotal productos: <strong>$${o.subtotal.toLocaleString()}</strong> | Abonado: <strong style="color:#047857;">$${depositPaid.toLocaleString()}</strong></div>
                        <div>Costo de envío: <strong>${shippingText}</strong></div>
                        <div style="color:#2563eb; font-size:15px;">Saldo pendiente: <strong>${pendingText}</strong></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function switchAdminTab(tab) {
    document.getElementById('pill-productos').classList.toggle('active', tab === 'productos');
    document.getElementById('pill-pedidos').classList.toggle('active', tab === 'pedidos');
    document.getElementById('pill-clientes').classList.toggle('active', tab === 'clientes');

    document.getElementById('admin-tab-productos').classList.toggle('active', tab === 'productos');
    document.getElementById('admin-tab-pedidos').classList.toggle('active', tab === 'pedidos');
    document.getElementById('admin-tab-clientes').classList.toggle('active', tab === 'clientes');

    if (tab === 'clientes') renderAdminClients();
    if (tab === 'pedidos') renderAdminOrders();
}

function toggleOrderPaymentVerified(orderId) {
    const order = storeOrders.find(o => o.orderId === orderId);
    if (!order) return;
    order.paymentVerified = !order.paymentVerified;
    saveStoreData();
    renderAdminOrders();
}

function setOrderShipping(orderId) {
    const order = storeOrders.find(o => o.orderId === orderId);
    if (!order) return;

    const input = document.getElementById(`quote-ship-${orderId}`);
    const shippingVal = parseFloat(input.value);

    if (isNaN(shippingVal) || shippingVal < 0) {
        alert('Ingresa un valor válido para el envío (puede ser 0 si es gratis).');
        return;
    }

    order.shippingCost = shippingVal;
    order.total = order.subtotal + shippingVal;
    if (order.status === 'Por cotizar envío') {
        order.status = 'Confirmado';
    }

    saveStoreData();
    renderAdminOrders();
    alert(`Envío asignado: $${shippingVal.toLocaleString()}. Total actualizado a $${order.total.toLocaleString()}.`);
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

    const detalleProductos = o.items
        .map(i => `• ${i.quantity}x ${i.name} ${formatVariantLabel(i)}${i.wholesaleApplied ? ' [Mayorista]' : ''} - $${(i.price * i.quantity).toLocaleString()}`)
        .join('\n');

    const depositPaid = Number(o.depositAmount) || 0;
    const hasShipping = o.shippingCost !== null && o.shippingCost !== undefined;
    const pendingBalance = hasShipping
        ? Math.max(0, o.total - depositPaid)
        : Math.max(0, o.subtotal - depositPaid);

    const bloqueTotales = hasShipping
        ? `💵 *Subtotal productos:* $${o.subtotal.toLocaleString()}\n🚚 *Valor envío:* $${o.shippingCost.toLocaleString()}\n✅ *Anticipo abonado:* $${depositPaid.toLocaleString()}\n💰 *SALDO PENDIENTE:* $${pendingBalance.toLocaleString()}`
        : `💵 *Subtotal productos:* $${o.subtotal.toLocaleString()}\n✅ *Anticipo abonado:* $${depositPaid.toLocaleString()}\n🚚 *Valor envío:* Pendiente por confirmar\n💰 *SALDO PENDIENTE:* $${pendingBalance.toLocaleString()} + envío`;

    const msg =
        `Hola *${o.shipping.recipient}*, te escribimos de *${storeConfig.name}*.\n\n` +
        `Hemos recibido tu pedido *#${o.orderId}*:\n${detalleProductos}\n\n` +
        `📍 *Dirección de envío:* ${o.shipping.address} (${o.shipping.city})\n` +
        `📌 *Estado:* ${o.status.toUpperCase()}\n\n` +
        `${bloqueTotales}\n` +
        `💳 *Medio de pago:* ${o.shipping.payment}\n` +
        `⏱️ *Tiempo estimado de entrega:* 8 a 15 días hábiles.\n\n` +
        `Quedamos atentos para cualquier inquietud.`;

    const phone = formatColombianPhone(o.shipping.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function renderAdminOrders() {
    const badge = document.getElementById('admin-orders-badge');
    if (badge) badge.textContent = storeOrders.length;
    const container = document.getElementById('admin-orders-list');
    if (!container) return;

    if (storeOrders.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">Aún no hay pedidos de clientes.</p>';
        return;
    }

    container.innerHTML = storeOrders.map(o => {
        const hasShipping = o.shippingCost !== null && o.shippingCost !== undefined;
        const depositPaid = Number(o.depositAmount) || 0;
        const pendingTotal = hasShipping
            ? Math.max(0, o.total - depositPaid)
            : Math.max(0, o.subtotal - depositPaid);

        const shippingDisplay = hasShipping ? `$${o.shippingCost.toLocaleString()}` : 'Sin asignar';
        const pendingDisplay = hasShipping ? `$${pendingTotal.toLocaleString()}` : `$${pendingTotal.toLocaleString()} (+ envío)`;

        return `
            <div class="order-box">
                <div class="order-top">
                    <div>
                        <strong>Pedido #${o.orderId}</strong> — Cliente: <strong>${o.shipping.recipient}</strong> (${o.userEmail})<br>
                        <small>Fecha: ${o.createdAt}</small>
                    </div>
                    <span class="status-badge ${getStatusBadgeClass(o.status)}">${o.status}</span>
                </div>
                <div>
                    ${o.items.map(i => `
                        <div>
                            • <strong>${i.quantity}x</strong> ${i.name} ${formatVariantLabel(i)} — $${(i.price * i.quantity).toLocaleString()}
                            ${i.wholesaleApplied ? `<span class="wholesale-pill-mini">Mayorista ($${i.price.toLocaleString()} c/u)</span>` : ''}
                        </div>
                    `).join('')}
                </div>

                <div class="payment-record-box">
                    <div>
                        💳 <strong>Abono reportado (${o.shipping.payment}):</strong> <span style="font-size:15px; color:#065f46; font-weight:800;">$${depositPaid.toLocaleString()}</span>
                        <span style="margin-left:6px; font-size:12px;">(Saldo productos: $${Math.max(0, o.subtotal - depositPaid).toLocaleString()})</span>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        ${o.paymentProof ? `
                            <button type="button" class="proof-thumb-btn" onclick="openProofModal('${o.orderId}')">
                                <img src="${o.paymentProof}" alt="Comprobante"> Ver Comprobante
                            </button>
                        ` : '<small style="color:#64748b;">Sin imagen adjunta</small>'}
                        <button type="button" class="${o.paymentVerified ? 'btn-success' : 'btn-warning'}" style="padding:6px 10px; font-size:12px;" onclick="toggleOrderPaymentVerified('${o.orderId}')">
                            ${o.paymentVerified ? '✓ Abono Confirmado' : 'Confirmar Abono'}
                        </button>
                    </div>
                </div>

                <div class="shipping-box">
                    <strong>📍 Dirección de entrega:</strong> ${o.shipping.address} — <strong>${o.shipping.city}</strong><br>
                    <strong>📞 Teléfono:</strong> ${o.shipping.phone} | <strong>🚚 Modalidad:</strong> ${o.shipping.method}
                    ${o.shipping.notes ? `<br><strong>📝 Nota del cliente:</strong> ${o.shipping.notes}` : ''}
                </div>

                <div class="quote-bar">
                    <label style="margin:0; font-size:13px;"><strong>Cotizar Envío ($ COP):</strong></label>
                    <input type="number" id="quote-ship-${o.orderId}" placeholder="Ej. 12000" min="0" value="${hasShipping ? o.shippingCost : ''}">
                    <button type="button" class="btn-warning" onclick="setOrderShipping('${o.orderId}')">Guardar Envío</button>
                </div>

                <div class="order-bottom">
                    <div class="totals-summary">
                        <span>Productos: <strong>$${o.subtotal.toLocaleString()}</strong></span> | 
                        <span>Envío: <strong>${shippingDisplay}</strong></span> | 
                        <span style="color:#2563eb;">Saldo por cobrar: <strong>${pendingDisplay}</strong></span>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <select onchange="updateOrderStatus('${o.orderId}', this.value)" style="padding:7px; border-radius:6px; border:1px solid #cbd5e1;">
                            <option value="Por cotizar envío" ${o.status === 'Por cotizar envío' ? 'selected' : ''}>Por cotizar envío</option>
                            <option value="Confirmado" ${o.status === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                            <option value="En preparación" ${o.status === 'En preparación' ? 'selected' : ''}>En preparación</option>
                            <option value="Enviado" ${o.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                            <option value="Entregado" ${o.status === 'Entregado' ? 'selected' : ''}>Entregado</option>
                        </select>
                        <button class="btn-whatsapp" onclick="notifyClientWhatsApp('${o.orderId}')">Enviar Resumen por WhatsApp</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// PANEL ADMIN: GESTIÓN DE CUENTAS, ROLES, CONTRASEÑAS Y BLOQUEOS
// ==========================================
function toggleUserRole(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (currentUser && user.id === currentUser.id) {
        alert('No puedes quitarte el rol de administrador a tu propia sesión activa.');
        return;
    }

    if (user.role === 'admin') {
        const adminCount = users.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
            alert('Debe existir al menos un administrador en el sistema.');
            return;
        }
        user.role = 'client';
        alert(`${user.name} ahora tiene rol de Cliente.`);
    } else {
        user.role = 'admin';
        user.blocked = false;
        blockedEmails = blockedEmails.filter(e => e !== user.email.toLowerCase());
        alert(`✅ ${user.name} ahora es Administrador del programa.`);
    }

    saveStoreData();
    renderAdminClients();
}

function toggleBlockUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (currentUser && user.id === currentUser.id) {
        alert('No puedes bloquear tu propia cuenta activa.');
        return;
    }

    const cleanEmail = user.email.toLowerCase();
    if (user.blocked || isEmailBlocked(cleanEmail)) {
        user.blocked = false;
        blockedEmails = blockedEmails.filter(e => e !== cleanEmail);
        alert(`Correo ${user.email} desbloqueado.`);
    } else {
        if (!confirm(`¿Bloquear la cuenta y el correo ${user.email}? No podrá iniciar sesión ni volver a registrarse.`)) return;
        user.blocked = true;
        user.role = 'client';
        if (!blockedEmails.includes(cleanEmail)) {
            blockedEmails.push(cleanEmail);
        }
        alert(`🚫 Correo ${user.email} bloqueado.`);
    }

    saveStoreData();
    renderAdminClients();
}

function deleteUserAccount(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (currentUser && user.id === currentUser.id) {
        alert('No puedes eliminar tu propia cuenta mientras tienes la sesión abierta.');
        return;
    }

    if (!confirm(`¿Eliminar permanentemente la cuenta de ${user.name} (${user.email})?`)) return;

    const alsoBlock = confirm(`¿Deseas también bloquear el correo ${user.email} para que no pueda crear otra cuenta?`);
    if (alsoBlock) {
        const cleanEmail = user.email.toLowerCase();
        if (!blockedEmails.includes(cleanEmail)) {
            blockedEmails.push(cleanEmail);
        }
    }

    users = users.filter(u => u.id !== userId);
    localStorage.removeItem(`store_cart_${userId}`);
    saveStoreData();
    renderAdminClients();
}

function unblockEmailManual(email) {
    const clean = (email || '').toLowerCase();
    blockedEmails = blockedEmails.filter(e => e !== clean);
    const user = users.find(u => u.email.toLowerCase() === clean);
    if (user) user.blocked = false;

    saveStoreData();
    renderAdminClients();
}

const blockEmailForm = document.getElementById('block-email-form');
if (blockEmailForm) {
    blockEmailForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const input = document.getElementById('manual-block-email');
        const email = input.value.trim().toLowerCase();
        if (!email) return;

        if (currentUser && currentUser.email.toLowerCase() === email) {
            alert('No puedes bloquear tu propio correo activo.');
            return;
        }

        if (!blockedEmails.includes(email)) {
            blockedEmails.push(email);
        }

        const existingUser = users.find(u => u.email.toLowerCase() === email);
        if (existingUser) {
            existingUser.blocked = true;
            existingUser.role = 'client';
        }

        input.value = '';
        saveStoreData();
        renderAdminClients();
        alert(`🚫 Correo ${email} añadido a la lista de bloqueados.`);
    });
}

function togglePasswordVisibility(userId) {
    const span = document.getElementById(`pwd-text-${userId}`);
    const btn = document.getElementById(`pwd-btn-${userId}`);
    if (!span || !btn) return;

    const isHidden = span.dataset.hidden === 'true';
    if (isHidden) {
        span.textContent = span.dataset.realPwd;
        span.dataset.hidden = 'false';
        btn.textContent = 'Ocultar';
    } else {
        span.textContent = '••••••••';
        span.dataset.hidden = 'true';
        btn.textContent = '👁️ Ver contraseña';
    }
}

function renderAdminClients() {
    const usersBadge = document.getElementById('admin-users-badge');
    if (usersBadge) usersBadge.textContent = users.length;

    const searchInput = document.getElementById('admin-client-search');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const statsContainer = document.getElementById('admin-clients-stats');
    if (statsContainer) {
        const adminCount = users.filter(u => u.role === 'admin').length;
        const activeBuyers = users.filter(c => storeOrders.some(o => o.userId === c.id)).length;

        statsContainer.innerHTML = `
            <div class="kpi-mini-card">
                <small>Total Cuentas</small>
                <p>${users.length}</p>
            </div>
            <div class="kpi-mini-card" style="border-left-color:#f59e0b;">
                <small>Administradores</small>
                <p>${adminCount}</p>
            </div>
            <div class="kpi-mini-card" style="border-left-color:#10b981;">
                <small>Clientes con Pedidos</small>
                <p>${activeBuyers}</p>
            </div>
            <div class="kpi-mini-card" style="border-left-color:#ef4444;">
                <small>Correos Bloqueados</small>
                <p>${blockedEmails.length}</p>
            </div>
        `;
    }

    const filteredUsers = users.filter(c => {
        return (
            (c.name || '').toLowerCase().includes(query) ||
            (c.email || '').toLowerCase().includes(query) ||
            (c.phone || '').toLowerCase().includes(query) ||
            (c.city || '').toLowerCase().includes(query) ||
            (c.address || '').toLowerCase().includes(query)
        );
    });

    const listContainer = document.getElementById('admin-clients-list');
    if (listContainer) {
        if (filteredUsers.length === 0) {
            listContainer.innerHTML = '<p style="color:#64748b;">No se encontraron cuentas que coincidan con la búsqueda.</p>';
        } else {
            listContainer.innerHTML = [...filteredUsers].reverse().map(c => {
                const userOrders = storeOrders.filter(o => o.userId === c.id);
                const totalSpent = userOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                const waPhone = formatColombianPhone(c.phone);
                const waMsg = `Hola *${c.name}*, te saludamos de *${storeConfig.name}*.`;
                const isBlocked = Boolean(c.blocked || isEmailBlocked(c.email));
                const isAdmin = c.role === 'admin';
                const isSelf = currentUser && currentUser.id === c.id;

                return `
                    <div class="client-card ${isBlocked ? 'blocked-user-card' : ''}">
                        <div class="client-info-main">
                            <h4>
                                👤 ${c.name}
                                <small style="color:#64748b; font-weight:500;">(${c.email})</small>
                                ${isAdmin ? `<span class="role-badge-admin">⭐ Administrador</span>` : ''}
                                ${c.emailVerified ? `<span class="verified-badge">✓ Verificado</span>` : ''}
                                ${isBlocked ? `<span class="role-badge-blocked">🚫 Bloqueado</span>` : ''}
                            </h4>
                            <div class="client-meta">
                                📞 <strong>WhatsApp / Tel:</strong> ${c.phone || 'Sin registrar'} &nbsp;|&nbsp;
                                📍 <strong>Ciudad:</strong> ${c.city || 'Sin registrar'}<br>
                                🏠 <strong>Dirección guardada:</strong> ${c.address || 'Sin dirección'}<br>
                                <div class="password-reveal-box">
                                    🔑 <strong>Contraseña:</strong>
                                    <span id="pwd-text-${c.id}" data-real-pwd="${(c.password || '').replace(/"/g, '&quot;')}" data-hidden="true">••••••••</span>
                                    <button type="button" id="pwd-btn-${c.id}" class="link-btn" style="font-size:12px;" onclick="togglePasswordVisibility('${c.id}')">👁️ Ver contraseña</button>
                                </div>
                            </div>
                            <div class="client-badges">
                                <span class="info-pill blue">Pedidos: ${userOrders.length} ($${totalSpent.toLocaleString()})</span>
                                <span class="info-pill">Ingresos: ${c.loginCount || 1}</span>
                                <span class="info-pill">Último acceso: ${c.lastLogin || c.registeredAt || 'Reciente'}</span>
                            </div>
                        </div>
                        <div class="client-actions-col">
                            <div class="client-actions-row">
                                ${waPhone ? `<a class="btn-whatsapp" href="https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}
                                ${!isSelf ? `
                                    <button type="button" class="btn-dark-sm" onclick="toggleUserRole('${c.id}')">
                                        ${isAdmin ? 'Quitar Admin' : 'Hacer Admin'}
                                    </button>
                                ` : '<span class="info-pill">Tu sesión actual</span>'}
                            </div>
                            ${!isSelf ? `
                                <div class="client-actions-row">
                                    <button type="button" class="btn-warning" onclick="toggleBlockUser('${c.id}')">
                                        ${isBlocked ? 'Desbloquear' : 'Bloquear Correo'}
                                    </button>
                                    <button type="button" class="btn-danger" onclick="deleteUserAccount('${c.id}')">
                                        Eliminar
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    const blockedContainer = document.getElementById('admin-blocked-list');
    if (blockedContainer) {
        if (blockedEmails.length === 0) {
            blockedContainer.innerHTML = '<small style="color:#64748b;">No hay correos bloqueados actualmente.</small>';
        } else {
            blockedContainer.innerHTML = blockedEmails.map(email => `
                <div class="blocked-chip">
                    <span>🚫 ${email}</span>
                    <button type="button" onclick="unblockEmailManual('${email}')">Desbloquear</button>
                </div>
            `).join('');
        }
    }
}

const clientSearchEl = document.getElementById('admin-client-search');
if (clientSearchEl) {
    clientSearchEl.addEventListener('input', renderAdminClients);
}

// INICIALIZAR TIENDA
applyStoreBranding();
updateAuthUI();
loadCartForCurrentUser();
updateCartBadge();
refreshCategoriesUI();
renderCatalog();
renderAdminOrders();
renderAdminClients();