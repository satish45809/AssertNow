/**
 * Salesforce API Route Definitions (/api/v1/salesforce)
 */

import { Hono } from 'hono';
import { SalesforceController } from '../controllers/SalesforceController.ts';

export const SalesforceRoutes = new Hono();

// Environments / Fleet nodes
SalesforceRoutes.get('/environments', SalesforceController.listEnvironments);
SalesforceRoutes.post('/environments/sync', SalesforceController.syncEnvironments);
SalesforceRoutes.get('/environments/:id', SalesforceController.getEnvironment);
SalesforceRoutes.post('/environments', SalesforceController.createEnvironment);
SalesforceRoutes.patch('/environments/:id', SalesforceController.updateEnvironment);
SalesforceRoutes.delete('/environments/:id', SalesforceController.deleteEnvironment);
SalesforceRoutes.post('/environments/:id/test', SalesforceController.testEnvironment);

// Handshake & Connection verification
SalesforceRoutes.post('/verify', SalesforceController.verifyConnection);
SalesforceRoutes.post('/connect', SalesforceController.verifyConnection);
SalesforceRoutes.post('/oauth/exchange', SalesforceController.exchangeAuthCode);
SalesforceRoutes.get('/test-query', SalesforceController.testQuery);

// Dynamic Metadata Describe & SOQL
SalesforceRoutes.get('/environments/:id/sobjects', SalesforceController.listSObjects);
SalesforceRoutes.get('/environments/:id/describe/:sobject', SalesforceController.describeSObject);
SalesforceRoutes.post('/environments/:id/query', SalesforceController.executeQuery);

// SObject CRUD Operations
SalesforceRoutes.post('/environments/:id/sobjects/:sobject', SalesforceController.createRecord);
SalesforceRoutes.get('/environments/:id/sobjects/:sobject/:recordId', SalesforceController.retrieveRecord);
SalesforceRoutes.patch('/environments/:id/sobjects/:sobject/:recordId', SalesforceController.updateRecord);
SalesforceRoutes.delete('/environments/:id/sobjects/:sobject/:recordId', SalesforceController.deleteRecord);


