import React, {
    useEffect,
    useState
} from 'react';

import { API_URL } from '../utils';

function TablesPage() {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyTableId, setBusyTableId] = useState(null);
    const [qrPopup, setQrPopup] = useState(null);

    useEffect(() => {
        loadTables();
    }, []);

    useEffect(() => {
        function closeOnEscape(event) {
            if (event.key === 'Escape') {
                closePopup();
            }
        }

        window.addEventListener(
            'keydown',
            closeOnEscape
        );

        return () => {
            window.removeEventListener(
                'keydown',
                closeOnEscape
            );
        };
    }, []);

    async function loadTables() {
        try {
            const response = await fetch(
                `${API_URL}/api/tables`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Could not load tables'
                );
            }

            setTables(data.tables || []);
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    }

    async function generateQr(table) {
        if (table.status === 'occupied') {
            alert(`${table.table_number} is occupied.`);
            return;
        }

        setBusyTableId(table.id);

        try {
            const response = await fetch(
                `${API_URL}/api/tables/${table.id}/generate-qr`,
                {
                    method: 'POST'
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Could not generate QR'
                );
            }

            setQrPopup({
                table: data.table,
                qrCode: data.qrCode
            });

            await loadTables();
        } catch (error) {
            alert(error.message);
        } finally {
            setBusyTableId(null);
        }
    }

    function viewQr(table) {
        if (!table.qr_code) {
            alert('Generate a QR code first.');
            return;
        }

        setQrPopup({
            table,
            qrCode: table.qr_code
        });
    }

    function closePopup() {
        setQrPopup(null);
    }

    function downloadQr() {
        if (!qrPopup?.qrCode) {
            return;
        }

        const link = document.createElement('a');

        link.href = qrPopup.qrCode;
        link.download =
            `${qrPopup.table.table_number}_QR.png`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (loading) {
        return (
            <div style={{ padding: 50, textAlign: 'center' }}>
                Loading tables...
            </div>
        );
    }

    const vacantCount = tables.filter(
        table => table.status === 'vacant'
    ).length;

    const occupiedCount = tables.filter(
        table => table.status === 'occupied'
    ).length;

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 15,
                    flexWrap: 'wrap',
                    marginBottom: 22
                }}
            >
                <div>
                    <h2 style={{ color: '#2c1810' }}>
                        🪑 Table Management
                    </h2>

                    <p style={{ color: '#666', marginTop: 5 }}>
                        QR images appear only inside the popup.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <div
                        style={{
                            minWidth: 90,
                            padding: 12,
                            borderRadius: 10,
                            background: '#e8f5e9',
                            textAlign: 'center'
                        }}
                    >
                        <small style={{ color: '#2e7d32' }}>
                            Vacant
                        </small>

                        <div
                            style={{
                                color: '#2e7d32',
                                fontSize: 24,
                                fontWeight: 'bold'
                            }}
                        >
                            {vacantCount}
                        </div>
                    </div>

                    <div
                        style={{
                            minWidth: 90,
                            padding: 12,
                            borderRadius: 10,
                            background: '#fff3e0',
                            textAlign: 'center'
                        }}
                    >
                        <small style={{ color: '#e65100' }}>
                            Occupied
                        </small>

                        <div
                            style={{
                                color: '#e65100',
                                fontSize: 24,
                                fontWeight: 'bold'
                            }}
                        >
                            {occupiedCount}
                        </div>
                    </div>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns:
                        'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: 15
                }}
            >
                {tables.map(table => {
                    const occupied =
                        table.status === 'occupied';

                    const busy =
                        busyTableId === table.id;

                    return (
                        <div
                            key={table.id}
                            style={{
                                padding: 18,
                                borderRadius: 13,
                                borderLeft: `5px solid ${
                                    occupied
                                        ? '#ff9800'
                                        : '#4caf50'
                                }`,
                                background: 'white',
                                boxShadow:
                                    '0 2px 8px rgba(0,0,0,0.08)'
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between',
                                    alignItems: 'flex-start'
                                }}
                            >
                                <div>
                                    <h3
                                        style={{
                                            margin: 0,
                                            color: '#2c1810'
                                        }}
                                    >
                                        {table.table_number}
                                    </h3>

                                    <span
                                        className={`status-badge ${
                                            occupied
                                                ? 'status-pending'
                                                : 'status-ready'
                                        }`}
                                        style={{ marginTop: 7 }}
                                    >
                                        {table.status}
                                    </span>
                                </div>

                                <span style={{ color: '#777' }}>
                                    👥 {table.capacity}
                                </span>
                            </div>

                            <p
                                style={{
                                    marginTop: 16,
                                    color: table.qr_code
                                        ? '#2e7d32'
                                        : '#888',
                                    fontSize: 13
                                }}
                            >
                                {table.qr_code
                                    ? '✓ QR code is ready'
                                    : 'No QR generated'}
                            </p>

                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 15
                                }}
                            >
                                {occupied ? (
                                    <button
                                        type="button"
                                        disabled
                                        style={{
                                            width: '100%',
                                            padding: 10,
                                            border: 'none',
                                            borderRadius: 8,
                                            background: '#ddd',
                                            color: '#777'
                                        }}
                                    >
                                        Table occupied
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                generateQr(table)
                                            }
                                            style={{
                                                flex: 1,
                                                padding: 10,
                                                border: 'none',
                                                borderRadius: 8,
                                                background: '#2c1810',
                                                color: 'white',
                                                cursor: busy
                                                    ? 'wait'
                                                    : 'pointer'
                                            }}
                                        >
                                            {busy
                                                ? 'Generating...'
                                                : table.qr_code
                                                  ? 'Regenerate QR'
                                                  : 'Generate QR'}
                                        </button>

                                        {table.qr_code && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    viewQr(table)
                                                }
                                                style={{
                                                    padding:
                                                        '10px 15px',
                                                    border: 'none',
                                                    borderRadius: 8,
                                                    background:
                                                        '#4caf50',
                                                    color: 'white',
                                                    cursor:
                                                        'pointer'
                                                }}
                                            >
                                                View
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {qrPopup && (
                <div
                    onClick={closePopup}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 5000,
                        padding: 20,

                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',

                        background: 'rgba(0,0,0,0.75)'
                    }}
                >
                    <div
                        onClick={event =>
                            event.stopPropagation()
                        }
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: 430,
                            padding: 30,
                            borderRadius: 18,
                            background: 'white',
                            textAlign: 'center'
                        }}
                    >
                        <button
                            type="button"
                            onClick={closePopup}
                            aria-label="Close QR popup"
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,

                                width: 35,
                                height: 35,

                                border: 'none',
                                borderRadius: '50%',

                                background: '#f44336',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: 20
                            }}
                        >
                            ×
                        </button>

                        <h2 style={{ color: '#2c1810' }}>
                            {qrPopup.table.table_number}
                        </h2>

                        <p
                            style={{
                                marginTop: 5,
                                color: '#777'
                            }}
                        >
                            Scan to open the customer menu
                        </p>

                        <img
                            src={qrPopup.qrCode}
                            alt={`QR for ${qrPopup.table.table_number}`}
                            style={{
                                width: '100%',
                                maxWidth: 300,
                                marginTop: 18
                            }}
                        />

                        <div
                            style={{
                                display: 'flex',
                                gap: 10,
                                marginTop: 20
                            }}
                        >
                            <button
                                type="button"
                                onClick={downloadQr}
                                className="btn btn-success"
                                style={{ flex: 1 }}
                            >
                                Download QR
                            </button>

                            <button
                                type="button"
                                onClick={closePopup}
                                className="btn"
                                style={{
                                    flex: 1,
                                    background: '#666',
                                    color: 'white'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TablesPage;