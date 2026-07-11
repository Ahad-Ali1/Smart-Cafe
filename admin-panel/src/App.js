import React from 'react';
import {
    BrowserRouter,
    NavLink,
    Route,
    Routes
} from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import TablesPage from './pages/TablesPage';
import PlaceOrder from './pages/PlaceOrder';
import OrdersPage from './pages/OrdersPage';

import './App.css';

function App() {
    return (
        <BrowserRouter>
            <div className="admin-app">
                <nav className="admin-nav">
                    <div className="admin-brand">
                        <span>☕</span>
                        <strong>Café Admin</strong>
                    </div>

                    <div className="admin-links">
                        <NavLink to="/" end>
                            📊 Dashboard
                        </NavLink>

                        <NavLink to="/tables">
                            🪑 Tables
                        </NavLink>

                        <NavLink to="/place-order">
                            🛒 Place Order
                        </NavLink>

                        <NavLink to="/orders">
                            📦 Orders
                        </NavLink>
                    </div>
                </nav>

                <main className="admin-main">
                    <Routes>
                        <Route
                            path="/"
                            element={<Dashboard />}
                        />

                        <Route
                            path="/tables"
                            element={<TablesPage />}
                        />

                        <Route
                            path="/place-order"
                            element={<PlaceOrder />}
                        />

                        <Route
                            path="/orders"
                            element={<OrdersPage />}
                        />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;