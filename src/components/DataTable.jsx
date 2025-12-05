import React, { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';

const DataTable = ({ refreshTrigger }) => {
    const [data, setData] = useState([]);
    const [search, setSearch] = useState("");
    
    // State View & Edit
    const [selectedItem, setSelectedItem] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [sortOrder, setSortOrder] = useState('-created'); 
    
    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // --- 1. FETCH DATA ---
    const fetchData = useCallback(async () => {
        try {
            const filterQuery = search 
                ? `nama_debitur ~ "${search}" || kota ~ "${search}" || alamat ~ "${search}" || cabang ~ "${search}"` 
                : '';

            const result = await pb.collection('data_properti').getList(page, 30, {
                filter: filterQuery,
                sort: sortOrder,
            });
            
            setData(result.items);
            setTotalPages(result.totalPages);
            setTotalItems(result.totalItems);
        } catch (error) { console.error(error); }
    }, [search, page, sortOrder]);

    useEffect(() => {
        fetchData();
    }, [fetchData, refreshTrigger]);

    useEffect(() => { setPage(1); }, [search, sortOrder]);

    // --- 2. FUNGSI HAPUS ---
    const handleDelete = async (id) => {
        if (!window.confirm("PERINGATAN: Data ini akan dihapus permanen. Lanjutkan?")) return;
        try {
            await pb.collection('data_properti').delete(id);
            alert("Data berhasil dihapus.");
            setSelectedItem(null); 
            fetchData(); 
        } catch (err) {
            alert("Gagal menghapus! Pastikan anda Admin.");
        }
    };

    // --- 3. FUNGSI SIMPAN EDIT ---
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const dataToUpdate = { ...editingItem };
            delete dataToUpdate.created;
            delete dataToUpdate.updated;

            await pb.collection('data_properti').update(editingItem.id, dataToUpdate);
            
            alert("Data berhasil diperbarui!");
            setEditingItem(null); 
            fetchData(); 
        } catch (err) {
            console.error(err);
            alert("Gagal update data. Cek koneksi.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditingItem(prev => ({ ...prev, [name]: value }));
    };

    const rp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    const tgl = (str) => str ? str.slice(0, 10) : '-';
    
    const getGoogleMapsLink = (coord) => {
        if (!coord || coord === '-' || coord === '0') return null;
        const cleanCoord = coord.toString().replace(/°/g, '').replace(/\s/g, '');
        return `https://www.google.com/maps?q=${cleanCoord}`;
    };

    return (
        <div className="dt-root">
            {/* PERBAIKAN: Menghapus div pembungkus di sini agar flexbox bekerja */}
            
            {/* --- HEADER & KONTROL --- */}
            <div className="dt-header">
                <div>
                    <h3 className="dt-title">📋 Data Database</h3>
                    <small className="dt-subtitle">Total: <b>{totalItems}</b> data ditemukan</small>
                </div>

                <div className="dt-controls">
                    <select 
                        value={sortOrder} 
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="dt-select"
                    >
                        <option value="-created">📅 Upload Terbaru (Paling Atas)</option>
                        <option value="+created">📅 Upload Terlama (Paling Atas)</option>
                        <option value="+nama_debitur">🔤 Nama A-Z</option>
                        <option value="-nilai_obyek">💰 Nilai Tertinggi</option>
                    </select>

                    <input 
                        type="text" 
                        placeholder="🔍 Cari Debitur, Kota, Cabang..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="search-input"
                        style={{maxWidth: '250px'}}
                    />
                </div>
            </div>

            {/* --- TABEL --- */}
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>No/Tgl</th>
                            <th>Cabang</th>
                            <th>Nama Debitur</th>
                            <th>Kota & Lokasi</th>
                            <th>Nilai Obyek</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <div className="text-bold">{item.nomor_laporan}</div>
                                    <div className="text-sm-muted">{tgl(item.tanggal_penilaian)}</div>
                                </td>
                                <td>
                                    <span className="badge-blue">
                                        {item.cabang}
                                    </span>
                                </td>
                                <td>
                                    <div className="text-bold">{item.nama_debitur}</div>
                                    <div className="text-sm-muted">{item.pemberi_tugas}</div>
                                </td>
                                <td>
                                    <div>{item.kota}</div>
                                    <div className="dt-address-truncate">
                                        {item.alamat}
                                    </div>
                                </td>
                                <td className="dt-currency">
                                    {rp(item.nilai_obyek)}
                                </td>
                                <td className="text-center">
                                    <button className="btn" onClick={() => setSelectedItem(item)}>Detail</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && <div style={{padding:'40px', textAlign:'center', color:'#94a3b8'}}>Data tidak ditemukan</div>}
            </div>

            {/* --- PAGINATION --- */}
            <div className="pagination-container">
                <button 
                    className="btn btn-page" 
                    disabled={page === 1} 
                    onClick={() => setPage(p => p - 1)}
                >
                    « Sebelumnya
                </button>
                <span className="pagination-text">
                    Halaman <b>{page}</b> dari <b>{totalPages}</b>
                </span>
                <button 
                    className="btn btn-page" 
                    disabled={page >= totalPages} 
                    onClick={() => setPage(p => p + 1)}
                >
                    Selanjutnya »
                </button>
            </div>

            {/* --- MODAL 1: DETAIL --- */}
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
                                    onClick={() => {
                                        setEditingItem(selectedItem); 
                                        setSelectedItem(null);        
                                    }}
                                    className="btn btn-warning"
                                    style={{display:'flex', alignItems:'center', gap:'5px'}}
                                >
                                    ✏️ Edit Data
                                </button>
                                
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

            {/* --- MODAL 2: FORM EDIT --- */}
            {editingItem && (
                <div className="modal-overlay">
                        
                        {/* Ubah maxWidth jadi lebih ramping sedikit agar enak dilihat */}
                        <div className="modal-content" style={{ maxWidth: '800px', width: '95%' }}>
                            
                            {/* PERBAIKAN 1: Header diganti style Biru (Konsisten dengan Detail) */}
                            <div className="modal-header-edit">
                                <h3 style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                    ✏️ Edit Data Properti
                                </h3>
                                <button onClick={() => setEditingItem(null)} className="btn-close-white">✕</button>
                            </div>

                            {/* FORM BODY */}
                            <form onSubmit={handleSaveEdit} className="edit-form">
                                <div className="form-grid-scrollable">
                                    
                                    {/* ... (BAGIAN INPUT BIARKAN SAMA SEPERTI KODE LAMA ANDA) ... */}
                                    {/* Pastikan input-input Anda tetap ada di sini */}
                                    
                                    <div className="form-group col-span-2">
                                        <label>Nama Debitur / Perusahaan</label>
                                        <input type="text" name="nama_debitur" value={editingItem.nama_debitur || ''} onChange={handleInputChange} required />
                                    </div>
                                    {/* ... dst input lainnya ... */}
                                    {/* ... Paste sisa input Anda di sini ... */}
                                    <div className="form-group">
                                        <label>Nomor Laporan</label>
                                        <input type="text" name="nomor_laporan" value={editingItem.nomor_laporan || ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Tanggal Penilaian</label>
                                        <input type="date" name="tanggal_penilaian" value={editingItem.tanggal_penilaian ? editingItem.tanggal_penilaian.slice(0,10) : ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Cabang</label>
                                        <input type="text" name="cabang" value={editingItem.cabang || ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Kota</label>
                                        <input type="text" name="kota" value={editingItem.kota || ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Luas Tanah (m²)</label>
                                        <input type="number" name="luas_tanah" value={editingItem.luas_tanah || ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Luas Bangunan (m²)</label>
                                        <input type="number" name="luas_bangunan" value={editingItem.luas_bangunan || ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Nilai Obyek (Rp)</label>
                                        <input type="number" name="nilai_obyek" value={editingItem.nilai_obyek || 0} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Harga Penawaran (Rp)</label>
                                        <input type="number" name="harga_penawaran" value={editingItem.harga_penawaran || 0} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group col-span-2">
                                        <label>Alamat Lengkap</label>
                                        <textarea name="alamat" value={editingItem.alamat || ''} onChange={handleInputChange} rows={3} />
                                    </div>
                                    <div className="form-group col-span-2">
                                        <label>Koordinat</label>
                                        <input type="text" name="koordinat" value={editingItem.koordinat || ''} onChange={handleInputChange} placeholder="-6.234, 106.345" />
                                    </div>

                                </div>

                                {/* PERBAIKAN 2: FOOTER TOMBOL RAPI */}
                                <div className="form-actions">
                                    
                                    {/* KIRI: Tombol Hapus (Hanya muncul jika admin) */}
                                    <div className="action-left">
                                        {pb.authStore.model?.role === 'admin' && (
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    if(window.confirm("Hapus permanen?")) {
                                                        handleDelete(editingItem.id);
                                                        setEditingItem(null);
                                                    }
                                                }}
                                                className="btn btn-danger-soft"
                                            >
                                                🗑️ Hapus
                                            </button>
                                        )}
                                    </div>

                                    {/* KANAN: Batal & Simpan */}
                                    <div className="action-right">
                                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                            {isSaving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
                                        </button>
                                    </div>

                                </div>
                            </form>
                        </div>
                    </div>
            )}
        </div>
    );
};

export default DataTable;