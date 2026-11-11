# SmartAttend — Smart Attendance & Internal Marks

A role-based academic management project built with **HTML, CSS, JavaScript, Node.js, Express, and a JSON file datastore**. It is designed as a working student project starter, not a production-ready institutional system.

## Features included
- Separate sign-in experiences for **Student**, **Staff/Faculty**, and **Department Admin** roles.
- Session-based authentication; passwords are hashed with bcryptjs.
- Period-wise attendance by subject, date, and period; staff can mark Present/Absent and update an existing class record.
- Attendance history with month and status filters, plus CSV export.
- Internal assessment marks with student, subject, assessment type, semester, score, maximum marks, and percentage.
- Department account creation for students/staff/admins.
- Subject catalogue with faculty assignment.
- Department announcements/noticeboard.
- Responsive, modern dashboard with summary cards, attendance chart, attendance health ring, and toast feedback.

## Requirements
- Node.js 18 or newer
- npm

## Run locally
1. Extract this folder.
2. Open a terminal in the project folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open **http://localhost:3000** in your browser.

The server creates `data.json` with demo data on the first run. To reset the demo, stop the server and delete `data.json`; starting the server again recreates it.

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Department admin | `admin@campus.edu` | `Admin@123` |
| Staff / faculty | `staff@campus.edu` | `Staff@123` |
| Student | `student@campus.edu` | `Student@123` |
| Additional student | `meena@campus.edu` | `Student@123` |

Use the demo buttons on the login page to fill and submit credentials.

## Main workflows
### Department admin
- Create accounts from **People & subjects**.
- Add subjects and assign a faculty member.
- Publish campus notices.
- Review department attendance and marks.

### Staff / faculty
- Open **Attendance**, choose subject/date/period, mark each student Present or Absent, and save.
- Open **Internal marks** to add or update CIA/test/lab scores.
- Export attendance to CSV.

### Student
- Review personal attendance history and filter by month/status.
- Review internal marks and percentages.
- Read campus notices (notices are also previewed on the overview dashboard).

## Important implementation notes
- This starter stores data in `data.json`. This is suitable for a classroom demo, prototype, or single-server experiment only. It is not designed for concurrent multi-server deployment or high-volume use.
- Before real deployment: use a database such as PostgreSQL/MySQL, HTTPS, a strong `SESSION_SECRET` from environment variables, secure cookies, CSRF protection, login rate limiting, password reset, audit logs, backups, input validation, and institutional privacy/security review.
- The demo accounts and passwords are public examples. **Never deploy with these credentials or real student data.**
- Attendance is currently staff-recorded; student self check-in, QR attendance, push notifications, and automatic grade-policy calculation are not implemented in this starter.
- The CSV export is intended for authorized internal use. Add institution-specific export scopes and auditing before deployment.

## Suggested innovative extensions
1. **Rotating QR attendance:** short-lived QR code per period plus staff confirmation and a duplicate-scan check.
2. **Attendance risk alerts:** identify students trending toward the institution's minimum attendance threshold and show a supportive early-warning flag.
3. **Academic success radar:** combine attendance and internal marks to prompt timely academic support (not punitive automated decisions).
4. **Timetable-aware attendance:** pre-create periods from department timetables and block duplicate marking for the same subject/date/period.
5. **Student progress timeline:** month-by-month attendance and assessment charts with downloadable reports.
6. **Notice acknowledgements:** track whether students have read important announcements.
7. **Audit trail:** record who changed attendance or marks, old/new values, timestamp, and reason.
8. **Accessibility:** keyboard navigation, screen-reader labels, contrast checks, and language options.

## Project structure
```text
smart-attendance-system/
├── server.js
├── package.json
├── README.md
├── data.json              # created on first run
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```


## Innovation features added

### 1. Dynamic QR attendance
- Staff/department users open **QR check-in**, choose subject/date/period, and generate a QR token valid for 30–180 seconds.
- Students scan the displayed QR with their phone camera or a QR scanner app, enter the decoded token in their student login, and submit it.
- The backend checks token expiry, department, and duplicate attendance before recording Present. QR codes help reduce casual proxy attendance but do not prove physical presence by themselves.

### 2. What-If Attendance Simulator
- Students open **Attendance**, select a subject, and estimate how their attendance percentage changes if they attend or miss a chosen number of upcoming classes.
- This is an estimate based on the existing saved attendance records and the user's future-class inputs.

### 3. Internal Mark Analytics
- The **Internal marks** page displays per-subject average percentages, assessment counts, and an informational performance indicator.
- The indicators are guidance only; set official grade bands according to your institution's rules.

## Important setup note
The QR feature uses the `qrcode` npm package. Run `npm install` after extracting the project so all dependencies are installed. For a real campus deployment, migrate JSON storage to a database, configure a strong `SESSION_SECRET`, enable HTTPS and secure cookies, and review privacy/authorization rules.
