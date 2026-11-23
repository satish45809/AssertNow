import updateRecordModel from '../models/updateRecordModel.js';

// GET /api/salesforce/update-record/objects
export const getObjectsForUpdateRecord = async (req, res) => {
    try {
        const objects = await updateRecordModel.getUpdateableObjects();
        return res.status(200).json({
            success: true,
            objects
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to load updateable Salesforce objects.',
            error: error?.response?.data || error?.message || error
        });
    }
};

// GET /api/salesforce/update-record/fields?sobject=Opportunity
export const getFieldsForUpdateRecord = async (req, res) => {
    const { sobject } = req.query;

    if (!sobject || typeof sobject !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Query parameter "sobject" is required (e.g., ?sobject=Opportunity).'
        });
    }

    try {
        const data = await updateRecordModel.getUpdateableFields(sobject.trim());
        return res.status(200).json({
            success: true,
            ...data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Failed to load updateable fields for ${sobject}.`,
            error: error?.response?.data || error?.message || error
        });
    }
};

// GET /api/salesforce/update-record/lookup?sobject=Opportunity&search=Deal&limit=50
export const getLookupForUpdateRecord = async (req, res) => {
    const { sobject, search, limit } = req.query;

    if (!sobject || typeof sobject !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Query parameter "sobject" is required.'
        });
    }

    try {
        const records = await updateRecordModel.getRecordsForUpdate(sobject.trim(), search, limit);
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

// PATCH /api/salesforce/update-record
// Body: { "sobject": "Opportunity", "recordId": "006...", "data": { "StageName": "Closed Won" } }
export const updateSingleRecord = async (req, res) => {
    const { sobject, recordId, data } = req.body;

    if (!sobject || !recordId || !data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({
            success: false,
            message: '"sobject", "recordId", and "data" object are required.'
        });
    }

    try {
        const result = await updateRecordModel.updateRecordById(
            String(sobject).trim(),
            String(recordId).trim(),
            data
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: `Failed to update ${sobject} record.`,
                errors: result.errors
            });
        }

        return res.status(200).json({
            success: true,
            message: `${sobject} record updated successfully.`,
            id: result.id,
            result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Error updating ${sobject} record.`,
            error: error?.response?.data || error?.message || error
        });
    }
};

// PATCH /api/salesforce/update-record/bulk
// Body: { "sobject": "Opportunity", "records": [{ "Id": "006...", "StageName": "Closed Won" }] }
export const updateBulkRecords = async (req, res) => {
    const { sobject, records } = req.body;

    if (!sobject || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
            success: false,
            message: '"sobject" and non-empty "records" array are required.'
        });
    }

    try {
        const results = await updateRecordModel.updateMultipleRecords(String(sobject).trim(), records);
        return res.status(200).json({
            success: true,
            message: `Processed ${results.length} ${sobject} record(s).`,
            results
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Error updating ${sobject} records.`,
            error: error?.response?.data || error?.message || error
        });
    }
};