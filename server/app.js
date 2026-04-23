'use strict';
const express = require('express');
const cors    = require('cors');

const router       = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');
const { setupCronJobs } = require('./helpers/cronJobs');

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', router);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
    setupCronJobs();
}

module.exports = app;
