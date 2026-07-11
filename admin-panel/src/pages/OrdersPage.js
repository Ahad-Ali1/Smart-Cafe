import React, {
    useEffect,
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
                    fontWeight: 'bold',
                    marginBottom: 5
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

function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] =
        useState(null);

    useEffect(() => {
        loadOrders();

        const socket = io(API_URL);

        socket.emit('join-admin');

        socket.on('new-order', loadOrders);
        socket.on(
            'order-status-updated',
            loadOrders
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
        try {
            const response = await fetch(
                `${API_URL}/api/orders`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                        'Could not load orders'
                );
            }

            setOrders(data.orders || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus(order, status) {
        setUpdatingId(order.id);

        try {
            const response = await fetch(
                `${API_URL}/api/orders/${order.id}/status`,
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

            await loadOrders();
        } catch (error) {
            alert(error.message);
        } finally {
            setUpdatingId(null);
        }
    }

    const visibleOrders =
        filter === 'all'
            ? orders
            : orders.filter(
                  order => order.status === filter
              );

    const totalRevenue = orders
        .filter(
            order => order.status !== 'cancelled'
        )
        .reduce(
            (sum, order) =>
                sum +
                Number(order.total_amount || 0),
            0
        );

    if (loading) {
        return (
            <div
                style={{
                    padding: 50,
                    textAlign: 'center'
                }}
            >
                Loading orders...
            </div>
        );
    }

    return (
        <div>
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
                            color: '#666',
                            marginTop: 5
                        }}
                    >
                        Revenue:{' '}
                        <strong>
                            {money(totalRevenue)}
                        </strong>
                    </p>
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: 7,
                        flexWrap: 'wrap'
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
                            onClick={() =>
                                setFilter(status)
                            }
                            style={{
                                padding: '8px 14px',
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
                                        : 'white'
                            }}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {visibleOrders.length === 0 ? (
                <div
                    className="card"
                    style={{
                        padding: 50,
                        color: '#888',
                        textAlign: 'center'
                    }}
                >
                    No orders found
                </div>
            ) : (
                <div
                    style={{
                        display: 'grid',
                        gap: 15
                    }}
                >
                    {visibleOrders.map(order => {
                        const items = parseItems(
                            order.items
                        );

                        const date =
                            getOrderDate(order);

                        const updating =
                            updatingId === order.id;

                        return (
                            <div
                                key={order.id}
                                className="card"
                                style={{
                                    marginBottom: 0,
                                    borderLeft: `5px solid ${getStatusColor(
                                        order.status
                                    )}`
                                }}
                            >
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
                                            {' | '}
                                            🪑{' '}
                                            {order.table_number ||
                                                order.table_id}
                                        </p>

                                        <p
                                            style={{
                                                marginTop: 4,
                                                color: '#888',
                                                fontSize: 13
                                            }}
                                        >
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
                                            className={`status-badge status-${order.status}`}
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

                                <div
                                    style={{
                                        padding: 13,
                                        marginTop: 16,
                                        borderRadius: 9,
                                        background: '#f8f8f8'
                                    }}
                                >
                                    {items.map(
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
                                                    {money(
                                                        item.price *
                                                            item.quantity
                                                    )}
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>

                                <SpecialInstructions
                                    order={order}
                                />

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
                                            downloadReceipt(
                                                order
                                            )
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
                                    ].includes(
                                        order.status
                                    ) && (
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

                                    {order.status ===
                                        'ready' && (
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
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

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

export default OrdersPage;