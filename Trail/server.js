const express = require("express")
const Database = require("better-sqlite3")
const bcrypt = require("bcrypt")
const erl = require("express-rate-limit")
const session = require("express-session")
const nodemailer = require("nodemailer")
const path = require("path")
const { writeHeapSnapshot } = require("v8")



const app = express();
const PORT = 8000

// DATA BASE
db = new Database("database.db")

db.prepare(`
    CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified INTEGER DEFAULT 0,
    verfication_code TEXT
    )`).run()


db.prepare(
    `CREATE TABLE IF NOT EXISTS trails(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL,
    length_km REAL,
    elevation_gain_m REAL,
    geom TEXT NOT NULL,
    country TEXT,
    region TEXT,
    environmental_info TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
`
).run()


db.prepare(
    `
    CREATE TABLE IF NOT EXISTS contact_data(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT NOT NULL,
    email TEXT NOT NULL,
    reasons TEXT NOT NULL,
    message TEXT NOT NULL

    )
    `
).run()






//ADVANCED MIDDLEWARE
const limiter = erl.rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100, 
	standardHeaders: 'draft-8', 
	legacyHeaders: false, 
	ipv6Subnet: 56, 

})

const ses = session({
    secret:"jf07bfVLPgKqdYcTI8gJZ8G3",
    resave:false,
    saveUninitialized:false,
})

const  transporter = nodemailer.createTransport({
    service:"gmail",
    auth:{
        user:"alexandrucoding08@gmail.com",
        pass:"cxvl yncw iftn lxzc"
    }
})



//MIDDLEWARE
app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.use(express.static("public"))
app.use(limiter)

app.use(session({
    secret:"jf07bfVLPgKqdYcTI8gJZ8G3",
    resave:false,
    saveUninitialized:false,

}))


// Sign Up



// GET Sign Up page
app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "signin.html"));
});

// POST Sign Up
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    // Validation
    const specialChar = /[!@#$%^&*(),.?":{}|<>]/;
    const letter = /[A-Za-z]/;
    const number = /[0-9]/;

    if (!username || !email || !password) {
        return res.status(400).json({ message: "Please fill in all fields" });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (!specialChar.test(password)) {
        return res.status(400).json({ message: "Password must include a special character" });
    }
    if (!letter.test(password)) {
        return res.status(400).json({ message: "Password must include letters" });
    }
    if (!number.test(password)) {
        return res.status(400).json({ message: "Password must include a number" });
    }

    try {
        // Check if user already exists
        const existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Insert user into DB
        db.prepare(`
            INSERT INTO users (username, email, password, verfication_code)
            VALUES (?, ?, ?, ?)
        `).run(username, email, hashedPassword, code);

        // Store email in session for verification
        req.session.verifyEmail = email;

        // Send verification email
        await transporter.sendMail({
            from: "Trail App",
            to: email,
            subject: "Verify Your TRAIL Account",
            html: `
            <div style="background-color:#556b2f; padding:30px; border-radius:14px; text-align:center; color:#f4f6f8; font-family:Verdana, Geneva, Tahoma, sans-serif;">
                <h2>Trail</h2>
                <p>Your Verification Code Is <strong>${code}</strong></p>
            </div>
            `
        });

        res.redirect("/verify");

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred, please try again" });
    }
});


// Verify Email

app.post("/verify", (req, res) => {
    const enteredCode = req.body.code;
    const email = req.session.verifyEmail;

    if (!email) {
        return res.status(400).json({ message: "No email in session. Please sign up first." });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (user.verfication_code !== enteredCode) {
        return res.status(401).json({ message: "Wrong verification code" });
    }


    db.prepare(`
        UPDATE users
        SET verified = 1, verfication_code = NULL
        WHERE email = ?
    `).run(email);


    req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role
    };

    if (user.email === "alexandrucoding08@gmail.com") {
        db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(user.email);
        req.session.user.role = "admin"; // update session role
        return res.redirect("/admin/dashboard");
    }


    res.redirect("/dashboard");
});

app.get("/login", async (req, res)=>{
    res.sendFile(path.join(__dirname, "public", "login.html"))
})

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(404).json({ message: "We couldn't find your data, please try again" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (!user.verified) {
        return res.status(401).json({ message: "Verify your account first" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return res.status(401).json({ message: "Wrong password" });
    }


    req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role
    };

    if (user.email === "alexandrucoding08@gmail.com" && user.role !== "admin") {
        db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(user.email);
        req.session.user.role = "admin"; 
    }


    if (req.session.user.role === "admin") {
        return res.redirect("/admin/dashboard");
    } else {
        return res.redirect("/dashboard");
    }
});


// CONTACT

app.get("/contact", (req,res)=>{
    res.sendFile(path.join(__dirname, "public", "contact.html"))
})

app.post("/contact", async (req,res)=>{
    const {fullname, email, reasons, message } = req.body
    if(!fullname || !email || !reasons || !message){
        return res.status(404).json({message:"Your Data Has Not Been Found, Please Try Agian"})
    }

    try{
        db.prepare("INSERT INTO contact_data(fullname, email, reasons, message) VALUES (?,?,?,?)").run(fullname, email, reasons, message)
        console.log("Contact Data has been enetred into the data base")
    }catch(e){
        return res.status(500).json({message:"Data Hasnt Been Inputed Into The Data Base Please Try Again"})
    }


     await transporter.sendMail({
        from:email,
        to:"alexandrucoding08@gmail.com",
        subject:"Contact From",
        text:`

        From:${fullname}
        Email:${email}

        Reason${reasons}
        Message:${message}
        
        `
    })

    res.status(200).json({message:"Conatct Form Has Been Sent Sucsesfully!"})
})

// API endpoint to get all trails

app.get("/api/trails", (req, res) => {
    try {
        const trails = db.prepare(`
            SELECT id, name, description, difficulty, length_km, elevation_gain_m, country, region, geom 
            FROM trails
        `).all();
        res.json(trails);
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch trails" });
    }
});



//ADMIN DASHBOARD

//================================
//================================

app.get("/admin/dashboard", (req,res)=>{
    app.sendFile(path.join(__dirname,"public", "admin-dashboard.html"))
})

app.post("/admin/dashboard", (req,res)=>{
    const wassap = "hey"
    res.json(wassap)
})







app.listen(PORT, ()=>{
    console.log("Server Is Running On http://localhost:8000")
})