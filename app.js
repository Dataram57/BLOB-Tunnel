/*================================================================
This application is a tunnel between the private servers and the outside client.

//================================================================*/

//#region Config
const serverPort = 80;
//WS server
const wsPort = serverPort;
const wsMaxPayLoad = 4096;
//Download Service
const downloadServiceSecretKey = 'j4ouKwhzWQrB1LGgaHf1';
const downloadSessionKeyLength = 16;
const downloadSessionMaxCount = 8;
const downloadSessionMaxChunkLength = wsMaxPayLoad;
const downloadSessionMinChunkLength = 256;
const downloadSessionMaxFileSize = 1073741824;
//idle check
const downloadSessionExpireMinTime = 30 * 1000;
const downloadSessionExpireCheckTime = 15 * 1000;
const downloadSessionIdleMinTime = 20 * 1000;
const downloadSessionIdleCheckTime = 10 * 1000;
//Upload Service
const uploadServiceSecretKey = 'AinoWB7KMaCRpc19vV01';
const uploadSessionKeyLength = 16;
const uploadSessionMaxCount = 6;
const uploadSessionMaxChunkLength = wsMaxPayLoad;
const uploadSessionMinChunkLength = 256;
const uploadSessionMaxFileSize = 1073741824;
//idle check
const uploadSessionExpireMinTime = 30 * 1000;
const uploadSessionExpireCheckTime = 15 * 1000;
const uploadSessionIdleDestinationMinTime = 20 * 1000;
const uploadSessionIdleClientMinTime = 10 * 1000;
const uploadSessionIdleCheckTime = 10 * 1000;
//WS server delay checks
//obsolete cause they should rely on the admin's side
//WS client delay/error checks
//client has strict rules, and should only message once whenever the tunnel message him.

//Idle check should rely on 1 Timeout event for the whole chain

//#endregion

//================================================================
//#region Requirements and consts/utilities

console.clear();
console.log('================================================================');
const appLaunchDate = new Date();
const http = require('http');
const WebSocket = require('ws');
const ChainArray = require('./ChainArray.js');

const ExtMIME = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "csv": "text/csv",
    "txt": "text/plain",
    "json": "application/json",
    "xml": "application/xml"
};
const GetMIME = (ext) => {
    if(ExtMIME[ext])
        return ExtMIME[ext];
    return "text/plain";
};

const GenerateKey = (length) => {
    //declare var
    let key = '';
    //generate
    while(length-- > 0)
        key += String.fromCharCode(65 + Math.floor(25 * Math.random()));
    return key;
};

const ReadJSONFromBuffer = (buffer) => {
    try{
        return JSON.parse(buffer);
    }
    catch(e){
        return null;
    }
};

const UpdateLastActionDate = (socket) => socket._lastActionDate = new Date();

const CheckExpiredSessionInChain = (chainHead, minTime, funcClose) => {
    const current = new Date();
    let sessionNext = null;
    while(chainHead){
        //get the next next session
        sessionNext = chainHead.chainFront;
        //check last message date
        if(current - chainHead._lastActionDate > minTime)
            //close this session
            funcClose(chainHead);
        //next
        chainHead = sessionNext;
    }
};

//#endregion

//================================================================
//#region PhusionPassenger

if (typeof(PhusionPassenger) != 'undefined') {
    PhusionPassenger.configure({ autoInstall: false });
}

//#endregion

//================================================================
//#region HTTP server

const server = http.createServer((req, res) => {
    const params = req.url.split('/');
    switch(params[1]){
        case "download":
            if(CheckDownloadKey(params[2])){
                //search for the corresponding socket
                const key = params[2];
                const socket = FindDownloadSession(key);
                //check searching result
                if(socket){
                    //write headers
                    res.setHeader('Content-Type', GetMIME(socket._fileName.substr(socket._fileName.lastIndexOf('.') + 1)));
                    res.setHeader('Content-Disposition', `attachment; filename="${socket._fileName}"`);
                    res.setHeader('Content-Length', socket._fileLength);
                    //attach 
                    socket._client = res;
                    //begin responding;
                    if(socket._fileLength <= 0)
                        //close whole connection and return the empty file
                        CloseDownloadSession(socket);
                    else{

                        //METHOD 2: CHAIN SWAP (REMOVE FROM THE OLD CHAIN => MOVE TO THE NEW CHAIN)
                        //Remove socket from the chain
                        DelistDownloadSession(socket);
                        //register Action date
                        UpdateLastActionDate(socket);
                        //track idleness of the session
                        downloadSessionBusyChain.Add(socket);
                        //request next chunk
                        socket.send('next;');
                    }
                    return;
                }
            }
            //wrong key case
            res.end('wrong key');
            break;
        case 'test':
            if(false){
                //print download service
                let socket = downloadSessionChain.head;
                let i = 0;
                res.write('Download count: ' + downloadSessionChain.length); 
                while(socket){
                    res.write('\n'+i + '. ' + socket._key);
                    if(socket.chainBack)
                        res.write(' Back: ' + socket.chainBack._key);
                    if(socket.chainFront)
                        res.write(' Front: ' + socket.chainFront._key);
                    //next
                    i++;
                    socket = socket.chainFront;
                }
                //print upload service
                socket = uploadSessionChain.head;
                i = 0;
                res.write("\nUpload count: " + uploadSessionChain.length); 
                while(socket){
                    res.write('\n'+i + '. ' + socket._key);
                    if(socket.chainBack)
                        res.write(' Back: ' + socket.chainBack._key);
                    if(socket.chainFront)
                        res.write(' Front: ' + socket.chainFront._key);
                    //next
                    i++;
                    socket = socket.chainFront;
                }
            }
            res.end();
            break;
        default:
            res.end('Hello. This is a tunnel');
            break;
    }
    /*
    const msg = "Hello. Can you read me?";
    const fileName = "test.txt";
    res.setHeader('Content-Type', GetMIME(fileName.substr(fileName.lastIndexOf('.') + 1)));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.write(msg);
    */
});

//consider PhusionPassenger existance
if (typeof(PhusionPassenger) != 'undefined') {
    server.listen('passenger', () => {
        console.log('HTTP server running on passenger');
    });
}else{
    server.listen(serverPort, () => {
        console.log('HTTP server running on ' + serverPort);
    });
}

//#endregion

//================================================================
//#region WS - Download service

let downloadSessionCounter = 0;
const downloadSessionChain = new ChainArray();
//.length won't include sessions currently working(tunneling or setuping). Use downloadSessionCounter - downloadSessionChain.length to count busy

const DownloadSessionListedCheck = () => {
    //console.log('Download Expired Check (Count: ' + downloadSessionChain.length + ') ' + new Date().toLocaleString());
    //scan
    CheckExpiredSessionInChain(downloadSessionChain.head, downloadSessionExpireMinTime, CloseDownloadSession);
};
//launch checker
setInterval(DownloadSessionListedCheck, downloadSessionExpireCheckTime);

//this chain is used for tracking idleness
const downloadSessionBusyChain = new ChainArray();
const DownloadSessionIdleCheck = () => {
    //console.log('Download Idle Check (Count: ' + downloadSessionBusyChain.length + ') ' + new Date().toLocaleString());
    //scan
    CheckExpiredSessionInChain(downloadSessionBusyChain.head, downloadSessionIdleMinTime, CloseDownloadSession);
};
//launch checker
setInterval(DownloadSessionIdleCheck, downloadSessionIdleCheckTime);

const GenerateDownloadKey = () => {
    //generates a key that no listed session will have
    let key = '';
    let session = null;
    do{
        //generate
        key = GenerateKey(downloadSessionKeyLength);
        //search
        session = downloadSessionChain.head;
        while(session)
            if(session._key == key)
                break;
            else
                session = session.chainFront;
    }while(session)
    //key is unique
    return key;
};

const CheckDownloadKey = (key) => {
    if(typeof(key) == 'string')
        return downloadSessionKeyLength == key.length;
    return false;
};

const FindDownloadSession = (key) => {
    let socket = downloadSessionChain.head;
    while(socket)
        if(socket._key === key)
            return socket;
        else
            socket = socket.chainFront;
    return null;
};

const VerifyDownloadSetup = (setup) => {
    //check setup
    if(!setup)
        return;
    //check parameters
    if(typeof(setup.fileName) != 'string' || typeof(setup.fileSize) != 'number' || typeof(setup.chunkLength) != 'number')
        return;
    //check parameters values
    setup.fileSize = parseInt(setup.fileSize);
    if(setup.fileName.trim().length <= 0 || (setup.fileSize < 0 || setup.fileSize > downloadSessionMaxFileSize) || (setup.chunkLength > downloadSessionMaxChunkLength || setup.chunkLength < downloadSessionMinChunkLength))
        return;
    //return correct setup
    return setup;
};

const SetupDownloadSocket = (socket) => {
    //check counter
    if(downloadSessionCounter >= downloadSessionMaxCount){
        //close session
        socket.terminate();
        return;
    }
    downloadSessionCounter++;
    //save session
    socket._key = null;
    socket._fileLength = -1;
    socket._fileName = 'unnamed.thing';
    //usage ._chunkLength is mixed with setTimout returned id
    socket._chunkLength = 0;
    socket._client = null;
    socket._lastActionDate = new Date();
    socket._isClosing = false;
    //Cache chain properties
    socket.chainBack = null;
    socket.chainFront = null;
    //add to track potential idles
    //METHOD 1: FIRST CHAIN (FIRST CHAIN ASSIGN)
    downloadSessionBusyChain.Add(socket);

    //on message
    socket.on("message", message => {
        //check status
        if(!socket._client){
            //correct or apply setup/config
            //get setup
            const setup = VerifyDownloadSetup(ReadJSONFromBuffer(message));
            //check setup
            if(!setup){
                CloseDownloadSession(socket);
                return;
            }
            //set parameters
            socket._fileName = setup.fileName;
            socket._fileLength = setup.fileSize;
            socket._chunkLength = setup.chunkLength;
            //generate the key
            if(!socket._key){
                const key = GenerateDownloadKey();
                //console.log(key);
                socket._key = key;
                socket.send("key;" + key);
                //register Action date
                UpdateLastActionDate(socket);
                //add to chain of listed and remove session from the idle tracker
                //remove session from the idle tracker
                //METHOD 2: CHAIN SWAP (REMOVE FROM THE OLD CHAIN => MOVE TO THE NEW CHAIN)
                downloadSessionBusyChain.Remove(socket);
                downloadSessionChain.Add(socket);
            }
        }
        else{
            //register Action date
            UpdateLastActionDate(socket);
            //write tunneled data to the responese
            socket._client.write(message);
            //shrink file size
            socket._fileLength -= message.length;
            //check remaining file size
            if(socket._fileLength <= 0){
                //end downloading
                //socket._client.end();
                //destroy ws
                //socket was removed from the chain earlier
                //socket.close();
                //update stats
                //downloadSessionCounter--;
                CloseDownloadSession(socket);
            }
            //ask for next
            socket.send("next;");
        }
    });

    //on close
    socket.on("close", e => {
        CloseDownloadSession(socket);
    });

    //on error
    socket.on('error', err => {
        CloseDownloadSession(socket);

        //potential error codes(err.code):
        //WS_ERR_UNSUPPORTED_MESSAGE_LENGTH
    });        
};

//safely closes a download session
const CloseDownloadSession = (session) => {
    //mark is closing
    if(session._isClosing)
        return;
    session._isClosing = true;
    //console.log('CLOSING DOWNLOAD SESSION');
    //check if it is listed
    //METHOD 3: NO CHAIN (SAFELY REMOVE FROM ALL CHAINS)
    //try to remove from the idle tracker
    if(!session._key)
        downloadSessionBusyChain.Remove(session);
    else
        DelistDownloadSession(session);
    //check if it has a client
    if(session._client){
        session._client.end();
        //safely block respones
        session._client = null;
    }
    //close
    session.removeAllListeners();
    session.close();
    //update stats
    downloadSessionCounter--;
};

//safely delists a download session
const DelistDownloadSession = (session) => {
    if(session._key){
        downloadSessionChain.Remove(session);
        session._key = null;
    }
};

//#endregion

//================================================================
//#region WS - Upload service
//Transfers File with WS, from WS A to WS B.
//A is the outside client. (requires Invite key)
//B is the actual service. (requires Secret Upload service kay).

let uploadSessionCounter = 0;
const uploadSessionChain = new ChainArray();
const uploadSessionBusyChain = new ChainArray();
//.length won't include sessions currently working(tunneling). Use uploadSessionCounter - uploadSessionChain.length to count the working ones


const GenerateUploadKey = () => GenerateKey(uploadSessionKeyLength);

const FindUploadSession = (key) => {
    let socket = uploadSessionChain.head;
    while(socket)
        if(socket._key === key)
            return socket;
        else
            socket = socket.chainFront;
    return null;
};

const VerifyUploadSetup = (setup) => {
    //check setup
    if(!setup)
        return;
    //check parameters
    if(typeof(setup.maxLength) != 'number' || typeof(setup.chunkLength) != 'number')
        return;
    //check values
    setup.maxLength = parseInt(setup.maxLength);
    setup.chunkLength = parseInt(setup.chunkLength);
    if((setup.maxLength <= 0 || setup.maxLength > uploadSessionMaxFileSize) || (setup.chunkLength > uploadSessionMaxChunkLength || setup.chunkLength < uploadSessionMinChunkLength))
        return;
    //return setup
    return setup;
};

const SetupUploadServiceSocket = (socket) => {
    //check counter
    if(uploadSessionCounter >= uploadSessionMaxCount){
        //close session
        socket.terminate();
        return;
    }
    uploadSessionCounter++;
    //hire self-checkout
    
    //save session
    socket._key = null;
    socket._isClosing = false;
    //data count
    socket._length = 0;
    socket._maxLength = -1;
    socket._chunkLength = 0;
    //client target
    socket._client = null; //socket._client links to the upload source
    //Cache chain properties
    socket.chainBack = null;
    socket.chainFront = null;
    //Update Last Action Date
    UpdateLastActionDate(socket);
    //METHOD 1: FIRST CHAIN (FIRST CHAIN ASSIGN)
    uploadSessionBusyChain.Add(socket);

    //on message
    socket.on("message", msg => {
        //check status
        if(!socket._client){
            //correct or apply setup/config
            //get setup
            const setup = VerifyUploadSetup(ReadJSONFromBuffer(msg));
            //check setup
            if(!setup){
                CloseUploadSession(socket);
                return;
            }
            //set parameters
            socket._maxLength = setup.maxLength;
            socket._chunkLength = setup.chunkLength;
            //generate the key
            if(!socket._key){
                const key = GenerateUploadKey();
                socket._key = key;
                socket.send("key;" + key);
                //Update Last Action Date
                UpdateLastActionDate(socket);
                //METHOD 2: CHAIN SWAP (REMOVE FROM THE OLD CHAIN => MOVE TO THE NEW CHAIN)
                uploadSessionBusyChain.Remove(socket);
                uploadSessionChain.Add(socket);
            }
        }
        else{
            //The upload is going
            if(msg.subarray(0,5).toString() == 'next;'){
                //request a next chunk from the user
                //register length added successfully
                socket._length += socket._chunkLength;
                //check if EOF
                if(socket._length >= socket._maxLength){
                    //close all connections
                    //This is also an information that the app_agent seeked for more.
                    CloseUploadSession(socket);
                    return;
                }
                //Update Last Action Date - only client
                UpdateLastActionDate(socket._client);
                //allow client to send the next chunk of file
                socket._client._length = Math.min(socket._chunkLength, socket._maxLength - socket._length);
                //send command
                socket._client.send('next;');
            }
            //unknown command
        }
    });

    //on close
    socket.on("close", e => {
        CloseUploadSession(socket);
    });

    //on error
    socket.on('error', err => {
        console.log(err);
        CloseUploadSession(socket);
    });
};

const SetupUploadClientSocket = (socket) => {
    //socket._client links to the upload destination
    //apply also this socket to the main session socket
    socket._client._client = socket;
    //give permission to send data
    socket._length = socket._client._chunkLength;
    //Update Last Action Date
    UpdateLastActionDate(socket);
    //

    //on message
    socket.on("message", message => {
        //Substract the length
        socket._length -= message.length;
        //check permisionned length
        if(socket._length < 0){
            //close the whole session
            CloseUploadSession(socket._client);
            return;
        }
        else if(socket._length > 0){
            //means that this chunk was the last one
            //set the remaining left trasfer data amount to the possible max
            socket._client._length = socket._client._maxLength;
        }
        //block permission
        socket._length = 0;

        //Update Last Action Date + client
        UpdateLastActionDate(socket);
        UpdateLastActionDate(socket._client);

        //nomatter what the f he is sending
        //forward this chunk of data
        socket._client.send(message);
    });

    //on close
    socket.on("close", e => {
        //close him and the destination
        CloseUploadSession(socket._client);
    });

    //on error
    socket.on("err", err => {
        //.code = WS_ERR_UNSUPPORTED_MESSAGE_LENGTH
        console.log(err);
        //close him and the destination
        CloseUploadSession(socket._client);
    });

    //send message
    socket.send('next;');
};

//safely closes an upload session and its potential client session
const CloseUploadSession = (session) => {
    //mark is closing
    if(session._isClosing)
        return;
    session._isClosing = true;
    //console.log('CLOSING UPLOAD SESSION');
    //check if it is listed
    //METHOD 3: NO CHAIN (SAFELY REMOVE FROM ALL CHAINS)
    if(!session._key)
        uploadSessionBusyChain.Remove(session);
    else
        DelistUploadSession(session);
    //close client
    if(session._client){
        session._client.removeAllListeners();
        session._client.close();
    }
    //close itself
    session.removeAllListeners();
    session.close();
    //update stats
    uploadSessionCounter--;
};

//safely delists an upload session
const DelistUploadSession = (session) => {
    if(session._key){
        uploadSessionChain.Remove(session);
        session._key = null;
    }
};

//idle checking stuff here:
const UploadSessionIdleCheck = () => {
    //console.log('Upload Idle Check (Count: ' + uploadSessionBusyChain.length + ') ' + new Date().toLocaleString());
    //init vars
    const current = new Date();
    let temp = false;
    let session = uploadSessionBusyChain.head;
    let nextSession = null;
    //scan
    while(session){
        nextSession = session.chainFront;
        temp = true;
        //check who could be idle
        //client scenario
        if(session._client)
            if(session._client._length > 0){
                //mark case
                temp = false;
                //client can be idle
                if(current - session._client._lastActionDate > uploadSessionIdleClientMinTime)
                    CloseUploadSession(session);
            }
        //check if client had to upload something
        if(temp){
            //source can be idle
            if(current - session._lastActionDate > uploadSessionIdleDestinationMinTime)
                CloseUploadSession(session);
        }
        //go to the next one
        session = nextSession;
    }
};
//launch checker
setInterval(UploadSessionIdleCheck, uploadSessionIdleCheckTime)

//listed checking stuff here
UploadSessionListedCheck = () => {
    //console.log('Upload Expired Check (Count: ' + uploadSessionChain.length + ') ' + new Date().toLocaleString());
    //check
    CheckExpiredSessionInChain(uploadSessionChain.head, uploadSessionExpireMinTime, CloseUploadSession);
};
//launch checker
setInterval(UploadSessionListedCheck, uploadSessionExpireCheckTime);

//#endregion

//================================================================
//#region WebSocket server

const wsServer = new WebSocket.Server(
    (wsPort == serverPort) ? 
        {
            server: server
            ,maxPayload: wsMaxPayLoad
        }
    : 
        {
            port: wsPort
            ,maxPayload: wsMaxPayLoad
        }
);
//() => {console.log("WebSocket server running on " + (wsPort == serverPort) ? 'the same port as HTTP server' : wsPort);}


wsServer.on('connection', (socket, req) => {    
    //Check if admin
    if(req.headers['key']){
        //check key(purpose of the connection)
        //it is important to not declare variables from this scope (due to cheaper/faster memory handling)
        if(req.headers['key'] === downloadServiceSecretKey){
            //client is the future source of file for download service
            //setup download socket
            SetupDownloadSocket(socket);
        }else if(req.headers['key'] === uploadServiceSecretKey){
            //client is the future endpoint of upload service
            //setup upload socket
            SetupUploadServiceSocket(socket);
        }
        else{
            //close hacker's connection
            socket.terminate();
            return;
        }
    }
    //Connection is using URL parameters instead of headers
    else{
        //check url parameters
        let target = req.url;
        if(target.substring(0,8) == '/upload/'){
            //check length
            target = target.substring(8);
            if(target.length == uploadSessionKeyLength){
                //find matching session key
                socket._client = FindUploadSession(target);
                if(socket._client){
                    //delist session
                    //METHOD 2: CHAIN SWAP (REMOVE FROM THE OLD CHAIN => MOVE TO THE NEW CHAIN)
                    DelistUploadSession(socket._client);
                    uploadSessionBusyChain.Add(socket._client);
                    //Setup the socket
                    SetupUploadClientSocket(socket);
                    return;
                }
            }
        }
        //close hacker's connection
        socket.terminate();
        return;
    }
});

//#endregion