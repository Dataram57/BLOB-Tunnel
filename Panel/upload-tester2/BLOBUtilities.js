const BLOBUtilities = {
    //BLOBUploader
    BLOBUploader: class {
        constructor(config){
            //file reading properties
            this.chunkLength = config.chunkLength;  //length of a single chunk
            this.fileOffset = 0;    //position of the reader
            this.fileSize = config.fileSize;    //expected file size, by the tunnel
            this.file = config.file;
            //WebSocket
            /*
            const AssignWSUploaderBehavior = (socket) => {

            };
            this.socket = new WebSocket();
            AssignWSUploaderBehavior(this.socket);
            */
        }

        //will callback(error, result)
        //null - if EOF occured
        ReadNextChunk(callback){
            //check if EOF
            if(this.fileOffset >= this.fileSize){
                console.log(this.fileOffset, this.fileSize);
                callback(null, null);
                return;
            }
            //define consts
            const reader = new FileReader();
            const blob = this.file.slice(this.fileOffset, this.fileOffset + this.chunkLength);
            //apply reader events
            //on success
            reader.onload = () => {
                callback(null, new Uint8Array(reader.result));
            };
            //on error
            reader.onerror = () => {
                callback(reader.error, null);
            };
            //change offset
            this.fileOffset += this.chunkLength;
            //call the reader
            reader.readAsArrayBuffer(blob);
        }
    }
};