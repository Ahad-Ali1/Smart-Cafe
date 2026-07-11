require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');

/* =========================================================
   APPLICATION CONFIGURATION
========================================================= */

const app = express();
const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET =
    process.env.JWT_SECRET || 'change_this_secret';
const FRONTEND_URL =
    process.env.FRONTEND_URL ||
    'http://192.168.1.3:3000';

const ACTIVE_ORDER_STATUSES = [
    'pending',
    'preparing',
    'ready'
];

const PAYMENT_METHODS = [
    'cash',
    'card',
    'upi',
    'netbanking'
];

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT']
    }
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(
    '/kitchen',
    express.static(
        path.join(
            __dirname,
            '..',
            'kitchen-display'
        )
    )
);

/* =========================================================
   SQLITE DATABASE
========================================================= */

const db = new Database(
    path.join(__dirname, 'cafe.db')
);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

/* =========================================================
   CREATE DATABASE TABLES
========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_number TEXT UNIQUE NOT NULL,
        qr_code TEXT,
        qr_token TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        capacity INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'vacant'
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price REAL NOT NULL,
        is_available INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (category_id)
            REFERENCES menu_categories(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        session_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT DEFAULT '',
        items TEXT NOT NULL,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        special_instructions TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (table_id)
            REFERENCES tables(id)
    );
`);

/* =========================================================
   MIGRATE OLDER DATABASE FILES
========================================================= */

function getTableColumns(tableName) {
    return db
        .prepare(`PRAGMA table_info(${tableName})`)
        .all()
        .map(column => column.name);
}

function addColumnIfMissing(
    tableName,
    columnName,
    definition
) {
    const columns = getTableColumns(tableName);

    if (!columns.includes(columnName)) {
        db.exec(`
            ALTER TABLE ${tableName}
            ADD COLUMN ${columnName} ${definition}
        `);
    }
}

addColumnIfMissing(
    'tables',
    'qr_code',
    'TEXT'
);

addColumnIfMissing(
    'tables',
    'qr_token',
    'TEXT'
);

addColumnIfMissing(
    'tables',
    'is_active',
    'INTEGER DEFAULT 1'
);

addColumnIfMissing(
    'tables',
    'capacity',
    'INTEGER DEFAULT 4'
);

addColumnIfMissing(
    'tables',
    'status',
    "TEXT DEFAULT 'vacant'"
);

addColumnIfMissing(
    'orders',
    'customer_name',
    "TEXT DEFAULT 'Guest'"
);

addColumnIfMissing(
    'orders',
    'customer_phone',
    "TEXT DEFAULT ''"
);

addColumnIfMissing(
    'orders',
    'customer_email',
    "TEXT DEFAULT ''"
);

addColumnIfMissing(
    'orders',
    'special_instructions',
    "TEXT DEFAULT ''"
);

addColumnIfMissing(
    'orders',
    'status',
    "TEXT DEFAULT 'pending'"
);

addColumnIfMissing(
    'orders',
    'created_at',
    'TEXT'
);

addColumnIfMissing(
    'orders',
    'updated_at',
    'TEXT'
);

const migrationTime = new Date().toISOString();

db.prepare(`
    UPDATE orders
    SET created_at = ?
    WHERE created_at IS NULL
       OR created_at = ''
`).run(migrationTime);

db.prepare(`
    UPDATE orders
    SET updated_at = created_at
    WHERE updated_at IS NULL
       OR updated_at = ''
`).run();

db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_orders_table_id
    ON orders(table_id);

    CREATE INDEX IF NOT EXISTS
    idx_orders_status
    ON orders(status);

    CREATE INDEX IF NOT EXISTS
    idx_orders_created_at
    ON orders(created_at);
`);

/* =========================================================
   CREATE TABLES TN01 TO TN50
========================================================= */

const insertCafeTable = db.prepare(`
    INSERT OR IGNORE INTO tables (
        table_number,
        capacity,
        is_active,
        status
    )
    VALUES (?, ?, 1, 'vacant')
`);

const seedCafeTables = db.transaction(() => {
    for (
        let number = 1;
        number <= 50;
        number += 1
    ) {
        const tableNumber =
            `TN${String(number).padStart(2, '0')}`;

        let capacity = 4;

        if (number <= 10) {
            capacity = 2;
        }

        if (number >= 31) {
            capacity = 6;
        }

        insertCafeTable.run(
            tableNumber,
            capacity
        );
    }
});

seedCafeTables();

/* =========================================================
   MENU DATA
========================================================= */

const menuSeed = [
    {
        category: '☕ Coffee',
        items: [
            ['Espresso', 120],
            ['Americano', 150],
            ['Cappuccino', 180],
            ['Latte', 190],
            ['Flat White', 200],
            ['Mocha', 220],
            ['Macchiato', 160],
            ['Cold Coffee', 200],
            ['Iced Latte', 210],
            ['Irish Coffee (Non-Alcoholic)', 250]
        ]
    },
    {
        category: '🫖 Tea',
        items: [
            ['Masala Tea', 60],
            ['Green Tea', 80],
            ['Lemon Tea', 70],
            ['Ginger Tea', 70],
            ['Black Tea', 50],
            ['Elaichi Tea', 70],
            ['Iced Tea (Lemon/Peach)', 120]
        ]
    },
    {
        category: '🥤 Cold Beverages',
        items: [
            ['Chocolate Shake', 180],
            ['Oreo Shake', 200],
            ['KitKat Shake', 220],
            ['Vanilla Shake', 160],
            ['Strawberry Shake', 180],
            ['Mango Shake', 190],
            ['Fresh Lime Soda', 100],
            ['Virgin Mojito', 150],
            ['Blue Lagoon', 160],
            ['Cold Chocolate', 170]
        ]
    },
    {
        category: '🧃 Fresh Juices',
        items: [
            ['Orange Juice', 140],
            ['Watermelon Juice', 120],
            ['Pineapple Juice', 130],
            ['Apple Juice', 140],
            ['Mixed Fruit Juice', 160]
        ]
    },
    {
        category: '🥪 Sandwiches',
        items: [
            ['Veg Grilled Sandwich', 150],
            ['Cheese Grilled Sandwich', 170],
            ['Corn & Cheese Sandwich', 180],
            ['Paneer Tikka Sandwich', 200],
            ['Club Sandwich', 220],
            ['Chicken Grilled Sandwich', 230]
        ]
    },
    {
        category: '🍕 Pizza',
        items: [
            ['Margherita Pizza', 250],
            ['Farm Fresh Pizza', 300],
            ['Veg Loaded Pizza', 320],
            ['Paneer Tikka Pizza', 350],
            ['Chicken BBQ Pizza', 380]
        ]
    },
    {
        category: '🍔 Burgers',
        items: [
            ['Veg Burger', 120],
            ['Cheese Burger', 150],
            ['Crispy Veg Burger', 160],
            ['Paneer Burger', 180],
            ['Chicken Burger', 200]
        ]
    },
    {
        category: '🍟 Snacks',
        items: [
            ['French Fries', 120],
            ['Peri Peri Fries', 150],
            ['Cheese Fries', 170],
            ['Garlic Bread', 140],
            ['Nachos with Cheese', 180],
            ['Veg Nuggets', 150],
            ['Chicken Nuggets', 180]
        ]
    },
    {
        category: '🍝 Pasta',
        items: [
            ['White Sauce Pasta', 200],
            ['Red Sauce Pasta', 190],
            ['Pink Sauce Pasta', 220],
            ['Alfredo Pasta', 230],
            ['Arrabbiata Pasta', 210]
        ]
    },
    {
        category: '🌯 Wraps & Rolls',
        items: [
            ['Veg Wrap', 150],
            ['Paneer Wrap', 180],
            ['Chicken Wrap', 200],
            ['Cheese Roll', 160]
        ]
    },
    {
        category: '🍜 Noodles',
        items: [
            ['Veg Hakka Noodles', 180],
            ['Schezwan Noodles', 200],
            ['Chicken Noodles', 220]
        ]
    },
    {
        category: '🍚 Rice',
        items: [
            ['Veg Fried Rice', 180],
            ['Schezwan Fried Rice', 200],
            ['Chicken Fried Rice', 220]
        ]
    },
    {
        category: '🥗 Salads',
        items: [
            ['Green Salad', 140],
            ['Caesar Salad', 180],
            ['Greek Salad', 190],
            ['Paneer Salad', 200]
        ]
    },
    {
        category: '🍰 Desserts',
        items: [
            ['Brownie', 150],
            ['Brownie with Ice Cream', 220],
            ['Chocolate Pastry', 160],
            ['Red Velvet Pastry', 180],
            ['Cheesecake', 200],
            ['Tiramisu', 220],
            ['Ice Cream Sundae', 190]
        ]
    },
    {
        category: '🧇 Waffles & Pancakes',
        items: [
            ['Classic Waffle', 180],
            ['Chocolate Waffle', 220],
            ['Nutella Waffle', 250],
            ['Honey Pancakes', 170],
            ['Chocolate Pancakes', 200]
        ]
    },
    {
        category: '🍪 Bakery',
        items: [
            ['Chocolate Muffin', 120],
            ['Blueberry Muffin', 130],
            ['Croissant', 100],
            ['Garlic Croissant', 120],
            ['Cookies', 80],
            ['Donut', 90]
        ]
    },
    {
        category: '🍨 Ice Cream',
        items: [
            ['Vanilla', 100],
            ['Chocolate', 100],
            ['Butterscotch', 120],
            ['Strawberry', 100],
            ['Mango', 120],
            ['Black Currant', 120]
        ]
    },
    {
        category: '🥤 Mocktails',
        items: [
            ['Virgin Mojito', 150],
            ['Blue Lagoon', 160],
            ['Green Apple Mojito', 170],
            ['Watermelon Cooler', 140],
            ['Mint Cooler', 130],
            ['Kiwi Blast', 160]
        ]
    }
];

const findCategory = db.prepare(`
    SELECT id
    FROM menu_categories
    WHERE name = ?
`);

const insertCategory = db.prepare(`
    INSERT INTO menu_categories (
        name,
        display_order
    )
    VALUES (?, ?)
`);

const updateCategoryOrder = db.prepare(`
    UPDATE menu_categories
    SET display_order = ?
    WHERE id = ?
`);

const findMenuItem = db.prepare(`
    SELECT id
    FROM menu_items
    WHERE category_id = ?
      AND name = ?
`);

const insertMenuItem = db.prepare(`
    INSERT INTO menu_items (
        category_id,
        name,
        description,
        price,
        is_available
    )
    VALUES (?, ?, ?, ?, 1)
`);

const seedMenu = db.transaction(() => {
    menuSeed.forEach(
        (categoryData, categoryIndex) => {
            let category = findCategory.get(
                categoryData.category
            );

            let categoryId;

            if (!category) {
                const result = insertCategory.run(
                    categoryData.category,
                    categoryIndex + 1
                );

                categoryId =
                    Number(result.lastInsertRowid);
            } else {
                categoryId = category.id;

                updateCategoryOrder.run(
                    categoryIndex + 1,
                    categoryId
                );
            }

            categoryData.items.forEach(
                ([itemName, itemPrice]) => {
                    const existingItem =
                        findMenuItem.get(
                            categoryId,
                            itemName
                        );

                    if (!existingItem) {
                        insertMenuItem.run(
                            categoryId,
                            itemName,
                            `Freshly prepared ${itemName}`,
                            itemPrice
                        );
                    }
                }
            );
        }
    );
});

seedMenu();

/* =========================================================
   IN-MEMORY CUSTOMER SESSIONS
========================================================= */

const sessions = new Map();

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function roundMoney(amount) {
    return (
        Math.round(
            (Number(amount) +
                Number.EPSILON) *
                100
        ) / 100
    );
}

function validatePhone(phone) {
    return /^\d{10}$/.test(
        String(phone || '').trim()
    );
}

function parseDatabaseDate(value) {
    if (!value) {
        return new Date(NaN);
    }

    if (
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
            value
        )
    ) {
        return new Date(
            value.replace(' ', 'T') + 'Z'
        );
    }

    return new Date(value);
}

function parseItems(items) {
    if (Array.isArray(items)) {
        return items;
    }

    try {
        return JSON.parse(items || '[]');
    } catch {
        return [];
    }
}

function getOrderTotals(cart) {
    const subtotal = roundMoney(
        cart.reduce(
            (sum, item) =>
                sum +
                Number(item.price) *
                    Number(item.quantity),
            0
        )
    );

    const tax = roundMoney(
        subtotal * 0.18
    );

    const total = roundMoney(
        subtotal + tax
    );

    return {
        subtotal,
        tax,
        total
    };
}

function serializeOrder(order) {
    const createdDate =
        parseDatabaseDate(
            order.created_at
        );

    const updatedDate =
        parseDatabaseDate(
            order.updated_at
        );

    return {
        ...order,

        created_at_iso:
            Number.isNaN(
                createdDate.getTime()
            )
                ? null
                : createdDate.toISOString(),

        created_at_ms:
            Number.isNaN(
                createdDate.getTime()
            )
                ? null
                : createdDate.getTime(),

        updated_at_iso:
            Number.isNaN(
                updatedDate.getTime()
            )
                ? null
                : updatedDate.toISOString()
    };
}

function calculateSecureCart(requestedItems) {
    if (
        !Array.isArray(requestedItems) ||
        requestedItems.length === 0
    ) {
        throw new Error('Cart is empty');
    }

    const getMenuItem = db.prepare(`
        SELECT
            id,
            name,
            price
        FROM menu_items
        WHERE id = ?
          AND is_available = 1
    `);

    return requestedItems.map(
        requestedItem => {
            const itemId =
                Number(requestedItem.id);

            const quantity =
                Number(
                    requestedItem.quantity
                );

            if (
                !Number.isInteger(itemId) ||
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > 50
            ) {
                throw new Error(
                    'Invalid item or quantity'
                );
            }

            const menuItem =
                getMenuItem.get(itemId);

            if (!menuItem) {
                throw new Error(
                    `Menu item ${itemId} is not available`
                );
            }

            return {
                id: menuItem.id,
                name: menuItem.name,
                price: Number(
                    menuItem.price
                ),
                quantity
            };
        }
    );
}

function refreshTableStatus(tableId) {
    const activeOrderCount =
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM orders
            WHERE table_id = ?
              AND status IN (
                  'pending',
                  'preparing',
                  'ready'
              )
        `).get(tableId).count;

    const tableStatus =
        activeOrderCount > 0
            ? 'occupied'
            : 'vacant';

    db.prepare(`
        UPDATE tables
        SET status = ?
        WHERE id = ?
    `).run(
        tableStatus,
        tableId
    );

    io.emit(
        'table-status-updated',
        {
            tableId,
            status: tableStatus
        }
    );

    return tableStatus;
}

function emitNewOrder(order) {
    const payload = {
        orderId: order.id,
        tableId: order.table_id,
        tableNumber: order.table_number,
        customerName:
            order.customer_name,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total_amount,
        paymentMethod:
            order.payment_method,
        specialInstructions:
            order.special_instructions,
        status: order.status,
        timestamp: order.created_at
    };

    io.to('kitchen-room').emit(
        'new-order',
        payload
    );

    io.to('admin-room').emit(
        'new-order',
        payload
    );
}

function changeOrderStatus(
    orderId,
    nextStatus
) {
    const order = db.prepare(`
        SELECT *
        FROM orders
        WHERE id = ?
    `).get(orderId);

    if (!order) {
        const error = new Error(
            'Order not found'
        );

        error.statusCode = 404;
        throw error;
    }

    const validTransitions = {
        pending: [
            'preparing',
            'ready',
            'cancelled'
        ],
        preparing: [
            'ready',
            'cancelled'
        ],
        ready: [
            'delivered',
            'cancelled'
        ],
        delivered: [],
        cancelled: []
    };

    const allowedStatuses =
        validTransitions[order.status] || [];

    if (
        !allowedStatuses.includes(
            nextStatus
        )
    ) {
        const error = new Error(
            `Order cannot change from ${order.status} to ${nextStatus}`
        );

        error.statusCode = 409;
        throw error;
    }

    const updatedAt =
        new Date().toISOString();

    db.prepare(`
        UPDATE orders
        SET status = ?,
            updated_at = ?
        WHERE id = ?
    `).run(
        nextStatus,
        updatedAt,
        orderId
    );

    /*
       A table becomes vacant only when the
       delivered/cancelled order was the last
       active order for that table.
    */
    if (
        nextStatus === 'delivered' ||
        nextStatus === 'cancelled'
    ) {
        refreshTableStatus(
            order.table_id
        );
    }

    const updatedOrder = db.prepare(`
        SELECT
            o.*,
            t.table_number
        FROM orders o
        LEFT JOIN tables t
            ON t.id = o.table_id
        WHERE o.id = ?
    `).get(orderId);

    const serializedOrder =
        serializeOrder(updatedOrder);

    io.emit(
        'order-status-updated',
        serializedOrder
    );

    if (order.session_id) {
        io.to(
            `customer-${order.session_id}`
        ).emit(
            'order-status-updated',
            {
                orderId,
                status: nextStatus
            }
        );
    }

    return serializedOrder;
}

/* =========================================================
   CUSTOMER SESSION AUTHENTICATION
========================================================= */

function authenticateSession(
    req,
    res,
    next
) {
    const authorization =
        req.headers.authorization;

    if (
        !authorization ||
        !authorization.startsWith(
            'Bearer '
        )
    ) {
        return res.status(401).json({
            success: false,
            error:
                'Session token is required'
        });
    }

    const token =
        authorization.split(' ')[1];

    try {
        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        const session =
            sessions.get(
                decoded.sessionId
            );

        if (!session) {
            return res.status(401).json({
                success: false,
                error: 'Session expired'
            });
        }

        req.sessionId =
            decoded.sessionId;

        req.tableId =
            decoded.tableId;

        req.session = session;

        next();
    } catch {
        return res.status(401).json({
            success: false,
            error: 'Invalid session'
        });
    }
}

/* =========================================================
   TEST ROUTE
========================================================= */

app.get('/', (req, res) => {
    res.json({
        success: true,
        message:
            'Cafe API is running'
    });
});

/* =========================================================
   TABLE ENDPOINTS
========================================================= */

app.get('/api/tables', (req, res) => {
    const tables = db.prepare(`
        SELECT *
        FROM tables
        WHERE is_active = 1
        ORDER BY table_number
    `).all();

    res.json({
        success: true,
        tables
    });
});

/* =========================================================
   GENERATE QR CODE

   QR cannot be generated or regenerated while
   the table is occupied.
========================================================= */

app.post(
    '/api/tables/:tableId/generate-qr',
    async (req, res) => {
        try {
            const tableId =
                Number(
                    req.params.tableId
                );

            if (
                !Number.isInteger(
                    tableId
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Invalid table'
                    });
            }

            const table =
                db.prepare(`
                    SELECT *
                    FROM tables
                    WHERE id = ?
                      AND is_active = 1
                `).get(tableId);

            if (!table) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        error:
                            'Table not found'
                    });
            }

            if (
                table.status ===
                'occupied'
            ) {
                return res
                    .status(409)
                    .json({
                        success: false,
                        error:
                            `${table.table_number} is occupied`
                    });
            }

            const tableSecret =
                `${JWT_SECRET}_table_${tableId}`;

            const token = jwt.sign(
                {
                    tableId,
                    type: 'table_order'
                },
                tableSecret,
                {
                    expiresIn: '365d'
                }
            );

            const orderUrl =
                `${FRONTEND_URL}/order?token=${encodeURIComponent(
                    token
                )}`;

            const qrImage =
                await QRCode.toDataURL(
                    orderUrl,
                    {
                        width: 500,
                        margin: 3,
                        errorCorrectionLevel:
                            'H',
                        color: {
                            dark:
                                '#2c1810',
                            light:
                                '#ffffff'
                        }
                    }
                );

            db.prepare(`
                UPDATE tables
                SET qr_code = ?,
                    qr_token = ?
                WHERE id = ?
            `).run(
                qrImage,
                token,
                tableId
            );

            const updatedTable =
                db.prepare(`
                    SELECT *
                    FROM tables
                    WHERE id = ?
                `).get(tableId);

            res.json({
                success: true,
                table: updatedTable,
                qrCode: qrImage,
                url: orderUrl
            });
        } catch (error) {
            console.error(
                'QR error:',
                error
            );

            res.status(500).json({
                success: false,
                error:
                    'Failed to generate QR code'
            });
        }
    }
);

/* =========================================================
   VALIDATE QR AND CREATE CUSTOMER SESSION
========================================================= */

app.post(
    '/api/tables/validate-session',
    (req, res) => {
        try {
            const { token } = req.body;

            if (!token) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'QR token is required'
                    });
            }

            const decoded =
                jwt.decode(token);

            if (
                !decoded ||
                !decoded.tableId
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Invalid QR code'
                    });
            }

            const tableSecret =
                `${JWT_SECRET}_table_${decoded.tableId}`;

            const verified =
                jwt.verify(
                    token,
                    tableSecret
                );

            const table =
                db.prepare(`
                    SELECT *
                    FROM tables
                    WHERE id = ?
                      AND is_active = 1
                `).get(
                    verified.tableId
                );

            if (!table) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        error:
                            'Table not available'
                    });
            }

            const sessionId =
                crypto.randomUUID();

            const sessionToken =
                jwt.sign(
                    {
                        sessionId,
                        tableId: table.id
                    },
                    JWT_SECRET,
                    {
                        expiresIn: '2h'
                    }
                );

            sessions.set(
                sessionId,
                {
                    tableId: table.id,
                    tableNumber:
                        table.table_number,
                    customer: {},
                    cart: [],
                    createdAt:
                        new Date().toISOString()
                }
            );

            setTimeout(() => {
                sessions.delete(
                    sessionId
                );
            }, 2 * 60 * 60 * 1000);

            res.json({
                success: true,
                sessionId,
                sessionToken,
                tableId: table.id,
                tableNumber:
                    table.table_number
            });
        } catch {
            res.status(401).json({
                success: false,
                error:
                    'Invalid or expired QR code'
            });
        }
    }
);

/* =========================================================
   MENU ENDPOINT
========================================================= */

app.get('/api/menu', (req, res) => {
    const categories =
        db.prepare(`
            SELECT *
            FROM menu_categories
            ORDER BY display_order, id
        `).all();

    const getCategoryItems =
        db.prepare(`
            SELECT
                id,
                name,
                description,
                price
            FROM menu_items
            WHERE category_id = ?
              AND is_available = 1
            ORDER BY name
        `);

    const menu = {};

    categories.forEach(category => {
        menu[category.name] =
            getCategoryItems.all(
                category.id
            );
    });

    res.json({
        success: true,
        categories,
        menu
    });
});

/* =========================================================
   CART ENDPOINTS
========================================================= */

app.post(
    '/api/cart/add',
    authenticateSession,
    (req, res) => {
        const itemId =
            Number(
                req.body.menuItemId
            );

        const quantity =
            Number(
                req.body.quantity || 1
            );

        if (
            !Number.isInteger(
                itemId
            ) ||
            !Number.isInteger(
                quantity
            ) ||
            quantity < 1 ||
            quantity > 50
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        'Invalid item or quantity'
                });
        }

        const item =
            db.prepare(`
                SELECT
                    id,
                    name,
                    price
                FROM menu_items
                WHERE id = ?
                  AND is_available = 1
            `).get(itemId);

        if (!item) {
            return res
                .status(404)
                .json({
                    success: false,
                    error:
                        'Item not available'
                });
        }

        const existingItem =
            req.session.cart.find(
                cartItem =>
                    cartItem.id === itemId
            );

        if (existingItem) {
            existingItem.quantity +=
                quantity;
        } else {
            req.session.cart.push({
                id: item.id,
                name: item.name,
                price:
                    Number(item.price),
                quantity
            });
        }

        const totals =
            getOrderTotals(
                req.session.cart
            );

        const itemCount =
            req.session.cart.reduce(
                (sum, cartItem) =>
                    sum +
                    cartItem.quantity,
                0
            );

        res.json({
            success: true,
            cart: req.session.cart,
            itemCount,
            total: totals.subtotal
        });
    }
);

app.get(
    '/api/cart',
    authenticateSession,
    (req, res) => {
        const totals =
            getOrderTotals(
                req.session.cart
            );

        const itemCount =
            req.session.cart.reduce(
                (sum, item) =>
                    sum +
                    item.quantity,
                0
            );

        res.json({
            success: true,
            cart: req.session.cart,
            itemCount,
            total: totals.subtotal
        });
    }
);

app.put(
    '/api/cart/update',
    authenticateSession,
    (req, res) => {
        const itemId =
            Number(
                req.body.menuItemId
            );

        const quantity =
            Number(
                req.body.quantity
            );

        if (
            !Number.isInteger(
                itemId
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        'Invalid item'
                });
        }

        if (quantity <= 0) {
            req.session.cart =
                req.session.cart.filter(
                    item =>
                        item.id !== itemId
                );
        } else {
            const item =
                req.session.cart.find(
                    cartItem =>
                        cartItem.id ===
                        itemId
                );

            if (item) {
                item.quantity =
                    Math.min(
                        quantity,
                        50
                    );
            }
        }

        const totals =
            getOrderTotals(
                req.session.cart
            );

        const itemCount =
            req.session.cart.reduce(
                (sum, item) =>
                    sum +
                    item.quantity,
                0
            );

        res.json({
            success: true,
            cart: req.session.cart,
            itemCount,
            total: totals.subtotal
        });
    }
);

/* =========================================================
   SAVE CUSTOMER DETAILS
========================================================= */

app.put(
    '/api/customer',
    authenticateSession,
    (req, res) => {
        const name = String(
            req.body.name || ''
        ).trim();

        const phone = String(
            req.body.phone || ''
        ).trim();

        const email = String(
            req.body.email || ''
        ).trim();

        if (name.length < 2) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        'Full name is required'
                });
        }

        if (!validatePhone(phone)) {
            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        'Valid 10-digit phone number is required'
                });
        }

        req.session.customer = {
            name,
            phone,
            email
        };

        res.json({
            success: true,
            customer:
                req.session.customer
        });
    }
);

/* =========================================================
   CUSTOMER CREATES ORDER
========================================================= */

app.post(
    '/api/orders',
    authenticateSession,
    (req, res) => {
        try {
            const paymentMethod =
                String(
                    req.body.paymentMethod ||
                        ''
                ).toLowerCase();

            const specialInstructions =
                String(
                    req.body
                        .specialInstructions ||
                        ''
                )
                    .trim()
                    .slice(0, 500);

            if (
                !PAYMENT_METHODS.includes(
                    paymentMethod
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Invalid payment method'
                    });
            }

            const customer =
                req.session.customer ||
                {};

            if (
                !customer.name ||
                !validatePhone(
                    customer.phone
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Customer name and phone are required'
                    });
            }

            if (
                !req.session.cart.length
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Cart is empty'
                    });
            }

            const table =
                db.prepare(`
                    SELECT *
                    FROM tables
                    WHERE id = ?
                      AND is_active = 1
                `).get(req.tableId);

            if (!table) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        error:
                            'Table not found'
                    });
            }

            const cart =
                calculateSecureCart(
                    req.session.cart
                );

            const totals =
                getOrderTotals(cart);

            const now =
                new Date().toISOString();

            const createOrder =
                db.transaction(() => {
                    const result =
                        db.prepare(`
                            INSERT INTO orders (
                                table_id,
                                session_id,
                                customer_name,
                                customer_phone,
                                customer_email,
                                items,
                                total_amount,
                                payment_method,
                                special_instructions,
                                status,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                ?, ?, ?, ?, ?, ?,
                                ?, ?, ?,
                                'pending',
                                ?, ?
                            )
                        `).run(
                            table.id,
                            req.sessionId,
                            customer.name,
                            customer.phone,
                            customer.email ||
                                '',
                            JSON.stringify(
                                cart
                            ),
                            totals.total,
                            paymentMethod,
                            specialInstructions,
                            now,
                            now
                        );

                    db.prepare(`
                        UPDATE tables
                        SET status =
                            'occupied'
                        WHERE id = ?
                    `).run(table.id);

                    return Number(
                        result.lastInsertRowid
                    );
                });

            const orderId =
                createOrder();

            const responseOrder = {
                id: orderId,
                table_id:
                    table.id,
                table_number:
                    table.table_number,
                customer_name:
                    customer.name,
                customer_phone:
                    customer.phone,
                customer_email:
                    customer.email || '',
                items: cart,
                subtotal:
                    totals.subtotal,
                tax: totals.tax,
                total_amount:
                    totals.total,
                total:
                    totals.total,
                payment_method:
                    paymentMethod,
                paymentMethod,
                special_instructions:
                    specialInstructions,
                status: 'pending',
                created_at: now,
                created_at_iso:
                    now,
                created_at_ms:
                    new Date(
                        now
                    ).getTime()
            };

            emitNewOrder(
                responseOrder
            );

            io.to(
                `customer-${req.sessionId}`
            ).emit(
                'order-confirmed',
                {
                    orderId,
                    customerName:
                        customer.name,
                    tableNumber:
                        table.table_number,
                    items: cart,
                    subtotal:
                        totals.subtotal,
                    tax:
                        totals.tax,
                    total:
                        totals.total,
                    paymentMethod,
                    status:
                        'pending',
                    createdAt: now
                }
            );

            /*
               Keep session active so the customer
               can order more and view My Orders.
            */
            req.session.cart = [];

            res.status(201).json({
                success: true,
                order: {
                    id: orderId,
                    tableNumber:
                        table.table_number,
                    customerName:
                        customer.name,
                    customerPhone:
                        customer.phone,
                    customerEmail:
                        customer.email ||
                        '',
                    items: cart,
                    subtotal:
                        totals.subtotal,
                    tax:
                        totals.tax,
                    total:
                        totals.total,
                    paymentMethod,
                    status:
                        'pending',
                    createdAt: now
                }
            });
        } catch (error) {
            console.error(
                'Customer order error:',
                error
            );

            res.status(500).json({
                success: false,
                error:
                    'Failed to create order'
            });
        }
    }
);

/* =========================================================
   ADMIN CREATES ORDER

   Admin may add another order to an occupied
   table. QR generation is not used here.
========================================================= */

app.post(
    '/api/admin/orders',
    (req, res) => {
        try {
            const tableId =
                Number(
                    req.body.tableId
                );

            const customerName =
                String(
                    req.body
                        .customerName || ''
                ).trim();

            const customerPhone =
                String(
                    req.body
                        .customerPhone || ''
                ).trim();

            const customerEmail =
                String(
                    req.body
                        .customerEmail || ''
                ).trim();

            const paymentMethod =
                String(
                    req.body
                        .paymentMethod || ''
                ).toLowerCase();

            const specialInstructions =
                String(
                    req.body
                        .specialInstructions ||
                        ''
                )
                    .trim()
                    .slice(0, 500);

            if (
                !Number.isInteger(
                    tableId
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Select a table'
                    });
            }

            if (
                customerName.length < 2
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Customer name is required'
                    });
            }

            if (
                !validatePhone(
                    customerPhone
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Valid 10-digit phone number is required'
                    });
            }

            if (
                !PAYMENT_METHODS.includes(
                    paymentMethod
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Invalid payment method'
                    });
            }

            const table =
                db.prepare(`
                    SELECT *
                    FROM tables
                    WHERE id = ?
                      AND is_active = 1
                `).get(tableId);

            if (!table) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        error:
                            'Table not found'
                    });
            }

            /*
               Occupied table is intentionally allowed.
               Staff may add another order to the same
               occupied table.
            */
            const cart =
                calculateSecureCart(
                    req.body.items
                );

            const totals =
                getOrderTotals(cart);

            const sessionId =
                `admin-${crypto.randomUUID()}`;

            const now =
                new Date().toISOString();

            const createOrder =
                db.transaction(() => {
                    const result =
                        db.prepare(`
                            INSERT INTO orders (
                                table_id,
                                session_id,
                                customer_name,
                                customer_phone,
                                customer_email,
                                items,
                                total_amount,
                                payment_method,
                                special_instructions,
                                status,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                ?, ?, ?, ?, ?, ?,
                                ?, ?, ?,
                                'pending',
                                ?, ?
                            )
                        `).run(
                            table.id,
                            sessionId,
                            customerName,
                            customerPhone,
                            customerEmail,
                            JSON.stringify(
                                cart
                            ),
                            totals.total,
                            paymentMethod,
                            specialInstructions,
                            now,
                            now
                        );

                    db.prepare(`
                        UPDATE tables
                        SET status =
                            'occupied'
                        WHERE id = ?
                    `).run(table.id);

                    return Number(
                        result.lastInsertRowid
                    );
                });

            const orderId =
                createOrder();

            const responseOrder = {
                id: orderId,
                table_id:
                    table.id,
                table_number:
                    table.table_number,
                customer_name:
                    customerName,
                customer_phone:
                    customerPhone,
                customer_email:
                    customerEmail,
                items: cart,
                subtotal:
                    totals.subtotal,
                tax:
                    totals.tax,
                total_amount:
                    totals.total,
                total:
                    totals.total,
                payment_method:
                    paymentMethod,
                special_instructions:
                    specialInstructions,
                status: 'pending',
                created_at: now,
                created_at_iso:
                    now,
                created_at_ms:
                    new Date(
                        now
                    ).getTime()
            };

            emitNewOrder(
                responseOrder
            );

            res.status(201).json({
                success: true,
                order:
                    responseOrder
            });
        } catch (error) {
            console.error(
                'Admin order error:',
                error
            );

            res.status(400).json({
                success: false,
                error:
                    error.message ||
                    'Failed to create order'
            });
        }
    }
);

/* =========================================================
   CUSTOMER MY ORDERS

   Only returns orders for the customer's own
   session. Customers cannot see other tables.
========================================================= */

app.get(
    '/api/customer/orders',
    authenticateSession,
    (req, res) => {
        try {
            const rows =
                db.prepare(`
                    SELECT
                        o.*,
                        t.table_number
                    FROM orders o
                    LEFT JOIN tables t
                        ON t.id =
                           o.table_id
                    WHERE o.session_id = ?
                    ORDER BY o.id DESC
                `).all(
                    req.sessionId
                );

            const orders =
                rows.map(row => {
                    const items =
                        parseItems(
                            row.items
                        );

                    const totals =
                        getOrderTotals(
                            items
                        );

                    return {
                        ...serializeOrder(
                            row
                        ),
                        items,
                        subtotal:
                            totals.subtotal,
                        tax:
                            roundMoney(
                                Number(
                                    row.total_amount
                                ) -
                                    totals.subtotal
                            ),
                        total:
                            Number(
                                row.total_amount
                            )
                    };
                });

            res.json({
                success: true,
                orders
            });
        } catch (error) {
            console.error(
                'Customer orders error:',
                error
            );

            res.status(500).json({
                success: false,
                error:
                    'Could not load your orders'
            });
        }
    }
);

/* =========================================================
   ADMIN GETS ALL ORDERS
========================================================= */

app.get(
    '/api/orders',
    (req, res) => {
        try {
            const orders =
                db.prepare(`
                    SELECT
                        o.*,
                        t.table_number
                    FROM orders o
                    LEFT JOIN tables t
                        ON t.id =
                           o.table_id
                    ORDER BY o.id DESC
                `).all();

            res.json({
                success: true,
                orders:
                    orders.map(
                        serializeOrder
                    )
            });
        } catch (error) {
            console.error(
                'Get orders error:',
                error
            );

            res.status(500).json({
                success: false,
                error:
                    'Failed to load orders'
            });
        }
    }
);

/* =========================================================
   UPDATE ORDER STATUS

   pending/preparing -> ready
   ready -> delivered

   Table becomes vacant only after all active
   orders for the table are completed.
========================================================= */

app.put(
    '/api/orders/:orderId/status',
    (req, res) => {
        try {
            const orderId =
                Number(
                    req.params.orderId
                );

            const status =
                String(
                    req.body.status || ''
                );

            if (
                !Number.isInteger(
                    orderId
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            'Invalid order'
                    });
            }

            const updatedOrder =
                changeOrderStatus(
                    orderId,
                    status
                );

            res.json({
                success: true,
                order:
                    updatedOrder
            });
        } catch (error) {
            res.status(
                error.statusCode ||
                    500
            ).json({
                success: false,
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   DASHBOARD REPORT HELPERS
========================================================= */

function getReportRange(
    mode,
    value
) {
    const now = new Date();

    if (mode === 'month') {
        if (
            !/^\d{4}-\d{2}$/.test(
                value || ''
            )
        ) {
            throw new Error(
                'Invalid month'
            );
        }

        const [year, month] =
            value
                .split('-')
                .map(Number);

        if (
            month < 1 ||
            month > 12
        ) {
            throw new Error(
                'Invalid month'
            );
        }

        const start =
            new Date(
                year,
                month - 1,
                1
            );

        const end =
            new Date(
                year,
                month,
                1
            );

        return {
            start,
            end,
            label:
                start.toLocaleDateString(
                    undefined,
                    {
                        month:
                            'long',
                        year:
                            'numeric'
                    }
                )
        };
    }

    if (mode === 'date') {
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(
                value || ''
            )
        ) {
            throw new Error(
                'Invalid date'
            );
        }

        const [year, month, day] =
            value
                .split('-')
                .map(Number);

        const start =
            new Date(
                year,
                month - 1,
                day
            );

        if (
            start.getFullYear() !==
                year ||
            start.getMonth() !==
                month - 1 ||
            start.getDate() !== day
        ) {
            throw new Error(
                'Invalid date'
            );
        }

        const end =
            new Date(
                year,
                month - 1,
                day + 1
            );

        return {
            start,
            end,
            label:
                start.toLocaleDateString(
                    undefined,
                    {
                        day:
                            'numeric',
                        month:
                            'long',
                        year:
                            'numeric'
                    }
                )
        };
    }

    /*
       Automatic six-month cycle:
       January 1 - June 30
       July 1 - December 31
    */
    const startMonth =
        now.getMonth() < 6
            ? 0
            : 6;

    const start =
        new Date(
            now.getFullYear(),
            startMonth,
            1
        );

    const end =
        new Date(
            now.getFullYear(),
            startMonth + 6,
            1
        );

    const endDisplay =
        new Date(
            end.getFullYear(),
            end.getMonth(),
            0
        );

    return {
        start,
        end,
        label:
            start.toLocaleDateString(
                undefined,
                {
                    month: 'short',
                    year: 'numeric'
                }
            ) +
            ' - ' +
            endDisplay.toLocaleDateString(
                undefined,
                {
                    month: 'short',
                    year: 'numeric'
                }
            )
    };
}

function summarizeOrders(orders) {
    const revenueOrders =
        orders.filter(
            order =>
                order.status !==
                'cancelled'
        );

    return {
        orders: orders.length,

        revenue: roundMoney(
            revenueOrders.reduce(
                (sum, order) =>
                    sum +
                    Number(
                        order.total_amount ||
                            0
                    ),
                0
            )
        )
    };
}

/* =========================================================
   DASHBOARD REPORT API
========================================================= */

app.get(
    '/api/dashboard/stats',
    (req, res) => {
        try {
            const mode =
                [
                    'cycle',
                    'month',
                    'date'
                ].includes(
                    req.query.mode
                )
                    ? req.query.mode
                    : 'cycle';

            const range =
                getReportRange(
                    mode,
                    req.query.value
                );

            const allOrders =
                db.prepare(`
                    SELECT *
                    FROM orders
                    ORDER BY id DESC
                `).all();

            const reportOrders =
                allOrders.filter(
                    order => {
                        const orderDate =
                            parseDatabaseDate(
                                order.created_at
                            );

                        return (
                            !Number.isNaN(
                                orderDate.getTime()
                            ) &&
                            orderDate >=
                                range.start &&
                            orderDate <
                                range.end
                        );
                    }
                );

            const summary =
                summarizeOrders(
                    reportOrders
                );

            const activeTables =
                db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM tables
                    WHERE status =
                        'occupied'
                      AND is_active = 1
                `).get().count;

            const activeOrders =
                db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM orders
                    WHERE status IN (
                        'pending',
                        'preparing',
                        'ready'
                    )
                `).get().count;

            const breakdown = [];

            if (
                mode === 'cycle'
            ) {
                for (
                    let index = 0;
                    index < 6;
                    index += 1
                ) {
                    const bucketStart =
                        new Date(
                            range.start
                                .getFullYear(),
                            range.start
                                .getMonth() +
                                index,
                            1
                        );

                    const bucketEnd =
                        new Date(
                            range.start
                                .getFullYear(),
                            range.start
                                .getMonth() +
                                index +
                                1,
                            1
                        );

                    const bucketOrders =
                        reportOrders.filter(
                            order => {
                                const date =
                                    parseDatabaseDate(
                                        order
                                            .created_at
                                    );

                                return (
                                    date >=
                                        bucketStart &&
                                    date <
                                        bucketEnd
                                );
                            }
                        );

                    breakdown.push({
                        label:
                            bucketStart.toLocaleDateString(
                                undefined,
                                {
                                    month:
                                        'short'
                                }
                            ),

                        ...summarizeOrders(
                            bucketOrders
                        )
                    });
                }
            }

            if (
                mode === 'month'
            ) {
                const daysInMonth =
                    new Date(
                        range.start
                            .getFullYear(),
                        range.start
                            .getMonth() +
                            1,
                        0
                    ).getDate();

                for (
                    let day = 1;
                    day <= daysInMonth;
                    day += 1
                ) {
                    const bucketStart =
                        new Date(
                            range.start
                                .getFullYear(),
                            range.start
                                .getMonth(),
                            day
                        );

                    const bucketEnd =
                        new Date(
                            range.start
                                .getFullYear(),
                            range.start
                                .getMonth(),
                            day + 1
                        );

                    const bucketOrders =
                        reportOrders.filter(
                            order => {
                                const date =
                                    parseDatabaseDate(
                                        order
                                            .created_at
                                    );

                                return (
                                    date >=
                                        bucketStart &&
                                    date <
                                        bucketEnd
                                );
                            }
                        );

                    breakdown.push({
                        label:
                            String(day),

                        ...summarizeOrders(
                            bucketOrders
                        )
                    });
                }
            }

            if (
                mode === 'date'
            ) {
                for (
                    let hour = 0;
                    hour < 24;
                    hour += 1
                ) {
                    const bucketStart =
                        new Date(
                            range.start
                                .getFullYear(),
                            range.start
                                .getMonth(),
                            range.start
                                .getDate(),
                            hour
                        );

                    const bucketEnd =
                        new Date(
                            range.start
                                .getFullYear(),
                            range.start
                                .getMonth(),
                            range.start
                                .getDate(),
                            hour + 1
                        );

                    const bucketOrders =
                        reportOrders.filter(
                            order => {
                                const date =
                                    parseDatabaseDate(
                                        order
                                            .created_at
                                    );

                                return (
                                    date >=
                                        bucketStart &&
                                    date <
                                        bucketEnd
                                );
                            }
                        );

                    breakdown.push({
                        label:
                            `${String(
                                hour
                            ).padStart(
                                2,
                                '0'
                            )}:00`,

                        ...summarizeOrders(
                            bucketOrders
                        )
                    });
                }
            }

            res.json({
                success: true,
                mode,

                period: {
                    label:
                        range.label,

                    start:
                        range.start
                            .toISOString(),

                    endExclusive:
                        range.end
                            .toISOString()
                },

                stats: {
                    totalOrders:
                        summary.orders,

                    totalRevenue:
                        summary.revenue,

                    activeTables,

                    activeOrders
                },

                breakdown
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   SOCKET.IO
========================================================= */

io.on(
    'connection',
    socket => {
        console.log(
            'Socket connected:',
            socket.id
        );

        socket.on(
            'join-customer-room',
            sessionId => {
                if (sessionId) {
                    socket.join(
                        `customer-${sessionId}`
                    );
                }
            }
        );

        socket.on(
            'join-kitchen',
            () => {
                socket.join(
                    'kitchen-room'
                );
            }
        );

        socket.on(
            'join-admin',
            () => {
                socket.join(
                    'admin-room'
                );
            }
        );

        socket.on(
            'order-ready',
            ({ orderId }) => {
                try {
                    changeOrderStatus(
                        Number(orderId),
                        'ready'
                    );
                } catch (error) {
                    socket.emit(
                        'order-status-error',
                        {
                            error:
                                error.message
                        }
                    );
                }
            }
        );

        socket.on(
            'disconnect',
            () => {
                console.log(
                    'Socket disconnected:',
                    socket.id
                );
            }
        );
    }
);

/* =========================================================
   REPAIR TABLE STATUS WHEN SERVER STARTS

   If active orders exist, the table is occupied.
   Otherwise, it is vacant.
========================================================= */

db.prepare(`
    UPDATE tables
    SET status = 'vacant'
    WHERE is_active = 1
`).run();

db.prepare(`
    UPDATE tables
    SET status = 'occupied'
    WHERE id IN (
        SELECT DISTINCT table_id
        FROM orders
        WHERE status IN (
            'pending',
            'preparing',
            'ready'
        )
    )
`).run();

/* =========================================================
   START SERVER
========================================================= */

httpServer.listen(
    PORT,
    '0.0.0.0',
    () => {
        console.log('');
        console.log(
            `Cafe API: http://localhost:${PORT}`
        );
        console.log(
            `Phone API: http://192.168.1.3:${PORT}`
        );
        console.log(
            `Kitchen: http://localhost:${PORT}/kitchen`
        );
        console.log('');
    }
);