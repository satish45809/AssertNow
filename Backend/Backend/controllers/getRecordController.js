import getRecordModel from '../models/getRecordModel.js';


// GET /api/salesforce/get-record/objects
export const getObjectsForGetRecord = async (req, res) => {
    try {
        const objects = await getRecordModel.getQueryableObjects();
        return res.status(200).json({
            success: true,
            objects
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to load queryable Salesforce objects.',
            error: error?.response?.data || error?.message || error
        });
    }
};


// GET /api/salesforce/get-record/fields?sobject=Account
export const getFieldsForGetRecord = async (req, res) => {
    const { sobject } = req.query;


    if (!sobject || typeof sobject !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Query parameter "sobject" is required (e.g., ?sobject=Account).'
        });
    }


    try {
        const data = await getRecordModel.getQueryableFields(sobject.trim());
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


// GET /api/salesforce/get-record/:sobject/:id?fields=Id,Name,Industry
export const getSingleRecordById = async (req, res) => {
    const { sobject, id } = req.params;
    const { fields } = req.query;


    try {
        const fieldList = typeof fields === 'string' && fields.trim()
            ? fields.split(',').map((f) => f.trim()).filter(Boolean)
            : [];


        const record = await getRecordModel.getRecordById(sobject.trim(), id.trim(), fieldList);


        if (!record) {
            return res.status(404).json({
                success: false,
                message: `${sobject} record with Id "${id}" not found.`
            });
        }


        return res.status(200).json({
            success: true,
            sobject: sobject.trim(),
            record
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Failed to fetch ${sobject} record.`,
            error: error?.response?.data || error?.message || error
        });
    }
};


// POST /api/salesforce/get-record/query
export const queryRecords = async (req, res) => {
    const {
        sobject,
        fields,
        filters,
        filterLogic,
        orderBy,
        sortDirection,
        limit,
        onlyFirstRecord
    } = req.body;


    if (!sobject || typeof sobject !== 'string') {
        return res.status(400).json({
            success: false,
            message: '"sobject" is required in request body.'
        });
    }


    try {
        const result = await getRecordModel.queryRecords({
            sobject: sobject.trim(),
            fields,
            filters,
            filterLogic,
            orderBy,
            sortDirection,
            limit,
            onlyFirstRecord
        });


        return res.status(200).json({
            success: true,
            sobject: sobject.trim(),
            ...result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Failed to query ${sobject} records.`,
            error: error?.response?.data || error?.message || error
        });
    }
};

