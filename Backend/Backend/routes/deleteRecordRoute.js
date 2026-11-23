import { Router } from 'express';
import {
    getObjectsForDeleteRecord,
    getLookupForDeleteRecord,
    deleteSingleRecord,
    deleteBulkRecords
} from '../controllers/deleteRecordController.js';

const router = Router();

router.get('/objects', getObjectsForDeleteRecord);
router.get('/lookup', getLookupForDeleteRecord);
router.delete('/', deleteSingleRecord);
router.delete('/bulk', deleteBulkRecords);

export default router;