const API_URL = window.location.origin;
const socket = io();

let activeOrders = [];

/* =========================================================
   HELPERS
========================================================= */

function parseItems(items) {
    if (Array.isArray(items)) {
        return items;
    }

    try {
        const parsed = JSON.parse(items || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeOrder(order) {
    return {
        id: Number(order.id ?? order.orderId),

        tableNumber:
            order.tableNumber ||
            order.table_number ||
            order.table_id ||
            '-',

        customerName:
            order.customerName ||
            order.customer_name ||
            'Guest',

        customerPhone:
            order.customerPhone ||
            order.customer_phone ||
            '',

        items: parseItems(order.items),

        total: Number(
            order.total ??
            order.total_amount ??
            0
        ),

        paymentMethod:
            order.paymentMethod ||
            order.payment_method ||
            'cash',

        specialInstructions:
            order.specialInstructions ||
            order.special_instructions ||
            '',

        status:
            order.status === 'new'
                ? 'pending'
                : order.status || 'pending',

        createdAt:
            order.timestamp ||
            order.created_at_iso ||
            order.created_at ||
            new Date().toISOString()
    };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatMoney(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function parseOrderDate(value) {
    if (!value) {
        return new Date();
    }

    if (
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ) {
        return new Date(
            value.replace(' ', 'T') + 'Z'
        );
    }

    return new Date(value);
}

function timeAgo(createdAt) {
    const orderDate = parseOrderDate(createdAt);

    if (Number.isNaN(orderDate.getTime())) {
        return '-';
    }

    const difference = Math.max(
        0,
        Date.now() - orderDate.getTime()
    );

    const minutes = Math.floor(
        difference / 60000
    );

    if (minutes < 1) {
        return 'Just now';
    }

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ${minutes % 60}m ago`;
    }

    return orderDate.toLocaleString();
}

function statusLabel(status) {
    const labels = {
        pending: 'NEW',
        preparing: 'PREPARING',
        ready: 'READY / ARRIVING',
        delivered: 'DELIVERED',
        cancelled: 'CANCELLED'
    };

    return labels[status] || status.toUpperCase();
}

function statusColor(status) {
    const colors = {
        pending: '#ff9800',
        preparing: '#2196f3',
        ready: '#4caf50',
        delivered: '#673ab7',
        cancelled: '#f44336'
    };

    return colors[status] || '#777';
}

/* =========================================================
   LOAD EXISTING ACTIVE ORDERS

   This makes orders appear even after kitchen refresh.
========================================================= */

async function loadActiveOrders() {
    try {
        const response = await fetch(
            `${API_URL}/api/orders`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || 'Could not load orders'
            );
        }

        activeOrders = (data.orders || [])
            .map(normalizeOrder)
            .filter(order =>
                [
                    'pending',
                    'preparing',
                    'ready'
                ].includes(order.status)
            );

        renderOrders();
    } catch (error) {
        console.error(
            'Kitchen order loading failed:',
            error
        );

        const container = document.getElementById(
            'orders-container'
        );

        if (container) {
            container.innerHTML = `
                <p class="no-orders">
                    Could not load orders. Check the backend.
                </p>
            `;
        }
    }
}

/* =========================================================
   SOCKET CONNECTION
========================================================= */

socket.emit('join-kitchen');

socket.on('connect', () => {
    console.log('Kitchen connected:', socket.id);
    socket.emit('join-kitchen');
});

socket.on('new-order', rawOrder => {
    const order = normalizeOrder(rawOrder);

    const existingIndex = activeOrders.findIndex(
        currentOrder => currentOrder.id === order.id
    );

    if (existingIndex >= 0) {
        activeOrders[existingIndex] = order;
    } else {
        activeOrders.unshift(order);
    }

    renderOrders();
    showNewOrderAlert(order);
    playNotificationSound();
});

socket.on('order-status-updated', update => {
    const orderId = Number(
        update.id ?? update.orderId
    );

    const newStatus = update.status;

    if (
        newStatus === 'delivered' ||
        newStatus === 'cancelled'
    ) {
        activeOrders = activeOrders.filter(
            order => order.id !== orderId
        );

        renderOrders();
        return;
    }

    const existingOrder = activeOrders.find(
        order => order.id === orderId
    );

    if (existingOrder) {
        existingOrder.status = newStatus;

        if (update.items) {
            existingOrder.items = parseItems(
                update.items
            );
        }

        renderOrders();
    } else {
        loadActiveOrders();
    }
});

socket.on('order-status-error', data => {
    alert(
        data.error || 'Could not update order'
    );
});

/* =========================================================
   RENDER ORDERS
========================================================= */

function renderOrders() {
    const container = document.getElementById(
        'orders-container'
    );

    const activeCount = document.getElementById(
        'active-count'
    );

    const newCount = document.getElementById(
        'new-count'
    );

    if (!container) {
        return;
    }

    if (activeCount) {
        activeCount.textContent =
            activeOrders.length;
    }

    if (newCount) {
        newCount.textContent =
            activeOrders.filter(order =>
                [
                    'pending',
                    'preparing'
                ].includes(order.status)
            ).length;
    }

    if (activeOrders.length === 0) {
        container.innerHTML = `
            <p class="no-orders">
                Waiting for orders...
            </p>
        `;

        return;
    }

    container.innerHTML = activeOrders
        .map(order => {
            const itemRows =
                order.items.length > 0
                    ? order.items
                          .map(
                              item => `
                                <div class="order-item">
                                    <span class="item-qty">
                                        ${Number(item.quantity)}x
                                    </span>

                                    <span class="item-name">
                                        ${escapeHtml(item.name)}
                                    </span>
                                </div>
                            `
                          )
                          .join('')
                    : `
                        <div class="order-item">
                            <span>
                                No item information
                            </span>
                        </div>
                    `;

            let actionButton = '';

            if (
                order.status === 'pending' ||
                order.status === 'preparing'
            ) {
                actionButton = `
                    <button
                        class="ready-btn"
                        onclick="markOrderReady(${order.id})"
                    >
                        ✅ Mark Ready
                    </button>
                `;
            }

            if (order.status === 'ready') {
                actionButton = `
                    <button
                        class="ready-btn"
                        onclick="markOrderDelivered(${order.id})"
                        style="background:#2c1810;"
                    >
                        🚀 Mark Delivered
                    </button>
                `;
            }

            return `
                <div
                    class="order-card ${
                        order.status === 'pending'
                            ? 'new-order'
                            : ''
                    }"
                    id="order-${order.id}"
                    style="
                        border-left-color:
                        ${statusColor(order.status)};
                    "
                >
                    <div class="order-header">
                        <div>
                            <h3>
                                Order #${order.id}
                            </h3>

                            <p
                                style="
                                    color:#c49a6c;
                                    font-weight:bold;
                                    margin-top:4px;
                                "
                            >
                                👤 ${escapeHtml(
                                    order.customerName
                                )}
                            </p>

                            ${
                                order.customerPhone
                                    ? `
                                        <p
                                            style="
                                                color:#aaa;
                                                font-size:0.85em;
                                                margin-top:3px;
                                            "
                                        >
                                            📱 ${escapeHtml(
                                                order.customerPhone
                                            )}
                                        </p>
                                    `
                                    : ''
                            }

                            <span class="table-badge">
                                Table ${escapeHtml(
                                    order.tableNumber
                                )}
                            </span>
                        </div>

                        <div
                            style="
                                text-align:right;
                            "
                        >
                            <span
                                style="
                                    display:inline-block;
                                    padding:5px 10px;
                                    border-radius:15px;
                                    background:${statusColor(
                                        order.status
                                    )};
                                    color:white;
                                    font-size:0.75em;
                                    font-weight:bold;
                                "
                            >
                                ${statusLabel(order.status)}
                            </span>

                            <div
                                class="order-time"
                                data-order-id="${order.id}"
                                style="
                                    color:#aaa;
                                    margin-top:7px;
                                    font-size:0.8em;
                                "
                            >
                                ${timeAgo(order.createdAt)}
                            </div>
                        </div>
                    </div>

                    <div class="order-items">
                        ${itemRows}
                    </div>

                    ${
                        order.specialInstructions
                            ? `
                                <div
                                    class="order-note"
                                    style="
                                        border:2px solid #ff9800;
                                        background:#4a3219;
                                        color:#ffd699;
                                        font-weight:bold;
                                    "
                                >
                                    ⚠️ Special Instructions

                                    <div
                                        style="
                                            margin-top:6px;
                                            white-space:pre-wrap;
                                            overflow-wrap:anywhere;
                                        "
                                    >
                                        ${escapeHtml(
                                            order.specialInstructions
                                        )}
                                    </div>
                                </div>
                            `
                            : ''
                    }

                    <div class="order-footer">
                        <span
                            class="payment-${escapeHtml(
                                order.paymentMethod
                            )}"
                        >
                            ${escapeHtml(
                                order.paymentMethod.toUpperCase()
                            )}
                        </span>

                        <strong
                            style="
                                color:#c49a6c;
                                margin-left:auto;
                                margin-right:10px;
                            "
                        >
                            ${formatMoney(order.total)}
                        </strong>

                        ${actionButton}
                    </div>
                </div>
            `;
        })
        .join('');
}

/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

async function updateOrderStatus(
    orderId,
    status
) {
    try {
        const response = await fetch(
            `${API_URL}/api/orders/${orderId}/status`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    status
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                    'Could not update order'
            );
        }

        const existingOrder = activeOrders.find(
            order => order.id === orderId
        );

        if (status === 'delivered') {
            activeOrders = activeOrders.filter(
                order => order.id !== orderId
            );
        } else if (existingOrder) {
            existingOrder.status = status;
        }

        renderOrders();
    } catch (error) {
        alert(error.message);
    }
}

window.markOrderReady = function markOrderReady(
    orderId
) {
    updateOrderStatus(
        Number(orderId),
        'ready'
    );
};

window.markOrderDelivered =
    function markOrderDelivered(orderId) {
        updateOrderStatus(
            Number(orderId),
            'delivered'
        );
    };

/* =========================================================
   NEW ORDER ALERT AND SOUND
========================================================= */

function showNewOrderAlert(order) {
    const alertElement =
        document.getElementById('alert');

    const alertMessage =
        document.getElementById(
            'alert-message'
        );

    if (!alertElement || !alertMessage) {
        return;
    }

    alertMessage.textContent =
        `${order.customerName} — ` +
        `Table ${order.tableNumber} — ` +
        `${order.items.length} item types`;

    alertElement.style.display = 'flex';

    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 3000);
}

function playNotificationSound() {
    try {
        const audioContext = new (
            window.AudioContext ||
            window.webkitAudioContext
        )();

        const oscillator =
            audioContext.createOscillator();

        const gain =
            audioContext.createGain();

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.frequency.value = 850;

        gain.gain.setValueAtTime(
            0.3,
            audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.6
        );

        oscillator.start();

        oscillator.stop(
            audioContext.currentTime + 0.6
        );
    } catch {
        console.log(
            'Browser blocked notification sound'
        );
    }
}

/* =========================================================
   UPDATE TIMERS
========================================================= */

setInterval(() => {
    document
        .querySelectorAll('.order-time')
        .forEach(timer => {
            const orderId = Number(
                timer.dataset.orderId
            );

            const order = activeOrders.find(
                currentOrder =>
                    currentOrder.id === orderId
            );

            if (order) {
                timer.textContent =
                    timeAgo(order.createdAt);
            }
        });
}, 30000);

/* =========================================================
   START
========================================================= */

loadActiveOrders();