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


class GetRecordModel {
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


    validateIdentifier(name, label = 'identifier') {
        if (!/^[a-zA-Z0-9_]+$/.test(String(name || ''))) {
            throw new Error(`Invalid ${label}: "${name}".`);
        }
    }


    // 1. Queryable objects for Get Records UI dropdown
    async getQueryableObjects() {
        return await this.executeWithRetry(async (conn) => {
            const globalDescribe = await conn.describeGlobal();


            return globalDescribe.sobjects
                .filter((obj) => obj.queryable && !obj.deprecatedAndHidden)
                .map((obj) => ({
                    name: obj.name,
                    label: obj.label,
                    custom: obj.custom
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
        });
    }


    // 2. Filterable & selectable fields for selected object
    async getQueryableFields(sobject) {
        this.validateIdentifier(sobject, 'Salesforce object');


        return await this.executeWithRetry(async (conn) => {
            const meta = await conn.sobject(sobject).describe();


            const fields = meta.fields.map((f) => ({
                name: f.name,
                label: f.label,
                type: f.type,
                filterable: f.filterable,
                sortable: f.sortable,
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


    // 3. Fetch single record directly by Id
    async getRecordById(sobject, recordId, fields = []) {
        this.validateIdentifier(sobject, 'Salesforce object');


        return await this.executeWithRetry(async (conn) => {
            if (Array.isArray(fields) && fields.length > 0) {
                fields.forEach((f) => this.validateIdentifier(f, 'field name'));
                const selectFields = Array.from(new Set(['Id', ...fields])).join(', ');
                const safeId = String(recordId).replace(/['\\]/g, '\\$&');
                const res = await conn.query(`SELECT ${selectFields} FROM ${sobject} WHERE Id = '${safeId}' LIMIT 1`);
                return res.records?.[0] || null;
            }


            return await conn.sobject(sobject).retrieve(recordId);
        });
    }


    // Build safe SOQL WHERE condition from filter object
    buildWhereClause(filters = [], filterLogic = 'AND') {
        if (!Array.isArray(filters) || filters.length === 0) {
            return '';
        }


        const operatorMap = {
            '=': '=',
            '!=': '!=',
            '>': '>',
            '<': '<',
            '>=': '>=',
            '<=': '<=',
            LIKE: 'LIKE',
            IN: 'IN'
        };


        const conditions = filters.map((item) => {
            const { field, operator = '=', value, type = 'string' } = item;
            this.validateIdentifier(field, 'filter field');


            const op = operatorMap[String(operator).toUpperCase()];
            if (!op) {
                throw new Error(`Unsupported operator: "${operator}".`);
            }


            if (value === null || value === undefined || value === '') {
                return `${field} ${op === '!=' ? '!=' : '='} NULL`;
            }


            if (op === 'IN' && Array.isArray(value)) {
                const formattedList = value
                    .map((v) => (type === 'number' || type === 'boolean' ? v : `'${String(v).replace(/['\\]/g, '\\$&')}'`))
                    .join(', ');
                return `${field} IN (${formattedList})`;
            }


            if (type === 'number' || type === 'boolean') {
                return `${field} ${op} ${value}`;
            }


            const escaped = String(value).replace(/['\\]/g, '\\$&');
            const formattedVal = op === 'LIKE' && !escaped.includes('%') ? `'%${escaped}%'` : `'${escaped}'`;
            return `${field} ${op} ${formattedVal}`;
        });


        const joiner = String(filterLogic).toUpperCase() === 'OR' ? ' OR ' : ' AND ';
        return ` WHERE ${conditions.join(joiner)}`;
    }


    // 4. Query records with filters, fields, sort & limit (Get Records node execution)
    async queryRecords({
        sobject,
        fields = ['Id', 'Name'],
        filters = [],
        filterLogic = 'AND',
        orderBy = 'CreatedDate',
        sortDirection = 'DESC',
        limit = 50,
        onlyFirstRecord = false
    }) {
        this.validateIdentifier(sobject, 'Salesforce object');


        const selectedFields = Array.isArray(fields) && fields.length > 0 ? fields : ['Id', 'Name'];
        selectedFields.forEach((f) => this.validateIdentifier(f, 'field name'));


        this.validateIdentifier(orderBy, 'orderBy field');
        const dir = String(sortDirection).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const safeLimit = onlyFirstRecord ? 1 : Math.min(Math.max(Number(limit) || 50, 1), 200);


        const selectClause = Array.from(new Set(['Id', ...selectedFields])).join(', ');
        const whereClause = this.buildWhereClause(filters, filterLogic);
        const soql = `SELECT ${selectClause} FROM ${sobject}${whereClause} ORDER BY ${orderBy} ${dir} LIMIT ${safeLimit}`;


        return await this.executeWithRetry(async (conn) => {
            const result = await conn.query(soql);
            const records = result.records || [];


            return {
                soql,
                totalSize: result.totalSize,
                done: result.done,
                record: onlyFirstRecord ? records[0] || null : undefined,
                records
            };
        });
    }
}


export default new GetRecordModel();

