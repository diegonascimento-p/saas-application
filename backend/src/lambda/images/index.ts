import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

interface S3Object {
  Key?: string;
  Size?: number;
  LastModified?: Date;
}

interface Image {
  id: number;
  name: string;
  url: string;
  category: string;
  size?: string;
  uploaded?: string;
  description?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Images Lambda - SDK v3 from Lambda environment');
  
  try {
    const authContext = event.requestContext?.authorizer?.claims || {};
    const userGroups = authContext['cognito:groups'] || '';
    const userEmail = authContext.email || 'user@example.com';
    
    const isAdmin = userGroups.includes('Admin');
    
    const s3Client = new S3Client({ 
      region: process.env.REGION || 'us-east-2' 
    });
    const bucketName = process.env.BUCKET_NAME!;
    
    console.log('Bucket name:', bucketName);
    console.log('Region:', process.env.REGION);
    
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'products/'
      });
      
      const listResult = await s3Client.send(listCommand);
      
      console.log('List result:', JSON.stringify({
        keyCount: listResult.KeyCount,
        contentsCount: listResult.Contents?.length || 0
      }));
      
      const images = await Promise.all(
        (listResult.Contents || [])
          .filter((obj: any) => obj.Key && obj.Key !== 'products/')
          .map(async (obj: any, index: number) => {
            const getObjectCommand = new GetObjectCommand({
              Bucket: bucketName,
              Key: obj.Key!,
            });
            
            const signedUrl = await getSignedUrl(s3Client, getObjectCommand, {
              expiresIn: 3600
            });
            
            return {
              id: index + 1,
              name: obj.Key?.split('/').pop() || 'image.jpg',
              url: signedUrl,
              category: 'Products',
              size: obj.Size ? `${Math.round(obj.Size / 1024)} KB` : 'Unknown',
              uploaded: obj.LastModified?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              description: `Product image ${index + 1}`,
            };
          })
      );
      
      const filteredImages = isAdmin ? images : images.slice(0, 3);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          images: filteredImages,
          user: {
            email: userEmail,
            role: isAdmin ? 'admin' : 'standard',
            groups: userGroups,
          },
          metadata: {
            totalImages: filteredImages.length,
            isAdmin,
            accessLevel: isAdmin ? 'full' : 'limited',
            timestamp: new Date().toISOString(),
            source: 'aws-s3',
            bucket: bucketName
          },
          message: isAdmin 
            ? `Full gallery access - ${images.length} images from S3` 
            : `Standard access - 3 images from S3`,
          s3Bucket: bucketName,
        }),
      };
      
    } catch (s3Error: any) {
      console.error('S3 error:', s3Error);
      
      const fallbackImages = getFallbackImages(isAdmin);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          images: fallbackImages,
          metadata: {
            totalImages: fallbackImages.length,
            isAdmin,
            source: 'fallback',
            note: `S3 access failed: ${s3Error.message}`,
            bucket: bucketName
          },
          message: 'Using fallback data',
        }),
      };
    }
    
  } catch (error: any) {
    console.error('Handler error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'Failed to retrieve images',
        timestamp: new Date().toISOString(),
        bucket: process.env.BUCKET_NAME || 'not-set',
        region: process.env.REGION || 'not-set'
      }),
    };
  }
};

function getFallbackImages(isAdmin: boolean): Image[] {
  const fallback = [
    { 
      id: 1, 
      name: 'laptop.jpg', 
      url: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=300&h=200&fit=crop', 
      category: 'Electronics', 
      size: '45 KB',
      uploaded: '2024-01-15',
      description: 'Laptop Pro' 
    },
    { 
      id: 2, 
      name: 'headphones.jpg', 
      url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=200&fit=crop', 
      category: 'Audio', 
      size: '32 KB',
      uploaded: '2024-01-14',
      description: 'Wireless Headphones' 
    },
    { 
      id: 3, 
      name: 'smartwatch.jpg', 
      url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=200&fit=crop', 
      category: 'Wearables', 
      size: '28 KB',
      uploaded: '2024-01-13',
      description: 'Smart Watch' 
    },
    { 
      id: 4, 
      name: 'speaker.jpg', 
      url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300&h=200&fit=crop', 
      category: 'Audio', 
      size: '38 KB',
      uploaded: '2024-01-12',
      description: 'Bluetooth Speaker' 
    },
    { 
      id: 5, 
      name: 'camera.jpg', 
      url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&h=200&fit=crop', 
      category: 'Electronics', 
      size: '42 KB',
      uploaded: '2024-01-11',
      description: 'Digital Camera' 
    },
  ];
  
  return isAdmin ? fallback : fallback.slice(0, 3);
}