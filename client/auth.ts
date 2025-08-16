/**
 * Client-side SIWE Authentication using viem/wagmi
 */

import { SiweMessage } from 'siwe';
import { createConfig, http, getAccount, signMessage, connect, disconnect } from '@wagmi/core';
import { injected } from '@wagmi/connectors';
import { mainnet } from 'viem/chains';
import { getAddress } from 'viem';

export interface AuthState {
  isAuthenticated: boolean;
  address?: string;
  isConnecting: boolean;
  error?: string;
}

// Create wagmi config
const config = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
  },
});

export class ScablandersAuth {
  private state: AuthState = {
    isAuthenticated: false,
    isConnecting: false
  };

  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    // Check if already authenticated on startup
    this.checkAuthStatus();
  }

  /**
   * Subscribe to authentication state changes
   */
  onStateChange(callback: (state: AuthState) => void) {
    this.listeners.push(callback);
    // Immediately call with current state
    callback(this.state);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<AuthState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(callback => callback(this.state));
  }

  /**
   * Check if user is already authenticated (has valid session)
   */
  private async checkAuthStatus() {
    try {
      const response = await fetch('/api/profile', {
        credentials: 'include'
      });
      if (response.ok) {
        const profile = await response.json();
        if (profile.address && profile.address !== '0x0000000000000000000000000000000000000000') {
          this.updateState({
            isAuthenticated: true,
            address: profile.address
          });
        }
      }
    } catch (error) {
      console.log('No existing session found');
    }
  }

  /**
   * Connect wallet and authenticate with SIWE
   */
  async connect(): Promise<void> {
    if (!window.ethereum) {
      this.updateState({
        error: 'Please install MetaMask or another Web3 wallet'
      });
      return;
    }

    this.updateState({
      isConnecting: true,
      error: undefined
    });

    try {
      // Connect wallet using wagmi
      await connect(config, { connector: injected() });
      
      // Get account details from wagmi (already checksummed)
      const account = getAccount(config);
      
      if (!account.address) {
        throw new Error('No account connected');
      }

      const address = account.address;
      console.log('address', address);

      // Get nonce from server
      const nonceResponse = await fetch('/api/auth/nonce', {
        credentials: 'include'
      });
      if (!nonceResponse.ok) {
        throw new Error('Failed to get authentication nonce');
      }

      const { nonce } = await nonceResponse.json();
      console.log('nonce', nonce);

      // Create SIWE message using the proper library
      const siweMessage = new SiweMessage({
          domain: window.location.host,
          address,
          statement: 'Welcome to Scablanders! Sign in to access the harsh world of the Scablands.',
          uri: window.location.origin,
          version: '1',
          chainId: 1, // Ethereum mainnet
          nonce,
      });

      const message = siweMessage.prepareMessage();
      console.log('message', message);

      // Sign message using wagmi
      const signature = await signMessage(config, { message });

      // Verify signature with server
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          signature
        })
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Authentication failed');
      }

      this.updateState({
        isAuthenticated: true,
        address: verifyResult.address,
        isConnecting: false
      });

    } catch (error: any) {
      console.error('Authentication error:', error);
      this.updateState({
        isConnecting: false,
        error: error.message || 'Authentication failed'
      });
    }
  }

  /**
   * Disconnect and clear authentication
   */
  async disconnect(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    this.updateState({
      isAuthenticated: false,
      address: undefined,
      error: undefined
    });
  }

  /**
   * Get current authentication state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  /**
   * Get authenticated user address
   */
  getAddress(): string | undefined {
    return this.state.address;
  }
}

// Global auth instance
export const auth = new ScablandersAuth();

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: Function) => void;
      removeListener: (event: string, callback: Function) => void;
    };
  }
}
