//config
const serverPort = 80;
const wsPort = 8080;
const wsSecretKey = 'zaq1"WSX';
//This is a tunnel
console.clear();
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

//================================================================
//#region WebSocket server

const wsServer = new WebSocket.Server({port: wsPort});

const wsSessions = [];
const wsSessionsKey = [];
const wsSessionsFileLength = [];
const wsSessionsFileName = [];
const wsSessionsChunkLength = [];
const wsSessionsResponse = [];
//

wsServer.on('connection', (socket, req) => {
    //check key
    if(req.headers['key'] !== wsSecretKey){
        socket.close();
        return;
    }
    console.log('New connection has been Approved');

    //save session
    socket.sessionIndex = wsSessions.push(socket) - 1;
    wsSessionsKey.push('');
    wsSessionsFileLength.push(-1);
    wsSessionsFileName.push('unnamed.thing');
    wsSessionsChunkLength.push(0);
    wsSessionsResponse.push(null);

    //define events

    //on message
    socket.on("message", message => {
        const i = socket.sessionIndex;
        //check status
        if(wsSessionsFileLength[i] == -1){
            //get setup
            const setup = JSON.parse(message);
            //check setup
            console.log(setup);
            //set parameters
            wsSessionsFileName[i] = setup.fileName;
            wsSessionsFileLength[i] = setup.fileSize;
            wsSessionsChunkLength[i] = setup.chunkLength;
            //generate the key
            const key = Math.floor(Math.random() * 100000).toString(16);
            console.log(key);
            wsSessionsKey[i] = key;
            socket.send("key;" + key);
        }
        else{
            //write tunneled data to the responese
            wsSessionsResponse[i].write(message);
            console.log(message.toString());
            //shrink file size
            wsSessionsFileLength[i] -= message.length;
            //check remaining file size
            if(wsSessionsFileLength[i] <= 0){
                console.log('finished writing data');
                //end downloading
                wsSessionsResponse[i].end();
                //destroy ws
                socket.close();
                return;
            }
            //ask for next
            socket.send("next;");
        }
    });
});

//#endregion

//================================================================
//#region HTTP server

const server = http.createServer((req, res) => {
    const params = req.url.split('/');
    switch(params[1]){
        case "download":
            if(params[2]){
                //find the id
                let i = wsSessions.length;
                const key = params[2];
                while(--i > -1)
                    if(wsSessionsKey[i] == key)
                        break;
                
                if(i > -1){
                    //susspend key
                    wsSessionsKey[i] == null;
                    wsSessionsResponse[i] = res;
                    //write headers
                    res.setHeader('Content-Type', GetMIME(wsSessionsFileName[i].substr(wsSessionsFileName[i].lastIndexOf('.') + 1)));
                    res.setHeader('Content-Disposition', `attachment; filename="${wsSessionsFileName[i]}"`);
                    res.setHeader('Content-Length', wsSessionsFileLength[i]);
                    //begin responding;
                    wsSessions[i].send('next;');
                }   
                else
                    res.write('wrong key');
            }
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

server.listen(serverPort, () => {
    console.log('Server running on http://localhost:' + serverPort);
});

//#endregion