import React, {
    useEffect,
    useRef,
    useState
} from 'react';

import {
    useNavigate,
    useSearchParams
} from 'react-router-dom';

import { io } from 'socket.io-client';

import { API_URL } from '../config';

function MenuPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const socketRef = useRef(null);

    const [menu, setMenu] = useState({});
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] =
        useState('');

    const [tableNumber, setTableNumber] =
        useState('');

    const [sessionToken, setSessionToken] =
        useState('');

    const [cart, setCart] = useState([]);
    const [cartTotal, setCartTotal] = useState(0);
    const [cartCount, setCartCount] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        initialize();

        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    async function initialize() {
        const qrToken = searchParams.get('token');

        if (!qrToken) {
            setError(
                'Please scan the QR code on your table.'
            );

            setLoading(false);
            return;
        }

        try {
            const session =
                await getOrCreateSession(qrToken);

            setSessionToken(session.sessionToken);
            setTableNumber(session.tableNumber);

            connectSocket(session.sessionId);

            const menuResponse = await fetch(
                `${API_URL}/api/menu`
            );

            const menuData =
                await menuResponse.json();

            if (!menuResponse.ok) {
                throw new Error(
                    menuData.error ||
                        'Could not load menu'
                );
            }

            setMenu(menuData.menu || {});
            setCategories(menuData.categories || []);

            if (menuData.categories?.length > 0) {
                setActiveCategory(
                    menuData.categories[0].name
                );
            }

            await loadCart(session.sessionToken);
        } catch (requestError) {
            setError(
                requestError.message ||
                    'Could not load the menu'
            );
        } finally {
            setLoading(false);
        }
    }

    async function getOrCreateSession(qrToken) {
        const savedQrToken =
            localStorage.getItem('tableQrToken');

        const savedSessionToken =
            localStorage.getItem('sessionToken');

        const savedSessionId =
            localStorage.getItem('sessionId');

        const savedTableNumber =
            localStorage.getItem('tableNumber');

        if (
            savedQrToken === qrToken &&
            savedSessionToken &&
            savedSessionId &&
            savedTableNumber
        ) {
            const cartResponse = await fetch(
                `${API_URL}/api/cart`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${savedSessionToken}`
                    }
                }
            );

            if (cartResponse.ok) {
                return {
                    sessionToken: savedSessionToken,
                    sessionId: savedSessionId,
                    tableNumber: savedTableNumber
                };
            }
        }

        const response = await fetch(
            `${API_URL}/api/tables/validate-session`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: qrToken
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                    'Invalid table QR code'
            );
        }

        localStorage.setItem(
            'tableQrToken',
            qrToken
        );

        localStorage.setItem(
            'sessionToken',
            data.sessionToken
        );

        localStorage.setItem(
            'sessionId',
            data.sessionId
        );

        localStorage.setItem(
            'tableNumber',
            data.tableNumber
        );

        return data;
    }

    function connectSocket(sessionId) {
        socketRef.current?.disconnect();

        const socket = io(API_URL);

        socket.emit(
            'join-customer-room',
            sessionId
        );

        socket.on(
            'order-status-updated',
            update => {
                setMessage(
                    `Order #${update.orderId} is now ${update.status}.`
                );

                setTimeout(() => {
                    setMessage('');
                }, 4000);
            }
        );

        socketRef.current = socket;
    }

    async function loadCart(token) {
        const response = await fetch(
            `${API_URL}/api/cart`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return;
        }

        setCart(data.cart || []);
        setCartTotal(Number(data.total || 0));
        setCartCount(
            Number(data.itemCount || 0)
        );
    }

    async function addToCart(itemId) {
        try {
            const response = await fetch(
                `${API_URL}/api/cart/add`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json',
                        Authorization:
                            `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        menuItemId: itemId,
                        quantity: 1
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                        'Could not add item'
                );
            }

            setCart(data.cart || []);
            setCartTotal(Number(data.total || 0));
            setCartCount(
                Number(data.itemCount || 0)
            );

            setMessage('Item added to cart');

            setTimeout(() => {
                setMessage('');
            }, 1500);
        } catch (requestError) {
            setMessage(requestError.message);
        }
    }

    function openCart() {
        navigate('/cart', {
            state: {
                cart,
                cartTotal,
                sessionToken,
                tableNumber
            }
        });
    }

    if (loading) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#2c1810',
                    color: 'white'
                }}
            >
                Loading café menu...
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    padding: 30,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 15,
                    textAlign: 'center'
                }}
            >
                <div style={{ fontSize: 50 }}>⚠️</div>
                <h2>Could not open menu</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                paddingBottom: 100,
                background: '#faf7f2'
            }}
        >
            <header
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    padding: '14px 18px',
                    background: '#2c1810',
                    color: 'white'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10
                    }}
                >
                    <div>
                        <strong>
                            ☕ Café Menu
                        </strong>

                        <div
                            style={{
                                marginTop: 4,
                                fontSize: 13,
                                color: '#dbc0a4'
                            }}
                        >
                            📍 Table {tableNumber}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            navigate('/my-orders')
                        }
                        style={{
                            padding: '9px 13px',
                            border: '1px solid #c49a6c',
                            borderRadius: 20,
                            background: 'transparent',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        📦 My Orders
                    </button>
                </div>
            </header>

            {message && (
                <div
                    style={{
                        position: 'fixed',
                        top: 75,
                        left: '50%',
                        zIndex: 1000,
                        transform:
                            'translateX(-50%)',
                        padding: '10px 18px',
                        borderRadius: 20,
                        background: '#4caf50',
                        color: 'white',
                        boxShadow:
                            '0 4px 15px rgba(0,0,0,0.25)'
                    }}
                >
                    {message}
                </div>
            )}

            <div
                style={{
                    position: 'sticky',
                    top: 67,
                    zIndex: 90,
                    display: 'flex',
                    gap: 5,
                    overflowX: 'auto',
                    padding: 10,
                    background: 'white',
                    borderBottom: '1px solid #ddd'
                }}
            >
                {categories.map(category => (
                    <button
                        type="button"
                        key={category.id}
                        onClick={() =>
                            setActiveCategory(
                                category.name
                            )
                        }
                        style={{
                            flexShrink: 0,
                            padding: '9px 14px',
                            borderRadius: 20,
                            cursor: 'pointer',
                            border:
                                activeCategory ===
                                category.name
                                    ? '2px solid #c49a6c'
                                    : '2px solid #eee',
                            background:
                                activeCategory ===
                                category.name
                                    ? '#fff8f0'
                                    : 'white',
                            color: '#2c1810',
                            fontWeight:
                                activeCategory ===
                                category.name
                                    ? 'bold'
                                    : 'normal'
                        }}
                    >
                        {category.name}
                    </button>
                ))}
            </div>

            <main
                style={{
                    width: '100%',
                    maxWidth: 650,
                    margin: '0 auto',
                    padding: 18
                }}
            >
                <h2
                    style={{
                        marginBottom: 12,
                        color: '#2c1810'
                    }}
                >
                    {activeCategory}
                </h2>

                {(menu[activeCategory] || []).map(
                    item => (
                        <div
                            key={item.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent:
                                    'space-between',
                                gap: 15,
                                padding: 15,
                                marginBottom: 10,
                                borderRadius: 12,
                                background: 'white',
                                boxShadow:
                                    '0 2px 7px rgba(0,0,0,0.07)'
                            }}
                        >
                            <div>
                                <strong
                                    style={{
                                        color: '#2c1810'
                                    }}
                                >
                                    {item.name}
                                </strong>

                                <p
                                    style={{
                                        marginTop: 4,
                                        color: '#888',
                                        fontSize: 13
                                    }}
                                >
                                    {item.description}
                                </p>

                                <p
                                    style={{
                                        marginTop: 6,
                                        color: '#2c1810',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    ₹
                                    {Number(
                                        item.price
                                    ).toFixed(2)}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    addToCart(item.id)
                                }
                                style={{
                                    flexShrink: 0,
                                    padding: '9px 16px',
                                    border: 'none',
                                    borderRadius: 20,
                                    background: '#2c1810',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                + Add
                            </button>
                        </div>
                    )
                )}
            </main>

            {cartCount > 0 && (
                <button
                    type="button"
                    onClick={openCart}
                    style={{
                        position: 'fixed',
                        left: '50%',
                        bottom: 20,
                        zIndex: 500,
                        transform:
                            'translateX(-50%)',

                        minWidth: 260,
                        padding: '14px 22px',

                        display: 'flex',
                        alignItems: 'center',
                        justifyContent:
                            'space-between',

                        border: 'none',
                        borderRadius: 30,
                        background: '#2c1810',
                        color: 'white',
                        cursor: 'pointer',
                        boxShadow:
                            '0 5px 20px rgba(0,0,0,0.3)'
                    }}
                >
                    <span>
                        🛒 {cartCount} items
                    </span>

                    <strong>
                        ₹{cartTotal.toFixed(2)}
                    </strong>

                    <span>View →</span>
                </button>
            )}
        </div>
    );
}

export default MenuPage;