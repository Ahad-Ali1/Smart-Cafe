import React, {
    useState
} from 'react';

import {
    useLocation,
    useNavigate
} from 'react-router-dom';

import { API_URL } from '../config';

function passesLuhnCheck(cardNumber) {
    const digits = cardNumber
        .replace(/\D/g, '')
        .split('')
        .map(Number)
        .reverse();

    const total = digits.reduce(
        (sum, digit, index) => {
            if (index % 2 === 1) {
                const doubled = digit * 2;
                return (
                    sum +
                    (doubled > 9
                        ? doubled - 9
                        : doubled)
                );
            }

            return sum + digit;
        },
        0
    );

    return total % 10 === 0;
}

function isValidExpiry(expiry) {
    const match = expiry.match(
        /^(\d{2})\/(\d{2})$/
    );

    if (!match) {
        return false;
    }

    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);

    if (month < 1 || month > 12) {
        return false;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (year < currentYear) {
        return false;
    }

    if (
        year === currentYear &&
        month < currentMonth
    ) {
        return false;
    }

    return true;
}

function formatCardNumber(value) {
    return value
        .replace(/\D/g, '')
        .slice(0, 19)
        .replace(/(.{4})/g, '$1 ')
        .trim();
}

function formatExpiry(value) {
    const digits = value
        .replace(/\D/g, '')
        .slice(0, 4);

    if (digits.length <= 2) {
        return digits;
    }

    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function CheckoutPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const state = location.state || {};

    const cart = state.cart || [];
    const cartTotal = Number(
        state.cartTotal || 0
    );

    const sessionToken =
        state.sessionToken ||
        localStorage.getItem('sessionToken');

    const tableNumber =
        state.tableNumber ||
        localStorage.getItem('tableNumber');

    const customer = state.customer || {};

    const [paymentMethod, setPaymentMethod] =
        useState('cash');

    const [instructions, setInstructions] =
        useState('');

    const [cardNumber, setCardNumber] =
        useState('');

    const [cardName, setCardName] =
        useState('');

    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');

    const [upiId, setUpiId] = useState('');
    const [bankName, setBankName] =
        useState('');

    const [errors, setErrors] = useState({});
    const [placing, setPlacing] =
        useState(false);

    const tax =
        Math.round(cartTotal * 0.18 * 100) / 100;

    const total =
        Math.round((cartTotal + tax) * 100) /
        100;

    function validatePayment() {
        const nextErrors = {};

        if (paymentMethod === 'card') {
            const cleanCardNumber =
                cardNumber.replace(/\D/g, '');

            if (
                cleanCardNumber.length < 13 ||
                cleanCardNumber.length > 19 ||
                !passesLuhnCheck(cleanCardNumber)
            ) {
                nextErrors.cardNumber =
                    'Enter a valid card number';
            }

            if (cardName.trim().length < 2) {
                nextErrors.cardName =
                    'Name on card is required';
            }

            if (!isValidExpiry(expiry)) {
                nextErrors.expiry =
                    'Card has expired or the date is invalid';
            }

            if (!/^\d{3,4}$/.test(cvv)) {
                nextErrors.cvv =
                    'Enter a valid 3 or 4-digit CVV';
            }
        }

        if (paymentMethod === 'upi') {
            if (
                !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(
                    upiId.trim()
                )
            ) {
                nextErrors.upi =
                    'Enter a valid UPI ID';
            }
        }

        if (
            paymentMethod === 'netbanking' &&
            !bankName
        ) {
            nextErrors.bank =
                'Select your bank';
        }

        return nextErrors;
    }

    async function placeOrder() {
        const nextErrors = validatePayment();

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setErrors({});
        setPlacing(true);

        try {
            const response = await fetch(
                `${API_URL}/api/orders`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json',
                        Authorization:
                            `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        paymentMethod,
                        specialInstructions:
                            instructions.trim()
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                        'Could not place your order'
                );
            }

            navigate(
                `/order-confirmed/${data.order.id}`,
                {
                    replace: true,
                    state: {
                        order: data.order
                    }
                }
            );
        } catch (error) {
            setErrors({
                submit:
                    error.message ||
                    'Could not place your order'
            });
        } finally {
            setPlacing(false);
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

    if (
        !cart.length ||
        !sessionToken ||
        !tableNumber
    ) {
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
                <h2>Checkout information is missing</h2>

                <button
                    type="button"
                    onClick={returnToMenu}
                    style={{
                        padding: '12px 24px',
                        border: 'none',
                        borderRadius: 10,
                        background: '#2c1810',
                        color: 'white'
                    }}
                >
                    Return to Menu
                </button>
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                paddingBottom: 35,
                background: '#faf7f2'
            }}
        >
            <header
                style={{
                    padding: '15px 18px',
                    display: 'flex',
                    justifyContent:
                        'space-between',
                    alignItems: 'center',
                    background: '#2c1810',
                    color: 'white'
                }}
            >
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'white',
                        fontSize: 22
                    }}
                >
                    ←
                </button>

                <h2>Payment</h2>

                <span>
                    {tableNumber}
                </span>
            </header>

            <main
                style={{
                    width: '100%',
                    maxWidth: 550,
                    margin: '0 auto',
                    padding: 18
                }}
            >
                <section
                    style={{
                        padding: 18,
                        marginBottom: 15,
                        borderRadius: 12,
                        background: 'white'
                    }}
                >
                    <h3>Order Summary</h3>

                    {customer.name && (
                        <p
                            style={{
                                marginTop: 8,
                                color: '#666'
                            }}
                        >
                            👤 {customer.name}
                        </p>
                    )}

                    <div style={{ marginTop: 12 }}>
                        {cart.map(item => (
                            <div
                                key={item.id}
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
                        ))}
                    </div>

                    <div
                        style={{
                            marginTop: 13,
                            paddingTop: 12,
                            borderTop:
                                '1px solid #ddd'
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
                                ₹{cartTotal.toFixed(2)}
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
                                ₹{tax.toFixed(2)}
                            </span>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent:
                                    'space-between',
                                marginTop: 9,
                                fontWeight: 'bold',
                                fontSize: 18
                            }}
                        >
                            <span>Total</span>
                            <span>
                                ₹{total.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </section>

                <section
                    style={{
                        padding: 18,
                        marginBottom: 15,
                        borderRadius: 12,
                        background: 'white'
                    }}
                >
                    <h3>Payment Method</h3>

                    {[
                        ['cash', '💵 Cash on Table'],
                        ['card', '💳 Credit/Debit Card'],
                        ['upi', '📱 UPI'],
                        ['netbanking', '🏦 Net Banking']
                    ].map(([value, label]) => (
                        <label
                            key={value}
                            style={{
                                display: 'block',
                                padding: 13,
                                marginTop: 9,
                                borderRadius: 9,
                                cursor: 'pointer',
                                border:
                                    paymentMethod === value
                                        ? '2px solid #c49a6c'
                                        : '2px solid #eee',
                                background:
                                    paymentMethod === value
                                        ? '#fff8f0'
                                        : 'white'
                            }}
                        >
                            <input
                                type="radio"
                                name="payment"
                                value={value}
                                checked={
                                    paymentMethod === value
                                }
                                onChange={() => {
                                    setPaymentMethod(value);
                                    setErrors({});
                                }}
                                style={{
                                    marginRight: 10
                                }}
                            />

                            {label}
                        </label>
                    ))}
                </section>

                {paymentMethod === 'card' && (
                    <section
                        style={{
                            padding: 18,
                            marginBottom: 15,
                            borderRadius: 12,
                            background: 'white'
                        }}
                    >
                        <h3>Card Details</h3>

                        <p
                            style={{
                                marginTop: 6,
                                color: '#777',
                                fontSize: 12
                            }}
                        >
                            Demo validation only. Card details
                            are not sent to the backend.
                        </p>

                        <input
                            placeholder="Card number"
                            value={cardNumber}
                            maxLength={23}
                            onChange={event => {
                                setCardNumber(
                                    formatCardNumber(
                                        event.target.value
                                    )
                                );

                                setErrors({});
                            }}
                            style={inputStyle(
                                errors.cardNumber
                            )}
                        />

                        {errors.cardNumber && (
                            <ErrorText>
                                {errors.cardNumber}
                            </ErrorText>
                        )}

                        <input
                            placeholder="Name on card"
                            value={cardName}
                            onChange={event => {
                                setCardName(
                                    event.target.value
                                );

                                setErrors({});
                            }}
                            style={inputStyle(
                                errors.cardName
                            )}
                        />

                        {errors.cardName && (
                            <ErrorText>
                                {errors.cardName}
                            </ErrorText>
                        )}

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns:
                                    '1fr 1fr',
                                gap: 10
                            }}
                        >
                            <div>
                                <input
                                    placeholder="Expiry MM/YY"
                                    value={expiry}
                                    maxLength={5}
                                    inputMode="numeric"
                                    onChange={event => {
                                        setExpiry(
                                            formatExpiry(
                                                event.target
                                                    .value
                                            )
                                        );

                                        setErrors({});
                                    }}
                                    style={inputStyle(
                                        errors.expiry
                                    )}
                                />

                                {errors.expiry && (
                                    <ErrorText>
                                        {errors.expiry}
                                    </ErrorText>
                                )}
                            </div>

                            <div>
                                <input
                                    type="password"
                                    placeholder="CVV"
                                    value={cvv}
                                    maxLength={4}
                                    inputMode="numeric"
                                    onChange={event => {
                                        setCvv(
                                            event.target.value
                                                .replace(
                                                    /\D/g,
                                                    ''
                                                )
                                                .slice(0, 4)
                                        );

                                        setErrors({});
                                    }}
                                    style={inputStyle(
                                        errors.cvv
                                    )}
                                />

                                {errors.cvv && (
                                    <ErrorText>
                                        {errors.cvv}
                                    </ErrorText>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {paymentMethod === 'upi' && (
                    <section
                        style={{
                            padding: 18,
                            marginBottom: 15,
                            borderRadius: 12,
                            background: 'white'
                        }}
                    >
                        <h3>UPI Details</h3>

                        <input
                            placeholder="example@upi"
                            value={upiId}
                            onChange={event => {
                                setUpiId(
                                    event.target.value
                                );

                                setErrors({});
                            }}
                            style={inputStyle(
                                errors.upi
                            )}
                        />

                        {errors.upi && (
                            <ErrorText>
                                {errors.upi}
                            </ErrorText>
                        )}
                    </section>
                )}

                {paymentMethod ===
                    'netbanking' && (
                    <section
                        style={{
                            padding: 18,
                            marginBottom: 15,
                            borderRadius: 12,
                            background: 'white'
                        }}
                    >
                        <h3>Select Bank</h3>

                        <select
                            value={bankName}
                            onChange={event => {
                                setBankName(
                                    event.target.value
                                );

                                setErrors({});
                            }}
                            style={inputStyle(
                                errors.bank
                            )}
                        >
                            <option value="">
                                -- Select Bank --
                            </option>

                            <option value="sbi">
                                State Bank of India
                            </option>

                            <option value="hdfc">
                                HDFC Bank
                            </option>

                            <option value="icici">
                                ICICI Bank
                            </option>

                            <option value="axis">
                                Axis Bank
                            </option>

                            <option value="kotak">
                                Kotak Mahindra Bank
                            </option>
                        </select>

                        {errors.bank && (
                            <ErrorText>
                                {errors.bank}
                            </ErrorText>
                        )}
                    </section>
                )}

                <section
                    style={{
                        padding: 18,
                        marginBottom: 15,
                        borderRadius: 12,
                        background: 'white'
                    }}
                >
                    <h3>Special Instructions</h3>

                    <textarea
                        rows={3}
                        placeholder="Optional instructions"
                        value={instructions}
                        onChange={event =>
                            setInstructions(
                                event.target.value
                            )
                        }
                        style={{
                            width: '100%',
                            padding: 11,
                            marginTop: 10,
                            border: '2px solid #ddd',
                            borderRadius: 8,
                            fontFamily: 'inherit'
                        }}
                    />
                </section>

                {errors.submit && (
                    <div
                        style={{
                            padding: 12,
                            marginBottom: 12,
                            borderRadius: 8,
                            background: '#ffebee',
                            color: '#c62828'
                        }}
                    >
                        {errors.submit}
                    </div>
                )}

                <button
                    type="button"
                    disabled={placing}
                    onClick={placeOrder}
                    style={{
                        width: '100%',
                        padding: 16,
                        border: 'none',
                        borderRadius: 12,
                        background: placing
                            ? '#999'
                            : '#2c1810',
                        color: 'white',
                        cursor: placing
                            ? 'not-allowed'
                            : 'pointer',
                        fontSize: 17,
                        fontWeight: 'bold'
                    }}
                >
                    {placing
                        ? 'Processing...'
                        : paymentMethod === 'cash'
                          ? `Place Order · ₹${total.toFixed(2)}`
                          : `Pay & Place Order · ₹${total.toFixed(2)}`}
                </button>
            </main>
        </div>
    );
}

function inputStyle(hasError) {
    return {
        width: '100%',
        padding: 11,
        marginTop: 11,
        border: hasError
            ? '2px solid #f44336'
            : '2px solid #ddd',
        borderRadius: 8,
        background: 'white'
    };
}

function ErrorText({ children }) {
    return (
        <p
            style={{
                marginTop: 5,
                color: '#f44336',
                fontSize: 12
            }}
        >
            {children}
        </p>
    );
}

export default CheckoutPage;