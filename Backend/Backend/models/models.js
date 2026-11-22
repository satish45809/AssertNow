class SalesforceModel {
    constructor() {
        this.myDomain = null;
        this.clientId = null;
        this.clientSecret = null;
        this.accessToken = null;
        this.instanceUrl = null;
        this.tokenExpiresAt = null;
        this.isConnected = false;
    }

    // Save or update credentials in memory
    setCredentials({ myDomain, clientId, clientSecret }) {
        // Strip trailing slashes
        this.myDomain = myDomain.replace(/\/+$/, '');
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    // Store active token details
    setSession({ accessToken, instanceUrl, expiresIn = 3600 }) {
        this.accessToken = accessToken;
        this.instanceUrl = instanceUrl;
        // Set expiry with a 5-minute safety buffer
        this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 300) * 1000);
        this.isConnected = true;
    }

    // Check if current token exists and is not expired
    hasValidToken() {
        if (!this.accessToken || !this.tokenExpiresAt) return false;
        return new Date() < this.tokenExpiresAt;
    }

    // Clear memory on disconnect
    reset() {
        this.myDomain = null;
        this.clientId = null;
        this.clientSecret = null;
        this.accessToken = null;
        this.instanceUrl = null;
        this.tokenExpiresAt = null;
        this.isConnected = false;
    }

    // Export safe summary (no secrets)
    getConnectionDetails() {
        return {
            isConnected: this.isConnected,
            myDomain: this.myDomain,
            instanceUrl: this.instanceUrl,
            tokenExpiresAt: this.tokenExpiresAt
        };
    }
}

// Export as a singleton so all controllers share the same in-memory state
export default new SalesforceModel();