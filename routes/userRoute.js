var express = require('express')
var router = express.Router()
var async = require('async')
const { isEmpty } = require('lodash')
const User = require('./../models/User')
var constants = require('./../config/constants')
const resFormat = require('./../helpers/responseFormat')
const sendEmail = require('./../helpers/sendEmail')
const emailTemplatesRoute = require('./emailTemplatesRoute.js')
const auth = require('./../helpers/authMiddleware')


//function to update user details
function updateProfile(req, res) {
  let params = {
    fullName: req.body.name,
    contactNumber: req.body.contactNumber,
    profession: req.body.profession
  }
  User.update({ _id: req.body.userId },{ $set: params} , function(err, updatedUser) {
      if (err) {
        res.status(403).send(resFormat.rError(err))
      } else {
        responseData = {
          "name": req.body.name,
          "contactNumber": req.body.contactNumber,
          "email": req.body.email,
          "profession": req.body.profession,
          "userId": req.body.userId
        }
        res.send(resFormat.rSuccess(responseData))
      }
  })
}

//function to update user status
function updateUserStatus(req, res) {
  let params = {
    active: req.body.active
  }
  User.update({ _id: req.body.userId },{ $set: params} , function(err, updatedUser) {
      if (err) {
        res.status(403).send(resFormat.rError(err))
      } else {
        res.send(resFormat.rSuccess())
      }
  })
}

//function to get list of user as per given criteria
async function list (req, res) {
  let { fields, offset, query, order, limit, search } = req.body
  let totalUsers = 0
  if (search && !isEmpty(query)) {
    Object.keys(query).map(function(key, index) {
      if(key !== "status" && key !== "SearchQuery") {
        query[key] = new RegExp(query[key], 'i')
      } else if (key === "SearchQuery") {
        query['$or'] = [{'fullName': new RegExp(query[key], 'i')},{'email': new RegExp(query[key], 'i')}, {'contactNumber': new RegExp(query[key], 'i')}]
        delete query.SearchQuery;
      }
    })
  }

  let userList = await User.find(query, fields);
  if(userList){
    totalUsers = userList.length
    res.send(resFormat.rSuccess({ userList, totalUsers}))
  }
  else{
    res.status(401).send(resFormat.rError(err))
  }
}

//function to get list of user as per given criteria
async function profile (req, res) {
  if (!req.body.userId || req.body.userId == "") {
    res.status(400).send(resFormat.rError("Invalid request"))
  } else {
    User.findOne({_id: req.body.userId}, function(err, user) {
        if (err) {
          res.status(403).send(resFormat.rError(err))
        } else {
          responseData = {
            "name": user.fullName,
            "contactNumber": user.contactNumber,
            "email": user.email,
            "profession": user.profession,
            "referralCode": user.referralCode,
            "userId": user._id
          }
          res.send(resFormat.rSuccess(responseData))
        }
    })
  }
}


//function to update user details
async function adminProfileUpdate(req, res) {
  let user = await User.findById(req.body.userId)
   var set  = {}
   var isUpdate = true
   var errorResponce = "";
    if (user) {
      if (req.body.email && req.body.email !="") {
        await User.find({email:req.body.email, userType:"adminUser", _id:{ $ne: user._id }}, { _id: 1}, function(err, checkUsers){
            if (err) {
              res.send(resFormat.rError(err))
            } else {
              if(checkUsers && checkUsers.length > 0){
                res.send(resFormat.rError({message: "Email has been already registered" }))
              } else {
                set.email = req.body.email;
                  let upateUser = User.update({ _id: user._id }, { $set:set }, function (err, updateEmail){
                    if(err) {
                      res.send(resFormat.rError(err))
                    } else {
                      cbEmail = user.email;
                      if (req.body.email) {
                        cbEmail = req.body.email;
                      }
                      res.send(resFormat.rSuccess({email:cbEmail ,message:'Email has been changed successfully.'}))
                    }
                  })
              } // end of length > 0
            }
          })
       } else if (req.body.password && req.body.password !="") {
        if (!req.body.oldPassword || req.body.oldPassword != ""){
          if (!user.validPassword(req.body.oldPassword, user)) {
            res.send(resFormat.rError({ message:"Invalid current password" }))
          } else {
            const {
              salt,
              hash
            } = user.setPassword(req.body.password)
            set.salt = salt;
            set.hash = hash;

            User.update({ _id: user._id }, { $set:set }, function(err, updatepassword){
              if(err){
                res.send(resFormat.rError(err))
              }else{
                cbEmail = user.email;
                res.send(resFormat.rSuccess({email:cbEmail ,message:'Password has been changed successfully.'}))
              }
            })
          }
        } else {
          res.send(resFormat.rError({message:"Current password is required to change password"}))
        }
      }
    } else {
      res.send(resFormat.rError({message:"Looks like your account does not exist"}))
    }
}

router.post("/updateProfile", auth, updateProfile)
router.post("/list",list) //, auth
router.post("/profile", auth, profile)
router.post("/adminProfileUpdate", adminProfileUpdate) //auth,updateUserStatus
router.post("/updateUserStatus", updateUserStatus)

module.exports = router
