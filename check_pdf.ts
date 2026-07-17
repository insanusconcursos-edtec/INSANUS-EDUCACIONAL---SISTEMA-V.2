import axios from 'axios';

async function test() {
  const url = "https://firebasestorage.googleapis.com/v0/b/planner-insanus---v2.firebasestorage.app/o/course_pdfs%2F1782664846303_TEORIA%20-%20CRIME%20E%20CONTRAVEN%C3%87%C3%83O.pdf?alt=media&token=b5c483ce-8bfa-488d-bca2-4fa0ea6f1946";
  try {
    console.log("Checking PDF URL:", url);
    const response = await axios.head(url);
    console.log("Success! Status:", response.status);
  } catch (error: any) {
    console.error("Failed:", error.message);
    if (error.response) {
       console.error("Response status:", error.response.status);
       console.error("Response data:", error.response.data.toString());
    }
  }
}

test();
