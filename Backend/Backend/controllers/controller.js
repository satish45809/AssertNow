import axios from 'axios';
import salesforceModel from '../models/models.js';

// Helper to request a token from Salesforce OAuth
async function requestToken(myDomain, clientId, clientSecret) {
    const tokenUrl = `${myDomain}/services/oauth2/token`;
    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
    });

    const response = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
}

let refreshPromise = null; // Outside the function

async function getActiveToken() {
  if (salesforceModel.hasValidToken()) {
    return salesforceModel.accessToken;
  }

  // it checks whether any call is already happens before if already there means it will Wait
  if (!refreshPromise) {
    refreshPromise = requestToken(
      salesforceModel.myDomain,
      salesforceModel.clientId,
      salesforceModel.clientSecret
    )
      .then((tokenData) => {
        salesforceModel.setSession({
          accessToken: tokenData.access_token,
          instanceUrl: tokenData.instance_url
        });
        return tokenData.access_token;
      })
      .finally(() => {
        refreshPromise = null; // after completion it release the lock
      });
  }

  return refreshPromise;
}

// POST /api/salesforce/connect
export const connect = async (req, res) => {
    const { myDomain, clientId, clientSecret } = req.body;

    if (!myDomain || !clientId || !clientSecret) {
        return res.status(400).json({
            success: false,
            message: 'myDomain, clientId, and clientSecret are all required.'
        });
    }

    try {
        const cleanDomain = myDomain.replace(/\/+$/, '');

        // 1. Attempt token retrieval from Salesforce
        const tokenData = await requestToken(cleanDomain, clientId, clientSecret);

        // 2. Save credentials & token into in-memory Model
        salesforceModel.setCredentials({ myDomain: cleanDomain, clientId, clientSecret });
        salesforceModel.setSession({
            accessToken: tokenData.access_token,
            instanceUrl: tokenData.instance_url
        });

        // console.log('--- SAVED IN RAM ---');
        // console.log(salesforceModel);

        return res.status(200).json({
            success: true,
            message: 'Connection established successfully!',
            data: salesforceModel.getConnectionDetails()
        });
    } catch (error) {
        salesforceModel.reset();
        return res.status(500).json({
            success: false,
            message: 'Failed to establish connection with Salesforce.',
            error: error.response?.data || error.message
        });
    }
};

// GET /api/salesforce/status
export const getStatus = (req, res) => {
    return res.status(200).json({
        success: true,
        data: salesforceModel.getConnectionDetails()
    });
};

// GET /api/salesforce/test-query
// Verifies the connection by querying 3 accounts
export const testQuery = async (req, res) => {
    if (!salesforceModel.isConnected) {
        return res.status(400).json({
            success: false,
            message: 'No active Salesforce connection. Please connect first.'
        });
    }

    try {
        // Refresh token if expired
        if (!salesforceModel.hasValidToken()) {
            const tokenData = await requestToken(
                salesforceModel.myDomain,
                salesforceModel.clientId,
                salesforceModel.clientSecret
            );
            salesforceModel.setSession({
                accessToken: tokenData.access_token,
                instanceUrl: tokenData.instance_url
            });
        }

        // Query for Accounts limit 3
        const queryUrl = `${salesforceModel.instanceUrl}/services/data/v60.0/query?q=SELECT+Id,Name,Type+FROM+Account+LIMIT+3`;
        
        const queryRes = await axios.get(queryUrl, {
            headers: {
                Authorization: `Bearer ${salesforceModel.accessToken}`
            }
        });

        return res.status(200).json({
            success: true,
            records: queryRes.data.records
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to execute query.',
            error: error.response?.data || error.message
        });
    }
};

// POST /api/salesforce/disconnect
export const disconnect = (req, res) => {
    salesforceModel.reset();
    return res.status(200).json({
        success: true,
        message: 'Disconnected successfully.'
    });
};