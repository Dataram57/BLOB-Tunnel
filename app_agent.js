/*================================================================
This application is an agent / a tool to communicate with the public tunnel, in order to establish some connection between private servers and the outside client.
It is possible to:
-Host a single file download tunnel.

It is not yet possible to:
-Host an upload file tunnel. (+ locking the file)

//================================================================*/
//#region Config
//IO
const baseDir = 'base/';        //Directory with 777 access
const readChunkLenght = 1024;
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
const uploadServiceLockFiles = true;
//Additional Callbacker
const Boss = require('./boss/boss.js');
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

const ReadLastParameterFromURL = (url) => {
    return decodeURIComponent(url.substring(url.lastIndexOf('/') + 1));
};

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

//startDownload/$targetFile/$fileName
app.get(apiPrefix + 'startDownload/*', async function (req, res) {
    //check URL minimum
    const args = req.url.split('/');
    if(args.length < 2 + apiPrefixSubCount){
        //error
        res.send({error:'URL does not contain all the necessary arguments.'});
        return;
    }
    //read params
    let filePath = decodeURIComponent(args[apiPrefixSubCount]);
    const fileName = decodeURIComponent(args[apiPrefixSubCount + 1]);
    //check params
    if(fileName.trim().length == 0){ 
        //error
        res.send({error:'$fileName is empty.'});
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
            return;
        }
    }
    //create a tunnel
    const response = await CreateDownloadSession(filePath, fileName);
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
    //check config parameters
    if(typeof(config.outputPath) != 'string' || typeof(config.chunkLenght) != 'number' || typeof(config.maxFileSize) != 'number'){
        res.send({error: 'Config is not in a right format.'});
        return;
    }
    //check numbers
    if(config.chunkLenght <= 0){
        res.send({error: "$chunkLenght can not be below or equal to 0."});
        return;
    }
    if(config.maxFileSize <= 0){
        res.send({error: "$maxFileSize can not be below or equal to 0."});
        return;
    }
    //correct the path
    config.outputPath = baseDir + config.outputPath;
    //try to open an upload session
    const result = await CreateUploadSession(config);
    //end
    res.send(result);
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
            ,chunkLenght: readChunkLenght
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
            if(socket._resolver){
                socket._resolver({key: socket._key});
                socket._resolver = undefined;
            }
        }
        //next
        else if(msg.subarray(0,5).toString() == 'next;'){
            //wants to send the next chunk of the data.
            socket._fr.read(socket._offset, Math.min(readChunkLenght, socket._length - socket._offset), (err, raw) => {
                if(err){
                    console.log(err)
                }
                //send chunk
                socket.send(raw);
                //next
                socket._offset += readChunkLenght;
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

//Opens up an upload special File Writer
const CreateWriteStream = (filePath, lockFile) => {
    return new Promise(resolve => {
        if(lockFile){
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
    //on open
    writer.on('open', () => {
        console.log('opened');
    });

    //on error
    writer.on('error', (err) => {
        console.error('Error writing file:', err);
        CloseUploadSession(writer._socket);
    });

    //on finish
    writer.on('finish', () => {
        console.log('Binary data written to output.bin');
    });
};

//Assigns upload behaviour to the given WebSocket connection
const SetupUploadSessionEvents = (socket) => {
    //on open
    socket.on("open", e => {
        //Send the setup
        const setup = {
            maxLength: socket._maxLength
            ,chunkLenght: socket._chunkLenght
        };
        console.log(setup);
        socket.send(JSON.stringify(setup));
    });

    //on message
    socket.on("message", msg => {
        //ignore if closing
        if(socket._key === null)
            return;
        //check if writing began
        if(socket._length < 0){
            //The client has not started uploading yet
            //The tunnel may now return only commands
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
        }
        else{
            //The client is ready for responding
            //Tunnel sends only client's chunk

            socket._length < socket._maxLength;
                socket._length += msg._length;
                writer.write(msg, 'binary');
        }
    });

    //on close
    socket.on("close", e => {
        console.log(e);
        //recognize the state
        //...
        if(socket._length < 0){
            //The transfer was not even started yet.
            //Close session
            CloseUploadSession(socket);
            //Call the boss
            Boss;
        }
        else if(socket._length < socket._maxLength){
            //The transfer was started, but there was a problem in the transfer
            //Close session
            CloseUploadSession(socket);
            //Call the boss
            Boss;
        }
        else{
            //The transfer has been finished, and more or equal of amount of demanded data has been transfered
            //Close session
            CloseUploadSession(socket);
            //Call the boss
            Boss;
        }
    });

    //on error
    socket.on("error", err => {
        console.log(err);
        //recognize the state
        //...
        if(socket._length < 0){
            //The transfer was not even started yet.
            //Close session
            CloseUploadSession(socket);
            //Call the boss
            Boss;
        }
        else if(socket._length < socket._maxLength){
            //The transfer was started, but there was a problem in the transfer
            //Close session
            CloseUploadSession(socket);
            //Call the boss
            Boss;
        }
        else{
            //The transfer has been finished, and more or equal of amount of demanded data has been transfered
            //Close session
            CloseUploadSession(socket);
            //Call the boss
            Boss;
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
                console.log(typeof(writeStream));
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
                socket._chunkLenght = config.chunkLenght;   //Lenght of a single chunk
                console.log(socket._chunkLenght);
                socket._maxLength = config.maxFileSize;     //Max length of the file
                socket._length = -1;                        //current lenght of the written date ((< maxLength) means it needs. (= maxLength) means it has filled up all the data)
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
    //don't call it again
    if(socket._key === null)
        return;
    //mark as it is being closed
    socket._key = null;
    //close writer
    socket._fw.close((err) => {
        if(err)
            console.log(err);
        //delist from the chain
        uploadSessionChain.Remove(socket);
        //close WebSocket
        socket.close();
    });
};

//#endregion