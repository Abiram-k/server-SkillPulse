const GoogleStrategy = require("passport-google-oauth2").Strategy;
const User = require("../models/userModel");
const path = require("path");
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const passport = require("passport");
// require('dotenv').config()

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRETE,
    callbackURL: "http://localhost:3000/auth/google/callback",
    passReqToCallback: true    
},

    async (request, accessToken, refreshToken, profile, done) => {
        // console.log(profile);
        try {
            const user = await User.findOne({ googleid: profile.id })
            if (user) {
                return done(null, user);
            } else {
                const newUser = new User({
                    googleid: profile.id,
                    firstName: profile.displayName,
                    email: profile.emails[0].value,
                    profileImage: profile.photos[0].value
                });
                const user = await newUser.save();
                return done(null, user);
            }
        } catch (error) {
            console.log(error)
            return done(error, false)
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id)
})

passport.deserializeUser((id, done) => {
    User.findById(id).then((user) => done(null, user)).catch((err) => done(err, null))
})
// } 