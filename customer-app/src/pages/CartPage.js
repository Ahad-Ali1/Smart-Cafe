import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function CartPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { cart: initialCart, cartTotal: initialTotal, sessionToken, tableNumber } = location.state || {};
    
    const [cart, setCart] = useState(initialCart || []);
    const [total, setTotal] = useState(initialTotal || 0);

    const updateQuantity = async (itemId, newQuantity) => {
        try {
            const res = await fetch('http://192.168.1.3:5000/api/cart/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ menuItemId: itemId, quantity: newQuantity })
            });
            const data = await res.json();
            setCart(data.cart);
            setTotal(data.total);
        } catch (err) {
            console.error('Update error:', err);
        }
    };

    const proceedToDetails = () => {
        navigate('/customer-details', {
            state: { cart, cartTotal: total, sessionToken, tableNumber }
        });
    };

    if (cart.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 15, background: '#faf7f2' }}>
                <span style={{ fontSize: 50 }}>🛒</span>
                <h2 style={{ color: '#2c1810' }}>Cart is empty</h2>
                <button onClick={() => navigate(-1)} style={{ background: '#2c1810', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 20, cursor: 'pointer', fontSize: '1em' }}>
                    ← Back to Menu
                </button>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#faf7f2', paddingBottom: 120 }}>
            <header style={{ background: '#2c1810', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.3em', cursor: 'pointer' }}>←</button>
                <h1 style={{ fontSize: '1.2em', margin: 0 }}>Your Cart</h1>
                <span style={{ background: '#c49a6c', padding: '4px 12px', borderRadius: 12, fontSize: '0.85em' }}>Table {tableNumber}</span>
            </header>

            <div style={{ maxWidth: 500, margin: '0 auto', padding: 20 }}>
                {cart.map(item => (
                    <div key={item.id} style={{ background: 'white', borderRadius: 12, padding: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 5px rgba(0,0,0,0.05)' }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, color: '#2c1810', fontSize: '0.95em' }}>{item.name}</h3>
                            <p style={{ margin: '3px 0 0', color: '#888', fontSize: '0.85em' }}>₹{item.price.toFixed(2)} each</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 10 }}>
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                style={{ width: 30, height: 30, borderRadius: 15, border: '2px solid #2c1810', background: 'white', cursor: 'pointer', fontSize: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ fontWeight: 'bold', minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                style={{ width: 30, height: 30, borderRadius: 15, border: '2px solid #2c1810', background: 'white', cursor: 'pointer', fontSize: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                        <span style={{ fontWeight: 'bold', color: '#2c1810', marginLeft: 15, minWidth: 60, textAlign: 'right' }}>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                ))}
            </div>

            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: 20, boxShadow: '0 -3px 15px rgba(0,0,0,0.08)' }}>
                <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '1.1em' }}>
                    <span style={{ color: '#666' }}>Subtotal</span>
                    <span style={{ fontWeight: 'bold', color: '#2c1810' }}>₹{total.toFixed(2)}</span>
                </div>
                <button onClick={proceedToDetails} style={{ width: '100%', padding: 14, background: '#2c1810', color: 'white', border: 'none', borderRadius: 10, fontSize: '1.05em', fontWeight: 'bold', cursor: 'pointer' }}>
                    Proceed to Details →
                </button>
            </div>
        </div>
    );
}

export default CartPage;