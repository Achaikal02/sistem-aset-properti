import React, { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import DataTable from './components/DataTable';
import MapView from './components/MapView';

function App() {
  // State halaman: 'dashboard', 'upload', atau 'map'
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State refresh: Agar saat pindah dari Upload -> Dashboard, datanya terbaru
  const [refresh, setRefresh] = useState(false);

  const handleUploadSuccess = () => {
    setRefresh(!refresh); // Trigger update data
    // Opsional: Jika ingin otomatis pindah ke dashboard setelah upload, buka komen di bawah:
    // setActiveTab('dashboard'); 
  };

  return (
    <div>
      
      {/* === HEADER & NAVIGASI === */}
      <div className="header-container">
        <h1 className="header-title">🏢 Sistem Aset Properti</h1>

        {/* MENU TOMBOL (3 Menu) */}
        <div style={{display:'flex', justifyContent:'center', gap:'10px', paddingBottom:'20px', flexWrap:'wrap'}}>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="btn"
            style={{
              background: activeTab==='dashboard' ? 'var(--btn-main)' : 'white',
              color: activeTab==='dashboard' ? 'black' : 'var(--text)',
              border: '1px solid var(--btn-main)', 
              minWidth: '140px'
            }}
          >
            📂 Dashboard
          </button>

          <button 
            onClick={() => setActiveTab('upload')}
            className="btn"
            style={{
              background: activeTab==='upload' ? 'var(--btn-main)' : 'white',
              color: activeTab==='upload' ? 'black' : 'var(--text)',
              border: '1px solid var(--btn-main)',
              minWidth: '140px'
            }}
          >
            ⚙️ Kelola Data
          </button>

          <button 
            onClick={() => setActiveTab('map')}
            className="btn"
            style={{
              background: activeTab==='map' ? 'var(--btn-main)' : 'white',
              color: activeTab==='map' ? 'black' : 'var(--text)',
              border: '1px solid var(--btn-main)',
              minWidth: '140px'
            }}
          >
            🗺️ Peta Lokasi
          </button>

        </div>
      </div>
      
      {/* === KONTEN UTAMA === */}
      {/* Gunakan 'content-fullwidth' hanya untuk Peta, sisanya 'content-centered' */}
      <div className={activeTab === 'map' ? 'content-fullwidth' : 'content-centered'}>
        
        {/* 1. HALAMAN DASHBOARD (Hanya Tabel) */}
        {activeTab === 'dashboard' && (
          <div className="card" style={{animation: 'fadeIn 0.3s'}}>
            <DataTable refreshTrigger={refresh} />
          </div>
        )}

        {/* 2. HALAMAN KELOLA DATA (Hanya Upload) */}
        {activeTab === 'upload' && (
          <div className="card" style={{maxWidth: '800px', margin: '0 auto', animation: 'fadeIn 0.3s'}}>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        )}

        {/* 3. HALAMAN PETA */}
        {activeTab === 'map' && (
          <div style={{animation: 'fadeIn 0.3s'}}> 
             <MapView />
          </div>
        )}

      </div>

    </div>
  );
}

export default App;