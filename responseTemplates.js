const
    CHOICE_IMAGE_URL = "https://i.imgur.com/38wPKSy.jpg";

module.exports.sendCard = sendCard;

news = [
    {
        "id": 1173797377951424513,
        "created_at": "Tue Sep 17 03:14:37 +0000 2019",
        "source": "<a href=\"http://twitter.com/download/iphone\" rel=\"nofollow\">Twitter for iPhone</a>",
        "text": "Facebook has some funny ass memes yall are missing out on them",
        "company": "Facebook",
        "polarity": 0.024999999999999994,
        "subjectivity": 0.525
      }
]

function sendCard(news_number) {

    let sentiment;
    sentiment = "neutral"
    if (news[news_number] > 0.3) {
        sentiment = "positive";
    } else if (news[news_number] < -0.3) {
        sentiment = "negative";
    }

    let response = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "botton",
                "text": "The tweet\n" + news[news_number]["text"] + "\nhas been identified as " + sentiment + ". Do you think it's correct?", 
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


