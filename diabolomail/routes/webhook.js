// Use dotenv to read .env vars into Node
require('dotenv').config();

// prepare router
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Adds support for GET requests to our webhook
router.get('/', (req, res) => {
  // Your verify token. Should be a random string.
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Creates the endpoint for the webhook which FB Messenger will call.
router.post('/', (req, res) => {
  let body = req.body;

  // Checks if this is an event from a page subscription
  if (body.object === 'page') {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // Gets the body of the webhook event
      let webhookEvent = entry.messaging[0];
      console.log(webhookEvent);

      // Get the sender PSID
      let senderPsid = webhookEvent.sender.id;
      console.log('Sender PSID: ' + senderPsid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhookEvent.message) {
        handleMessage(senderPsid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        handlePostback(senderPsid, webhookEvent.postback);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Handles messages events
async function handleMessage(senderPsid, receivedMessage) {
  let response;
  let inboundEmail;

  // Checks if the message contains text
  if (receivedMessage.text) {
    if (receivedMessage.quick_reply == null) {
      // Create the payload for a basic text message, which
      // will be added to the body of your request to the Send API
      response = {
        text: `You sent the message: '${receivedMessage.text}'. We have forwarded it to Diabolocom as an inbound email. Was that a good idea?`,
        quick_replies: [
          {
            content_type: 'text',
            title: 'You bet!',
            payload: 'youBet',
            image_url:
              'https://s1.edi-static.fr/Img/LivreBlanc/Partner/490364/Logo/diabolocom-Logo.png',
          },
          {
            content_type: 'text',
            title: 'No!',
            payload: 'no!',
            image_url:
              'https://us.123rf.com/450wm/aquir/aquir2002/aquir200207561/139846330-no-thanks-stamp-no-thanks-round-vintage-grunge-sign-no-thanks.jpg?ver=6',
          },
        ],
      };
      console.log(response);

      inboundEmail = {
        from: `'${senderPsid}@facebook.com'`,
        body: receivedMessage.text,
        subject: 'FB Messenger from:',
        to: 'edmee.marazel+ux@diabolocom.com',
      };
      console.log(inboundEmail);
    } else {
      let payload = receivedMessage.quick_reply.payload;

      if (payload == 'youBet') {
        response = {
          text: `Great! Now try sending us an attachment`,
        };
      }

      if (payload == 'no!') {
        response = {
          text: `Sorry about that.`,
        };
      }
    }
  }

  if (receivedMessage.attachments) {
    // Get the URL of the message attachment
    let attachmentUrl = receivedMessage.attachments[0].payload.url;
    response = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [
            {
              title: 'Is this the right picture?',
              subtitle: 'Tap a button to answer.',
              image_url: attachmentUrl,
              buttons: [
                {
                  type: 'postback',
                  title: 'Yes!',
                  payload: 'yes',
                },
                {
                  type: 'postback',
                  title: 'No!',
                  payload: 'no',
                },
              ],
            },
          ],
        },
      },
    };
  }

  try {
    // get the sender's profile
    console.log('got a profile for the sender');
    const profile = await getUserProfile(senderPsid);
    console.log(profile);

    // Forward to Diabolocom as inbound email
    console.log('there is an email to send to Diabolocom');
    if (inboundEmail) {
      inboundEmail.body =
        inboundEmail.body +
        ' this was sent by: ' +
        profile.first_name +
        ' ' +
        profile.last_name +
        ' ' +
        profile.profile_pic;
      inboundEmail.subject =
        inboundEmail.subject +
        ' ' +
        profile.first_name +
        ' ' +
        profile.last_name;
      const sentInboundEmail = await sendInboundEmail(inboundEmail);
      console.log(sentInboundEmail);
    }

    // Send the FB Messenger response message
    console.log(
      'there is a response to the message to make through the Send API'
    );
    const messengerResponse = await callSendAPI(senderPsid, response);
    console.log(messengerResponse);
  } catch (err) {
    console.log('Couille in the potage');
    console.log(err);
  }
}

// Handles messaging_postbacks events
async function handlePostback(senderPsid, receivedPostback) {
  let response;

  // Get the payload for the postback
  let payload = receivedPostback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { text: 'Thanks!' };
  } else if (payload === 'no') {
    response = { text: 'Oops, try sending another image.' };
  }

  try {
    // Send the FB Messenger response message
    console.log(
      'there is a response to the postback to make through the Send API'
    );
    const messengerResponse = await callSendAPI(senderPsid, response);
    console.log(messengerResponse);
  } catch (err) {
    console.log('Couille in the potage');
    console.log(err);
  }
}

// Sends response messages via the FB Messenger Send API
async function callSendAPI(senderPsid, response) {
  // The page access token we have generated in your app settings
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  // Construct the message body
  let requestBody = {
    recipient: {
      id: senderPsid,
    },
    message: response,
  };

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
    const response = await sendMessage.post('/', requestBody);
    console.log('got a response from the FB Send API');
    console.log(response.data);
    return response.data;
  } catch (err) {
    console.log('Damn, issue with the FB Send API');
    console.log(err);
  }
}

// Send inbound email via the Diabolocom API
async function sendInboundEmail(inboundEmail) {
  console.log('preparing inbound email API request');

  //instanciate Diabolocom API request

  const diabolocomDomain = process.env.DIABOLOCOM_DOMAIN;
  const diabolocomToken = process.env.DIABOLOCOM_TOKEN;

  const diabolocom = axios.create({
    baseURL: diabolocomDomain + '/api/v1',
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
      //Accept: 'application/json',
      'Private-Token': diabolocomToken,
    },
  });

  try {
    const response = await diabolocom.post('/email/inboundemail', inboundEmail);
    console.log(response.data);
    return response.data;
  } catch (err) {
    console.log('Damn, issue with the Diabolocom inboundemail API');
    console.log(err);
  }
}

// Get the complete FB user profile from the PSID
async function getUserProfile(senderPsid) {
  console.log('trying to get the profile for PSID: ' + senderPsid);

  // The page access token we have generated in your app settings
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  //instanciate FB Messenger Profile API request

  const profile = axios.create({
    baseURL: 'https://graph.facebook.com',
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
      //Accept: 'application/json',
    },
    params: {
      access_token: PAGE_ACCESS_TOKEN,
      fields: 'first_name, last_name, profile_pic, gender',
    },
  });

  try {
    const response = await profile.get('/' + senderPsid);
    console.log('got a profile response');
    console.log(response.data);
    return response.data;
  } catch (err) {
    console.log('Damn, issur with the FB Profile API');
    console.log(err);
  }
}

module.exports = router;
