import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { pb } from '../lib/pocketbase';

const MapView = () => {
    const [locations, setLocations] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(true);

    // --- STATE BARU UNTUK FITUR PEMBANDING (Sama seperti DataTable) ---
    const [comparators, setComparators] = useState([]);
    const [isLoadingComparators, setIsLoadingComparators] = useState(false);

    // --- 1. FETCH DATA UTAMA UNTUK PETA ---
    useEffect(() => {
        const fetchData = async () => {
            try {
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

    // --- 2. LOGIC FETCH PEMBANDING (Sama seperti DataTable) ---
    useEffect(() => {
        const fetchComparators = async () => {
            if (!selectedItem || !selectedItem.nomor_laporan || selectedItem.nomor_laporan === '-') {
                setComparators([]);
                return;
            }

            setIsLoadingComparators(true);
            try {
                // Cari data dengan nomor laporan SAMA, tapi ID BERBEDA
                const result = await pb.collection('data_properti').getList(1, 10, {
                    filter: `nomor_laporan = "${selectedItem.nomor_laporan}" && id != "${selectedItem.id}"`,
                    sort: '-nilai_obyek'
                });
                setComparators(result.items);
            } catch (error) {
                console.error("Gagal ambil pembanding:", error);
                setComparators([]);
            } finally {
                setIsLoadingComparators(false);
            }
        };

        fetchComparators();
    }, [selectedItem]);

    // --- 3. HELPER FUNCTIONS ---
    const handleDelete = async (id) => {
        if (!window.confirm("PERINGATAN: Data ini akan dihapus permanen. Lanjutkan?")) return;
        try {
            await pb.collection('data_properti').delete(id);
            alert("Data berhasil dihapus.");
            setSelectedItem(null);
            // Hapus dari state map tanpa reload page
            setLocations(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            alert("Gagal menghapus! Pastikan anda Admin.");
        }
    };

    const parseCoord = (coordStr) => {
        if (!coordStr) return null;
        try {
            let str = coordStr.toString();
            str = str.replace(/[a-zA-Z°]/g, '').trim(); 
            
            let parts;
            if (str.includes(';')) parts = str.split(';');
            else if (str.includes(',')) parts = str.split(',');
            else parts = str.split(/\s+/);

            if (parts.length < 2) return null;

            const n1 = parseFloat(parts[0].replace(',', '.'));
            const n2 = parseFloat(parts[1].replace(',', '.'));

            if (isNaN(n1) || isNaN(n2)) return null;
            
            if (Math.abs(n1) > 90) return [n2, n1]; 
            return [n1, n2];

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
        <div style={{position: 'relative', width: '100%', height: '100%', minHeight: '570px'}}>
            
            {/* HEADER MENGAMBANG */}
            <div className="map-floating-header">
                <h3 style={{margin:'0 0 5px 0', fontSize:'16px', color:'#1e293b'}}>🗺️ Sebaran Aset</h3>
                <div style={{fontSize:'13px', color:'#64748b'}}>
                    {loading ? "Sedang memuat titik..." : (
                        <>Terpantau: <b>{locations.length}</b> titik lokasi.</>
                    )}
                </div>
            </div>

            {/* PETA */}
            <div className="map-container-fixed">
                <MapContainer 
                    center={[-2.5, 118.0]} 
                    zoom={5} 
                    scrollWheelZoom={true}
                    preferCanvas={true}
                >
                    <TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                    {locations.map((item) => {
                        const position = parseCoord(item.koordinat);
                        if (!position) return null;

                        return (
                            <CircleMarker 
                                key={item.id} 
                                center={position} 
                                radius={6} 
                                pathOptions={{ color: 'white', weight: 1, fillColor: '#ef4444', fillOpacity: 0.8 }}
                            >
                                <Popup>
                                    <div style={{minWidth:'200px'}}>
                                        <b style={{fontSize:'13px', display:'block', marginBottom:'5px'}}>{item.nama_debitur}</b>
                                        <div style={{fontSize:'11px', color:'#666', marginBottom:'5px'}}>{item.kota}</div>
                                        <div style={{fontWeight:'bold', color:'green', marginBottom:'8px'}}>{rp(item.nilai_obyek)}</div>
                                        <button 
                                            onClick={() => setSelectedItem(item)}
                                            className="btn"
                                            style={{width:'100%', padding:'6px', fontSize:'12px', marginTop:'5px', cursor:'pointer'}}
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

            {/* --- MODAL DETAIL (UPDATED: SAMA DENGAN DATATABLE) --- */}
            {selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ background: '#f8fafc', maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        
                        {/* HEADER BIRU */}
                        <div className="modal-header-detail">
                            <div>
                                <h2>🏢 {selectedItem.nama_debitur}</h2>
                                <small style={{color:'white', opacity:0.8}}>Data Utama (Aset Dinilai)</small>
                            </div>
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

                        {/* --- BAGIAN PEMBANDING (BARU) --- */}
                        <div className="comparator-section">
                            <div className="comparator-title">
                                📊 Data Pembanding (Satu Laporan)
                                {isLoadingComparators && <span style={{fontSize:'0.8rem', fontWeight:'normal', color:'#94a3b8'}}>(Memuat...)</span>}
                            </div>
                            
                            {!isLoadingComparators && comparators.length === 0 ? (
                                <div style={{color:'#94a3b8', fontStyle:'italic'}}>Tidak ada data pembanding lain dengan nomor laporan ini.</div>
                            ) : (
                                <div className="comparator-scroll-container">
                                    {comparators.map((comp) => (
                                        <div key={comp.id} className="comparator-card">
                                            <div className="comp-header">
                                                {comp.nama_debitur || 'Tanpa Nama'}
                                            </div>
                                            <div className="comp-row">
                                                <span className="comp-label">Luas Tanah:</span>
                                                <span className="comp-val">{comp.luas_tanah} m²</span>
                                            </div>
                                            <div className="comp-row">
                                                <span className="comp-label">Luas Bangunan:</span>
                                                <span className="comp-val">{comp.luas_bangunan} m²</span>
                                            </div>
                                            <div className="comp-row">
                                                <span className="comp-label">Nilai:</span>
                                                <span className="comp-val" style={{color:'#2563eb'}}>{rp(comp.nilai_obyek)}</span>
                                            </div>
                                            <div className="comp-row" style={{marginTop:'5px'}}>
                                                <span className="comp-label">Alamat:</span>
                                            </div>
                                            <div style={{fontSize:'0.8rem', color:'#475569', lineHeight:'1.2', height:'2.4em', overflow:'hidden'}}>
                                                {comp.alamat}
                                            </div>
                                            
                                            {/* Tombol kecil jika ingin melihat pembanding ini sebagai utama */}
                                            <button 
                                                onClick={() => setSelectedItem(comp)}
                                                style={{
                                                    marginTop:'auto', padding:'5px', fontSize:'0.75rem', 
                                                    background:'#0080ffff', border:'none', cursor:'pointer', borderRadius:'4px'
                                                }}
                                            >
                                                🔍 Lihat Detail
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* FOOTER TOMBOL ADMIN */}
                        {pb.authStore.model?.role === 'admin' && (
                            <div className="modal-actions" style={{background:'white', marginTop:'20px'}}>
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