import React, { useState } from 'react';
import { pb } from './lib/pocketbase';
import logoKJPP from './assets/kjpplogo.png'; // Import Logo

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await pb.collection('users').authWithPassword(email, password);
      onLoginSuccess();
    } catch (err) {
      console.error(err);
      setError("Login Gagal! Cek email atau password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg" style={{
      height: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: '20px'
    }}>
      <div style={{
        background: 'white', 
        padding: '40px', 
        borderRadius: '12px', 
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        {/* LOGO DI HALAMAN LOGIN */}
        <img src={logoKJPP} alt="Logo" style={{height:'80px', marginBottom:'20px'}} />
        
        <h2 style={{color: '#1e3a8a', marginBottom: '5px', fontSize:'22px'}}>Selamat Datang</h2>
        <p style={{color: '#64748b', fontSize:'14px', marginBottom: '30px'}}>Silakan login untuk mengakses database.</p>
        
        {error && <div style={{background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '13px'}}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{textAlign:'left'}}>
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px', fontSize:'13px', fontWeight: '600', color:'#475569'}}>Email Kantor</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box'}}
              placeholder="nama@ayonrekan.id"
              required
            />
          </div>
          
          <div style={{marginBottom: '25px'}}>
            <label style={{display: 'block', marginBottom: '5px', fontSize:'13px', fontWeight: '600', color:'#475569'}}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box'}}
              placeholder="••••••••"
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            style={{
              width: '100%', 
              padding: '12px', 
              background: '#1e3a8a', /* Warna Biru Tua Logo */
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              transition: 'background 0.3s'
            }}
          >
            {loading ? 'Memproses...' : 'MASUK'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;