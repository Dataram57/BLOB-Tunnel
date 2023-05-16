const apiURL = '/api/';

const Log = (e) => console.log(e);

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
        DownloadServiceRows.innerHTML = '';
        UploadServiceRows.innerHTML = '';
        //rows - Donwload
        let i = -1;
        let elem = null;
        while(++i < json.DownloadService.length){
            elem = json.DownloadService[i];
            DownloadServiceRows.innerHTML += sr + GetCopyAbleHTMLText(elem.key) + br + elem.targetFile + br + elem.progress + br + elem.leftProgress + er;
        }
        //rows - Upload
        i = -1;
        while(++i < json.UploadService.length){
            elem = json.UploadService[i];
            UploadServiceRows.innerHTML += sr + GetCopyAbleHTMLText(elem.key) + br + elem.targetFile + br + elem.targetLength + br + elem.leftLength + er;
        }
    }
};

//Download session generator
//Requirements:
//-InputFilePath
//-InputFileName
//-ButtonHost
//-CreateDownloadSessionCheckBox
//-CreateDownloadSessionResponse
const PanelHostDownload = () => {
    Log('Called a request to host a download key...');
    //disable
    InputFilePath.disabled = true;
    ButtonHost.disabled = true;
    //call API
    FetchGet('startDownload/' + encodeURIComponent(InputFilePath.value) + '/' + encodeURIComponent(InputFileName.value), (res) => {
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
                else if(res.key)
                    msg = 'Download Key: ' + GetCopyAbleHTMLText(res.key);
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
        ButtonHost.disabled = false;
        //checkbox
        if(CreateDownloadSessionCheckBox.checked)
            PanelRefreshList();
    });
};

//Init Panel
const InitPanel = () => {
    PanelRefreshList();
};