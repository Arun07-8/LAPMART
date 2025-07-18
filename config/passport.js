const passport =require("passport");
const GoogleStrategy=require("passport-google-oauth20").Strategy;
const User=require("../models/userSchema");
const env=require("dotenv").config();


async function generateUniqueReferralCode(name) {
  const prefix = name.split(" ")[0].toUpperCase();
  let code, exists;

  do {
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}${random}`;
    exists = await User.findOne({ referralCode: code });
  } while (exists);

  return code;
}


passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:process.env.NODE_ENV === 'production'
          ? `${process.env.HOST_URL}/auth/google/callback`
          : 'http://localhost:3000/auth/google/callback',
      
      passReqToCallback: true,
},

async(accessToken,refreshToken,profile,done)=>{
    try {
     console.log("hello")
        let  user=await  User.findOne({googleid:profile.id});
      console.log(user)
        if(user){
           if( !user.isBlocked)
               return  done(null,user);
           else{
               return  done (null,false,{message:"User is Blocked by the admin"})
           }
        }else{

         const referrerCode = await generateUniqueReferralCode(profile.displayName);

          const newUser =new User({
                name:profile.displayName,
                email:profile.emails[0].value,
                googleid:profile.id ,
                referralCode:referrerCode
            });

            await newUser.save();

            return done(null,newUser);
        }

        
    } catch (error) {
          return  done(error,null)
    }
}

));

passport.serializeUser((user,done)=>{
   done(null,user.id)
});

passport.deserializeUser((id,done)=>{
   User.findById(id)
   .then(user=>{
     done(null,user)
   })
   .catch(err =>{
      done(err,null)
   })
})

module.exports=passport