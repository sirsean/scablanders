import { SiweMessage, generateNonce } from 'siwe';

// Re-export generateNonce for use in worker
export { generateNonce };

/**
 * Authentication utilities for Sign-In-With-Ethereum (SIWE)
 */

export interface AuthSession {
  address: string;
  chainId: number;
  issuedAt: Date;
  expiresAt: Date;
}

export interface NonceStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface SessionStore {
  get(key: string): Promise<AuthSession | null>;
  put(key: string, value: AuthSession, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Create a SIWE message for the client to sign
 */
export function createSiweMessage(address: string, nonce: string): string {
  const domain = 'scablanders.game'; // TODO: Make configurable
  const uri = 'https://scablanders.game'; // TODO: Make configurable
  const version = '1';
  const chainId = 1; // Ethereum mainnet
  
  const message = new SiweMessage({
    domain,
    address,
    statement: 'Welcome to Scablanders! Sign in to access the harsh world of the Scablands.',
    uri,
    version,
    chainId,
    nonce,
    issuedAt: new Date().toISOString(),
  });

  return message.prepareMessage();
}

/**
 * Verify a SIWE signature and extract the address
 */
export async function verifySiweSignature(
  message: string, 
  signature: string,
  nonceStore: NonceStore
): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    // Parse the SIWE message from the prepared string
    const siweMessage = new SiweMessage(message);
    const address = siweMessage.address;
    
    // Verify the nonce exists and hasn't been used
    const storedNonce = await nonceStore.get(`nonce:${siweMessage.nonce}`);
    if (!storedNonce) {
      return { success: false, error: 'Invalid or expired nonce' };
    }
    
    // Verify the signature
    const verification = await siweMessage.verify({ signature });
    
    if (!verification.success) {
      return { success: false, error: 'Invalid signature' };
    }
    
    // Check if message is expired (5 minutes max) - based on message issuedAt
    if (siweMessage.issuedAt) {
      const issuedAt = new Date(siweMessage.issuedAt);
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      if (issuedAt < fiveMinutesAgo) {
        return { success: false, error: 'Message expired' };
      }
    }
    
    // Remove the used nonce
    await nonceStore.delete(`nonce:${siweMessage.nonce}`);
    
    return { 
      success: true, 
      address: address.toLowerCase() 
    };
    
  } catch (error) {
    console.error('SIWE verification error:', error);
    return { 
      success: false, 
      error: 'Verification failed' 
    };
  }
}

/**
 * Create a JWT-like session token (simplified, not using actual JWT for now)
 */
export function createSessionToken(address: string): string {
  const session = {
    address: address.toLowerCase(),
    issuedAt: Date.now(),
    random: Math.random().toString(36).substring(7)
  };
  
  // Simple token - in production, this should be properly signed
  return btoa(JSON.stringify(session));
}

/**
 * Parse and validate a session token
 */
export function parseSessionToken(token: string): { address: string } | null {
  try {
    const session = JSON.parse(atob(token));
    
    // Check if token is expired (24 hours max)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (session.issuedAt < dayAgo) {
      return null;
    }
    
    if (!session.address || typeof session.address !== 'string') {
      return null;
    }
    
    return { address: session.address };
  } catch {
    return null;
  }
}

/**
 * Create auth middleware for protected routes
 */
export function createAuthMiddleware(sessionStore: SessionStore) {
  return async (request: Request): Promise<{ address?: string; error?: string }> => {
    // Check for session token in cookie or Authorization header
    const cookieHeader = request.headers.get('Cookie');
    const authHeader = request.headers.get('Authorization');
    
    let token: string | null = null;
    
    // Extract from cookie
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const authCookie = cookies.find(c => c.startsWith('CF_ACCESS_TOKEN='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }
    
    // Extract from Authorization header
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (!token) {
      return { error: 'No authentication token provided' };
    }
    
    // Parse token
    const session = parseSessionToken(token);
    if (!session) {
      return { error: 'Invalid or expired token' };
    }
    
    return { address: session.address };
  };
}
