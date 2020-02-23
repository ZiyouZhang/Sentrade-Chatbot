# Sentrade-Chatbot

Sentrade Chatbot used for user feedback collection.

## Getting Started

This is a brief instruction for installing and deploying the chatbot on a remote server.

### Prerequisites

Put the project code on the server. Fill in the passwords and tokens in the index.js file.

Install Node.js and npm.

```
[sudo] apt install nodejs npm
```

Install MySQL (A guide [here](https://support.rackspace.com/how-to/installing-mysql-server-on-ubuntu/) and [here](https://help.ubuntu.com/lts/serverguide/mysql.html.en)).

```
[sudo] apt install mysql-server
```

### Installing

Navigate to Sentrade-Chatbot, install all dependencies.

```
[sudo] npm install
```

Config the MySQL database.

```
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '<your_password>';
SET GLOBAL interactive_timeout = 600;
SET GLOBAL wait_timeout = 600;
```

## Running the tests

Start the Node.js code.

```
node index.js
```

Expose localhost to the internet.

```
./ngrok http -region=eu 1014
```

If see no permission warning, try the command (explained [here](https://stackoverflow.com/questions/18960689/ubuntu-says-bash-program-permission-denied)).

```
chmod u+x ./ngrok
```

## Deployment

Use [forever](https://www.npmjs.com/package/forever) to keep the Node.js code running in the background.

```
forever start index.js
```

Use nohup to keep ngrok running in the background.

```
nohup ./ngrok http -region=eu 1014
```

Use this command to view the details about the ngrok.

```
curl -s localhost:4040/api/tunnels
```

## Built With

* [Node.js](https://nodejs.org/en/) - The JavaScript runtime used
* [MySQL](https://www.mysql.com/) - Used for user database management
* [ngrok](https://ngrok.com/) - Used to expose localhost to the internet

## Authors

* **Ziyou Zhang** - *Coding stuff*
