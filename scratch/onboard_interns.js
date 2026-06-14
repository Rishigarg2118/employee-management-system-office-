const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'workforce@123',
  database: 'premium_hrms'
});

const names = [
  "Idita Sinha", "Ali Sahal Khan", "Tanisha Patidar", "Sainandan Gupta", "Rishi Dhakad",
  "Pavitra Chouhan", "Tamanna taretiya", "Priyal Agrawal", "Anjali Malviya", "Akriti Jain",
  "Nancy Soni", "Mahi Patel", "Mohit Sapkal", "Pranav Sethia", "Radhika", "Rudraksh bende",
  "Samrat Singh Thakur", "SHIVAM MATHUR", "Shubh Shrivastava", "Srashti Arya", "Taksha Patidar",
  "Tanishka Sablok", "Tanishka Thorat", "Vinay pratap singh", "Yatharth Pareta", "Chaitanya Pawar",
  "DIMPLE VAISHNAV", "Rishi Garg", "Sandarbh Bhasin", "Aaradhya singh sisodiya", "Navni Tiwari",
  "Bhavishya Sahu", "Lokpriya Jain", "Krishna Kant Tiwari", "Anay tare", "Atiksh Mishra",
  "Sahil Shillare", "Kritika Bairagi", "Sonali Shekhawat", "Garima Tilwankar", "Ashwin Singh",
  "Unnati Singh Parihar", "Trisha kaushal", "Kashish malik", "Ramesh Kumar Mali", "Ishika Parmar",
  "Aarna vyas", "Atharva Vyas", "Nishika Jain", "Komal Kanwar", "Ayush mishra", "Kartik Arya",
  "Aadish badjatiya",
  "Adarsh Hazari", "Adeesh Jain", "Akshat pandey", "Anany Pandit", "Anusha Dubey",
  "Anushka Sawner", "Aryan Rai", "Chayan Jain", "Dimple vaishnav", "Divyansh Gupta",
  "Divyansh Singh Gahlot", "Harshvardhan Rajput", "Himanshi Likhar", "Jagmeet Singh Bhinder",
  "Jamila Ali", "Kushal Palya", "Maitri Patangiya", "Mohammad faizan", "Pari Khandelwal",
  "Raunak Jangid", "Ridhima Bajaj", "Roshni Yadav", "Safal Jain", "Safal Sen",
  "sanidhya vijayvargiya", "Sanjeevni mahajan", "Shouryaveer Singh chouhan", "Suyash sharma",
  "vanshul verma", "Vijay Chouhan", "Yashika patel", "yashika patel", "Aashish kumar",
  "Risha Yadav", "Mahi Mandora", "Sanant Sharma",
  "Yashshavi bansal", "Pari Tolani", "Shriya jar", "Abhay Dwivedi", "Yatharth Chauhan",
  "Samiya Siddiqui", "Shreya Patidar", "Pavani Mishra", "Nidhi Ahuja", "Ved Paliwal",
  "Risha Yadav", "Yatharth Chauhan", "Aashish kumar"
];

const emails = [
  "iditasinha07@gmail.com", "alisahalkhan4@gmail.com", "tanishapatidar2111@gmail.com",
  "sainandangupta@gmail.com", "rishixh0520@gmail.com", "pavitrachouhan0612gmail.com",
  "tamannataretiya@gmail.com", "priyagrawal023@gmail.com", "0372anjali@gmail.com",
  "akritijain713@gmail.com", "soninancy080@gmail.com", "mahipatel123000@gmail.com",
  "mohit.sapkal2007@gmail.com", "pranavsethia882@gmail.com", "ch3ugy@gmail.com",
  "rudrakshbende803@gmail.com", "samratthakur2005@gmail.com", "mathurshivv@gmail.com",
  "shuhb2308@gmail.com", "srashtiarya40@gmail.com", "patidartaksh77@gmail.com",
  "Tanishkasablok.121782@gmail.com", "thorattanishka950@gmail.com", "vps2004zee@gmail.com",
  "yatharthpareta18@gmail.com", "chaitanyapawar077@gmail.com", "dimplevaishnav1105@gmail.com",
  "rishigarg1290@gmail.com", "sandarbhbhasin@gmail.com", "Aaradhyasisodiya9@gmail.com",
  "tiwarinavni07@gmail.com", "bhavishyasahu12345@gmail.com", "jainlokpriya22@gmail.com",
  "kishankantt2007@gmail.com", "tareanay183@gmail.com", "atikshmmishra@gmail.com",
  "sahilshillare42@gmail.com", "kritikab2412@gmail.com", "Sonalii.shekhawat@gmail.com",
  "garimatilwankarr@gmail.com", "asbaghel0303@gmail.com", "unnatisingh220711@gmail.com",
  "trishakaushal9@gmail.com", "kashishmalik123456789@gmail.com", "rameshmali33333@gmail.com",
  "parmarishika577@gmail.com", "aarnavyas495@gmail.com", "atharvavyas47@gmail.com",
  "nishikajain526@gmail.com", "komalkanwar0407@gmail.com", "mishraayushghaghupur@gmail.com",
  "mailkartikarya@gmail.com", "aadishbadjatiya@gmail.com",
  "adarssshhh0@gmail.com", "adeesh25706@gmail.com", "PU02325EUGBTCS058@student.suas.ac.in",
  "anany06pandit@gmail.com", "dubeyanusha504@gmail.com", "anushka.121745@gmail.com",
  "roy30aryan@gmail.com", "chayanjain0043@gmail.com", "dimplevaishnav1105@gmail.com",
  "divyanshgupta241@gmail.com", "divyanshsinghgahlot95@gmail.com",
  "harshvardhanrajputindore20@gmail.com", "himanshi.likhar.8@gmail.com", "jagmeetsingh3909@gmail.com",
  "jamilaali964@gmail.com", "kushalpalya7@gmail.com", "maitripatangiya@gmail.com",
  "fsyed1475@gmail.com", "Parikhandelwal5788@gmail.com", "raunakshr22@gmail.com",
  "ridhimabajaj852@gmail.com", "Roshniyadav89614@gmail.com", "jainsafal58@gmail.com",
  "safalsen6@gmail.com", "sanidhyavijayvargiya4@gmail.com", "Sanjeevnimahajan126@gmail.com",
  "aarushveersinghchouhan@gmail.com", "Suyash4316@gmail.com", "vanshulverma6@gmail.com",
  "vijaychouhan16599@gmail.com", "yashikapatel7974@gmail.com", "yashikapatel7974@gmail.com",
  "ashishkk00011@gmail.com", "rishaa.who@gmail.com", "mahi5mandora@gmail.com",
  "sanantsharma093@gmail.com",
  "yashshavib@gmail.com", "paritolani.edu@gmail.com", "shriyajar8@gmail.com",
  "dubeyabhay910@gmail.com", "yatharthchauhan51@gmail.com", "samiyasiddiqui862@gmail.com",
  "shreyapatidar46@gmail.com", "Pavanimishra18@gmail.com", "nidhiahuja59@gmail.com",
  "paliwalved76@gmail.com", "rishaa.who@gmail.com", "yatharthchauhan51@gmail.com",
  "ashishkk00011@gmail.com"
];

async function main() {
  try {
    const defaultPassHash = await bcrypt.hash("InternWelcome2026!", 10);
    
    // Clean and deduplicate data
    const parsedInterns = [];
    const seenEmails = new Set();
    
    for (let i = 0; i < names.length; i++) {
      let email = emails[i].trim().toLowerCase();
      // Handle the missing '@' in pavitrachouhan0612gmail.com
      if (email === "pavitrachouhan0612gmail.com") {
        email = "pavitrachouhan0612@gmail.com";
      }
      
      if (seenEmails.has(email)) {
        continue; // Skip duplicate records
      }
      seenEmails.add(email);
      
      const nameParts = names[i].trim().split(" ");
      const firstName = nameParts[0] || "Intern";
      const lastName = nameParts.slice(1).join(" ") || "Employee";
      
      parsedInterns.push({
        first_name: firstName,
        last_name: lastName,
        email: email
      });
    }
    
    console.log(`Onboarding ${parsedInterns.length} unique interns...`);
    
    // 1. Ingest into PostgreSQL database
    let dbCount = 0;
    for (let idx = 0; idx < parsedInterns.length; idx++) {
      const intern = parsedInterns[idx];
      const employeeId = `EMP-${String(100 + idx).padStart(3, '0')}`;
      
      // Check if email already exists in DB
      const existCheck = await pool.query("SELECT id FROM employees WHERE email = $1", [intern.email]);
      if (existCheck.rows.length > 0) {
        console.log(`Skipping duplicate DB email: ${intern.email}`);
        continue;
      }
      
      await pool.query(
        `INSERT INTO employees 
         (employee_id, first_name, last_name, email, password, designation, status, joining_date, role, department_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          employeeId,
          intern.first_name,
          intern.last_name,
          intern.email,
          defaultPassHash,
          "Operations Intern",
          "Active",
          new Date().toISOString().split('T')[0],
          "Employee",
          1 // Default Engineering department
        ]
      );
      dbCount++;
    }
    console.log(`Successfully inserted ${dbCount} new interns into PostgreSQL.`);
    
    // 2. Ingest into backend/database.json for compatibility
    const dbPath = path.resolve(__dirname, '../backend/database.json');
    if (fs.existsSync(dbPath)) {
      console.log('Syncing database.json...');
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      data.employees = data.employees || [];
      
      let jsonCount = 0;
      parsedInterns.forEach((intern, idx) => {
        const employeeId = `EMP-${String(100 + idx).padStart(3, '0')}`;
        
        if (!data.employees.some(e => e.email === intern.email)) {
          data.employees.push({
            id: data.employees.length > 0 ? Math.max(...data.employees.map(e => e.id)) + 1 : 1,
            employee_id: employeeId,
            first_name: intern.first_name,
            last_name: intern.last_name,
            email: intern.email,
            password: defaultPassHash,
            designation: "Operations Intern",
            status: "Active",
            joining_date: new Date().toISOString().split('T')[0],
            role: "Employee",
            department_id: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          jsonCount++;
        }
      });
      
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Successfully synced ${jsonCount} new interns into backend/database.json.`);
    }
    
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

main();
