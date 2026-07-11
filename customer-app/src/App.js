import React from 'react';

import {
    BrowserRouter,
    Route,
    Routes
} from 'react-router-dom';

import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import CustomerDetails from './pages/CustomerDetails';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmed from './pages/OrderConfirmed';
import MyOrders from './pages/MyOrders';

import './App.css';

function HomePage() {
    return (
        <div
            style={{
                minHeight: '100vh',
                padding: 20,

                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 15,

                background: '#2c1810',
                color: 'white',
                textAlign: 'center'
            }}
        >
            <div style={{ fontSize: 65 }}>☕</div>

            <h1>Welcome to Our Café</h1>

            <p>
                Scan the QR code on your table to order.
            </p>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/"
                    element={<HomePage />}
                />

                <Route
                    path="/order"
                    element={<MenuPage />}
                />

                <Route
                    path="/cart"
                    element={<CartPage />}
                />

                <Route
                    path="/customer-details"
                    element={<CustomerDetails />}
                />

                <Route
                    path="/checkout"
                    element={<CheckoutPage />}
                />

                <Route
                    path="/order-confirmed/:orderId"
                    element={<OrderConfirmed />}
                />

                <Route
                    path="/my-orders"
                    element={<MyOrders />}
                />

                <Route
                    path="*"
                    element={<HomePage />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;