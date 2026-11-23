import deleteRecordModel from '../models/deleteRecordModel.js';


// GET /api/salesforce/delete-record/objects
export const getObjectsForDeleteRecord = async (req, res) => {
    try {
        const objects = await deleteRecordModel.getDeletableObjects();
        return res.status(200).json({
            success: true,
            objects
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to load deletable Salesforce objects.',
            error: error?.response?.data || error?.message || error
        });
    }
};


// GET /api/salesforce/delete-record/lookup?sobject=Opportunity&search=Test&limit=50
export const getLookupForDeleteRecord = async (req, res) => {
    const { sobject, search, limit } = req.query;


    if (!sobject || typeof sobject !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Query parameter "sobject" is required.'
        });
    }


    try {
        const records = await deleteRecordModel.getRecordsForDelete(sobject.trim(), search, limit);
        return res.status(200).json({
            success: true,
            sobject: sobject.trim(),
            records
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Failed to load records for ${sobject}.`,
            error: error?.response?.data || error?.message || error
        });
    }
};


// DELETE /api/salesforce/delete-record
// Body: { "sobject": "Opportunity", "recordId": "006..." }
export const deleteSingleRecord = async (req, res) => {
    const { sobject, recordId } = req.body;

    if (!sobject || !recordId) {
        return res.status(400).json({
            success: false,
            message: '"sobject" and "recordId" are required.'
        });
    }

    try {
        const result = await deleteRecordModel.deleteRecordById(
            String(sobject).trim(),
            String(recordId).trim()
        );

        if (!result.success) {
            const firstErr = Array.isArray(result.errors) && result.errors.length > 0 ? result.errors[0] : null;
            const errMsg = firstErr?.message || (typeof firstErr === 'string' ? firstErr : `Failed to delete ${sobject} record.`);
            return res.status(400).json({
                success: false,
                message: errMsg,
                errors: result.errors
            });
        }

        return res.status(200).json({
            success: true,
            message: `${sobject} record deleted successfully.`,
            id: result.id,
            result
        });
    } catch (error) {
        const detailMsg = error?.message || error?.response?.data?.[0]?.message || error?.response?.data?.message || (typeof error === 'string' ? error : '');
        return res.status(500).json({
            success: false,
            message: detailMsg ? `Error deleting ${sobject} record (${recordId}): ${detailMsg}` : `Error deleting ${sobject} record.`,
            error: error?.response?.data || error?.message || error
        });
    }
};

// DELETE /api/salesforce/delete-record/bulk
// Body: { "sobject": "Opportunity", "ids": ["006A...", "006B..."] }
export const deleteBulkRecords = async (req, res) => {
    const { sobject, ids } = req.body;

    if (!sobject || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
            success: false,
            message: '"sobject" and non-empty "ids" array are required.'
        });
    }

    try {
        const results = await deleteRecordModel.deleteMultipleRecords(String(sobject).trim(), ids);
        const failedResult = results.find(r => r && !r.success);
        if (failedResult && results.every(r => !r.success)) {
            const firstErr = Array.isArray(failedResult.errors) && failedResult.errors.length > 0 ? failedResult.errors[0] : null;
            const errMsg = firstErr?.message || `Failed to delete ${sobject} records.`;
            return res.status(400).json({
                success: false,
                message: errMsg,
                results
            });
        }
        return res.status(200).json({
            success: true,
            message: `Processed ${results.length} ${sobject} record deletion(s).`,
            results
        });
    } catch (error) {
        const detailMsg = error?.message || error?.response?.data?.[0]?.message || error?.response?.data?.message || '';
        return res.status(500).json({
            success: false,
            message: detailMsg ? `Error deleting ${sobject} records: ${detailMsg}` : `Error deleting ${sobject} records.`,
            error: error?.response?.data || error?.message || error
        });
    }
};

