const GetURLHashParam = () => {
    const i = window.location.href.indexOf('#');
    if(i > -1)
        return window.location.href.substring(i + 1);
    return null;
};