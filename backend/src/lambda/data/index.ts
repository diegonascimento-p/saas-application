import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client } from 'pg';
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: any;
}

async function getDatabaseConfig(): Promise<DatabaseConfig> {
  const secretArn = process.env.DB_SECRET_ARN!;
  
  try {
    const secret = await secretsManager
      .getSecretValue({ SecretId: secretArn })
      .promise();
    
    const secretString = JSON.parse(secret.SecretString!);
    
    return {
      host: process.env.DB_ENDPOINT || secretString.host,
      port: parseInt(process.env.DB_PORT || secretString.port || '5432'),
      database: process.env.DB_NAME || secretString.dbname || 'saasdb',
      user: secretString.username || 'saasadmin',
      password: secretString.password || '',
      ssl: { rejectUnauthorized: false },
    };
  } catch (error) {
    console.error('Error fetching database secret:', error);
    
    return {
      host: process.env.DB_ENDPOINT || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'saasdb',
      user: process.env.DB_USER || 'saasadmin',
      password: process.env.DB_PASSWORD || '',
      ssl: { rejectUnauthorized: false },
    };
  }
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Data Lambda invoked');
  
  let client: Client | null = null;
  
  try {
    const authContext = event.requestContext?.authorizer?.claims || {};
    const userGroups = authContext['cognito:groups'] || '';
    const userEmail = authContext.email || 'user@example.com';
    const userId = authContext.sub || 'anonymous';
    
    const isAdmin = userGroups.includes('Admin');
    
    console.log(`User: ${userEmail}, Groups: ${userGroups}, Admin: ${isAdmin}`);
    
    try {
      const dbConfig = await getDatabaseConfig();
      console.log('DB Config:', { ...dbConfig, password: '***' });
      
      client = new Client(dbConfig);
      await client.connect();
      console.log('Successfully connected to PostgreSQL database');
      
      if (isAdmin) {
        const productsQuery = `
          SELECT 
            id, 
            name, 
            description, 
            category, 
            price, 
            image_key,
            is_active,
            created_at
          FROM products 
          WHERE is_active = true 
          ORDER BY created_at DESC
          LIMIT 10
        `;
        
        const productsResult = await client.query(productsQuery);
        
        const responseData = {
          user: {
            id: userId,
            email: userEmail,
            role: 'admin',
            groups: userGroups,
          },
          products: productsResult.rows,
          metadata: {
            totalProducts: productsResult.rows.length,
            isAdmin: true,
            accessLevel: 'full',
            timestamp: new Date().toISOString(),
          },
          message: 'Admin access - Full database access',
        };
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(responseData),
        };
        
      } else {
        const productsQuery = `
          SELECT 
            id, 
            name, 
            description, 
            category, 
            price, 
            image_key,
            created_at
          FROM products 
          WHERE is_active = true 
          AND category IN ('Electronics', 'Audio', 'Home')
          ORDER BY created_at DESC 
          LIMIT 3
        `;
        
        const productsResult = await client.query(productsQuery);
        
        const responseData = {
          user: {
            id: userId,
            email: userEmail,
            role: 'standard',
            groups: userGroups,
          },
          products: productsResult.rows,
          metadata: {
            totalProducts: productsResult.rows.length,
            isAdmin: false,
            accessLevel: 'limited',
            timestamp: new Date().toISOString(),
          },
          message: 'Standard access - Limited data access',
        };
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(responseData),
        };
      }
      
    } catch (dbError: any) {
      console.error('Database connection error:', dbError.message);
      
      const fallbackProducts = isAdmin 
        ? [
            { id: '1', name: 'Laptop Pro', description: 'High-performance laptop', category: 'Electronics', price: '1299.99', image_key: 'products/laptop.jpg', is_active: true, created_at: new Date().toISOString() },
            { id: '2', name: 'Wireless Headphones', description: 'Noise-cancelling headphones', category: 'Audio', price: '249.99', image_key: 'products/headphones.jpg', is_active: true, created_at: new Date().toISOString() },
            { id: '3', name: 'Smart Watch', description: 'Fitness and health tracker', category: 'Electronics', price: '299.99', image_key: 'products/smartwatch.jpg', is_active: true, created_at: new Date().toISOString() },
          ]
        : [
            { id: '2', name: 'Wireless Headphones', description: 'Noise-cancelling headphones', category: 'Audio', price: '249.99', image_key: 'products/headphones.jpg', created_at: new Date().toISOString() },
          ];
      
      const responseData = {
        user: {
          id: userId,
          email: userEmail,
          role: isAdmin ? 'admin' : 'standard',
          groups: userGroups,
        },
        products: fallbackProducts,
        metadata: {
          totalProducts: fallbackProducts.length,
          isAdmin,
          accessLevel: isAdmin ? 'full' : 'limited',
          timestamp: new Date().toISOString(),
          note: 'Using fallback data (database unavailable)',
        },
        message: isAdmin 
          ? 'Admin access - Fallback data' 
          : 'Standard access - Fallback data',
      };
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(responseData),
      };
    }
    
  } catch (error: any) {
    console.error('Unexpected error in handler:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      }),
    };
  } finally {
    if (client) {
      try {
        await client.end();
        console.log('Database connection closed');
      } catch (e: any) {
        console.error('Error closing database connection:', e.message);
      }
    }
  }
};