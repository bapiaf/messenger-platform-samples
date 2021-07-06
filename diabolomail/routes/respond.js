// Use dotenv to read .env vars into Node
require('dotenv').config();

// prepare router
const express = require('express');
const router = express.Router();
const axios = require('axios');

// route POST /respond
// lets users POST (senderPSID, messageText) and sends messageText to the senderPSID on behalf of their FB page

router.post('/', async (req, res) => {
  console.log(req.body);

  // The page access token we have generated in your app settings
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  //instanciate FB Messenger Send API request
  const sendMessage = axios.create({
    baseURL: 'https://graph.facebook.com/v11.0/me/messages',
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
      //Accept: 'application/json',
    },
    params: {
      access_token: PAGE_ACCESS_TOKEN,
    },
  });

  try {
    const response = await sendMessage.post('/', {
      recipient: {
        id: req.body.senderPSID,
      },
      message: {
        text: req.body.messageText,
      },
    });
    console.log('got a response from the send API');
    console.log(response.data);
    res.status(200);
    res.json(response.data);
  } catch (err) {
    console.log('Something went wrong with the Send API');
    console.log(err);
    res
      .status(500)
      .send(
        'Something went wrong with the FB Messenger Send API: ' + err.message
      );
  }
});

module.exports = router;
