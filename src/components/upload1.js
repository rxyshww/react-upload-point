import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Button, Progress, Tag } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import SparkMD5 from 'spark-md5';
import axios from 'axios';

axios.defaults.baseURL="//localhost:9999";
const { Dragger } = Upload;
let hash = '';
let curSplitArr = [];
let abort = false;

function getFileReader(file, type = 'base64') {
    return new Promise(resolve => {
        let reader = new FileReader();
        if (type === 'base64') {
            reader.readAsDataURL(file);
        } else if (type === 'buffer') {
            reader.readAsArrayBuffer(file);
        }
        reader.onload = (e) => {
            resolve(e.target.result);
        }
    })
}

const uploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload() {
        return false;
    }
};


export default function Uploader() {
    let [url, setUrl] = useState('');
    let [suffix, setSuffix] = useState('');
    let [progress, setProgress] = useState(0);
    let [isOnline, setIsOnline] = useState(true);

    const postFile = useCallback(async (item) => {
        let formData = new FormData();
        formData.append('name', item.name);
        formData.append('chunk', item.chunk);
        return axios.post('/upload', formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }).then(res => {
            curSplitArr.shift();
        })
    }, []);

    const postAllChunks = useCallback(async () => {
        let complete = async () => {
            let result = await axios.get("/merge", {
                params: {
                    hash: hash,
                },
            });
            result = result.data;
            if (result.code === 0) {
                let suffix = /\.([0-9a-zA-Z]+)$/.exec(result.path)[1];
                setSuffix(suffix);
                setUrl(result.path);
            }
        };
        let i = 100 - curSplitArr.length;
        while (curSplitArr.length) {
            if (abort) {
                return Promise.reject();
            }
            await postFile(curSplitArr[0]);
            i++;
            setProgress(i);
        }
        complete();
    }, [postFile, setSuffix]);

    const handleStop = useCallback(() => {
        abort = true;
    }, []);

    const handleToggleStop = useCallback(() => {
        abort = !abort;
        if (!abort) {
            postAllChunks();
        }
    }, [postAllChunks]);

    uploadProps.onChange = useCallback(async (info) => {
        let file = info.file;
        let buffer = await getFileReader(file, 'buffer');
        let size = file.size;
        let chunks = 100;
        let start = 0;
        let splitLen = size / chunks;
        let splitArr = [];
        let spark = new SparkMD5.ArrayBuffer();
        spark.append(buffer);
        let fileMd5 = spark.end();
        hash = fileMd5;

        let suffix = /\.([0-9a-zA-Z]+)$/i.exec(file.name)[1];
        for (let i = 0; i < chunks; i++) {
            splitArr.push({
                name: `${fileMd5}_${i}.${suffix}`,
                chunk: file.slice(start, start + splitLen)
            });
            start += splitLen;
        }

        curSplitArr = splitArr;
        postAllChunks();
    }, [postAllChunks]);

    const HandleOnline = useCallback(() => {
        abort = false;
        setIsOnline(true);
        postAllChunks();
    }, [postAllChunks]);

    const HandleOffline = useCallback(() => {
        handleStop();
        setIsOnline(false);
    }, [handleStop]);

    useEffect(() => {
        window.addEventListener('online', HandleOnline, false);
        window.addEventListener('offline', HandleOffline, false);
        return () => {
            window.removeEventListener('online', HandleOnline, false);
            window.removeEventListener('offline', HandleOffline, false);
        };
    }, [HandleOnline, HandleOffline]);

    return <div style={{width: '500px'}}>
        <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
                <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag file to this area to upload</p>
            <p className="ant-upload-hint">
                Support for a single or bulk upload. Strictly prohibit from uploading company data or other
                band files
            </p>
        </Dragger>
        {   progress ? <Progress percent={progress} status={progress !== 100 ? 'active' : ''} /> : null }
        {   progress && progress !== 100 ? <Button onClick={() => handleToggleStop()}>暂停</Button> : null  }

        {   isOnline ? null : <Tag color="magenta">断网了，请检察网络，网络正常后将继续上传～</Tag>  }

        {   ['mp4', 'avi', 'mov', 'rmvb'].includes(suffix) ? <video src={url} controls></video> : null }
        {   ['png', 'gif', 'jpg', 'jpeg'].includes(suffix) ? <img src={url} alt=""/> : null}

    </div>
}
