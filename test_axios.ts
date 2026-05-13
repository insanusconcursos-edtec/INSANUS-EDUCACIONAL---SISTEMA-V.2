import axios from 'axios';
const getHeaders = () => {
    const secretKey = "testapikey";
    const auth = Buffer.from(secretKey + ":").toString("base64");
    return {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
    };
};
const directClient = axios.create({ headers: getHeaders() });
directClient.post('https://httpbin.org/post', { hello: "world" })
  .then(res => console.log(res.data.headers))
  .catch(e => console.log(e.response?.data));
