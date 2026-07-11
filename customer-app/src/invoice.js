const CAFE_NAME =
    process.env.REACT_APP_CAFE_NAME || 'My Café';

const CAFE_ADDRESS =
    process.env.REACT_APP_CAFE_ADDRESS ||
    'Cafe address not configured';

const CAFE_GSTIN =
    process.env.REACT_APP_CAFE_GSTIN ||
    'GSTIN NOT CONFIGURED';

const CAFE_PHONE =
    process.env.REACT_APP_CAFE_PHONE || '';

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
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

function parseDate(value) {
    if (!value) {
        return new Date();
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
        return new Date(value.replace(' ', 'T') + 'Z');
    }

    return new Date(value);
}

export function normalizeOrder(order = {}) {
    const items = parseItems(order.items);

    const subtotal =
        order.subtotal !== undefined
            ? Number(order.subtotal)
            : items.reduce(
                  (sum, item) =>
                      sum +
                      Number(item.price) *
                          Number(item.quantity),
                  0
              );

    const total = Number(
        order.total ??
            order.total_amount ??
            subtotal * 1.18
    );

    const tax =
        order.tax !== undefined
            ? Number(order.tax)
            : Math.max(0, total - subtotal);

    return {
        id: order.id,
        tableNumber:
            order.tableNumber ||
            order.table_number ||
            order.table_id ||
            '-',

        customerName:
            order.customerName ||
            order.customer_name ||
            'Guest',

        customerPhone:
            order.customerPhone ||
            order.customer_phone ||
            '-',

        customerEmail:
            order.customerEmail ||
            order.customer_email ||
            '',

        paymentMethod:
            order.paymentMethod ||
            order.payment_method ||
            '-',

        status: order.status || 'pending',

        specialInstructions:
            order.specialInstructions ||
            order.special_instructions ||
            '',

        createdAt:
            order.createdAt ||
            order.created_at_iso ||
            order.created_at ||
            new Date().toISOString(),

        items,
        subtotal,
        tax,
        total
    };
}

export function createInvoiceHtml(rawOrder) {
    const order = normalizeOrder(rawOrder);

    const cgst = order.tax / 2;
    const sgst = order.tax / 2;
    const date = parseDate(order.createdAt);

    const rows = order.items
        .map(
            item => `
                <tr>
                    <td>${escapeHtml(item.name)}</td>

                    <td class="center">
                        ${Number(item.quantity)}
                    </td>

                    <td class="right">
                        ₹${Number(item.price).toFixed(2)}
                    </td>

                    <td class="right">
                        ₹${(
                            Number(item.price) *
                            Number(item.quantity)
                        ).toFixed(2)}
                    </td>
                </tr>
            `
        )
        .join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />

            <title>
                Tax Invoice Order ${order.id}
            </title>

            <style>
                body {
                    max-width: 650px;
                    margin: 0 auto;
                    padding: 30px;
                    color: #222;
                    font-family: Arial, sans-serif;
                }

                .header {
                    text-align: center;
                    border-bottom: 2px solid #2c1810;
                    padding-bottom: 18px;
                }

                .header h1 {
                    margin: 0;
                    color: #2c1810;
                }

                .header p {
                    margin: 5px 0;
                }

                .invoice-title {
                    margin: 20px 0;
                    text-align: center;
                    font-size: 20px;
                    font-weight: bold;
                }

                .details {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px 20px;
                    margin-bottom: 20px;
                }

                .details p {
                    margin: 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 18px;
                }

                th,
                td {
                    padding: 9px 5px;
                    border-bottom: 1px solid #ddd;
                    text-align: left;
                }

                th {
                    background: #f6f1ed;
                }

                .center {
                    text-align: center;
                }

                .right {
                    text-align: right;
                }

                .totals {
                    width: 320px;
                    margin-top: 20px;
                    margin-left: auto;
                }

                .total-line {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                }

                .grand-total {
                    margin-top: 6px;
                    padding-top: 10px;
                    border-top: 2px solid #2c1810;
                    font-size: 18px;
                    font-weight: bold;
                }

                .footer {
                    margin-top: 30px;
                    text-align: center;
                    color: #666;
                }

                @media print {
                    body {
                        padding: 0;
                    }
                }
            </style>
        </head>

        <body>
            <div class="header">
                <h1>${escapeHtml(CAFE_NAME)}</h1>

                <p>${escapeHtml(CAFE_ADDRESS)}</p>

                <p>
                    <strong>GSTIN:</strong>
                    ${escapeHtml(CAFE_GSTIN)}
                </p>

                ${
                    CAFE_PHONE
                        ? `
                            <p>
                                <strong>Phone:</strong>
                                ${escapeHtml(CAFE_PHONE)}
                            </p>
                        `
                        : ''
                }
            </div>

            <div class="invoice-title">
                TAX INVOICE
            </div>

            <div class="details">
                <p>
                    <strong>Invoice No:</strong>
                    INV-${order.id}
                </p>

                <p>
                    <strong>Order No:</strong>
                    #${order.id}
                </p>

                <p>
                    <strong>Customer:</strong>
                    ${escapeHtml(order.customerName)}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${escapeHtml(order.customerPhone)}
                </p>

                <p>
                    <strong>Table:</strong>
                    ${escapeHtml(order.tableNumber)}
                </p>

                <p>
                    <strong>Payment:</strong>
                    ${escapeHtml(
                        order.paymentMethod.toUpperCase()
                    )}
                </p>

                <p>
                    <strong>Status:</strong>
                    ${escapeHtml(order.status)}
                </p>

                <p>
                    <strong>Date:</strong>
                    ${
                        Number.isNaN(date.getTime())
                            ? '-'
                            : escapeHtml(
                                  date.toLocaleString()
                              )
                    }
                </p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="center">Qty</th>
                        <th class="right">Rate</th>
                        <th class="right">Amount</th>
                    </tr>
                </thead>

                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div class="totals">
                <div class="total-line">
                    <span>Subtotal</span>
                    <span>
                        ₹${order.subtotal.toFixed(2)}
                    </span>
                </div>

                <div class="total-line">
                    <span>CGST (9%)</span>
                    <span>
                        ₹${cgst.toFixed(2)}
                    </span>
                </div>

                <div class="total-line">
                    <span>SGST (9%)</span>
                    <span>
                        ₹${sgst.toFixed(2)}
                    </span>
                </div>

                <div class="total-line">
                    <span>Total GST (18%)</span>
                    <span>
                        ₹${order.tax.toFixed(2)}
                    </span>
                </div>

                <div class="total-line grand-total">
                    <span>Grand Total</span>
                    <span>
                        ₹${order.total.toFixed(2)}
                    </span>
                </div>
            </div>

            ${
                order.specialInstructions
                    ? `
                        <p>
                            <strong>Instructions:</strong>
                            ${escapeHtml(
                                order.specialInstructions
                            )}
                        </p>
                    `
                    : ''
            }

            <div class="footer">
                Thank you for visiting
                ${escapeHtml(CAFE_NAME)}!
            </div>
        </body>
        </html>
    `;
}

export function downloadInvoice(order) {
    const html = createInvoiceHtml(order);

    const blob = new Blob([html], {
        type: 'text/html;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `Tax_Invoice_Order_${order.id}.html`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

export function printInvoice(order) {
    const printWindow = window.open(
        '',
        '_blank',
        'width=750,height=900'
    );

    if (!printWindow) {
        alert('Please allow browser popups to print.');
        return;
    }

    printWindow.document.write(
        createInvoiceHtml(order)
    );

    printWindow.document.close();

    printWindow.onload = () => {
        printWindow.print();
    };
}