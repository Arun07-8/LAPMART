const nodemailer = require('nodemailer')

const  contactPage=async  (req,res)=>{
    try {
        res.render("contactsPage")
    } catch (error) {
        console.error("the page is not rendering issue",error)
        res.status(500).redirect("pageNotFound")
    }
} 


module.exports={
    contactPage
}