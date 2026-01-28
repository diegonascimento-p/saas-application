import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { User } from '../App';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import axios from 'axios';

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  description?: string;
  features?: string[];
};

type Image = {
  id: number;
  name: string;
  url: string;
  category: string;
  size?: string;
  uploaded?: string;
  description?: string;
};

type DashboardProps = {
  user: User;
  onLogout: () => void;
};

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'gallery' | 'admin'>('products');
  const [usingRealApi, setUsingRealApi] = useState(false);

  const apiEndpoint = 'https://kx7ca5ymaf.execute-api.us-east-2.amazonaws.com/prod';

  useEffect(() => {
    fetchData();
  }, []);

  const getAuthToken = async (): Promise<string> => {
    const session = await fetchAuthSession();

    if (!session.tokens?.idToken) {
      throw new Error('No authentication session found');
    }

    const idToken = session.tokens.idToken as any;
    return idToken.jwtToken ?? idToken.toString();
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (user.token && !user.token.startsWith('demo-')) {
        await fetchRealData();
      } else {
        await fetchMockData();
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch data. Using demo mode.');
      await fetchMockData();
    } finally {
      setLoading(false);
    }
  };

  const fetchRealData = async () => {
    const token = await getAuthToken();

    console.log('Using real API with token:', token.substring(0, 40) + '...');

    const api = axios.create({
      baseURL: apiEndpoint,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const [productsResponse, imagesResponse] = await Promise.allSettled([
      api.get('/data'),
      api.get('/images'),
    ]);

    if (productsResponse.status === 'fulfilled') {
      setProducts(productsResponse.value.data.products || []);
    } else {
      throw new Error('Failed to fetch products');
    }

    if (imagesResponse.status === 'fulfilled') {
      setImages(imagesResponse.value.data.images || []);
    } else {
      throw new Error('Failed to fetch images');
    }

    setUsingRealApi(true);
  };

  const fetchMockData = async () => {
    await new Promise((r) => setTimeout(r, 600));
    setProducts([]);
    setImages([]);
    setUsingRealApi(false);
  };

  const handleLogout = async () => {
    try {
      if (user.token && !user.token.startsWith('demo-')) {
        await signOut();
      }
    } catch (err) {
      console.error('Error signing out:', err);
    }
    onLogout();
  };

  const handleTestApi = async () => {
    try {
      const token = await getAuthToken();
      const res = await axios.get(`${apiEndpoint}/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert(`API OK (${res.status})`);
    } catch (err: any) {
      alert(`API FAILED: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🚀 SaaS Platform Dashboard</h1>
        <div>
          {usingRealApi && (
            <button onClick={handleTestApi}>🔍 Test API</button>
          )}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="tabs">
        <button onClick={() => setActiveTab('products')}>📦 Products</button>
        <button onClick={() => setActiveTab('gallery')}>🖼️ Gallery</button>
        {user.role === 'admin' && (
          <button onClick={() => setActiveTab('admin')}>⚙️ Admin</button>
        )}
      </div>

      {activeTab === 'products' && (
        <pre>{JSON.stringify(products, null, 2)}</pre>
      )}

      {activeTab === 'gallery' && (
        <pre>{JSON.stringify(images, null, 2)}</pre>
      )}

      {activeTab === 'admin' && user.role === 'admin' && (
        <div>Admin controls</div>
      )}
    </div>
  );
};

export default Dashboard;
