const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const { uploadDir } = require('./middlewares/upload');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/media', express.static(uploadDir));

// Register all routes under /lexiflow
app.use('/lexiflow', routes);

module.exports = app;
