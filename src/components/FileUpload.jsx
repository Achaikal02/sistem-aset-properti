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
        setStatus(<div className="status-text-warning">⏳ Memulai penghapusan bertahap...</div>);

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
                setStatus(<div className="status-text-info">🗑️ Terhapus: {totalDeleted} data...</div>);
            }
            
            setStatus(<div className="status-text-success">✅ Database Bersih (0 Data).</div>);
            if (onUploadSuccess) onUploadSuccess();
        } catch (error) {
            setStatus(<div className="status-text-error">❌ Gagal hapus: {error.message}</div>);
        } finally {
            setLoading(false);
        }
    };

    // --- FITUR UPLOAD ---
    const handleUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        pb.autoCancellation(false);
        setStatus(<div className="status-text-info">🔄 Menganalisa file...</div>);
        
        let reportLog = []; 
        let grandTotalSuccess = 0;
        let grandTotalSkipped = 0;

        try {
            // 1. SIAPKAN DATA EXISTING (Cek Duplikat Kombinasi)
            const existingRecords = await pb.collection('data_properti').getFullList({ 
                fields: 'nomor_laporan, nama_debitur, luas_tanah, nilai_obyek' 
            });
            
            const existingSet = new Set(
                existingRecords.map(r => {
                    const no = r.nomor_laporan ? r.nomor_laporan.toString().toLowerCase().trim() : '-';
                    const nama = r.nama_debitur ? r.nama_debitur.toString().toLowerCase().trim() : '-';
                    const luas = r.luas_tanah ? r.luas_tanah.toString() : '0';
                    const nilai = r.nilai_obyek ? r.nilai_obyek.toString() : '0';
                    return `${no}_${nama}_${luas}_${nilai}`;
                })
            );

            // 2. LOOP FILE
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const sheetsData = await readAllSheets(file);
                
                for (const sheet of sheetsData) {
                    setStatus(
                        <div className="process-box">
                            <p>📂 File: <b>{file.name}</b></p>
                            <p>📑 Memproses Sheet: <b>{sheet.sheetName}</b>...</p>
                            <ul className="log-list">
                                {reportLog.map((log, idx) => <li key={idx}>{log}</li>)}
                            </ul>
                        </div>
                    );

                    const result = await processRawData(sheet.data, existingSet);
                    
                    if (result.success > 0 || result.skipped > 0) {
                        reportLog.push(`✅ ${sheet.sheetName}: +${result.success} | ⏩ ${result.skipped} Duplikat`);
                        grandTotalSuccess += result.success;
                        grandTotalSkipped += result.skipped;
                    } else {
                        reportLog.push(`⚠️ ${sheet.sheetName}: Gagal/Kosong`);
                    }
                }
            }

            // HASIL AKHIR
            setStatus(
                <div className="success-result-box">
                    <h4 className="success-title">🎉 Upload Selesai!</h4>
                    <p className="success-summary">
                        Berhasil: <b>{grandTotalSuccess}</b> <br/>
                        Duplikat: <b>{grandTotalSkipped}</b>
                    </p>
                    <div className="log-scroll-area">
                        <ul style={{margin:0, paddingLeft:'20px'}}>
                            {reportLog.map((log, idx) => <li key={idx} className="log-item">{log}</li>)}
                        </ul>
                    </div>
                </div>
            );
            if (onUploadSuccess) onUploadSuccess();

        } catch (err) {
            console.error(err);
            setStatus(<div className="status-text-error">❌ Error Fatal: {err.message}</div>);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Baca File
    const readAllSheets = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = xlsx.read(data, { type: 'array' });
                    
                    const result = workbook.SheetNames.map(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                        return { sheetName, data: jsonData };
                    });
                    resolve(result);
                } catch (e) { reject(e); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    // Helper: Smart Mapping
    const processRawData = async (rows, existingSet) => {
        let successCount = 0;
        let skippedCount = 0;
        
        // --- 1. DETEKSI HEADER ---
        let headerRowIndex = -1;
        let bestScore = 0;
        const keywords = ['nama', 'debitur', 'tanggal', 'laporan', 'nilai', 'obyek', 'luas', 'tanah', 'kota', 'alamat', 'cabang'];

        // Cari baris header
        for (let i = 0; i < Math.min(rows.length, 100); i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            let score = 0;
            const rowString = row.map(c => c ? c.toString().toLowerCase() : '').join(' ');
            keywords.forEach(key => { if (rowString.includes(key)) score++; });

            if (score > bestScore && score >= 3) {
                bestScore = score;
                headerRowIndex = i;
            }
        }

        if (headerRowIndex === -1) return { success: 0, skipped: 0 };

        const headerRow = rows[headerRowIndex];
        const colIdx = {
            nama: -1, kota: -1, alamat: -1, nilai: -1, 
            tgl: -1, no_lap: -1, bank: -1, cabang: -1, 
            luas_t: -1, luas_b: -1, legalitas: -1, penilai: -1
        };

        headerRow.forEach((colName, idx) => {
            if (!colName) return;
            const c = colName.toString().toLowerCase().trim();
            if (c.includes('nama') && c.includes('debitur')) colIdx.nama = idx;
            else if (c.includes('nama') && colIdx.nama === -1) colIdx.nama = idx; // Prioritas rendah
            else if (c.includes('kota') || c === 'kab/kotamadya') colIdx.kota = idx;
            else if (c.includes('alamat')) colIdx.alamat = idx;
            else if (c.includes('nilai') && (c.includes('obyek') || c.includes('objek'))) colIdx.nilai = idx;
            else if (c.includes('tanggal') && c.includes('penilaian')) colIdx.tgl = idx;
            else if (c.includes('nomor') && c.includes('laporan')) colIdx.no_lap = idx;
            else if (c.includes('pemberi') || c.includes('bank')) colIdx.bank = idx;
            else if (c.includes('cabang')) colIdx.cabang = idx;
            else if (c.includes('legalitas')) colIdx.legalitas = idx;
            else if (c.includes('penilai')) colIdx.penilai = idx;
            else if (c === 'luas' || c.includes('luas tanah')) colIdx.luas_t = idx;
        });

        if (colIdx.luas_t !== -1 && colIdx.luas_b === -1) colIdx.luas_b = colIdx.luas_t + 1;

        // --- 2. LOOP DATA DENGAN "SMART FILL" ---
        // Variable untuk menyimpan Nomor Laporan & Tanggal terakhir (utk merged cells)
        let lastNoLap = '-';
        let lastTgl = null;
        let lastBank = '-';

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue; // Skip baris benar-benar kosong
            
            // 1. Handle Nomor Laporan (Isi dari atas jika kosong)
            let rawNoLap = colIdx.no_lap !== -1 ? row[colIdx.no_lap] : null;
            if (rawNoLap && rawNoLap.toString().trim() !== '' && rawNoLap.toString().trim() !== '-') {
                lastNoLap = rawNoLap.toString().trim();
            }
            // Jika kosong, gunakan lastNoLap (Nomor Laporan sebelumnya)

            // 2. Handle Tanggal (Isi dari atas jika kosong)
            const parseDate = (val) => {
                if (!val) return null;
                if (typeof val === 'number') return new Date((val - (25567 + 2)) * 86400 * 1000);
                return new Date(val);
            };
            let rawTgl = colIdx.tgl !== -1 ? row[colIdx.tgl] : null;
            if (rawTgl) { lastTgl = parseDate(rawTgl); }

            // 3. Handle Nama Debitur (Sangat Penting)
            let namaDebitur = colIdx.nama !== -1 ? row[colIdx.nama] : null;
            namaDebitur = namaDebitur ? namaDebitur.toString().trim() : '';

            // LOGIKA BARU: Jika Nama KOSONG, tapi ada Nilai/Luas, anggap ini PEMBANDING
            const nilaiVal = colIdx.nilai !== -1 ? Number(row[colIdx.nilai]) || 0 : 0;
            const luasVal = colIdx.luas_t !== -1 ? Number(row[colIdx.luas_t]) || 0 : 0;

            if (namaDebitur === '' || namaDebitur.toLowerCase().includes('nama debitur')) {
                // Cek apakah ini baris data yang valid (ada Nilai ATAU Luas)
                if ((nilaiVal > 0 || luasVal > 0) && lastNoLap !== '-') {
                    namaDebitur = "Aset Pembanding"; // Beri nama otomatis
                } else {
                    continue; // Skip jika tidak ada nama DAN tidak ada nilai/luas (baris sampah)
                }
            }

            // 4. Cek Duplikat
            // Key Unik = NoLap + Nama + Luas + Nilai
            const keyCheck = `${lastNoLap.toLowerCase()}_${namaDebitur.toLowerCase()}_${luasVal}_${nilaiVal}`;

            if (existingSet.has(keyCheck)) { 
                skippedCount++; 
                continue; 
            }

            // 5. Susun Data Final
            const dataFull = {
                nama_debitur: namaDebitur,
                kota: colIdx.kota !== -1 ? (row[colIdx.kota] || '-') : '-',
                alamat: colIdx.alamat !== -1 ? (row[colIdx.alamat] || '-') : '-',
                nilai_obyek: nilaiVal,
                tanggal_penilaian: lastTgl, // Pakai tanggal terakhir jika kosong
                nomor_laporan: lastNoLap,   // Pakai nomor terakhir jika kosong
                pemberi_tugas: colIdx.bank !== -1 ? (row[colIdx.bank] || '-') : '-',
                cabang: colIdx.cabang !== -1 ? (row[colIdx.cabang] || '-') : '-',
                luas_tanah: luasVal,
                luas_bangunan: colIdx.luas_b !== -1 ? Number(row[colIdx.luas_b]) || 0 : 0,
                legalitas: colIdx.legalitas !== -1 ? (row[colIdx.legalitas] || '-') : '-',
                nama_penilai: colIdx.penilai !== -1 ? (row[colIdx.penilai] || '-') : '-',
                koordinat: '-'
            };

            // Cari Koordinat (Scanning semua kolom)
            row.forEach(cell => {
                if (cell && typeof cell === 'string' && cell.includes(',') && cell.length > 10 && /\d/.test(cell)) {
                    // Validasi kasar format koordinat
                    if (!dataFull.koordinat || dataFull.koordinat === '-') dataFull.koordinat = cell;
                }
            });

            try {
                await pb.collection('data_properti').create(dataFull);
                existingSet.add(keyCheck);
                successCount++;
            } catch (err) { console.log("Gagal simpan row:", err); }
        }
        return { success: successCount, skipped: skippedCount };
    };

    return (
        <div>
            <h3 className="upload-title">Kelola Data</h3>
            
            <div className="upload-box" onClick={() => document.getElementById('fileInput').click()}>
                <input 
                    id="fileInput" type="file" accept=".xlsx, .xls" multiple 
                    onChange={handleUpload} disabled={loading} style={{display:'none'}}
                />
                <span className="upload-icon">📚</span>
                <p className="upload-hint">
                    {loading ? "Sedang menganalisa file..." : "Klik Pilih File Excel"}
                </p>
            </div>

            <div className="upload-actions">
                <button className="btn btn-danger" onClick={handleDeleteAll} disabled={loading}>🗑️ Reset Database</button>
            </div>

            <div className="status-wrapper">
                {status}
            </div>
        </div>
    );
};

export default FileUpload;