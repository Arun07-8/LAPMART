const User = require("../models/userSchema");

const adminAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
    User.findOne({ _id: req.session.admin, isadmin: true })
      .then((data) => {
        if (data) {
          next();
        } else {
          res.redirect("/admin/login");
        }
      })
      .catch((error) => {
        console.error("Error in admin auth middleware:", error);
         
      });
  } else {
    res.redirect("/admin/login");
  }
};

module.exports = { adminAuth };
