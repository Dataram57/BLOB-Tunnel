/*================================================================
This application is an agent / a tool to communicate with the public tunnel, in order to establish some connection between private servers and the outside client.
//================================================================*/
//#region Config
//IO
const baseDir = 'base/';
const readChunkLength = 1024;
//API and Panel
const serverPort = 6060;
const apiPrefix = '/api/';
const apiPrefixSubCount = apiPrefix.split('/').length;
const panelPrefix = '/panel/';
const panelDirPath = __dirname + '/Panel/';
//Tunnel
const tunnelURL = 'localhost';
const useSSL = false;
const openedTransferMaxCount = 30;
//Download Service
const downloadServiceSecretKey = 'zaq1"WSX';
//Upload Service
const uploadServiceSecretKey = 'ZAQ!2wsx';
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
const RandomAccessFile = require('random-access-file');
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

const GetWebSocketURL = () => {
    if(useSSL)
        return 'wss:' + tunnelURL;
    return 'ws:' + tunnelURL; 
};

const GetRAFTargetFile = (raf) => {
    if(raf.directory)
        return raf.directory + raf.filename;
    return raf.filename;
};

const KeyToString = (key) => {
    if(key === null)
        return "Closing...";
    return key.toString();
};

const ScanChainForSessionKey = (head, key) => {
    while(head)
        if(head._key == key)
            return head;
        else
            head = head.chainFront;
    return null;
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
        res.write(JSON.stringify({
            key: KeyToString(session._key)
            ,targetFile: GetRAFTargetFile(session._fr)
            ,fileName: session._fileName
            ,offset: session._offset
            ,length: session._length
            ,state: session._state
        }));
        session = session.chainFront;
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
        session = session.chainFront;
        if(--i > 0)
            res.send(',');
    }
    res.write(']');
    //end JSON
    res.end('}');
});

//startDownload/$targetFile/$fileName
app.get(apiPrefix + 'startDownload/*', async function (req, res) {
    //check URL minimum
    const args = req.url.split('/');
    if(args.length < 2 + apiPrefixSubCount){
        //error
        res.send({error:'URL does not contain all the necessary arguments.'});
        res.end();
        return;
    }
    //read params
    let filePath = decodeURIComponent(args[apiPrefixSubCount]);
    const fileName = decodeURIComponent(args[apiPrefixSubCount + 1]);
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
            res.send({error:'File at $filePath does not exist.'});
            res.end();
            return;
        }
    }
    //create a tunnel
    const response = await CreateDownloadSession(filePath, fileName);
    res.send(response);
    res.end();
});

//killDownload/$key
app.get(apiPrefix + 'killDownload/*', function (req, res) {
    //check URL minimum
    const args = req.url.split('/');
    if(args.length <= apiPrefixSubCount){
        //error
        res.send(false);
        return;
    }
    //read Key
    //search for session
    const socket = ScanChainForSessionKey(downloadSessionChain.head, args[apiPrefixSubCount]);
    //check
    if(socket === null)
        res.send(false);
    else{
        CloseDownloadSession(socket);
        res.send(true);
    }
});


//#endregion

//----------------------------------------------------------------
//#region Panel
app.get('/', function (req, res) {
    res.redirect('/panel/');
});

//Simple Panel explorer
app.get(panelPrefix + '*', function (req, res) {
    let target = req.originalUrl.substring(panelPrefix.length).trim();
    //every file must have an extension
    //otherwise it will be treated as index.html
    const i = target.lastIndexOf('/') - target.lastIndexOf('.');
    if(i >= 0){
        //target is not refering to the file
        //so it must be a page
        //check if '/' at end
        if(i == 0)
            target += '/';
        target += 'index.html';
    }
    //send target (page or file)
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

//Chain of all successfully initiated and allowed to be handled, sessions.
const downloadSessionChain = new ChainArray();

//Creates a download session
//returns the JSON containing either a key or an error.
const CreateDownloadSession = (targetFile, fileName) => {
    return new Promise(resolve => {
        //create a file reader
        //IMPORTANT: RandomAccessFile will only throw an error at reading
        //That's why it is important to make checks of the target file earlier
        //Or force it to do a check or throw an error
        const fr = new RandomAccessFile(targetFile);
        fr.stat((err, stat) => {
            if(err){
                resolve({error: "Couldn't read the file stats."});
                return;
            }
            //check the file stat
            if(typeof(stat.size) != 'number'){
                resolve({error: "The size of the file was not read in an understandable format."});
                return;
            }
            //check weird size
            else if(stat.size < 0){
                resolve({error: "The size of the file is below 0."});
                return;
            }
            //create a connection
            const socket = new WebSocket(GetWebSocketURL(), {
                perMessageDeflate: false,
                headers: {
                    key: downloadServiceSecretKey
                }
            });
            //assign events and properties
            //metadata
            socket._fileName = fileName;
            //file reading
            socket._fr = fr;                //File reader object
            socket._length = stat.size;     //Length of the file
            socket._offset = 0;             //current file offset (must be < _length)
            //state
            socket._key = '';               //invitation key
            socket._resolver = resolve;     //called once and only when key is recieved
            //add to chain
            downloadSessionChain.Add(socket);
            //events
            SetupDownloadSessionEvents(socket);
        });
    });
};

//Assigns download behaviour to the given WebSocket connection
const SetupDownloadSessionEvents = (socket) => {
    //on open
    socket.on("open", e => {
        //Send the setup
        const setup = {
            fileName: socket._fileName
            ,fileSize: socket._length
            , chunkLength: readChunkLength
        };
        socket.send(JSON.stringify(setup));
    });

    //on message
    socket.on("message", msg => {
        //key
        if(msg.subarray(0,4).toString() == 'key;'){
            //key is not set yet or has changed
            socket._key = msg.subarray(4).toString();
            //call the callback
            if(socket._resolver){
                socket._resolver({key: socket._key});
                socket._resolver = undefined;
            }
        }
        //next
        else if(msg.subarray(0,5).toString() == 'next;'){
            //wants to send the next chunk of the data.
            socket._fr.read(socket._offset, Math.min(readChunkLength, socket._length - socket._offset), (err, raw) => {
                if(err){
                    console.log(err)
                }
                //send chunk
                socket.send(raw);
                //next
                socket._offset += readChunkLength;
                //check if EOF
                if(socket._offset >= socket._length)
                    //Finish Session.
                    CloseDownloadSession(socket);
            });
        }
    });

    //on close
    socket.on("close", e => {
        console.log(e);
        //recognize the state
        //...
        if(socket._offset < socket._length){
            //Tunnel has closed the connection while the reading has not been finished
            CloseDownloadSession(socket)
        }
        else
            //everything has went fine
            CloseDownloadSession(socket);
    });

    //on error
    socket.on("error", err => {
        console.log(err);
        //recognize the state
        //...
        if(socket._offset < socket._length){
            //Tunnel has closed the connection while the reading has not been finished
            CloseDownloadSession(socket)
        }
        else
            //everything has went fine
            //so there is no need to worry about the client/error
            CloseDownloadSession(socket);
    });
};

const CloseDownloadSession = (socket) => {
    //don't call it again
    if(socket._key === null)
        return;
    //mark as it is being closed
    console.log('Closing download session:',KeyToString(socket._key));
    socket._key = null;
    //close file stream
    socket._fr.close((err) => {
        if(err)
            console.log(err);
        //delist from the chain
        downloadSessionChain.Remove(socket);
        //close WebSocket
        socket.close();
    });
};

//#endregion

//================================================================
//#region Upload Tunnel Service

//Chain of all successfully initiated and allowed to be handled, sessions.
const uploadSessionChain = new ChainArray();

//#endregion