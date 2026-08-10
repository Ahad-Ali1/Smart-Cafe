import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';

import { io } from 'socket.io-client';

import {
    API_URL,
    downloadReceipt,
    getOrderDate,
    getSpecialInstructions,
    money,
    parseItems,
    printReceipt
} from '../utils';

/* =========================================================
   SPECIAL INSTRUCTIONS
========================================================= */

function SpecialInstructions({ order }) {
    const instructions = getSpecialInstructions(order);

    if (!instructions) {
        return null;
    }

    return (
        <div
            style={{
                padding: 13,
                marginTop: 13,
                border: '2px solid #ff9800',
                borderRadius: 9,
                background: '#fff3e0',
                color: '#8a4b00'
            }}
        >
            <div
                style={{
                    marginBottom: 5,
                    fontWeight: 'bold'
                }}
            >
                ⚠️ Special Instructions
            </div>

            <div
                style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere'
                }}
            >
                {instructions}
            </div>
        </div>
    );
}

/* =========================================================
   STATUS HELPERS
========================================================= */

function getStatusColor(status) {
    const colors = {
        pending: '#ff9800',
        preparing: '#2196f3',
        ready: '#4caf50',
        delivered: '#673ab7',
        cancelled: '#f44336'
    };

    return colors[status] || '#999';
}

function getStatusBackground(status) {
    const colors = {
        pending: '#fff3e0',
        preparing: '#e3f2fd',
        ready: '#e8f5e9',
        delivered: '#ede7f6',
        cancelled: '#ffebee'
    };

    return colors[status] || '#eeeeee';
}

function getStatusTextColor(status) {
    const colors = {
        pending: '#e65100',
        preparing: '#1565c0',
        ready: '#2e7d32',
        delivered: '#4527a0',
        cancelled: '#c62828'
    };

    return colors[status] || '#555555';
}

/* =========================================================
   ORDER PAGE
========================================================= */

function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [connectionStatus, setConnectionStatus] =
        useState('connecting');
    const [error, setError] = useState('');

    const requestInProgress = useRef(false);
    const firstLoadComplete = useRef(false);

    /* =====================================================
       LOAD ORDERS
    ===================================================== */

    const loadOrders = useCallback(async (showRefresh = false) => {
        if (requestInProgress.current) {
            return;
        }

        requestInProgress.current = true;

        if (showRefresh) {
            setRefreshing(true);
        }

        try {
            const response = await fetch(
                `${API_URL}/api/orders?t=${Date.now()}`,
                {
                    method: 'GET',
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Could not load orders'
                );
            }

            setOrders(data.orders || []);
            setError('');
        } catch (requestError) {
            console.error('Order loading error:', requestError);

            setError(
                requestError.message || 'Could not load orders'
            );
        } finally {
            requestInProgress.current = false;
            firstLoadComplete.current = true;
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    /* =====================================================
       SOCKET AND POLLING
    ===================================================== */

    useEffect(() => {
        loadOrders();

        const socket = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        socket.on('connect', () => {
            console.log('Orders page connected:', socket.id);

            setConnectionStatus('connected');

            // Rooms are lost after reconnecting.
            socket.emit('join-admin');

            loadOrders();
        });

        socket.on('connect_error', socketError => {
            console.error(
                'Orders socket connection error:',
                socketError
            );

            setConnectionStatus('disconnected');
        });

        socket.on('disconnect', reason => {
            console.log('Orders page disconnected:', reason);

            setConnectionStatus('disconnected');
        });

        socket.on('new-order', newOrder => {
            console.log('New order received:', newOrder);

            loadOrders();
        });

        socket.on('order-status-updated', updatedOrder => {
            console.log(
                'Order status updated:',
                updatedOrder
            );

            loadOrders();
        });

        socket.on('table-status-updated', () => {
            loadOrders();
        });

        // Polling fallback. If Socket.IO is disconnected,
        // orders still appear within five seconds.
        const pollingInterval = window.setInterval(() => {
            loadOrders();
        }, 5000);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                loadOrders();
            }
        };

        const handleWindowFocus = () => {
            loadOrders();
        };

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange
        );

        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.clearInterval(pollingInterval);

            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            );

            window.removeEventListener(
                'focus',
                handleWindowFocus
            );

            socket.removeAllListeners();
            socket.disconnect();
        };
    }, [loadOrders]);

    /* =====================================================
       UPDATE ORDER STATUS
    ===================================================== */

    async function updateStatus(order, nextStatus) {
        let message = '';

        if (nextStatus === 'ready') {
            message = `Mark Order #${order.id} as ready?`;
        }

        if (nextStatus === 'delivered') {
            message =
                `Mark Order #${order.id} as delivered?\n\n` +
                'The table becomes vacant only if it has no other active orders.';
        }

        if (!window.confirm(message)) {
            return;
        }

        setUpdatingId(order.id);
        setError('');

        try {
            const response = await fetch(
                `${API_URL}/api/orders/${order.id}/status`,
                {
                    method: 'PUT',
                    cache: 'no-store',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    body: JSON.stringify({
                        status: nextStatus
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                        'Could not update order status'
                );
            }

            // Update the interface immediately.
            setOrders(currentOrders =>
                currentOrders.map(currentOrder =>
                    Number(currentOrder.id) ===
                    Number(order.id)
                        ? {
                              ...currentOrder,
                              status: nextStatus,
                              updated_at_iso:
                                  new Date().toISOString()
                          }
                        : currentOrder
                )
            );

            // Confirm the latest state from the backend.
            await loadOrders();
        } catch (requestError) {
            console.error(
                'Order status update error:',
                requestError
            );

            setError(
                requestError.message ||
                    'Could not update order status'
            );
        } finally {
            setUpdatingId(null);
        }
    }

    /* =====================================================
       FILTERS AND TOTALS
    ===================================================== */

    const visibleOrders =
        filter === 'all'
            ? orders
            : orders.filter(order => order.status === filter);

    const totalRevenue = orders
        .filter(order => order.status !== 'cancelled')
        .reduce(
            (sum, order) =>
                sum + Number(order.total_amount || 0),
            0
        );

    const activeOrders = orders.filter(order =>
        ['pending', 'preparing', 'ready'].includes(
            order.status
        )
    ).length;

    const statusCounts = {
        all: orders.length,
        pending: orders.filter(
            order => order.status === 'pending'
        ).length,
        preparing: orders.filter(
            order => order.status === 'preparing'
        ).length,
        ready: orders.filter(
            order => order.status === 'ready'
        ).length,
        delivered: orders.filter(
            order => order.status === 'delivered'
        ).length,
        cancelled: orders.filter(
            order => order.status === 'cancelled'
        ).length
    };

    /* =====================================================
       LOADING
    ===================================================== */

    if (loading && !firstLoadComplete.current) {
        return (
            <div
                style={{
                    minHeight: 300,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12
                }}
            >
                <div style={{ fontSize: 40 }}>📦</div>
                <p>Loading orders...</p>
            </div>
        );
    }

    /* =====================================================
       PAGE
    ===================================================== */

    return (
        <div>
            {/* Page heading */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 15,
                    flexWrap: 'wrap',
                    marginBottom: 22
                }}
            >
                <div>
                    <h2 style={{ color: '#2c1810' }}>
                        📦 All Orders
                    </h2>

                    <p
                        style={{
                            marginTop: 5,
                            color: '#666'
                        }}
                    >
                        Revenue:{' '}
                        <strong>{money(totalRevenue)}</strong>
                        {' · '}
                        Active orders:{' '}
                        <strong>{activeOrders}</strong>
                    </p>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap'
                    }}
                >
                    <span
                        style={{
                            padding: '7px 12px',
                            borderRadius: 20,
                            background:
                                connectionStatus === 'connected'
                                    ? '#e8f5e9'
                                    : '#ffebee',
                            color:
                                connectionStatus === 'connected'
                                    ? '#2e7d32'
                                    : '#c62828',
                            fontSize: 13,
                            fontWeight: 'bold'
                        }}
                    >
                        {connectionStatus === 'connected'
                            ? '● Live'
                            : '● Reconnecting'}
                    </span>

                    <button
                        type="button"
                        onClick={() => loadOrders(true)}
                        disabled={refreshing}
                        className="btn btn-primary"
                    >
                        {refreshing
                            ? 'Refreshing...'
                            : '↻ Refresh'}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div
                    style={{
                        padding: 13,
                        marginBottom: 15,
                        border: '1px solid #f44336',
                        borderRadius: 9,
                        background: '#ffebee',
                        color: '#c62828'
                    }}
                >
                    {error}
                </div>
            )}

            {/* Filters */}
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 20
                }}
            >
                {[
                    'all',
                    'pending',
                    'preparing',
                    'ready',
                    'delivered',
                    'cancelled'
                ].map(status => (
                    <button
                        type="button"
                        key={status}
                        onClick={() => setFilter(status)}
                        style={{
                            padding: '9px 15px',
                            borderRadius: 20,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            border:
                                filter === status
                                    ? '2px solid #c49a6c'
                                    : '2px solid #ddd',
                            background:
                                filter === status
                                    ? '#fff8f0'
                                    : 'white',
                            color: '#2c1810',
                            fontWeight:
                                filter === status
                                    ? 'bold'
                                    : 'normal'
                        }}
                    >
                        {status} ({statusCounts[status]})
                    </button>
                ))}
            </div>

            {/* No orders */}
            {visibleOrders.length === 0 ? (
                <div
                    className="card"
                    style={{
                        padding: 50,
                        color: '#888',
                        textAlign: 'center'
                    }}
                >
                    <div style={{ fontSize: 45 }}>📭</div>

                    <h3
                        style={{
                            marginTop: 10,
                            color: '#2c1810'
                        }}
                    >
                        No {filter === 'all' ? '' : filter} orders
                    </h3>
                </div>
            ) : (
                <div
                    style={{
                        display: 'grid',
                        gap: 15
                    }}
                >
                    {visibleOrders.map(order => {
                        const items = parseItems(order.items);
                        const date = getOrderDate(order);
                        const instructions =
                            getSpecialInstructions(order);

                        const updating =
                            updatingId === order.id;

                        return (
                            <article
                                key={order.id}
                                className="card"
                                style={{
                                    marginBottom: 0,
                                    borderLeft: `5px solid ${getStatusColor(
                                        order.status
                                    )}`
                                }}
                            >
                                {/* Header */}
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent:
                                            'space-between',
                                        gap: 15,
                                        flexWrap: 'wrap'
                                    }}
                                >
                                    <div>
                                        <h3
                                            style={{
                                                color: '#2c1810'
                                            }}
                                        >
                                            Order #{order.id}
                                        </h3>

                                        <p
                                            style={{
                                                marginTop: 6,
                                                color: '#777',
                                                fontSize: 14
                                            }}
                                        >
                                            👤{' '}
                                            {order.customer_name ||
                                                'Guest'}
                                            {' | '}
                                            📱{' '}
                                            {order.customer_phone ||
                                                '-'}
                                        </p>

                                        <p
                                            style={{
                                                marginTop: 4,
                                                color: '#777',
                                                fontSize: 14
                                            }}
                                        >
                                            🪑 Table{' '}
                                            {order.table_number ||
                                                order.table_id}
                                            {' | '}
                                            💳{' '}
                                            {String(
                                                order.payment_method ||
                                                    ''
                                            ).toUpperCase()}
                                        </p>

                                        <p
                                            style={{
                                                marginTop: 4,
                                                color: '#888',
                                                fontSize: 13
                                            }}
                                        >
                                            🕐{' '}
                                            {Number.isNaN(
                                                date.getTime()
                                            )
                                                ? '-'
                                                : date.toLocaleString()}
                                        </p>
                                    </div>

                                    <div
                                        style={{
                                            textAlign: 'right'
                                        }}
                                    >
                                        <span
                                            style={{
                                                display:
                                                    'inline-block',
                                                padding:
                                                    '6px 12px',
                                                borderRadius: 20,
                                                background:
                                                    getStatusBackground(
                                                        order.status
                                                    ),
                                                color:
                                                    getStatusTextColor(
                                                        order.status
                                                    ),
                                                fontSize: 12,
                                                fontWeight: 'bold',
                                                textTransform:
                                                    'capitalize'
                                            }}
                                        >
                                            {order.status}
                                        </span>

                                        <div
                                            style={{
                                                marginTop: 9,
                                                color: '#2c1810',
                                                fontSize: 20,
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            {money(
                                                order.total_amount
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Items */}
                                <div
                                    style={{
                                        padding: 13,
                                        marginTop: 16,
                                        borderRadius: 9,
                                        background: '#f8f8f8'
                                    }}
                                >
                                    <div
                                        style={{
                                            marginBottom: 8,
                                            color: '#2c1810',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Ordered Items
                                    </div>

                                    {items.length === 0 ? (
                                        <p style={{ color: '#888' }}>
                                            No item information
                                        </p>
                                    ) : (
                                        items.map((item, index) => (
                                            <div
                                                key={`${item.id}-${index}`}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    gap: 10,
                                                    padding: '5px 0',
                                                    borderBottom:
                                                        index <
                                                        items.length -
                                                            1
                                                            ? '1px solid #e5e5e5'
                                                            : 'none'
                                                }}
                                            >
                                                <span>
                                                    <strong>
                                                        {Number(
                                                            item.quantity
                                                        )}
                                                        x
                                                    </strong>{' '}
                                                    {item.name}
                                                </span>

                                                <span>
                                                    {money(
                                                        Number(
                                                            item.price
                                                        ) *
                                                            Number(
                                                                item.quantity
                                                            )
                                                    )}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Special instructions */}
                                {instructions && (
                                    <div
                                        style={{
                                            padding: 13,
                                            marginTop: 13,
                                            border:
                                                '2px solid #ff9800',
                                            borderRadius: 9,
                                            background: '#fff3e0',
                                            color: '#8a4b00'
                                        }}
                                    >
                                        <div
                                            style={{
                                                marginBottom: 5,
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            ⚠️ Special Instructions
                                        </div>

                                        <div
                                            style={{
                                                whiteSpace:
                                                    'pre-wrap',
                                                overflowWrap:
                                                    'anywhere'
                                            }}
                                        >
                                            {instructions}
                                        </div>
                                    </div>
                                )}

                                {/* Status explanation */}
                                {order.status === 'ready' && (
                                    <div
                                        style={{
                                            padding: 11,
                                            marginTop: 13,
                                            borderRadius: 8,
                                            background: '#e8f5e9',
                                            color: '#2e7d32'
                                        }}
                                    >
                                        🛵 The customer sees
                                        “Arriving”. Mark Delivered
                                        after the order reaches the
                                        table.
                                    </div>
                                )}

                                {/* Buttons */}
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 8,
                                        flexWrap: 'wrap',
                                        marginTop: 16
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() =>
                                            downloadReceipt(order)
                                        }
                                    >
                                        📥 Download Receipt
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-warning"
                                        onClick={() =>
                                            printReceipt(order)
                                        }
                                    >
                                        🖨 Print
                                    </button>

                                    {[
                                        'pending',
                                        'preparing'
                                    ].includes(order.status) && (
                                        <button
                                            type="button"
                                            className="btn btn-success"
                                            disabled={updating}
                                            onClick={() =>
                                                updateStatus(
                                                    order,
                                                    'ready'
                                                )
                                            }
                                        >
                                            {updating
                                                ? 'Updating...'
                                                : '✅ Mark Ready'}
                                        </button>
                                    )}

                                    {order.status === 'ready' && (
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            disabled={updating}
                                            onClick={() =>
                                                updateStatus(
                                                    order,
                                                    'delivered'
                                                )
                                            }
                                        >
                                            {updating
                                                ? 'Updating...'
                                                : '🚀 Mark Delivered'}
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default OrdersPage;