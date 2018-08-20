var redis = require("redis");
require('dotenv').config();
var redisClient;

function Init(callback) {
    redisClient = redis.createClient(process.env.redisPort || 6380, process.env.redisURL, {
        auth_pass: process.env.redisKey,
        tls: { servername: process.env.redisURL }
      });
    callback();
}
  
function Get(userKey, callback) {  
    var conversationId = null;
    redisClient.get(userKey, (err, reply) => {
        if(err){            
            console.log(`key Get error ${err}`);
            conversationId = null;    
        } else {
            console.log(`key Get value ${reply}`);
            conversationId = reply;
        }
        });
    return conversationId;
};

function Set(userKey, conversationId, callback) {  
    var setResult = null;
    redisClient.set(userKey, conversationId, (err, reply) => {    
        if(err){
            console.log(`key Set error ${err}`);
            var setResult = null;
        } else {
            console.log(`key Set result ${reply}`);
            var setResult = reply;
        }
    });   
    return setResult;   
};

exports.Init = Init;
exports.Get = Get;
exports.Set = Set;