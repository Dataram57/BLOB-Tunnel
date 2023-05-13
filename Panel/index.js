const apiURL = '/api/';

let Init = () => {};

//Fetch API without any callback
const FetchAsyncGET = async (command) => {
    return await fetch(apiURL + command).then(res => {
        if(!res.ok)
            throw new Error('Network response was not ok');
        else
            return res.text();
    });
};