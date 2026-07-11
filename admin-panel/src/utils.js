export const API_URL =
    process.env.REACT_APP_API_URL ||
    'http://localhost:5000';

export function parseItems(items) {
    if (Array.isArray(items)) {
        return items;
    }

    try {
        return JSON.parse(items || '[]');
    } catch {
        return [];
    }
}

export function getOrderDate(order) {
    if (order.created_at_ms) {
        return new Date(Number(order.created_at_ms));
    }

    if (order.created_at_iso) {
        return new Date(order.created_at_iso);
    }

    if (
        order.created_at &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
            order.created_at
        )
    ) {
        return new Date(
            order.created_at.replace(' ', 'T') + 'Z'
        );
    }

    return new Date(order.created_at);
}

export function getSpecialInstructions(order) {
    return String(
        order.special_instructions ||
        order.specialInstructions ||
        ''
    ).trim();
}

export function money(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function createReceiptHtml(order) {
    const items = parseItems(order.items);
    const instructions = getSpecialInstructions(order);

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
        order.total_amount ?? order.total ?? 0
    );

    const tax =
        order.tax !== undefined
            ? Number(order.tax)
            : Math.max(0, total - subtotal);

    const date = getOrderDate(order);

    const rows = items
        .map(
            item => `
                <tr>
                    <td>${escapeHtml(item.name)}</td>
                    <td class="center">
                        ${Number(item.quantity)}
                    </td>
                    <td class="right">
                        ${money(
                            Number(item.price) *
                                Number(item.quantity)
                        )}
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

            <title>Receipt Order ${order.id}</title>

            <style>
                body {
                    max-width: 500px;
                    margin: 0 auto;
                    padding: 30px;
                    color: #222;
                    font-family: Arial, sans-serif;
                }

                h1 {
                    text-align: center;
                    color: #2c1810;
                }

                .details p {
                    margin: 5px 0;
                }

                table {
                    width: 100%;
                    margin-top: 20px;
                    border-collapse: collapse;
                }

                th,
                td {
                    padding: 9px 4px;
                    border-bottom: 1px solid #ddd;
                    text-align: left;
                }

                .center {
                    text-align: center;
                }

                .right {
                    text-align: right;
                }

                .instructions {
                    margin-top: 18px;
                    padding: 13px;
                    border: 2px solid #ff9800;
                    border-radius: 8px;
                    background: #fff3e0;
                    color: #8a4b00;
                }

                .totals {
                    margin-top: 18px;
                }

                .total-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 6px 0;
                }

                .grand-total {
                    padding-top: 10px;
                    border-top: 2px solid #222;
                    font-size: 18px;
                    font-weight: bold;
                }

                .footer {
                    margin-top: 30px;
                    color: #777;
                    text-align: center;
                }
            </style>
        </head>

        <body>
            <h1>☕ Café Receipt</h1>

            <div class="details">
                <p>
                    <strong>Order:</strong>
                    #${order.id}
                </p>

                <p>
                    <strong>Table:</strong>
                    ${escapeHtml(
                        order.table_number ||
                            order.tableNumber ||
                            order.table_id
                    )}
                </p>

                <p>
                    <strong>Customer:</strong>
                    ${escapeHtml(
                        order.customer_name ||
                            order.customerName ||
                            'Guest'
                    )}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${escapeHtml(
                        order.customer_phone ||
                            order.customerPhone ||
                            '-'
                    )}
                </p>

                <p>
                    <strong>Payment:</strong>
                    ${escapeHtml(
                        (
                            order.payment_method ||
                            order.paymentMethod ||
                            ''
                        ).toUpperCase()
                    )}
                </p>

                <p>
                    <strong>Status:</strong>
                    ${escapeHtml(order.status || 'pending')}
                </p>

                <p>
                    <strong>Date:</strong>
                    ${
                        Number.isNaN(date.getTime())
                            ? '-'
                            : escapeHtml(date.toLocaleString())
                    }
                </p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="center">Qty</th>
                        <th class="right">Amount</th>
                    </tr>
                </thead>

                <tbody>
                    ${rows}
                </tbody>
            </table>

            ${
                instructions
                    ? `
                        <div class="instructions">
                            <strong>⚠ Special Instructions</strong>
                            <div style="margin-top:6px;">
                                ${escapeHtml(instructions)}
                            </div>
                        </div>
                    `
                    : ''
            }

            <div class="totals">
                <div class="total-row">
                    <span>Subtotal</span>
                    <span>${money(subtotal)}</span>
                </div>

                <div class="total-row">
                    <span>GST (18%)</span>
                    <span>${money(tax)}</span>
                </div>

                <div class="total-row grand-total">
                    <span>Total</span>
                    <span>${money(total)}</span>
                </div>
            </div>

            <div class="footer">
                Thank you for visiting!
            </div>
        </body>
        </html>
    `;
}

export function downloadReceipt(order) {
    const html = createReceiptHtml(order);

    const blob = new Blob([html], {
        type: 'text/html;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `Receipt_Order_${order.id}.html`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

export function printReceipt(order) {
    const printWindow = window.open(
        '',
        '_blank',
        'width=700,height=800'
    );

    if (!printWindow) {
        alert('Please allow browser popups to print.');
        return;
    }

    printWindow.document.write(createReceiptHtml(order));
    printWindow.document.close();

    printWindow.onload = () => {
        printWindow.print();
    };
}