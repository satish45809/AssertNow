import createRecordModel from '../models/recordModel.js';

// GET /api/salesforce/create-record/objects
export const getObjectsForCreateRecord = async (req, res) => {
    try {
        const objects = await createRecordModel.getCreateableObjects();

        return res.status(200).json({
            success: true,
            objects
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to load Salesforce objects.',
            error: error?.response?.data || error?.message || error
        });
    }
};

// GET /api/salesforce/create-record/fields?sobject=Opportunity
export const getFieldsBySelectedObject = async (req, res) => {
    const { sobject } = req.query;

    if (!sobject || typeof sobject !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Query parameter "sobject" is required (e.g., ?sobject=Account).'
        });
    }

    try {
        const data = await createRecordModel.getFieldsByObject(sobject.trim());

        return res.status(200).json({
            success: true,
            ...data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Failed to load fields for ${sobject}.`,
            error: error?.response?.data || error?.message || error
        });
    }
};

// GET /api/salesforce/create-record/lookup?sobject=Account&search=Acme&limit=50
export const getLookupRecords = async (req, res) => {
    const { sobject, search, limit } = req.query;

    if (!sobject || typeof sobject !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Query parameter "sobject" is required (e.g., ?sobject=Account).'
        });
    }

    try {
        const records = await createRecordModel.getLookupRecords(sobject.trim(), search, limit);

        return res.status(200).json({
            success: true,
            sobject: sobject.trim(),
            records
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Failed to load lookup records for ${sobject}.`,
            error: error?.response?.data || error?.message || error
        });
    }
};

// GET /api/salesforce/create-record/variables
export const getFlowVariables = (req, res) => {
    const data = createRecordModel.getAvailableVariables();
    return res.status(200).json({
        success: true,
        ...data
    });
};

// POST /api/salesforce/create-record/reset-context
export const resetFlowVariables = (req, res) => {
    createRecordModel.resetFlowContext();
    return res.status(200).json({
        success: true,
        message: 'Flow context reset successfully.'
    });
};

// POST /api/salesforce/create-record/execute-flow
export const executeCreateFlow = async (req, res) => {
    const { steps } = req.body;

    if (!Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Request body must contain a non-empty "steps" array.'
        });
    }

    try {
        const flowResult = await createRecordModel.executeFlow(steps);
        const statusCode = flowResult.success ? 201 : 400;

        return res.status(statusCode).json(flowResult);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to execute flow.',
            error: error?.response?.data || error?.message || error
        });
    }
};

// POST /api/salesforce/create-record
export const createRecord = async (req, res) => {
    const { sobject, data, stepKey } = req.body;

    if (!sobject || !data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Both "sobject" and non-empty "data" object are required.'
        });
    }

    try {
        const { result, resolvedData, flowContext } = await createRecordModel.createRecordForObject(
            String(sobject).trim(),
            data,
            stepKey
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: `Failed to create ${sobject} record.`,
                errors: result.errors
            });
        }

        return res.status(201).json({
            success: true,
            message: `${sobject} record created successfully.`,
            id: result.id,
            resolvedData,
            flowContext,
            result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Error creating ${sobject} record.`,
            error: error?.response?.data || error?.message || error
        });
    }
};
// POST /api/salesforce/create-record/bulk
// Body: { "sobject": "Quote", "records": [{ "Name": "Q1", "OpportunityId": "006..." }] }
export const createBulkRecords = async (req, res) => {
    const { sobject, records } = req.body;

    if (!sobject || typeof sobject !== 'string') {
        return res.status(400).json({
            success: false,
            message: '"sobject" is required in request body.'
        });
    }

    if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Non-empty "records" array is required.'
        });
    }

    try {
        const results = await createRecordModel.createBulkRecords(sobject.trim(), records);
        const createdIds = results.filter((r) => r.success).map((r) => r.id);

        return res.status(201).json({
            success: true,
            message: `Processed ${results.length} ${sobject} record(s).`,
            createdIds,
            results
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Error creating bulk ${sobject} records.`,
            error: error?.response?.data || error?.message || error
        });
    }
};