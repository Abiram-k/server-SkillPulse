const redis = require("redis");

const redisClient = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
    },
});

redisClient.connect().then(() => console.log(`Connected to redis server : ${process.env.REDIS_PORT}`)).catch((err) => {
    console.error("Error connecting to Redis:", err);
});

module.exports = redisClient;
    
