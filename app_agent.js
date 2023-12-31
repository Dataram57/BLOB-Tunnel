//================================================================
//
//This application is an agent / a tool to communicate with the public tunnel, in order to establish some connection between private servers and the outside client.
//
//================================================================
//#region Requirements and consts

console.clear();
console.log('================================================================');
const func_NULL = () => {};
const ChainArray = require('./ChainArray.js');
const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const RandomAccessFile = require('random-access-file');
const { json } = require('express');
const { rejects } = require('assert');
const app = express();
//#endregion

//================================================================
//#region Config

//load config

let temp = JSON.parse(fs.readFileSync('agent_config.json'));

//IO
const baseDir = temp.baseDir;        //Directory with 777 access
const readChunkLength = temp.readChunkLength;
//API and Panel
const serverPort = temp.serverPort;
const apiPrefix = temp.apiPrefix;
const apiPrefixSubCount = apiPrefix.split('/').length;
const panelPrefix = temp.panelPrefix;
temp.panelDirPath = temp.panelDirPath.trim();
if(temp.panelDirPath.indexOf('./') == 0)
    temp.panelDirPath = __dirname + '/' + temp.panelDirPath.substring(2);
const panelDirPath = temp.panelDirPath;
//Tunnel
const tunnelURL = temp.tunnel.address;
const tunnelUseSSL = temp.tunnel.useSSL;
//Download Service
const downloadServiceSecretKey = temp.tunnel.download.key;
//Upload Service
const uploadServiceSecretKey = temp.tunnel.upload.key;
const uploadServiceLockFiles = temp.tunnel.upload.lockFiles;
//Additional Callbacker
const Boss = require(temp.bossModulePath);
//pass the config to the boss
Boss.ApplyConfig(temp);
//forget config
temp = null;

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
    if(tunnelUseSSL)
        return 'wss:' + tunnelURL;
    return 'ws:' + tunnelURL; 
};

const GetHttpUrl = () => {
    if(tunnelUseSSL)
        return 'https://' + tunnelURL;
    return 'http://' + tunnelURL; 
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

const ReadLastParameterFromURL = (url) => decodeURIComponent(url.substring(url.lastIndexOf('/') + 1));

const ReadJSONConfigFromURL = (url) => {
    //trim
    url = ReadLastParameterFromURL(url);
    //try to parse
    try{
        return JSON.parse(url);
    }
    catch(e){
        return null;
    }
};

const SessionCheckResolver = (session, returnValue) => {
    if(session._resolver){
        session._resolver(returnValue);
        session._resolver = undefined;
        return true;
    }
    return false;
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
 
//info
app.get(apiPrefix + 'info', function (req, res) {
    res.send({
        address: tunnelURL
        ,useSSL: tunnelUseSSL
    });
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
        res.write(JSON.stringify({
            key: KeyToString(session._key)
            ,length: session._length
            ,targetLength: session._maxLength
            ,targetFile: 'dd'
        }));
        session = session.chainFront;
        if(--i > 0)
            res.write(',');
    }
    res.write(']');
    //end JSON
    res.end('}');
});

//startDownload/$config
app.get(apiPrefix + 'startDownload/*', async function (req, res) {
    //read config
    const config = ReadJSONConfigFromURL(req.url);
    //check if JSON
    if(!config){
        res.send({error: 'Config is not in a right format.'});
        return;
    }
    //check params types
    if(typeof(config.targetFile) != 'string' || typeof(config.fileName) != 'string'){
        res.send({error: 'Config is not in a right format.'});
        return;
    }
    //check config parameters
    if(config.fileName.trim().length == 0){ 
        //error
        res.send({error:'$fileName is empty.'});
        return;
    }
    //check file existance
    //1.check if path is direct
    if(!await FileExists(config.targetFile)){
        //2.check if path is relative
        config.targetFile = baseDir + config.targetFile;
        if(!await FileExists(config.targetFile)){
            //error
            res.send({error:'File at $targetFile does not exist.'});
            return;
        }
    }
    //create a tunnel
    const response = await CreateDownloadSession(config);
    //Check error
    if(response.error){
        res.send(response);
        return;
    }
    //Check Boss
    if(response.key){
        //create Boss note
        response.session._bossNote = {};
        //ask boss
        const problem = await Boss.DownloadStart(response.session._bossNote, config);
        if(problem){
            //kill session
            CloseDownloadSession(ScanChainForSessionKey(downloadSessionChain.head, response.key));
            //send problem
            res.send(problem);
            return;
        }
    }
    //Everything went ok with creating a session
    //avoid ciruclaration
    response.session = undefined;
    //add parameters to this key
    response.fullAddress = GetHttpUrl() + "/download/" + response.key;
    //send key
    res.send(response);
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

//startUpload/$config
app.get(apiPrefix + 'startUpload/*', async function (req, res) {
    //read config
    const config = ReadJSONConfigFromURL(req.url);
    //check if JSON
    if(!config){
        res.send({error: 'Config is not in a right format.'});
        return;
    }
    //check config parameters
    if(typeof(config.outputPath) != 'string' || typeof(config.chunkLength) != 'number' || typeof(config.maxFileSize) != 'number'){
        res.send({error: 'Config is not in a right format.'});
        return;
    }
    //check optional
    if(config.lock)
        if(typeof(config.lock) != 'boolean'){
            res.send({error: 'Config is not in a right format.'});
            return;
        }
    //check numbers
    if(config.chunkLength <= 0){
        res.send({error: "$chunkLength can not be below or equal to 0."});
        return;
    }
    if(config.maxFileSize <= 0){
        res.send({error: "$maxFileSize can not be below or equal to 0."});
        return;
    }
    //correct the path
    config.outputPath = baseDir + config.outputPath;
    //try to open an upload session
    const response = await CreateUploadSession(config);
    //Check error
    if(response.error){
        res.send(response);
        return;
    }
    //Check Boss
    if(response.key){
        //create Boss note
        response.session._bossNote = {};
        //ask boss
        const problem = await Boss.UploadStart(response.session._bossNote, config);
        if(problem){
            //kill session
            CloseUploadSession(ScanChainForSessionKey(uploadSessionChain.head, response.key));
            //send problem
            res.send(problem);
            return;
        }
    }
    //Everything went ok with creating a session
    //avoid ciruclaration
    response.session = undefined;
    //add parameters to this key
    response.fullAddress = GetWebSocketURL() + "/upload/" + response.key;
    //return result
    res.send(response);
});

//killUpload/$key
app.get(apiPrefix + 'killUpload/*', function (req, res) {
    //check URL minimum
    const args = req.url.split('/');
    if(args.length <= apiPrefixSubCount){
        //error
        res.send(false);
        return;
    }
    //read Key
    //search for session
    const socket = ScanChainForSessionKey(uploadSessionChain.head, args[apiPrefixSubCount]);
    //check
    if(socket === null)
        res.send(false);
    else{
        CloseUploadSession(socket);
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
const CreateDownloadSession = (config) => {
    return new Promise(resolve => {
        //create a file reader
        //IMPORTANT: RandomAccessFile will only throw an error at reading
        //That's why it is important to make checks of the target file earlier
        //Or force it to do a check or throw an error
        const fr = new RandomAccessFile(config.targetFile);
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
            socket._fileName = config.fileName;
            //file reading
            socket._fr = fr;                //File reader object
            socket._length = stat.size;     //Length of the file
            socket._offset = -1;             //current file offset (must be < _length)
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
            ,chunkLength: readChunkLength
        };
        socket.send(JSON.stringify(setup));
    });

    //on message
    socket.on("message", msg => {
        //ignore if closing
        if(socket._key === null)
            return;
        //key
        if(msg.subarray(0,4).toString() == 'key;'){
            //key is not set yet or has changed
            socket._key = msg.subarray(4).toString();
            //call the callback
            SessionCheckResolver(socket, {
                key: socket._key
                ,session: socket
            });
        }
        //next
        else if(msg.subarray(0,5).toString() == 'next;'){
            //correct info for future state
            if(socket._offset < 0)
                socket._offset = 0;
            //wants to send the next chunk of the data.
            const step = Math.min(readChunkLength, socket._length - socket._offset);
            socket._fr.read(socket._offset, step, (err, raw) => {
                if(err){
                    console.log(err)
                }
                //send chunk
                socket.send(raw);
                //next
                socket._offset += step;
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
        //check if it had a resolver
        SessionCheckResolver(socket, {error: "Couldn't get the key of the download session."});
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
        //check if it had a resolver
        SessionCheckResolver(socket, {error: "Couldn't get the key of the download session."});
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
    //block null
    if(!socket) 
        return;
    //don't call it again
    if(socket._key === null)
        return;
    //remember the key
    const key = socket._key;
    //mark as it is being closed
    socket._key = null;
    //remove events
    socket.removeAllListeners();
    //close file stream
    socket._fr.close((err) => {
        if(err)
            console.log(err);
        //delist from the chain
        downloadSessionChain.Remove(socket);
        //close WebSocket
        socket.close();
        //check if it had a resolver
        //Boss
        Boss.DownloadEnd({
            bossNote: socket._bossNote
            ,length: socket._offset
            ,maxLength: socket._length
        });
    });
};

//#endregion

//================================================================
//#region Upload Tunnel Service

//Chain of all successfully initiated and allowed to be handled, sessions.
const uploadSessionChain = new ChainArray();

//Opens up an upload special File Writer
const CreateWriteStream = (filePath, lockFile) => {
    return new Promise(resolve => {
        if(lockFile){
            //check if the file is locked

            //try to create a native connection
            fs.open(filePath, 'w', (err, fd) => {
                if(err){
                    resolve(err.code);
                }
                else
                    resolve(fs.createWriteStream(null, { fd, encoding: 'binary' }));
            });
        }
        else{
            try{
                resolve(fs.createWriteStream(filePath, { encoding: 'binary' }));
            }
            catch(err){
                resolve(err.code);
            }
        }
    });
};

//Assigns upload writer behaviour to the given File writer
const SetupUploadWriterEvents = (writer) => {
    //on open (not working)
    writer.on('open', () => {
        console.log('opened');
    });

    //on error
    writer.on('error', (err) => {
        console.error('Error writing file:', err);
        CloseUploadSession(writer._socket);
    });

    //on finish or on close
    //writer.on('finish', () => {
    //    console.log('Binary data written to output.bin');
    //});
};

//Assigns upload behaviour to the given WebSocket connection
const SetupUploadSessionEvents = (socket) => {
    //on open
    socket.on("open", e => {
        //Send the setup
        const setup = {
            maxLength: socket._maxLength
            ,chunkLength: socket._chunkLength
        };
        socket.send(JSON.stringify(setup));
    });

    //on message
    socket.on("message", msg => {
        //ignore if closing
        if(socket._key === null)
            return;
        //check if writing began
        if(socket._length == -2){
            //The client has not started uploading yet
            //The tunnel may now return only commands
            //key
            if(msg.subarray(0,4).toString() == 'key;'){
                //key is not set yet or has changed
                socket._key = msg.subarray(4).toString();
                //call the callback
                SessionCheckResolver(socket, {
                    key: socket._key
                    ,session: socket
                });
                //listen for chunks
                socket._length = -1;
            }
        }
        else{
            //correct info for future state
            if(socket._length < 0)
                socket._length = 0;
            //The client is ready for responding
            //Tunnel sends only client's chunk
            //calculate left length
            const left = socket._maxLength - socket._length;
            //check left size
            if(left <= 0){
                //The tunnel is sending more than it should. May be a hacker
                CloseUploadSession(socket);
                return;
            }
            //check if message size equals or is lower than the remaining left space to fill
            if(msg.length <= Math.min(left, socket._chunkLength)){
                //message has correct length, no need to trim
                //add length
                socket._length += msg.length;
                //write to stream
                socket._fw.write(msg, (err) => {
                    //check if EOF
                    if(socket._length >= socket._maxLength){
                        //close
                        CloseUploadSession(socket);
                    }
                    else{
                        //request next chunk
                        socket.send('next;');
                    }
                });
            }
            else{
                //message has a diffrent size than it should
                //break the connection and stop writing
                CloseUploadSession(socket);
            }
        }
    });

    //on close
    socket.on("close", e => {
        //console.log(e);
        //recognize the state
        //...
        if(socket._length < 0){
            //The transfer was not even started yet.
            //check if it had a resolver
            SessionCheckResolver(socket, {error: "Couldn't get the key of the upload session."});
            //Close session
            CloseUploadSession(socket);
        }
        else if(socket._length < socket._maxLength){
            //The transfer was started, but there was a problem in the transfer
            //Close session
            CloseUploadSession(socket);
        }
        else{
            //The transfer has been finished, and more or equal of amount of demanded data has been transfered
            //Close session
            CloseUploadSession(socket);
        }
    });

    //on error
    socket.on("error", err => {
        console.log(err);
        //recognize the state
        //...
        if(socket._length < 0){
            //The transfer was not even started yet.
            //check if it had a resolver
            SessionCheckResolver(socket, {error: "Couldn't get the key of the upload session."});
            //Close session
            CloseUploadSession(socket);
        }
        else if(socket._length < socket._maxLength){
            //The transfer was started, but there was a problem in the transfer
            //Close session
            CloseUploadSession(socket);
        }
        else{
            //The transfer has been finished, and more or equal of amount of demanded data has been transfered
            //Close session
            CloseUploadSession(socket);
        }
    });
};

//Creates the upload session
const CreateUploadSession = (config) => {
    //The resolve can't be async, I think
    return new Promise(resolve => {
        //Create write stream
        CreateWriteStream(config.outputPath, config.lockFile || uploadServiceLockFiles).then(
            (writeStream) => {
                //Check if result is error
                if(typeof(writeStream) == 'string'){
                    console.log(writeStream);
                    resolve({error: 'Code ' + writeStream});
                    return;
                }
                //Assign writer behaviour
                SetupUploadWriterEvents(writeStream);
                //Create the WS connection
                const socket = new WebSocket(GetWebSocketURL(), {
                    perMessageDeflate: false,
                    headers: {
                        key: uploadServiceSecretKey
                    }
                });
                //file writing
                socket._fw = writeStream;                   //File writer object
                socket._chunkLength = config.chunkLength;   //Length of a single chunk
                socket._maxLength = config.maxFileSize;     //Max length of the file
                socket._length = -2;                        //current length of the written date ((< maxLength) means it needs. (= maxLength) means it has filled up all the data)
                //state
                socket._key = '';                           //invitation key
                socket._resolver = resolve;                 //called once and only when key is recieved
                //Assign socket to the writer
                writeStream._socket = socket;
                //add to chain
                uploadSessionChain.Add(socket);
                //events
                SetupUploadSessionEvents(socket);
            }
        );
    });
};

//safely closes the Upload session
const CloseUploadSession = (socket) => {
    //block null
    if(!socket) 
        return;
    //don't call it again
    if(socket._key === null)
        return;
    //remember the key
    const key = socket._key;
    //mark as it is being closed
    socket._key = null;
    //remove events
    socket.removeAllListeners();
    //close writer
    socket._fw.close((err) => {
        if(err)
            console.log(err);
        //delist from the chain
        uploadSessionChain.Remove(socket);
        //close WebSocket
        socket.close();
        //Boss
        Boss.UploadEnd({
            bossNote: socket._bossNote
            ,length: socket._length
            ,maxLength: socket._maxLength
        });
    });
};

//#endregion