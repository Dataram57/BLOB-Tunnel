const BLOBUtilities = {
    //BLOBUploader
    BLOBUploader: class {
        constructor(config){
            //file reading
            this.chunkLength = config.chunkLength;  //length of a single chunk
            this.fileOffset = 0;    //position of the reader
            this.fileSize = config.fileSize;    //expected file size, by the tunnel
            this.file = config.file;
            //events
            const func_null = () => {};
            const MakeSafeFunc = (func) => func ? func : func_null;
            this.onopen = MakeSafeFunc(config.onopen);
            this.onprogress = MakeSafeFunc(config.onprogress);
            this.onfinish = MakeSafeFunc(config.onfinish);
            this.onerror = MakeSafeFunc(config.onerror);
            //tunnel
            this.tunnel = config.tunnel;
            this.maxTransfer = config.maxTransfer;
            this.socket = null;
        }

        Start(){
            console.log(this.tunnel);
            //create WS connection
            this.socket = new WebSocket(this.tunnel);
            //setup events/behaviour

            //on open
            this.socket.addEventListener("open", e => {
                //call event
                this.onopen();
                //send next chunk of data
                SendNextChunk();
            });

            //on message
            this.socket.addEventListener("message", msg => {
                //check command
                const command = msg.data.toString().trim();
                if(command == 'next;'){
                    //wants next chunk of data
                    //call event
                    this.onprogress();
                    //send next chunk of data
                    SendNextChunk();
                }
                else{
                    console.log('Unknown command:', command);
                }
            });

            //on close
            this.socket.addEventListener("close", e => {
                this.Close();
            });

            //on error
            this.socket.addEventListener("error", err => {
                console.log(err);
                this.Close();
            });
        }

        Close(){
            console.log('closing...');
            //safely close connection
            if(this.socket)
                this.socket.close()
            //call event
            this.onfinish();
        }

        SendNextChunk(){
            this.ReadNextChunk((err, data) => {
                if(err){
                    //error
                    console.log(err);
                }
                else if(data){
                    //send next chunk of data
                    this.socket.send(data);
                }
                else{
                    //close the connection, cause that's the EOF
                    this.Close();
                }
            });
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