var express = require('express')
var router = express.Router()
var EmailTemplate = require('./../models/EmailTemplate.js')
var constants = require('./../config/constants')
const resFormat = require('./../helpers/responseFormat')
const { isEmpty } = require('lodash')

//function to update email template
function update(req, res) {

    EmailTemplate.update({ _id: req.body._id },{ $set: req.body} ,(err, updateEmailTemplate)=>{
    if (err) {
      res.send(resFormat.rError(err))
    } else {
      res.send(resFormat.rSuccess('Email Template has been updated'))
    }
  })
}

//function to get list of email templates as per given criteria
function list(req, res) {
  let { fields, offset, query, order, limit, search } = req.body
  let totalRecords = 0
  if (search && !isEmpty(query)) {
    Object.keys(query).map(function(key, index) {
      if(key !== "status") {
        query[key] = new RegExp(query[key], 'i')
      }
    })
  }
  EmailTemplate.count(query, function(err, templateCount) {
    if(templateCount) {
      totalRecords = templateCount
    }
    EmailTemplate.find(query, fields, function(err, templateList) {
      if (err) {
        res.status(401).send(resFormat.rError(err))
      } else {
        res.send(resFormat.rSuccess({ templateList, totalRecords}))
      }
    }).sort(order).skip(offset).limit(limit)
  })
}

//function get details of global settings
function view (req, res) {
  const { query, fields } = req.body
  EmailTemplate.findOne(query, fields , function(err, templateDetails) {
    if (err) {
      res.status(401).send(resFormat.rError(err))
    } else {
      res.send(resFormat.rSuccess(templateDetails))
    }
  })
}

// Function to get emailTemplate by code
async function getEmailTemplateByCode (code) {
  let template = await EmailTemplate.findOne({templateCode: code})
  if(template){
    return template
  }

}


router.post("/update", update)
router.post("/list", list)
router.post("/view", view)
router.getEmailTemplateByCode = getEmailTemplateByCode

module.exports = router
