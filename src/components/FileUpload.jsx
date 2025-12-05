import React, { useState } from 'react';
import * as xlsx from 'xlsx';
import { pb } from '../lib/pocketbase';

const FileUpload = ({ onUploadSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    // --- FITUR HAPUS STABIL (CHUNK DELETE) ---
    const handleDeleteAll = async () => {
        if (!window.confirm("⚠️ Yakin hapus SEMUA data?")) return;
        
        setLoading(true);
        setStatus(<div style={{color:'#d97706'}}>⏳ Memulai penghapusan bertahap...</div>);

        try {
            // Matikan auto-cancel agar tidak putus di tengah jalan
            pb.autoCancellation(false);

            let totalDeleted = 0;
            let hasMore = true;

            // Loop terus sampai data habis
            while (hasMore) {
                // 1. Ambil 50 data teratas saja (biar ringan)
                const result = await pb.collection('data_properti').getList(1, 50, { fields: 'id' });
                const items = result.items;

                if (items.length === 0) {
                    hasMore = false; // Data habis, stop loop
                    break;
                }

                // 2. Hapus 50 data tersebut secara paralel
                const deletePromises = items.map(item => pb.collection('data_properti').delete(item.id));
                await Promise.all(deletePromises);

                totalDeleted += items.length;
                
                // Update status di layar
                setStatus(
                    <div style={{color:'#2563eb'}}>
                        🗑️ Sedang menghapus... <b>{totalDeleted}</b> data telah terhapus.
                    </div>
                );
            }
            
            setStatus(<div style={{color:'green'}}>✅ Berhasil! Semua data ({totalDeleted}) telah dibersihkan.</div>);
            onUploadSuccess();

        } catch (error) {
            console.error(error);
            setStatus(<div style={{color:'red'}}>❌ Terhenti: {error.message}. Coba klik hapus lagi.</div>);
        } finally {
            setLoading(false);
        }
    };

    // --- FITUR UPLOAD MULTI-SHEET (LOGIKA SAMA SEPERTI SEBELUMNYA) ---
    const handleUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        pb.autoCancellation(false); // Pastikan tidak auto-cancel
        setStatus(<div>🔄 Mempersiapkan upload...</div>);
        
        let reportLog = []; 
        let grandTotalSuccess = 0;
        let grandTotalSkipped = 0;

        try {
            // 1. AMBIL FINGERPRINT DATA LAMA (Optimized)
            // Hanya ambil ID dan Nomor Laporan untuk cek duplikat
            const existingRecords = await pb.collection('data_properti').getFullList({
                fields: 'nomor_laporan, nama_debitur',
            });

            const existingSet = new Set(
                existingRecords.map(r => {
                    const no = r.nomor_laporan ? r.nomor_laporan.toLowerCase().trim() : '-';
                    const nama = r.nama_debitur ? r.nama_debitur.toLowerCase().trim() : '-';
                    return `${no}_${nama}`;
                })
            );

            // 2. LOOP FILE
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Baca semua sheet
                const sheetsData = await readAllSheets(file);
                
                for (const sheet of sheetsData) {
                    setStatus(
                        <div>
                            <p>📂 File: <b>{file.name}</b> | Sheet: <b>{sheet.sheetName}</b></p>
                            <ul style={{textAlign:'left', fontSize:'12px', color:'#666'}}>
                                {reportLog.map((log, idx) => <li key={idx}>{log}</li>)}
                            </ul>
                        </div>
                    );

                    const result = await processRawData(sheet.data, existingSet);
                    
                    if (result.success > 0 || result.skipped > 0) {
                        reportLog.push(`✅ ${sheet.sheetName}: +${result.success} | ⏩ ${result.skipped} Skip`);
                        grandTotalSuccess += result.success;
                        grandTotalSkipped += result.skipped;
                    } else {
                        reportLog.push(`⚠️ ${sheet.sheetName}: Kosong / Header Salah`);
                    }
                }
            }

            setStatus(
                <div style={{textAlign:'left', background:'#f0fdf4', padding:'15px', borderRadius:'8px', border:'1px solid #bbf7d0'}}>
                    <h4 style={{margin:'0 0 5px 0', color:'#15803d'}}>🎉 Selesai!</h4>
                    <p style={{margin:'0 0 10px 0', fontSize:'14px'}}>
                        <b>{grandTotalSuccess}</b> Data Masuk. <span style={{color:'#d97706'}}>({grandTotalSkipped} Duplikat)</span>
                    </p>
                    <div style={{maxHeight:'150px', overflowY:'auto'}}>
                        <ul style={{margin:0, paddingLeft:'20px', fontSize:'12px'}}>
                            {reportLog.map((log, idx) => <li key={idx} style={{marginBottom:'4px'}}>{log}</li>)}
                        </ul>
                    </div>
                </div>
            );
            
            onUploadSuccess();

        } catch (err) {
            console.error(err);
            setStatus(<div style={{color:'red'}}>❌ Error: {err.message}</div>);
        } finally {
            setLoading(false);
        }
    };

    const readAllSheets = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target.result;
                    const workbook = xlsx.read(bstr, { type: 'binary' });
                    const result = workbook.SheetNames.map(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                        return { sheetName, data };
                    });
                    resolve(result);
                } catch (e) { reject(e); }
            };
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });
    };

    const processRawData = async (rows, existingSet) => {
        let successCount = 0;
        let skippedCount = 0;
        let headerRowIndex = -1;
        const colIdx = {
            nama: -1, kota: -1, alamat: -1, nilai: -1, 
            tgl: -1, no_lap: -1, bank: -1, cabang: -1, 
            luas_t: -1, luas_b: -1, legalitas: -1, penilai: -1
        };

        // Cari Header
        for (let i = 0; i < 50; i++) {
            if (!rows[i]) continue;
            const rowStr = rows[i].map(c => c ? c.toString().toLowerCase() : '').join(' | ');
            if (rowStr.includes('nama debitur')) {
                headerRowIndex = i;
                rows[i].forEach((colName, idx) => {
                    if (!colName) return;
                    const c = colName.toString().toLowerCase().trim();
                    if (c.includes('nama debitur')) colIdx.nama = idx;
                    else if (c.includes('kab/kotamadya') || c === 'kota') colIdx.kota = idx;
                    else if (c === 'alamat') colIdx.alamat = idx;
                    else if (c.includes('nilai obyek')) colIdx.nilai = idx;
                    else if (c.includes('tanggal penilaian')) colIdx.tgl = idx;
                    else if (c.includes('nomor laporan')) colIdx.no_lap = idx;
                    else if (c.includes('pemberi tugas')) colIdx.bank = idx;
                    else if (c.includes('cabang')) colIdx.cabang = idx;
                    else if (c === 'legalitas') colIdx.legalitas = idx;
                    else if (c === 'penilai') colIdx.penilai = idx;
                    else if (c === 'luas') colIdx.luas_t = idx;
                });
                if (colIdx.luas_t !== -1) colIdx.luas_b = colIdx.luas_t + 1;
                break;
            }
        }

        if (headerRowIndex === -1) return { success: 0, skipped: 0 };

        // Loop Data
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            const namaDebitur = row[colIdx.nama];
            
            if (!namaDebitur || namaDebitur.toString().includes('Nama Debitur')) continue;

            // Cek Duplikat
            const noLap = colIdx.no_lap !== -1 ? (row[colIdx.no_lap] || '-') : '-';
            const keyCheck = `${noLap.toString().toLowerCase().trim()}_${namaDebitur.toString().toLowerCase().trim()}`;

            if (existingSet.has(keyCheck)) {
                skippedCount++;
                continue;
            }

            const parseDate = (val) => {
                if (!val) return null;
                if (typeof val === 'number') return new Date((val - (25567 + 2)) * 86400 * 1000);
                return new Date(val);
            };

            const dataFull = {
                nama_debitur: namaDebitur.toString(),
                kota: colIdx.kota !== -1 ? (row[colIdx.kota] || '-') : '-',
                alamat: colIdx.alamat !== -1 ? (row[colIdx.alamat] || '-') : '-',
                nilai_obyek: colIdx.nilai !== -1 ? Number(row[colIdx.nilai]) || 0 : 0,
                tanggal_penilaian: parseDate(row[colIdx.tgl]),
                nomor_laporan: noLap,
                pemberi_tugas: colIdx.bank !== -1 ? (row[colIdx.bank] || '-') : '-',
                cabang: colIdx.cabang !== -1 ? (row[colIdx.cabang] || '-') : '-',
                luas_tanah: colIdx.luas_t !== -1 ? Number(row[colIdx.luas_t]) || 0 : 0,
                luas_bangunan: colIdx.luas_b !== -1 ? Number(row[colIdx.luas_b]) || 0 : 0,
                legalitas: colIdx.legalitas !== -1 ? (row[colIdx.legalitas] || '-') : '-',
                nama_penilai: colIdx.penilai !== -1 ? (row[colIdx.penilai] || '-') : '-',
                koordinat: '-' 
            };
            
            row.forEach(cell => {
                if (cell && typeof cell === 'string' && cell.includes(',') && cell.length > 10 && /\d/.test(cell)) {
                    if (!dataFull.koordinat || dataFull.koordinat === '-') dataFull.koordinat = cell;
                }
            });

            try {
                await pb.collection('data_properti').create(dataFull);
                existingSet.add(keyCheck); // Tambahkan ke set biar tidak duplikat di loop yg sama
                successCount++;
            } catch (err) { console.log("Skip row error"); }
        }
        return { success: successCount, skipped: skippedCount };
    };

    return (
        <div>
            <h3 style={{marginTop:0, textAlign:'center', color:'var(--text-main)'}}>Kelola Data</h3>
            <div className="upload-box" onClick={() => document.getElementById('fileInput').click()}>
                <input 
                    id="fileInput" type="file" accept=".xlsx, .xls, .csv" multiple 
                    onChange={handleUpload} disabled={loading} style={{display:'none'}}
                />
                <span style={{fontSize: '30px'}}>📚</span>
                <p style={{margin: '10px 0 0', color: '#64748b'}}>
                    {loading ? "Sedang memproses..." : "Klik Pilih File Excel"}
                </p>
            </div>
            <div className="action-buttons">
                <button className="btn btn-danger" onClick={handleDeleteAll} disabled={loading}>
                    🗑️ Hapus Semua Data (Reset)
                </button>
            </div>
            <div style={{marginTop:'20px', textAlign:'center'}}>
                {status}
            </div>
        </div>
    );
};

export default FileUpload;