import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { getWeather } from "./controllers/apis.js";
import touristsRouter from "./routes/tourists.js";
import reportsRouter from "./routes/reports.js";
// import reportsRouter from "./routes/reports.js";

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());
// Auth middleware disabled until SUPABASE_URL and SUPABASE_ANON_KEY are provided in env
// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// async function requireAuth(req, res, next) { /* ... */ }




// Route to get weather + Gemini explanation
app.get("/weather/coords", getWeather);
app.use("/api/tourists", touristsRouter);
app.use("/api/reports", reportsRouter);
// app.use("/api/reports", reportsRouter);

app.listen(5000, () => console.log("Server running on port 5000"));
