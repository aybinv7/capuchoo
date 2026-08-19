export interface UserProfile {
    apps: Array<{
        app_id: string;
        icon_url?: string;
        id: string;
        name: string;
        organization_id: string;
        role: string;
    }>;
    organizations: Array<{
        id: string;
        name: string;
        role: string;
        slug: string;
    }>;
    user: {
        email: string;
        id: string;
    };
}
export declare class AuthService {
    private configManager;
    constructor(root?: string);
    /**
     * Fetch user profile with organizations and apps from /api/auth/me
     */
    fetchUserProfile(endpoint: string, apiKey: string): Promise<UserProfile | null>;
    /**
     * Get accessible apps from stored config
     */
    getAccessibleApps(): Promise<UserProfile['apps']>;
    /**
     * Get organizations from stored config
     */
    getOrganizations(): Promise<UserProfile['organizations']>;
    /**
     * Get stored API key
     */
    getApiKey(): Promise<string | null>;
    /**
     * Get stored endpoint
     */
    getEndpoint(): Promise<string | null>;
    /**
     * Verify stored credentials are valid
     */
    verifyCredentials(): Promise<{
        valid: boolean;
        user?: UserProfile['user'];
    }>;
}
