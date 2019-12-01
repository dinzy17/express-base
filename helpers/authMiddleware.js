const jwt = require('jsonwebtoken')
const CONFIG = require('../config/constants')
const Message = require('../config/messages')
const User = require('./../models/User')
const resFormat = require('./../helpers/responseFormat')

module.exports = (req, res, next) => {
  var token
  if ('authorization' in req.headers) {
    token = req.headers['authorization'].split(' ')[1]
  } else {
    token = req.body.accessToken
  }
  if (!token) {
    return res.status(401).send(resFormat.rError({auth: false, message: Message.en.auth[16]}))
  } else {
    jwt.verify(token, CONFIG.jwtSecret, (err, decoded) => {
        if (err) {
          return res.status(401).send(resFormat.rError({auth: false, message:Message.en.auth[17]}))
        } else {
            User.findOne({ accessToken: token }, function(err, user) {
              if (err || !user) {
                return res.status(401).send(resFormat.rError({auth: false, message:Message.en.auth[17]}))
              } else {
                req.headers.userId = user._id
                next()
              }
            })
        }
    })
  }
}
