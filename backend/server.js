require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const PDFDocument = require('pdfkit');

const app = express();
const port = 5001;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// -------------------------
// Initialize SQLite Database
// -------------------------
const db = new sqlite3.Database('./agri_ai.db', (err) => {
  if (err) return console.error('DB Error:', err.message);
  console.log('Connected to SQLite database.');
  db.run(`CREATE TABLE IF NOT EXISTS user_inputs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, location TEXT, land_size TEXT, land_type TEXT, land_health TEXT, season TEXT, water_facility TEXT, duration TEXT, language TEXT DEFAULT 'en', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  // Add language column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE user_inputs ADD COLUMN language TEXT DEFAULT 'en'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding language column:', err.message);
    }
  });
});

// -------------------------
// Middlewares
// -------------------------
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// -------------------------
// Helper function for Gemini API call
// -------------------------
async function callGeminiAPI(prompt) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }

  const data = await response.json();
  let content = data.candidates[0].content.parts[0].text.trim();
  content = content.replace(/```json\s*([\s\S]*?)```/g, '$1').replace(/```/g, '').trim();

  // Try to parse as JSON, if fails, return as text
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const jsonContent = content.substring(jsonStart, jsonEnd + 1).trim();
    try {
      return JSON.parse(jsonContent);
    } catch (err) {
      // If JSON parsing fails, return the full content as text
      return content;
    }
  } else {
    // No JSON found, return as text
    // Clean the text: remove markdown formatting
    content = content.replace(/\*\*/g, '').replace(/^\*\s*/gm, '').replace(/^- /gm, '').replace(/\n\s*\n/g, '\n');
    return content;
  }
}

// -------------------------
// Helper function for Google Translate API call
// -------------------------
async function translateText(text, targetLanguage, sourceLanguage = 'en', apiKey) {
  console.log('Translating text to', targetLanguage, 'text length:', text.length);
  if (!apiKey) {
    console.warn('Google Translate API key not provided, returning original text');
    return text;
  }

  const params = new URLSearchParams();
  params.append('target', targetLanguage);
  params.append('source', sourceLanguage);
  params.append('key', apiKey);
  params.append('q', text);

  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?${params}`, {
    method: 'POST',
  });

  console.log('Translation response ok:', response.ok);
  if (!response.ok) {
    console.warn('Translation failed, returning original text');
    const errorText = await response.text();
    console.log('Translation error:', errorText);
    return text;
  }

  const data = await response.json();
  console.log('Translation successful');
  return data.data.translations[0].translatedText;
}

// -------------------------
// Routes
// -------------------------

// Save user input
app.post('/api/user-inputs', (req, res) => {
  const { userId, location, landSize, landType, landHealth, season, waterFacility, duration, language } = req.body;
  if (!location || !landSize || !landType || !season || !waterFacility || !duration) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sql = `INSERT INTO user_inputs (user_id, location, land_size, land_type, land_health, season, water_facility, duration, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = [userId || 'anonymous', location, landSize, landType, landHealth || '', season, waterFacility, duration, language || 'en'];

  db.run(sql, values, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save user input', details: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

// Get user input history
app.get('/api/user-inputs/:userId', (req, res) => {
  const { userId } = req.params;
  const sql = `SELECT * FROM user_inputs WHERE user_id = ? ORDER BY created_at DESC`;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch user inputs', details: err.message });
    res.json(rows);
  });
});

// Crop Analysis (Recommended Crops)
app.post('/api/crop-analysis', async (req, res) => {
  const { location, landSize, landType, landHealth, season, waterFacility, duration, language, apiKey } = req.body;
  console.log('Received language:', language);
  if (!location || !landSize || !landType || !season || !waterFacility || !duration) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompt = `
You are an expert agricultural advisor. Generate a professional farm advisory report in a strict line-by-line format with extra spacing for readability. The report should include accurate labor, total investment, and profit calculations, and include credible resource links for each data point (yield, price, fertilizer, labor, irrigation, etc.) so the report can be verified.

Farm Details:
- Location: ${location}, India
- Land Size: ${landSize}
- Soil Type: ${landType}
- Soil Health: ${landHealth}
- Water Availability: ${waterFacility}
- Crop Duration Preference: ${duration}

Instructions for AI:
1. Provide a summary of the farm.
2. List top 5 profitable crop options suitable for the soil, water, and crop duration.
3. For each crop, provide line-by-line details with extra spacing:
   - Yield: Low/High (kg/acre or tonnes/acre)
   - Market Price: Low/High (Rs/kg or Rs/tonne)
   - Water Needs
   - Fertilizer Requirements (NPK & micronutrients)
   - Labor Requirements (land prep, sowing, irrigation, weeding, fertilization, harvesting) in person-days
   - Cost Breakdown per acre: Seeds, Fertilizer, Labor, Irrigation, Other
   - Total Investment per acre
   - Profitability: Low Yield/Low Price and High Yield/High Price
4. Recommend the best crop(s) for this farm with reasoning.
5. Include a profit & cost table in markdown format with line breaks in headers.
6. End with a disclaimer about variability in yield, price, and labor.

Formatting Rules:
- Strict line-by-line format with extra blank lines between sections for readability, no paragraphs. Each point on a separate line.
- Use numbered/bulleted lists where appropriate.
- No bold or italic markdown.
- Include URLs for all sources.
- Make it professional, clear, and trustworthy.

Example output format:

Farm Summary:

- Location: ...

- Land Size: ...

- Soil Type: ...

...

Top 5 Crop Options:

1. Crop Name

2. Crop Name

...

Detailed Crop Analysis:

1. Crop Name:

   - Yield: Low/High (kg/acre or tonnes/acre)

   - Price: Low/High (Rs/kg or Rs/tonne)

   - Water Needs: ...

   - Fertilizer: ...

   - Labor Requirements: ... person-days

   - Cost Breakdown per acre: Seeds-..., Fertilizer-..., Labor-..., Irrigation-..., Other-...

   - Total Investment: Rs ...

   - Profitability: Low Yield/Low Price- Rs ..., High Yield/High Price- Rs ...

...

Best Crop Recommendation:

- Crop Name [Reason]

Profit & Cost Table:

| Crop | Yield Low/High (kg/acre or tonnes/acre) | Price Low/High (Rs/kg or Rs/tonne) | Total Cost (Rs/acre) | Gross Revenue Low/High (Rs/acre) | Net Profit Low/High (Rs/acre) |

|------|-----------------------------------------|------------------------------------|----------------------|-----------------------------------|-------------------------------|

...

Disclaimer:
`;

  try {
    let result = await callGeminiAPI(prompt);

    // If language is not English, translate the entire text response
    let title = 'Farm Advisory Report';
    if (language && language !== 'en') {
      console.log('Translating result and title to', language);
      result = await translateText(result, language, 'en', apiKey);
      title = await translateText(title, language, 'en', apiKey);
      console.log('Translation completed, title:', title);

      // Ensure proper UTF-8 encoding for PDF generation
      if (typeof result === 'string') {
        result = result.normalize('NFC');
      }
      if (typeof title === 'string') {
        title = title.normalize('NFC');
      }
    }

    // Generate PDF from the result text
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="farm_advisory_report.pdf"',
        'Content-Length': pdfData.length,
      });
      res.end(pdfData);
    });

    // Use built-in PDF fonts that support Unicode characters
    try {
      // Try to use a Unicode-compatible built-in font
      doc.font('Times-Roman');
    } catch (e) {
      // If Times-Roman fails, use default
      console.log('Using default PDF font');
    }

    // Add title
    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown();

    // Add content with structured formatting
    if (typeof result === 'string') {
      const lines = result.split('\n');
      doc.fontSize(12);
      let inTable = false;
      let tableRows = [];

      const renderTable = (rows) => {
        const columnWidths = [150, 100, 100, 120, 120, 120];
        const startX = doc.x;
        let y = doc.y;
        const rowHeight = 20;

        // Draw header row background
        doc.rect(startX, y, columnWidths.reduce((a,b) => a+b,0), rowHeight).fill('#eeeeee');
        doc.fillColor('black').font('Helvetica-Bold');

        // Header row
        const headers = rows[0];
        let x = startX;
        headers.forEach((header, i) => {
          doc.text(header, x + 5, y + 5, { width: columnWidths[i] - 10, align: 'left' });
          x += columnWidths[i];
        });

        y += rowHeight;
        doc.font('Helvetica').fillColor('black');

        // Data rows
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          x = startX;
          row.forEach((cell, j) => {
            doc.text(cell, x + 5, y + 5, { width: columnWidths[j] - 10, align: 'left' });
            x += columnWidths[j];
          });
          y += rowHeight;
        }

        doc.moveDown();
      };

      lines.forEach(line => {
        const trimmed = line.trim();

        // Detect headings (e.g., lines ending with ':', or starting with ### or ---)
        if (/^#{1,6}\s/.test(trimmed)) {
          // Markdown style heading
          const level = trimmed.match(/^#{1,6}/)[0].length;
          const text = trimmed.replace(/^#{1,6}\s/, '');
          doc.moveDown();
          doc.fontSize(18 - level * 2).font('Helvetica-Bold').text(text);
          doc.moveDown(0.5);
          return;
        } else if (/^[A-Z][A-Za-z\s]+:$/.test(trimmed)) {
          // Heading ending with colon
          doc.moveDown();
          doc.fontSize(14).font('Helvetica-Bold').text(trimmed.replace(/:$/, ''));
          doc.moveDown(0.3);
          return;
        } else if (/^[-*]\s/.test(trimmed)) {
          // Bullet point
          doc.list([trimmed.replace(/^[-*]\s/, '')], { bulletIndent: 20 });
          return;
        } else if (/^\|.*\|$/.test(trimmed)) {
          // Table row detected
          const cells = trimmed.split('|').slice(1, -1).map(cell => cell.trim());
          tableRows.push(cells);
          inTable = true;
          return;
        } else if (inTable && trimmed === '') {
          // End of table
          renderTable(tableRows);
          tableRows = [];
          inTable = false;
          return;
        } else if (inTable) {
          // Continue table rows
          const cells = trimmed.split('|').slice(1, -1).map(cell => cell.trim());
          tableRows.push(cells);
          return;
        }

        doc.text(trimmed);
      });

      // If table was open at end of document
      if (inTable && tableRows.length > 0) {
        renderTable(tableRows);
      }
    } else {
      // If result is JSON or object, stringify it
      doc.fontSize(12).text(JSON.stringify(result, null, 2));
    }

    doc.end();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detailed Crop Plan
app.post('/api/crop-plan', async (req, res) => {
  const { cropName, location, landSize, landType, season, language, apiKey } = req.body;
  if (!cropName) return res.status(400).json({ error: 'Crop name is required' });

  const prompt = `
You are an expert agricultural consultant. Create a detailed farming plan for ${cropName}:
- Include daily/weekly tasks
- Include fertilizers, pesticides, and their doses
- Include milestones
- Include general tips and warnings

Use JSON ONLY with this structure:
{
  "cropName": "${cropName}",
  "totalDuration": "string",
  "phases": [
    {
      "phaseName":"string",
      "weekRange":"string",
      "tasks":[
        { "task":"string", "description":"string", "importance":"High/Medium/Low" }
      ],
      "milestones":["string"]
    }
  ],
  "generalTips":["string"],
  "warnings":["string"]
}
`;

  try {
    const result = await callGeminiAPI(prompt);

    // Translate all string fields if language is not English
    if (language && language !== 'en') {
      if (result.phases) {
        for (const phase of result.phases) {
          if (phase.phaseName) {
            phase.phaseName = await translateText(phase.phaseName, language, 'en', apiKey);
          }
          if (phase.weekRange) {
            phase.weekRange = await translateText(phase.weekRange, language, 'en', apiKey);
          }
          if (phase.tasks) {
            for (const task of phase.tasks) {
              if (task.task) {
                task.task = await translateText(task.task, language, 'en', apiKey);
              }
              if (task.description) {
                task.description = await translateText(task.description, language, 'en', apiKey);
              }
              if (task.importance) {
                task.importance = await translateText(task.importance, language, 'en', apiKey);
              }
            }
          }
          if (phase.milestones) {
            for (let i = 0; i < phase.milestones.length; i++) {
              phase.milestones[i] = await translateText(phase.milestones[i], language, 'en', apiKey);
            }
          }
        }
      }
      if (result.generalTips) {
        for (let i = 0; i < result.generalTips.length; i++) {
          result.generalTips[i] = await translateText(result.generalTips[i], language, 'en', apiKey);
        }
      }
      if (result.warnings) {
        for (let i = 0; i < result.warnings.length; i++) {
          result.warnings[i] = await translateText(result.warnings[i], language, 'en', apiKey);
        }
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disease Detection
app.post('/api/disease-detection', async (req, res) => {
  const { imageBase64, cropType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Image is required' });

  const prompt = `
You are an expert plant pathologist. Analyze this crop image for diseases. Crop type: ${cropType || 'Unknown'}
Image data (truncated): ${imageBase64.substring(0, 1000)}...

Return ONLY JSON:
{
  "disease":"string",
  "confidence":"string",
  "severity":"string",
  "description":"string",
  "symptoms":["string"],
  "causes":["string"],
  "treatment":{
    "immediate":["string"],
    "chemical":["string"],
    "preventive":["string"]
  },
  "timeline":"string",
  "recommendations":["string"]
}
`;

  try {
    const result = await callGeminiAPI(prompt);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Local Market Info
app.post('/api/local-market', (req, res) => {
  const { location, crop } = req.body;
  if (!location || !crop) return res.status(400).json({ error: 'Missing location or crop' });

  const vendors = [
    { name: 'Mandi A', address: `${location} Market Area`, contact: '123-456-7890' },
    { name: 'Mandi B', address: `${location} Central Market`, contact: '987-654-3210' },
  ];
  res.json({ vendors });
});

// Government Organizations
app.post('/api/government-organizations', (req, res) => {
  const { location } = req.body;
  if (!location) return res.status(400).json({ error: 'Missing location' });

  const organizations = [
    { name: 'Rythu Bharosa', address: `${location} Office`, contact: '111-222-3333' },
    { name: 'Agriculture Dept', address: `${location} Agriculture Building`, contact: '444-555-6666' },
  ];
  res.json({ organizations });
});

// Bank Loans
app.post('/api/bank-loans', (req, res) => {
  const { location, crop } = req.body;
  if (!location || !crop) return res.status(400).json({ error: 'Missing location or crop' });

  const schemes = [
    { scheme: 'Crop Loan Scheme A', loanAmount: '₹1,00,000', interestRate: '7%', apply: 'Local Bank Branch' },
    { name: 'Agriculture Loan B', loanAmount: '₹2,00,000', interestRate: '6.5%', apply: 'Online Application' },
  ];
  res.json({ schemes });
});

// -------------------------
// Start Server
// -------------------------
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});

