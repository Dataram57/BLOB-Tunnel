const InitUploadTesterPage = () => {
    //Apply potential config
    const config = ReadURLConfig();
    console.log(config);    
    if(config){
        LockInput(chunkLengthInput, config.chunkLength);
        LockInput(maxLengthInput, config.maxFileSize);
        LockInput(tunnelAddressInput, config.tunnelAddres);
    }
};

const LockInput = (input, _value) => {
    input.disabled = true;
    if(_value)
        input.value = _value;
};

const ReadURLConfig = () => {
    try{
        return JSON.parse(decodeURIComponent(GetURLHashParam()));
    }
    catch(e){
        return null;
    }
};

const GetURLHashParam = () => {
    const i = window.location.href.indexOf('#');
    if(i > -1)
        return window.location.href.substring(i + 1);
    return null;
};

const ClickStartUpload = () => {
    //block click
    startUploadButton.disabled = true;
    //get file
    const file = fileInput.files[0];
    if (file) {
        if(file.size != maxLengthInput.value){
            console.log('wrong file size!!!!!!!!!!!!!');
        }
        //create tunnel
        blobTunnel = new BLOBUtilities.BLOBUploader({
            tunnel: tunnelAddressInput.value
            ,chunkLength: chunkLengthInput.value
            ,maxTransfer: maxLengthInput.value
            ,file: file
        });
        //set events
        //...
        //start reading
        blobTunnel.Start();
    }
};

/*
async function readChunks(file) {
    const chunkSize = 32; // Number of bytes per chunk
    let offset = 0; // Current offset in the file

    while (offset < file.size) {
        const blob = file.slice(offset, offset + chunkSize);
        const chunk = await readChunk(blob);

        // Process the chunk
        console.log(`Chunk ${offset}-${offset + chunk.byteLength - 1}:`, new Uint8Array(chunk));

        // Update the offset
        offset += chunk.byteLength;
    }
}

function readChunk(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
}
*/