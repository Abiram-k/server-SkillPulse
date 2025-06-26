const GoogleStrategy = require("passport-google-oauth2").Strategy;
const User = require("../models/userModel");
const path = require("path");
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const passport = require("passport");

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRETE,
    callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
    passReqToCallback: true
},

    async (request, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value.toLowerCase().trim();
            let userExisits = await User.findOne({ email });

            if (userExisits) {
                if (!userExisits.googleid) {
                    userExisits.googleid = profile.id;
                    await userExisits.save();
                }
                return done(null, userExisits);
            }

            const user = await User.findOne({ googleid: profile.id })
            if (user) {
                return done(null, user);
            } else {
                function generateReferralCode(length = 8) {
                    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                    let referralCode = "";
                    for (let i = 0; i < length; i++) {
                        const randomIndex = Math.floor(Math.random() * characters.length);
                        referralCode += characters[randomIndex];
                    }
                    return referralCode;
                }

                const newUser = new User({
                    googleid: profile.id,
                    firstName: profile.displayName,
                    email: profile.emails[0].value,
                    profileImage: profile.photos[0].value,
                    referralCode: generateReferralCode()
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