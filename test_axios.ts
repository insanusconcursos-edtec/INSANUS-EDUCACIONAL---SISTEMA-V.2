import axios from 'axios';

async function test() {
  try {
    console.log("Testing axios download...");
    const url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    console.log("Success! Status:", response.status);
    console.log("Bytes received:", response.data.byteLength);
    const signature = Buffer.from(response.data).slice(0, 5).toString();
    console.log("Signature:", signature);
  } catch (error: any) {
    console.error("Axios test failed:", error.message);
    if (error.response) {
       console.error("Response status:", error.response.status);
    }
  }
}

test();
