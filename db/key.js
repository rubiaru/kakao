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
    redisClient.get(userKey, (err, reply) => {
        console.log(`key Get ${reply}`);
        return reply;
        });
    return null;
};

function Set(userKey, conversationId, callback) {  
    redisClient.set(userKey, conversationId, (err, reply) => {    
        if(err){
            console.log(err);
            res.send("error "+err);
            return null;
        }
        return reply;
    });   
    return null;   
};

exports.Init = Init;
exports.Get = Get;
exports.Set = Set;