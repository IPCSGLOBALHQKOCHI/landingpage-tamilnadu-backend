const express = require("express");
const app = express();
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");
require("dotenv").config();
const request = require("request");

const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const GOOGLE_SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxitm6rWGKmJ69JIivq_sIHiTtr08q8wJWUK_E0Trk7qT78tUoCItolmTPAGGBqV8wM/exec";

const EDUZILLA_API_URL = "https://erp.eduzilla.in/api/leads/add_new_lead";

const instCode = "IPCS_Gbl08";
const urlSecurityCode = "ipcsglobal";

const branchMapping = {
  CNI: "Chennai",
  CBE: "Coimbatore",
  MDI: "Madurai",
  SAL: "Salem",
  TBM: "Tambaram",
  TEN: "Tirunelveli",
  TCY: "Trichy",
};

const courseMapping = {
  DM: "Ai Integrated Digital Marketing",
  INAUT: "Industrial Automation",
  BST: "Software Testing",
  IT: "Python and Data Science",
  BMS: "BMS & CCTV",
  PDAI: "Artificial Intelligence",
  EMB: "Embedded & IoT",
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("Error with email transporter:", error);
  } else {
    console.log("Email transporter is ready");
  }
});

app.post("/api/submitform", async (req, res) => {
  const { name, mobileNumber, course, location, email, timestamp } = req.body;

  if (!name || !mobileNumber || !course || !location || !timestamp) {
    return res
      .status(400)
      .json({ error: "All fields except email are required" });
  }

  const branchName = branchMapping[location];
  const courseName = courseMapping[course];

  if (!branchName) {
    return res.status(400).json({ error: "Invalid branch code provided" });
  }
  if (!courseName) {
    return res.status(400).json({ error: "Invalid course code provided" });
  }

  const emailContent = `
    <h3>New Form Submission Tamilnadu</h3>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Mobile:</strong> ${mobileNumber}</p>
    <p><strong>Course:</strong> ${courseName}</p>
    <p><strong>Location:</strong> ${branchName}</p>
    <p><strong>Date & Time:</strong> ${timestamp}</p>
    ${email ? `<p><strong>Email:</strong> ${email}</p>` : ""}
  `;

  // Mail options
  const mailOptions = {
    from: "info@ipcsglobal.com",
    to: "ipcsglobalindia@gmail.com,dmmanager.ipcs@gmail.com",
    subject: "Lead Form Submission",
    html: emailContent,
  };

  try {
    // Send email
    const emailResult = await transporter.sendMail(mailOptions);
    console.log("Email sent:", emailResult.response);

    // Send data to Google Sheets via Apps Script Web App
    const sheetResponse = await axios.post(GOOGLE_SHEET_WEB_APP_URL, {
      name,
      mobileNumber,
      course: courseName,
      location: branchName,
      email,
      timestamp,
    });

    if (sheetResponse.data.status !== "success") {
      console.error("Google Sheets Error:", sheetResponse.data);
      throw new Error("Failed to add data to Google Sheet");
    }
    console.log("Data added to Google Sheet");

    // Send data to Eduzilla API

    const options = {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      url: EDUZILLA_API_URL,
      form: {
        inst_code: instCode,
        url_security_code: urlSecurityCode,
        fname: name,
        email: email || "N/A",
        mobile: mobileNumber,
        branch: location,
        course: course,
      },
    };

    console.log("Request data:", {
      instCode,
      urlSecurityCode,
      fname: name,
      email,
      mobile: mobileNumber,
      branch: location,
      course,
    });

    request.post(options, function (error, response) {
      if (error) {
        console.error("Eduzilla Error:", error);
        throw new Error("Failed to add lead to Eduzilla");
      }
      if (response.statusCode !== 200) {
        throw new Error("Failed to add lead to Eduzilla");
      }
      console.log("Lead added to Eduzilla");
    });

    // All processes succeeded
    res.status(200).json({
      message:
        "Form submitted, email sent, data added to Google Sheet, and lead sent to Eduzilla!",
    });
  } catch (error) {
    console.error("Error:", error.message || error);
    res.status(500).json({ error: "Failed to process the request" });
  }
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
