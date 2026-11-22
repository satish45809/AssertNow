import { Router } from 'express';
import {
    getObjectsForCreateRecord,
    getFieldsBySelectedObject,
    getFlowVariables,
    resetFlowVariables,
    createRecord
} from '../controllers/recordController.js';

const router = Router();

router.get('/objects', getObjectsForCreateRecord);
router.get('/fields', getFieldsBySelectedObject);
router.get('/variables', getFlowVariables);
router.post('/reset-context', resetFlowVariables);
router.post('/', createRecord);

export default router;