const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const emails = [
  "iditasinha07@gmail.com", "alisahalkhan4@gmail.com", "tanishapatidar2111@gmail.com",
  "sainandangupta@gmail.com", "rishixh0520@gmail.com", "pavitrachouhan0612@gmail.com",
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

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'workforce@123',
  database: 'premium_hrms'
});

async function main() {
  const hash = await bcrypt.hash('InternWelcome2026!', 10);
  console.log('Hashed default password.');

  // Clean emails
  const cleanEmails = Array.from(new Set(emails.map(e => e.trim().toLowerCase())));
  console.log(`Processing ${cleanEmails.length} unique emails...`);

  let updatedCount = 0;
  for (const email of cleanEmails) {
    const res = await pool.query("UPDATE employees SET password = $1 WHERE email = $2 RETURNING id", [hash, email]);
    if (res.rows.length > 0) {
      updatedCount += res.rows.length;
    }
  }

  console.log(`Successfully updated password for ${updatedCount} matching employee records to 'InternWelcome2026!'`);
  await pool.end();
}

main().catch(console.error);
