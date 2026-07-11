import React, { useState, useEffect } from 'react';

function MenuPage() {
    const [categories, setCategories] = useState([]);
    const [menu, setMenu] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMenu();
    }, []);

    const loadMenu = async () => {
        try {
            const res = await fetch('http://192.168.1.3:5000/api/menu');
            const data = await res.json();
            setMenu(data.menu || {});
            // Get categories from menu keys
            const cats = Object.keys(data.menu || {}).map((name, i) => ({ name, count: data.menu[name].length }));
            setCategories(cats);
        } catch (err) {
            console.error('Failed to load menu:', err);
        } finally {
            setLoading(false);
        }
    };

    const totalItems = Object.values(menu).reduce((sum, items) => sum + items.length, 0);

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}>Loading menu...</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                <div>
                    <h2 style={{ color: '#2c1810', fontSize: '1.5em' }}>📋 Menu</h2>
                    <p style={{ color: '#666', marginTop: 5 }}>
                        {categories.length} Categories | {totalItems} Items
                    </p>
                </div>
            </div>

            {categories.map(cat => (
                <div key={cat.name} style={{
                    background: 'white', borderRadius: 16, padding: 20,
                    marginBottom: 15, boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <h3 style={{ color: '#2c1810', fontSize: '1.1em', margin: 0 }}>{cat.name}</h3>
                        <span style={{ background: '#f0ece6', padding: '5px 12px', borderRadius: 15, fontSize: '0.8em', color: '#666' }}>
                            {cat.count} items
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                        {menu[cat.name]?.map(item => (
                            <div key={item.id} style={{
                                display: 'flex', justifyContent: 'space-between',
                                padding: '10px 15px', background: '#f9f9f9',
                                borderRadius: 8
                            }}>
                                <div>
                                    <span style={{ fontSize: '0.9em', color: '#2c1810' }}>{item.name}</span>
                                    <p style={{ fontSize: '0.75em', color: '#999', margin: '2px 0 0' }}>{item.description}</p>
                                </div>
                                <span style={{ fontWeight: 'bold', color: '#2c1810', fontSize: '0.9em', whiteSpace: 'nowrap' }}>
                                    ₹{item.price}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default MenuPage;