import jsforce from 'jsforce';
import axios from 'axios';
import salesforceModel from '../models/models.js';

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

let refreshPromise = null;

class CreateRecordModel {
    constructor() {
        // Stores created records per step/object in memory for current flow execution
        // Example: { account: { id: '001...', name: 'Acme' }, contact: { id: '003...' } }
        this.flowContext = {};
    }

    resetFlowContext() {
        this.flowContext = {};
    }

    // Returns available {{...}} expressions for UI fields
    getAvailableVariables() {
        const variables = [];

        for (const [key, recordInfo] of Object.entries(this.flowContext)) {
            variables.push({
                token: `{{${key}.id}}`,
                sobject: recordInfo.sobject,
                value: recordInfo.id,
                label: `${recordInfo.sobject} ID (${key})`
            });
        }

        return {
            flowContext: this.flowContext,
            variables
        };
    }

    // Resolves "{{account.id}}" or "{{Account.Id}}" inside field values
    resolveTemplateValue(value) {
        if (typeof value !== 'string') return value;

        return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\.(id|Id)\s*\}\}/g, (match, rawKey) => {
            const normalizedKey = rawKey.toLowerCase();
            const matchedEntry =
                this.flowContext[rawKey] ||
                this.flowContext[normalizedKey] ||
                Object.entries(this.flowContext).find(
                    ([k, v]) => k.toLowerCase() === normalizedKey || v.sobject.toLowerCase() === normalizedKey
                )?.[1];

            if (!matchedEntry?.id) {
                throw new Error(`Unresolved variable "${match}". Create ${rawKey} first.`);
            }

            return matchedEntry.id;
        });
    }

    resolvePayloadData(data = {}) {
        const resolved = {};
        for (const [fieldName, fieldValue] of Object.entries(data)) {
            resolved[fieldName] = this.resolveTemplateValue(fieldValue);
        }
        return resolved;
    }

    async getActiveToken() {
        if (salesforceModel.hasValidToken() && salesforceModel.accessToken) {
            return salesforceModel.accessToken;
        }

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
                    refreshPromise = null;
                });
        }

        return refreshPromise;
    }

    async getConnection() {
        if (!salesforceModel.isConnected) {
            throw new Error('No active Salesforce connection. Please connect first.');
        }

        await this.getActiveToken();

        if (!salesforceModel.conn || salesforceModel.conn.accessToken !== salesforceModel.accessToken) {
            salesforceModel.conn = new jsforce.Connection({
                instanceUrl: salesforceModel.instanceUrl,
                accessToken: salesforceModel.accessToken,
                version: '60.0'
            });
        }

        return salesforceModel.conn;
    }

    async executeWithRetry(operationFn) {
        try {
            const conn = await this.getConnection();
            return await operationFn(conn);
        } catch (error) {
            const isSessionError =
                error?.errorCode === 'INVALID_SESSION_ID' ||
                error?.response?.status === 401 ||
                String(error?.message || '').includes('INVALID_SESSION_ID');

            if (!isSessionError || !salesforceModel.isConnected) {
                throw error;
            }

            const tokenData = await requestToken(
                salesforceModel.myDomain,
                salesforceModel.clientId,
                salesforceModel.clientSecret
            );
            salesforceModel.setSession({
                accessToken: tokenData.access_token,
                instanceUrl: tokenData.instance_url
            });

            const freshConn = new jsforce.Connection({
                instanceUrl: salesforceModel.instanceUrl,
                accessToken: salesforceModel.accessToken,
                version: '60.0'
            });
            salesforceModel.conn = freshConn;

            return await operationFn(freshConn);
        }
    }

    // Step 1: Createable objects for UI dropdown
    async getCreateableObjects() {
        return await this.executeWithRetry(async (conn) => {
            const globalDescribe = await conn.describeGlobal();

            return globalDescribe.sobjects
                .filter((obj) => obj.createable && !obj.deprecatedAndHidden)
                .map((obj) => ({
                    name: obj.name,
                    label: obj.label,
                    custom: obj.custom
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
        });
    }

    // Step 2: Createable fields for selected object
    async getFieldsByObject(sobject) {
        return await this.executeWithRetry(async (conn) => {
            const meta = await conn.sobject(sobject).describe();

            const fields = meta.fields
                .filter((f) => f.createable)
                .map((f) => ({
                    name: f.name,
                    label: f.label,
                    type: f.type,
                    length: f.length,
                    required: !f.nillable && !f.defaultedOnCreate,
                    picklistValues:
                        f.picklistValues
                            ?.filter((p) => p.active)
                            .map((p) => ({ label: p.label, value: p.value })) || [],
                    referenceTo: f.referenceTo || []
                }));

            return {
                sobject: meta.name,
                label: meta.label,
                fields
            };
        });
    }

    // Step 3: Resolve {{account.id}} etc., create record, and save created ID in flowContext
    async createRecordForObject(sobject, recordData, stepKey = null) {
        const resolvedData = this.resolvePayloadData(recordData);

        const result = await this.executeWithRetry(async (conn) => {
            return await conn.sobject(sobject).create(resolvedData);
        });

        if (result.success && result.id) {
            const contextKey = (stepKey || sobject).toLowerCase();
            this.flowContext[contextKey] = {
                id: result.id,
                sobject
            };
        }

        return {
            result,
            resolvedData,
            flowContext: this.flowContext
        };
    }
}

export default new CreateRecordModel();