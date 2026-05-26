const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const { uploadDir } = require('./middlewares/upload');
const env = require('./config/env');

const app = express();

app.use((req, res, next) => {
    console.log(`[${req.method}] request to ${req.url} from origin: ${req.headers.origin}`);
    next();
});

const corsOptions = {
    origin: [
        env.FRONTEND_URL ? env.FRONTEND_URL.trim() : '',
        'https://lexiflow.amerai.top',
        'http://localhost:4555',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
};

// Apply CORS middleware BEFORE your routes
app.use(cors(corsOptions));
app.use(express.json());
app.use('/media', express.static(uploadDir));

// Register all routes under /lexiflow
app.use('/lexiflow', routes);

module.exports = app;
