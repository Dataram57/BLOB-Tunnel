/*================================================================
This application is an agent / a tool to communicate with the public tunnel, in order to establish some connection between private servers and the outside client.
//================================================================*/
//#region Config

//API and Panel
const serverPort = 6060;
const apiPrefix = '/api/';
const panelPrefix = '/panel/';
const panelDirPath = __dirname + '/Panel/';
//Tunnel
const tunnelURL = 'localhost';
const useSSL = false;
const openedTransferMaxCount = 30;
//IO
const baseDir = 'base/';
const chunkLength = 1024;
//Additional Callbacker
const callbackerModulePath = './app_agent_callbacker.js';
//Used functions:
//StartedDownloading(session)
//FinishedDownloading(session)
//StartedUploading(session)
//FinishedUploading(session)

//#endregion

//================================================================
//#region Requirements and consts

console.clear();
const func_NULL = () => {};
const Callbacker = (callbackerModulePath) ? require(callbackerModulePath) : {
    StartedDownloading: func_NULL
    ,FinishedDownloading: func_NULL
    ,StartedUploading: func_NULL
    ,FinishedUploading : func_NULL
};
const ChainArray = require('./ChainArray.js');
const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const RandomAccessFile = require('random-access-file')
const app = express();
//#endregion

//================================================================
//#region Utilities

const FileExists = (path) => {
    return new Promise(resolve => {
        fs.stat(path, (err, stats) => {
            if (err || !stats.isFile()) 
                resolve(false);
            else 
                resolve(true);
        });
    });
};

//#endregion

//================================================================
//#region HTTP server

//----------------------------------------------------------------
//#region API

///
app.get(apiPrefix, function (req, res) {
    res.end('Tunnel Agent API');
});

//ping
app.get(apiPrefix + 'ping', function (req, res) {
    res.end('pong');
});

//list
app.get(apiPrefix + 'list', function (req, res) {
    //start JSON
    res.write('{');
    //DownloadService
    res.write('"DownloadService":[');
    let session = downloadSessionChain.head;
    let i = downloadSessionChain.length;
    while(session){
        res.write({
            key: session._key
            ,targetFile: session._targetFile
            ,progress: session._progress
            ,leftProgress: session._leftProgress
        });
        if(--i > 0)
            res.write(',');
    }
    res.write(']');
    //next
    res.write(',');
    //UploadService
    res.write('"UploadService":[');
    session = uploadSessionChain.head;
    i = uploadSessionChain.length;
    while(session){
        res.write({
            key: session._key
            ,targetFile: session._targetFile
            ,targetLength: session._targetLength
            ,leftLength: session._leftLength
        });
        if(--i > 0)
            res.send(',');
    }
    res.write(']');
    //end JSON
    res.end('}');
});

//startDownload

//#endregion
app.get(apiPrefix + 'startDownload/*', async function (req, res) {
    console.log(req.url);
    //check URL minimum
    const args = req.url.split('/');
    if(args.length < 3){
        //error
        res.send({error:'URL does not contain all the necessary arguments.'});
        res.end();
        return;
    }
    //read params
    const fileName = decodeURIComponent(args.length - 1);
    let filePath = decodeURIComponent(args.length - 2);
    //check params
    if(fileName.trim().length == 0){
        //error
        res.send({error:'$fileName is empty.'});
        res.end();
        return;
    }
    //check file existance
    //1.check if path is direct
    if(!await FileExists(filePath)){
        //2.check if path is relative
        filePath = baseDir + filePath;
        if(!await FileExists(filePath)){
            //error
            res.send({error:'$fileName is empty.'});
            res.end();
            return;
        }
    }
    //create a tunnel
    let key = await CreateDownloadSession(filePath, fileName);
});

//----------------------------------------------------------------
//#region Panel
app.get('/', function (req, res) {
    res.redirect('/panel/');
});

app.get(panelPrefix + '*', function (req, res) {
    let target = req.originalUrl.substring(panelPrefix.length).trim();
    if(target.length == 0)
        target = 'index.html';
    res.sendFile(panelDirPath + target);
});

//#endregion

//----------------------------------------------------------------
//#region Launch the HTTP server

app.listen(serverPort);

//#endregion

//#endregion

//================================================================
//#region Download Tunnel Service

const downloadSessionChain = new ChainArray();

const CreateDownloadSession = async (targetFile, fileName) => {
    
    

};

//#endregion

//================================================================
//#region Upload Tunnel Service

const uploadSessionChain = new ChainArray();

//#endregion