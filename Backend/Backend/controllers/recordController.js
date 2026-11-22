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

// GET /api/salesforce/create-record/variables
// Returns available {{account.id}}, {{contact.id}}, {{opportunity.id}} etc.
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

// POST /api/salesforce/create-record
// Body: { "sobject": "Opportunity", "stepKey": "opportunity", "data": { "Name": "Deal 1", "AccountId": "{{account.id}}", "StageName": "Prospecting", "CloseDate": "2026-12-31" } }
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
        const rawMsg = error?.message || (Array.isArray(error) ? error.map(e => e.message).join('; ') : '');
        const finalMessage = rawMsg ? `Salesforce Error: ${rawMsg}` : `Error creating ${sobject} record.`;
        return res.status(500).json({
            success: false,
            message: finalMessage,
            error: error?.response?.data || error?.message || error
        });
    }
};