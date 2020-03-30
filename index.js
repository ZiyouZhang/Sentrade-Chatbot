'use strict';

// Imports dependencies and set up http server
const
  PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN,
  MYSQL_PASSWORD = '<your mysql database password>',
  VERIFY_TOKEN = process.env.VERIFY_TOKEN,
  express = require('express'),
  bodyParser = require('body-parser'),
  app = express().use(bodyParser.json()), // creates express http server
  request = require('request'),
  port = 1014,
  template = require('./responseTemplates.js'),
  mysql = require('mysql')

var
  NEWS_COUNT = template.news.length;

// Inspect the tokens
console.log(process.env.PAGE_ACCESS_TOKEN)
console.log(process.env.VERIFY_TOKEN)

// Sets server port and logs message on success
app.listen(process.env.PORT || port, () => console.log('webhook is listening'));

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
    let body = req.body;
  
    // Checks this is an event from a page subscription
    if (body.object === 'page') {
  
      // Iterates over each entry - there may be multiple if batched
      body.entry.forEach(function(entry) {
  
        // Gets the message. entry.messaging is an array, but 
        // will only ever contain one message, so we get index 0
        let webhook_event = entry.messaging[0];
        console.log(webhook_event);

        // Get the sender PSID
        let sender_psid = webhook_event.sender.id;
        console.log('Sender PSID: ' + sender_psid);

        // Check if the event is a message or postback and
        // pass the event to the appropriate handler function
        if (webhook_event.message) {
          handleMessage(sender_psid, webhook_event.message);        
        } else if (webhook_event.postback) {
          handlePostback(sender_psid, webhook_event.postback);
        }

      });
  
      // Returns a '200 OK' response to all requests
      res.status(200).send('EVENT_RECEIVED');
    } else {
      // Returns a '404 Not Found' if event is not from a page subscription
      res.sendStatus(404);
    }
  
  });

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

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

// Handles messages events
function handleMessage(sender_psid, received_message) {

  let response;

  // Check if the message contains text
  if (received_message.text) {    

    // Create the payload for a basic text message
    response = template.sendQuestion(Math.floor(Math.random() * NEWS_COUNT));
    console.log(response)
    // response = {"text" : "The tweet\n" + "Facebook has some funny memes yall are missing out on them" + "\nhas been identified as neutrual. Do you think it's correct?"};
  }  
  
  // Sends the response message
  callSendAPI(sender_psid, response);    
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = template.sendQuestion(Math.floor(Math.random() * NEWS_COUNT));
  } else if (payload === 'no') {
    response = template.sendQuestion(Math.floor(Math.random() * NEWS_COUNT));
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v6.0/me/messages",
    "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log(sender_psid + ' message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

// Indicating the bot is tryping
function showTyping(sender_psid){
  request({
      "uri": "https://graph.facebook.com/v6.0/me/messages",
      "qs": { "access_token": PAGE_ACCESS_TOKEN },
      "method": "POST",
      "json": {
          "recipient": {
              "id": sender_psid
          },
          "sender_action":"typing_on"
      }
  }, (err, res, body) => {
      if (!err) {
          // console.log('typing sent!')
      }
      else {
          console.log(new Date());
          console.error("Unable to send message:" + err);
      }
  });
}

// Indicating the message has been seen
function markSeen(sender_psid){
  request({
      "uri": "https://graph.facebook.com/v6.0/me/messages",
      "qs": { "access_token": PAGE_ACCESS_TOKEN },
      "method": "POST",
      "json": {
          "recipient": {
              "id": sender_psid
          },
          "sender_action":"mark_seen"
      }
  }, (err, res, body) => {
      if (!err) {
          // console.log('typing sent!')
      }
      else {
          console.log(new Date());
          console.error("Unable to send message:" + err);
      }
  });
}

// Register new user. Triggered by typing "get started" or press get started button
function registerUser(sender_psid, mysql_pool){

  let time_now = new Date;

  let joining_date = "\"" + time_now.getFullYear().toString() + "-"
      + (time_now.getMonth() + 1).toString()
      + "-" + time_now.getDate().toString()
      + " " + time_now.getHours().toString()
      + ":" + time_now.getMinutes().toString()
      + ":" + time_now.getSeconds().toString() + "\"";

  let date_last_active = "\"" + time_now.getFullYear().toString() + "-"
      + (time_now.getMonth() + 1).toString()
      + "-" + time_now.getDate().toString()
      + "\"";

  // Request user's time zone. If error set time zone to be 1 and the name to be "error user"
  request( "https://graph.facebook.com/" + sender_psid + "?fields=name,timezone&access_token=" + PAGE_ACCESS_TOKEN, function (error, response, body) {

      if (!error) {

          // Parse time zone. Response.body is a string
          let user_timezone = JSON.parse(response.body).timezone;
          let user_name = JSON.parse(response.body).name;

          // Handle "no user name" or "no time zone" issue
          if (!user_name) {
              user_name = "Messenger-only User";
          }

          if (!user_timezone) {
              user_timezone = 0;
          }

          pool.getConnection(function (error, connection) {
              if (error) throw error;

              // Check if the user is a returning user
              connection.query('SELECT EXISTS (SELECT 1 FROM users WHERE user_id = ' + sender_psid + ') AS returningUserCheck', function (error, results, fields) {

                  // If is returning user, get the times remaining. Otherwise create user, create user question table, and then read nums left
                  if (error) throw error;

                  if (results[0].returningUserCheck) {

                      // Update last active date
                      pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                          if (error) throw error;
                      });

                      connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                          if (error) throw error;

                          // Send the response card
                          if (results[0].nums_left == -1) {
                              callSendAPI(sender_psid, template.parseStartCardResponse(0));
                          } else {
                              callSendAPI(sender_psid, template.parseStartCardResponse(results[0].nums_left));
                          }

                          connection.release();
                      });
                  }
                  else {
                      // Get current date and parse it for writing into the databass

                      connection.query('INSERT INTO users (user_id, name, nums_left, time_zone, new_conversation_count, positive_count, negative_count, skipped_count, active_days, joining_date, date_last_active) VALUES (' + sender_psid + ', \"' + user_name +'\", 5, ' + user_timezone +', 0, 0, 0, 0, 0, ' + joining_date + ', ' + date_last_active + ')', function (error, results, fields) {
                          if (error) throw error;
                          connection.query('CREATE TABLE u' + sender_psid + ' (question_id SMALLINT(4), content VARCHAR(80), primary_topic VARCHAR(40))', function (error, results, fields) {
                              if (error) throw error;
                              connection.query('LOAD DATA INFILE \'/var/lib/mysql-files/question_pool_v2.csv\' INTO TABLE u' + sender_psid +  ' FIELDS TERMINATED BY \',\'  ENCLOSED BY \'"\' LINES TERMINATED BY \'\\r\\n\'', function (error, results, fields) {
                                  if (error) throw error;
                                  connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                                      if (error) throw error;

                                      // Send the response card
                                      callSendAPI(sender_psid, template.parseStartCardResponse(results[0].nums_left));

                                      connection.release();
                                  });
                              });
                          });
                      });
                  }
              });
          });
      }

      else {

          console.log(error);

          // Parse time zone. Response.body is a string
          let user_timezone = 0;
          let user_name = "Error User";

          pool.getConnection(function (error, connection) {
              if (error) throw error;

              // Check if the user is a returning user
              connection.query('SELECT EXISTS (SELECT 1 FROM users WHERE user_id = ' + sender_psid + ') AS returningUserCheck', function (error, results, fields) {

                  // If is returning user, get the times remaining. Otherwise create user, create user question table, and then read nums left.
                  if (error) throw error;

                  if (results[0].returningUserCheck) {

                      // Update last active date
                      pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                          if (error) throw error;
                      });

                      connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                          if (error) throw error;

                          // Send the response card
                          if (results[0].nums_left == -1) {
                              callSendAPI(sender_psid, template.parseStartCardResponse(0));
                          } else {
                              callSendAPI(sender_psid, template.parseStartCardResponse(results[0].nums_left));
                          }

                          connection.release();
                      });
                  }
                  else {

                      connection.query('INSERT INTO users (user_id, name, nums_left, time_zone, new_conversation_count, positive_count, negative_count, skipped_count, active_days, joining_date, date_last_active) VALUES (' + sender_psid + ', \"' + user_name +'\", 5, ' + user_timezone +', 0, 0, 0, 0, 0, ' + joining_date + ', ' + date_last_active + ')', function (error, results, fields) {
                          if (error) throw error;
                          connection.query('CREATE TABLE u' + sender_psid + ' (question_id SMALLINT(4), content VARCHAR(80), primary_topic VARCHAR(40))', function (error, results, fields) {
                              if (error) throw error;
                              connection.query('LOAD DATA INFILE \'/var/lib/mysql-files/question_pool_v2.csv\' INTO TABLE u' + sender_psid +  ' FIELDS TERMINATED BY \',\'  ENCLOSED BY \'"\' LINES TERMINATED BY \'\\r\\n\'', function (error, results, fields) {
                                  if (error) throw error;
                                  connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                                      if (error) throw error;

                                      // Send the response card
                                      callSendAPI(sender_psid, template.parseStartCardResponse(results[0].nums_left));

                                      connection.release();
                                  });
                              });
                          });
                      });
                  }
              });
          })
      }
  });
}