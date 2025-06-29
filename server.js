const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { spawn } = require("child_process");
const sqlite = require("sqlite3");
const { fromPath } = require("pdf2pic");
const fs = require("fs").promises;
const path = require("path");
const fontkit = require("@pdf-lib/fontkit");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const db = new sqlite.Database("./files-database.db"); // Adjust path as needed
const port = 3000;
const app = express();
const saveFolder = "./saved_pdfs"; // Adjust folder path as needed
app.use(express.json());
app.use(cors());
app.use("./uploads", express.static("uploads"));
app.use("/outputs", express.static("outputs"));
function isRTL(text) {
  const rtlChars = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlChars.test(text);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const filename = Buffer.from(file.fieldname, "latin1").toString("utf-8");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      filename +
        "-" +
        uniqueSuffix +
        file.originalname.slice(file.originalname.lastIndexOf("."))
    );
  },
});

const upload = multer({ storage: storage });

function get_template(templateId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM pdfs WHERE id = ? LIMIT 1`,
      [templateId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error("PDF not found"));
        resolve(row);
      }
    );
  });
}

app.post("/api/pdf_forms", upload.single("file"), async (req, res) => {
  const { name, fields } = req.body;
  const filepath = req.file.path;
  const db = new sqlite.Database("./files-database.db");
  const sql = `INSERT INTO templates (template_name, file_path, fields) VALUES (?, ?, ?)`;
  db.run(sql, [name, filepath, fields], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Respond with the ID of the new template
    res.json({ success: true, templateId: this.lastID });
  });
  db.close();
});

app.post(
  "/api/auto_detect",
  upload.single("forAutoDetect"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    let imagePath = req.file.path;
    const originalPath = req.file.path;
    let isTempImage = false;
    const image_diamensions = req.body.viewportdimations;
    const outputDirectory = path.resolve(__dirname, "outputs");
    imagePath = req.file.path;
    const pythonScriptPath = path.resolve(__dirname, "gemini_util.py"); // <-- IMPORTANT: Set your script name
    console.log(
      `Spawning Python process: ${pythonScriptPath} with image ${imagePath}`
    );

    const pythonProcess = spawn("python", [
      pythonScriptPath,
      originalPath,
      image_diamensions,
    ]);

    let resultData = ""; // This will store the clean JSON from stdout
    let logData = ""; // This will store all the logs and errors from stderr

    // LISTENER FOR THE "MAIN DATA PIPE" (stdout)
    pythonProcess.stdout.on("data", (data) => {
      // This only gets the final `print(json.dumps(...))`
      resultData += data.toString();
    });

    // LISTENER FOR THE "LOGGING PIPE" (stderr)
    pythonProcess.stderr.on("data", (data) => {
      // This gets all your `print(..., file=sys.stderr)` messages
      logData += data.toString();
    });

    // HANDLER FOR WHEN THE SCRIPT FINISHES
    pythonProcess.on("close", (code) => {
      // 1. ALWAYS print the logs to your Node.js console for debugging.
      // This is how you see your Python prints in your Node.js terminal.
      if (logData) {
        console.log("--- Logs from Python Script ---");
        console.log(logData);
        console.log("-------------------------------");
      }

      console.log(`Python process exited with code ${code}`);

      // 2. If there was an error, include the logs in the error response.
      if (code !== 0) {
        return res.status(500).json({
          success: false,
          error: "Analysis failed in Python.",
          details: logData, // Incredibly useful for debugging!
        });
      }

      // 3. If successful, parse the clean data from stdout.
      try {
        const finalResult = JSON.parse(resultData);
        res.status(200).json({ success: true, data: finalResult });
      } catch (e) {
        res
          .status(500)
          .json({ success: false, error: "Invalid JSON format from Python." });
      }
    });
  }
);

app.post("/api/generate-pdf", upload.single("pdfFile"), async (req, res) => {
  let valueOfBoxes = req.body.valueofboxs;
  valueOfBoxes =
    typeof valueOfBoxes === "string" ? JSON.parse(valueOfBoxes) : valueOfBoxes;
  const dimeensions =
    typeof req.body.viewportdimations === "string"
      ? JSON.parse(req.body.viewportdimations)
      : req.body.viewportdimations;
  // Example: extract name
  const name = valueOfBoxes.name;
  // Example: extract fields array from first page
  const fields = valueOfBoxes.pages[0].fields;
  // Example: log each field's value
  fields.forEach((field) => {
    console.log("Field name:", field.name);
    console.log("Field value:", field.value);
    console.log(
      "Field coordinates:",
      field.x,
      field.y,
      field.width,
      field.height
    );
  });
  const templateId = valueOfBoxes.id; // it's a string
  console.log("PAth ");
  console.log(templateId);
  let file_path;
  if (req.file) {
    file_path = req.file.path;
    // Generate new filename with template ID
    const originalFileName = req.file.originalname;
    const fileExtension = path.extname(originalFileName);
    const newFileName = `${templateId}_${Date.now()}${fileExtension}`;
    const newFilePath = path.join(saveFolder, newFileName);
    const fileData = await fs.readFile(file_path);
    await fs.writeFile(newFilePath, fileData);

    const insertQuery = `INSERT OR IGNORE INTO pdfs (id, file_path, dimensions) VALUES (?, ?, ?)`;

    console.log(
      `Inserting file with template ID: ${templateId} and new file path: ${newFilePath} and dimensions: ${JSON.stringify(
        dimeensions
      )}`
    );
    db.run(
      insertQuery,
      [templateId, newFilePath, JSON.stringify(dimeensions)],
      function (err) {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ error: "Failed to save file information to database" });
        }

        console.log(`File saved with database ID: ${this.lastID}`);
        console.log(`Template ID: ${templateId}`);
        console.log(`File path: ${newFilePath}`);
      }
    );
  } else {
    try {
      const template = await get_template(templateId);
      file_path = template.file_path;
      dimeensions = JSON.parse(template.dimensions);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }
  // Path to the uploaded PDF file
  console.log(`Received file for template ID: ${templateId}`);
  console.log(`File path: ${file_path}`);

  const pdfBytes = await fs.readFile(file_path);
  const parsedFields = typeof fields === "string" ? JSON.parse(fields) : fields;
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Load custom Arabic font
  pdfDoc.registerFontkit(fontkit);
  const arabicFontBytes = await fs.readFile("Cairo-Bold.ttf"); // Make sure the font file exists
  const arabicFont = await pdfDoc.embedFont(arabicFontBytes);
  const pages = pdfDoc.getPages();
  const firstpage = pages[0];
  const pageHeight = firstpage.getHeight();
  console.log(parsedFields);

  parsedFields.forEach((field, index) => {
    let { x, y, width, height, name, value } = field;
    if (value === undefined || value === null || value === "") {
      return;
    } // Skip empty values
    const scaleX = firstpage.getWidth() / dimeensions.viewportWidth; // Use your canvas width from frontend
    const scaleY = firstpage.getHeight() / dimeensions.viewportHeight; // Use your canvas height from frontend

    x = x * scaleX;
    y = y * scaleY;
    width = width * scaleX;
    height = height * scaleY;
    y = pageHeight - y;
    let x2 = x + width;
    let y2 = y - height;
    y = (y + y2) / 2;
    const fontSize = Math.min(width, height) * 0.5;
    const textWidth = arabicFont.widthOfTextAtSize(value, fontSize);

    console.log("Text Width:", textWidth);
    const rtlX = x2 - textWidth; // Align text to the right edge of the box
    x += 4; // Add some padding to the left
    y -= 2; // Adjust y position slightly for better centering
    if (isRTL(name)) {
      // If the text is RTL, adjust the x position accordingly
      x = rtlX;
      x -= 4; // Add some padding to the left
    }
    console.log(value);
    firstpage.drawText(value, {
      x: x,
      y: y,
      font: arabicFont, // Use the custom Arabic font
      size: fontSize,
    });
  });
  const pdfdoc = await pdfDoc.save();

  // Instead of saving to disk and returning a URL, send as download:
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=stamped-file.pdf");
  res.send(Buffer.from(pdfdoc));
  console.log("PDF sent as download");
});

app.post("/api/image_to_excel", upload.single("forExle"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  const imagePath = req.file.path;
  const pythonScriptPath = path.resolve(__dirname, "ducoment_to_excel.py");
  console.log(
    `Spawning Python process: ${pythonScriptPath} with image ${imagePath}`
  );

  const pythonProcess = spawn("python", [pythonScriptPath, imagePath]);

  let resultData = ""; // This will store the clean JSON from stdout
  let logData = ""; // This will store all the logs and errors from stderr

  // LISTENER FOR THE "MAIN DATA PIPE" (stdout)
  pythonProcess.stdout.on("data", (data) => {
    // This only gets the final `print(json.dumps(...))`
    resultData += data.toString();
  });

  // LISTENER FOR THE "LOGGING PIPE" (stderr)
  pythonProcess.stderr.on("data", (data) => {
    // This gets all your `print(..., file=sys.stderr)` messages
    logData += data.toString();
  });

  // HANDLER FOR WHEN THE SCRIPT FINISHES
  pythonProcess.on("close", async (code) => {
    // 1. ALWAYS print the logs to your Node.js console for debugging.
    if (logData) {
      console.log("--- Logs from Python Script ---");
      console.log(logData);
      console.log("-------------------------------");
    }

    console.log(`Python process exited with code ${code}`);

    // 2. If there was an error, include the logs in the error response.
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: "Analysis failed in Python.",
        details: logData,
      });
    }

    try {
      console.log("Result Data:", resultData);

      // Extract the last JSON-looking line
      const lines = resultData.trim().split("\n");
      const lastLine = lines[lines.length - 1];

      const finalResult = JSON.parse(lastLine);
      const excelPath =
        finalResult.file_path || path.join(__dirname, "form_data.xlsx");

      // Check if file exists before trying to read it
      try {
        const excelBuffer = await fs.readFile(excelPath);

        // Send the Excel file as download
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=\"form_data.xlsx\"; filename*=UTF-8''%D8%A7%D9%84%D9%85%D9%84%D9%81.xlsx"
        );
        res.send(excelBuffer);

        console.log("Excel file sent as download");

        // Clean up: optionally delete the temporary file
        // await fs.unlink(excelPath);
      } catch (fileError) {
        console.error("Error reading Excel file:", fileError);
        return res.status(500).json({
          success: false,
          error: "Excel file not found or could not be read.",
          details: fileError.message,
        });
      }
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Raw Result Data:", resultData);
      return res.status(500).json({
        success: false,
        error: "Invalid JSON format from Python.",
        details: parseError.message,
        rawData: resultData,
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Use http://localhost:${port}`);
});
