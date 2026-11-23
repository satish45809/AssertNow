import axios from 'axios';
import pool from '../config/db.js';

const SAFETY_BUFFER_SECONDS = 300; // 5-minute safety buffer before actual expiry

// Helper to ensure Start and End nodes and standard edges exist on any workflow definition
function ensureWorkflowGraph(definition = { nodes: [], edges: [] }) {
    let nodes = Array.isArray(definition?.nodes) ? [...definition.nodes] : [];
    let edges = Array.isArray(definition?.edges) ? [...definition.edges] : [];

    const hasStart = nodes.some(n => n.type === 'startNode' || n.data?.nodeType === 'START');
    const hasEnd = nodes.some(n => n.type === 'endNode' || n.data?.nodeType === 'END');

    let startNodeId = 'start-1';
    if (!hasStart) {
        const minY = nodes.length > 0 ? Math.min(...nodes.map(n => n.position?.y ?? 200)) : 200;
        const startY = Math.min(60, minY - 150);
        const startNode = {
            id: startNodeId,
            type: 'startNode',
            position: { x: 420, y: startY },
            data: { label: 'Start', nodeType: 'START', config: { triggerType: 'MANUAL' } }
        };
        nodes = [startNode, ...nodes];
    } else {
        const existingStart = nodes.find(n => n.type === 'startNode' || n.data?.nodeType === 'START');
        if (existingStart) startNodeId = existingStart.id;
    }

    let endNodeId = 'end-1';
    if (!hasEnd) {
        const maxY = nodes.length > 0 ? Math.max(...nodes.map(n => n.position?.y ?? 60)) : 60;
        const endY = maxY + 170;
        const endNode = {
            id: endNodeId,
            type: 'endNode',
            position: { x: 420, y: endY },
            data: { label: 'End', nodeType: 'END', config: { isFault: false } }
        };
        nodes = [...nodes, endNode];
    } else {
        const existingEnd = nodes.find(n => n.type === 'endNode' || n.data?.nodeType === 'END');
        if (existingEnd) endNodeId = existingEnd.id;
    }

    const middleNodes = nodes.filter(n => n.id !== startNodeId && n.id !== endNodeId);
    if (middleNodes.length === 0 && edges.length === 0) {
        edges.push({
            id: `e-${startNodeId}-${endNodeId}`,
            source: startNodeId,
            target: endNodeId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'flowConnector',
            style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
    } else if (middleNodes.length > 0) {
        const hasStartOut = edges.some(e => e.source === startNodeId);
        if (!hasStartOut) {
            const sorted = [...middleNodes].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));
            edges.push({
                id: `e-${startNodeId}-${sorted[0].id}`,
                source: startNodeId,
                target: sorted[0].id,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'flowConnector',
                style: { stroke: '#94a3b8', strokeWidth: 2 }
            });
        }

        const hasEndIn = edges.some(e => e.target === endNodeId);
        if (!hasEndIn) {
            const sorted = [...middleNodes].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));
            const lastMiddle = sorted[sorted.length - 1];
            edges.push({
                id: `e-${lastMiddle.id}-${endNodeId}`,
                source: lastMiddle.id,
                target: endNodeId,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'flowConnector',
                style: { stroke: '#94a3b8', strokeWidth: 2 }
            });
        }
    }

    return { ...definition, nodes, edges };
}

class SalesforceModel {
    // Save or update credentials in salesforce_connections table
    async saveCredentials({ myDomain, clientId, clientSecret, name = null }) {
        if (!myDomain || !clientId || !clientSecret) {
            throw new Error('myDomain, clientId, and clientSecret are required.');
        }

        const cleanDomain = String(myDomain).trim().replace(/\/+$/, '');
        const cleanClientId = String(clientId).trim();
        const cleanClientSecret = String(clientSecret).trim();
        const connName = name || cleanDomain;

        await pool.query(
            `UPDATE salesforce_connections
             SET is_active = FALSE, updated_at = NOW()
             WHERE is_active = TRUE`
        );

        const existing = await pool.query(
            `SELECT id
             FROM salesforce_connections
             WHERE my_domain = $1 AND client_id = $2
             ORDER BY id DESC
             LIMIT 1`,
            [cleanDomain, cleanClientId]
        );

        if (existing.rows[0]) {
            const { rows } = await pool.query(
                `UPDATE salesforce_connections
                 SET name = $1,
                     client_secret = $2,
                     is_active = TRUE,
                     updated_at = NOW()
                 WHERE id = $3
                 RETURNING *`,
                [connName, cleanClientSecret, existing.rows[0].id]
            );
            return rows[0];
        }

        const { rows } = await pool.query(
            `INSERT INTO salesforce_connections (name, my_domain, client_id, client_secret, is_active)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING *`,
            [connName, cleanDomain, cleanClientId, cleanClientSecret]
        );

        return rows[0];
    }

    // Fetch active connection row from PostgreSQL
    async getActiveConnection() {
        const { rows } = await pool.query(
            `SELECT *
             FROM salesforce_connections
             WHERE is_active = TRUE
             ORDER BY updated_at DESC, id DESC
             LIMIT 1`
        );
        return rows[0] || null;
    }

    // Persist token details with a 5-minute safety buffer
    async saveSession(connectionId, { accessToken, instanceUrl, expiresIn = 3600 }) {
        const effectiveSeconds = Math.max(Number(expiresIn || 3600) - SAFETY_BUFFER_SECONDS, 60);
        const tokenExpiresAt = new Date(Date.now() + effectiveSeconds * 1000);

        const { rows } = await pool.query(
            `UPDATE salesforce_connections
             SET access_token = $1,
                 instance_url = $2,
                 token_expires_at = $3,
                 is_active = TRUE,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [accessToken, instanceUrl, tokenExpiresAt, connectionId]
        );

        return rows[0];
    }

    // Check if DB token exists and has not crossed the buffered expiry
    hasValidToken(connection) {
        if (!connection || !connection.access_token || !connection.token_expires_at) {
            return false;
        }
        return new Date() < new Date(connection.token_expires_at);
    }

    // Refresh OAuth token from Salesforce and store new token in PostgreSQL
    async refreshToken(connection = null) {
        const activeConn = connection || (await this.getActiveConnection());
        if (!activeConn) {
            throw new Error('No active Salesforce connection found in database.');
        }

        const tokenUrl = `${String(activeConn.my_domain).replace(/\/+$/, '')}/services/oauth2/token`;
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: activeConn.client_id,
            client_secret: activeConn.client_secret
        });

        const response = await axios.post(tokenUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, instance_url, expires_in } = response.data;

        return await this.saveSession(activeConn.id, {
            accessToken: access_token,
            instanceUrl: instance_url || activeConn.instance_url || activeConn.my_domain,
            expiresIn: expires_in || 3600
        });
    }

    // Always return a valid DB-persisted connection (auto-refreshing when expired/missing)
    async getValidConnection() {
        const activeConn = await this.getActiveConnection();
        if (!activeConn) {
            throw new Error('No active Salesforce connection found in database.');
        }

        if (this.hasValidToken(activeConn)) {
            return activeConn;
        }

        return await this.refreshToken(activeConn);
    }

    // Clear token and mark active connection inactive in PostgreSQL
    async disconnect() {
        const activeConn = await this.getActiveConnection();
        if (!activeConn) return null;

        const { rows } = await pool.query(
            `UPDATE salesforce_connections
             SET access_token = NULL,
                 token_expires_at = NULL,
                 is_active = FALSE,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [activeConn.id]
        );

        return rows[0] || null;
    }

    // Safe summary without secrets
    async getConnectionDetails() {
        const activeConn = await this.getActiveConnection();
        if (!activeConn) {
            return {
                isConnected: false,
                connectionId: null,
                name: null,
                myDomain: null,
                instanceUrl: null,
                tokenExpiresAt: null
            };
        }

        return {
            isConnected: Boolean(activeConn.is_active && activeConn.access_token),
            connectionId: activeConn.id,
            name: activeConn.name,
            myDomain: activeConn.my_domain,
            instanceUrl: activeConn.instance_url,
            tokenExpiresAt: activeConn.token_expires_at
        };
    }

    // ---------------- WORKFLOWS PERSISTENCE ----------------

    async saveWorkflow({ id = null, name, description = null, definition = { nodes: [], edges: [] }, connectionId = null }) {
        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new Error('Workflow "name" is required.');
        }

        const activeConn = await this.getActiveConnection();
        const candidateConnId = connectionId ?? activeConn?.id ?? null;

        let resolvedConnectionId = null;
        if (candidateConnId && !Number.isNaN(Number(candidateConnId))) {
            const connCheck = await pool.query(
                'SELECT id FROM salesforce_connections WHERE id = $1',
                [Number(candidateConnId)]
            );
            if (connCheck.rows.length > 0) {
                resolvedConnectionId = Number(candidateConnId);
            }
        }

        const normalizedDef = ensureWorkflowGraph(
            definition && typeof definition === 'object' ? definition : { nodes: [], edges: [] }
        );

        if (id) {
            const { rows } = await pool.query(
                `UPDATE workflows
                 SET connection_id = COALESCE($1, connection_id),
                     name = $2,
                     description = $3,
                     version = version + 1,
                     definition = $4::jsonb,
                     updated_at = NOW()
                 WHERE id = $5
                 RETURNING *`,
                [resolvedConnectionId, name.trim(), description, JSON.stringify(normalizedDef), Number(id)]
            );
            return rows[0] || null;
        }

        const { rows } = await pool.query(
            `INSERT INTO workflows (connection_id, name, description, version, definition)
             VALUES ($1, $2, $3, 1, $4::jsonb)
             RETURNING *`,
            [resolvedConnectionId, name.trim(), description, JSON.stringify(normalizedDef)]
        );

        return rows[0];
    }

    async getAllWorkflows() {
        const { rows } = await pool.query(
            `SELECT id, connection_id, name, description, version, definition, created_at, updated_at
             FROM workflows
             ORDER BY updated_at DESC, id DESC`
        );
        return rows.map((r) => ({
            ...r,
            definition: ensureWorkflowGraph(r.definition)
        }));
    }

    async getWorkflowById(id) {
        const { rows } = await pool.query(
            `SELECT id, connection_id, name, description, version, definition, created_at, updated_at
             FROM workflows
             WHERE id = $1`,
            [Number(id)]
        );
        if (!rows[0]) return null;
        return {
            ...rows[0],
            definition: ensureWorkflowGraph(rows[0].definition)
        };
    }

    async deleteWorkflow(id) {
        const { rows } = await pool.query(
            `DELETE FROM workflows
             WHERE id = $1
             RETURNING id, name`,
            [Number(id)]
        );
        return rows[0] || null;
    }

    // ---------------- WORKFLOW TEST LOGS PERSISTENCE ----------------

    async createTestLog({ workflowId = null, connectionId = null, triggerType = 'MANUAL', stepLogs = [] }) {
        const activeConn = await this.getActiveConnection();
        const candidateConnId = connectionId ?? activeConn?.id ?? null;

        let resolvedConnectionId = null;
        if (candidateConnId && !Number.isNaN(Number(candidateConnId))) {
            const connCheck = await pool.query(
                'SELECT id FROM salesforce_connections WHERE id = $1',
                [Number(candidateConnId)]
            );
            if (connCheck.rows.length > 0) {
                resolvedConnectionId = Number(candidateConnId);
            }
        }

        let resolvedWorkflowId = null;
        if (workflowId && !Number.isNaN(Number(workflowId))) {
            const wfCheck = await pool.query(
                'SELECT id FROM workflows WHERE id = $1',
                [Number(workflowId)]
            );
            if (wfCheck.rows.length > 0) {
                resolvedWorkflowId = Number(workflowId);
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO workflow_test_logs (workflow_id, connection_id, status, trigger_type, step_logs, started_at)
             VALUES ($1, $2, 'RUNNING', $3, $4::jsonb, NOW())
             RETURNING *`,
            [
                resolvedWorkflowId,
                resolvedConnectionId,
                String(triggerType || 'MANUAL').toUpperCase(),
                JSON.stringify(Array.isArray(stepLogs) ? stepLogs : [])
            ]
        );

        return rows[0];
    }

    async completeTestLog(
        logId,
        { status = 'PASSED', stepLogs = [], errorMessage = null, durationMs = null, startedAt = null }
    ) {
        const computedDuration =
            typeof durationMs === 'number'
                ? Math.max(0, Math.round(durationMs))
                : startedAt
                    ? Math.max(0, Date.now() - new Date(startedAt).getTime())
                    : null;

        const { rows } = await pool.query(
            `UPDATE workflow_test_logs
             SET status = $1,
                 step_logs = $2::jsonb,
                 error_message = $3,
                 duration_ms = COALESCE($4, duration_ms),
                 completed_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [
                String(status || 'PASSED').toUpperCase(),
                JSON.stringify(Array.isArray(stepLogs) ? stepLogs : []),
                errorMessage,
                computedDuration,
                Number(logId)
            ]
        );

        return rows[0] || null;
    }

    async getTestLogs({ workflowId = null, limit = 50 } = {}) {
        const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

        if (workflowId) {
            const { rows } = await pool.query(
                `SELECT *
                 FROM workflow_test_logs
                 WHERE workflow_id = $1
                 ORDER BY started_at DESC, id DESC
                 LIMIT $2`,
                [Number(workflowId), safeLimit]
            );
            return rows;
        }

        const { rows } = await pool.query(
            `SELECT *
             FROM workflow_test_logs
             ORDER BY started_at DESC, id DESC
             LIMIT $1`,
            [safeLimit]
        );
        return rows;
    }
}

export default new SalesforceModel();