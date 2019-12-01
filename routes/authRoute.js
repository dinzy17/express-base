var express = require('express')
var router = express.Router()
var passport = require('passport')
const mongoose = require('mongoose')
var async = require('async')
const { isEmpty } = require('lodash')

const User = require('./../models/User')
const EmailTemplate = require('./../models/EmailTemplate')
var constants = require('./../config/constants')
const resFormat = require('./../helpers/responseFormat')
const sendEmail = require('./../helpers/sendEmail')
const emailTemplatesRoute = require('./emailTemplatesRoute.js')
const auth = require('./../helpers/authMiddleware')

//function to create or register new user
async function signUp(req, res) {
  var user = new User()
  if(req.body.email == '' || req.body.email == undefined ) {
    res.status(400).send(resFormat.rError({ message: "Please fill all required details." }))
  } else {
    User.find({ email: req.body.email }, { _id: 1, email:1, emailVerified:1}, async function(err, result) {
      if (err) {
        res.status(403).send(resFormat.rError(err))
      } else if (result && result.length == 0) {
        if (req.body.socialMediaToken && req.body.socialMediaToken != "") {
          let userDetail = await User.find({
            "socialMediaToken": req.body.socialMediaToken
          })
          if(userDetail && userDetail.length == 0) {
            user.socialMediaToken = req.body.socialMediaToken
            user.socialPlatform = req.body.socialPlatform
            saveUser();
          } else {
            res.status(406).send(resFormat.rError({ message:"User already exists." }))
          }
        } else {
          saveUser();
        }
        function saveUser() {
          let otp = generateOTP()
          let referralCode = req.body.name.substring(0, 3)+'-'+ otp;
          user.emailVerifiedOtp = otp;
          user.emailVerified = false;
          user.createdEmailVerifiedOtp = new Date();
          user.fullName = req.body.name;
          user.email = req.body.email;
          user.phoneNumber = req.body.phoneNumber;
          user.profession = req.body.profession;
          user.referralCode = referralCode;
          user.userType = "appUser";
          user.active = false;
          user.createdOn = new Date();
          user.save(async function(err, newUser) {
            if (err) {
              res.status(403).send(resFormat.rError(err))
            } else {
              let template = await emailTemplatesRoute.getEmailTemplateByCode("resendVerifySignup")
                if (template) {
                  template = JSON.parse(JSON.stringify(template));
                  let body = template.mailBody.replace("{otp}", otp);
                  const mailOptions = {
                    to: req.body.email,
                    subject: template.mailSubject,
                    html: body
                  }
                  sendEmail.sendEmail(mailOptions)
                }
              responseData = {
                "userId": newUser._id,
                "email":newUser.email
              }
              res.send(resFormat.rSuccess(responseData))
            }
          })
        }
      } else if (!result[0].emailVerified) {
        let otp = generateOTP()
        var params = {
          emailVerifiedOtp: otp,
          createdEmailVerifiedOtp: new Date()
        }
        let updatedUser = await User.updateOne({
          _id: result[0]._id
        }, {
          $set: params
        })
        if (updatedUser) {
          let template = await emailTemplatesRoute.getEmailTemplateByCode("resendVerifySignup")
              if (template) {
                template = JSON.parse(JSON.stringify(template));
                let body = template.mailBody.replace("{otp}", otp);
                const mailOptions = {
                  to: result[0].email,
                  subject: template.mailSubject,
                  html: body
                }
                sendEmail.sendEmail(mailOptions)
            }
          res.status(406).send(resFormat.rError({message:"Your email is not verify. We have sent OTP in your email. please verify OPT",  data: {"email": req.body.email}}))
        } else {
          res.status(406).send(resFormat.rError({message:"Your email is not verify."}))
        }
      } else {
        res.status(406).send(resFormat.rError({ message: "This email is already registered. use different email for signup." }))
      }
    })
  }
}

//function to check and signin user details
function signin(req, res) {
  if(req.body.socialMediaToken && req.body.socialMediaToken != "") {
    User.findOne({ $or: [ { socialMediaToken: req.body.socialMediaToken }, { email: req.body.email } ] }, async function(err,user){
      if (err) {
        res.status(400).send(resFormat.rError(err))
      } else if (user) {
       // if(new Date(user.subscription_expired_date) < new Date()){
          var token = user.generateJwt();

          deviceTokens = user.deviceTokens
          if(req.body.device_id && req.body.device_token){
            let tokenObj = {
              deviceId: req.body.device_id,
              deviceToken: req.body.device_token
            }
            existingIndex = user.deviceTokens.findIndex((o) => o.deviceId == req.body.device_id)
            if(existingIndex > -1)
              deviceTokens.splice(existingIndex, 1)
            deviceTokens.push(tokenObj)
          }

          var params = {
            accessToken: token,
            deviceTokens: deviceTokens
          }

          let updatedUser = await User.updateOne({
            _id: user._id
          }, {
            $set: params
          })

          if (updatedUser) {
            let userObj = {
              accessToken: token,
              userId: user._id,
              user: {
                fullName: user.fullName,
                phoneNumber: user.contactNumber ,
                email: user.email,
                profession: user.profession
              }
            }
            res.send(resFormat.rSuccess(userObj))
          } else {
            res.status(400).send(resFormat.rError({message:"Invalid email"}))
          }
        // }else{
        //   res.send(resFormat.rError({message:"your subscription is expired"}))
        // }

      } else {
        res.status(400).send(resFormat.rError({ message: "You do not have account connected with this email ID. Please signup instead." }))
      }
    }) // end of user find
  } else {
    passport.authenticate('webUser', "appUser" ,async function (err, user, info) {
      if (err) {
        res.status(400).send(resFormat.rError(err))
      } else if (info) {
        res.status(400).send(resFormat.rError(info))
      } else if (user) {
        if(user.emailVerified){
           //  if(new Date(user.subscription_expired_date) < new Date()){
              var token = user.generateJwt();

              deviceTokens = user.deviceTokens
              if(req.body.device_id && req.body.device_token){
                let tokenObj = {
                  deviceId: req.body.device_id,
                  deviceToken: req.body.device_token
                }
                existingIndex = user.deviceTokens.findIndex((o) => o.deviceId == req.body.device_id)
                if(existingIndex > -1)
                  deviceTokens.splice(existingIndex, 1)
                deviceTokens.push(tokenObj)
              }

              var params = {
                accessToken: token,
                deviceTokens: deviceTokens
              }

              let updatedUser = await User.updateOne({
                _id: user._id
              }, {
                $set: params
              })

              if (updatedUser) {
                let userObj = {
                  accessToken: token,
                  userId: user._id,
                  user: {
                    name: user.fullName,
                    contactNumber: user.contactNumber,
                    email: user.email,
                    profession: user.profession
                  }
                }
                res.send(resFormat.rSuccess(userObj))
              } else {
                res.status(400).send(resFormat.rError({message:"Invalid email"}))
              }
            // }else{
            //   res.send(resFormat.rError({message:"your subscription is expired"}))
            // }
          } else {
            let otp = generateOTP()
            var params = {
              emailVerifiedOtp: otp,
              createdEmailVerifiedOtp: new Date()
            }
            let updatedUser = await User.updateOne({
              _id: user._id
            }, {
              $set: params
            })
            if (updatedUser) {
              let template = await emailTemplatesRoute.getEmailTemplateByCode("resendVerifySignup")
                  if (template) {
                    template = JSON.parse(JSON.stringify(template));
                    let body = template.mailBody.replace("{otp}", otp);
                    const mailOptions = {
                      to: user.email,
                      subject: template.mailSubject,
                      html: body
                    }
                    sendEmail.sendEmail(mailOptions)
                }
              res.status(406).send(resFormat.rError({message:"Your email is not verify. We have sent OTP in your email. please verify OPT"}))
            } else{
              res.status(406).send(resFormat.rError({message:"Your email is not verify."}))
            }
          }
      } else {
        res.status(400).send(resFormat.rError({message:"Please enter correct password."}))
      }
    })(req, res)
  }
}

//logout
async function signout(req, res) {
  if (req.body.userId) {
    if (req.body.deviceid) {
      let user = await User.findById(req.body.userId)
      if (user) {
        let deviceTokens = user.deviceTokens
        let tokenIndex = _.findIndex(deviceTokens, {
          deviceId: req.headers.deviceid
        })
        if (tokenIndex != -1) {
          deviceTokens.splice(tokenIndex, 1)
          let upatedUser = await User.updateOne({
            _id: user._id
          }, {
            $set: {
              deviceTokens: deviceTokens,
              accessToken: undefined
            }
          })
        }
        res.send(resFormat.rSuccess())
      } else {
        res.status(404).send(resFormat.rError({message:"User not found"}))
      }
    } else {
      res.send(resFormat.rSuccess())
    }
  } else {
    res.status(404).send(resFormat.rError({message:"User not found"}))
  }
}

//send otp in email to reset password
async function forgotPassword(req, res) {
  if (!req.body.email) {
    res.status(400).send(resFormat.rError({message:"Email is required for forgot passwprd."}))
  } else {
    let user = await User.findOne({
      "email": req.body.email
    })
    if (user) {
      if(user.emailVerified){
        let clientUrl = constants.clientUrl
        var link =  clientUrl + '/#/reset/' + new Buffer(user._id.toString()).toString('base64');
        await User.updateOne({ _id: user._id }, {$set: { accessToken: null,createdResetOtp: new Date()}})
        //forgot password email template
        emailTemplatesRoute.getEmailTemplateByCode("sendAdminResetPwd").then((template) => {
          if(template) {
            template = JSON.parse(JSON.stringify(template));
            let body = template.mailBody.replace("{link}", link);
            const mailOptions = {
              to : "gaurav@arkenea.com", //req.body.email,
              subject : template.mailSubject,
              html: body
            }
            sendEmail.sendEmail(mailOptions)
            res.send(resFormat.rSuccess('We have sent you reset instructions. Please check your email.'))
          } else {
            res.status(401).send(resFormat.rError('Some error Occured'))
          }
        }) // forgot password email template ends*/
      } else {
        // send OTP for verify email
        let otp = generateOTP()
        var params = {
          emailVerifiedOtp: otp,
          createdEmailVerifiedOtp: new Date()
        }
        let updatedUser = await User.updateOne({
          _id: user._id
        }, {
          $set: params
        })
        if (updatedUser) {
          let template = await emailTemplatesRoute.getEmailTemplateByCode("resendVerifySignup")
              if (template) {
                template = JSON.parse(JSON.stringify(template));
                let body = template.mailBody.replace("{otp}", otp);
                const mailOptions = {
                  to: user.email,
                  subject: template.mailSubject,
                  html: body
                }
                sendEmail.sendEmail(mailOptions)
            }
          res.status(406).send(resFormat.rError({message:"Your email is not verify. We have sent OTP in your email. please verify OPT"}))
        }else{
          res.status(406).send(resFormat.rError({message:"Your email is not verify."}))
        }
      }

    } else {
      res.status(404).send(resFormat.rError({message:"Looks like your account does not exist. Sign up to create an account."}))
    }
  }
}

//reset password using otp
async function resetPassword(req, res) {
  if (!req.body.email) {
    res.status(400).send(resFormat.rError({message:"Email is required"}))
  } else if (!req.body.password) {
    res.status(400).send(resFormat.rError({message:"Password is required"}))
  } else if (!req.body.resetOtp) {
    res.status(400).send(resFormat.rError({message:"Otp is required"}))
  } else {
    User.findOne({ "email": req.body.email }, function(err, user){
      if (user) {
        if (user.resetOtp == req.body.resetOtp) {
          const { salt, hash } = user.setPassword(req.body.password)
          User.update({ _id: user._id }, { $set: { salt, hash, accessToken: null } }, function(err, updateResult){
            if (updateResult && !err) {
              res.send(resFormat.rSuccess({message:'Password has been changed successfully'}))
            } else {
              res.status(403).send(resFormat.rError(err))
            }
          })
      } else {
          res.status(406).send(resFormat.rError({message:"Invalid OTP"}))
        }
      } else {
        res.status(404).send(resFormat.rError({message:"Looks like your account does not exist. Sign up to create an account."}))
      }
    })

  }
}

//change password
async function changePassword(req, res) {
  if (!req.body.password) {
    res.status(400).send(resFormat.rError({message:"New password is required"}))
  } else if (!req.body.oldPassword) {
    res.status(400).send(resFormat.rError({message:"Current Password is required"}))
  } else {
    let user = await User.findById(req.body.userId)
    if (user) {
      if (!user.validPassword(req.body.oldPassword, user)) {
        res.status(406).send(resFormat.rError({message:'Invalid is password'}))
      } else {
        const { salt, hash } = user.setPassword(req.body.password)
        User.update({ _id: user._id }, { $set: { salt, hash, accessToken: null } }, function(err, updateRes){
          if (updateRes && !err) {
            res.send(resFormat.rSuccess({message:'Password has been changed successfully.'}))
          } else {
            res.status(403).send(resFormat.rError(err))
          }
        })
      }
    } else {
      res.status(404).send(resFormat.rError({message:"Looks like your account does not exist"}))
    }
  }
}

// function to change users Email Id
async function changeEmail(req, res) {
  User.find({"email":req.body.email}, { _id: 1}, function(err, checkUsers){
    if (err) {
      res.send(resFormat.rError(err))
    } else {
      if(checkUsers && checkUsers.length > 0){
        res.status(401).send(resFormat.rError({ message: "Email ID has been already registered" }))
      } else {
        // send OPT for verify email.
        let otp = generateOTP()
        let set = {}
        set.resetOtp = otp;
        User.update({ _id : req.body.userId}, { $set: set }, { runValidators: true, context: 'query' }, async (err, updateUser) =>{
          if (err){
              res.send(resFormat.rError(err))
          } else {
            let template = await emailTemplatesRoute.getEmailTemplateByCode("resendVerifySignup")
            if (template) {
              template = JSON.parse(JSON.stringify(template))
              let body = template.mailBody.replace("{otp}", otp)
              const mailOptions = {
                to: req.body.email,
                subject: template.mailSubject,
                html: body
              }
              sendEmail.sendEmail(mailOptions)
            }
            res.send(resFormat.rSuccess({message: 'OPT send in your email confirm this OPT', data: {"email": req.body.email, "userId":req.body.userId}}))
          }
        }) //end of update
      } // end of length > 0
    }
  }) //end of user find
}

// function to check user email for already registerd or not.
async function checkEmail( req, res) {
  let set = { email: req.body.email }
  User.find(set, { _id: 1}, function(err, checkUsers){
    if (err) {
      res.send(resFormat.rError(err))
    } else {
      if(checkUsers && checkUsers.length > 0){
        res.status(402).send(resFormat.rError({ message:"Email ID has been already registered" }))
      } else {
        res.send(resFormat.rSuccess())
      } // end of length > 0
    }
  }) //end of user find
}

// function to check user email for already registerd or not.
async function checkSocialMediaToken( req, res) {
  let set = { socialMediaToken: req.body.socialMediaToken }
  User.find(set, { _id: 1}, function(err, checkUsers){
    if (err) {
      res.send(resFormat.rError(err))
    } else {
      if(checkUsers && checkUsers.length > 0){
        res.status(402).send(resFormat.rError({ message:"User has been already registered" }))
      } else {
        res.send(resFormat.rSuccess())
      } // end of length > 0
    }
  }) //end of user find
}

//set password while signUp
async function setPassword(req, res) {
  if(!req.body.password) {
    res.status(400).send(resFormat.rError({message:"Password is required"}))
  } else if (req.body.email == "" || req.body.email == undefined) {
    res.status(400).send(resFormat.rError({ message:"Invalid request. Email is requierd" }))
  } else {
    let user = await User.findOne({"email": req.body.email});
    if (user) {
      const { salt, hash } = user.setPassword(req.body.password)
      User.update({ _id: user._id }, { $set: { salt, hash, accessToken: null } }, function(err, updateRes){
        if (updateRes && !err) {
            responseData = { "userId":user._id, "email":req.body.email }
          res.send(resFormat.rSuccess({message:'Password has been set successfully.', data:responseData}))
        } else {
          res.status(403).send(resFormat.rError(err))
        }
      })
    } else {
      res.status(404).send(resFormat.rError({message:"Looks like your account does not exist"}))
    }
  }
}

//function to check and signin user details
function adminSigin(req, res) {
  passport.authenticate('adminUser' ,async function (err, user, info) {
    if (err) {
      res.send(resFormat.rError(err))
    } else if (info) {
      res.send(resFormat.rError(info))
    } else if (user) {
      var token = user.generateJwt()
      const params = { accessToken: token }
      User.update({ _id: user._id }, { $set: params }, function(err, updateRes){
        if (updateRes && !err) {
          let userObj = {
            token: token,
            userId: user._id,
            username:user.email,
            user: {
              name: user.fullName,
              email: user.email,
            }
          }
          res.send(resFormat.rSuccess(userObj))
        } else {
          res.send(resFormat.rError({message:"Invalid email"}))
        }
      })
    } else {
      res.send(resFormat.rError({message:"Please enter correct password."}))
    }
  })(req, res)
}

//function to generate reset password link for admin
async function adminForgotPassword (req, res) {
  //find user based on email id
  User.findOne({"email": req.body.email, "userType":"adminUser" }, {}, async function(err, user) {
    if (err) {
      res.status(401).send(resFormat.rError(err))
    } else if(!user){
      res.send(resFormat.rError("This email is not registered. Use registered email for forgot password."))
    } else{
        let clientUrl = constants.clientUrl
        var link =  clientUrl + '/reset/' + new Buffer(user._id.toString()).toString('base64');
        await User.updateOne({ _id: user._id }, {$set: { accessToken: null,createdResetOtp: new Date()}})
        //forgot password email template
        emailTemplatesRoute.getEmailTemplateByCode("sendAdminResetPwd").then((template) => {
          if(template) {
            template = JSON.parse(JSON.stringify(template));
            let body = template.mailBody.replace("{link}", link);
            const mailOptions = {
              to : req.body.email, //gaurav@arkenea.com
              subject : template.mailSubject,
              html: body
            }
            sendEmail.sendEmail(mailOptions)
            res.send(resFormat.rSuccess('We have sent you reset instructions. Please check your email.'))
          } else {
            res.status(401).send(resFormat.rError('Some error Occured'))
          }
        }) // forgot password email template ends*/
      }
  }) // find user based on email id ends
}

//function to reset the password
const adminResetPassword = function(req,res) {
  User.findOne({_id: mongoose.Types.ObjectId(new Buffer(req.body.userId, 'base64').toString('ascii'))}, function(err, userDetails) {
    if (err) {
      res.send(resFormat.rError(err))
    } else {
      var expiryTime = new Date(userDetails.createdResetOtp);
      expiryTime.setMinutes(expiryTime.getMinutes() + 15);
      expiryTime = new Date(expiryTime);
      if(new Date() < new Date( expiryTime )){
        const user = new User()
        const { salt, hash } = user.setPassword(req.body.password)
        User.update({ _id: userDetails._id},{ $set: { salt, hash}} ,(err, updatedUser)=>{
          if (err) {
            res.send(resFormat.rError(err))
          } else {
            res.send(resFormat.rSuccess({userType:userDetails.userType, message:'Password has been updated'}))
          }
        })
      }else{
        res.send(resFormat.rError({message:"Your link is expire. Please try again."}))
      }
    }
  })
}

// function to get user email id
async function getUserEmail (req,res) {
  User.findOne({_id: mongoose.Types.ObjectId(new Buffer(req.body.userId, 'base64').toString('ascii'))},{ email:1 }, function(err, userDetails) {
    if (err) {
      res.send(resFormat.rError(err))
    } else {
      res.send(resFormat.rSuccess({ email:userDetails.email }))
    }
  })
}

router.post("/signin", signin)
router.delete("/signout", auth, signout)
router.post("/forgotPassword", forgotPassword)
router.post("/resetPassword", resetPassword)
router.post("/changePassword", auth, changePassword)
router.post("/changeEmail", auth, changeEmail)
router.post("/checkEmail", checkEmail)
router.post("/checkSocialMediaToken", checkSocialMediaToken)
router.post("/signup", signUp)
router.post("/setpassword", setPassword)
router.post("/adminSigin", adminSigin)
router.post("/adminForgotPassword", adminForgotPassword)
router.post('/adminResetPassword', adminResetPassword)
router.post('/getUserEmail', getUserEmail)

module.exports = router
