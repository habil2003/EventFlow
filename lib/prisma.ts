import { PrismaClient } from '@prisma/client';

// ✅ Extended PrismaClient with custom methods
class ExtendedPrismaClient extends PrismaClient {
  constructor() {
    super({
      // ✅ Connection pooling configuration
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
      
      // ✅ Connection timeout and pooling settings
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      
      // ✅ Connection pool settings
      // These are passed to the underlying database driver
      // PostgreSQL specific settings
    });
  }

  // ✅ Health check method
  async healthCheck(): Promise<{ isHealthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return { isHealthy: true, latency };
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return { isHealthy: false, latency: Date.now() - start };
    }
  }

  // ✅ Graceful shutdown
  async disconnect(): Promise<void> {
    try {
      await this.$disconnect();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error);
    }
  }
}

// ✅ Global instance for hot reloading (Next.js development)
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

// ✅ Create or reuse Prisma instance
export const prisma = globalForPrisma.prisma ?? new ExtendedPrismaClient();

// ✅ In development, store the instance globally to prevent multiple connections
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ✅ Handle connection errors with retry logic
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function ensureConnection(): Promise<boolean> {
  try {
    // Test the connection
    await prisma.$queryRaw`SELECT 1`;
    connectionAttempts = 0;
    return true;
  } catch (error) {
    console.error(`❌ Database connection failed (attempt ${connectionAttempts + 1}/${MAX_RETRIES}):`, error);
    
    if (connectionAttempts < MAX_RETRIES) {
      connectionAttempts++;
      console.log(`⏳ Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return ensureConnection();
    }
    
    console.error('❌ Max retries reached. Database connection failed.');
    return false;
  }
}

// ✅ Export connection helper
export async function connectDB(): Promise<PrismaClient> {
  const isConnected = await ensureConnection();
  if (!isConnected) {
    throw new Error('Unable to connect to database after multiple attempts');
  }
  return prisma;
}

// ✅ Export disconnect helper for cleanup
export async function disconnectDB(): Promise<void> {
  await prisma.disconnect();
}

// ✅ Export health check
export async function checkDBHealth(): Promise<{ isHealthy: boolean; latency: number }> {
  return prisma.healthCheck();
}

// ✅ Handle process termination gracefully
if (process.env.NODE_ENV !== 'development') {
  process.on('beforeExit', async () => {
    await disconnectDB();
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT. Closing database connections...');
    await disconnectDB();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM. Closing database connections...');
    await disconnectDB();
    process.exit(0);
  });
}

// ✅ Export default for convenience
export default prisma;