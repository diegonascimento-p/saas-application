import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { User } from '../App';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import axios from 'axios';

type RealProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  image_key: string;
  is_active: boolean;
  created_at: string;
};

type RealImage = {
  id: number;
  name: string;
  url: string;
  category: string;
  size?: string;
  uploaded?: string;
  description?: string;
};

type MockProduct = {
  id: number;
  name: string;
  price: number;
  category: string;
  description?: string;
  features?: string[];
};

type MockImage = {
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
  const [realProducts, setRealProducts] = useState<RealProduct[]>([]);
  const [realImages, setRealImages] = useState<RealImage[]>([]);
  const [mockProducts, setMockProducts] = useState<MockProduct[]>([]);
  const [mockImages, setMockImages] = useState<MockImage[]>([]);
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
      const data = productsResponse.value.data;
      const productsArray = Array.isArray(data) ? data : (data.products || data);
      setRealProducts(productsArray);
    } else {
      throw new Error('Failed to fetch products');
    }

    if (imagesResponse.status === 'fulfilled') {
      const data = imagesResponse.value.data;
      const imagesArray = Array.isArray(data) ? data : (data.images || data);
      setRealImages(imagesArray);
    } else {
      throw new Error('Failed to fetch images');
    }

    setUsingRealApi(true);
  };

  const fetchMockData = async () => {
    const mockProductsData = user.role === 'admin' 
      ? [
          { 
            id: 1, 
            name: 'Enterprise Plan', 
            price: 299, 
            category: 'Premium',
            description: 'Full enterprise features with unlimited users',
            features: ['Unlimited Users', '24/7 Support', 'Custom Integration', 'Advanced Analytics']
          },
          { 
            id: 2, 
            name: 'Business Plan', 
            price: 199, 
            category: 'Business',
            description: 'For growing businesses with up to 50 users',
            features: ['Up to 50 Users', 'Business Hours Support', 'API Access', 'Standard Analytics']
          },
          { 
            id: 3, 
            name: 'Starter Plan', 
            price: 99, 
            category: 'Basic',
            description: 'Perfect for small teams starting out',
            features: ['Up to 10 Users', 'Email Support', 'Basic Features']
          },
        ]
      : [
          { 
            id: 3, 
            name: 'Starter Plan', 
            price: 99, 
            category: 'Basic',
            description: 'Perfect for small teams starting out',
            features: ['Up to 10 Users', 'Email Support', 'Basic Features']
          },
          { 
            id: 2, 
            name: 'Business Plan', 
            price: 199, 
            category: 'Business',
            description: 'For growing businesses with up to 50 users',
            features: ['Up to 50 Users', 'Business Hours Support', 'API Access']
          },
        ];

    const mockImagesData = user.role === 'admin'
      ? [
          { 
            id: 1, 
            name: 'dashboard-preview.jpg', 
            url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&w=300&h=200&fit=crop', 
            category: 'Dashboard',
            size: '245 KB',
            uploaded: '2024-01-15',
            description: 'Main dashboard interface preview'
          },
          { 
            id: 2, 
            name: 'analytics-chart.png', 
            url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&w=300&h=200&fit=crop', 
            category: 'Analytics',
            size: '180 KB',
            uploaded: '2024-01-14',
            description: 'Analytics chart visualization'
          },
          { 
            id: 3, 
            name: 'user-profile.jpg', 
            url: 'https://images.unsplash.com/photo-1551836026-d5c2e0c49b61?ixlib=rb-4.0.3&w=300&h=200&fit=crop', 
            category: 'Users',
            size: '310 KB',
            uploaded: '2024-01-13',
            description: 'User profile interface'
          },
        ]
      : [
          { 
            id: 1, 
            name: 'dashboard-preview.jpg', 
            url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&w=300&h=200&fit=crop', 
            category: 'Dashboard',
            size: '245 KB',
            uploaded: '2024-01-15',
            description: 'Main dashboard interface preview'
          },
          { 
            id: 2, 
            name: 'analytics-chart.png', 
            url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&w=300&h=200&fit=crop', 
            category: 'Analytics',
            size: '180 KB',
            uploaded: '2024-01-14',
            description: 'Analytics chart visualization'
          },
        ];

    await new Promise((r) => setTimeout(r, 600));
    
    setMockProducts(mockProductsData);
    setMockImages(mockImagesData);
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
      alert(`API Test Successful!\nStatus: ${res.status}`);
    } catch (err: any) {
      alert(`API Test Failed: ${err.message}`);
    }
  };

  const handleRefresh = () => {
    fetchData();
  };

  const getProductImageUrl = (imageKey: string): string => {
    if (!usingRealApi) {
      return 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&w=300&h=200&fit=crop';
    }
    
    const matchingImage = realImages.find(img => 
      img.name.toLowerCase() === imageKey.toLowerCase() || 
      img.name.toLowerCase().includes(imageKey.toLowerCase().replace('.jpg', ''))
    );
    
    return matchingImage?.url || 'https://via.placeholder.com/300x200?text=No+Image';
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading dashboard data...</p>
        <p className="loading-note">
          {usingRealApi ? '🔗 Fetching from AWS Lambda functions...' : '🔄 Loading demo data...'}
        </p>
      </div>
    );
  }

  const currentProducts = usingRealApi ? realProducts : mockProducts;
  const currentImages = usingRealApi ? realImages : mockImages;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>🚀 SaaS Platform Dashboard</h1>
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            <span className={`user-role ${user.role}`}>
              {user.role.toUpperCase()} USER
            </span>
            <span className={`api-status ${usingRealApi ? 'connected' : 'demo'}`}>
              {usingRealApi ? (
                <>
                  <span className="status-dot connected"></span>
                  AWS API Connected
                </>
              ) : (
                <>
                  <span className="status-dot demo"></span>
                  Demo Mode
                </>
              )}
            </span>
          </div>
        </div>
        <div className="header-right">
          {usingRealApi && (
            <button onClick={handleTestApi} className="test-api-button">
              🔍 Test API
            </button>
          )}
          <button onClick={handleRefresh} className="refresh-button">
            ↻ Refresh Data
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div className={`message-banner ${error.includes('demo') ? 'info' : 'error'}`}>
          {error.includes('demo') ? 'ℹ️' : '⚠️'} {error}
        </div>
      )}

      <div className="stats-overview">
        <div className="stat-card">
          <h3>Products</h3>
          <div className="stat-value">{currentProducts.length}</div>
          <div className="stat-desc">
            {user.role === 'admin' ? 'Full catalog' : 'Limited access'}
            {usingRealApi && ' (Live)'}
          </div>
        </div>
        <div className="stat-card">
          <h3>Gallery Images</h3>
          <div className="stat-value">{currentImages.length}</div>
          <div className="stat-desc">
            {user.role === 'admin' ? 'All images' : 'Limited access'}
            {usingRealApi && ' (Live)'}
          </div>
        </div>
        <div className="stat-card">
          <h3>User Role</h3>
          <div className="stat-value">{user.role}</div>
          <div className="stat-desc">
            {user.role === 'admin' ? 'Administrator' : 'Standard'}
          </div>
        </div>
        <div className="stat-card">
          <h3>Data Source</h3>
          <div className="stat-value">{usingRealApi ? '🔗 AWS' : '🔄 Demo'}</div>
          <div className="stat-desc">
            {usingRealApi ? 'Live API Gateway' : 'Mock Data'}
          </div>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          📦 Products
        </button>
        <button 
          className={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
          onClick={() => setActiveTab('gallery')}
        >
          🖼️ Gallery
        </button>
        {user.role === 'admin' && (
          <button 
            className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            ⚙️ Admin Controls
          </button>
        )}
      </div>

      <div className="tab-content">
        {activeTab === 'products' && (
          <div className="products-section">
            <div className="section-header">
              <h2>Product Catalog</h2>
              <div className="section-actions">
                <span className="data-source-badge">
                  {usingRealApi ? 'Live from AWS Lambda' : 'Demo Data'}
                </span>
                {user.role === 'admin' && (
                  <button className="action-button primary">+ Add Product</button>
                )}
              </div>
            </div>
            <div className="products-grid">
              {currentProducts.length === 0 ? (
                <div className="no-data-message">No products found</div>
              ) : (
                currentProducts.map((product) => (
                  <div key={usingRealApi ? (product as RealProduct).id : (product as MockProduct).id} 
                       className="product-card">
                    <div className="product-image">
                      <img 
                        src={usingRealApi ? 
                          getProductImageUrl((product as RealProduct).image_key) : 
                          'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&w=300&h=200&fit=crop'} 
                        alt={product.name} 
                      />
                    </div>
                    <div className="product-info">
                      <div className="product-header">
                        <h3>{product.name}</h3>
                        <span className="product-category">{product.category}</span>
                      </div>
                      <div className="product-price">
                        ${usingRealApi ? (product as RealProduct).price : (product as MockProduct).price}
                        {!usingRealApi && '/month'}
                      </div>
                      <p className="product-description">{product.description}</p>
                      {!usingRealApi && (product as MockProduct).features && (
                        <div className="product-features">
                          <h4>Features:</h4>
                          <ul>
                            {(product as MockProduct).features!.map((feature, idx) => (
                              <li key={idx}>{feature}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {usingRealApi && (
                        <div className="product-meta">
                          <span className={`status-badge ${(product as RealProduct).is_active ? 'active' : 'inactive'}`}>
                            {(product as RealProduct).is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="product-date">
                            {new Date((product as RealProduct).created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {user.role === 'admin' && (
                        <div className="admin-actions">
                          <button className="action-button">Edit</button>
                          <button className="action-button danger">Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="access-info">
              <p>
                <strong>Role-based Access:</strong> {user.role === 'admin' 
                  ? 'You see ALL products (Admin privilege)' 
                  : 'You see LIMITED products (Standard user)'}
              </p>
              {usingRealApi && (
                <p className="api-info">
                  <strong>API:</strong> Data fetched from Lambda function via API Gateway
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="gallery-section">
            <div className="section-header">
              <h2>Image Gallery</h2>
              <div className="section-actions">
                <span className="data-source-badge">
                  {usingRealApi ? 'Live from S3/Lambda' : 'Demo Images'}
                </span>
                {user.role === 'admin' && (
                  <button className="action-button primary">+ Upload Image</button>
                )}
              </div>
            </div>
            <div className="images-grid">
              {currentImages.length === 0 ? (
                <div className="no-data-message">No images found</div>
              ) : (
                currentImages.map((image) => (
                  <div key={image.id} className="image-card">
                    <div className="image-container">
                      <img src={image.url} alt={image.name} />
                    </div>
                    <div className="image-info">
                      <h4>{image.name}</h4>
                      <p className="image-category">{image.category}</p>
                      {image.description && (
                        <p className="image-description">{image.description}</p>
                      )}
                      {image.size && (
                        <p className="image-meta">Size: {image.size}</p>
                      )}
                      {usingRealApi && image.uploaded && (
                        <p className="image-date">Uploaded: {image.uploaded}</p>
                      )}
                      {user.role === 'admin' && (
                        <div className="image-actions">
                          <button className="action-button">Manage</button>
                          <button className="action-button">Download</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="access-info">
              <p>
                <strong>Role-based Access:</strong> {user.role === 'admin' 
                  ? 'You see ALL images (Admin privilege)' 
                  : 'You see LIMITED images (Standard user)'}
              </p>
              {usingRealApi && (
                <p className="api-info">
                  <strong>API:</strong> Images served via Lambda with S3 integration
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admin' && user.role === 'admin' && (
          <div className="admin-section">
            <div className="section-header">
              <h2>Administrator Controls</h2>
              <span className="data-source-badge">
                {usingRealApi ? 'Live AWS Console' : 'Demo Controls'}
              </span>
            </div>
            
            <div className="admin-grid">
              <div className="admin-card">
                <h3>👥 User Management</h3>
                <p>Manage users, roles, and permissions in AWS Cognito</p>
                <div className="admin-stats">
                  <span>Users: 2</span>
                  <span>Groups: 2</span>
                </div>
                <button className="admin-action-button">Manage Users</button>
              </div>
              
              <div className="admin-card">
                <h3>📊 System Analytics</h3>
                <p>View usage statistics and AWS CloudWatch metrics</p>
                <div className="admin-stats">
                  <span>API Calls: {currentProducts.length + currentImages.length}</span>
                  <span>Errors: {error ? 1 : 0}</span>
                </div>
                <button className="admin-action-button">View Analytics</button>
              </div>
              
              <div className="admin-card">
                <h3>⚙️ API Configuration</h3>
                <p>Configure API Gateway endpoints and Lambda functions</p>
                <div className="admin-stats">
                  <span>Endpoints: 2</span>
                  <span>Lambdas: 2</span>
                </div>
                <button className="admin-action-button">Configure API</button>
              </div>
              
              <div className="admin-card">
                <h3>💾 Storage Management</h3>
                <p>Manage S3 buckets and storage configurations</p>
                <div className="admin-stats">
                  <span>Buckets: 1</span>
                  <span>Files: {currentImages.length}</span>
                </div>
                <button className="admin-action-button">Manage Storage</button>
              </div>
            </div>
            
            <div className="aws-resources">
              <h3>🔧 AWS Resources Deployed</h3>
              <div className="resources-list">
                <div className="resource-item">
                  <span className="resource-status connected"></span>
                  <strong>Amazon Cognito:</strong> User authentication & authorization
                </div>
                <div className="resource-item">
                  <span className="resource-status connected"></span>
                  <strong>API Gateway:</strong> REST API endpoints with Cognito auth
                </div>
                <div className="resource-item">
                  <span className="resource-status connected"></span>
                  <strong>Lambda Functions:</strong> Serverless data processing
                </div>
                <div className="resource-item">
                  <span className="resource-status connected"></span>
                  <strong>S3 Bucket:</strong> Image storage and hosting
                </div>
                <div className="resource-item">
                  <span className="resource-status connected"></span>
                  <strong>CloudFormation:</strong> Infrastructure as Code
                </div>
                <div className="resource-item">
                  <span className="resource-status pending"></span>
                  <strong>RDS PostgreSQL:</strong> Database (optional - not deployed)
                </div>
              </div>
              
              {usingRealApi && (
                <div className="api-details">
                  <h4>API Endpoint Details:</h4>
                  <code className="endpoint-url">{apiEndpoint}</code>
                  <div className="endpoint-methods">
                    <span className="method get">GET /data</span>
                    <span className="method get">GET /images</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="configuration-guide">
              <h4>📝 Configuration Guide:</h4>
              <ol>
                <li>Update <code>aws-config.ts</code> with your Cognito IDs</li>
                <li>Create users in Cognito Console</li>
                <li>Add users to Admin/Standard groups</li>
                <li>Test with real authentication</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <footer className="dashboard-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>SaaS Platform Demo © 2024 - AWS Integration</p>
            <p className="tech-stack">
              Built with: <strong>AWS CDK</strong> • <strong>React</strong> • <strong>TypeScript</strong> • 
              <strong> Cognito</strong> • <strong>Lambda</strong> • <strong>API Gateway</strong> • <strong>S3</strong>
            </p>
          </div>
          <div className="footer-right">
            <div className="api-status">
              <span className={`status-indicator ${usingRealApi ? 'connected' : 'demo'}`}></span>
              {usingRealApi ? 'AWS API: Operational' : 'Mode: Demo'}
            </div>
            <p className="demo-note">
              <strong>Data Source:</strong> {usingRealApi ? 'Live AWS Services' : 'Mock Data'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;