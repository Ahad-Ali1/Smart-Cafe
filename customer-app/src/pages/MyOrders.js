import React, {
    useEffect,
    useState
} from 'react';

import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

import { API_URL } from '../config';

import {
    downloadInvoice,
    normalizeOrder,
    printInvoice
} from '../invoice';

function MyOrders() {
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] =
        useState(true);

    const [error, setError] = useState('');

    useEffect(() => {
        loadOrders();

        const socket = io(API_URL);

        const sessionId =
            localStorage.getItem('sessionId');

        if (sessionId) {
            socket.emit(
                'join-customer-room',
                sessionId
            );
        }

        socket.on(
            'order-status-updated',
            update => {
                const orderId = Number(
                    update.id ?? update.orderId
                );

                setOrders(currentOrders =>
                    currentOrders.map(order =>
                        Number(order.id) === orderId
                            ? {
                                  ...order,
                                  status: update.status
                              }
                            : order
                    )
                );

                loadOrders();
            }
        );

        const interval = setInterval(
            loadOrders,
            15000
        );

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    async function loadOrders() {
        const sessionToken =
            localStorage.getItem('sessionToken');

        if (!sessionToken) {
            setError(
                'Please scan your table QR code first.'
            );

            setLoading(false);
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/customer/orders`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${sessionToken}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                        'Could not load orders'
                );
            }

            setOrders(
                (data.orders || []).map(
                    normalizeOrder
                )
            );

            setError('');
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }

    function returnToMenu() {
        const qrToken =
            localStorage.getItem('tableQrToken');

        if (qrToken) {
            navigate(
                `/order?token=${encodeURIComponent(
                    qrToken
                )}`
            );
        } else {
            navigate('/');
        }
    }

    if (loading) {
        return (
            <div style={centerPage}>
                Loading your orders...
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                paddingBottom: 30,
                background: '#faf7f2'
            }}
        >
            <header
                style={{
                    padding: '15px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                        'space-between',
                    background: '#2c1810',
                    color: 'white'
                }}
            >
                <button
                    type="button"
                    onClick={returnToMenu}
                    style={headerButton}
                >
                    ←
                </button>

                <h2>My Orders</h2>

                <button
                    type="button"
                    onClick={loadOrders}
                    style={headerButton}
                >
                    ↻
                </button>
            </header>

            <main
                style={{
                    width: '100%',
                    maxWidth: 650,
                    margin: '0 auto',
                    padding: 18
                }}
            >
                {error && (
                    <div
                        style={{
                            padding: 15,
                            marginBottom: 15,
                            borderRadius: 10,
                            background: '#ffebee',
                            color: '#c62828'
                        }}
                    >
                        {error}
                    </div>
                )}

                {!error &&
                    orders.length === 0 && (
                        <div
                            style={{
                                padding: 45,
                                borderRadius: 14,
                                background: 'white',
                                textAlign: 'center'
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 45
                                }}
                            >
                                📦
                            </div>

                            <h3
                                style={{
                                    marginTop: 10,
                                    color: '#2c1810'
                                }}
                            >
                                No orders yet
                            </h3>

                            <button
                                type="button"
                                onClick={returnToMenu}
                                style={mainButton}
                            >
                                Open Menu
                            </button>
                        </div>
                    )}

                {orders.map(order => (
                    <article
                        key={order.id}
                        style={{
                            padding: 18,
                            marginBottom: 14,
                            borderLeft: `5px solid ${statusColor(
                                order.status
                            )}`,
                            borderRadius: 13,
                            background: 'white',
                            boxShadow:
                                '0 2px 8px rgba(0,0,0,0.08)'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent:
                                    'space-between',
                                gap: 10
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
                                        marginTop: 4,
                                        color: '#777'
                                    }}
                                >
                                    Table{' '}
                                    {order.tableNumber}
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
                                        borderRadius: 18,
                                        background:
                                            statusBackground(
                                                order.status
                                            ),
                                        color: statusColor(
                                            order.status
                                        ),
                                        fontSize: 12,
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {customerStatusLabel(
                                        order.status
                                    )}
                                </span>

                                <p
                                    style={{
                                        marginTop: 7,
                                        color: '#2c1810',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    ₹
                                    {order.total.toFixed(
                                        2
                                    )}
                                </p>
                            </div>
                        </div>

                        <StatusMessage
                            status={order.status}
                        />

                        <div
                            style={{
                                padding: 11,
                                marginTop: 13,
                                borderRadius: 8,
                                background: '#f8f8f8'
                            }}
                        >
                            {order.items.map(
                                (item, index) => (
                                    <div
                                        key={`${item.id}-${index}`}
                                        style={{
                                            display: 'flex',
                                            justifyContent:
                                                'space-between',
                                            padding: '4px 0'
                                        }}
                                    >
                                        <span>
                                            {item.quantity}x{' '}
                                            {item.name}
                                        </span>

                                        <span>
                                            ₹
                                            {(
                                                item.price *
                                                item.quantity
                                            ).toFixed(2)}
                                        </span>
                                    </div>
                                )
                            )}
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                                marginTop: 14
                            }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    downloadInvoice(order)
                                }
                                style={smallButton(
                                    '#2c1810'
                                )}
                            >
                                📥 Invoice
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    printInvoice(order)
                                }
                                style={smallButton(
                                    '#c49a6c'
                                )}
                            >
                                🖨 Print
                            </button>
                        </div>
                    </article>
                ))}

                {orders.length > 0 && (
                    <button
                        type="button"
                        onClick={returnToMenu}
                        style={{
                            ...mainButton,
                            width: '100%'
                        }}
                    >
                        🛒 Order More Items
                    </button>
                )}
            </main>
        </div>
    );
}

function StatusMessage({ status }) {
    const messages = {
        pending:
            '✅ Your order has been confirmed.',
        preparing:
            '👨‍🍳 Your order is being prepared.',
        ready:
            '🛵 Your order is arriving at your table.',
        delivered:
            '🎉 Your order has been delivered.',
        cancelled:
            '❌ This order was cancelled.'
    };

    return (
        <div
            style={{
                padding: 11,
                marginTop: 13,
                borderRadius: 9,
                background:
                    statusBackground(status),
                color: statusColor(status),
                fontWeight: 'bold'
            }}
        >
            {messages[status] || status}
        </div>
    );
}

function customerStatusLabel(status) {
    const labels = {
        pending: 'Order Confirmed',
        preparing: 'Being Prepared',
        ready: 'Arriving',
        delivered: 'Delivered',
        cancelled: 'Cancelled'
    };

    return labels[status] || status;
}

function statusColor(status) {
    const colors = {
        pending: '#e65100',
        preparing: '#1565c0',
        ready: '#2e7d32',
        delivered: '#4527a0',
        cancelled: '#c62828'
    };

    return colors[status] || '#555';
}

function statusBackground(status) {
    const colors = {
        pending: '#fff3e0',
        preparing: '#e3f2fd',
        ready: '#e8f5e9',
        delivered: '#ede7f6',
        cancelled: '#ffebee'
    };

    return colors[status] || '#eee';
}

function smallButton(background) {
    return {
        padding: '9px 13px',
        border: 'none',
        borderRadius: 8,
        background,
        color: 'white',
        cursor: 'pointer'
    };
}

const centerPage = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const headerButton = {
    border: 'none',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer',
    fontSize: 22
};

const mainButton = {
    padding: '12px 22px',
    marginTop: 15,
    border: 'none',
    borderRadius: 9,
    background: '#2c1810',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
};

export default MyOrders;