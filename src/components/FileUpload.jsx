import React, { useState } from 'react';
import * as xlsx from 'xlsx';
import { pb } from '../lib/pocketbase';

const FileUpload = ({ onUploadSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    // --- FITUR HAPUS SEMUA (CHUNK DELETE) ---
    const handleDeleteAll = async () => {
        if (!window.confirm("⚠️ PERINGATAN: Ini akan menghapus SEMUA data di database!\nYakin ingin lanjut?")) return;
        setLoading(true);
        setStatus(<div style={{color:'orange'}}>⏳ Memulai penghapusan bertahap...</div>);

        try {
            pb.autoCancellation(false);
            let totalDeleted = 0;
            let hasMore = true;

            while (hasMore) {
                const result = await pb.collection('data_properti').getList(1, 50, { fields: 'id' });
                const items = result.items;
                if (items.length === 0) { hasMore = false; break; }

                await Promise.all(items.map(item => pb.collection('data_properti').delete(item.id)));
                totalDeleted += items.length;
                setStatus(<div style={{color:'blue'}}>🗑️ Terhapus: {totalDeleted} data...</div>);
            }
            
            setStatus(<div style={{color:'green'}}>✅ Database Bersih (0 Data).</div>);
            onUploadSuccess();
        } catch (error) {
            setStatus(<div style={{color:'red'}}>❌ Gagal hapus: {error.message}</div>);
        } finally {
            setLoading(false);
        }
    };

    // --- FITUR UPLOAD (DENGAN SMART HEADER DETECTION) ---
    const handleUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        pb.autoCancellation(false);
        setStatus(<div>🔄 Menganalisa file...</div>);
        
        let reportLog = []; 
        let grandTotalSuccess = 0;
        let grandTotalSkipped = 0;

        try {
            // 1. AMBIL FINGERPRINT (Cek Duplikat)
            const existingRecords = await pb.collection('data_properti').getFullList({ fields: 'nomor_laporan, nama_debitur' });
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
                const sheetsData = await readAllSheets(file);
                
                for (const sheet of sheetsData) {
                    // Update status realtime
                    setStatus(
                        <div>
                            <p>📂 File: <b>{file.name}</b></p>
                            <p>📑 Memproses Sheet: <b>{sheet.sheetName}</b>...</p>
                            <ul style={{textAlign:'left', fontSize:'12px', color:'#666'}}>
                                {reportLog.map((log, idx) => <li key={idx}>{log}</li>)}
                            </ul>
                        </div>
                    );

                    // Proses dengan logika Scoring Header
                    const result = await processRawData(sheet.data, existingSet);
                    
                    if (result.success > 0 || result.skipped > 0) {
                        reportLog.push(`✅ ${sheet.sheetName}: +${result.success} | ⏩ ${result.skipped} Duplikat`);
                        grandTotalSuccess += result.success;
                        grandTotalSkipped += result.skipped;
                    } else {
                        reportLog.push(`⚠️ ${sheet.sheetName}: Gagal Deteksi Header`);
                    }
                }
            }

            // HASIL AKHIR
            setStatus(
                <div style={{textAlign:'left', background:'#ecfdf5', padding:'15px', borderRadius:'8px', border:'1px solid #10b981'}}>
                    <h4 style={{margin:'0 0 5px 0', color:'#047857'}}>🎉 Upload Selesai!</h4>
                    <p style={{margin:'0 0 10px 0', fontSize:'14px'}}>
                        Berhasil: <b>{grandTotalSuccess}</b> <br/>
                        Duplikat: <b>{grandTotalSkipped}</b>
                    </p>
                    <div style={{maxHeight:'150px', overflowY:'auto', borderTop:'1px solid #ddd', paddingTop:'5px'}}>
                        <ul style={{margin:0, paddingLeft:'20px', fontSize:'12px'}}>
                            {reportLog.map((log, idx) => <li key={idx} style={{marginBottom:'4px'}}>{log}</li>)}
                        </ul>
                    </div>
                </div>
            );
            onUploadSuccess();

        } catch (err) {
            console.error(err);
            setStatus(<div style={{color:'red'}}>❌ Error Fatal: {err.message}</div>);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Baca File (Gunakan ArrayBuffer untuk Excel modern)
    const readAllSheets = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = xlsx.read(data, { type: 'array' }); // Ubah ke type: array
                    
                    const result = workbook.SheetNames.map(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        // Ambil data mentah (header: 1 menghasilkan array of arrays)
                        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                        return { sheetName, data: jsonData };
                    });
                    resolve(result);
                } catch (e) { reject(e); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file); // Ubah ke readAsArrayBuffer
        });
    };

    // Helper: Smart Mapping (Scoring System)
    const processRawData = async (rows, existingSet) => {
        let successCount = 0;
        let skippedCount = 0;
        
        // --- LOGIKA PENCARIAN HEADER (SCORING) ---
        let headerRowIndex = -1;
        let bestScore = 0;

        // Kata kunci yang dicari di baris header
        const keywords = ['nama', 'debitur', 'tanggal', 'laporan', 'nilai', 'obyek', 'luas', 'tanah', 'kota', 'alamat', 'cabang'];

        // Cek 100 baris pertama (jaga-jaga headernya jauh di bawah)
        for (let i = 0; i < Math.min(rows.length, 100); i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            // Hitung skor: Berapa banyak kata kunci yang muncul di baris ini?
            let score = 0;
            const rowString = row.map(c => c ? c.toString().toLowerCase() : '').join(' ');
            
            keywords.forEach(key => {
                if (rowString.includes(key)) score++;
            });

            // Jika skor lebih baik dari sebelumnya, ini kandidat header!
            // Minimal harus ada 3 kata kunci cocok agar dianggap header valid
            if (score > bestScore && score >= 3) {
                bestScore = score;
                headerRowIndex = i;
            }
        }

        if (headerRowIndex === -1) return { success: 0, skipped: 0 }; // Nyerah, gak nemu header

        // --- MAPPING KOLOM (Berdasarkan Header yang Ditemukan) ---
        const headerRow = rows[headerRowIndex];
        const colIdx = {
            nama: -1, kota: -1, alamat: -1, nilai: -1, 
            tgl: -1, no_lap: -1, bank: -1, cabang: -1, 
            luas_t: -1, luas_b: -1, legalitas: -1, penilai: -1
        };

        headerRow.forEach((colName, idx) => {
            if (!colName) return;
            const c = colName.toString().toLowerCase().trim();
            
            // Logika pencarian kolom yang fleksibel
            if (c.includes('nama') && c.includes('debitur')) colIdx.nama = idx;
            else if (c.includes('nama') && !colIdx.nama === -1) colIdx.nama = idx; // Cadangan
            
            else if (c.includes('kota') || c === 'kab/kotamadya') colIdx.kota = idx;
            else if (c.includes('alamat')) colIdx.alamat = idx;
            
            else if (c.includes('nilai') && (c.includes('obyek') || c.includes('objek'))) colIdx.nilai = idx;
            else if (c.includes('tanggal') && c.includes('penilaian')) colIdx.tgl = idx;
            
            else if (c.includes('nomor') && c.includes('laporan')) colIdx.no_lap = idx;
            else if (c.includes('pemberi') || c.includes('bank')) colIdx.bank = idx;
            else if (c.includes('cabang')) colIdx.cabang = idx;
            else if (c.includes('legalitas')) colIdx.legalitas = idx;
            else if (c.includes('penilai')) colIdx.penilai = idx;
            
            // Luas Tanah biasanya cuma "Luas" atau "Luas Tanah"
            else if (c === 'luas' || c.includes('luas tanah')) colIdx.luas_t = idx;
        });

        // Trik: Luas Bangunan biasanya persis di sebelah kanan Luas Tanah
        if (colIdx.luas_t !== -1) colIdx.luas_b = colIdx.luas_t + 1;

        // --- LOOP DATA ---
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const namaDebitur = colIdx.nama !== -1 ? row[colIdx.nama] : null;
            
            // Validasi baris sampah
            if (!namaDebitur || namaDebitur.toString().trim() === '' || namaDebitur.toString().includes('Nama Debitur')) continue;

            // Cek Duplikat
            const noLap = colIdx.no_lap !== -1 ? (row[colIdx.no_lap] || '-') : '-';
            const keyCheck = `${noLap.toString().toLowerCase().trim()}_${namaDebitur.toString().toLowerCase().trim()}`;

            if (existingSet.has(keyCheck)) { skippedCount++; continue; }

            // Helper format tanggal
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

            // Cari Koordinat Otomatis di baris ini
            row.forEach(cell => {
                if (cell && typeof cell === 'string' && cell.includes(',') && cell.length > 10 && /\d/.test(cell)) {
                    if (!dataFull.koordinat || dataFull.koordinat === '-') dataFull.koordinat = cell;
                }
            });

            try {
                await pb.collection('data_properti').create(dataFull);
                existingSet.add(keyCheck);
                successCount++;
            } catch (err) { console.log("Skip row error"); }
        }
        
        return { success: successCount, skipped: skippedCount };
    };

    return (
        <div>
            <h3 style={{marginTop:0, textAlign:'center'}}>Kelola Data</h3>
            <div className="upload-box" onClick={() => document.getElementById('fileInput').click()}>
                <input 
                    id="fileInput" type="file" accept=".xlsx, .xls" multiple 
                    onChange={handleUpload} disabled={loading} style={{display:'none'}}
                />
                <span style={{fontSize: '30px'}}>📚</span>
                <p style={{margin: '10px 0 0', color: '#64748b'}}>
                    {loading ? "Sedang menganalisa file..." : "Klik Pilih File Excel"}
                </p>
            </div>
            <div className="action-buttons" style={{display:'flex', justifyContent:'center', marginTop:'20px'}}>
                <button className="btn btn-danger" onClick={handleDeleteAll} disabled={loading}>🗑️ Reset Database</button>
            </div>
            <div style={{marginTop:'20px', textAlign:'center'}}>
                {status}
            </div>
        </div>
    );
};

export default FileUpload;