import jsforce from 'jsforce';
import salesforceModel from '../models/models.js';

let refreshPromise = null;

class CreateRecordModel {
    constructor() {
        this.flowContext = {};
    }

    resetFlowContext() {
        this.flowContext = {};
    }

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

    resolveTemplateValue(value, context = this.flowContext) {
        if (typeof value !== 'string') return value;

        return value.replace(/\{\{\s*([a-zA-Z0-9_-]+)\.(id|Id)\s*\}\}/g, (match, rawKey) => {
            const normalizedKey = rawKey.toLowerCase();
            const matchedEntry =
                context[rawKey] ||
                context[normalizedKey] ||
                Object.entries(context).find(
                    ([k, v]) => k.toLowerCase() === normalizedKey || v.sobject.toLowerCase() === normalizedKey
                )?.[1];

            if (!matchedEntry?.id) {
                throw new Error(`Unresolved variable "${match}". Create ${rawKey} first.`);
            }

            return matchedEntry.id;
        });
    }

    resolvePayloadData(data = {}, context = this.flowContext) {
        if (Array.isArray(data)) {
            return data.map((item) => this.resolvePayloadData(item, context));
        }

        if (data && typeof data === 'object') {
            const resolved = {};
            for (const [fieldName, fieldValue] of Object.entries(data)) {
                resolved[fieldName] = this.resolvePayloadData(fieldValue, context);
            }
            return resolved;
        }

        return this.resolveTemplateValue(data, context);
    }

    async getActiveToken(forceRefresh = false) {
        if (!forceRefresh) {
            const connRow = await salesforceModel.getValidConnection();
            return connRow.access_token;
        }

        if (!refreshPromise) {
            refreshPromise = salesforceModel
                .refreshToken()
                .then((updatedRow) => updatedRow.access_token)
                .finally(() => {
                    refreshPromise = null;
                });
        }

        return refreshPromise;
    }

    async getConnection(forceRefresh = false) {
        const connRow = forceRefresh
            ? await salesforceModel.refreshToken()
            : await salesforceModel.getValidConnection();

        const instanceUrl = connRow.instance_url || connRow.my_domain;
        const accessToken = connRow.access_token;

        if (!instanceUrl || !accessToken) {
            throw new Error('Salesforce session is missing instance_url or access_token in database.');
        }

        return new jsforce.Connection({
            instanceUrl,
            accessToken,
            version: '60.0'
        });
    }

    async executeWithRetry(operationFn) {
        try {
            const conn = await this.getConnection(false);
            return await operationFn(conn);
        } catch (error) {
            const isSessionError =
                error?.errorCode === 'INVALID_SESSION_ID' ||
                error?.response?.status === 401 ||
                String(error?.message || '').includes('INVALID_SESSION_ID');

            if (!isSessionError) {
                throw error;
            }

            const freshConn = await this.getConnection(true);
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

    // Lookup: Fetch existing parent records (e.g., Accounts for Opportunity, Opportunities for Quote)
    async getLookupRecords(sobject, search = '', limit = 50) {
        if (!/^[a-zA-Z0-9_]+$/.test(sobject)) {
            throw new Error(`Invalid Salesforce object name: "${sobject}".`);
        }

        return await this.executeWithRetry(async (conn) => {
            const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
            const safeSearch = String(search || '').trim().replace(/['\\]/g, '\\$&');
            const whereClause = safeSearch ? ` WHERE Name LIKE '%${safeSearch}%'` : '';

            try {
                const soql = `SELECT Id, Name FROM ${sobject}${whereClause} ORDER BY CreatedDate DESC LIMIT ${safeLimit}`;
                const result = await conn.query(soql);
                return result.records.map((r) => ({ id: r.Id, name: r.Name }));
            } catch (err) {
                const fallbackSoql = `SELECT Id FROM ${sobject} ORDER BY CreatedDate DESC LIMIT ${safeLimit}`;
                const result = await conn.query(fallbackSoql);
                return result.records.map((r) => ({ id: r.Id, name: r.Id }));
            }
        });
    }

    // Execute connected nodes sequentially (Account -> Contact -> Opportunity -> Quote)
    async executeFlow(steps = []) {
        const context = {};
        const executedSteps = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepIdentifier = step.key || step.nodeId || step.sobject || `step_${i + 1}`;
            const sobject = String(step.sobject || '').trim();
            const rawData = step.data || {};

            if (!sobject || typeof rawData !== 'object' || Array.isArray(rawData) || Object.keys(rawData).length === 0) {
                return {
                    success: false,
                    failedAtStep: i + 1,
                    stepKey: stepIdentifier,
                    sobject,
                    message: `Step ${i + 1} (${stepIdentifier}) requires valid "sobject" and non-empty "data".`,
                    context,
                    executedSteps
                };
            }

            try {
                const resolvedData = this.resolvePayloadData(rawData, context);

                const result = await this.executeWithRetry(async (conn) => {
                    return await conn.sobject(sobject).create(resolvedData);
                });

                if (!result.success) {
                    return {
                        success: false,
                        failedAtStep: i + 1,
                        stepKey: stepIdentifier,
                        sobject,
                        message: `Failed to create ${sobject} at step ${i + 1}.`,
                        errors: result.errors,
                        context,
                        executedSteps
                    };
                }

                context[stepIdentifier.toLowerCase()] = { id: result.id, sobject };
                if (!context[sobject.toLowerCase()]) {
                    context[sobject.toLowerCase()] = { id: result.id, sobject };
                }

                executedSteps.push({
                    step: i + 1,
                    key: stepIdentifier,
                    sobject,
                    id: result.id,
                    resolvedData
                });
            } catch (error) {
                return {
                    success: false,
                    failedAtStep: i + 1,
                    stepKey: stepIdentifier,
                    sobject,
                    message: error?.message || `Error executing ${sobject} at step ${i + 1}.`,
                    error: error?.response?.data || error?.message || error,
                    context,
                    executedSteps
                };
            }
        }

        this.flowContext = { ...this.flowContext, ...context };

        return {
            success: true,
            message: 'Flow executed successfully.',
            context,
            executedSteps
        };
    }

    // Single record create
    async createRecordForObject(sobject, recordData, stepKey = null) {
        const resolvedData = this.resolvePayloadData(recordData, this.flowContext);

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

    // Bulk create multiple records (e.g., creating a Quote for each record from Get Records)
    async createBulkRecords(sobject, records = []) {
        const cleanSobject = String(sobject || '').trim();
        if (!/^[a-zA-Z0-9_]+$/.test(cleanSobject)) {
            throw new Error(`Invalid Salesforce object: "${sobject}".`);
        }

        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Non-empty "records" array is required for bulk create.');
        }

        const cleanRecords = records.map((row) => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) {
                throw new Error('Each item in "records" must be a field object.');
            }
            const cleaned = {};
            for (const [key, val] of Object.entries(row)) {
                if (!/^[a-zA-Z0-9_]+$/.test(String(key || ''))) {
                    throw new Error(`Invalid field name: "${key}".`);
                }
                if (val !== '' && val !== null && val !== undefined) {
                    cleaned[key] = val;
                }
            }
            return cleaned;
        });

        return await this.executeWithRetry(async (conn) => {
            const results = await conn.sobject(cleanSobject).create(cleanRecords);
            return Array.isArray(results) ? results : [results];
        });
    }
}

export default new CreateRecordModel();