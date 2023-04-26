//config
const serverPort = 80;
//WS server
const wsPort = serverPort;
const maxWSSessionCount = 32;
const wsSecretKey = 'zaq1"WSX';
const wsMaxPayLoad = 1024;
//WS server delay checks
const minLinkExpirationTime = 3 * 60 * 1000;
const minWSMessageDelay = 30 * 1000;
const checkWSConfigTime = 10 * 1000;
const checkExpirationForAllTime = 30 * 1000; 

//================================================================
//#region requirements and consts

console.clear();
const appLaunchDate = new Date();
const http = require('http');
const WebSocket = require('ws');

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
            if(params[2]){
                //search for the corresponding socket
                const key = params[2];
                let socket = chainHead_WSSession;
                while(socket)
                    if(socket._key == key)
                        break;
                    else
                        socket = socket.chainFront;
                //check searching result
                if(socket){
                    //susspend key
                    RemoveWSSession(socket);
                    //write headers
                    res.setHeader('Content-Type', GetMIME(socket._fileName.substr(socket._fileName.lastIndexOf('.') + 1)));
                    res.setHeader('Content-Disposition', `attachment; filename="${socket._fileName}"`);
                    res.setHeader('Content-Length', socket._fileLength);
                    //begin responding;
                    socket._response = res;
                    socket.send('next;');
                    return;
                }
            }
            //wrong key case
            res.end('wrong key');
            break;
        case 'test':
            let socket = chainHead_WSSession;
            let i = wsSessionCounter;
            while(socket){
                res.write(i + '. ' + socket._key + "\n");
                //next
                i--;
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
//#region Session Managment (chain-type)

let chainHead_WSSession = null;
//obj.chainFront - to search for the last
//obj.chainBack - to search for the top

const RegisterWSSession = (session) => {
    //set front and back
    session.chainFront = chainHead_WSSession;
    session.chainBack = null;
    //change head (add on top)
    chainHead_WSSession = session;
    chainHead_WSSession.chainBack = session;
};

const RemoveWSSession = (session) => {
    //check if head
    if(session == chainHead_WSSession)
        //neighbour becomes a new head
        chainHead_WSSession = session.chainFront;
    else
        //tell the neighbour to target its neighbour
        session.chainBack = session.chainFront 
};

const CloseAllWSSessions = () => {
    let socket = chainHead_WSSession;
    let next = null;
    while(socket){
        next = socket.chainFront;
        socket.close();
        socket = next;
    }
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

let wsSessionCounter = 0;

wsServer.on('connection', (socket, req) => {
    //check key and counter
    if(req.headers['key'] !== wsSecretKey || wsSessionCounter >= maxWSSessionCount){
        socket.close();
        return;
    }
    console.log('New connection has been Approved');

    //save session
    wsSessionCounter++;
    socket._key = "";
    socket._fileLength = -1;
    socket._fileName = 'unnamed.thing';
    //usage ._chunkLength is mixed with setTimout returned id
    socket._chunkLength = 0;
    socket._response = null;
    socket._lastMessageDate = new Date();
    //define chain properties
    socket.chainBack = null;
    socket.chainFront = null;

    //on message
    socket.on("message", message => {
        //update socket last message date
        socket._lastMessageDate = new Date();
        //check status
        if(!_response){
            //correct or apply setup/config
            //get setup
            const setup = JSON.parse(message);
            //check setup
            console.log(setup);
            //set parameters
            socket._fileName = setup.fileName;
            socket._fileLength = setup.fileSize;
            socket._chunkLength = setup.chunkLength;
            //generate the key
            if(!socket.key){
                const key = Math.floor(Math.random() * 100000).toString(16);
                console.log(key);
                socket._key = key;
                socket.send("key;" + key);
                //add to chain
                RegisterWSSession(socket);
            }
        }
        else{
            //write tunneled data to the responese
            socket._response.write(message);
            console.log(message.toString());
            //shrink file size
            socket._fileLength -= message.length;
            //check remaining file size
            if(socket._fileLength <= 0){
                console.log('finished writing data');
                //end downloading
                socket._response.end();
                //destroy ws
                CloseSession(socket);
                return;
            }
            //ask for next
            socket.send("next;");
        }
    });

    //on close
    socket.on("close",e => {
        CloseSession(socket);
    });

    //on error
    socket.on('error', err => {        
        TerminateSession(socket);
        //potential error codes(err.code):
        //WS_ERR_UNSUPPORTED_MESSAGE_LENGTH
    });
    
    
    //hire self check
    //socket._chunkLength = setTimeout(objClose, minWSConfigDelay, socket);


});


const DelistSession = (socket) => {
    //safe check if it is listed
    if(socket.chainBack != null || socket.chainFront != null)
        RemoveWSSession(socket);
};
const CloseSession = (socket) => {
    //check if it is listed
    DelistSession(socket);
    //destroy session
    socket.close();
    //stats
    wsSessionCounter--;
};
const TerminateSession = (socket) => {
    //check if it is listed
    DelistSession(socket);
    //destroy session
    socket.terminate();
    //stats
    wsSessionCounter--;
};

const objClose = (obj) => {
    obj.close();
    obj = null;
};
//returns if the socket did stop responding
//used for:
//-checking delay in chunk delivery (called by the ???)
//-checking key expiration date (called by the chain scanner event)
//-checking delay in delivering config (called by the individual setTimout)
const checkWSDelay = (socket) => {
    //calculate the diffrence
    const d = new Date() - socket._lastMessageDate;
    //check socket state
    if(socket._key)
        //check expiration date
        return d > minLinkExpirationTime;
    else if(socket._fileName)
        //check delay in chunk delivery
        return d > minWSMessageDelay;
    //check delay in config delivery
    return d > minWSConfigDelay;
};

//#endregion