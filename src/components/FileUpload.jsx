import React, { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';

const DataTable = ({ refreshTrigger }) => {
    const [data, setData] = useState([]);
    const [search, setSearch] = useState("");
    
    // State View & Edit
    const [selectedItem, setSelectedItem] = useState(null);
    const [comparators, setComparators] = useState([]); 
    const [isLoadingComparators, setIsLoadingComparators] = useState(false);

    const [editingItem, setEditingItem] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [sortOrder, setSortOrder] = useState('-created'); 
    
    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const rp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    const tgl = (str) => str ? str.slice(0, 10) : '-';
    
    const getGoogleMapsLink = (coord) => {
        if (!coord || coord === '-' || coord === '0') return null;
        // Membersihkan koordinat dari karakter aneh
        const cleanCoord = coord.toString().replace(/°/g, '').replace(/\s/g, '');
        return `https://www.google.com/maps/search/?api=1&query=${cleanCoord}`;
    };

    // --- 1. FETCH DATA UTAMA (DENGAN FILTER SEMBUNYIKAN PEMBANDING) ---
    const fetchData = useCallback(async () => {
        try {
            // BASE FILTER: Jangan tampilkan data yang namanya "Aset Pembanding"
            let filterString = `nama_debitur != "Aset Pembanding"`;

            // TAMBAHAN FILTER: Jika ada pencarian
            if (search) {
                filterString += ` && (nama_debitur ~ "${search}" || kota ~ "${search}" || alamat ~ "${search}" || cabang ~ "${search}")`;
            }

            const result = await pb.collection('data_properti').getList(page, 30, {
                filter: filterString,
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

    // --- FETCH PEMBANDING (SAAT KLIK DETAIL) ---
    useEffect(() => {
        const fetchComparators = async () => {
            if (!selectedItem || !selectedItem.nomor_laporan || selectedItem.nomor_laporan === '-') {
                setComparators([]);
                return;
            }

            setIsLoadingComparators(true);
            try {
                // Cari data lain dengan NOMOR LAPORAN SAMA
                const result = await pb.collection('data_properti').getList(1, 10, {
                    filter: `nomor_laporan = "${selectedItem.nomor_laporan}" && id != "${selectedItem.id}"`,
                    sort: '-nilai_obyek'
                });
                setComparators(result.items);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoadingComparators(false);
            }
        };

        fetchComparators();
    }, [selectedItem]);


    // --- HAPUS & SIMPAN ---
    const handleDelete = async (id) => {
        if (!window.confirm("PERINGATAN: Hapus data ini?")) return;
        try {
            await pb.collection('data_properti').delete(id);
            setSelectedItem(null); 
            fetchData(); 
        } catch (err) { alert("Gagal menghapus."); }
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const dataToUpdate = { ...editingItem };
            delete dataToUpdate.created; delete dataToUpdate.updated;
            await pb.collection('data_properti').update(editingItem.id, dataToUpdate);
            alert("Berhasil update!");
            setEditingItem(null); fetchData(); 
        } catch (err) { alert("Gagal update."); } finally { setIsSaving(false); }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditingItem(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="dt-root">
            <div className="dt-header">
                <div>
                    <h3 className="dt-title">📋 Data Database</h3>
                    <small className="dt-subtitle">Menampilkan <b>{totalItems}</b> data debitur utama</small>
                </div>
                <div className="dt-controls">
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="dt-select">
                        <option value="-created">📅 Terbaru</option>
                        <option value="+nama_debitur">🔤 Nama A-Z</option>
                        <option value="-nilai_obyek">💰 Nilai Tertinggi</option>
                    </select>
                    <input type="text" placeholder="🔍 Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" />
                </div>
            </div>

            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>No/Tgl</th>
                            <th>Cabang</th>
                            <th>Nama Debitur</th>
                            <th>Lokasi</th>
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
                                <td><span className="badge-blue">{item.cabang}</span></td>
                                <td>
                                    <div className="text-bold">{item.nama_debitur}</div>
                                    <div className="text-sm-muted">{item.pemberi_tugas}</div>
                                </td>
                                <td>
                                    <div>{item.kota}</div>
                                    <div className="dt-address-truncate">{item.alamat}</div>
                                </td>
                                <td className="dt-currency">{rp(item.nilai_obyek)}</td>
                                <td className="text-center">
                                    <button className="btn" onClick={() => setSelectedItem(item)}>Detail</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && <div className="empty-state">Data tidak ditemukan</div>}
            </div>

            {/* Pagination */}
            <div className="pagination-container">
                <button className="btn btn-page" disabled={page === 1} onClick={() => setPage(p => p - 1)}>« Prev</button>
                <span className="pagination-text">Hal <b>{page}</b> / {totalPages}</span>
                <button className="btn btn-page" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next »</button>
            </div>

            {/* --- MODAL DETAIL (DIPERBAIKI) --- */}
            {selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content modal-lg">
                        
                        <div className="modal-header-detail">
                            <div>
                                <h2 className="modal-h2">🏢 {selectedItem.nama_debitur}</h2>
                                <span className="tag-utama">DATA UTAMA</span>
                            </div>
                            <button className="btn-close-white" onClick={() => setSelectedItem(null)}>✕</button>
                        </div>

                        <div className="modal-body-scroll">
                            <div className="detail-grid">
                                <div className="detail-card">
                                    <h4>📄 Laporan</h4>
                                    <div className="info-row"><span className="label">No. Laporan</span> <b>{selectedItem.nomor_laporan}</b></div>
                                    <div className="info-row"><span className="label">Tanggal</span> <span>{tgl(selectedItem.tanggal_penilaian)}</span></div>
                                    <div className="info-row"><span className="label">Bank</span> <span>{selectedItem.pemberi_tugas}</span></div>
                                </div>
                                <div className="detail-card">
                                    <h4>📍 Lokasi</h4>
                                    <div className="info-row"><span className="label">Kota</span> <span>{selectedItem.kota}</span></div>
                                    <div className="info-row"><span className="label">Alamat</span> <span className="text-wrap">{selectedItem.alamat}</span></div>
                                    <div className="info-row mt-2">
                                        {getGoogleMapsLink(selectedItem.koordinat) ? (
                                            <a href={getGoogleMapsLink(selectedItem.koordinat)} target="_blank" rel="noreferrer" className="btn-maps">
                                                🗺️ Lihat Peta
                                            </a>
                                        ) : <span className="text-muted">Tanpa Koordinat</span>}
                                    </div>
                                </div>
                                <div className="detail-card highlight-card">
                                    <h4>💰 Penilaian</h4>
                                    <div className="info-row"><span className="label">LT / LB</span> <b>{selectedItem.luas_tanah} m² / {selectedItem.luas_bangunan} m²</b></div>
                                    <div className="info-row"><span className="label">Legalitas</span> <span>{selectedItem.legalitas}</span></div>
                                    <div className="divider"></div>
                                    <div className="info-row"><span className="label">Nilai Pasar</span> <b className="text-xl text-blue">{rp(selectedItem.nilai_obyek)}</b></div>
                                </div>
                            </div>

                            {/* --- BAGIAN PEMBANDING (RAHAPI) --- */}
                            <div className="comparator-section">
                                <h3 className="comp-section-title">📊 Data Pembanding (Dalam Laporan Ini)</h3>
                                
                                {isLoadingComparators ? (
                                    <div className="loading-state">Sedang memuat data pembanding...</div>
                                ) : comparators.length === 0 ? (
                                    <div className="empty-comp">Tidak ada pembanding terdata.</div>
                                ) : (
                                    <div className="comparator-list">
                                        {comparators.map((comp) => (
                                            <div key={comp.id} className="comparator-card">
                                                <div className="comp-tag">Pembanding</div>
                                                <div className="comp-price">{rp(comp.nilai_obyek)}</div>
                                                <div className="comp-specs">
                                                    <span>📐 LT: {comp.luas_tanah}m²</span>
                                                    <span>🏠 LB: {comp.luas_bangunan}m²</span>
                                                </div>
                                                <div className="comp-address">{comp.alamat || 'Alamat tidak tersedia'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Admin Actions */}
                            {pb.authStore.model?.role === 'admin' && (
                                <div className="modal-actions">
                                    <button onClick={() => { setEditingItem(selectedItem); setSelectedItem(null); }} className="btn btn-warning">✏️ Edit</button>
                                    <button onClick={() => handleDelete(selectedItem.id)} className="btn btn-danger">🗑️ Hapus</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL EDIT (SAMA) --- */}
            {editingItem && (
                 <div className="modal-overlay">
                 <div className="modal-content" style={{ maxWidth: '800px', width: '95%' }}>
                     <div className="modal-header-edit">
                         <h3>✏️ Edit Data</h3>
                         <button onClick={() => setEditingItem(null)} className="btn-close-white">✕</button>
                     </div>
                     <form onSubmit={handleSaveEdit} className="edit-form">
                        <div className="form-grid-scrollable">
                             {/* INPUT FIELDS (SAMA SEPERTI SEBELUMNYA) */}
                             <div className="form-group col-span-2"><label>Nama Debitur</label><input type="text" name="nama_debitur" value={editingItem.nama_debitur} onChange={handleInputChange}/></div>
                             <div className="form-group"><label>Nomor Laporan</label><input type="text" name="nomor_laporan" value={editingItem.nomor_laporan} onChange={handleInputChange}/></div>
                             <div className="form-group"><label>Tanggal</label><input type="date" name="tanggal_penilaian" value={editingItem.tanggal_penilaian?.slice(0,10)} onChange={handleInputChange}/></div>
                             <div className="form-group"><label>Kota</label><input type="text" name="kota" value={editingItem.kota} onChange={handleInputChange}/></div>
                             <div className="form-group"><label>Luas Tanah</label><input type="number" name="luas_tanah" value={editingItem.luas_tanah} onChange={handleInputChange}/></div>
                             <div className="form-group"><label>Nilai</label><input type="number" name="nilai_obyek" value={editingItem.nilai_obyek} onChange={handleInputChange}/></div>
                             <div className="form-group col-span-2"><label>Alamat</label><textarea name="alamat" rows={2} value={editingItem.alamat} onChange={handleInputChange}/></div>
                         </div>
                         <div className="form-actions right">
                             <button type="submit" className="btn btn-primary">💾 Simpan</button>
                         </div>
                     </form>
                 </div>
             </div>
            )}
        </div>
    );
};

export default DataTable;