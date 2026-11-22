import { Router } from 'express';
import {
    connect,
    getStatus,
    testQuery,
    disconnect
} from '../controllers/controller.js';

const router = Router();

router.post('/connect', connect);
router.get('/status', getStatus);
router.get('/test-query', testQuery);
router.post('/disconnect', disconnect);

export default router;
