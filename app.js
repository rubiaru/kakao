var Swagger = require('swagger-client');
var open = require('open');
var rp = require('request-promise');
var log = require('./db/log');
var key = require('./db/key');
var restify = require('restify');

const restifyPlugins = require('restify-plugins');

require('dotenv').config();

// config items
var pollInterval = 1000;
var directLineSecret = process.env.directLineSecret;
var directLineClientName = 'DirectLineClient';
var directLineSpecUrl = 'https://docs.botframework.com/en-us/restapi/directline3/swagger.json';
var directClient = null;

var directLineClient = rp(directLineSpecUrl)
    .then(function (spec) {
        // DirectLine client
        return new Swagger({
            spec: JSON.parse(spec.trim()),
            usePromise: true
        });
    })
    .then(function (client) {
        // 인증을 위한 헤더 추가
        client.clientAuthorizations.add('AuthorizationBotConnector', new Swagger.ApiKeyAuthorization('Authorization', 'Bearer ' + directLineSecret, 'header'));
        directClient = client;
    })
    .catch(function (err) {
        console.error('루이스 연결을 위한 DirectLine client 초기화 중 에러 발생:', err);
    });

function pollMessages(client, conversationId, kakaoResponse ) {

    console.log(`pollMessages conversationId ${conversationId}`);

    var watermark = null;
    var tempMsg = "";
    getActiviteis = setInterval(function () {
        console.log('pollMessages conversationId setInterval called');
        // directClient
        client.Conversations.Conversations_GetActivities({ conversationId: conversationId, watermark: watermark })
            .then(function (response) {
                watermark = response.obj.watermark;          
                // return response.obj.activities;
                activities = response.obj.activities;
                console.log(`pollMessages conversationId setInterval watermark ${watermark}`);
                console.log(`activities ${JSON.stringify(activities)}`);
                
                if (activities && activities.length) {
                    // ignore own messages
                    activities = activities.filter(function (m) { return m.from.id !== directLineClientName });   
                    if (activities.length) {
                        // print other messages
                        activities.forEach(function(activity) {
                            if (activity.text) {
                                tempMsg += activity.text;
                            }
                        });            
                        
                        clearInterval(getActiviteis);
                    
                        var responseMsg = {
                            "message": {
                                "text": tempMsg
                            }
                        };     
                        log.Log(responseMsg, function() { console.log(responseMsg); });
                        kakaoResponse.send(responseMsg);  
                        kakaoResponse.end();
                    } 

                }

            }) ;  
    }, pollInterval); 
    
}

// Setup Restify Server
var server = restify.createServer(
    {
        name: 'kakao proxy!',
        version: '1.0.0'
    }
);


server.use(restifyPlugins.jsonBodyParser({ mapParams: true }));
server.use(restifyPlugins.acceptParser(server.acceptable));
server.use(restifyPlugins.queryParser({ mapParams: true }));
server.use(restifyPlugins.fullResponse());

const port = process.env.port || process.env.PORT;

server.get('/', function (request, response, next) {
    var keyboardResponse = {        
        'text': 'hello'
    }  
    response.send(keyboardResponse);   
}   
);

server.get('/keyboard', function (request, response, next) {
        var keyboardResponse = {
            'type': 'buttons',
            'buttons': ['오늘날씨알려주세요']
        }  
        response.send(keyboardResponse);   
    }   
);

server.post('/message', function(request, response, next) {
        // var msg = request.body.content;
        console.log(request.toString());
        var msg = JSON.stringify(request.body);        
        log.Log(msg, function() {
            console.log("kakao msg received " + msg);
        });
        console.log(`1) msg ${msg}`);  
        var userKey = request.body.user_key;
        var input = request.body.content;
        key.Get(userKey, function(conversationId) {
            //console.log(`key.Get callback ${conversationId}`);
            checkConversationID(conversationId, function(conversationId){
                //console.log(`checkConversationID callback ${conversationId}`);
                key.Set(userKey, conversationId, function() { 
                    var keyLog = `conversationId Create ${userKey} , ${conversationId}`;
                    log.Log(keyLog, function() { console.log(keyLog); });
                    sendMsg(conversationId, input, directLineClientName, function() {
                    });  
                    pollMessages(directClient, conversationId, response);
                    });   
            });                                       
        });

        //response.send(201, { text: 'message received' });
        //response.end();
    }
);
function checkConversationID(conversationId, callback) {
    if (conversationId == null) {
        console.log('conversationId is null. call Conversations_StartConversation()');                
        directClient.Conversations.Conversations_StartConversation()    
        .then(function (response) {                       
            conversationId = response.obj.conversationId;                
            console.log(`created conversationId is ${conversationId}`);     
            callback(conversationId);    
        })                                                       
        .catch(function (err) {
            console.error('Error starting conversation', err);
        });        
    } else {
        console.log(`conversationId is ${conversationId}`);
    }    
}

function sendMsg(conversationId, input, name, callback) {
    var postMsg = {
        conversationId: conversationId,
        activity: {
            textFormat: 'plain',
            text: input,
            type: 'message',
            from: {
                id: name,
                name: name
            }
        }
    };
    console.log(`LUIS에 메세지 전송: ${JSON.stringify(postMsg)}`);
    // restify - async 
    directClient.Conversations.Conversations_PostActivity(postMsg)
        .then(function (response) {        
            callback();
        })
        .catch(function (err) {
            console.error('LUIS에 메세지 전송 중 에러 발생:', err);
        });                    
}
server.listen(port, function() { 
        console.log('서버 가동중... in ' + port); 
        log.Init(function() {
            console.log('카카오 로그 초기화 성공');
        });

        key.Init(function() {
            console.log('레디스 캐쉬 초기화 성공');
        });
    }
);

