import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import * as pdfParseModule from "pdf-parse";
const PDFParse = (pdfParseModule as any).PDFParse || pdfParseModule;
import mammoth from "mammoth";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies
app.use(express.json());

// Setup Multer with memory storage (safe for containerized read-only filesystems)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Setup JSON File Database (100% portable, zero binary dependency risks)
const dbJsonPath = path.join(process.cwd(), "resume_analyzer_db.json");

interface DBUser {
  id: number;
  username: string;
  email: string;
}

interface DBResumeAnalysis {
  id: number;
  filename: string;
  candidate_name: string;
  job_title: string;
  ats_score: number;
  matched_skills: string; // JSON string
  missing_skills: string; // JSON string
  suggestions: string;    // JSON string
  extracted_text: string;
  job_description: string;
  created_at: string;
}

interface DBStore {
  users: DBUser[];
  resume_analyses: DBResumeAnalysis[];
  nextUserId: number;
  nextAnalysisId: number;
}

function readDb(): DBStore {
  try {
    if (fs.existsSync(dbJsonPath)) {
      const content = fs.readFileSync(dbJsonPath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading JSON database:", err);
  }
  return {
    users: [],
    resume_analyses: [],
    nextUserId: 1,
    nextAnalysisId: 1
  };
}

function writeDb(data: DBStore) {
  try {
    fs.writeFileSync(dbJsonPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to JSON database:", err);
  }
}

// Emulate SQLite helper functions with perfect compatibility
async function dbRun(query: string, params: any[] = []): Promise<any> {
  const q = query.trim().toLowerCase();
  const store = readDb();

  if (q.startsWith("create table")) {
    return { id: 0, changes: 0 };
  }

  if (q.startsWith("insert into users")) {
    const newUser: DBUser = {
      id: store.nextUserId++,
      username: params[0],
      email: params[1]
    };
    store.users.push(newUser);
    writeDb(store);
    return { id: newUser.id, changes: 1 };
  }

  if (q.startsWith("insert into resume_analyses")) {
    const newAnalysis: DBResumeAnalysis = {
      id: store.nextAnalysisId++,
      filename: params[0],
      candidate_name: params[1],
      job_title: params[2],
      ats_score: params[3],
      matched_skills: params[4],
      missing_skills: params[5],
      suggestions: params[6],
      extracted_text: params[7],
      job_description: params[8],
      created_at: params[9]
    };
    store.resume_analyses.push(newAnalysis);
    writeDb(store);
    return { id: newAnalysis.id, changes: 1 };
  }

  if (q.startsWith("delete from resume_analyses")) {
    const targetId = params[0];
    const initialLen = store.resume_analyses.length;
    store.resume_analyses = store.resume_analyses.filter(item => Number(item.id) !== Number(targetId));
    writeDb(store);
    const changes = initialLen - store.resume_analyses.length;
    return { id: null, changes };
  }

  return { id: 0, changes: 0 };
}

async function dbAll(query: string, params: any[] = []): Promise<any[]> {
  const q = query.trim().toLowerCase();
  const store = readDb();

  if (q.includes("from users")) {
    return store.users;
  }

  if (q.includes("from resume_analyses")) {
    return store.resume_analyses
      .map(item => ({
        id: item.id,
        filename: item.filename,
        candidateName: item.candidate_name,
        jobTitle: item.job_title,
        atsScore: item.ats_score,
        createdAt: item.created_at
      }))
      .sort((a, b) => b.id - a.id);
  }

  return [];
}

async function dbGet(query: string, params: any[] = []): Promise<any> {
  const q = query.trim().toLowerCase();
  const store = readDb();

  if (q.includes("from resume_analyses") && q.includes("where id = ?")) {
    const targetId = params[0];
    const found = store.resume_analyses.find(item => Number(item.id) === Number(targetId));
    return found || null;
  }

  return null;
}

async function initializeDatabase() {
  const store = readDb();
  if (store.users.length === 0) {
    store.users.push({
      id: store.nextUserId++,
      username: "Default Candidate",
      email: "candidate@example.com"
    });
    writeDb(store);
    console.log("Initialized default candidate in JSON Database.");
  }
}

// Run database init
initializeDatabase();

// Lazy-initialization of Gemini AI client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured in the secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API endpoint to retrieve past analysis history (high-level metadata for dashboard)
app.get("/api/history", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT id, filename, candidate_name as candidateName, job_title as jobTitle, ats_score as atsScore, created_at as createdAt 
      FROM resume_analyses 
      ORDER BY id DESC
    `);
    res.json(rows);
  } catch (error: any) {
    console.error("Error retrieving history:", error);
    res.status(500).json({ error: "Failed to load history list: " + error.message });
  }
});

// API endpoint to retrieve details of a specific analysis
app.get("/api/history/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const row = await dbGet("SELECT * FROM resume_analyses WHERE id = ?", [id]);
    if (!row) {
      return res.status(404).json({ error: "Analysis not found." });
    }

    // Parse JSON fields
    res.json({
      id: row.id,
      filename: row.filename,
      candidateName: row.candidate_name,
      jobTitle: row.job_title,
      atsScore: row.ats_score,
      matchedSkills: JSON.parse(row.matched_skills || "[]"),
      missingSkills: JSON.parse(row.missing_skills || "[]"),
      suggestions: JSON.parse(row.suggestions || "[]"),
      extractedText: row.extracted_text,
      jobDescription: row.job_description,
      createdAt: row.created_at,
    });
  } catch (error: any) {
    console.error("Error retrieving single analysis details:", error);
    res.status(500).json({ error: "Failed to load analysis detail: " + error.message });
  }
});

// API endpoint to delete an analysis from history
app.delete("/api/history/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await dbRun("DELETE FROM resume_analyses WHERE id = ?", [id]);
    res.json({ success: true, message: "Analysis removed successfully." });
  } catch (error: any) {
    console.error("Error deleting history item:", error);
    res.status(500).json({ error: "Failed to delete history record: " + error.message });
  }
});

// API endpoint to analyze a resume (PDF/DOCX upload OR pasted text)
app.post("/api/analyze", upload.single("resumeFile"), async (req, res) => {
  try {
    const { jobDescription, resumeText } = req.body;
    let extractedText = "";
    let filename = "Pasted Text";

    // 1. Text extraction based on file or pasted input
    if (req.file) {
      filename = req.file.originalname;
      const fileExt = path.extname(filename).toLowerCase();

      if (fileExt === ".pdf") {
        try {
          const parser = new PDFParse({ data: req.file.buffer });
          const parsed = await parser.getText();
          extractedText = parsed.text;
          await parser.destroy();
        } catch (pdfErr: any) {
          return res.status(400).json({ error: "Failed to parse PDF resume: " + pdfErr.message });
        }
      } else if (fileExt === ".docx" || fileExt === ".doc") {
        try {
          const result = await mammoth.extractRawText({ buffer: req.file.buffer });
          extractedText = result.value;
        } catch (docxErr: any) {
          return res.status(400).json({ error: "Failed to parse DOCX resume: " + docxErr.message });
        }
      } else if (fileExt === ".txt") {
        extractedText = req.file.buffer.toString("utf-8");
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload .pdf, .docx, or .txt" });
      }
    } else if (resumeText) {
      extractedText = resumeText;
    } else {
      return res.status(400).json({ error: "Please provide either a resume file or paste the resume text." });
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: "The resume contains no extractable text." });
    }

    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ error: "Please provide a job description to compare against." });
    }

    // 2. Query Gemini with structured output schemas for robust parsing
    const ai = getGeminiClient();

    const prompt = `
      You are an expert ATS (Applicant Tracking System) recruiter and resume analyst.
      Analyze the provided resume against the job description to calculate an ATS compatibility score (0-100),
      identify matching and missing skills, extract the candidate's name and target job title, and suggest improvements.

      Job Description:
      """
      ${jobDescription}
      """

      Resume Content:
      """
      ${extractedText}
      """
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Ensure all output values strictly match the required JSON schema fields. Be objective and professional. For skills, match both technical expertise, methodologies, and core soft skills requested.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            candidateName: { type: Type.STRING, description: "Candidate's full name extracted from the resume. If not found, use 'Unknown Candidate'." },
            jobTitle: { type: Type.STRING, description: "The candidate's target job title or primary career title based on the resume." },
            atsScore: { type: Type.INTEGER, description: "A realistic and rigorous compatibility score between 0 and 100 based on keyword match, experience relevance, and skills." },
            matchedSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Skills requested by the job description that are present or clearly implied in the resume."
            },
            missingSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Skills or requirements specified in the job description that are NOT found in the resume."
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, description: "Category of improvement, e.g. 'Keywords', 'Experience formatting', 'Missing certifications'." },
                  detail: { type: Type.STRING, description: "Specific, actionable feedback on how to add this missing element or rewrite existing sections." }
                },
                required: ["category", "detail"]
              },
              description: "Detailed, objective and highly actionable recommendations to improve the ATS score."
            }
          },
          required: ["candidateName", "jobTitle", "atsScore", "matchedSkills", "missingSkills", "suggestions"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response received from the AI model.");
    }

    const aiResult = JSON.parse(textOutput.trim());

    // 3. Save the result in SQLite database
    const createdAt = new Date().toISOString();
    const insertResult = await dbRun(`
      INSERT INTO resume_analyses 
      (filename, candidate_name, job_title, ats_score, matched_skills, missing_skills, suggestions, extracted_text, job_description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      filename,
      aiResult.candidateName,
      aiResult.jobTitle,
      aiResult.atsScore,
      JSON.stringify(aiResult.matchedSkills),
      JSON.stringify(aiResult.missingSkills),
      JSON.stringify(aiResult.suggestions),
      extractedText,
      jobDescription,
      createdAt
    ]);

    // Send complete response back to client
    res.json({
      id: insertResult.id,
      filename,
      candidateName: aiResult.candidateName,
      jobTitle: aiResult.jobTitle,
      atsScore: aiResult.atsScore,
      matchedSkills: aiResult.matchedSkills,
      missingSkills: aiResult.missingSkills,
      suggestions: aiResult.suggestions,
      extractedText,
      jobDescription,
      createdAt
    });

  } catch (error: any) {
    console.error("Analysis failed:", error);
    res.status(500).json({ error: "Resume analysis failed: " + error.message });
  }
});

// API endpoint for Google Search Grounded industry trends and target role requirements
app.post("/api/industry-trends", async (req, res) => {
  try {
    const { jobTitle } = req.body;
    if (!jobTitle || !jobTitle.trim()) {
      return res.status(400).json({ error: "Job title is required." });
    }
    
    console.log(`Starting Google Search Grounding for role: ${jobTitle}`);
    const ai = getGeminiClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `What are the key required skills, popular tech stacks, emerging tools, and valued certifications for a "${jobTitle}" role today? Research current 2026 hiring standards.`,
      config: {
        systemInstruction: "Format the output beautifully with markdown headings, bullet points, and numbered lists. Focus on giving recruiters or candidates immediate practical hiring requirements.",
        tools: [{ googleSearch: {} }]
      }
    });

    const textOutput = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Process sources to make them extremely clean for the UI
    const sources = groundingChunks.map((chunk: any) => ({
      title: chunk.web?.title || "Search Reference",
      uri: chunk.web?.uri || ""
    })).filter((s: any) => s.uri);

    res.json({
      text: textOutput || "No analysis could be compiled.",
      sources
    });
  } catch (error: any) {
    console.error("Industry Trends (Search Grounding) failed:", error);
    res.status(500).json({ error: "Failed to fetch industry trends: " + error.message });
  }
});


// Vite / Static Files handler
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static build assets...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files
    app.use(express.static(distPath));
    
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Resume Analyzer is running at http://localhost:${PORT}`);
  });
}

startServer();
