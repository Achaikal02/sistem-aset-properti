import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'; // Ganti Marker jadi CircleMarker
import 'leaflet/dist/leaflet.css';
import { pb } from '../lib/pocketbase';

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

    // --- HELPER FUNCTIONS ---
    const parseCoord = (coordStr) => {
            if (!coordStr) return null;
            try {
                let str = coordStr.toString();
                
                // 1. Bersihkan huruf (S, E, Lat, Long) dan karakter aneh, sisakan angka, min, titik, koma, spasi
                str = str.replace(/[a-zA-Z°]/g, '').trim(); 
                
                // 2. Tentukan Separator (Pemisah antar angka)
                // Prioritas: Koma (,), Titik Koma (;), atau Spasi
                let parts;
                if (str.includes(';')) {
                    parts = str.split(';');
                } else if (str.includes(',')) {
                    parts = str.split(',');
                } else {
                    parts = str.split(/\s+/); // Split by spasi
                }

                // Harus ada minimal 2 bagian
                if (parts.length < 2) return null;

                // 3. Parsing ke Float (Ganti koma desimal jadi titik jika format Indonesia)
                // Contoh: "110,5" -> "110.5"
                const n1 = parseFloat(parts[0].replace(',', '.'));
                const n2 = parseFloat(parts[1].replace(',', '.'));

                if (isNaN(n1) || isNaN(n2)) return null;

                // 4. AUTO-FIX: DETEKSI KOORDINAT TERBALIK
                // Leaflet WAJIB format: [LATITUDE, LONGITUDE]
                // Latitude Indonesia: Sekitar -11 s/d +6
                // Longitude Indonesia: Sekitar 95 s/d 141
                // Logika: Jika angka pertama > 90 (atau < -90), itu PASTI Longitude.
                
                if (Math.abs(n1) > 90) {
                    // Berarti n1 adalah Longitude, kita tukar posisinya
                    return [n2, n1]; 
                }

                // Jika normal (n1 adalah Latitude)
                return [n1, n2];

            } catch (e) { 
                console.error("Error parsing coord:", coordStr, e);
                return null; 
            }
        };

    const rp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    const tgl = (str) => str ? str.slice(0, 10) : '-';

    const getGoogleMapsLink = (coord) => {
        if (!coord || coord === '-' || coord === '0') return null;
        const cleanCoord = coord.toString().replace(/°/g, '').replace(/\s/g, '');
        return `https://www.google.com/maps?q=${cleanCoord}`; // Saya perbaiki format link Google Maps agar lebih akurat
    };

    return (
        <div style={{position: 'relative', width: '100%', height: '100%', minHeight: '570px'}}>
            
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
                <MapContainer 
                    center={[-2.5, 118.0]} 
                    zoom={5} 
                    scrollWheelZoom={true}
                    // KUNCI AGAR TIDAK LAG:
                    preferCanvas={true}
                >
                    <TileLayer
                        attribution='&copy; OpenStreetMap'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {locations.map((item) => {
                        const position = parseCoord(item.koordinat);
                        if (!position) return null;

                        return (
                            <CircleMarker 
                                key={item.id} 
                                center={position} // CircleMarker pakai 'center', bukan 'position'
                                radius={6} // Ukuran titik (makin kecil makin ringan dilihat)
                                pathOptions={{ 
                                    color: 'white',       // Garis pinggir putih
                                    weight: 1,            // Tebal garis
                                    fillColor: '#ef4444', // Warna Merah (Tailwind red-500)
                                    fillOpacity: 0.8      // Agak transparan
                                }}
                            >
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
                                                width:'100%', padding:'6px', fontSize:'12px', marginTop:'5px', cursor:'pointer'
                                            }}
                                        >
                                            Detail Lengkap
                                        </button>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        )
                    })}
                </MapContainer>
            </div>

            {/* MODAL DETAIL (TIDAK ADA PERUBAHAN) */}
            {selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ background: '#f8fafc', maxWidth: '900px', width: '95%' }}>
                        
                        {/* HEADER BIRU */}
                        <div className="modal-header-detail">
                            <h2>🏢 {selectedItem.nama_debitur}</h2>
                            <button className="btn-close-white" onClick={() => setSelectedItem(null)}>✕</button>
                        </div>

                        <div className="detail-grid">
                            
                            {/* KARTU 1: INFO LAPORAN */}
                            <div className="detail-card">
                                <h4>📄 Info Laporan</h4>
                                <div className="info-row">
                                    <span className="info-label">Nomor Laporan</span>
                                    <span className="info-value">{selectedItem.nomor_laporan}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Tanggal Penilaian</span>
                                    <span className="info-value">{tgl(selectedItem.tanggal_penilaian)}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Bank / Klien</span>
                                    <span className="info-value">{selectedItem.pemberi_tugas}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Cabang</span>
                                    <span className="info-value badge-blue" style={{display:'inline-block', marginTop:'5px'}}>
                                        {selectedItem.cabang}
                                    </span>
                                </div>
                            </div>
                            
                            {/* KARTU 2: LOKASI */}
                            <div className="detail-card">
                                <h4>📍 Lokasi & Fisik</h4>
                                <div className="info-row">
                                    <span className="info-label">Alamat Lengkap</span>
                                    <span className="info-value">{selectedItem.alamat}</span>
                                </div>
                                <div className="info-row" style={{display:'flex', gap:'20px'}}>
                                    <div>
                                        <span className="info-label">Kota</span>
                                        <span className="info-value">{selectedItem.kota}</span>
                                    </div>
                                    <div>
                                        <span className="info-label">LT / LB</span>
                                        <span className="info-value">{selectedItem.luas_tanah} m² / {selectedItem.luas_bangunan} m²</span>
                                    </div>
                                </div>
                                <div className="info-row" style={{marginTop:'10px'}}>
                                    <span className="info-label">Titik Koordinat</span>
                                    {getGoogleMapsLink(selectedItem.koordinat) ? (
                                        <a 
                                            href={getGoogleMapsLink(selectedItem.koordinat)} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="btn"
                                            style={{
                                                fontSize:'0.8rem', padding:'6px 12px', background:'#eff6ff', 
                                                color:'#2563eb', textDecoration:'none', border:'1px solid #dbeafe',
                                                display:'inline-flex', alignItems:'center', gap:'5px', marginTop:'5px'
                                            }}
                                        >
                                            🗺️ Buka Google Maps
                                        </a>
                                    ) : <span style={{color:'red'}}>-</span>}
                                </div>
                            </div>
                            
                            {/* KARTU 3: NILAI ASET */}
                            <div className="detail-card">
                                <h4>💰 Nilai & Legalitas</h4>
                                <div className="info-row">
                                    <span className="info-label">Legalitas / Sertifikat</span>
                                    <span className="info-value">{selectedItem.legalitas}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Nilai Pasar (Obyek)</span>
                                    <span className="info-value value-highlight">
                                        {rp(selectedItem.nilai_obyek)}
                                    </span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Nilai Likuidasi / Penawaran</span>
                                    <span className="info-value" style={{color:'#64748b'}}>
                                        {rp(selectedItem.harga_penawaran)}
                                    </span>
                                </div>
                            </div>
                            
                            {/* KARTU 4: TIM */}
                            <div className="detail-card">
                                <h4>👷 Tim Penilai</h4>
                                <div className="info-row">
                                    <span className="info-label">Nama Penilai</span>
                                    <span className="info-value">{selectedItem.nama_penilai}</span>
                                </div>
                            </div>

                        </div>

                        {/* FOOTER TOMBOL ADMIN */}
                        {pb.authStore.model?.role === 'admin' && (
                            <div className="modal-actions" style={{background:'white'}}>
                                <button 
                                    onClick={() => handleDelete(selectedItem.id)}
                                    className="btn btn-danger"
                                    style={{display:'flex', alignItems:'center', gap:'5px'}}
                                >
                                    🗑️ Hapus Data
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapView;