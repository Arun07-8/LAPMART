const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
          return next();
        } else {
          req.session.user = null; 
          return res.redirect("/login");
        }
      })
      .catch((error) => {
        console.error("Error in user auth middleware:", error);
        next(error); 
      });
  } else {
    return res.redirect("/login"); 
  }
};

module.exports = { userAuth };
