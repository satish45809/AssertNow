/**
 * Salesforce HTTP Controller
 * Validates request payloads and maps responses with proper HTTP status codes.
 */

import { Context } from 'hono';
import { SalesforceService } from '../services/SalesforceService.ts';

export class SalesforceController {
  public static async listEnvironments(c: Context) {
    const envs = await SalesforceService.listEnvironments();
    return c.json({ success: true, data: envs }, 200);
  }

  public static async syncEnvironments(c: Context) {
    const body = await c.req.json();
    const envs = Array.isArray(body) ? body : body.environments || [];
    SalesforceService.syncEnvironments(envs);
    return c.json({ success: true, count: envs.length }, 200);
  }

  public static async getEnvironment(c: Context) {
    const id = c.req.param('id') || '';
    const env = await SalesforceService.getEnvironmentById(id);
    return c.json({ success: true, data: env }, 200);
  }

  public static async createEnvironment(c: Context) {
    const body = await c.req.json();
    const env = await SalesforceService.createEnvironment(body);
    return c.json({ success: true, data: env }, 201);
  }

  public static async updateEnvironment(c: Context) {
    const id = c.req.param('id') || '';
    const body = await c.req.json();
    const updated = await SalesforceService.updateEnvironment(id, body);
    return c.json({ success: true, data: updated }, 200);
  }

  public static async deleteEnvironment(c: Context) {
    const id = c.req.param('id') || '';
    const deleted = await SalesforceService.deleteEnvironment(id);
    return c.json({ success: true, deleted, message: 'Environment removed successfully!' }, 200);
  }

  public static async testEnvironment(c: Context) {
    const id = c.req.param('id') || '';
    try {
      const result = await SalesforceService.testEnvironment(id);
      return c.json({ success: true, message: 'Connection active and verified with Salesforce!', data: result }, 200);
    } catch (err: any) {
      return c.json({ 
        success: false, 
        error: {
          code: err.errorCode || 'CONNECTION_ERROR',
          message: err.message || 'Salesforce connection failed'
        },
        message: err.message || 'Salesforce connection failed'
      }, 400);
    }
  }

  public static async verifyConnection(c: Context) {
    const body = await c.req.json();
    const creds = body.credentials || body;
    // Normalize field names (supports myDomain or instanceUrl)
    if (creds.myDomain && !creds.instanceUrl) {
      creds.instanceUrl = creds.myDomain;
    }
    const result = await SalesforceService.verifyConnection(creds);
    return c.json({ success: true, message: 'Connection established successfully!', data: result }, 200);
  }

  public static async exchangeAuthCode(c: Context) {
    const body = await c.req.json();
    const result = await SalesforceService.exchangeAuthCode({
      code: body.code,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      codeVerifier: body.codeVerifier,
      instanceUrl: body.instanceUrl || body.myDomain,
      loginUrl: body.loginUrl,
      redirectUri: body.redirectUri,
    });
    return c.json({ success: true, message: 'OAuth authorization code exchanged successfully!', data: result }, 200);
  }

  public static async testQuery(c: Context) {
    const envId = c.req.query('envId') || 'env-sf-dev';
    const soql = c.req.query('soql') || 'SELECT Id, Name, Type, Industry FROM Account LIMIT 5';
    const queryResult = await SalesforceService.executeQuery(envId, soql);
    return c.json({ success: true, message: 'Sample query executed successfully!', data: queryResult }, 200);
  }

  public static async listSObjects(c: Context) {
    const envId = c.req.param('id') || '';
    const result = await SalesforceService.listSObjects(envId);
    return c.json({ success: true, data: result }, 200);
  }

  public static async describeSObject(c: Context) {
    const envId = c.req.param('id') || '';
    const sobject = c.req.param('sobject') || '';
    const schema = await SalesforceService.describeSObject(envId, sobject);
    return c.json({ success: true, data: schema }, 200);
  }

  public static async executeQuery(c: Context) {
    const envId = c.req.param('id') || '';
    const body = await c.req.json();
    const queryResult = await SalesforceService.executeQuery(envId, body.soql);
    return c.json({ success: true, data: queryResult }, 200);
  }

  public static async createRecord(c: Context) {
    const envId = c.req.param('id') || '';
    const sobject = c.req.param('sobject') || '';
    const body = await c.req.json();
    const result = await SalesforceService.createRecord(envId, sobject, body);
    return c.json({ success: true, data: result }, 201);
  }

  public static async retrieveRecord(c: Context) {
    const envId = c.req.param('id') || '';
    const sobject = c.req.param('sobject') || '';
    const recordId = c.req.param('recordId') || '';
    const fields = c.req.query('fields')?.split(',').map(f => f.trim()) || [];
    const record = await SalesforceService.retrieveRecord(envId, sobject, recordId, fields);
    return c.json({ success: true, data: record }, 200);
  }

  public static async updateRecord(c: Context) {
    const envId = c.req.param('id') || '';
    const sobject = c.req.param('sobject') || '';
    const recordId = c.req.param('recordId') || '';
    const body = await c.req.json();
    const result = await SalesforceService.updateRecord(envId, sobject, recordId, body);
    return c.json({ success: true, data: result }, 200);
  }

  public static async deleteRecord(c: Context) {
    const envId = c.req.param('id') || '';
    const sobject = c.req.param('sobject') || '';
    const recordId = c.req.param('recordId') || '';
    const result = await SalesforceService.deleteRecord(envId, sobject, recordId);
    return c.json({ success: true, data: result }, 200);
  }
}
