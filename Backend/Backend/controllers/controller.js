import axios from 'axios';
import salesforceModel from '../models/models.js';

// Helper to request a token from Salesforce OAuth
async function requestToken(myDomain, clientId, clientSecret) {
    const tokenUrl = `${String(myDomain).replace(/\/+$/, '')}/services/oauth2/token`;
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

// POST /api/salesforce/connect
export const connect = async (req, res) => {
    const { myDomain, clientId, clientSecret, name } = req.body;

    if (!myDomain || !clientId || !clientSecret) {
        return res.status(400).json({
            success: false,
            message: 'myDomain, clientId, and clientSecret are all required.'
        });
    }

    try {
        const cleanDomain = String(myDomain).trim().replace(/\/+$/, '');
        const tokenData = await requestToken(cleanDomain, clientId, clientSecret);

        const savedConn = await salesforceModel.saveCredentials({
            name,
            myDomain: cleanDomain,
            clientId,
            clientSecret
        });

        await salesforceModel.saveSession(savedConn.id, {
            accessToken: tokenData.access_token,
            instanceUrl: tokenData.instance_url || cleanDomain,
            expiresIn: tokenData.expires_in || 3600
        });

        const details = await salesforceModel.getConnectionDetails();

        return res.status(200).json({
            success: true,
            message: 'Connection established successfully!',
            data: details
        });
    } catch (error) {
        await salesforceModel.disconnect().catch(() => {});
        return res.status(500).json({
            success: false,
            message: 'Failed to establish connection with Salesforce.',
            error: error.response?.data || error.message
        });
    }
};

// GET /api/salesforce/status
export const getStatus = async (req, res) => {
    try {
        const details = await salesforceModel.getConnectionDetails();
        return res.status(200).json({
            success: true,
            data: details
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch connection status.',
            error: error.message
        });
    }
};

// GET /api/salesforce/test-query
export const testQuery = async (req, res) => {
    try {
        const activeConn = await salesforceModel.getValidConnection();
        const instanceUrl = activeConn.instance_url || activeConn.my_domain;
        const accessToken = activeConn.access_token;

        const queryUrl = `${instanceUrl}/services/data/v60.0/query?q=SELECT+Id,Name,Type+FROM+Account+LIMIT+3`;

        const queryRes = await axios.get(queryUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        return res.status(200).json({
            success: true,
            records: queryRes.data.records
        });
    } catch (error) {
        const isMissingConn = error.message === 'No active Salesforce connection found in database.';
        return res.status(isMissingConn ? 400 : 500).json({
            success: false,
            message: isMissingConn ? 'No active Salesforce connection. Please connect first.' : 'Failed to execute query.',
            error: error.response?.data || error.message
        });
    }
};

// POST /api/salesforce/disconnect
export const disconnect = async (req, res) => {
    try {
        await salesforceModel.disconnect();
        return res.status(200).json({
            success: true,
            message: 'Disconnected successfully.'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to disconnect.',
            error: error.message
        });
    }
};

// ---------------- WORKFLOW CONTROLLERS ----------------

export const saveWorkflow = async (req, res) => {
    const { id, name, description, definition, connectionId } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Workflow "name" is required.'
        });
    }

    try {
        const workflow = await salesforceModel.saveWorkflow({
            id,
            name,
            description,
            definition,
            connectionId
        });

        if (id && !workflow) {
            return res.status(404).json({
                success: false,
                message: `Workflow with id ${id} not found.`
            });
        }

        return res.status(id ? 200 : 201).json({
            success: true,
            message: id ? 'Workflow updated successfully.' : 'Workflow saved successfully.',
            workflow
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to save workflow.',
            error: error.message
        });
    }
};

export const listWorkflows = async (req, res) => {
    try {
        const workflows = await salesforceModel.getAllWorkflows();
        return res.status(200).json({
            success: true,
            workflows
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to load workflows.',
            error: error.message
        });
    }
};

export const getWorkflowById = async (req, res) => {
    try {
        const workflow = await salesforceModel.getWorkflowById(req.params.id);
        if (!workflow) {
            return res.status(404).json({
                success: false,
                message: 'Workflow not found.'
            });
        }
        return res.status(200).json({
            success: true,
            workflow
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch workflow.',
            error: error.message
        });
    }
};

export const deleteWorkflow = async (req, res) => {
    try {
        const deleted = await salesforceModel.deleteWorkflow(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Workflow not found.'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Workflow deleted successfully.',
            deleted
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to delete workflow.',
            error: error.message
        });
    }
};

// ---------------- TEST LOG CONTROLLERS ----------------

export const createTestLog = async (req, res) => {
    const { workflowId, connectionId, triggerType, stepLogs } = req.body;
    try {
        const log = await salesforceModel.createTestLog({
            workflowId,
            connectionId,
            triggerType,
            stepLogs
        });
        return res.status(201).json({
            success: true,
            log
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create test log.',
            error: error.message
        });
    }
};

export const completeTestLog = async (req, res) => {
    const { status, stepLogs, errorMessage, durationMs, startedAt } = req.body;
    try {
        const log = await salesforceModel.completeTestLog(req.params.logId, {
            status,
            stepLogs,
            errorMessage,
            durationMs,
            startedAt
        });
        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Test log not found.'
            });
        }
        return res.status(200).json({
            success: true,
            log
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update test log.',
            error: error.message
        });
    }
};

export const getTestLogs = async (req, res) => {
    const { workflowId, limit } = req.query;
    try {
        const logs = await salesforceModel.getTestLogs({ workflowId, limit });
        return res.status(200).json({
            success: true,
            logs
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch test logs.',
            error: error.message
        });
    }
};