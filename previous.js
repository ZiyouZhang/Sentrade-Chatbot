'use strict';

// Imports dependencies and set up http server
const
    PAGE_ACCESS_TOKEN = '<your page access token>',
    MYSQL_PASSWORD = '<your mysql database password>',
    WEBHOOK_VERIFY_TOKEN = '<your webhook verify token>',

    express = require('express'),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json()), // creates express http server
    request = require('request'),
    port = 1014,
    cards = require('./responseTemplates.js'),
    mysql = require('mysql'),
    schedule = require('node-schedule');

var pool = mysql.createPool({
    connectionLimit : 100,
    host : 'localhost',
    user: 'root',
    password: MYSQL_PASSWORD,
    database: 'eros_db'
});

// Perform database update task every hour at 2nd minute
schedule.scheduleJob('1 * * * *', function(){
    var hours = (new Date()).getHours();
    let timezone;
    if (hours < 12) {
        timezone = 0 - hours;
        pool.query('UPDATE users SET nums_left = 5 WHERE time_zone = ' + timezone, function (error, results, fields) {if (error) throw error;});
    }
    else {
        timezone = 24 - hours;
        pool.query('UPDATE users SET nums_left = 5 WHERE time_zone = ' + timezone, function (error, results, fields) {if (error) throw error;});
    }
  });

// Sets server port and logs message on success
app.listen(port, () => console.log('webhook is listening on:' + port));

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

            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function

            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            }
            else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }

        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    }
    else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = WEBHOOK_VERIFY_TOKEN;

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

        }
        else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

// Handles messages events
// Falls into 3 cases:
// If contains quick reply: Let the user choose the feedback, and give corresponding response
// If message is "Get started": Add the user to the database
// Else: Check if the text_auto_switch is on or off, send message if it's on
function handleMessage(sender_psid, received_message) {

    var date_now = new Date();

    var date_last_active = "\"" + date_now.getFullYear().toString() + "-"
        + (date_now.getMonth() + 1).toString()
        + "-" + date_now.getDate().toString()
        + "\"";

    // Handle the response from quick reply
    if (received_message.quick_reply){

        // Indicate typing
        showTyping(sender_psid);

        // Update last active date
        pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
            if (error) throw error;
        });

        // Check the payload and give corresponding reply.
        switch (received_message.quick_reply.payload){

            case "donepositivefeedback":

                pool.query('UPDATE users SET positive_count = positive_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, cards.doneForNowCard);

                break;

            case "donenegativefeedback":

                pool.query('UPDATE users SET negative_count = negative_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, cards.doneForNowCard);

                break;

            case "doneskippedfeedback":

                pool.query('UPDATE users SET skipped_count = skipped_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, cards.doneForNowCard);

                break;

            case "nextpositivefeedback":

                pool.query('UPDATE users SET positive_count = positive_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, {"text": "Please choose a topic or go \"wildcard\" if you are up for anything:"});
                callSendAPI(sender_psid, cards.chooseTopicCard);

                break;

            case "nextnegativefeedback":

                pool.query('UPDATE users SET negative_count =  negative_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, {"text": "Please choose a topic or go \"wildcard\" if you are up for anything:"});
                callSendAPI(sender_psid, cards.chooseTopicCard);

                break;

            case "nextskippedfeedback":

                pool.query('UPDATE users SET skipped_count = skipped_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, {"text": "Please choose a topic or go \"wildcard\" if you are up for anything:"});
                callSendAPI(sender_psid, cards.chooseTopicCard);

                break;

            case "nextlastpositivefeedback":

                pool.query('UPDATE users SET positive_count = positive_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, cards.endForNowCard);

                break;

            case "nextlastnegativefeedback":

                pool.query('UPDATE users SET negative_count =  negative_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, cards.endForNowCard);

                break;

            case "nextlastskippedfeedback":

                pool.query('UPDATE users SET skipped_count = skipped_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                });

                callSendAPI(sender_psid, cards.endForNowCard);

                break;
        }
    }

    // Handles different forms of "get started"
    else if (received_message.text == "Get Started" || received_message.text == "get started" || received_message.text == "Get started") {

        // Indicate typing
        showTyping(sender_psid);

        // Register the user into the database
        registerUser(sender_psid, pool)
    }

    else {

        // Update last active date
        pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
            if (error) throw error;
        });

        // Check if need to auto reply the user. If so tell the user to stick with the buttons
        pool.query('SELECT text_auto_reply_switch FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
            if (error) throw error;

            if (results[0].text_auto_reply_switch) {

                // Indicate typing
                showTyping(sender_psid);

                setTimeout(()=>{
                    callSendAPI(sender_psid, {"text": "I\'m sorry, but I\'m not a smart bot! Please click one of the buttons in our thread, type \"Get started\" if this is a new chat, or email us to speak directly. Thanks!"});
                }, 0);

            }
            else {
                // markSeen(sender_psid);
            }
        });

    }
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

    // Indicate typing
    showTyping(sender_psid);

    let response;

    // Get the payload for the postback
    let payload = received_postback.payload;

    var date_now = new Date();

    var date_last_active = "\"" + date_now.getFullYear().toString() + "-"
        + (date_now.getMonth() + 1).toString()
        + "-" + date_now.getDate().toString()
        + "\"";

    // Parse and set response based on the postback payload
    switch (payload) {
        
        case "start" :

            // Register the user into the database
            registerUser(sender_psid, pool)
            break;
        
        case "choosetopicguide":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            // Check if reached max time
            pool.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw (error);
                if (results[0].nums_left <= 0) {
                    callSendAPI(sender_psid, cards.endForNowCard)
                }
                else {
                    callSendAPI(sender_psid, {"text": "Great! For each question, take time to reflect separately before answering, respect each other’s boundaries, and give each other your full attention if you choose to share. Enjoy learning something new about your partner!"});

                    setTimeout(() => {
                        callSendAPI(sender_psid, {"text": "Please choose a topic or go \"wildcard\" if you are up for anything:"})
                    }, 500);

                    setTimeout(() => {
                        callSendAPI(sender_psid, cards.chooseTopicCard)
                    }, 400);

                }
            });
            break;

        case "end":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            // Check if reached max time and then send the response card
            pool.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;

                if (results[0].nums_left <= 0) {
                    callSendAPI(sender_psid, cards.endForNowCard);
                }
                else {
                    callSendAPI(sender_psid, cards.endCard);
                }
            });
            break;

        case "wildcard":
            // Check if reached max time: get nums_left from user db
            // Random get from user question_pool
            // Write last seen and reduce count by one: write to user db
            // Delete this card from db: write to question_pool
            // Send the card

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            pool.getConnection(function (error, connection) {
                if (error) throw error;

                // Check if reached max time and get numbers left
                connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                    if (results[0].nums_left <= 0) {
                        callSendAPI(sender_psid, cards.endForNowCard);
                        connection.release();
                    }
                    else {
                        // Check the randomly generated topic. Handle if null is returned
                        connection.query('SELECT u' +  sender_psid + '.question_id, questions.content,  questions.primary_topic FROM u' + sender_psid + ', questions where u' + sender_psid + '.question_id = questions.question_id ORDER BY RAND() LIMIT 1', function (error, results, fields) {
                            if (error) throw error;

                            // Update the database then send the card to the user
                            let questions_content = results[0].content;
                            let question_id = results[0].question_id;
                            let topic_name = results[0].primary_topic;

                            connection.query('UPDATE users SET nums_left = nums_left - 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                                if (error) throw error;

                                // Check if need to update active days and update datebase OR directly update database
                                connection.query('SELECT nums_left FROM users WHERE user_id= ' + sender_psid, function (error, results, fields) {
                                    if (error) throw error;
                                    if (results[0].nums_left == 4) {
                                        connection.query('UPDATE users SET active_days = active_days + 1 WHERE user_id = ' + sender_psid, function (error, results, fields){

                                            // Delete the question from the database
                                            connection.query('DELETE FROM u' + sender_psid + ' WHERE question_id = ' + question_id, function (error, results, fields) {
                                                if (error) throw error;

                                                callSendAPI(sender_psid, cards.parseTopicCard(topic_name, questions_content));

                                                connection.release();
                                            });
                                        });
                                    }
                                    else {
                                        connection.query('DELETE FROM u' + sender_psid + ' WHERE question_id = ' + question_id, function (error, results, fields) {
                                            if (error) throw error;

                                            callSendAPI(sender_psid, cards.parseTopicCard(topic_name, questions_content));

                                            connection.release();
                                        });
                                    }
                                });
                            });
                        }); 
                    }
                });
            });
            break;
        
        case "affectioncard":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            sendTopicCard(sender_psid, "Sex and Affection", pool);

            break;
        
        case "beliefcard":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            sendTopicCard(sender_psid, "Values and Beliefs", pool)

            break;
        
        case "familycard":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            sendTopicCard(sender_psid, "Family (History and Future)", pool)

            break;
        
        case "interestcard":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            sendTopicCard(sender_psid, "Interests and Preferences", pool)

            break;
        
        case "personalitycard":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            sendTopicCard(sender_psid, "Personality and Habits", pool)

            break;
        
        case "moneycard":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            sendTopicCard(sender_psid, "Work and Money", pool)

            break;

        case "next":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            pool.getConnection(function (error, connection){
                if (error) throw error;
                connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw (error);
                    if (results[0].nums_left == 0) {
                        callSendAPI(sender_psid, cards.nextLastFeedbackQuickReply);
                        connection.query('UPDATE users SET nums_left = nums_left - 1 WHERE user_id = ' + sender_psid, function (error, results, fields){
                            if (error) throw (error);
                            connection.release();
                        });
                    }
                    else if (results[0].nums_left < 0) {
                        callSendAPI(sender_psid, cards.endForNowCard);
                        connection.release();
                    }
                    else {
                        callSendAPI(sender_psid, cards.nextFeedbackQuickReply);
                        connection.release();
                    }
                });
            });

            break;

        case "donefortoday":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            pool.getConnection(function (error, connection){
                if (error) throw error;
                connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw (error);
                    if (results[0].nums_left == 0) {
                        callSendAPI(sender_psid, cards.doneFeedbackQuickReply);
                        connection.query('UPDATE users SET nums_left = nums_left - 1 WHERE user_id = ' + sender_psid, function (error, results, fields){
                            if (error) throw (error);
                            connection.release();
                        });
                    }
                    else if (results[0].nums_left < 0) {
                        callSendAPI(sender_psid, cards.endForNowCard);
                        connection.release();
                    }
                    else {
                        callSendAPI(sender_psid, cards.doneFeedbackQuickReply);
                        connection.release();
                    }
                });
            });

            break;

        case "startagain":

            // Update last active date
            pool.query('UPDATE users SET date_last_active = ' + date_last_active + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                if (error) throw error;
            });

            // Check if reached max time
            pool.getConnection(function (error, connection) {
                if (error) throw error;
                connection.query ('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;

                    let numbers_left = results[0].nums_left;

                    if (numbers_left <= 0) {
                        callSendAPI(sender_psid, cards.endForNowCard);

                        connection.release();
                    }
                    else {

                        // Increment count for NEW CONVERSATION clicks
                        connection.query('UPDATE users SET new_conversation_count = new_conversation_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                            if (error) throw error;

                            callSendAPI(sender_psid, cards.parseStartCardResponse(numbers_left));

                            connection.release();
                        });
                    }
                });
            });
            break;

        case "changetopiccheckskip":
            callSendAPI(sender_psid, {"text": "Sorry! We have updated our bot and some old buttons no longer work. Type \"get started\" to start fresh with the upgraded version. Thank you!"});
            break;

        case "changetopiccheckanother":
            callSendAPI(sender_psid, {"text": "Sorry! We have updated our bot and some old buttons no longer work. Type \"get started\" to start fresh with the upgraded version. Thank you!"});
            break;

        case "choosetopic":
            callSendAPI(sender_psid, {"text": "Sorry! We have updated our bot and some old buttons no longer work. Type \"get started\" to start fresh with the upgraded version. Thank you!"});
            break;

        case "sametopic":
            callSendAPI(sender_psid, {"text": "Sorry! We have updated our bot and some old buttons no longer work. Type \"get started\" to start fresh with the upgraded version. Thank you!"});
            break;


        // Legacy code from chatbot v1.0
        /*
        case "changetopiccheckskip":
            // Indicate typing
            showTyping(sender_psid);

            // Check if reached max time
            pool.getConnection(function (error, connection) {
                if (error) throw error;
                connection.query ('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                    if (results[0].nums_left <= 0) {
                        callSendAPI(sender_psid, cards.endForNowCard)
                    }
                    else {

                        // Increment count for SKIP FOR NOW clicks
                        connection.query('UPDATE users SET skip_for_now_count = skip_for_now_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                            if (error) throw error;

                            callSendAPI(sender_psid, cards.changeTopicCard);

                            connection.release();
                        });
                    }
                });

            });
        break;
        
        case "changetopiccheckanother":
            // Indicate typing
            showTyping(sender_psid);

            // Check if reached max time
            pool.getConnection(function (error, connection) {
                if (error) throw error;
                connection.query ('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                    if (results[0].nums_left <= 0) {
                        callSendAPI(sender_psid, cards.endForNowCard)
                    }
                    else {

                        // Increment count for READY FOR ANOTHER clicks
                        connection.query('UPDATE users SET ready_for_another_count = ready_for_another_count + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                            if (error) throw error;

                            callSendAPI(sender_psid, cards.changeTopicCard);

                            connection.release();
                        });
                    }
                });

            });
        break;

    case "choosetopic":
        // Indicate typing
        showTyping(sender_psid);

        // Check if reached max time
        pool.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
            if (error) throw (error);
            if (results[0].nums_left <= 0) {
                callSendAPI(sender_psid, cards.endForNowCard)
            }
            else {
                showTyping(sender_psid);
                callSendAPI(sender_psid, {"text": "Please choose a topic or go \"wildcard\" if you are up for anything:"});
                callSendAPI(sender_psid, cards.chooseTopicCard)
            }
        });
        break;

        case "sametopic":
            // Check if reached max time: get nums_left from user db
            // Check if run out of this topic: random get from user question_pool
            // Reduce count by one: write to user db
            // Delete this card from db: write to question_pool
            // Send the card

            // Indicate typing
            showTyping(sender_psid);

            pool.getConnection(function (error, connection) {
                if (error) throw error;

                // Check if reached max time and get numbers left
                connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                    if (error) throw error;
                    let times_left_for_today = results[0].nums_left;
                    if (times_left_for_today <= 0) {
                        callSendAPI(sender_psid, cards.endForNowCard);
                    }
                    else {

                        // Get user's last seen topic
                        connection.query('SELECT last_topic FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                            if (error) throw error;
                            let user_last_seen_topic = results[0].last_topic;
                            
                            // Choose corresponding card template
                            let card_topic;
                            switch (user_last_seen_topic) {
                                case "Sex and Affection":
                                    card_topic = "affection";
                                break;

                                case "Work and Money":
                                    card_topic = "money";
                                break;

                                case "Interests and Preferences":
                                    card_topic = "interest";
                                break;

                                case "Personality and Habits":
                                    card_topic = "personality";
                                break;

                                case "Family (History and Future)":
                                    card_topic = "family";
                                break;

                                case "Values and Beliefs":
                                    card_topic = "belief";
                                break;

                            }
                            
                            // Check the randomly generated topic. Handle if null is returned
                            connection.query('SELECT content, question_id FROM u' + sender_psid + ' WHERE primary_topic = "' + user_last_seen_topic + '" ORDER BY RAND() LIMIT 1', function (error, results, fields) {
                                if (error) throw error;

                                // Check if the string is empty (seen all questions in the topic)
                                if (!results[0]) {
                                    callSendAPI(sender_psid, {"text": "You've seen all the questions from this topic, why not give another one a try☺"});
                                    callSendAPI(sender_psid, cards.chooseTopicCard);
                                } else {

                                    // Update the database then send the card to the user
                                    let questions_content = results[0].content;
                                    let question_id = results[0].question_id;
                                    times_left_for_today = times_left_for_today - 1;
                                    connection.query('UPDATE users SET nums_left = ' + times_left_for_today + ' WHERE user_id = ' + sender_psid, function (error, results, fields) {
                                        if (error) throw error;

                                        // Delete the question from the database
                                        connection.query('DELETE FROM u' + sender_psid + ' WHERE question_id = ' + question_id, function (error, results, fields) {
                                            if (error) throw error;
                                            
                                            callSendAPI(sender_psid, cards.parseTopicCard(card_topic, questions_content))

                                            connection.release();
                                        });
                                    });
                                }
                            });
                        });
                    }
                });
            });
        break;
        */
    }
    
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
        "uri": "https://graph.facebook.com/v3.2/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            // console.log('message sent!');
        }
        else {
            console.log(new Date());
            console.error("Unable to send message:" + err);
        }
    });
}

// Indicating the bot is tryping
function showTyping(sender_psid){
    request({
        "uri": "https://graph.facebook.com/v3.2/me/messages",
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
        "uri": "https://graph.facebook.com/v3.2/me/messages",
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

// Parse topic card, update database and send the message
function sendTopicCard(sender_psid, topic_name, mysql_pool) {

    mysql_pool.getConnection(function (error, connection) {
        if (error) throw error;

        // Check if reached max time and get numbers left
        connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
            if (error) throw error;
            if (results[0].nums_left <= 0) {
                callSendAPI(sender_psid, cards.endForNowCard);
                connection.release();
            }
            else {
                // Check the randomly generated topic. Handle if null is returned
                connection.query('SELECT u' +  sender_psid + '.question_id, questions.content,  questions.primary_topic FROM u' + sender_psid + ', questions WHERE u' + sender_psid + '.question_id = questions.question_id AND questions.primary_topic = \"' + topic_name + '\"ORDER BY RAND() LIMIT 1', function (error, results, fields) {

                    if (error) throw error;

                    // Check if the string is empty (seen all questions in the topic)
                    if (!results[0]) {
                        callSendAPI(sender_psid, {"text": "You've seen all the questions from this topic, but we will add more with our next update! Please choose another topic or wildcard 🎲"})
                        callSendAPI(sender_psid, cards.chooseTopicCard);
                        connection.release();
                    }
                    else {

                        // Update the database then send the card to the user
                        let questions_content = results[0].content;
                        let question_id = results[0].question_id;

                        connection.query('UPDATE users SET nums_left = nums_left - 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {
                            if (error) throw error;

                            connection.query('SELECT nums_left FROM users WHERE user_id = ' + sender_psid, function (error, results, fields) {
                                if (error) throw error;
                                if (results[0].nums_left == 4) {
                                    connection.query('UPDATE users SET active_days = active_days + 1 WHERE user_id = ' + sender_psid, function (error, results, fields) {

                                        // Delete the question from the database
                                        connection.query('DELETE FROM u' + sender_psid + ' WHERE question_id = ' + question_id, function (error, results, fields) {
                                            if (error) throw error;

                                            callSendAPI(sender_psid, cards.parseTopicCard(topic_name, questions_content));

                                            connection.release();
                                        });
                                    });
                                }
                                else {
                                    connection.query('DELETE FROM u' + sender_psid + ' WHERE question_id = ' + question_id, function (error, results, fields) {
                                        if (error) throw error;

                                        callSendAPI(sender_psid, cards.parseTopicCard(topic_name, questions_content));

                                        connection.release();
                                    });
                                }
                            });
                        });
                    }
                });
            }
        });
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
                                callSendAPI(sender_psid, cards.parseStartCardResponse(0));
                            } else {
                                callSendAPI(sender_psid, cards.parseStartCardResponse(results[0].nums_left));
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
                                        callSendAPI(sender_psid, cards.parseStartCardResponse(results[0].nums_left));

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
                                callSendAPI(sender_psid, cards.parseStartCardResponse(0));
                            } else {
                                callSendAPI(sender_psid, cards.parseStartCardResponse(results[0].nums_left));
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
                                        callSendAPI(sender_psid, cards.parseStartCardResponse(results[0].nums_left));

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
