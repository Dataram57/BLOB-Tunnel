const apiURL = '/api/';
const uploadTesterURL = 'upload-tester/';
let tunnelAddress = 'localhost';
let tunnelUseSSL = false;
const tunnelUploadDir = '/upload/';
const tunnelDownloadDir = '/download/';

const LoadTunnelInfo = () => {
    return new Promise(resolve => {
        //call
        FetchGet('info',(data) => {
            try{
                const info = JSON.parse(data);
                //set
                tunnelAddress = info.address;
                tunnelUseSSL = info.useSSL;
                //callback
                resolve();
            }
            catch(e){
                resolve({
                    error: e
                    ,data: data
                });
            }
        });
    });
};

const Log = (e) => console.log(e);

const GetTunnelWSAddress = () => {
    if(tunnelUseSSL)
        return 'wss://' + tunnelAddress;
    return 'ws://' + tunnelAddress;
};

const GetTunnelHTTPAddress = () => {
    if(tunnelUseSSL)
        return 'https://' + tunnelAddress;
    return 'http://' + tunnelAddress;
};

const GetTunnelUploadAddress = (key) => GetTunnelWSAddress() + tunnelUploadDir + key;
const GetTunnelDownloadAddress = (key) => GetTunnelHTTPAddress() + tunnelDownloadDir + key;

//Fetch API without any callback
const FetchAsyncGET = async (command) => {
    return await fetch(apiURL + command).then(res => {
        if(!res.ok)
            throw new Error('Network response was not ok');
        else
            return res.text();
    });
};

//Fetch API
const FetchGet = (command, callback) => {
    fetch(apiURL + command).then(async res => {
        if(!res.ok)
            callback(new Error('Network response was not ok'));
        else
            callback(await res.text());
    });
};

const CopyElemText = (e) => {
    navigator.clipboard.writeText(e.innerHTML);
};

const GetCopyAbleHTMLText = (txt) => {
    return '<a href="javascript:void(0)" onclick="CopyElemText(this)">' + txt + '</a>';
};

//Refresh list
//Requirements:
//-DownloadServiceCounter
//-DownloadServiceRows
//-UploadServiceCounter
//-UploadServiceRows
const PanelRefreshList = async () => {
    Log('Refreshing');
    const res = await FetchAsyncGET('list');
    if(res){
        const sr = '<tr><td>';
        const br = '</td><td>';
        const er = '</td></tr>';
        const json = JSON.parse(res);
        //counters
        DownloadServiceCounter.innerHTML = json.DownloadService.length;
        UploadServiceCounter.innerHTML = json.UploadService.length;
        //clear rows
        DownloadServiceRows.innerHTML = DownloadServiceRowsStart;
        UploadServiceRows.innerHTML = UploadServiceRowsStart;
        //rows - Donwload
        let i = -1;
        let elem = null;
        while(++i < json.DownloadService.length){
            elem = json.DownloadService[i];
            DownloadServiceRows.innerHTML += sr + GetCopyAbleHTMLText(elem.key) + br + elem.targetFile + br + elem.fileName + br + elem.offset + br + elem.length + er;
        }
        //rows - Upload
        i = -1;
        while(++i < json.UploadService.length){
            elem = json.UploadService[i];
            UploadServiceRows.innerHTML += sr + GetCopyAbleHTMLText(elem.key) + br + elem.targetFile + br + elem.targetLength + br + elem.length + er;
        }
    }
};

//Download session generator
//Requirements:
//-InputFilePath
//-InputFileName
//-ButtonHostDownload
//-CreateDownloadSessionCheckBox
//-CreateDownloadSessionResponse
const PanelHostDownload = () => {
    Log('Called a request to host a download session...');
    //disable
    InputFilePath.disabled = true;
    ButtonHostDownload.disabled = true;
    //construct config
    const config = {
        targetFile: InputFilePath.value
        ,fileName: InputFileName.value
    };
    //call API
    FetchGet('startDownload/' + encodeURIComponent(JSON.stringify(config)), (res) => {
        //switch
        let msg = '';
        if(typeof(res) == 'object'){
            //error
            msg = 'Error with the connection to the API.';
        }
        else{
            //string response
            try{
                //convert
                res = JSON.parse(res);
                //read error
                if(res.error)
                    msg = res.error;
                else if(res.key){
                    msg = 'Download Key: ' + GetCopyAbleHTMLText(res.key);
                    msg += '<br>Click <a target="_blank" href="' + GetTunnelDownloadAddress(res.key) + '">here</a> to test this download.';
                }
                else
                    msg = "Response does not contain neither a key, nor an error.";
            }
            catch(e){
                Log(e);
                msg = 'Error with the JSON format.';
            }
        }
        //msg
        CreateDownloadSessionResponse.innerHTML = msg;
        //enable
        InputFilePath.disabled = false;
        ButtonHostDownload.disabled = false;
        //checkbox
        if(CreateDownloadSessionCheckBox.checked)
            PanelRefreshList();
    });
};

//Download session generator
//Requirements:
//-InputOutputFilePath
//-InputChunkLength
//-InputMaxiumumFileSize
//-ButtonHostUpload
//-CreateUploadSessionResponse
//-CreateUploadSessionCheckBoxLock
//-CreateUploadSessionCheckBoxRefresh
const PanelHostUpload = () => {
    Log('Called a request to host a upload session...');
    //disable
    InputOutputFilePath.disabled = true;
    InputChunkLength.disabled = true;
    InputMaxiumumFileSize.disabled = true;
    ButtonHostUpload.disabled = true;
    CreateUploadSessionCheckBoxLock.disabled = true;
    //Construct config
    const config = {
        outputPath: InputOutputFilePath.value
        ,chunkLength: parseInt(InputChunkLength.value)
        ,maxFileSize: parseInt(InputMaxiumumFileSize.value)
        ,lock: CreateUploadSessionCheckBoxLock.checked
    };
    //call API
    FetchGet('startUpload/' + encodeURIComponent(JSON.stringify(config)), (res) => {
        let msg = '';
        if(typeof(res) == 'object'){
            //error
            msg = 'Error with the connection to the API.';
        }
        else{
            //string response
            try{
                //convert
                res = JSON.parse(res);
                //read error
                if(res.error)
                    msg = res.error;
                else if(res.key){
                    msg = 'Download Key: ' + GetCopyAbleHTMLText(res.key) + '<br>';
                    //generate a helpful link
                    const config2 = {
                        chunkLength: config.chunkLength
                        ,maxFileSize: config.maxFileSize
                        ,tunnelAddres: GetTunnelUploadAddress(res.key)
                    };
                    const url = uploadTesterURL + '#' + encodeURIComponent(JSON.stringify(config2));
                    msg += 'Click <a target="_blank" href="' + url + '">here</a> to test this upload.';
                }
                else
                    msg = "Response does not contain neither a key, nor an error.";
            }
            catch(e){
                Log(e);
                msg = 'Error with the JSON format.';
            }
        }
        //msg
        CreateUploadSessionResponse.innerHTML = msg;
        //enable
        InputOutputFilePath.disabled = false;
        InputChunkLength.disabled = false;
        InputMaxiumumFileSize.disabled = false;
        ButtonHostUpload.disabled = false;
        CreateUploadSessionCheckBoxLock.disabled = false;
        //checkbox
        if(CreateUploadSessionCheckBoxRefresh.checked)
            PanelRefreshList();
    });
};


//Init Panel
//Requirements:
//-DownloadServiceRows
//-var DownloadServiceRowsStart
//-UploadServiceRows
//-var UploadServiceRowsStart
const InitPanel = async () => {
    //catch old innerHMTL
    DownloadServiceRowsStart = DownloadServiceRows.innerHTML;
    UploadServiceRowsStart = UploadServiceRows.innerHTML;
    //refresh
    const result = await LoadTunnelInfo();
    if(result){
        document.write('There was a problem with setting up the tunnel info.<br>');
        document.write(result.error);
        document.write('<br>');
        document.write(result.response);
        return;
    }
    PanelRefreshList();
    //add 
    InputFileInfo.addEventListener("change", () => {
        //check if disabled
        if(!InputOutputFilePath.disabled){
            const file = InputFileInfo.files[0];
            InputOutputFilePath.value = file.name;
            InputMaxiumumFileSize.value = file.size;
        }
    });
};