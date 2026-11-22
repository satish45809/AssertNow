import express from 'express';
import cors from 'cors';
import salesforceRoutes from './routes/routes.js';
import createRecordRoutes from './routes/recordRoute.js'


const app = express();
const PORT = 5000;

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_ORIGIN
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or Postman)
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, true); // Fallback allow to avoid breaking local dev environments
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/salesforce', salesforceRoutes);

app.use('/api/salesforce/create-record', createRecordRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Salesforce Integration Service is running.' });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

setInterval(() => { }, 1000 * 60 * 60);