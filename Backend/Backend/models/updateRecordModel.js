import jsforce from 'jsforce';
import salesforceModel from '../models/models.js';

let refreshPromise = null;

class UpdateRecordModel {
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

    validateIdentifier(name, label = 'identifier') {
        if (!/^[a-zA-Z0-9_]+$/.test(String(name || ''))) {
            throw new Error(`Invalid ${label}: "${name}".`);
        }
    }

    // 1. Updateable objects for UI dropdown
    async getUpdateableObjects() {
        return await this.executeWithRetry(async (conn) => {
            const globalDescribe = await conn.describeGlobal();

            return globalDescribe.sobjects
                .filter((obj) => obj.updateable && !obj.deprecatedAndHidden)
                .map((obj) => ({
                    name: obj.name,
                    label: obj.label,
                    custom: obj.custom
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
        });
    }

    // 2. Updateable fields for selected object
    async getUpdateableFields(sobject) {
        this.validateIdentifier(sobject, 'Salesforce object');

        return await this.executeWithRetry(async (conn) => {
            const meta = await conn.sobject(sobject).describe();

            const fields = meta.fields
                .filter((f) => f.updateable)
                .map((f) => ({
                    name: f.name,
                    label: f.label,
                    type: f.type,
                    length: f.length,
                    nillable: f.nillable,
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

    // 3. Lookup existing records for target record picker
    async getRecordsForUpdate(sobject, search = '', limit = 50) {
        this.validateIdentifier(sobject, 'Salesforce object');

        return await this.executeWithRetry(async (conn) => {
            const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
            const safeSearch = String(search || '').trim().replace(/['\\]/g, '\\$&');
            const whereClause = safeSearch ? ` WHERE Name LIKE '%${safeSearch}%'` : '';

            try {
                const soql = `SELECT Id, Name FROM ${sobject}${whereClause} ORDER BY LastModifiedDate DESC LIMIT ${safeLimit}`;
                const result = await conn.query(soql);
                return result.records.map((r) => ({ id: r.Id, name: r.Name }));
            } catch (err) {
                const fallbackSoql = `SELECT Id FROM ${sobject} ORDER BY LastModifiedDate DESC LIMIT ${safeLimit}`;
                const result = await conn.query(fallbackSoql);
                return result.records.map((r) => ({ id: r.Id, name: r.Id }));
            }
        });
    }

    // 4. Single record update by Record ID
    async updateRecordById(sobject, recordId, updateData = {}) {
        this.validateIdentifier(sobject, 'Salesforce object');

        if (!recordId || typeof recordId !== 'string') {
            throw new Error('Valid "recordId" is required.');
        }

        // Prevent overwriting Id inside payload
        const { Id, id, ...fieldsToUpdate } = updateData;

        if (Object.keys(fieldsToUpdate).length === 0) {
            throw new Error('At least one field to update is required.');
        }

        return await this.executeWithRetry(async (conn) => {
            const result = await conn.sobject(sobject).update({
                Id: recordId.trim(),
                ...fieldsToUpdate
            });

            return result;
        });
    }

    // 5. Bulk update multiple records (e.g., list of IDs from Get Records node)
    async updateMultipleRecords(sobject, records = []) {
        this.validateIdentifier(sobject, 'Salesforce object');

        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Non-empty "records" array (each with "Id") is required.');
        }

        return await this.executeWithRetry(async (conn) => {
            const results = await conn.sobject(sobject).update(records);
            return Array.isArray(results) ? results : [results];
        });
    }
}

export default new UpdateRecordModel();