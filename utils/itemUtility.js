const fs = require('fs');
const unzipper = require('unzipper');
const sharp = require('sharp')
const path = require('path');
const utility = require('./utility');
const Model = require('../models/Model');

exports.validateInputFields = (body, update = false) => {
    if (!body.name || !body.name.trim() ||
        !body.itemType || !body.itemType.trim() ||
        !body.description || !body.description.trim()
    ) {
        throw new Error('Invalid Input Fields');
    } else if (!update && (!body.license || !body.license.trim())) {
        throw new Error('No licence provided');
    }
}

function createAuthor(user) {
    return {
        name: user.name,
        username: user.username,
        link: user.link
    }
}

exports.isValidFileType = (type, file) => {
    const fileName = file.originalname;
    validateFileName(file);
    const fileExtension = fileName.split('.').pop();
    badType = false;
    messageType = "";
    switch(type) {
        case "profile": {
            if (fileExtension !== 'profile') {
                badType = true;
                messageType = ".profile"
            }
            break;
        }
        case "asset": {
            if (fileExtension !== 'zip' && fileExtension !== 'asset') {
                badType = true;
                messageType = ".zip or .asset"
            }
            break;
        }
        case "package":
        case "webpanel": {
                if (fileExtension !== 'zip') {
                badType = true;
                messageType = ".zip"
            }
            break;
        }
        case "config": {
            if (fileExtension !== 'json') {
                badType = true;
                messageType = ".json"
            }
            break;
        }
        case "recording": {
            if (fileExtension !== 'osrec' && fileExtension !== 'osrectxt') {
                badType = true;
                messageType = ".osrec or .osrectxt"
            }
            break;
        }
        default: {
            //unknown type
            badType = true;
            messageType = "unknown"
        }
    }
    if (badType) {
        unlinkUploadedfile(file);
        throw new Error('Invalid file type. Please upload a ' + messageType + ' file.');
    }
}

validateFileName = (file) => {
    if (file.originalname.split('.').length > 2) {
        unlinkUploadedfile(file);
        throw new Error('Invalid file name. Please remove any special characters from the file name');
    }
}

exports.validateImageFileType = (file) => {
    const fileName = file.originalname;
    validateFileName(file);
    const fileExtension = fileName.split('.').pop();
    const allowedImageTypes = ['jpg', 'jpeg', 'png'];
    if (!(allowedImageTypes.includes(fileExtension))) {
        unlinkUploadedfile(file);
        throw new Error('Invalid file type. Please upload a .jpg, .jpeg, or .png file');
    }
}

exports.isValidFileSize = (file) => {
    if (file.size > 5 * Math.pow(10, 9)) {
        throw new Error('File size exceeds 5 GB limit');
    }
}

// 10^3 = 1 KB
// 10^6 = 1 MB
// 10^9 = 1 GB
exports.validateImageFileSize = (file) => {
    if (file.size > 5 * Math.pow(10, 6)) {
        throw new Error('File size exceeds 5 MB limit');
    }
}

exports.resizeImage = async (file) => {
    let resizedFileName = 'r_' + file.filename;
    let resizedFilePath = file.destination + resizedFileName;
    let resizeResult = await sharp(file.path)
        .resize(1280, 720)
        .toFile(resizedFilePath)
        .then(() => {
            let newFile = { ...file }
            newFile.path = resizedFilePath;
            newFile.filename = resizedFileName;
            return newFile;
        });
    unlinkUploadedfile(file);
    return resizeResult;
}

checkZipFile = async(type, file, dir) => {
    if (file.mimetype === 'application/zip') {
        originalItemname = file.originalname.split('.')[0];
        await new Promise((resolve, reject) => {
            fs.createReadStream(file.path)
                .pipe(unzipper.Extract({ path: `public/upload/unzipped/${originalItemname}` }))
                .on('close', () => {
                    resolve();
                })
                .on('error', (err) => {
                    console.log(err);
                    reject(new Error('Error extracting zip file'));
                });
        });
        const files = await fs.promises.readdir(`public/upload/unzipped/${originalItemname}`);
        const containsExeFile = files.some(file => file.endsWith('.exe'));
        if (containsExeFile) {
            unlinkUploadedDir(`public/upload/unzipped/${originalItemname}`);
            throw new Error('Zip file contains .exe file');
        }
        let assetFiles = [];
        let message = '';
        switch (type) {
            case 'asset': {
                assetFiles = files.filter(file => file.endsWith('.asset') && (file === `${originalItemname}.asset`));
                message = `${originalItemname}.asset`;
                break;
            }
            case 'package': {
                assetFiles = ["anything"];
                break;
            }
            case 'webpanel': {
                assetFiles = files.filter(file => (file.endsWith('.html') || file.endsWith('.htm')) && (file === `index.html` || file === `index.htm`));
                message = 'index.html'
                break;
            }
        }
        if (assetFiles.length <= 0) {
            unlinkUploadedDir(`public/upload/unzipped/${originalItemname}`);
            throw new Error(`Zip file does not contain ${message} file`);
        }
        fs.renameSync(file.path, `${dir}/${file.originalname}`);
        unlinkUploadedDir(`public/upload/unzipped/${originalItemname}`);
        return Promise.resolve();
    } else {
        throw new Error('Invalid zip file.');
    }
}

exports.uploadItemFileToServer = async (type, file, dir) => {
    try {
        switch (type) {
            case 'asset':
            case 'package':
            case 'webpanel':
                await checkZipFile(type, file, dir)
                break;
            default: {
                fs.renameSync(file.path, `${dir}/${file.originalname}`);
                return Promise.resolve();
            }
        }
    } catch (err) {
        console.log(err);
        //delete uploaded file and directory
        fs.rm(dir, { recursive: true }, (err) => {
            if (err) {
                console.log(err);
            }
        });
        unlinkUploadedfile(file);
        return Promise.reject(err);
    }
}

exports.uploadImageFileToServer = async (file, dir) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
        // change file name
        fs.renameSync(file.path, `${dir}/${file.originalname}`);
        return Promise.resolve();
    } else {
        throw new Error('Invalid file type. Please upload valid jpg, jpeg or png file.');
    }
}

function unlinkUploadedfile(file) {
    fs.unlink(file.path, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

function unlinkUploadedDir(dir) {
    fs.rm(dir, { recursive: true }, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

function getCurrentVersionNum(dir) {
    let version = 1;
    if (fs.existsSync(dir)) {
        let versions = fs.readdirSync(dir);
        versions.forEach(file => {
            file = parseInt(file);
            if (file >= version) {
                version = file + 1;
            }
        });
    }
    return version;
}

exports.createUserDirectory = (dir, itemType) => {
    const itemTypes = ['asset', 'profile', 'recording', 'webpanel', 'config', 'package'];
    if (itemTypes.includes(itemType)) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    return dir;
}

exports.uploadItem = async (req, user, update = false) => {
    const files = req.files;
    const type = req.body.itemType;
    if (!files['file'] ) {
        throw new Error('An item file is required');
    }

    const itemName = req.body.name.replace(/ /g, '_');
    const itemType = req.body.itemType;
    let dir = `public/upload/users/${user.username}/${itemType}/${itemName}`;
    let version = getCurrentVersionNum(dir);
    dir = `${dir}/${version}`;
    let uploadDirectory = this.createUserDirectory(dir, itemType);
    const itemFile = files['file'][0];
    this.validateInputFields(req.body, update);

    // file upload
    this.isValidFileType(type, itemFile);
    this.isValidFileSize(itemFile);
    await this.uploadItemFileToServer(type, itemFile, uploadDirectory);
    let imagePath = '';
    if (files['image'] && files['image'][0]) {
        // image file upload
        const imageFile = files['image'][0];
        this.validateImageFileType(imageFile);
        this.validateImageFileSize(imageFile);
        let resizedFile = await this.resizeImage(imageFile);
        let imageFileName = resizedFile.originalname.split('.');
        imageFileName[0] = itemName;
        resizedFile.originalname = imageFileName.join('.');
        await this.uploadImageFileToServer(resizedFile, uploadDirectory);
        imagePath = path.relative('public', `${dir}/${resizedFile.originalname}`)
    } else {
        let defaultImage = `${itemType}-default.jpg`;
        imagePath = path.relative('public', defaultImage)
    }

    const author = createAuthor(user);

    const currentVersion = {
        version: `${version}`,
        url: path.relative('public', `${dir}/${itemFile.originalname}`)
    }

    const existingItem = await Model.findOne({ name: req.body.name, type: req.body.itemType });
    if (existingItem) {
        const archive = {
            version: existingItem.currentVersion.version,
            url: existingItem.currentVersion.url
        }
        existingItem.archives.push(archive);
        existingItem.author = author;
        existingItem.description = req.body.description;
        existingItem.currentVersion = currentVersion;
        existingItem.image = imagePath;
        existingItem.modified = utility.getFormattedDate(new Date());
        const item = await existingItem.save();
        return item;
    } else {
        const newItem = new Model({
            name: req.body.name,
            type: req.body.itemType,
            description: req.body.description,
            author: author,
            license: req.body.license,
            openspaceVersion: req.body.openspaceVersion,
            currentVersion: currentVersion,
            image: imagePath,
            created: utility.getFormattedDate(new Date()),
            modified: utility.getFormattedDate(new Date()),
        })
        const item = await newItem.save();
        return item;
    }
}

exports.updateImage = async (req, user) => {
    const files = req.files;
    if (!files['image']) {
        throw new Error('Image file is required');
    }

    const itemName = req.body.name.replace(/ /g, '_');
    const itemType = req.body.itemType;
    let dir = `public/upload/users/${user.username}/${itemType}/${itemName}`;
    let version = getCurrentVersionNum(dir)-1;
    dir = `${dir}/${version}`;
    let uploadDirectory = this.createUserDirectory(dir, itemType);

    const imageFile = files['image'][0];

    // image file upload
    this.validateImageFileType(imageFile);
    this.validateImageFileSize(imageFile);
    let resizedFile = await this.resizeImage(imageFile);
    let imageFileName = resizedFile.originalname.split('.');
    imageFileName[0] = itemName;
    resizedFile.originalname = imageFileName.join('.');
    await this.uploadImageFileToServer(resizedFile, uploadDirectory);

    const existingItem = await Model.findById(req.params.id);
    if (existingItem) {
        existingItem.name = req.body.name;
        existingItem.description = req.body.description;
        existingItem.image = path.relative('public', `${dir}/${resizedFile.originalname}`);
        existingItem.modified = utility.getFormattedDate(new Date());
        const item = await existingItem.save();
        return item;
    } else {
        throw new Error('Item not found');
    }
}

exports.uploadVideo = async (req, user) => {
    if (!req.body.video) {
        throw new Error('Video link is required');
    }

    this.validateInputFields(req.body);

    const author = createAuthor(user);

    const currentVersion = {
        version: `1`,
        url: req.body.video
    }

    const existingItem = await Model.findOne({ name: req.body.name, type: req.body.itemType });
    if (existingItem) {
        const archive = {
            version: existingItem.currentVersion.version,
            url: existingItem.currentVersion.url
        }
        existingItem.archives.push(archive);
        existingItem.author = author;
        existingItem.description = req.body.description;
        currentVersion.version = `${parseInt(existingItem.currentVersion.version) + 1}`;
        existingItem.currentVersion = currentVersion;
        existingItem.modified = utility.getFormattedDate(new Date());
        const item = await existingItem.save();
        return item;
    } else {
        const newItem = new Model({
            name: req.body.name,
            type: req.body.itemType,
            description: req.body.description,
            author: author,
            license: req.body.license,
            openspaceVersion: req.body.openspaceVersion,
            image: 'defaults/images/video-icon.jpg',
            currentVersion: currentVersion,
            created: utility.getFormattedDate(new Date()),
            modified: utility.getFormattedDate(new Date()),
        })
        const item = await newItem.save();
        return item;
    }
}

exports.updateVideo = async (req, user) => {
    if (!req.body.video) {
        throw new Error('Video link is required');
    }

    const currentVersion = {
        version: `1`,
        url: req.body.video
    }

    const existingItem = await Model.findById(req.params.id);
    if (existingItem) {
        const archive = {
            version: existingItem.currentVersion.version,
            url: existingItem.currentVersion.url
        }
        existingItem.archives.push(archive);
        existingItem.description = req.body.description;
        currentVersion.version = `${parseInt(existingItem.currentVersion.version) + 1}`;
        existingItem.currentVersion = currentVersion;
        existingItem.modified = utility.getFormattedDate(new Date());
        const item = await existingItem.save();
        return item;
    }
}
