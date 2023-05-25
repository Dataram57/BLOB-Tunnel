/*================================================================
This application is a tunnel between the private servers and the outside client.
It is possible to:
-Create a download link, which would work as a tunnel between the private server and the outside client.

It is not yet possible to:
-Create a WebSocket connection to transfer/upload outside client's file to a private server, through this service.

//================================================================*/
//#region Config
const serverPort = 80;
//WS server
const wsPort = serverPort;
const wsSecretKey = 'zaq1"WSX';
const wsMaxPayLoad = 1024;
//Download Service
const downloadServiceSecretKey = 'zaq1"WSX';
const downloadSessionKeyLength = 16;
const downloadSessionMaxCount = 16;
//Upload Service
const uploadServiceSecretKey = 'ZAQ!2wsx';
const uploadSessionKeyLength = 16;
const uploadSessionMaxCount = 16;
//WS server delay checks
//obsolete cause they should rely on the admin's side
//WS client delay/error checks
const maxClientDelayInMessage = 10 * 1000; 
//client has strict rules, and should only message once whenever the tunnel message him.

//#endregion

//================================================================
//#region Requirements and consts/utilities

console.clear();
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
}
const GetMIME = (ext) => {
    if(ExtMIME[ext])
        return ExtMIME[ext];
    return "text/plain";
}

const GenerateKey = (length) => {
    //declare var
    let key = '';
    //generate
    while(length-- > 0)
        key += String.fromCharCode(65 + Math.floor(25 * Math.random()));
    return key;
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
                let socket = FindDownloadSession(key);
                //check searching result
                if(socket){
                    //Remove socket from the chain
                    downloadSessionChain.Remove(socket);
                    //write headers
                    res.setHeader('Content-Type', GetMIME(socket._fileName.substr(socket._fileName.lastIndexOf('.') + 1)));
                    res.setHeader('Content-Disposition', `attachment; filename="${socket._fileName}"`);
                    res.setHeader('Content-Length', socket._fileLength);
                    //begin responding;
                    socket._client = res;
                    socket.send('next;');
                    return;
                }
            }
            //wrong key case
            res.end('wrong key');
            break;
        case 'test':
            let socket = downloadSessionChain.head;
            let i = 0;
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

const downloadSessionCounter = 0;
const downloadSessionChain = new ChainArray();
    //.length won't include sessions currently working(tunneling or setuping). Use downloadSessionCounter - downloadSessionChain.length to count busy
const GenerateDownloadKey = () => GenerateKey(downloadSessionKeyLength);
const CheckDownloadKey = (key) => {
    if(typeof(key) == 'string')
        return downloadSessionKeyLength == key.length;
    return false;
}
const FindDownloadSession = (key) => {
    let socket = downloadSessionChain.head;
    while(socket)
        if(socket._key === key)
            return socket;
        else
            socket = socket.chainFront;
    return null;
};

const SetupDownloadSocket = (socket) => {
    //save session
    socket._key = null;
    socket._fileLength = -1;
    socket._fileName = 'unnamed.thing';
    //usage ._chunkLenght is mixed with setTimout returned id
    socket._chunkLenght = 0;
    socket._client = null;
    socket._lastMessageDate = new Date();
    //Cache chain properties
    socket.chainBack = null;
    socket.chainFront = null;

    //on message
    socket.on("message", message => {
        //update socket last message date
        socket._lastMessageDate = new Date();
        //check status
        if(!socket._client){
            //correct or apply setup/config
            //get setup
            const setup = JSON.parse(message);
            //check setup
            console.log(setup);
            //set parameters
            socket._fileName = setup.fileName;
            socket._fileLength = setup.fileSize;
            socket._chunkLenght = setup.chunkLenght;
            //generate the key
            if(!socket._key){
                const key = GenerateDownloadKey();
                console.log(key);
                socket._key = key;
                socket.send("key;" + key);
                //add to chain
                downloadSessionChain.Add(socket);
            }
        }
        else{
            //write tunneled data to the responese
            socket._client.write(message);
            //console.log(message.toString());
            //shrink file size
            socket._fileLength -= message.length;
            //check remaining file size
            if(socket._fileLength <= 0){
                console.log('finished writing data');
                //end downloading
                socket._client.end();
                //destroy ws
                //socket was removed from the chain earlier
                socket.terminate();
            }
            //ask for next
            socket.send("next;");
        }
    });

    //on close
    socket.on("close",e => {
        //check if socket was in chain
        if(socket._key)
            downloadSessionChain.Remove(socket);
        //destroy socket
        socket.terminate();
    });

    //on error
    socket.on('error', err => {
        //check if it was in the chain
        if(socket._key)
            downloadSessionChain.Remove(socket);
        //destroy socket
        socket.terminate();

        //potential error codes(err.code):
        //WS_ERR_UNSUPPORTED_MESSAGE_LENGTH
    });        
};

//#endregion

//================================================================
//#region WS - Upload service
//Transfers File with WS, from WS A to WS B.
//A is the outside client. (requires Invite key)
//B is the actual service. (requires Secret Upload service kay).

const uploadSessionCounter = 0;
const uploadSessionChain = new ChainArray();
    //.length won't include sessions currently working(tunneling or setuping). Use uploadSessionCounter - uploadSessionChain.length to count busy

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

const SetupUploadServiceSocket = (socket) => {
    console.log('Oh shitt!!!');
    //save session
    socket._key = null;
    //data count
    socket._length = 0;
    socket._maxLength = -1;
    socket._chunkLenght = 0;
    //client target
    socket._source = null;
    //checks
    socket._lastMessageDate = new Date();
    //Cache chain properties
    socket.chainBack = null;
    socket.chainFront = null;

    //on message
    socket.on("message", message => {
        //update socket last message date
        socket._lastMessageDate = new Date();
        //check status
        if(!socket._source){
            //correct or apply setup/config
            //get setup
            const setup = JSON.parse(message);
            //check setup
            console.log(setup);
            //set parameters
            socket._maxLength = setup.maxLength;
            socket._chunkLenght = setup.chunkLenght;
            //generate the key
            if(!socket._key){
                const key = GenerateUploadKey();
                console.log(key);
                socket._key = key;
                socket.send("key;" + key);
                //add to chain
                uploadSessionChain.Add(socket);
            }
        }
        else{
            //write tunneled data to the responese
            socket._client.write(message);
            //console.log(message.toString());
            //shrink file size
            socket._fileLength -= message.length;
            //check remaining file size
            if(socket._fileLength <= 0){
                console.log('finished writing data');
                //end downloading
                socket._client.end();
                //destroy ws
                //socket was removed from the chain earlier
                socket.terminate();
            }
            //ask for next
            socket.send("next;");
        }
    });

    //on close
    socket.on("close",e => {
        //check if socket was in chain
        if(socket._key)
            downloadSessionChain.Remove(socket);
        //destroy socket
        socket.terminate();
    });

    //on error
    socket.on('error', err => {
        //check if it was in the chain
        if(socket._key)
            downloadSessionChain.Remove(socket);
        //destroy socket
        socket.terminate();

        //potential error codes(err.code):
        //WS_ERR_UNSUPPORTED_MESSAGE_LENGTH
    });   
    
};

const SetupUploadClientSocket = (socket) => {
    //socket._target links to the upload destination
};

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
    //check key(purpose of the connection)
    //it is important to not declare variables from this scope (due to cheaper/faster memory handling)
    if(req.headers['key'] === downloadServiceSecretKey){
        //client is the future source of file for download service
        //check counter
        if(downloadSessionCounter >= downloadSessionMaxCount){
            //Too much of download session hanging
            socket.close();
            return;
        }
        //setup download socket
        SetupDownloadSocket(socket);
    }else if(req.headers['key'] === uploadServiceSecretKey){
        //client is the future endpoint of upload service
        //setup upload socket
        SetupUploadServiceSocket(socket);
    }
    else{
        //check upload invitation key
        socket._target = FindUploadSession(req.headers['key']);
        if(socket._target)
            //setup upload socket
            SetupUploadClientSocket(socket);
        else{
            //close hacker's connection
            socket.terminate();
            return;
        }
    }
});

//#endregion