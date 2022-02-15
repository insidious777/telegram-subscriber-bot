const TelegramBot = require('node-telegram-bot-api');
const request = require('request');
const fs = require('fs');
require('dotenv').config();
const token = process.env.TELEGRAM_BOT_API_KEY;

const bot = new TelegramBot(token, {polling: true});

let target = {
    name: null,
    id: null,
    newest_post_id: null
}
let subscribedUsers = []

function setTargetToFile(target){
    fs.writeFile('target.txt',JSON.stringify(target),(err)=>{
        console.log('success write target to file')
    })
}

function getTargetFromFile() {
    fs.readFile('target.txt',(err, data)=>{
        target = (JSON.parse(data.toString()));
    })
}

function setUsersToFile(users){
    fs.writeFile('connected_users.txt',JSON.stringify(users),(err)=>{
        console.log('success write users file')
    })
}

function getUsersFromFile() {
    fs.readFile('connected_users.txt',(err, data)=>{
        subscribedUsers = (JSON.parse(data.toString()));
    })
}

getUsersFromFile();
getTargetFromFile();

const sendMessageToAllUsers = (message) => {
    subscribedUsers.map((user)=>{
        bot.sendMessage(user, message);
    })
}

const getPostTextById = (id) => {
    const options = {
        'method': 'GET',
        'url': `https://api.twitter.com/2/tweets/${id}/`,
        'headers': {
            'Authorization': `Bearer ${process.env.TWITTER_API_KEY}`
        }
    };

    request(options, function (error, response) {
        if (error) throw new Error(error);
        if(response.body){
            sendMessageToAllUsers(JSON.parse(response.body).data.text);
            console.log('new post')
        }
    });
}

const getTargetId = () => {
    const options = {
        'method': 'GET',
        'url': `https://api.twitter.com/2/users/by?usernames=${target.name}`,
        'headers': {
            'Authorization': `Bearer ${process.env.TWITTER_API_KEY}`
        }
    };

    request(options, function (error, response) {
        if (error) throw new Error(error);
        if(response.body){
            const parsedResponse = JSON.parse(response.body);
            if(parsedResponse.errors) console.log('error');
            else if(parsedResponse.data) {
                target.id = parsedResponse.data[0].id;
                setTargetToFile(target);
                console.log(parsedResponse.data);
            }
        }
    });
}


const checkNewPosts = () => {
    if(target.id){
        const options = {
            'method': 'GET',
            'url': `https://api.twitter.com/2/users/${target.id}/tweets/`,
            'headers': {
                'Authorization': `Bearer ${process.env.TWITTER_API_KEY}`,
            }
        };

        request(options, function (error, response) {
            if (error) throw new Error(error);
            if(response.body){
                const parsedResponse = JSON.parse(response.body);
                if(parsedResponse.meta){
                    if(target.newest_post_id && target.newest_post_id!==parsedResponse.meta.newest_id){
                       getPostTextById(parsedResponse.meta.newest_id);
                    }
                    target.newest_post_id = parsedResponse.meta.newest_id;
                    setTargetToFile(target);
                }
            }
        });
    }

    console.log('checking', target.id, target.newest_post_id)
}



const setTarget = (name) => {
    target.newest_post_id = null;
    target.id = null;
    target.name = name;
    getTargetId();
    setTargetToFile(target);
}

const subscribeUser = (chatId) => {
    subscribedUsers.push(chatId)
    subscribedUsers = [...new Set(subscribedUsers)];
    setUsersToFile(subscribedUsers);
    console.log('users update:', subscribedUsers);
}

const unsubscribeUser = (chatId) => {
    subscribedUsers = subscribedUsers.filter((id)=>id!==+chatId)
    setUsersToFile(subscribedUsers);
    console.log('users update:', subscribedUsers);
}

setInterval(checkNewPosts,process.env.CHECKING_DELAY);

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    console.log('new message from ', msg.chat.id,':', msg.text)
    const commandParts = msg.text.split(' ');
    switch (commandParts[0]) {
        case '/start':
        case '/help':{
            bot.sendMessage(chatId, `Bot usage:\n
            /target - Select user to follow (e.g. /target elonmusk)\n
            /enable - Enable new tweet notifications (disabled by default)\n
            /disable - Disable notifications for new tweets\n
            /info - View the number of followers (and more information)
            `)
            break;
        }
        case '/target':{
            setTarget(commandParts[1]);
            sendMessageToAllUsers(`Tracking of @${commandParts[1]} enabled`)
            break;
        }
        case '/enable':{
            subscribeUser(chatId);
            bot.sendMessage(chatId, `New tweets notifications are on`);
            break;
        }
        case '/disable':{
            unsubscribeUser(chatId);
            bot.sendMessage(chatId, `New tweets notifications are turned off`);
            break;
        }
        case '/info':{
            if(target.name) bot.sendMessage(chatId, `Target: @${target.name}`);
            else bot.sendMessage(chatId, `Target not set`);
            //bot.sendMessage(chatId, `Target id is ${target.id}`);
            //bot.sendMessage(chatId, `Target newest post id is ${target.newest_post_id}`);
            bot.sendMessage(chatId, `Number of followers: ${subscribedUsers.length}`);
            break;
        }
        default: {
            bot.sendMessage(chatId, `${msg.from.first_name}, wrong command`);
            break;
        }
    }

});




