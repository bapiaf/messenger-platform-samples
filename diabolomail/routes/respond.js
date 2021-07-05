// Use dotenv to read .env vars into Node
require('dotenv').config();

// prepare router
const express = require('express');
const router = express.Router();
const axios = require('axios');
