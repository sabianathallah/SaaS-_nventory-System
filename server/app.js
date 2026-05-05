'use strict';
const express = require('express');
const cors    = require('cors');

const router       = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');
const { setupCronJobs } = require('./helpers/cronJobs');

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
            return callback(null, true);
        }
        if (/^https?:\/\/(www\.)?prefacesystem\.com$/.test(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
}));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', router);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
    setupCronJobs();
}

module.exports = app;
