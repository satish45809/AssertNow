import jsforce from 'jsforce';
import salesforceModel from '../models/models.js';

let refreshPromise = null;

class DeleteRecordModel {
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

    // 1. Deletable objects for UI dropdown
    async getDeletableObjects() {
        return await this.executeWithRetry(async (conn) => {
            const globalDescribe = await conn.describeGlobal();

            return globalDescribe.sobjects
                .filter((obj) => obj.deletable && !obj.deprecatedAndHidden)
                .map((obj) => ({
                    name: obj.name,
                    label: obj.label,
                    custom: obj.custom
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
        });
    }

    // 2. Lookup existing records for target record picker
    async getRecordsForDelete(sobject, search = '', limit = 50) {
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

    // 3. Single record delete by Record ID
    async deleteRecordById(sobject, recordId) {
        this.validateIdentifier(sobject, 'Salesforce object');

        if (!recordId || typeof recordId !== 'string') {
            throw new Error('Valid "recordId" is required.');
        }

        return await this.executeWithRetry(async (conn) => {
            const result = await conn.sobject(sobject).destroy(recordId.trim());
            return result;
        });
    }

    // 4. Bulk delete multiple records by IDs array (e.g., list of IDs from Get Records node)
    async deleteMultipleRecords(sobject, ids = []) {
        this.validateIdentifier(sobject, 'Salesforce object');

        if (!Array.isArray(ids) || ids.length === 0) {
            throw new Error('Non-empty "ids" array is required.');
        }

        const cleanIds = ids.map((id) => String(id || '').trim()).filter(Boolean);
        if (cleanIds.length === 0) {
            throw new Error('At least one valid record ID is required.');
        }

        return await this.executeWithRetry(async (conn) => {
            const results = await conn.sobject(sobject).destroy(cleanIds);
            return Array.isArray(results) ? results : [results];
        });
    }
}

export default new DeleteRecordModel();