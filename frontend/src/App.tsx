import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export type User = {
  email: string;
  role: 'admin' | 'standard';
  token: string;
  userPoolId?: string;
  clientId?: string;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('saas-user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: User) => {
    console.log('📥 DEBUG App.tsx: handleLogin CALLED');
    console.log('User data:', userData);

    if (!userData || !userData.email) {
    console.error('❌ ERROR: Invalid userData received');
    return;
  }

    const userWithConfig = {
      ...userData,
      userPoolId: 'us-east-2_xyVVCldfd',
      clientId: '2h6j1cjssdt0mcuehh5cdbmut7',
      apiEndpoint: 'https://kx7ca5ymaf.execute-api.us-east-2.amazonaws.com/prod/'
    };
    setUser(userWithConfig);
    console.log('💾 Saving to localStorage...');
    localStorage.setItem('saas-user', JSON.stringify(userWithConfig));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('saas-user');
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;