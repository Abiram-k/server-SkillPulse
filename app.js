const express = require("express");
const mongoose = require("mongoose");
const MongoStore = require('connect-mongo');
const dotenv = require("dotenv");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("node:path");
const cors = require("cors");
const userRouter = require('./routes/userRoutes')
const adminRouter = require('./routes/adminRoutes')
const nodeMailer = require("nodemailer");
const passport = require("passport");
const app = express();

require('./config/passport');
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PORT = process.env.PORT || 3000;
const SESSION_SECRETE = process.env.SESSION_KEY;

const allowedOrigins = [
    'https://skill-pulse.vercel.app',
    'http://localhost:5173', 
];

app.use(cors({
    origin: (origin, callback) => {
        console.log("Request orgin is : ",origin);
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

app.use(cookieParser());
app.use((req, res, next) => {
    console.log("Request URL:", req.url);
    console.log("Request Method:", req.method);
    console.log("Request Headers:", req.headers);
    console.log("Cookies:", req.cookies);
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Creating Session
app.use(session({
    secret: SESSION_SECRETE,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: { secure: false, maxAge: 60000 * 24 }
}));


app.use(passport.initialize());
app.use(passport.session());

app.use('/', userRouter)
app.use("/admin", adminRouter);

mongoose.connect(process.env.MONGO_URL).then(() => {
    console.log("SuccessFully connected to mongoDB")
}).catch((error) => {
    console.log(`Error occured with mongodb ${error.name}`)
});

app.listen(PORT, () => {
    console.log(`Server Is Running At Port : ${PORT}`);
})