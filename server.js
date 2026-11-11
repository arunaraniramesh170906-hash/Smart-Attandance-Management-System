const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-before-deployment',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function readDb() {
  if (!fs.existsSync(DATA_FILE)) return null;
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeDb(db) { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }

async function seed() {
  let db = readDb();
  if (db) {
    if (!Array.isArray(db.qrSessions)) db.qrSessions = [];
    writeDb(db);
    return;
  }
  const users = [
    { id:'u_admin', name:'Department Admin', email:'admin@campus.edu', role:'department', department:'Computer Science', studentId:null, staffId:'CS-HOD-01', password:await bcrypt.hash('Admin@123', 10) },
    { id:'u_staff', name:'Priya Staff', email:'staff@campus.edu', role:'staff', department:'Computer Science', studentId:null, staffId:'CS-FAC-12', password:await bcrypt.hash('Staff@123', 10) },
    { id:'u_student', name:'Arun Student', email:'student@campus.edu', role:'student', department:'Computer Science', studentId:'CSE2024001', staffId:null, password:await bcrypt.hash('Student@123', 10) },
    { id:'u_student2', name:'Meena Student', email:'meena@campus.edu', role:'student', department:'Computer Science', studentId:'CSE2024002', staffId:null, password:await bcrypt.hash('Student@123', 10) }
  ];
  db = {
    users,
    subjects: [
      { id:'sub_1', name:'Data Structures', code:'CS301', department:'Computer Science', semester:5, staffId:'u_staff' },
      { id:'sub_2', name:'Computer Networks', code:'CS302', department:'Computer Science', semester:5, staffId:'u_staff' },
      { id:'sub_3', name:'Database Systems', code:'CS303', department:'Computer Science', semester:5, staffId:'u_staff' }
    ],
    attendance: [],
    marks: [],
    qrSessions: [],
    notices: [{ id:'n1', title:'Welcome to SmartAttend', body:'Use the demo accounts in the README to explore the system.', createdAt:new Date().toISOString(), author:'System' }]
  };
  writeDb(db);
}
function currentUser(req) {
  if (!req.session.userId) return null;
  const db = readDb();
  const u = db?.users.find(x => x.id === req.session.userId);
  if (!u) return null;
  const { password, ...safe } = u;
  return safe;
}
function auth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error:'Please sign in to continue.' });
  req.user = user;
  next();
}
function roles(...allowed) {
  return (req,res,next) => allowed.includes(req.user.role) ? next() : res.status(403).json({error:'You do not have permission to perform this action.'});
}
function safeUser(u) { const { password, ...safe } = u; return safe; }

app.post('/api/login', async (req,res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({error:'Email and password are required.'});
  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({error:'Invalid email or password.'});
  req.session.userId = user.id;
  res.json({ user:safeUser(user) });
});
app.post('/api/logout', (req,res) => req.session.destroy(() => res.json({ok:true})));
app.get('/api/me', auth, (req,res) => res.json({user:req.user}));

app.get('/api/bootstrap', auth, (req,res) => {
  const db = readDb();
  const users = db.users.map(safeUser);
  res.json({
    user:req.user,
    students:users.filter(u => u.role === 'student' && (req.user.role === 'department' || u.department === req.user.department)),
    staff:users.filter(u => u.role === 'staff' && (req.user.role === 'department' || u.department === req.user.department)),
    subjects:db.subjects.filter(s => req.user.role !== 'staff' || s.staffId === req.user.id),
    attendance:db.attendance.filter(a => req.user.role === 'student' ? a.studentId === req.user.id : true),
    marks:db.marks.filter(m => req.user.role === 'student' ? m.studentId === req.user.id : true),
    notices:db.notices,
    activeQrSessions:db.qrSessions.filter(q=>q.expiresAt>Date.now() && (req.user.role==='student' ? q.department===req.user.department : q.createdBy===req.user.id || req.user.role==='department'))
  });
});

app.post('/api/users', auth, roles('department'), async (req,res) => {
  const { name,email,password,role,department,studentId,staffId } = req.body || {};
  if (!name || !email || !password || !department || !['student','staff','department'].includes(role))
    return res.status(400).json({error:'Name, email, password, role and department are required.'});
  const db = readDb();
  if (db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(409).json({error:'That email is already registered.'});
  const user = { id:uid('u'), name, email, role, department, studentId:role==='student'?(studentId||uid('STU').toUpperCase()):null, staffId:role!=='student'?(staffId||uid('FAC').toUpperCase()):null, password:await bcrypt.hash(password,10) };
  db.users.push(user); writeDb(db);
  res.status(201).json({user:safeUser(user)});
});

app.post('/api/subjects', auth, roles('department'), (req,res) => {
  const {name,code,semester,staffId} = req.body || {};
  if (!name || !code) return res.status(400).json({error:'Subject name and code are required.'});
  const db = readDb();
  const subject = {id:uid('sub'),name,code,semester:Number(semester)||1,department:req.user.department,staffId:staffId||null};
  db.subjects.push(subject); writeDb(db); res.status(201).json({subject});
});

app.post('/api/attendance', auth, roles('staff','department'), (req,res) => {
  const {subjectId,date,period,records} = req.body || {};
  if (!subjectId || !date || !period || !Array.isArray(records)) return res.status(400).json({error:'Subject, date, period and attendance records are required.'});
  const db = readDb();
  const subject = db.subjects.find(s=>s.id===subjectId);
  if (!subject) return res.status(404).json({error:'Subject not found.'});
  if (req.user.role==='staff' && subject.staffId && subject.staffId!==req.user.id) return res.status(403).json({error:'This subject is not assigned to you.'});
  for (const record of records) {
    if (!db.users.some(u=>u.id===record.studentId && u.role==='student')) continue;
    const existing = db.attendance.find(a=>a.subjectId===subjectId && a.date===date && Number(a.period)===Number(period) && a.studentId===record.studentId);
    const item = { id:existing?.id||uid('att'), studentId:record.studentId, subjectId, date, period:Number(period), status:record.status==='Present'?'Present':'Absent', markedBy:req.user.id, updatedAt:new Date().toISOString() };
    if (existing) Object.assign(existing,item); else db.attendance.push(item);
  }
  writeDb(db); res.json({ok:true,message:'Attendance saved.'});
});

// Dynamic QR attendance: each token is random, short-lived and can be used once per student.
app.post('/api/qr-sessions', auth, roles('staff','department'), async (req,res) => {
  const {subjectId, date, period, durationSeconds=90} = req.body || {};
  const db=readDb();
  const subject=db.subjects.find(s=>s.id===subjectId);
  if(!subject || !date || !period) return res.status(400).json({error:'Choose a subject, date and period.'});
  if(req.user.role==='staff' && subject.staffId && subject.staffId!==req.user.id) return res.status(403).json({error:'This subject is not assigned to you.'});
  const duration=Math.min(180,Math.max(30,Number(durationSeconds)||90));
  const token=crypto.randomBytes(18).toString('hex');
  const session={id:uid('qr'),token,subjectId,date,period:Number(period),department:subject.department,createdBy:req.user.id,createdAt:Date.now(),expiresAt:Date.now()+duration*1000};
  db.qrSessions=db.qrSessions.filter(q=>q.expiresAt>Date.now());
  db.qrSessions.push(session); writeDb(db);
  const qrDataUrl=await QRCode.toDataURL(token,{width:280,margin:2,errorCorrectionLevel:'M'});
  res.status(201).json({session:{...session,qrDataUrl,seconds:duration}});
});

app.post('/api/qr-attendance', auth, roles('student'), (req,res) => {
  const token=String(req.body?.token||'').trim();
  if(!token) return res.status(400).json({error:'Scan the QR code or enter its token.'});
  const db=readDb();
  const session=db.qrSessions.find(q=>q.token===token);
  if(!session) return res.status(404).json({error:'QR code not found. Ask your faculty to generate a new one.'});
  if(session.expiresAt<=Date.now()) return res.status(410).json({error:'This QR code has expired. Ask your faculty for a fresh code.'});
  if(session.department!==req.user.department) return res.status(403).json({error:'This QR session is not for your department.'});
  const existing=db.attendance.find(a=>a.studentId===req.user.id&&a.subjectId===session.subjectId&&a.date===session.date&&Number(a.period)===Number(session.period));
  if(existing) return res.status(409).json({error:'Your attendance is already recorded for this class period.'});
  db.attendance.push({id:uid('att'),studentId:req.user.id,subjectId:session.subjectId,date:session.date,period:Number(session.period),status:'Present',markedBy:session.createdBy,source:'dynamic-qr',updatedAt:new Date().toISOString()});
  writeDb(db);
  res.json({ok:true,message:`Attendance recorded for ${db.subjects.find(s=>s.id===session.subjectId)?.name||'the class'}.`});
});

app.post('/api/marks', auth, roles('staff','department'), (req,res) => {
  const {studentId,subjectId,assessment,score,maxScore,semester} = req.body || {};
  const nScore=Number(score), nMax=Number(maxScore);
  if (!studentId || !subjectId || !assessment || !Number.isFinite(nScore) || !Number.isFinite(nMax) || nMax<=0 || nScore<0 || nScore>nMax)
    return res.status(400).json({error:'Enter a student, subject, assessment and a valid score within the maximum marks.'});
  const db=readDb();
  if (!db.users.some(u=>u.id===studentId && u.role==='student') || !db.subjects.some(s=>s.id===subjectId)) return res.status(404).json({error:'Student or subject not found.'});
  const existing=db.marks.find(m=>m.studentId===studentId && m.subjectId===subjectId && m.assessment.toLowerCase()===assessment.toLowerCase() && Number(m.semester)===Number(semester||1));
  const item={id:existing?.id||uid('mark'),studentId,subjectId,assessment,score:nScore,maxScore:nMax,semester:Number(semester)||1,updatedAt:new Date().toISOString(),updatedBy:req.user.id};
  if(existing) Object.assign(existing,item); else db.marks.push(item);
  writeDb(db); res.json({ok:true,message:'Internal mark saved.'});
});

app.post('/api/notices', auth, roles('department'), (req,res) => {
  const {title,body}=req.body||{};
  if(!title||!body) return res.status(400).json({error:'Notice title and message are required.'});
  const db=readDb(); const notice={id:uid('notice'),title,body,createdAt:new Date().toISOString(),author:req.user.name};
  db.notices.unshift(notice); writeDb(db); res.status(201).json({notice});
});

app.get('/api/export/attendance.csv', auth, (req,res) => {
  const db=readDb();
  const rows=[['Student','Register No','Department','Subject','Date','Period','Status']];
  const students=db.users.filter(u=>u.role==='student');
  for(const a of db.attendance) {
    const s=students.find(x=>x.id===a.studentId), sub=db.subjects.find(x=>x.id===a.subjectId);
    if(!s||!sub) continue;
    if(req.user.role==='student' && s.id!==req.user.id) continue;
    if(req.user.role==='staff' && sub.staffId && sub.staffId!==req.user.id) continue;
    rows.push([s.name,s.studentId,s.department,sub.name,a.date,String(a.period),a.status]);
  }
  const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="attendance-report.csv"');
  res.send(csv);
});

app.get('/api/health', (req,res)=>res.json({ok:true,service:'SmartAttend'}));
seed().then(()=>app.listen(PORT,()=>console.log(`SmartAttend running at http://localhost:${PORT}`)));
