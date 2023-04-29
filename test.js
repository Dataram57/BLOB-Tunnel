//config
const targetTunnel = 'ws:localhost';
//'wss://backrooms.ethuardo.com';
const targetTunnelInviteLink = 'http://localhost/download/';
//'https://backrooms.ethuardo.com/download/';
const tunnelSecretKey = 'zaq1"WSX';
const targetFile = 'test.txt';
const readChunkSize = 1024;
//This is a tunnel-tester
console.clear();
console.log('================================================================');
const WebSocket = require('ws');
const fs = require("fs");

//================================================================
//#region pseudo Main

const Kill = (msg) => {
    console.log(msg, "is demanding a Kill!!!");
    if(ws)
        ws.close();
    if(fileStream)
        if(fileStream.fd >= 0)
            fileStream.close();
};
let allowCounter = 2;
const Allow = (msg) => {
    console.log(msg, "is ready!");
    allowCounter--;
    if(allowCounter == 0)
        Start();
};
let state = 0;
const Start = () => {
    console.log("Getting the key.");
    const setup = {
        fileName: fileName,
        fileSize: fileSize,
        chunkLength: readChunkSize
    };
    ws.send(JSON.stringify(setup));
};

//#endregion

//================================================================
//#region FileStream

//buffer which stores the data
let fileBuffer = Buffer.alloc(readChunkSize);
//stream is hidden inside the fs manager and it is represented by the fd (its special id)
let fileStream;
let fileSize = fs.statSync(targetFile).size;
let fileName = targetFile.substring(Math.min(targetFile.lastIndexOf('..'), targetFile.lastIndexOf('/'),0));
const loadFile = async () =>{ 
    try {
        fileStream = await fs.promises.open(targetFile, fs.constants.O_RDONLY | 0x10000000);
        Allow("File");
    } catch (error) {
        if (error.code === 'EBUSY'){
            console.log('file is busy');
        } else {
            throw error;
        }
    }
};
loadFile();

//#endregion

//================================================================
//#region WebSocket

const ws = new WebSocket(targetTunnel, {
    perMessageDeflate: false,
    headers: {
        key: tunnelSecretKey
    }
});

ws.on('error', event =>{
    console.log('Wooop... there was an error with the connection.');
});

ws.on("open", event => {
    Allow("WebSocket");
});

ws.on("message", msg => {
    if(msg.subarray(0,4).toString() == 'key;'){
        console.log(targetTunnelInviteLink + msg.subarray(4).toString());
    }
    else if(msg.subarray(0,5).toString() == 'next;'){
        sendNextChunk();
    }
});

ws.on('close', e => {
    console.log("connection closed");
    Kill();
});

//#endregion




const sendNextChunk = () => {
    fs.read(fileStream.fd, fileBuffer, 0, readChunkSize, null, function(err, nread) {
        if (err) throw err;

        //check if reading has ended
        if (nread === 0) {
            // done reading file, do any necessary finalization steps
            fs.close(fileStream.fd, function(err) {
                if (err) throw err;
            });
            return;
        }

        //prepare read chunk
        var data;
        if (nread < readChunkSize)
            data = fileBuffer.slice(0, nread);
        else
            data = fileBuffer;
        
        //send chunk
        ws.send(data);
    });
}





/*

(err, fd) => {
        if (err) throw err;
        function readNextChunk() {
            fs.read(fd, fileBuffer, 0, readChunkSize, null, function(err, nread) {
                if (err) throw err;

                //check if reading has ended
                if (nread === 0) {
                    // done reading file, do any necessary finalization steps
                    fs.close(fd, function(err) {
                        if (err) throw err;
                    });
                    return;
                }

                var data;
                if (nread < readChunkSize)
                    data = fileBuffer.slice(0, nread);
                else
                    data = fileBuffer;

                console.log(data.toString());
            });
        }
        readNextChunk();
        Allow("File");
    }

*/