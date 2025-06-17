require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
const { Readable } = require('stream');

const SHEET_ID = process.env.SHEET_ID;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const PORT = process.env.PORT || 3000;

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets'
  ]
});
const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

const app = express();
app.use(cors()); 
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });
const cpUpload = upload.fields([
  { name: 'passport_photo', maxCount: 1 },
  { name: 'report_card', maxCount: 1 },
  { name: 'immunization_card', maxCount: 1 },
  { name: 'birth_cert', maxCount: 1 },
]);

app.get('/ping', (req, res) => res.send('pong'));

// ---- PART 4: Admissions Form Submission Endpoint ----

app.post('/admissions', cpUpload, async (req, res) => {
  try {
    // 1. Upload files to Google Drive and get their URLs
    const uploads = {};
    for (const field of ['passport_photo','report_card','immunization_card','birth_cert']) {
      if (req.files[field]) {
        const file = req.files[field][0];
        const driveRes = await drive.files.create({
          requestBody: {
            name: file.originalname,
            mimeType: file.mimetype,
            parents: [DRIVE_FOLDER_ID],
          },
          media: {
            mimeType: file.mimetype,
            body: Readable.from(file.buffer),
          },
        });
        await drive.permissions.create({
          fileId: driveRes.data.id,
          requestBody: { role: 'reader', type: 'anyone' },
        });
        uploads[field] = `https://drive.google.com/uc?id=${driveRes.data.id}`;
      } else {
        uploads[field] = '';
      }
    }

    // 2. Prepare the row for Google Sheet
    const body = req.body;
    let allergies = body.allergies ? body.allergies.toLowerCase() : "";
if (allergies === "none" || allergies === "no") {
  body.allergy_details = "No";
}

// Dietary Requirements auto-fill logic
let dietaryReq = body.dietary_requirements ? body.dietary_requirements.toLowerCase() : "";
if (dietaryReq === "no") {
  body.dietary_details = "No";
}

// Medication auto-fill logic
let medication = body.medication ? body.medication.toLowerCase() : "";
if (medication === "no") {
  body.medication_details = "No";
}

// Siblings at APS auto-fill logic
let siblingsAtAPS = body.siblings_at_aps ? body.siblings_at_aps.toLowerCase() : "";
if (siblingsAtAPS === "no") {
  body.siblings_details = "No";
}
    const row = [
  body.full_name,
  body.date_of_birth,
  body.country_of_birth,
  body.nationality,
  body.mother_tongue,
  body.meal_preference,
  body.publish_photos,
  body.home_address,
  body.previous_school,
  body.last_completed_year,
  body.father_name,
  body.father_mobile,
  body.father_email,
  body.father_address,
  body.father_occupation,
  body.father_employer,
  body.mother_name,
  body.mother_mobile,
  body.mother_email,
  body.mother_address,
  body.mother_occupation,
  body.mother_employer,
  body.guardian_name,
  body.guardian_relation,
  body.guardian_occupation,
  body.guardian_mobile,
  body.guardian_email,
  body.emergency1_name,
  body.emergency1_tel,
  body.emergency1_relation,
  body.emergency2_name,
  body.emergency2_tel,
  body.emergency2_relation,
  body.siblings_at_aps,
  body.siblings_details,
  uploads.passport_photo,
  uploads.report_card,
  uploads.immunization_card,
  uploads.birth_cert,
  body.allergies,
  body.allergy_details,
  body.medication,
  body.medication_details,
  body.ok_to_give_paracetamol,
  body.immunized_tetanus,
  body.immunized_polio,
  body.immunized_measles,
  body.immunized_tb,
  body.immunized_others,
  body.dietary_requirements,
  body.dietary_details,
  body.alt_contact1_name,
  body.alt_contact1_tel,
  body.alt_contact1_relation,
  body.alt_contact2_name,
  body.alt_contact2_tel,
  body.alt_contact2_relation,
  body.other_conditions,
    "Pending",    // <-- Fills "Payment Status"
  "Processed"   // <-- Fills "Processed"
];


    // 3. Append to Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1',
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- PART 5: Start the Server ----

app.listen(PORT, () => {
  console.log(`🚀 Admissions server listening on http://localhost:${PORT}/`);
});
