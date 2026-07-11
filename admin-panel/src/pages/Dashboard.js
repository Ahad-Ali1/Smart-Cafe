import React, {
    useEffect,
    useState
} from 'react';

import { io } from 'socket.io-client';

import {
    API_URL,
    getOrderDate,
    getSpecialInstructions,
    money,
    parseItems
} from '../utils';

function currentMonthValue() {
    const date = new Date();

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, '0')}`;
}

function currentDateValue() {
    const date = new Date();

    return (
        `${date.getFullYear()}-` +
        `${String(date.getMonth() + 1).padStart(2, '0')}-` +
        `${String(date.getDate()).padStart(2, '0')}`
    );
}

function SpecialInstructions({ order, compact = false }) {
    const instructions = getSpecialInstructions(order);

    if (!instructions) {
        return null;
    }

    return (
        <div
            style={{
                padding: compact ? 9 : 12,
                marginTop: 10,
                border: '2px solid #ff9800',
                borderRadius: 8,
                background: '#fff3e0',
                color: '#8a4b00',
                fontSize: compact ? 13 : 14
            }}
        >
            <strong>⚠️ Special Instructions</strong>

            <div
                style={{
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere'
                }}
            >
                {instructions}
            </div>
        </div>
    );
}

function Dashboard() {
    const [reportMode, setReportMode] =
        useState('cycle');

    const [selectedMonth, setSelectedMonth] =
        useState(currentMonthValue());

    const [selectedDate, setSelectedDate] =
        useState(currentDateValue());

    const [report, setReport] = useState({
        period: {
            label: ''
        },
        stats: {
            totalOrders: 0,
            totalRevenue: 0,
            activeTables: 0,
            activeOrders: 0
        },
        breakdown: []
    });

    const [orders, setOrders] = useState([]);
    const [refreshVersion, setRefreshVersion] =
        useState(0);

    const [updatingId, setUpdatingId] =
        useState(null);

    const [, setClock] = useState(Date.now());

    useEffect(() => {
        loadDashboard();
    }, [
        reportMode,
        selectedMonth,
        selectedDate,
        refreshVersion
    ]);

    useEffect(() => {
        const socket = io(API_URL);

        socket.emit('join-admin');

        socket.on('new-order', () => {
            setRefreshVersion(
                version => version + 1
            );

            playBeep();
        });

        socket.on(
            'order-status-updated',
            () => {
                setRefreshVersion(
                    version => version + 1
                );
            }
        );

        const clockInterval = setInterval(() => {
            setClock(Date.now());
        }, 30000);

        const refreshInterval = setInterval(() => {
            setRefreshVersion(
                version => version + 1
            );
        }, 30000);

        return () => {
            clearInterval(clockInterval);
            clearInterval(refreshInterval);
            socket.disconnect();
        };
    }, []);

    function playBeep() {
        try {
            const context = new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

            const oscillator =
                context.createOscillator();

            const gain = context.createGain();

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.frequency.value = 800;

            gain.gain.setValueAtTime(
                0.25,
                context.currentTime
            );

            gain.gain.exponentialRampToValueAtTime(
                0.01,
                context.currentTime + 0.4
            );

            oscillator.start();

            oscillator.stop(
                context.currentTime + 0.4
            );
        } catch {
            // Sound may be blocked by the browser.
        }
    }

    async function loadDashboard() {
        try {
            const query = new URLSearchParams({
                mode: reportMode
            });

            if (reportMode === 'month') {
                query.set('value', selectedMonth);
            }

            if (reportMode === 'date') {
                query.set('value', selectedDate);
            }

            const [reportResponse, ordersResponse] =
                await Promise.all([
                    fetch(
                        `${API_URL}/api/dashboard/stats?${query.toString()}`
                    ),
                    fetch(`${API_URL}/api/orders`)
                ]);

            const reportData =
                await reportResponse.json();

            const ordersData =
                await ordersResponse.json();

            if (!reportResponse.ok) {
                throw new Error(
                    reportData.error ||
                        'Could not load dashboard'
                );
            }

            setReport(reportData);
            setOrders(ordersData.orders || []);
        } catch (error) {
            console.error(error);
        }
    }

    function timeAgo(order) {
        const orderDate = getOrderDate(order);

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

            setRefreshVersion(
                version => version + 1
            );
        } catch (error) {
            alert(error.message);
        } finally {
            setUpdatingId(null);
        }
    }

    const activeKitchenOrders = orders.filter(
        order =>
            ['pending', 'preparing', 'ready'].includes(
                order.status
            )
    );

    const recentOrders = orders.slice(0, 6);

    const breakdownTitle =
        reportMode === 'cycle'
            ? 'Orders by month'
            : reportMode === 'month'
              ? 'Orders by date'
              : 'Orders by hour';

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 15,
                    flexWrap: 'wrap',
                    marginBottom: 20
                }}
            >
                <div>
                    <h2 style={{ color: '#2c1810' }}>
                        📊 Dashboard
                    </h2>

                    <p
                        style={{
                            color: '#666',
                            marginTop: 5
                        }}
                    >
                        Reporting period:{' '}
                        <strong>
                            {report.period.label}
                        </strong>
                    </p>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap',
                        padding: 12,
                        borderRadius: 10,
                        background: 'white'
                    }}
                >
                    <select
                        className="form-control"
                        value={reportMode}
                        onChange={event =>
                            setReportMode(
                                event.target.value
                            )
                        }
                        style={{ width: 'auto' }}
                    >
                        <option value="cycle">
                            Current 6-month cycle
                        </option>

                        <option value="month">
                            Select month
                        </option>

                        <option value="date">
                            Select date
                        </option>
                    </select>

                    {reportMode === 'month' && (
                        <input
                            className="form-control"
                            type="month"
                            value={selectedMonth}
                            onChange={event =>
                                setSelectedMonth(
                                    event.target.value
                                )
                            }
                            style={{ width: 'auto' }}
                        />
                    )}

                    {reportMode === 'date' && (
                        <input
                            className="form-control"
                            type="date"
                            value={selectedDate}
                            onChange={event =>
                                setSelectedDate(
                                    event.target.value
                                )
                            }
                            style={{ width: 'auto' }}
                        />
                    )}
                </div>
            </div>

            {reportMode === 'cycle' && (
                <div
                    style={{
                        padding: 12,
                        marginBottom: 20,
                        border: '1px solid #ffc107',
                        borderRadius: 9,
                        background: '#fff8e1',
                        color: '#7a5900'
                    }}
                >
                    The dashboard starts a new six-month
                    reporting cycle on January 1 and July 1.
                    Previous orders are not deleted.
                </div>
            )}

            <div
                className="grid-4"
                style={{ marginBottom: 22 }}
            >
                <div className="stat-card">
                    <p>Orders in period</p>
                    <h3>{report.stats.totalOrders}</h3>
                </div>

                <div
                    className="stat-card"
                    style={{
                        borderLeftColor: '#4caf50'
                    }}
                >
                    <p>Revenue in period</p>

                    <h3>
                        {money(
                            report.stats.totalRevenue
                        )}
                    </h3>
                </div>

                <div
                    className="stat-card"
                    style={{
                        borderLeftColor: '#ff9800'
                    }}
                >
                    <p>Occupied tables</p>

                    <h3>
                        {report.stats.activeTables}
                    </h3>
                </div>

                <div
                    className="stat-card"
                    style={{
                        borderLeftColor: '#f44336'
                    }}
                >
                    <p>Active orders</p>

                    <h3>
                        {report.stats.activeOrders}
                    </h3>
                </div>
            </div>

            <div className="card">
                <h3
                    style={{
                        color: '#2c1810',
                        marginBottom: 15
                    }}
                >
                    📅 {breakdownTitle}
                </h3>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns:
                            'repeat(auto-fill, minmax(105px, 1fr))',
                        gap: 10
                    }}
                >
                    {(report.breakdown || []).map(
                        bucket => (
                            <div
                                key={bucket.label}
                                style={{
                                    padding: 12,
                                    borderRadius: 8,
                                    background: '#f8f8f8',
                                    textAlign: 'center'
                                }}
                            >
                                <strong>
                                    {bucket.label}
                                </strong>

                                <div
                                    style={{
                                        marginTop: 6,
                                        color: '#2c1810',
                                        fontSize: 20
                                    }}
                                >
                                    {bucket.orders}
                                </div>

                                <small
                                    style={{
                                        color: '#777'
                                    }}
                                >
                                    {money(
                                        bucket.revenue
                                    )}
                                </small>
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className="grid-2">
                <div className="card">
                    <h3
                        style={{
                            color: '#2c1810',
                            marginBottom: 15
                        }}
                    >
                        👨‍🍳 Live Kitchen Orders{' '}
                        <small
                            style={{
                                color: '#f44336'
                            }}
                        >
                            ● LIVE
                        </small>
                    </h3>

                    {activeKitchenOrders.length === 0 ? (
                        <p
                            style={{
                                padding: 35,
                                color: '#888',
                                textAlign: 'center'
                            }}
                        >
                            No active kitchen orders
                        </p>
                    ) : (
                        <div
                            style={{
                                maxHeight: 600,
                                overflowY: 'auto'
                            }}
                        >
                            {activeKitchenOrders.map(
                                order => {
                                    const items =
                                        parseItems(
                                            order.items
                                        );

                                    const updating =
                                        updatingId ===
                                        order.id;

                                    return (
                                        <div
                                            key={order.id}
                                            style={{
                                                padding: 14,
                                                marginBottom: 10,
                                                border:
                                                    getSpecialInstructions(
                                                        order
                                                    )
                                                        ? '2px solid #ff9800'
                                                        : '1px solid #eee',
                                                borderRadius: 10,
                                                background:
                                                    order.status ===
                                                    'ready'
                                                        ? '#f1fff2'
                                                        : '#fffaf4'
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
                                                <strong>
                                                    Order #{order.id}
                                                </strong>

                                                <span
                                                    style={{
                                                        color: '#777',
                                                        fontSize: 13
                                                    }}
                                                >
                                                    {timeAgo(
                                                        order
                                                    )}
                                                </span>
                                            </div>

                                            <p
                                                style={{
                                                    margin: '6px 0',
                                                    color: '#666'
                                                }}
                                            >
                                                👤{' '}
                                                {order.customer_name ||
                                                    'Guest'}
                                                {' | '}
                                                🪑{' '}
                                                {order.table_number ||
                                                    order.table_id}
                                            </p>

                                            {items.map(
                                                (
                                                    item,
                                                    index
                                                ) => (
                                                    <div
                                                        key={`${item.id}-${index}`}
                                                        style={{
                                                            padding:
                                                                '3px 0'
                                                        }}
                                                    >
                                                        {item.quantity}x{' '}
                                                        {item.name}
                                                    </div>
                                                )
                                            )}

                                            <SpecialInstructions
                                                order={order}
                                            />

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: 8,
                                                    marginTop: 12
                                                }}
                                            >
                                                {[
                                                    'pending',
                                                    'preparing'
                                                ].includes(
                                                    order.status
                                                ) && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-success"
                                                        disabled={
                                                            updating
                                                        }
                                                        onClick={() =>
                                                            updateStatus(
                                                                order,
                                                                'ready'
                                                            )
                                                        }
                                                    >
                                                        {updating
                                                            ? 'Updating...'
                                                            : '✅ Ready'}
                                                    </button>
                                                )}

                                                {order.status ===
                                                    'ready' && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary"
                                                        disabled={
                                                            updating
                                                        }
                                                        onClick={() =>
                                                            updateStatus(
                                                                order,
                                                                'delivered'
                                                            )
                                                        }
                                                    >
                                                        {updating
                                                            ? 'Updating...'
                                                            : '🚀 Delivered'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>

                <div className="card">
                    <h3
                        style={{
                            color: '#2c1810',
                            marginBottom: 15
                        }}
                    >
                        🕐 Recent Orders
                    </h3>

                    {recentOrders.map(order => (
                        <div
                            key={order.id}
                            style={{
                                padding: '12px 0',
                                borderBottom:
                                    '1px solid #eee'
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between'
                                }}
                            >
                                <strong>
                                    #{order.id}
                                </strong>

                                <strong>
                                    {money(
                                        order.total_amount
                                    )}
                                </strong>
                            </div>

                            <p
                                style={{
                                    marginTop: 5,
                                    color: '#777',
                                    fontSize: 13
                                }}
                            >
                                {order.customer_name ||
                                    'Guest'}
                                {' | '}
                                {order.table_number ||
                                    order.table_id}
                                {' | '}
                                {order.status}
                            </p>

                            <SpecialInstructions
                                order={order}
                                compact
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;