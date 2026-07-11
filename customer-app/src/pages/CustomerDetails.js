import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function CustomerDetails() {
    const navigate = useNavigate();
    const location = useLocation();
    const { cart, cartTotal, sessionToken, tableNumber } = location.state || {};
    
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState({});

    const validate = () => {
        const errs = {};
        if (!name.trim()) errs.name = 'Name is required';
        if (!phone.trim()) errs.phone = 'Phone is required';
        else if (!/^\d{10}$/.test(phone.replace(/\s/g, ''))) errs.phone = 'Enter valid 10-digit number';
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter valid email';
        return errs;
    };

    const saveAndProceed = async () => {
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        // Save customer info
        await fetch('http://192.168.1.3:5000/api/customer', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ name, phone, email })
        });

        navigate('/checkout', {
            state: { cart, cartTotal, sessionToken, tableNumber, customer: { name, phone, email } }
        });
    };

    return (
        <div style={{ minHeight: '100vh', background: '#faf7f2' }}>
            <header style={{ background: '#2c1810', color: 'white', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 15 }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.3em', cursor: 'pointer' }}>←</button>
                <h1 style={{ fontSize: '1.2em', margin: 0 }}>Your Details</h1>
            </header>

            <div style={{ maxWidth: 450, margin: '0 auto', padding: 20 }}>
                <div style={{ background: 'white', borderRadius: 16, padding: 25, boxShadow: '0 2px 15px rgba(0,0,0,0.05)' }}>
                    <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 20, textAlign: 'center' }}>
                        Enter your details to proceed with the order
                    </p>

                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', color: '#2c1810', fontWeight: 'bold', marginBottom: 5, fontSize: '0.9em' }}>
                            Full Name *
                        </label>
                        <input
                            placeholder="e.g. Rahul Sharma"
                            value={name}
                            onChange={e => { setName(e.target.value); setErrors({...errors, name: ''}); }}
                            style={{
                                width: '100%', padding: 12, border: errors.name ? '2px solid #ff4444' : '2px solid #ddd',
                                borderRadius: 8, fontSize: '0.95em', outline: 'none'
                            }}
                        />
                        {errors.name && <p style={{ color: '#ff4444', fontSize: '0.8em', margin: '5px 0 0' }}>{errors.name}</p>}
                    </div>

                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', color: '#2c1810', fontWeight: 'bold', marginBottom: 5, fontSize: '0.9em' }}>
                            Phone Number *
                        </label>
                        <input
                            type="tel"
                            placeholder="e.g. 9876543210"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); setErrors({...errors, phone: ''}); }}
                            style={{
                                width: '100%', padding: 12, border: errors.phone ? '2px solid #ff4444' : '2px solid #ddd',
                                borderRadius: 8, fontSize: '0.95em', outline: 'none'
                            }}
                        />
                        {errors.phone && <p style={{ color: '#ff4444', fontSize: '0.8em', margin: '5px 0 0' }}>{errors.phone}</p>}
                    </div>

                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', color: '#2c1810', fontWeight: 'bold', marginBottom: 5, fontSize: '0.9em' }}>
                            Email <span style={{ color: '#999', fontWeight: 'normal' }}>(optional)</span>
                        </label>
                        <input
                            type="email"
                            placeholder="e.g. rahul@email.com"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setErrors({...errors, email: ''}); }}
                            style={{
                                width: '100%', padding: 12, border: errors.email ? '2px solid #ff4444' : '2px solid #ddd',
                                borderRadius: 8, fontSize: '0.95em', outline: 'none'
                            }}
                        />
                        {errors.email && <p style={{ color: '#ff4444', fontSize: '0.8em', margin: '5px 0 0' }}>{errors.email}</p>}
                    </div>

                    <button
                        onClick={saveAndProceed}
                        style={{
                            width: '100%', padding: 14, background: '#2c1810', color: 'white',
                            border: 'none', borderRadius: 10, fontSize: '1.05em', fontWeight: 'bold',
                            cursor: 'pointer', marginTop: 10
                        }}
                    >
                        Proceed to Payment →
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CustomerDetails;