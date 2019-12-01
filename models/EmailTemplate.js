var mongoose = require( 'mongoose' )
var constants = require("./../config/constants")

var emailTemplateSchema = new mongoose.Schema({
  type: String,
  templateCode: String,
  title: String,
  mailSubject: String,
  mailBody: String,
  status: String,
  createdOn: Date,
  modifiedOn: Date
})

module.exports = mongoose.model('emailtemplates', emailTemplateSchema)
