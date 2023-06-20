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
            this.socket = null;
        }

        //starts the upload proccess
        //initiates the WS connection
        Start(){
            //create WS connection
            this.socket = new WebSocket(this.tunnel);

            //on open
            this.socket.addEventListener("open", e => {
                //call event
                this.onopen();
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
                    this.SendNextChunk();
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

        //closes the WS connection (if exists)
        //deletes this object
        Close(){
            //safely close connection
            if(this.socket)
                this.socket.close();
            //call event
            //check if was successful
            if(this.fileSize == this.fileOffset)
                this.onfinish();
            else
                this.onerror();
        }

        //sends the next chunk of the file to the tunnel
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
                callback(null, null);
                return;
            }
            //define consts
            const reader = new FileReader();
            const step = Math.min(this.chunkLength, this.fileSize - this.fileOffset);
            const blob = this.file.slice(this.fileOffset, this.fileOffset + step);
            //apply reader events
            //on success
            reader.onload = () => {
                //convert
                const convert = new Uint8Array(reader.result);
                //callback
                callback(null, convert);
            };
            //on error
            reader.onerror = () => {
                callback(reader.error, null);
            };
            //change offset
            this.fileOffset += step;
            //call the reader
            reader.readAsArrayBuffer(blob);
        }
    }
};