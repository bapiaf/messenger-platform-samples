'use strict';

// Use dotenv to read .env vars into Node
require('dotenv').config();
console.log(process.env.PORT);
console.log(process.env.VERIFY_TOKEN);
console.log(process.env.PAGE_ACCESS_TOKEN);
console.log(process.env.DIABOLOCOM_DOMAIN);
console.log(process.env.DIABOLOCOM_TOKEN);

// Imports dependencies and set up http server
const request = require('request'),
  { urlencoded, json } = require('body-parser');
const express = require('express');
const app = express();

// Parse application/x-www-form-urlencoded
app.use(urlencoded({ extended: true }));

// Parse application/json
app.use(json());

// Respond with 'Hello World' when a GET request is made to the homepage
app.get('/', function (_req, res) {
  res.send('Diabolcom Facebook Integration running');
});

// Define Routes
app.use('/webhook', require('./routes/webhook'));
//app.use('/respond', require ('./routes/respond'));

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
