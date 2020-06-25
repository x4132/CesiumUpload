const aws = require("aws-sdk");
const request = require("request-promise");
document.querySelector("button").addEventListener("click", upload);
function upload() {
    var $ = a => { return document.querySelector(a) }
    var status = $("span").textContent;
    var accessToken = $("#token").value;
    status = "initializing";
    var response;

    const postBody = {
        name: $("#name").value,
        description: "",
        type: $("#type").value,
        options: {
            sourceType: $("#fileType").value,
            clampToTerrain: true,
            baseTerrainId: 1,
            position: [Number($("#lat")), Number($("#ldt")), Number($("#height"))]
        }
    }
    console.log($("#token"));
    request({
        url: 'https://api.cesium.com/v1/assets',
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        json: true,
        body: postBody
    }).then(resp => {
        response = resp
        status = "preparing upload";
        const uploadLocation = response.uploadLocation;

        const s3 = new aws.S3({
            apiVersion: '2006-03-01',
            region: 'us-east-1',
            signatureVersion: 'v4',
            endpoint: uploadLocation.endpoint,
            credentials: new aws.Credentials(
                uploadLocation.accessKey,
                uploadLocation.secretAccessKey,
                uploadLocation.sessionToken
            )
        });

        const fs = require('fs');
        s3.upload({
            Body: new Blob($("#file").files[0]),
            Bucket: uploadLocation.bucket,
            Key: `${uploadLocation.prefix}${getFileName($("#file"))}`
        }).promise().then(() => {
            const onComplete = response.onComplete;
            request({
                url: onComplete.url,
                method: onComplete.method,
                headers: { Authorization: `Bearer ${accessToken}` },
                json: true,
                body: onComplete.fields
            }).then(() => {

            });
        });
    });
}

function getFileName(file) {
    var fullPath = file.value;
    if (fullPath) {
        var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
        var filename = fullPath.substring(startIndex);
        if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
            filename = filename.substring(1);
        }
        return filename;
    }
}