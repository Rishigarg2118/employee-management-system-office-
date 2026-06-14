/**
 * bulk_seed_employees.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bulk-insert employees from the provided contact sheet.
 * • Deduplicates by email before sending to DB (case-insensitive)
 * • Skips malformed email addresses
 * • Uses INSERT ... ON CONFLICT (email) DO NOTHING  →  safe to re-run
 *
 * Run from project root:
 *   node backend/scripts/bulk_seed_employees.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ─── DB Connection ────────────────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'premium_hrms',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ─── Raw Data ─────────────────────────────────────────────────────────────────
// Format: [ full_name, phone, email ]
const RAW = [
  ['Idita Sinha', '8445607056', 'iditasinha07@gmail.com'],
  ['Ali Sahal Khan', '9522333533', 'alisahalkhan4@gmail.com'],
  ['Tanisha Patidar', '8815277747', 'tanishapatidar2111@gmail.com'],
  ['Sainandan Gupta', '8815277747', 'sainandangupta@gmail.com'],
  ['Rishi Dhakad', '8815277747', 'rishixh0520@gmail.com'],
  ['Pavitra Chouhan', '8815277747', 'pavitrachouhan0612gmail.com'],   // malformed – skipped
  ['Tamanna Taretiya', '8815277747', 'tamannataretiya@gmail.com'],
  ['Priyal Agrawal', '8815277747', 'priyagrawal023@gmail.com'],
  ['Anjali Malviya', '8815277747', '0372anjali@gmail.com'],
  ['Akriti Jain', '8815277747', 'akritijain713@gmail.com'],
  ['Nancy Soni', '7879263110', 'soninancy080@gmail.com'],
  ['Mahi Patel', '9340988129', 'mahipatel123000@gmail.com'],
  ['Mohit Sapkal', '9662162621', 'mohit.sapkal2007@gmail.com'],
  ['Pranav Sethia', '9826142417', 'pranavsethia882@gmail.com'],
  ['Radhika', '9111942445', 'ch3ugy@gmail.com'],
  ['Rudraksh Bende', '9179113111', 'rudrakshbende803@gmail.com'],
  ['Samrat Singh Thakur', '9755209209', 'samratthakur2005@gmail.com'],
  ['Shivam Mathur', '9009232427', 'mathurshivv@gmail.com'],
  ['Shubh Shrivastava', '9179412471', 'shuhb2308@gmail.com'],
  ['Srashti Arya', '9109860951', 'srashtiarya40@gmail.com'],
  ['Taksha Patidar', '7415348948', 'patidartaksh77@gmail.com'],
  ['Tanishka Sablok', '8982904417', 'tanishkasablok.121782@gmail.com'],
  ['Tanishka Thorat', '7024983023', 'thorattanishka950@gmail.com'],
  ['Vinay Pratap Singh', '9926206994', 'vps2004zee@gmail.com'],
  ['Yatharth Pareta', '9770270005', 'yatharthpareta18@gmail.com'],
  ['Chaitanya Pawar', '9753279007', 'chaitanyapawar077@gmail.com'],
  ['Dimple Vaishnav', '9399985534', 'dimplevaishnav1105@gmail.com'],
  ['Rishi Garg', '8109607518', 'rishigarg1290@gmail.com'],
  ['Sandarbh Bhasin', '8128929323', 'sandarbhbhasin@gmail.com'],
  ['Aaradhya Singh Sisodiya', '7869932188', 'aaradhyasisodiya9@gmail.com'],
  ['Navni Tiwari', '9826404047', 'tiwarinavni07@gmail.com'],
  ['Bhavishya Sahu', '9826711946', 'bhavishyasahu12345@gmail.com'],
  ['Lokpriya Jain', '8982381109', 'jainlokpriya22@gmail.com'],
  ['Krishna Kant Tiwari', '9905970105', 'kishankantt2007@gmail.com'],
  ['Anay Tare', '9713038440', 'tareanay183@gmail.com'],
  ['Atiksh Mishra', '8878239518', 'atikshmmishra@gmail.com'],
  ['Sahil Shillare', '9755894188', 'sahilshillare42@gmail.com'],
  ['Kritika Bairagi', '9203292029', 'kritikab2412@gmail.com'],
  ['Sonali Shekhawat', '9179911344', 'sonalii.shekhawat@gmail.com'],
  ['Garima Tilwankar', '9589603705', 'garimatilwankarr@gmail.com'],
  ['Ashwin Singh', '9479386498', 'asbaghel0303@gmail.com'],
  ['Unnati Singh Parihar', '7987104036', 'unnatisingh220711@gmail.com'],
  ['Trisha Kaushal', '8602061342', 'trishakaushal9@gmail.com'],
  ['Kashish Malik', '9634578297', 'kashishmalik123456789@gmail.com'],
  ['Ramesh Kumar Mali', '9925734158', 'rameshmali33333@gmail.com'],
  ['Ishika Parmar', '9201542197', 'parmarishika577@gmail.com'],
  ['Aarna Vyas', '9669456048', 'aarnavyas495@gmail.com'],
  ['Atharva Vyas', '9691534513', 'atharvavyas47@gmail.com'],
  ['Nishika Jain', '6268889338', 'nishikajain526@gmail.com'],
  ['Komal Kanwar', '8827831317', 'komalkanwar0407@gmail.com'],
  ['Ayush Mishra', '7052196635', 'mishraayushghaghupur@gmail.com'],
  ['Kartik Arya', '8959550668', 'mailkartikarya@gmail.com'],
  ['Aadish Badjatiya', '9343672371', 'aadishbadjatiya@gmail.com'],
  ['Adarsh Hazari', '9644656597', 'adarssshhh0@gmail.com'],
  ['Adeesh Jain', '9302776837', 'adeesh25706@gmail.com'],
  ['Akshat Pandey', '9009442323', 'pu02325eugbtcs058@student.suas.ac.in'],
  ['Anany Pandit', '7697657424', 'anany06pandit@gmail.com'],
  ['Anusha Dubey', '6268954395', 'dubeyanusha504@gmail.com'],
  ['Anushka Sawner', '7222934864', 'anushka.121745@gmail.com'],
  ['Aryan Rai', '7976728487', 'roy30aryan@gmail.com'],
  ['Chayan Jain', '9301079930', 'chayanjain0043@gmail.com'],
  ['Divyansh Gupta', '9529018439', 'divyanshgupta241@gmail.com'],
  ['Divyansh Singh Gahlot', '9340879976', 'divyanshsinghgahlot95@gmail.com'],
  ['Harshvardhan Rajput', '7400543795', 'harshvardhanrajputindore20@gmail.com'],
  ['Himanshi Likhar', '9039764267', 'himanshi.likhar.8@gmail.com'],
  ['Jagmeet Singh Bhinder', '9039577737', 'jagmeetsingh3909@gmail.com'],
  ['Jamila Ali', '7722833548', 'jamilaali964@gmail.com'],
  ['Kushal Palya', '8889800083', 'kushalpalya7@gmail.com'],
  ['Maitri Patangiya', '9202493408', 'maitripatangiya@gmail.com'],
  ['Mohammad Faizan', '8435876741', 'fsyed1475@gmail.com'],
  ['Pari Khandelwal', '8602245446', 'parikhandelwal5788@gmail.com'],
  ['Raunak Jangid', '8770235375', 'raunakshr22@gmail.com'],
  ['Ridhima Bajaj', '6268279898', 'ridhimabajaj852@gmail.com'],
  ['Roshni Yadav', '8871430210', 'roshniyadav89614@gmail.com'],
  ['Safal Jain', '9243241016', 'jainsafal58@gmail.com'],
  ['Safal Sen', '8516053349', 'safalsen6@gmail.com'],
  ['Sanidhya Vijayvargiya', '6267180188', 'sanidhyavijayvargiya4@gmail.com'],
  ['Sanjeevni Mahajan', '9343027565', 'sanjeevnimahajan126@gmail.com'],
  ['Shouryaveer Singh Chouhan', '8839120732', 'aarushveersinghchouhan@gmail.com'],
  ['Suyash Sharma', '7725819016', 'suyash4316@gmail.com'],
  ['Vanshul Verma', '7828278747', 'vanshulverma6@gmail.com'],
  ['Vijay Chouhan', '8818806160', 'vijaychouhan16599@gmail.com'],
  ['Yashika Patel', '7974106218', 'yashikapatel7974@gmail.com'],
  ['Aashish Kumar', '6264898584', 'ashishkk00011@gmail.com'],
  ['Risha Yadav', '7993178984', 'rishaa.who@gmail.com'],
  ['Mahi Mandora', '8817474568', 'mahi5mandora@gmail.com'],
  ['Sanant Sharma', '7734913714', 'sanantsharma093@gmail.com'],
  ['Akshita Mahajan', '9329588100', 'mahajanakshita03@gmail.com'],
  ['Yashshavi Bansal', '7049822222', 'yashshavib@gmail.com'],
  ['Pari Tolani', '8298297500', 'paritolani.edu@gmail.com'],
  ['Shriya Jar', '9301910961', 'shriyajar8@gmail.com'],
  ['Abhay Dwivedi', '7898749044', 'dubeyabhay910@gmail.com'],
  ['Yatharth Chauhan', '9389641169', 'yatharthchauhan51@gmail.com'],
  ['Samiya Siddiqui', '9927201593', 'samiyasiddiqui862@gmail.com'],
  ['Shreya Patidar', '9993288679', 'shreyapatidar46@gmail.com'],
  ['Pavani Mishra', '8839163424', 'pavanimishra18@gmail.com'],
  ['Nidhi Ahuja', '8269474757', 'nidhiahuja59@gmail.com'],
  ['Ved Paliwal', '7489578226', 'paliwalved76@gmail.com'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ''];
  const last = parts.pop();
  return [parts.join(' '), last];
}

function generateEmployeeId(index) {
  return `EMP-B${String(index).padStart(4, '0')}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀  Starting Bulk Employee Seed');
  console.log('─'.repeat(55));

  // 1. Deduplicate by lowercase email
  const seen = new Set();
  const skippedInvalid = [];
  const skippedDupes = [];
  const unique = [];

  for (const [name, phone, email] of RAW) {
    const key = email.toLowerCase().trim();
    if (!isValidEmail(key)) {
      skippedInvalid.push({ name, email });
      continue;
    }
    if (seen.has(key)) {
      skippedDupes.push({ name, email });
      continue;
    }
    seen.add(key);
    unique.push({ name, phone, email: key });
  }

  console.log(`📋  Total rows     : ${RAW.length}`);
  console.log(`✅  Unique valid   : ${unique.length}`);
  console.log(`⚠️   Duplicates     : ${skippedDupes.length}`);
  console.log(`❌  Invalid emails : ${skippedInvalid.length}`);
  if (skippedInvalid.length) {
    skippedInvalid.forEach(e => console.log(`    ↳ ${e.name} <${e.email}>`));
  }
  console.log('─'.repeat(55));

  // 2. Fetch next available sequence number for employee IDs
  const client = await pool.connect();
  try {
    // Get max existing EMP-B* id to continue sequence
    const { rows: maxRows } = await client.query(
      `SELECT employee_id FROM employees WHERE employee_id LIKE 'EMP-B%' ORDER BY employee_id DESC LIMIT 1`
    );
    let startIndex = 1;
    if (maxRows.length) {
      const num = parseInt(maxRows[0].employee_id.replace('EMP-B', ''), 10);
      if (!isNaN(num)) startIndex = num + 1;
    }

    // 3. Generate a shared default password hash (employees can reset via Google)
    const defaultPassword = await bcrypt.hash('Welcome@123', 10);
    const joiningDate = new Date().toISOString().split('T')[0]; // today

    // 4. Fetch first available department id for default assignment
    const { rows: deptRows } = await client.query(
      `SELECT id FROM departments ORDER BY id ASC LIMIT 1`
    );
    const defaultDeptId = deptRows.length ? deptRows[0].id : null;

    // 5. Insert with ON CONFLICT DO NOTHING
    let inserted = 0;
    let alreadyExisted = 0;

    for (let i = 0; i < unique.length; i++) {
      const { name, phone, email } = unique[i];
      const [firstName, lastName] = splitName(name);
      const empId = generateEmployeeId(startIndex + i);

      const result = await client.query(
        `INSERT INTO employees
           (employee_id, first_name, last_name, email, password,
            phone, designation, status, role, joining_date, department_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (email) DO NOTHING`,
        [
          empId,
          firstName,
          lastName,
          email,
          defaultPassword,
          phone,
          'Intern',       // default designation
          'Active',       // default status
          'Intern',       // default role
          joiningDate,
          defaultDeptId,
        ]
      );

      if (result.rowCount > 0) {
        inserted++;
        console.log(`  ✅  [${empId}] ${name} <${email}>`);
      } else {
        alreadyExisted++;
        console.log(`  ⏭️   SKIPPED (email exists): ${name} <${email}>`);
      }
    }

    // 6. Summary
    console.log('\n' + '─'.repeat(55));
    console.log(`🎉  Done!`);
    console.log(`    Inserted         : ${inserted}`);
    console.log(`    Already in DB    : ${alreadyExisted}`);
    console.log(`    Duplicate rows   : ${skippedDupes.length}`);
    console.log(`    Invalid emails   : ${skippedInvalid.length}`);
    console.log('─'.repeat(55));
    console.log(`ℹ️   Default password : Welcome@123`);
    console.log(`    Employees can log in with Google or reset their password.\n`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n💥 Seed failed:', err.message);
  process.exit(1);
});
