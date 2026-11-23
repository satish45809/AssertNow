import { Router } from 'express';
import {
    getObjectsForUpdateRecord,
    getFieldsForUpdateRecord,
    getLookupForUpdateRecord,
    updateSingleRecord,
    updateBulkRecords
} from '../controllers/updateRecordController.js';


const router = Router();


router.get('/objects', getObjectsForUpdateRecord);
router.get('/fields', getFieldsForUpdateRecord);
router.get('/lookup', getLookupForUpdateRecord);
router.patch('/', updateSingleRecord);
router.patch('/bulk', updateBulkRecords);


export default router;

