import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import salesforceRoutes from './routes/routes.js';
import createRecordRoutes from './routes/recordRoute.js';
import getRecordRoutes from './routes/getRecordRoutes.js';
import updateRecordRoutes from './routes/updateRecordRoutes.js';
import deleteRecordRoutes from './routes/deleteRecordRoute.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', `http://localhost:${PORT}`],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/api/salesforce', salesforceRoutes);


app.use('/api/salesforce/create-record', createRecordRoutes);


app.use('/api/salesforce/get-record', getRecordRoutes);


app.use('/api/salesforce/update-record', updateRecordRoutes);


app.use('/api/salesforce/delete-record', deleteRecordRoutes);


app.get('/', (req, res) => {
    res.json({ message: 'Salesforce Integration Service is running.' });
});


app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});


setInterval(() => { }, 1000 * 60 * 60);

