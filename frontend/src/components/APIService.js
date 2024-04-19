export default class APIService {

    static async GetAllItems() {
        const resp = await fetch(`/api/getAllItems`, {
            'method': 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return await resp.json();
    }

    static async GetItemsByType(type) {
        const resp = await fetch(`/api/getItemsByType/${type}`, {
            'method': 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return await resp.json();
    }

    static async GetUserItems(username) {
        const resp = await fetch(`/api/getUserItems/${username}`, {
            'method': 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        return await resp.json();
    }

    static async Login(email, password) {
        const resp = await fetch(`/auth/login`, {
            'method': 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({email, password})
        });
        console.log(resp);
        return await resp.json();
    }

    static async VerifyToken(token) {
        const resp = await fetch(`/auth/verify-token`, {
            'method': 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
        return await resp.json();
    }

    static async Register(name, email, password, cnfPassword) {
        const resp = await fetch(`/auth/register`, {
            'method': 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({name, email, password, cnfPassword})
        });
        console.log(resp);
        return await resp.json();
    }

    static async SocialMediaLogin(name, accessToken, email, domain, pictureUrl) {
        const resp = await fetch(`/auth/social-media-login`, {
            'method': 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({name, accessToken, email, domain, pictureUrl})
        });
        console.log(resp);
        return await resp.json();
    }

    static async UpdateUser(username, name, email, institution) {
        const resp = await fetch(`/auth/updateUser/${username}`, {
            'method': 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({name, email, institution})
        });
        return await resp.json();
    }

    
    static async UploadItem(formData) {
        const resp = await fetch(`/api/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        return await resp.json();
    }

    static async DeleteItem(id) {
        const resp = await fetch(`/api/deleteItem/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        return await resp.json();
    }

    static async GetUser() {
        const resp = await fetch(`/auth/getUser`, {
            'method': 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        return await resp.json();
    }

    static SendImportToOpenSpaceCommand = async (url, type) => {
        var openspace = window.openspace;
        if (!openspace) {
            alert("Connect to OpenSpace first!!");
            return;
        }
        var fileName = url.substr(url.lastIndexOf('/') + 1);
        url = window.location + url;
        switch (type) {
            case 'asset':
                var absPath = await openspace.absPath('${TEMPORARY}/' + fileName)
                var pathString = '${USER_ASSETS}/';
                var scenePath = await openspace.absPath(pathString)
                await openspace.downloadFile(url, absPath["1"], true);
                await openspace.unzipFile(absPath["1"], scenePath["1"], true);
                var noextension = fileName.substr(0, fileName.indexOf('.'));
                await openspace.asset.add(scenePath["1"] + noextension + "/" + noextension);
                await openspace.setPropertyValueSingle("Modules.CefWebGui.Reload", null)
                alert("Asset imported successfully");
                break;
            case 'profile':
                var absPath = await openspace.absPath('${USER_PROFILES}/' + fileName);
                await openspace.downloadFile(url, absPath["1"], true);
                alert("Profile imported successfully");
                break;
            case 'recording':
                var absPath = await openspace.absPath('${RECORDINGS}/' + fileName);
                await openspace.downloadFile(url, absPath["1"], true);
                alert("Recording imported successfully");
                break;
            default:
                console.log('nothing to do')
                break;
        }
    }
}