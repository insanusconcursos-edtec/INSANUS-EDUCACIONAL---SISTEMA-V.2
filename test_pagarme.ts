import axios from 'axios';
axios.post('https://api.pagar.me/core/v5/orders', {}, {
  headers: {
    'Authorization': 'Basic YmFzZTY0OmJhc2U2NA==',
    'Content-Type': 'application/json'
  }
}).catch(e => console.log(e.response?.data));
