const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map(x => x.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) {
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
  return cb(new Error("Origin not allowed by CORS"));
}}));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")
    ? { rejectUnauthorized: false } : false
});
const seedJobs = [
 {title:"Electrician — Home Wiring",category:"Electrician",employer:"BrightBuild Contractors",location:"Mansarovar, Jaipur",distance:2.4,wage:800,payType:"Daily wage",type:"Daily wage",duration:"3 days",hours:"8 hours/day",workers:2,urgent:true,verified:true,food:"Not provided",stay:"Not provided",skills:["House wiring","Repairing"],description:"Need an experienced electrician for home wiring, switchboard fitting, and safety checks.",posted:"Recently"},
 {title:"Construction Helper",category:"Construction",employer:"Sharma Construction",location:"Vaishali Nagar, Jaipur",distance:5.1,wage:650,payType:"Daily wage",type:"Daily wage",duration:"15 days",hours:"8 hours/day",workers:8,urgent:true,verified:true,food:"Provided",stay:"Not provided",skills:["Material handling","Site support"],description:"Assist masons and keep the construction site organised.",posted:"Recently"},
 {title:"Painter — Interior Work",category:"Painter",employer:"HomeCraft Services",location:"Malviya Nagar, Jaipur",distance:7.2,wage:750,payType:"Daily wage",type:"Contract",duration:"7 days",hours:"8 hours/day",workers:3,urgent:false,verified:true,food:"Not provided",stay:"Not provided",skills:["Interior painting","Putty"],description:"Interior painting work for apartments. Previous painting experience preferred.",posted:"Recently"},
 {title:"Plumber for Apartment Repairs",category:"Plumber",employer:"CityFix Maintenance",location:"Jagatpura, Jaipur",distance:8.5,wage:900,payType:"Daily wage",type:"Temporary",duration:"5 days",hours:"Flexible, agreed in advance",workers:1,urgent:false,verified:false,food:"Not provided",stay:"Not provided",skills:["Pipe fitting","Leak repair"],description:"Repair taps, water lines, and bathroom fittings.",posted:"Recently"},
 {title:"Carpenter — Furniture Fitting",category:"Carpenter",employer:"Oak & Home Studio",location:"C-Scheme, Jaipur",distance:10.4,wage:1000,payType:"Daily wage",type:"Contract",duration:"10 days",hours:"9 hours/day",workers:2,urgent:false,verified:true,food:"Provided",stay:"Not provided",skills:["Furniture fitting","Wood work"],description:"Install cabinets and complete finishing work.",posted:"Recently"},
 {title:"Farm Harvest Workers",category:"Farming",employer:"GreenField Farms",location:"Sanganer, Jaipur",distance:18,wage:550,payType:"Daily wage",type:"Temporary",duration:"4 days",hours:"Morning shift",workers:12,urgent:true,verified:true,food:"Provided",stay:"Available on request",skills:["Harvesting","Sorting"],description:"Short-term seasonal harvesting work. Group applications welcome.",posted:"Recently"}
];
async function initDb() {
 await pool.query(`
 CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, mobile VARCHAR(10) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('worker','employer')),
  location TEXT DEFAULT '', skill TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, employer TEXT NOT NULL,
  location TEXT NOT NULL, distance NUMERIC DEFAULT 0, wage NUMERIC NOT NULL, pay_type TEXT DEFAULT 'Daily wage',
  type TEXT DEFAULT 'Daily wage', duration TEXT DEFAULT '', hours TEXT DEFAULT '', workers INTEGER DEFAULT 1,
  urgent BOOLEAN DEFAULT FALSE, verified BOOLEAN DEFAULT FALSE, food TEXT DEFAULT 'Not provided',
  stay TEXT DEFAULT 'Not provided', skills JSONB DEFAULT '[]', description TEXT NOT NULL,
  posted TEXT DEFAULT 'Recently', created_at TIMESTAMPTZ DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE, status TEXT DEFAULT 'Applied',
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id,job_id)
 );
 CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL, role TEXT NOT NULL, subject TEXT DEFAULT '', details TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS contact_requests (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  worker_name TEXT NOT NULL, worker_skill TEXT DEFAULT '', message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
 );`);
 const count = await pool.query("SELECT COUNT(*)::int AS n FROM jobs");
 if (count.rows[0].n === 0) {
  for (const j of seedJobs) await pool.query(
   `INSERT INTO jobs(title,category,employer,location,distance,wage,pay_type,type,duration,hours,workers,urgent,verified,food,stay,skills,description,posted)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
   [j.title,j.category,j.employer,j.location,j.distance,j.wage,j.payType,j.type,j.duration,j.hours,j.workers,j.urgent,j.verified,j.food,j.stay,JSON.stringify(j.skills),j.description,j.posted]);
 }
}
function authRequired(req,res,next) {
 const raw=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 if(!raw) return res.status(401).json({message:"Please log in to continue."});
 try { req.user=jwt.verify(raw,process.env.JWT_SECRET); next(); }
 catch { return res.status(401).json({message:"Session expired. Please log in again."}); }
}
function publicJob(r) {
 return {id:Number(r.id),title:r.title,category:r.category,employer:r.employer,location:r.location,distance:Number(r.distance||0),wage:Number(r.wage),payType:r.pay_type,type:r.type,duration:r.duration,hours:r.hours,workers:r.workers,urgent:r.urgent,verified:r.verified,food:r.food,stay:r.stay,skills:r.skills||[],description:r.description,posted:r.posted};
}
app.get("/api/health",(req,res)=>res.json({ok:true,service:"Labour Bridge API"}));
app.get("/api/jobs",async(req,res,next)=>{try{
 const {rows}=await pool.query("SELECT * FROM jobs ORDER BY created_at DESC");
 res.json({jobs:rows.map(publicJob)});
}catch(e){next(e)}});
app.post("/api/jobs",authRequired,async(req,res,next)=>{try{
 if(req.user.role!=="employer") return res.status(403).json({message:"Only employer accounts can post jobs."});
 const b=req.body;
 if(!b.title||!b.category||!b.employer||!b.location||!b.description||!Number(b.wage)||Number(b.wage)<1) return res.status(400).json({message:"Please fill all required job details."});
 const values=[b.title,b.category,b.employer,b.location,Number(b.wage),b.payType||"Daily wage",b.type||"Daily wage",b.duration||"To be agreed",b.hours||"To be agreed",Math.max(1,Number(b.workers)||1),!!b.urgent,b.food||"Not provided",b.stay||"Not provided",JSON.stringify(Array.isArray(b.skills)?b.skills:[]) ,b.description];
 const {rows}=await pool.query(`INSERT INTO jobs(title,category,employer,location,wage,pay_type,type,duration,hours,workers,urgent,food,stay,skills,description,verified,posted)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,FALSE,'Just now') RETURNING *`,values);
 res.status(201).json({message:"Job published successfully.",job:publicJob(rows[0])});
}catch(e){next(e)}});
app.post("/api/auth/register",async(req,res,next)=>{try{
 const {name,mobile,password,role,location="",skill=""}=req.body;
 if(!name||!/^\d{10}$/.test(String(mobile||""))||!password||String(password).length<8||!["worker","employer"].includes(role)) return res.status(400).json({message:"Enter your name, valid 10-digit mobile, role, and password (at least 8 characters)."});
 const hash=await bcrypt.hash(password,12);
 const {rows}=await pool.query("INSERT INTO users(name,mobile,password_hash,role,location,skill) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,mobile,role,location,skill",[name,mobile,hash,role,location,skill]);
 const user=rows[0], token=jwt.sign({id:Number(user.id),role:user.role,name:user.name},process.env.JWT_SECRET,{expiresIn:"7d"});
 res.status(201).json({message:"Account created successfully.",user,token});
}catch(e){if(e.code==="23505")return res.status(409).json({message:"This mobile number is already registered. Please log in."});next(e)}});
app.post("/api/auth/login",async(req,res,next)=>{try{
 const {mobile,password}=req.body;
 const {rows}=await pool.query("SELECT * FROM users WHERE mobile=$1",[mobile]);
 if(!rows.length||!(await bcrypt.compare(password||"",rows[0].password_hash))) return res.status(401).json({message:"Invalid mobile number or password."});
 const r=rows[0],user={id:Number(r.id),name:r.name,mobile:r.mobile,role:r.role,location:r.location,skill:r.skill};
 const token=jwt.sign({id:user.id,role:user.role,name:user.name},process.env.JWT_SECRET,{expiresIn:"7d"});
 res.json({message:"Logged in successfully.",user,token});
}catch(e){next(e)}});
app.post("/api/applications",authRequired,async(req,res,next)=>{try{
 const jobId=Number(req.body.jobId);
 const job=await pool.query("SELECT id FROM jobs WHERE id=$1",[jobId]);
 if(!job.rowCount)return res.status(404).json({message:"Job not found."});
 if(req.user.role!=="worker")return res.status(403).json({message:"Worker accounts can apply to jobs."});
 await pool.query("INSERT INTO applications(user_id,job_id) VALUES($1,$2) ON CONFLICT(user_id,job_id) DO NOTHING",[req.user.id,jobId]);
 const {rows}=await pool.query("SELECT a.job_id AS \"jobId\",j.title,j.employer,a.status,to_char(a.created_at,'DD/MM/YYYY') AS date FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.user_id=$1 ORDER BY a.created_at DESC",[req.user.id]);
 res.status(201).json({message:"Application submitted successfully.",applications:rows});
}catch(e){next(e)}});
app.get("/api/applications",authRequired,async(req,res,next)=>{try{
 const {rows}=await pool.query("SELECT a.job_id AS \"jobId\",j.title,j.employer,a.status,to_char(a.created_at,'DD/MM/YYYY') AS date FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.user_id=$1 ORDER BY a.created_at DESC",[req.user.id]);
 res.json({applications:rows});
}catch(e){next(e)}});
app.post("/api/reports",async(req,res,next)=>{try{
 const {type,role,subject="",details}=req.body;
 if(!type||!role||!details)return res.status(400).json({message:"Please provide issue type, role, and details."});
 let userId=null;const raw=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 if(raw){try{userId=jwt.verify(raw,process.env.JWT_SECRET).id}catch{}}
 await pool.query("INSERT INTO reports(user_id,type,role,subject,details) VALUES($1,$2,$3,$4,$5)",[userId,type,role,subject,details]);
 res.status(201).json({message:"Report submitted successfully."});
}catch(e){next(e)}});
app.post("/api/contact",authRequired,async(req,res,next)=>{try{
 const {workerName,workerSkill="",message}=req.body;
 if(!workerName||!message)return res.status(400).json({message:"Worker and message are required."});
 await pool.query("INSERT INTO contact_requests(user_id,worker_name,worker_skill,message) VALUES($1,$2,$3,$4)",[req.user.id,workerName,workerSkill,message]);
 res.status(201).json({message:"Contact request sent successfully."});
}catch(e){next(e)}});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:"Server error. Please try again later."})});
const port=process.env.PORT||5000;
initDb().then(()=>app.listen(port,"0.0.0.0",()=>console.log(`Labour Bridge API listening on ${port}`))).catch(err=>{console.error("Database initialization failed:",err);process.exit(1)});
