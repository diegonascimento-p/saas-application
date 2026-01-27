// backend/src/lambda/data/index.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client } from 'pg';
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();

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
    
    // Fallback para variáveis de ambiente diretas
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
    // 1. Extrair informações do usuário do token Cognito
    const authContext = event.requestContext?.authorizer?.claims || {};
    const userGroups = authContext['cognito:groups'] || '';
    const userEmail = authContext.email || 'user@example.com';
    const userId = authContext.sub || 'anonymous';
    
    const isAdmin = userGroups.includes('Admin');
    
    console.log(`User: ${userEmail}, Groups: ${userGroups}, Admin: ${isAdmin}`);
    
    // 2. Tentar conectar ao banco de dados
    try {
      const dbConfig = await getDatabaseConfig();
      console.log('DB Config:', { ...dbConfig, password: '***' });
      
      client = new Client(dbConfig);
      await client.connect();
      console.log('Successfully connected to PostgreSQL database');
      
      // 3. Query baseada no role do usuário
      if (isAdmin) {
        // ADMIN: Pega todos os usuários e produtos
        const usersQuery = `
          SELECT 
            id,
            email,
            user_role as role,
            profile_data,
            created_at,
            updated_at
          FROM users 
          ORDER BY created_at DESC
        `;
        
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
        
        const [usersResult, productsResult] = await Promise.all([
          client.query(usersQuery),
          client.query(productsQuery)
        ]);
        
        const responseData = {
          user: {
            id: userId,
            email: userEmail,
            role: 'admin',
            groups: userGroups,
          },
          users: usersResult.rows,
          products: productsResult.rows,
          metadata: {
            totalUsers: usersResult.rows.length,
            totalProducts: productsResult.rows.length,
            isAdmin: true,
            accessLevel: 'full',
            timestamp: new Date().toISOString(),
          },
          message: 'Admin access - Full database access',
        };
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
          },
          body: JSON.stringify(responseData),
        };
        
      } else {
        // STANDARD USER: Pega apenas seu perfil + produtos limitados
        const userQuery = `
          SELECT 
            id,
            email,
            user_role as role,
            profile_data,
            created_at,
            updated_at
          FROM users 
          WHERE email = $1
          LIMIT 1
        `;
        
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
        
        const [userResult, productsResult] = await Promise.all([
          client.query(userQuery, [userEmail]),
          client.query(productsQuery)
        ]);
        
        const userData = userResult.rows[0] || {
          id: userId,
          email: userEmail,
          role: 'standard',
          profile_data: { name: 'Standard User', department: 'General' },
          created_at: new Date().toISOString(),
        };
        
        const responseData = {
          user: {
            id: userId,
            email: userEmail,
            role: 'standard',
            groups: userGroups,
          },
          userProfile: userData,
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
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
          },
          body: JSON.stringify(responseData),
        };
      }
      
    } catch (dbError: any) {
      console.error('Database connection error:', dbError.message);
      console.error('DB Error stack:', dbError.stack);
      
      // Continuar para o fallback de dados mock
    }
    
    // 4. FALLBACK: Dados mock se o banco falhar
    console.log('Using fallback mock data');
    
    if (isAdmin) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          user: {
            id: userId,
            email: userEmail,
            role: 'admin',
            groups: userGroups,
          },
          users: [
            {
              id: '1',
              email: 'admin@saas-application.com',
              role: 'admin',
              profile_data: { name: 'Admin User', department: 'Management' },
              created_at: new Date().toISOString(),
            },
            {
              id: '2',
              email: 'user@saas-application.com',
              role: 'standard',
              profile_data: { name: 'Standard User', department: 'Sales' },
              created_at: new Date().toISOString(),
            }
          ],
          products: [
            {
              id: 1,
              name: 'Laptop Pro',
              description: 'High-performance laptop',
              category: 'Electronics',
              price: 1299.99,
              image_key: 'products/laptop-pro.jpg',
            },
            {
              id: 2,
              name: 'Wireless Headphones',
              description: 'Noise-cancelling headphones',
              category: 'Audio',
              price: 249.99,
              image_key: 'products/headphones.jpg',
            },
            {
              id: 3,
              name: 'Smart Watch',
              description: 'Fitness and health tracker',
              category: 'Electronics',
              price: 299.99,
              image_key: 'products/smart-watch.jpg',
            }
          ],
          metadata: {
            totalUsers: 2,
            totalProducts: 3,
            isAdmin: true,
            accessLevel: 'full',
            timestamp: new Date().toISOString(),
            note: 'Using fallback mock data',
          },
          message: 'Admin access - Fallback data (database unavailable)',
        }),
      };
    } else {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          user: {
            id: userId,
            email: userEmail,
            role: 'standard',
            groups: userGroups,
          },
          userProfile: {
            id: userId,
            email: userEmail,
            role: 'standard',
            profile_data: { name: 'Standard User', department: 'General' },
            created_at: new Date().toISOString(),
          },
          products: [
            {
              id: 2,
              name: 'Wireless Headphones',
              description: 'Noise-cancelling headphones',
              category: 'Audio',
              price: 249.99,
              image_key: 'products/headphones.jpg',
            }
          ],
          metadata: {
            totalProducts: 1,
            isAdmin: false,
            accessLevel: 'limited',
            timestamp: new Date().toISOString(),
            note: 'Using fallback mock data',
          },
          message: 'Standard access - Fallback data (database unavailable)',
        }),
      };
    }
    
  } catch (error: any) {
    console.error('Unexpected error in handler:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
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