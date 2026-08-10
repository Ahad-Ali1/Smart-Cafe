import React, {
    useEffect,
    useState
} from 'react';

import {
    useLocation,
    useNavigate
} from 'react-router-dom';

import { API_URL } from '../config';

function CustomerDetails() {
    const navigate = useNavigate();
    const location = useLocation();

    const [cart, setCart] = useState(
        location.state?.cart || []
    );

    const [cartTotal, setCartTotal] = useState(
        Number(location.state?.cartTotal || 0)
    );

    const sessionToken =
        location.state?.sessionToken ||
        localStorage.getItem('sessionToken');

    const tableNumber =
        location.state?.tableNumber ||
        localStorage.getItem('tableNumber');

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const [loading, setLoading] = useState(
        cart.length === 0
    );
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (cart.length === 0) {
            loadCart();
        }
    }, []);

    async function loadCart() {
        if (!sessionToken) {
            setServerError(
                'Your session has expired. Please scan the QR code again.'
            );
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/cart`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${sessionToken}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Could not load your cart'
                );
            }

            setCart(data.cart || []);
            setCartTotal(Number(data.total || 0));
        } catch (error) {
            setServerError(
                error.message || 'Could not load your cart'
            );
        } finally {
            setLoading(false);
        }
    }

    function validateForm() {
        const nextErrors = {};

        if (name.trim().length < 2) {
            nextErrors.name =
                'Please enter your full name';
        }

        if (!/^\d{10}$/.test(phone.trim())) {
            nextErrors.phone =
                'Enter a valid 10-digit phone number';
        }

        if (
            email.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email.trim()
            )
        ) {
            nextErrors.email =
                'Enter a valid email address';
        }

        return nextErrors;
    }

    async function proceedToCheckout() {
        const nextErrors = validateForm();

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        if (!sessionToken) {
            setServerError(
                'Your session has expired. Please scan the QR code again.'
            );
            return;
        }

        if (cart.length === 0) {
            setServerError('Your cart is empty.');
            return;
        }

        setErrors({});
        setServerError('');
        setSubmitting(true);

        try {
            const response = await fetch(
                `${API_URL}/api/customer`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization:
                            `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        name: name.trim(),
                        phone: phone.trim(),
                        email: email.trim()
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                        'Could not save customer details'
                );
            }

            navigate('/checkout', {
                state: {
                    cart,
                    cartTotal,
                    sessionToken,
                    tableNumber,
                    customer: {
                        name: name.trim(),
                        phone: phone.trim(),
                        email: email.trim()
                    }
                }
            });
        } catch (error) {
            setServerError(
                error.message ||
                    'Could not continue to payment'
            );
        } finally {
            setSubmitting(false);
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
            <div style={centerPageStyle}>
                Loading your cart...
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#faf7f2'
            }}
        >
            <header
                style={{
                    padding: '15px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#2c1810',
                    color: 'white'
                }}
            >
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    style={headerButtonStyle}
                >
                    ←
                </button>

                <h2>Your Details</h2>

                <span>{tableNumber || '-'}</span>
            </header>

            <main
                style={{
                    width: '100%',
                    maxWidth: 500,
                    margin: '0 auto',
                    padding: 20
                }}
            >
                <section
                    style={{
                        padding: 22,
                        borderRadius: 15,
                        background: 'white',
                        boxShadow:
                            '0 2px 12px rgba(0,0,0,0.08)'
                    }}
                >
                    <h3
                        style={{
                            color: '#2c1810',
                            marginBottom: 7
                        }}
                    >
                        👤 Customer Details
                    </h3>

                    <p
                        style={{
                            color: '#777',
                            fontSize: 14,
                            marginBottom: 20
                        }}
                    >
                        Enter your details before proceeding to
                        payment.
                    </p>

                    <div style={formGroupStyle}>
                        <label style={labelStyle}>
                            Full Name *
                        </label>

                        <input
                            value={name}
                            placeholder="Enter your full name"
                            autoComplete="name"
                            onChange={event => {
                                setName(event.target.value);

                                setErrors(current => ({
                                    ...current,
                                    name: ''
                                }));

                                setServerError('');
                            }}
                            style={inputStyle(errors.name)}
                        />

                        {errors.name && (
                            <p style={errorStyle}>
                                {errors.name}
                            </p>
                        )}
                    </div>

                    <div style={formGroupStyle}>
                        <label style={labelStyle}>
                            Phone Number *
                        </label>

                        <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={phone}
                            placeholder="10-digit phone number"
                            autoComplete="tel"
                            onChange={event => {
                                setPhone(
                                    event.target.value.replace(
                                        /\D/g,
                                        ''
                                    )
                                );

                                setErrors(current => ({
                                    ...current,
                                    phone: ''
                                }));

                                setServerError('');
                            }}
                            style={inputStyle(errors.phone)}
                        />

                        {errors.phone && (
                            <p style={errorStyle}>
                                {errors.phone}
                            </p>
                        )}
                    </div>

                    <div style={formGroupStyle}>
                        <label style={labelStyle}>
                            Email{' '}
                            <span
                                style={{
                                    color: '#999',
                                    fontWeight: 'normal'
                                }}
                            >
                                (optional)
                            </span>
                        </label>

                        <input
                            type="email"
                            value={email}
                            placeholder="customer@email.com"
                            autoComplete="email"
                            onChange={event => {
                                setEmail(event.target.value);

                                setErrors(current => ({
                                    ...current,
                                    email: ''
                                }));

                                setServerError('');
                            }}
                            style={inputStyle(errors.email)}
                        />

                        {errors.email && (
                            <p style={errorStyle}>
                                {errors.email}
                            </p>
                        )}
                    </div>

                    <div
                        style={{
                            padding: 14,
                            marginTop: 10,
                            borderRadius: 10,
                            background: '#f8f4f0'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}
                        >
                            <span>Items</span>

                            <strong>
                                {cart.reduce(
                                    (sum, item) =>
                                        sum + item.quantity,
                                    0
                                )}
                            </strong>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: 7
                            }}
                        >
                            <span>Subtotal</span>

                            <strong>
                                ₹{cartTotal.toFixed(2)}
                            </strong>
                        </div>
                    </div>

                    {serverError && (
                        <div
                            style={{
                                padding: 12,
                                marginTop: 15,
                                borderRadius: 9,
                                background: '#ffebee',
                                color: '#c62828'
                            }}
                        >
                            {serverError}
                        </div>
                    )}

                    <button
                        type="button"
                        disabled={submitting}
                        onClick={proceedToCheckout}
                        style={{
                            width: '100%',
                            padding: 15,
                            marginTop: 18,
                            border: 'none',
                            borderRadius: 11,
                            background: submitting
                                ? '#999'
                                : '#2c1810',
                            color: 'white',
                            cursor: submitting
                                ? 'not-allowed'
                                : 'pointer',
                            fontSize: 16,
                            fontWeight: 'bold'
                        }}
                    >
                        {submitting
                            ? 'Saving Details...'
                            : 'Proceed to Payment →'}
                    </button>

                    {serverError && (
                        <button
                            type="button"
                            onClick={returnToMenu}
                            style={{
                                width: '100%',
                                padding: 12,
                                marginTop: 10,
                                border: 'none',
                                borderRadius: 10,
                                background: '#eee',
                                color: '#2c1810',
                                cursor: 'pointer'
                            }}
                        >
                            Return to Menu
                        </button>
                    )}
                </section>
            </main>
        </div>
    );
}

function inputStyle(hasError) {
    return {
        width: '100%',
        padding: 12,
        border: hasError
            ? '2px solid #f44336'
            : '2px solid #ddd',
        borderRadius: 9,
        outline: 'none',
        fontSize: 15
    };
}

const formGroupStyle = {
    marginBottom: 16
};

const labelStyle = {
    display: 'block',
    marginBottom: 6,
    color: '#2c1810',
    fontWeight: 'bold',
    fontSize: 14
};

const errorStyle = {
    marginTop: 5,
    color: '#f44336',
    fontSize: 12
};

const centerPageStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const headerButtonStyle = {
    border: 'none',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer',
    fontSize: 22
};

export default CustomerDetails;