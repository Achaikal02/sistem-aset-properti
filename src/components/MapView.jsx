import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { pb } from '../lib/pocketbase';

// Fix Icon Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapView = () => {
    const [locations, setLocations] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Ambil SEMUA data
                const records = await pb.collection('data_properti').getFullList({
                    sort: '-created',
                });

                const validData = records.filter(item => {
                    if (!item.koordinat || item.koordinat === '-' || item.koordinat.length < 5) return false;
                    return /\d/.test(item.koordinat);
                });

                setLocations(validData);
            } catch (err) {
                console.error("Gagal ambil data peta:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // --- HELPER FUNCTIONS (Sama dengan DataTable) ---
    const parseCoord = (coordStr) => {
        try {
            const clean = coordStr.toString().replace(/°/g, '').replace(/\s/g, '');
            const parts = clean.split(',');
            if (parts.length !== 2) return null;
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (isNaN(lat) || isNaN(lng)) return null;
            return [lat, lng];
        } catch (e) { return null; }
    };

    const rp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    
    const tgl = (str) => str ? str.slice(0, 10) : '-';

    const getGoogleMapsLink = (coord) => {
        if (!coord || coord === '-' || coord === '0') return null;
        const cleanCoord = coord.toString().replace(/°/g, '').replace(/\s/g, '');
        return `https://www.google.com/maps?q=${cleanCoord}`;
    };

    return (
        <div style={{position: 'relative', width: '100%', height: '100%'}}>
            
            {/* HEADER MENGAMBANG */}
            <div className="map-floating-header">
                <h3 style={{margin:'0 0 5px 0', fontSize:'16px', color:'#1e293b'}}>🗺️ Sebaran Aset</h3>
                <div style={{fontSize:'13px', color:'#64748b'}}>
                    {loading ? "Sedang memuat titik..." : (
                        <>Terpantau: <b>{locations.length}</b> titik lokasi.</>
                    )}
                </div>
                {!loading && (
                    <div style={{marginTop:'10px', fontSize:'11px', color:'#3b82f6'}}>
                        🔵 Klik titik untuk detail
                    </div>
                )}
            </div>

            {/* KONTAINER PETA */}
            <div className="map-container-fixed">
                <MapContainer center={[-2.5, 118.0]} zoom={5} scrollWheelZoom={true}>
                    <TileLayer
                        attribution='&copy; OpenStreetMap'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {locations.map((item) => {
                        const position = parseCoord(item.koordinat);
                        if (!position) return null;

                        return (
                            <Marker key={item.id} position={position}>
                                <Popup>
                                    <div style={{minWidth:'200px'}}>
                                        <b style={{fontSize:'13px', display:'block', marginBottom:'5px'}}>{item.nama_debitur}</b>
                                        <div style={{fontSize:'11px', color:'#666', marginBottom:'5px'}}>
                                            {item.kota}
                                        </div>
                                        <div style={{fontWeight:'bold', color:'green', marginBottom:'8px'}}>
                                            {rp(item.nilai_obyek)}
                                        </div>
                                        <button 
                                            onClick={() => setSelectedItem(item)}
                                            className="btn"
                                            style={{
                                                width:'100%', padding:'6px', fontSize:'12px', marginTop:'5px'
                                            }}
                                        >
                                            Detail Lengkap
                                        </button>
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    })}
                </MapContainer>
            </div>

            {/* MODAL DETAIL (STRUKTUR DISAMAKAN DENGAN DATATABLE) */}
            {selectedItem && (
                <div className="modal-overlay" style={{zIndex: 99999}}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 style={{margin:0}}>👤 {selectedItem.nama_debitur}</h2>
                            <button className="btn btn-close" onClick={() => setSelectedItem(null)}>Tutup</button>
                        </div>
                        
                        {/* Grid ini sama persis dengan DataTable */}
                        <div className="detail-grid">
                            <div className="detail-card">
                                <h4>Info Laporan</h4>
                                <p>No: {selectedItem.nomor_laporan}</p>
                                <p>Tgl: {tgl(selectedItem.tanggal_penilaian)}</p>
                                <p>Bank: {selectedItem.pemberi_tugas}</p>
                                <p>Cabang: <b>{selectedItem.cabang}</b></p>
                            </div>
                            
                            <div className="detail-card">
                                <h4>Lokasi & Fisik</h4>
                                <p>Alamat: {selectedItem.alamat}</p>
                                <p>Kota: {selectedItem.kota}</p>
                                <p>LT / LB: {selectedItem.luas_tanah} m² / {selectedItem.luas_bangunan} m²</p>
                                <p style={{marginTop: '10px'}}>
                                    Koordinat: <br/>
                                    {getGoogleMapsLink(selectedItem.koordinat) ? (
                                        <a 
                                            href={getGoogleMapsLink(selectedItem.koordinat)} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="btn"
                                            style={{display: 'inline-block', marginTop:'5px', fontSize:'12px', textDecoration:'none', backgroundColor:'#10b981'}}
                                        >
                                            📍 Buka Google Maps
                                        </a>
                                    ) : <span style={{color:'red'}}>-</span>}
                                </p>
                            </div>
                            
                            <div className="detail-card">
                                <h4>Nilai & Legalitas</h4>
                                <p>Legalitas: {selectedItem.legalitas}</p>
                                <p>Nilai Obyek: <span style={{color:'green', fontWeight:'bold'}}>{rp(selectedItem.nilai_obyek)}</span></p>
                                <p>Penawaran: {rp(selectedItem.harga_penawaran)}</p>
                            </div>
                            
                            <div className="detail-card">
                                <h4>Tim Penilai</h4>
                                <p>Penilai: {selectedItem.nama_penilai}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapView;