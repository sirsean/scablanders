import { DurableObject } from 'cloudflare:workers';
import type { 
  PlayerProfile,
  UpgradeType,
  NotificationMessage
} from '@shared/models';

/**
 * PlayerDO - Per-Player State Durable Object
 * 
 * One instance per player (identified by their wallet address).
 * Manages:
 * - Player balance (credits) with isolation
 * - Purchased upgrades 
 * - Discovered resource nodes
 * - Notification queue
 */
export class PlayerDO extends DurableObject {
  private profile: PlayerProfile | null = null;
  private notifications: NotificationMessage[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Load persisted data on construction
    this.loadProfile();
  }

  /**
   * Load player profile from storage
   */
  private async loadProfile() {
    const stored = await this.ctx.storage.get<PlayerProfile>('profile');
    if (stored) {
      // Ensure all required fields are present (for backward compatibility)
      this.profile = {
        ...stored,
        activeMissions: stored.activeMissions || []
      };
    }
    
    const storedNotifications = await this.ctx.storage.get<NotificationMessage[]>('notifications');
    if (storedNotifications) {
      this.notifications = storedNotifications;
    }
  }

  /**
   * Initialize a new player profile
   */
  private async initializeProfile(address: string): Promise<PlayerProfile> {
    this.profile = {
      address,
      balance: 1000, // Starting balance
      ownedDrifters: [], // Will be populated from NFT lookup
      discoveredNodes: [], // Empty initially - player must discover nodes
      upgrades: [], // No upgrades initially
      activeMissions: [], // No active missions initially
      lastLogin: new Date()
    };
    
    await this.ctx.storage.put('profile', this.profile);
    return this.profile;
  }

  /**
   * Get player profile, creating one if it doesn't exist
   */
  async getProfile(address: string): Promise<PlayerProfile> {
    if (!this.profile || this.profile.address !== address) {
      await this.initializeProfile(address);
    }
    
    // Update last login
    this.profile!.lastLogin = new Date();
    await this.ctx.storage.put('profile', this.profile);
    
    return this.profile!;
  }

  /**
   * Credit amount to player balance
   * This is the only way to add money to prevent race conditions
   */
  async credit(amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
    if (!this.profile) {
      return { success: false, newBalance: 0, error: 'Profile not initialized' };
    }
    
    if (amount <= 0) {
      return { success: false, newBalance: this.profile.balance, error: 'Amount must be positive' };
    }
    
    this.profile.balance += amount;
    await this.ctx.storage.put('profile', this.profile);
    
    return { 
      success: true, 
      newBalance: this.profile.balance 
    };
  }

  /**
   * Debit amount from player balance
   * Returns false if insufficient funds
   */
  async debit(amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
    if (!this.profile) {
      return { success: false, newBalance: 0, error: 'Profile not initialized' };
    }
    
    if (amount <= 0) {
      return { success: false, newBalance: this.profile.balance, error: 'Amount must be positive' };
    }
    
    if (this.profile.balance < amount) {
      return { 
        success: false, 
        newBalance: this.profile.balance, 
        error: 'Insufficient funds' 
      };
    }
    
    this.profile.balance -= amount;
    await this.ctx.storage.put('profile', this.profile);
    
    return { 
      success: true, 
      newBalance: this.profile.balance 
    };
  }

  /**
   * Add an upgrade to player's collection
   */
  async addUpgrade(upgradeType: UpgradeType): Promise<{ success: boolean; error?: string }> {
    if (!this.profile) {
      return { success: false, error: 'Profile not initialized' };
    }
    
    if (this.profile.upgrades.includes(upgradeType)) {
      return { success: false, error: 'Upgrade already owned' };
    }
    
    this.profile.upgrades.push(upgradeType);
    await this.ctx.storage.put('profile', this.profile);
    
    return { success: true };
  }

  /**
   * Add a discovered resource node
   */
  async addDiscovery(nodeId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.profile) {
      return { success: false, error: 'Profile not initialized' };
    }
    
    if (this.profile.discoveredNodes.includes(nodeId)) {
      return { success: false, error: 'Node already discovered' };
    }
    
    this.profile.discoveredNodes.push(nodeId);
    await this.ctx.storage.put('profile', this.profile);
    
    return { success: true };
  }

  /**
   * Update owned Drifters list (called when NFT ownership changes)
   */
  async updateOwnedDrifters(drifterIds: number[]): Promise<{ success: boolean; error?: string }> {
    if (!this.profile) {
      return { success: false, error: 'Profile not initialized' };
    }
    
    this.profile.ownedDrifters = drifterIds;
    await this.ctx.storage.put('profile', this.profile);
    
    return { success: true };
  }

  /**
   * Add a notification to the player's queue
   */
  async addNotification(message: NotificationMessage): Promise<{ success: boolean; error?: string }> {
    // Add timestamp if not provided
    if (!message.timestamp) {
      message.timestamp = new Date();
    }
    
    this.notifications.push(message);
    
    // Keep only the latest 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(-50);
    }
    
    await this.ctx.storage.put('notifications', this.notifications);
    
    return { success: true };
  }

  /**
   * Get pending notifications for player
   */
  async getNotifications(limit: number = 20): Promise<NotificationMessage[]> {
    // Return newest notifications first
    return this.notifications.slice(-limit).reverse();
  }

  /**
   * Mark notifications as read (remove them from queue)
   */
  async markNotificationsRead(notificationIds?: string[]): Promise<{ success: boolean; error?: string }> {
    if (notificationIds && notificationIds.length > 0) {
      // Remove specific notifications
      this.notifications = this.notifications.filter(n => !notificationIds.includes(n.id));
    } else {
      // Mark all as read (clear queue)
      this.notifications = [];
    }
    
    await this.ctx.storage.put('notifications', this.notifications);
    
    return { success: true };
  }

  /**
   * Get player's upgrade effects for calculations
   */
  async getUpgradeEffects(): Promise<{
    speedMultiplier: number;
    yieldMultiplier: number;
    capacityMultiplier: number;
    combatBonus: number;
    scavengingBonus: number;
    techBonus: number;
  }> {
    if (!this.profile) {
      return {
        speedMultiplier: 1.0,
        yieldMultiplier: 1.0,
        capacityMultiplier: 1.0,
        combatBonus: 0,
        scavengingBonus: 0,
        techBonus: 0
      };
    }
    
    let speedMultiplier = 1.0;
    let yieldMultiplier = 1.0;
    let capacityMultiplier = 1.0;
    let combatBonus = 0;
    let scavengingBonus = 0;
    let techBonus = 0;
    
    // Calculate effects based on owned upgrades
    for (const upgrade of this.profile.upgrades) {
      switch (upgrade) {
        case 'speed-boost-1':
          speedMultiplier *= 1.2;
          break;
        case 'speed-boost-2':
          speedMultiplier *= 1.3;
          break;
        case 'speed-boost-3':
          speedMultiplier *= 1.5;
          break;
        case 'yield-boost-1':
          yieldMultiplier *= 1.15;
          break;
        case 'yield-boost-2':
          yieldMultiplier *= 1.25;
          break;
        case 'yield-boost-3':
          yieldMultiplier *= 1.4;
          break;
        case 'capacity-boost-1':
          capacityMultiplier *= 1.25;
          break;
        case 'capacity-boost-2':
          capacityMultiplier *= 1.5;
          break;
        case 'capacity-boost-3':
          capacityMultiplier *= 2.0;
          break;
        case 'combat-training-1':
          combatBonus += 2;
          break;
        case 'combat-training-2':
          combatBonus += 3;
          break;
        case 'combat-training-3':
          combatBonus += 5;
          break;
        case 'scavenging-expertise-1':
          scavengingBonus += 1;
          break;
        case 'scavenging-expertise-2':
          scavengingBonus += 2;
          break;
        case 'scavenging-expertise-3':
          scavengingBonus += 3;
          break;
        case 'tech-upgrade-1':
          techBonus += 1;
          break;
        case 'tech-upgrade-2':
          techBonus += 2;
          break;
        case 'tech-upgrade-3':
          techBonus += 3;
          break;
      }
    }
    
    return {
      speedMultiplier,
      yieldMultiplier,
      capacityMultiplier,
      combatBonus,
      scavengingBonus,
      techBonus
    };
  }

  /**
   * Reset player data (for development/testing)
   */
  async reset(): Promise<{ success: boolean; error?: string }> {
    this.profile = null;
    this.notifications = [];
    
    await this.ctx.storage.deleteAll();
    
    return { success: true };
  }

  /**
   * Add an active mission to the player's list
   */
  async addActiveMission(missionId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.profile) {
      return { success: false, error: 'Profile not initialized' };
    }
    
    if (this.profile.activeMissions.includes(missionId)) {
      return { success: false, error: 'Mission already active' };
    }
    
    this.profile.activeMissions.push(missionId);
    await this.ctx.storage.put('profile', this.profile);
    
    return { success: true };
  }

  /**
   * Remove an active mission from the player's list
   */
  async removeActiveMission(missionId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.profile) {
      return { success: false, error: 'Profile not initialized' };
    }
    
    const index = this.profile.activeMissions.indexOf(missionId);
    if (index === -1) {
      return { success: false, error: 'Mission not found in active list' };
    }
    
    this.profile.activeMissions.splice(index, 1);
    await this.ctx.storage.put('profile', this.profile);
    
    return { success: true };
  }

  /**
   * Add resources to player balance (from mission rewards)
   */
  async addResources(resources: { [resourceType: string]: number }): Promise<{ success: boolean; error?: string }> {
    if (!this.profile) {
      return { success: false, error: 'Profile not initialized' };
    }
    
    // Convert resources to credits (simplified for now)
    // TODO: Implement proper resource inventory system
    let totalCredits = 0;
    for (const [resourceType, amount] of Object.entries(resources)) {
      switch (resourceType) {
        case 'ore':
          totalCredits += amount * 10; // Ore worth 10 credits each
          break;
        case 'scrap':
          totalCredits += amount * 5; // Scrap worth 5 credits each
          break;
        case 'organic':
          totalCredits += amount * 3; // Organic worth 3 credits each
          break;
        default:
          totalCredits += amount; // Unknown resources worth 1 credit each
      }
    }
    
    this.profile.balance += totalCredits;
    await this.ctx.storage.put('profile', this.profile);
    
    return { success: true };
  }

  /**
   * Get storage statistics for debugging
   */
  async getStats(): Promise<{
    profileExists: boolean;
    balance: number;
    upgradeCount: number;
    discoveryCount: number;
    activeMissionCount: number;
    notificationCount: number;
  }> {
    return {
      profileExists: !!this.profile,
      balance: this.profile?.balance || 0,
      upgradeCount: this.profile?.upgrades.length || 0,
      discoveryCount: this.profile?.discoveredNodes.length || 0,
      activeMissionCount: this.profile?.activeMissions.length || 0,
      notificationCount: this.notifications.length
    };
  }
}
