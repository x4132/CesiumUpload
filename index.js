(function () {
    const $ = a => { return document.querySelector(a) };

    const aws = require("aws-sdk");
    const request = require("request-promise");
    const fs = require("fs");

    var uploadKey = "";

    //login event listener
    $("#login").addEventListener("click", () => {
        uploadKey = $("#uploadKey").value;
        $("#view1").style.display = "none";
        $("#view2").style.display = "block";
    });

    //file upload event listener
    $("#uploadButton").addEventListener("click", () => {
        if ($("#file").files.length < 1) {
            alert("Please add a file to upload.");
            return;
        } else upload();
    });

    async function upload() {
        $("#view2").style.display = "none";
        $("#view3").style.display = "block";
        $("#uploadStatus").textContent = "Preparing Upload...";

        const pos = $("#lat").value !== "" && $("#ldt").value !== "" && $("#height").value !== "" ? [Number($("#ldt").value), Number($("#lat").value), Number($("#height").value)] : undefined;

        const postBody = {
            name: $("#name").value,
            description: "",
            type: $("#type").value,
            options: {
                sourceType: $("#fileType").value,
                clampToTerrain: true,
                baseTerrainId: 1,
                position: pos
            }
        }
        
        console.log("pre");
        console.log({
            url: 'https://api.cesium.com/v1/assets',
            method: 'POST',
            headers: { Authorization: `Bearer ${uploadKey}` },
            json: true,
            body: postBody
        })
        const response = await request({
            url: 'https://api.cesium.com/v1/assets',
            method: 'POST',
            headers: { Authorization: `Bearer ${uploadKey}` },
            json: true,
            body: postBody
        })
        console.log("post");

        $("#uploadStatus").textContent = "Preparing Upload...";

        const uploadLocation = response.uploadLocation

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

        var fullPath = document.getElementById('file').value;
        var out;
        if (fullPath) {
            var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
            var filename = fullPath.substring(startIndex);
            if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
                filename = filename.substring(1);
            }
            out = filename;
        }

        $("#uploadStatus").textContent = "Uploading...";

        await s3.upload({
            Body: fs.createReadStream($("#file").files[0].path),
            Bucket: uploadLocation.bucket,
            Key: `${uploadLocation.prefix}${out}`
        }).promise();

        $("#uploadStatus").textContent = "Preparing Tiling process..."
        const onComplete = response.onComplete;
        await request({
            url: onComplete.url,
            method: onComplete.method,
            headers: { Authorization: `Bearer ${uploadKey}` },
            json: true,
            body: onComplete.fields
        });

        async function waitUntilReady() {
            const assetId = response.assetMetadata.id;

            // Issue a GET request for the metadata
            const assetMetadata = await request({
                url: `https://api.cesium.com/v1/assets/${assetId}`,
                headers: { Authorization: `Bearer ${uploadKey}` },
                json: true
            });

            const uploadStatus = assetMetadata.status;
            if (uploadStatus === 'COMPLETE') {
                $("#uploadStatus").textContent = "Asset Tiled Successfuly. You may now close this window and view your model in cesium."
            } else if (uploadStatus === 'DATA_ERROR') {
                $("#uploadStatus").textContent = "tiling error."
            } else if (uploadStatus === 'ERROR') {
                $("#uploadStatus").textContent = 'An unknown tiling error occurred, please contact support@cesium.com.'
            } else {
                if (uploadStatus === 'NOT_STARTED') {
                    $("#uploadStatus").textContent = "Preparing Tiling Process..."
                } else { // IN_PROGRESS
                    $("#uploadStatus").textContent = `Asset is ${assetMetadata.percentComplete}% complete.`
                }

                // Not done yet, check again in 10 seconds
                setTimeout(waitUntilReady, 500);
            }
        }

        waitUntilReady();
    }
})();