import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';

const DataTable = ({ refreshTrigger }) => {
    const [data, setData] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedItem, setSelectedItem] = useState(null);
    const [sortOrder, setSortOrder] = useState('-created'); // State untuk urutan (Default: Terbaru)
    
    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // UPDATE: Filter Pencarian mencakup kolom 'cabang' juga
                const filterQuery = search 
                    ? `nama_debitur ~ "${search}" || kota ~ "${search}" || alamat ~ "${search}" || cabang ~ "${search}"` 
                    : '';

                const result = await pb.collection('data_properti').getList(page, 50, {
                    filter: filterQuery,
                    sort: sortOrder, // Menggunakan state sortOrder
                });
                
                setData(result.items);
                setTotalPages(result.totalPages);
                setTotalItems(result.totalItems);
            } catch (error) { console.error(error); }
        };
        fetchData();
    }, [search, refreshTrigger, page, sortOrder]); // Refresh jika sortOrder berubah

    // Reset ke halaman 1 jika search/sort berubah
    useEffect(() => { setPage(1); }, [search, sortOrder]);

    const rp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    const tgl = (str) => str ? str.slice(0, 10) : '-';
    
    const getGoogleMapsLink = (coord) => {
        if (!coord || coord === '-' || coord === '0') return null;
        const cleanCoord = coord.toString().replace(/°/g, '').replace(/\s/g, '');
        return `https://www.google.com/maps?q=${cleanCoord}`;
    };

    return (
        <div>
            {/* --- HEADER & KONTROL --- */}
            <div style={{
                background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', 
                marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div>
                    <h3 style={{margin: '0 0 5px 0', color:'#1e293b'}}>📋 Data Database</h3>
                    <small style={{color: '#64748b'}}>Total: <b>{totalItems}</b> data ditemukan</small>
                </div>

                <div style={{display:'flex', gap:'10px', flexGrow: 1, justifyContent:'flex-end'}}>
                    {/* DROPDOWN SORTING */}
                    <select 
                        value={sortOrder} 
                        onChange={(e) => setSortOrder(e.target.value)}
                        style={{padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor:'pointer'}}
                    >
                        <option value="-created">📅 Upload Terbaru (Paling Atas)</option>
                        <option value="+created">📅 Upload Terlama (Paling Atas)</option>
                        <option value="+nama_debitur">🔤 Nama A-Z</option>
                        <option value="-nilai_obyek">💰 Nilai Tertinggi</option>
                    </select>

                    {/* INPUT PENCARIAN */}
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
                            <th>Cabang</th> {/* KOLOM BARU */}
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
                                    <div style={{fontWeight:'bold'}}>{item.nomor_laporan}</div>
                                    <div style={{fontSize:'11px', color:'#64748b'}}>{tgl(item.tanggal_penilaian)}</div>
                                </td>
                                <td>
                                    <span style={{
                                        background: '#e0f2fe', color: '#0369a1', 
                                        padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600'
                                    }}>
                                        {item.cabang}
                                    </span>
                                </td>
                                <td>
                                    <div style={{fontWeight: 'bold'}}>{item.nama_debitur}</div>
                                    <div style={{fontSize: '11px', color: '#64748b'}}>{item.pemberi_tugas}</div>
                                </td>
                                <td>
                                    <div>{item.kota}</div>
                                    <div style={{fontSize:'11px', color:'#64748b', maxWidth:'200px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                                        {item.alamat}
                                    </div>
                                </td>
                                <td style={{textAlign:'right', fontFamily:'monospace', fontWeight:'600'}}>
                                    {rp(item.nilai_obyek)}
                                </td>
                                <td style={{textAlign:'center'}}>
                                    <button className="btn" onClick={() => setSelectedItem(item)}>Detail</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && <div style={{padding:'40px', textAlign:'center', color:'#94a3b8'}}>Data tidak ditemukan</div>}
            </div>

            {/* --- PAGINATION --- */}
            <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'15px', marginTop:'25px'}}>
                <button 
                    className="btn" 
                    disabled={page === 1} 
                    onClick={() => setPage(p => p - 1)}
                    style={{background: page === 1 ? '#e2e8f0' : 'var(--primary)', color: page===1?'#94a3b8':'white'}}
                >
                    « Sebelumnya
                </button>
                <span style={{fontSize:'14px', color:'var(--text-main)'}}>
                    Halaman <b>{page}</b> dari <b>{totalPages}</b>
                </span>
                <button 
                    className="btn" 
                    disabled={page >= totalPages} 
                    onClick={() => setPage(p => p + 1)}
                    style={{background: page >= totalPages ? '#e2e8f0' : 'var(--primary)', color: page>=totalPages?'#94a3b8':'white'}}
                >
                    Selanjutnya »
                </button>
            </div>

            {/* --- MODAL POPUP (Tidak Berubah) --- */}
            {selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 style={{margin:0}}>👤 {selectedItem.nama_debitur}</h2>
                            <button className="btn btn-close" onClick={() => setSelectedItem(null)}>Tutup</button>
                        </div>
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
                                <p>LT/LB: {selectedItem.luas_tanah} m² / {selectedItem.luas_bangunan} m²</p>
                                <p style={{marginTop: '10px'}}>
                                    Koordinat: <br/>
                                    {getGoogleMapsLink(selectedItem.koordinat) ? (
                                        <a href={getGoogleMapsLink(selectedItem.koordinat)} target="_blank" rel="noreferrer" className="btn" style={{display: 'inline-block', marginTop:'5px', fontSize:'12px', textDecoration:'none', backgroundColor:'#10b981'}}>
                                            📍 Buka Peta
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

export default DataTable;