import React, { useState, useEffect } from 'react';
import './App.css';
import { pb } from './lib/pocketbase';
import Login from './Login';
import FileUpload from './components/FileUpload';
import DataTable from './components/DataTable';
import MapView from './components/MapView';

// IMPORT LOGO (Pastikan file ada di folder src/assets)
import logoKJPP from './assets/kjpplogo.png';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(pb.authStore.isValid);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refresh, setRefresh] = useState(false);

  // --- LOGOUT ---
  const handleLogout = () => {
    pb.authStore.clear();
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  };

  const handleUploadSuccess = () => {
    setRefresh(!refresh); 
  };

  // --- CEK LOGIN ---
  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  // --- APP UTAMA ---
  return (
    <div className="app-root">
      
      {/* === HEADER CONTAINER === */}
      <div className="header-container">
        
        {/* Baris Atas: Logo Kiri & Profil Kanan */}
        <div className="header-top">
            
            {/* BRANDING LOGO */}
            <div className="brand-wrapper">
                <img src={logoKJPP} alt="Logo KJPP Ayon Suherman" className="header-logo" />
                <div className="header-title-block">
                    <h1>SISTEM DATA PROPERTI</h1>
                    <p>Database & Pemetaan Aset</p>
                </div>
            </div>
            
            {/* USER PROFILE */}
            <div className="user-container">
                <div className="user-details">
                    <div className="user-email">
                        {pb.authStore.model?.email}
                    </div>
                    <div className="user-role">
                        {pb.authStore.model?.role || 'User'}
                    </div>
                </div>
                
                <button onClick={handleLogout} className="btn-logout">
                    Keluar
                </button>
            </div>
        </div>

        {/* Baris Bawah: Menu Navigasi (Style Tab) */}
        <div className="nav-menu">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`btn btn-nav ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            📂 Dashboard Data
          </button>

          <button 
            onClick={() => setActiveTab('map')}
            className={`btn btn-nav ${activeTab === 'map' ? 'active' : ''}`}
          >
            🗺️ Peta Sebaran
          </button>

          <button 
            onClick={() => setActiveTab('upload')}
            className={`btn btn-nav ${activeTab === 'upload' ? 'active' : ''}`}
          >
            ⚙️ Kelola / Upload
          </button>
        </div>
      </div>
      
      {/* === KONTEN UTAMA (KONSISTEN FULL WIDTH) === */}
      <div className="main-content-area">
        
        {activeTab === 'dashboard' && (
          <div className="card animate-fade dashboard-centered">
            <DataTable refreshTrigger={refresh} />
          </div>
        )}

        {activeTab === 'upload' && (
          // MENGGUNAKAN full-height-card AGAR KONSISTEN DENGAN DASHBOARD
          <div className="card animate-fade full-height-card">
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        )}

        {activeTab === 'map' && (
          <div className="map-wrapper animate-fade"> 
             <MapView />
          </div>
        )}

      </div>

    </div>
  );
}

export default App;