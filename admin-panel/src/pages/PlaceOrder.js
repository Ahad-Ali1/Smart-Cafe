import React, {
    useEffect,
    useMemo,
    useState
} from 'react';

import {
    API_URL,
    downloadReceipt,
    money,
    printReceipt
} from '../utils';

function PlaceOrder() {
    const [tables, setTables] = useState([]);
    const [menu, setMenu] = useState({});
    const [activeCategory, setActiveCategory] = useState('');

    const [selectedTable, setSelectedTable] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');

    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [instructions, setInstructions] = useState('');
    const [cart, setCart] = useState([]);

    const [errors, setErrors] = useState({});
    const [placing, setPlacing] = useState(false);
    const [placedOrder, setPlacedOrder] = useState(null);

    // Controls the custom confirmation popup
    const [showConfirmation, setShowConfirmation] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    // Close the confirmation popup using the Escape key
    useEffect(() => {
        function handleEscape(event) {
            if (
                event.key === 'Escape' &&
                showConfirmation &&
                !placing
            ) {
                setShowConfirmation(false);
            }
        }

        window.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('keydown', handleEscape);
        };
    }, [showConfirmation, placing]);

    async function loadData() {
        try {
            const [tablesResponse, menuResponse] =
                await Promise.all([
                    fetch(`${API_URL}/api/tables`),
                    fetch(`${API_URL}/api/menu`)
                ]);

            const tablesData = await tablesResponse.json();
            const menuData = await menuResponse.json();

            if (!tablesResponse.ok) {
                throw new Error(
                    tablesData.error || 'Could not load tables'
                );
            }

            if (!menuResponse.ok) {
                throw new Error(
                    menuData.error || 'Could not load menu'
                );
            }

            setTables(tablesData.tables || []);
            setMenu(menuData.menu || {});

            const categories = Object.keys(menuData.menu || {});

            if (categories.length > 0) {
                setActiveCategory(currentCategory =>
                    currentCategory || categories[0]
                );
            }
        } catch (error) {
            console.error(error);
        }
    }

    const selectedTableObject = useMemo(
        () =>
            tables.find(
                table => table.id === Number(selectedTable)
            ),
        [tables, selectedTable]
    );

    const subtotal = useMemo(
        () =>
            cart.reduce(
                (sum, item) =>
                    sum +
                    Number(item.price) *
                        Number(item.quantity),
                0
            ),
        [cart]
    );

    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const total =
        Math.round((subtotal + tax) * 100) / 100;

    const totalItemCount = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    function addItem(item) {
        setCart(currentCart => {
            const existingItem = currentCart.find(
                cartItem => cartItem.id === item.id
            );

            if (existingItem) {
                return currentCart.map(cartItem =>
                    cartItem.id === item.id
                        ? {
                              ...cartItem,
                              quantity: cartItem.quantity + 1
                          }
                        : cartItem
                );
            }

            return [
                ...currentCart,
                {
                    ...item,
                    quantity: 1
                }
            ];
        });

        setErrors(currentErrors => ({
            ...currentErrors,
            cart: ''
        }));
    }

    function reduceItem(itemId) {
        setCart(currentCart =>
            currentCart
                .map(item =>
                    item.id === itemId
                        ? {
                              ...item,
                              quantity: item.quantity - 1
                          }
                        : item
                )
                .filter(item => item.quantity > 0)
        );
    }

    function removeItem(itemId) {
        setCart(currentCart =>
            currentCart.filter(item => item.id !== itemId)
        );
    }

    function validateForm() {
        const nextErrors = {};

        if (!selectedTable) {
            nextErrors.table = 'Select a table';
        }

        if (customerName.trim().length < 2) {
            nextErrors.name = 'Customer name is required';
        }

        if (!/^\d{10}$/.test(customerPhone.trim())) {
            nextErrors.phone =
                'Enter a valid 10-digit phone number';
        }

        if (
            customerEmail.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                customerEmail.trim()
            )
        ) {
            nextErrors.email =
                'Enter a valid email address';
        }

        if (cart.length === 0) {
            nextErrors.cart =
                'Add at least one menu item';
        }

        return nextErrors;
    }

    // Validate first, then show the custom confirmation popup.
    function openConfirmationPopup() {
        const nextErrors = validateForm();

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            return;
        }

        setErrors({});
        setShowConfirmation(true);
    }

    function closeConfirmationPopup() {
        if (placing) {
            return;
        }

        setShowConfirmation(false);
    }

    // Called only after the admin clicks Confirm Order in the popup.
    async function confirmAndPlaceOrder() {
        if (placing) {
            return;
        }

        setPlacing(true);

        try {
            const response = await fetch(
                `${API_URL}/api/admin/orders`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tableId: Number(selectedTable),
                        customerName: customerName.trim(),
                        customerPhone: customerPhone.trim(),
                        customerEmail: customerEmail.trim(),
                        items: cart.map(item => ({
                            id: item.id,
                            quantity: item.quantity
                        })),
                        paymentMethod,
                        specialInstructions: instructions.trim()
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Could not place order'
                );
            }

            setPlacedOrder(data.order);
            setShowConfirmation(false);

            // Reset form after successful order
            setCart([]);
            setSelectedTable('');
            setCustomerName('');
            setCustomerPhone('');
            setCustomerEmail('');
            setInstructions('');
            setPaymentMethod('cash');
            setErrors({});

            await loadData();

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } catch (error) {
            console.error(error);

            // Keep the confirmation popup open and show the error there.
            setErrors(currentErrors => ({
                ...currentErrors,
                submit:
                    error.message || 'Could not place order'
            }));
        } finally {
            setPlacing(false);
        }
    }

    function startAnotherOrder() {
        setPlacedOrder(null);

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    const categories = Object.keys(menu);

    return (
        <div>
            <h2
                style={{
                    color: '#2c1810',
                    marginBottom: 20
                }}
            >
                🛒 Place Order for Customer
            </h2>

            {/* Successful order section */}
            {placedOrder && (
                <div
                    className="card"
                    style={{
                        border: '2px solid #4caf50',
                        background: '#f1fff2',
                        textAlign: 'center'
                    }}
                >
                    <div style={{ fontSize: 48 }}>✅</div>

                    <h2
                        style={{
                            color: '#2e7d32',
                            marginTop: 8
                        }}
                    >
                        Order #{placedOrder.id} Placed
                    </h2>

                    <p style={{ marginTop: 8 }}>
                        {placedOrder.customer_name}
                        {' · '}
                        {placedOrder.table_number}
                    </p>

                    <p
                        style={{
                            marginTop: 8,
                            color: '#2c1810',
                            fontSize: 21,
                            fontWeight: 'bold'
                        }}
                    >
                        {money(placedOrder.total_amount)}
                    </p>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                            gap: 10,
                            marginTop: 18
                        }}
                    >
                        <button
                            type="button"
                            className="btn btn-success"
                            onClick={() =>
                                downloadReceipt(placedOrder)
                            }
                        >
                            📥 Download Receipt
                        </button>

                        <button
                            type="button"
                            className="btn btn-warning"
                            onClick={() =>
                                printReceipt(placedOrder)
                            }
                        >
                            🖨 Print Receipt
                        </button>

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={startAnotherOrder}
                        >
                            Place Another Order
                        </button>
                    </div>
                </div>
            )}

            <div className="grid-2">
                {/* LEFT SIDE */}
                <div>
                    <div className="card">
                        <h3
                            style={{
                                color: '#2c1810',
                                marginBottom: 18
                            }}
                        >
                            Customer Details
                        </h3>

                        <div className="form-group">
                            <label className="form-label">
                                Select Table *
                            </label>

                            <select
                                className="form-control"
                                value={selectedTable}
                                onChange={event => {
                                    setSelectedTable(
                                        event.target.value
                                    );

                                    setErrors(current => ({
                                        ...current,
                                        table: '',
                                        submit: ''
                                    }));
                                }}
                            >
                                <option value="">
                                    -- Select Table --
                                </option>

                                {tables.map(table => (
                                    <option
                                        key={table.id}
                                        value={table.id}
                                    >
                                        {table.table_number}
                                        {' - '}
                                        {table.status === 'occupied'
                                            ? 'Occupied — add another order'
                                            : `Available — capacity ${table.capacity}`}
                                    </option>
                                ))}
                            </select>

                            {errors.table && (
                                <p className="form-error">
                                    {errors.table}
                                </p>
                            )}
                        </div>

                        {selectedTableObject && (
                            <div
                                style={{
                                    padding: 11,
                                    marginBottom: 14,
                                    borderRadius: 8,
                                    background:
                                        selectedTableObject.status ===
                                        'occupied'
                                            ? '#fff3e0'
                                            : '#e8f5e9',
                                    color:
                                        selectedTableObject.status ===
                                        'occupied'
                                            ? '#e65100'
                                            : '#2e7d32'
                                }}
                            >
                                <strong>
                                    {selectedTableObject.table_number}
                                </strong>

                                {' — '}

                                {selectedTableObject.status ===
                                'occupied'
                                    ? 'Occupied. This order will be added to the same table.'
                                    : 'Available'}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">
                                Customer Name *
                            </label>

                            <input
                                className="form-control"
                                value={customerName}
                                placeholder="Full name"
                                onChange={event => {
                                    setCustomerName(
                                        event.target.value
                                    );

                                    setErrors(current => ({
                                        ...current,
                                        name: '',
                                        submit: ''
                                    }));
                                }}
                            />

                            {errors.name && (
                                <p className="form-error">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Phone Number *
                            </label>

                            <input
                                className="form-control"
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                value={customerPhone}
                                placeholder="10-digit phone number"
                                onChange={event => {
                                    setCustomerPhone(
                                        event.target.value.replace(
                                            /\D/g,
                                            ''
                                        )
                                    );

                                    setErrors(current => ({
                                        ...current,
                                        phone: '',
                                        submit: ''
                                    }));
                                }}
                            />

                            {errors.phone && (
                                <p className="form-error">
                                    {errors.phone}
                                </p>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Email (optional)
                            </label>

                            <input
                                className="form-control"
                                type="email"
                                value={customerEmail}
                                placeholder="customer@email.com"
                                onChange={event => {
                                    setCustomerEmail(
                                        event.target.value
                                    );

                                    setErrors(current => ({
                                        ...current,
                                        email: '',
                                        submit: ''
                                    }));
                                }}
                            />

                            {errors.email && (
                                <p className="form-error">
                                    {errors.email}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Category buttons */}
                    <div
                        style={{
                            display: 'flex',
                            gap: 7,
                            flexWrap: 'wrap',
                            marginBottom: 15
                        }}
                    >
                        {categories.map(category => (
                            <button
                                type="button"
                                key={category}
                                onClick={() =>
                                    setActiveCategory(category)
                                }
                                style={{
                                    padding: '8px 13px',
                                    borderRadius: 20,
                                    cursor: 'pointer',
                                    border:
                                        activeCategory === category
                                            ? '2px solid #c49a6c'
                                            : '2px solid #ddd',
                                    background:
                                        activeCategory === category
                                            ? '#fff8f0'
                                            : 'white',
                                    fontWeight:
                                        activeCategory === category
                                            ? 'bold'
                                            : 'normal'
                                }}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    {/* Menu items */}
                    <div
                        style={{
                            maxHeight: 520,
                            overflowY: 'auto'
                        }}
                    >
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
                                        padding: 14,
                                        marginBottom: 8,
                                        borderRadius: 10,
                                        background: 'white',
                                        boxShadow:
                                            '0 1px 4px rgba(0,0,0,0.06)'
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
                                                marginTop: 3,
                                                color: '#888',
                                                fontSize: 13
                                            }}
                                        >
                                            {item.description}
                                        </p>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10
                                        }}
                                    >
                                        <strong>
                                            {money(item.price)}
                                        </strong>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                addItem(item)
                                            }
                                            className="btn btn-primary"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE CART */}
                <div>
                    <div
                        className="card"
                        style={{
                            position: 'sticky',
                            top: 85
                        }}
                    >
                        <h3
                            style={{
                                color: '#2c1810',
                                marginBottom: 16
                            }}
                        >
                            🛒 Order Cart
                        </h3>

                        {errors.cart && (
                            <p
                                className="form-error"
                                style={{ marginBottom: 10 }}
                            >
                                {errors.cart}
                            </p>
                        )}

                        {cart.length === 0 ? (
                            <div
                                style={{
                                    padding: 40,
                                    color: '#aaa',
                                    textAlign: 'center'
                                }}
                            >
                                No items added
                            </div>
                        ) : (
                            <div
                                style={{
                                    maxHeight: 330,
                                    overflowY: 'auto'
                                }}
                            >
                                {cart.map(item => (
                                    <div
                                        key={item.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '11px 0',
                                            borderBottom:
                                                '1px solid #eee'
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <strong
                                                style={{
                                                    fontSize: 14
                                                }}
                                            >
                                                {item.name}
                                            </strong>

                                            <small
                                                style={{
                                                    display: 'block',
                                                    marginTop: 3,
                                                    color: '#888'
                                                }}
                                            >
                                                {money(item.price)} each
                                            </small>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                reduceItem(item.id)
                                            }
                                            style={{
                                                width: 29,
                                                height: 29,
                                                borderRadius: '50%',
                                                border:
                                                    '2px solid #f44336',
                                                background: 'white',
                                                color: '#f44336',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            −
                                        </button>

                                        <strong>
                                            {item.quantity}
                                        </strong>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                addItem(item)
                                            }
                                            style={{
                                                width: 29,
                                                height: 29,
                                                borderRadius: '50%',
                                                border:
                                                    '2px solid #4caf50',
                                                background: 'white',
                                                color: '#4caf50',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            +
                                        </button>

                                        <strong
                                            style={{
                                                minWidth: 75,
                                                textAlign: 'right'
                                            }}
                                        >
                                            {money(
                                                item.price *
                                                    item.quantity
                                            )}
                                        </strong>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeItem(item.id)
                                            }
                                            style={{
                                                border: 'none',
                                                background:
                                                    'transparent',
                                                color: '#f44336',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div
                            style={{
                                marginTop: 18,
                                paddingTop: 14,
                                borderTop: '2px solid #eee'
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between',
                                    marginBottom: 7
                                }}
                            >
                                <span>Subtotal</span>
                                <span>{money(subtotal)}</span>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between',
                                    marginBottom: 7
                                }}
                            >
                                <span>GST (18%)</span>
                                <span>{money(tax)}</span>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between',
                                    paddingTop: 10,
                                    borderTop:
                                        '1px solid #ddd',
                                    color: '#2c1810',
                                    fontSize: 19,
                                    fontWeight: 'bold'
                                }}
                            >
                                <span>Total</span>
                                <span>{money(total)}</span>
                            </div>
                        </div>

                        <div
                            className="form-group"
                            style={{ marginTop: 18 }}
                        >
                            <label className="form-label">
                                Payment Method
                            </label>

                            <select
                                className="form-control"
                                value={paymentMethod}
                                onChange={event =>
                                    setPaymentMethod(
                                        event.target.value
                                    )
                                }
                            >
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="upi">UPI</option>
                                <option value="netbanking">
                                    Net Banking
                                </option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Special Instructions
                            </label>

                            <textarea
                                className="form-control"
                                rows={3}
                                value={instructions}
                                placeholder="Optional instructions"
                                onChange={event =>
                                    setInstructions(
                                        event.target.value
                                    )
                                }
                            />
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={placing}
                            onClick={openConfirmationPopup}
                            style={{
                                width: '100%',
                                padding: 15,
                                fontSize: 17
                            }}
                        >
                            Review & Confirm Order · {money(total)}
                        </button>
                    </div>
                </div>
            </div>

            {/* CUSTOM CONFIRMATION POPUP */}
            {showConfirmation && (
                <div
                    onClick={closeConfirmationPopup}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 5000,
                        padding: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.72)'
                    }}
                >
                    <div
                        onClick={event =>
                            event.stopPropagation()
                        }
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: 520,
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            padding: 28,
                            borderRadius: 18,
                            background: 'white',
                            boxShadow:
                                '0 20px 60px rgba(0,0,0,0.35)'
                        }}
                    >
                        <button
                            type="button"
                            onClick={closeConfirmationPopup}
                            disabled={placing}
                            aria-label="Close confirmation"
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                width: 34,
                                height: 34,
                                border: 'none',
                                borderRadius: '50%',
                                background: '#f44336',
                                color: 'white',
                                cursor: placing
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontSize: 20
                            }}
                        >
                            ×
                        </button>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 45 }}>📋</div>

                            <h2
                                style={{
                                    color: '#2c1810',
                                    marginTop: 8
                                }}
                            >
                                Confirm Order
                            </h2>

                            <p
                                style={{
                                    color: '#777',
                                    marginTop: 5
                                }}
                            >
                                Check the order before sending it
                                to the kitchen.
                            </p>
                        </div>

                        {selectedTableObject?.status ===
                            'occupied' && (
                            <div
                                style={{
                                    padding: 12,
                                    marginTop: 18,
                                    border:
                                        '1px solid #ff9800',
                                    borderRadius: 9,
                                    background: '#fff3e0',
                                    color: '#e65100'
                                }}
                            >
                                ⚠️{' '}
                                {
                                    selectedTableObject.table_number
                                }{' '}
                                is occupied. This new order will
                                be added to the same table.
                            </div>
                        )}

                        <div
                            style={{
                                padding: 15,
                                marginTop: 18,
                                borderRadius: 10,
                                background: '#f8f8f8'
                            }}
                        >
                            <p>
                                <strong>Table:</strong>{' '}
                                {
                                    selectedTableObject?.table_number
                                }
                            </p>

                            <p style={{ marginTop: 6 }}>
                                <strong>Customer:</strong>{' '}
                                {customerName}
                            </p>

                            <p style={{ marginTop: 6 }}>
                                <strong>Phone:</strong>{' '}
                                {customerPhone}
                            </p>

                            {customerEmail && (
                                <p style={{ marginTop: 6 }}>
                                    <strong>Email:</strong>{' '}
                                    {customerEmail}
                                </p>
                            )}

                            <p style={{ marginTop: 6 }}>
                                <strong>Payment:</strong>{' '}
                                {paymentMethod.toUpperCase()}
                            </p>

                            <p style={{ marginTop: 6 }}>
                                <strong>Items:</strong>{' '}
                                {totalItemCount}
                            </p>
                        </div>

                        <div
                            style={{
                                marginTop: 18,
                                maxHeight: 230,
                                overflowY: 'auto'
                            }}
                        >
                            {cart.map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent:
                                            'space-between',
                                        gap: 15,
                                        padding: '8px 0',
                                        borderBottom:
                                            '1px solid #eee'
                                    }}
                                >
                                    <span>
                                        {item.quantity}x {item.name}
                                    </span>

                                    <strong>
                                        {money(
                                            item.price *
                                                item.quantity
                                        )}
                                    </strong>
                                </div>
                            ))}
                        </div>

                        <div
                            style={{
                                marginTop: 18,
                                paddingTop: 13,
                                borderTop: '2px solid #2c1810'
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between',
                                    marginBottom: 6
                                }}
                            >
                                <span>Subtotal</span>
                                <span>{money(subtotal)}</span>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between',
                                    marginBottom: 6
                                }}
                            >
                                <span>GST (18%)</span>
                                <span>{money(tax)}</span>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between',
                                    color: '#2c1810',
                                    fontSize: 20,
                                    fontWeight: 'bold'
                                }}
                            >
                                <span>Total</span>
                                <span>{money(total)}</span>
                            </div>
                        </div>

                        {errors.submit && (
                            <div
                                style={{
                                    padding: 11,
                                    marginTop: 15,
                                    borderRadius: 8,
                                    background: '#ffebee',
                                    color: '#c62828'
                                }}
                            >
                                {errors.submit}
                            </div>
                        )}

                        <div
                            style={{
                                display: 'flex',
                                gap: 10,
                                marginTop: 22
                            }}
                        >
                            <button
                                type="button"
                                disabled={placing}
                                onClick={closeConfirmationPopup}
                                className="btn"
                                style={{
                                    flex: 1,
                                    padding: 13,
                                    background: '#777',
                                    color: 'white'
                                }}
                            >
                                Go Back
                            </button>

                            <button
                                type="button"
                                disabled={placing}
                                onClick={confirmAndPlaceOrder}
                                className="btn btn-success"
                                style={{
                                    flex: 1,
                                    padding: 13
                                }}
                            >
                                {placing
                                    ? 'Sending to Kitchen...'
                                    : '✅ Confirm Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PlaceOrder;