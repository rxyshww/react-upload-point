const fs = require('fs');
const multiparty = require("multiparty");
const express = require("express");
const path = require('path');
const cors = require("cors");

const uploadDir = `${__dirname}/upload`;
const PORT = 9999;

const app = express();
app.use(cors());
app.listen(PORT, () => {
    console.log(`THE WEB SERVICE IS CREATED SUCCESSFULLY AND IS LISTENING TO THE PORT：${PORT}`);
});

function handleMultiparty(req, res) {
    return new Promise((resolve, reject) => {
        // multiparty的配置
        let options = {
            maxFieldsSize: 200 * 1024 * 1024
        };
        let form = new multiparty.Form(options);
        // multiparty解析
        form.parse(req, function (err, fields, files) {
            if (err) {
                res.send({
                    code: 1,
                    reason: err
                });
                reject(err);
                return;
            }
            resolve({
                fields,
                files
            });
        });
    });
}


app.use(cors());
app.post('/upload', async (req, res) => {
    let {
        fields,
        files
    } = await handleMultiparty(req, res);

    let [chunk] = files.chunk,
        [filename] = fields.name;
    let hash = /([0-9a-zA-Z]+)_\d+/.exec(filename)[1],
        // suffix = /\.([0-9a-zA-Z]+)$/.exec(file.name)[1],
        path = `${uploadDir}/${hash}`;
    !fs.existsSync(path) ? fs.mkdirSync(path) : null;
    path = `${path}/${filename}`;

    fs.access(path, async err => {
        if (!err) {
            res.send({
                code: 0,
                path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
            });
            return;
        }

        // 为了测试出效果，延迟
        await new Promise(resolve => {
            setTimeout(_ => {
                resolve();
            }, 50);
        });

        let readStream = fs.createReadStream(chunk.path);
        let writeStream = fs.createWriteStream(path);
        readStream.pipe(writeStream);
        readStream.on('end', () => {
            fs.unlinkSync(chunk.path);
            res.send({
                code: 0,
                path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
            });
        })
    })
});

app.get('/merge', (req, res) => {
    let {
        hash
    } = req.query;

    let path = `${uploadDir}/${hash}`,
        fileList = fs.readdirSync(path),
        suffix;
    fileList.sort((a, b) => {
        let reg = /_(\d+)/;
        return reg.exec(a)[1] - reg.exec(b)[1];
    }).forEach(item => {
        !suffix ? suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1] : null;
        fs.appendFileSync(`${uploadDir}/${hash}.${suffix}`, fs.readFileSync(`${path}/${item}`));
        fs.unlinkSync(`${path}/${item}`);
    });
    fs.rmdirSync(path);
    res.send({
        code: 0,
        path: `http://127.0.0.1:${PORT}/upload/${hash}.${suffix}`
    });
});


app.use(express.static(path.join(__dirname, './')));
app.use((req, res) => {
    res.status(404);
    res.send('NOT FOUND!');
});
