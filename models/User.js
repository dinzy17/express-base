var mongoose = require( 'mongoose' )
var uniqueValidator = require('mongoose-unique-validator')
var crypto = require('crypto')
var jwt = require('jsonwebtoken')
var constants = require("./../config/constants")


var userSchema = new mongoose.Schema({
  email: {
    type: String,
  },
  fullName: String,
  contactNumber: String,
  salt: String,
  hash: String,
  resetOtp: Number,
  createdResetOtp: Date,
  emailVerifiedOtp: Number,
  createdEmailVerifiedOtp: Date,
  profession: String,
  accessToken: String,
  deviceTokens: Array,
  subscriptions: Array,
  socialMediaToken: String,
  socialPlatform: String,
  referralCode: String,
  createdAt: Date,
  updatedAt: Date,
  active: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: true },
  userType:{ type: String, default: "appUser" }
})


//function to set password
userSchema.methods.setPassword = (password) => {
  this.salt = crypto.randomBytes(16).toString('hex')
  this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex')
  return { salt: this.salt, hash: this.hash}
}

//function to validate password
userSchema.methods.validPassword = (password, user) => {
  if(user.salt) {
    var hash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex')
    return user.hash === hash
  }
  return -1
}

//function to generate token which is signed by id and email_id with expiry
userSchema.methods.generateJwt = () => {
  var expiry = new Date()
  expiry.setDate(expiry.getDate() + 365)

  return jwt.sign({
    _id: this._id,
    username: this.username,
    fullName: this.fullName,
    exp: parseInt(expiry.getTime() / 1000),
  }, constants.jwtSecret)
}


module.exports = mongoose.model('User', userSchema)
userSchema.plugin(uniqueValidator)
