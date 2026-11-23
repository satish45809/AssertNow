import { Router } from 'express';
import {
    getObjectsForCreateRecord,
    getFieldsBySelectedObject,
    getLookupRecords,
    getFlowVariables,
    resetFlowVariables,
    executeCreateFlow,
    createRecord,
    createBulkRecords
} from '../controllers/recordController.js';

const router = Router();

router.get('/objects', getObjectsForCreateRecord);
router.get('/fields', getFieldsBySelectedObject);
router.get('/lookup', getLookupRecords);
router.get('/variables', getFlowVariables);
router.post('/reset-context', resetFlowVariables);
router.post('/execute-flow', executeCreateFlow);
router.post('/', createRecord);
router.post('/bulk', createBulkRecords);
export default router;