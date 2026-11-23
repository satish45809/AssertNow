import { Router } from 'express';
import {
connect,
    getStatus,
    testQuery,
    disconnect,
    saveWorkflow,
    listWorkflows,
    getWorkflowById,
    deleteWorkflow,
    createTestLog,
    completeTestLog,
    getTestLogs
} from '../controllers/controller.js';
    
const router = Router();

// Salesforce Connection & Token Routes
router.post('/connect', connect);
router.get('/status', getStatus);
router.get('/test-query', testQuery);
router.post('/disconnect', disconnect);

// Workflows Persistence Routes (/api/salesforce/workflows)
router.post('/workflows', saveWorkflow);
router.get('/workflows', listWorkflows);
router.get('/workflows/:id', getWorkflowById);
router.delete('/workflows/:id', deleteWorkflow);

// Workflow Test Logs Routes (/api/salesforce/test-logs)
router.get('/test-logs', getTestLogs);
router.post('/test-logs', createTestLog);
router.patch('/test-logs/:logId', completeTestLog);

export default router;