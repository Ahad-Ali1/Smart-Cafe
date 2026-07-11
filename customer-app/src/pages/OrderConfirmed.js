import React, {
    useEffect,
    useState
} from 'react';

import {
    useLocation,
    useNavigate,
    useParams
} from 'react-router-dom';

import { io } from 'socket.io-client';

import { API_URL } from '../config';

import {
    downloadInvoice,
    normalizeOrder,
    printInvoice
} from '../invoice';

function OrderConfirmed() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [order, setOrder] = useState(
        location.state?.order
            ? normalizeOrder(
                  location.state.order
              )
            : null
    );

    const [loading, setLoading] = useState(
        !location.state?.order
    );

    const [error, setError] = useState('');

    useEffect(() => {
        if (!order) {
            loadOrder();
        }

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
                const updatedOrderId =
                    Number(
                        update.id ??
                        update.orderId
                    );

                if (
                    updatedOrderId ===
                    Number(orderId)
                ) {
                    setOrder(currentOrder =>
                        currentOrder
                            ? {
                                  ...currentOrder,
                                  status:
                                      update.status
                              }
                            : currentOrder
                    );
                }
            }
        );

        return () => {
            socket.disconnect();
        };
    }, [orderId]);

    async function loadOrder() {
        const sessionToken =
            localStorage.getItem('sessionToken');

        if (!sessionToken) {
            setError('Your session has expired.');
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
                        'Could not load order'
                );
            }

            const selectedOrder = (
                data.orders || []
            ).find(
                item =>
                    Number(item.id) ===
                    Number(orderId)
            );

            if (!selectedOrder) {
                throw new Error(
                    'Order could not be found'
                );
            }

            setOrder(
                normalizeOrder(selectedOrder)
            );
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }

    function orderMore() {
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
                Loading your order...
            </div>
        );
    }

    if (error || !order) {
        return (
            <div style={centerPage}>
                <div
                    style={{
                        textAlign: 'center'
                    }}
                >
                    <div style={{ fontSize: 50 }}>
                        ⚠️
                    </div>

                    <h2>Could not load order</h2>

                    <p style={{ marginTop: 10 }}>
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            navigate('/my-orders')
                        }
                        style={mainButton}
                    >
                        Open My Orders
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                padding: 20,
                background: '#faf7f2'
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 480,
                    margin: '0 auto'
                }}
            >
                <section
                    style={{
                        padding: 28,
                        borderRadius: 16,
                        background: 'white',
                        textAlign: 'center',
                        boxShadow:
                            '0 3px 15px rgba(0,0,0,0.08)'
                    }}
                >
                    <div
                        style={{
                            width: 75,
                            height: 75,
                            margin: '0 auto 15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            background:
                                statusColor(
                                    order.status
                                ),
                            color: 'white',
                            fontSize: 38
                        }}
                    >
                        {statusIcon(order.status)}
                    </div>

                    <h2 style={{ color: '#2c1810' }}>
                        {statusTitle(order.status)}
                    </h2>

                    <p
                        style={{
                            marginTop: 8,
                            color: '#666'
                        }}
                    >
                        {statusMessage(order.status)}
                    </p>

                    <p
                        style={{
                            marginTop: 10,
                            color: '#c49a6c',
                            fontSize: 19,
                            fontWeight: 'bold'
                        }}
                    >
                        Order #{order.id}
                    </p>

                    <div
                        style={{
                            padding: 15,
                            marginTop: 18,
                            borderRadius: 10,
                            background:
                                statusBackground(
                                    order.status
                                ),
                            color:
                                statusColor(
                                    order.status
                                ),
                            fontWeight: 'bold'
                        }}
                    >
                        {customerStatusLabel(
                            order.status
                        )}
                    </div>
                </section>

                <section
                    style={{
                        padding: 20,
                        marginTop: 15,
                        borderRadius: 15,
                        background: 'white',
                        boxShadow:
                            '0 3px 15px rgba(0,0,0,0.08)'
                    }}
                >
                    <h3
                        style={{
                            textAlign: 'center',
                            color: '#2c1810'
                        }}
                    >
                        Tax Invoice Summary
                    </h3>

                    <p style={{ marginTop: 15 }}>
                        <strong>Name:</strong>{' '}
                        {order.customerName}
                    </p>

                    <p style={{ marginTop: 5 }}>
                        <strong>Table:</strong>{' '}
                        {order.tableNumber}
                    </p>

                    <p style={{ marginTop: 5 }}>
                        <strong>Payment:</strong>{' '}
                        {order.paymentMethod.toUpperCase()}
                    </p>

                    <div
                        style={{
                            marginTop: 15,
                            paddingTop: 12,
                            borderTop: '1px solid #ddd'
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
                                        padding: '5px 0'
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
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop:
                                '2px solid #2c1810'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent:
                                    'space-between'
                            }}
                        >
                            <span>Subtotal</span>

                            <span>
                                ₹
                                {order.subtotal.toFixed(
                                    2
                                )}
                            </span>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent:
                                    'space-between',
                                marginTop: 5
                            }}
                        >
                            <span>GST (18%)</span>

                            <span>
                                ₹{order.tax.toFixed(2)}
                            </span>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent:
                                    'space-between',
                                marginTop: 8,
                                fontWeight: 'bold',
                                fontSize: 18
                            }}
                        >
                            <span>Total</span>

                            <span>
                                ₹{order.total.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </section>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                        marginTop: 15
                    }}
                >
                    <button
                        type="button"
                        onClick={() =>
                            downloadInvoice(order)
                        }
                        style={buttonStyle('#2c1810')}
                    >
                        📥 Invoice
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            printInvoice(order)
                        }
                        style={buttonStyle('#c49a6c')}
                    >
                        🖨 Print
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            navigate('/my-orders')
                        }
                        style={buttonStyle('#4caf50')}
                    >
                        📦 My Orders
                    </button>

                    <button
                        type="button"
                        onClick={orderMore}
                        style={buttonStyle('#666')}
                    >
                        🛒 Order More
                    </button>
                </div>
            </div>
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

function statusTitle(status) {
    const titles = {
        pending: 'Order Confirmed!',
        preparing: 'Preparing Your Order',
        ready: 'Your Order Is Arriving!',
        delivered: 'Order Delivered!',
        cancelled: 'Order Cancelled'
    };

    return titles[status] || 'Order Update';
}

function statusMessage(status) {
    const messages = {
        pending:
            'The kitchen has received your order.',
        preparing:
            'Our kitchen is preparing your order.',
        ready:
            'Your order is ready and is arriving at your table.',
        delivered:
            'Your order has been delivered. Enjoy your meal!',
        cancelled:
            'This order has been cancelled.'
    };

    return messages[status] || '';
}

function statusIcon(status) {
    const icons = {
        pending: '✓',
        preparing: '👨‍🍳',
        ready: '🛵',
        delivered: '🎉',
        cancelled: '×'
    };

    return icons[status] || '✓';
}

function statusColor(status) {
    const colors = {
        pending: '#ff9800',
        preparing: '#2196f3',
        ready: '#4caf50',
        delivered: '#673ab7',
        cancelled: '#f44336'
    };

    return colors[status] || '#4caf50';
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

function buttonStyle(background) {
    return {
        padding: 13,
        border: 'none',
        borderRadius: 10,
        background,
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold'
    };
}

const centerPage = {
    minHeight: '100vh',
    padding: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const mainButton = {
    padding: '12px 22px',
    marginTop: 15,
    border: 'none',
    borderRadius: 9,
    background: '#2c1810',
    color: 'white',
    cursor: 'pointer'
};

export default OrderConfirmed