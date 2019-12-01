const fs = require('fs')
const AWS = require('aws-sdk')
const constants =  require('./../config/constants')
const path = require("path")

const s3 = new AWS.S3({
    accessKeyId: constants.awsS3.accessKey,
    secretAccessKey: constants.awsS3.secretAccessKey
});

const uploadFile = (filename, filePath) => {
  console.log("filename => ", filename)
  let imgFullPath = path.join(__dirname, '../', filePath, filename)
  console.log("imgFullPath => ",imgFullPath)
  return new Promise(function(resolve, reject) {

    if (fs.existsSync(imgFullPath)) {
      console.log("File exists")
     fs.readFile(imgFullPath, (err, data) => {
       if (err){
         console.log(err)
         reject(err)
       }
       const params = {
          Bucket: constants.awsS3.bucket,
          Key: filename,
          Body: data
       }
       console.log("Reading file")
       s3.upload(params, function(s3Err, data) {
         if (s3Err) {
           console.log(s3Err)
           return s3Err
         } else {
           console.log(`File uploaded successfully at ${data.Location}`)
           fs.unlink(imgFullPath, (err) => {
             if (err){
               reject(err)
             }
             else {
               console.log("File removed from local")
             }
             resolve(data);
           })
         }
       })
     })
    } else {
      console.log("file not found")
      reject("Some error occured.")
    }
  })
}
module.exports = { uploadFile }
