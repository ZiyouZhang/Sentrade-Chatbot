module.exports.sendQuestion = sendQuestion;

let news = [
    {
        "created_at": "Thu May 02 01:22:04 +0000 2019",
        "source": "<a href=\"http://twitter.com/download/iphone\" rel=\"nofollow\">Twitter for iPhone</a>",
        "original_text": "RT @ntmbootybandit: Teslas are insane man i cant wait to get 1",
        "processed_text": "teslas are insane man i cant wait to get 1",
        "date": "2019-05-01",
        "polarity": -1,
        "subjectivity": 1
    },
    {
        "created_at": "Wed May 01 21:13:54 +0000 2019",
        "source": "<a href=\"http://twitter.com/download/android\" rel=\"nofollow\">Twitter for Android</a>",
        "original_text": "RT @ovieali: American company Microsoft,has announced plans for the opening of its first Africa's engineering station in Nigeria. This come…",
        "processed_text": "american company microsofthas announced plans for the opening of its first africas engineering station in nigeria this come",
        "date": "2019-05-01",
        "polarity": 0.125,
        "subjectivity": 0.16666666666666666
    },
    {
        "created_at": "Wed May 01 21:49:19 +0000 2019",
        "source": "<a href=\"http://twitter.com\" rel=\"nofollow\">Twitter Web Client</a>",
        "original_text": "I don't like this inconsistency in icons... 😅#microsofteams #OCD https://t.co/FsFGahsn0a",
        "processed_text": "i dont like this inconsistency in icons microsofteams ocd ",
        "date": "2019-05-01",
        "polarity": 0,
        "subjectivity": 0
    }
]

function sendQuestion(news_number) {

    let sentiment;
    sentiment = "NEUTRAL"
    if (news[news_number] > 0.33) {
        sentiment = "POSITIVE";
    } else if (news[news_number] < -0.33) {
        sentiment = "NEGATIVE";
    }

    let response = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "button",
                "text": "The following tweet:\n\n\"" + news[news_number]["original_text"] + "\"\n\n has been identified as " + sentiment + ". Do you think it's correct?", 
                "buttons": [
                    {
                        "type": "postback",
                        "title": "YES",
                        "payload": "yes"
                    },
                    {
                        "type": "postback",
                        "title": "NO",
                        "payload": "no"
                    }
                ]
            }
        }
    };

    return response;
}

module.exports.news = news;