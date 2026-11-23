import { Router } from 'express';
import {
    getObjectsForGetRecord,
    getFieldsForGetRecord,
    getSingleRecordById,
    queryRecords
} from '../controllers/getRecordController.js';

const router = Router();

router.get('/objects', getObjectsForGetRecord);
router.get('/fields', getFieldsForGetRecord);
router.get('/:sobject/:id', getSingleRecordById);
router.post('/query', queryRecords);

export default router;