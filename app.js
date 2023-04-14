//config
const serverPort = 80;
const wsPort = 80;
//This is a tunnel
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

const wsServer = new WebSocket.Server({port: '8080'});



//#endregion

//================================================================
//#region HTTP server

const server = http.createServer((req, res) => {
    const msg = "Hello. Can you read me?";
    const fileName = "test.txt";
    res.setHeader('Content-Type', GetMIME(fileName.substr(fileName.lastIndexOf('.') + 1)));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.write(msg);
    res.end();
});

server.listen(serverPort, () => {
    console.log('Server running on http://localhost:' + serverPort);
});

//#endregion