const express = require("express")
const Database = require("better-sqlite3")
const bcrypt = require("bcrypt")
const erl = require("express-rate-limit")
const session = require("express-session")
const nodemailer = require("nodemailer")
const path = require("path")



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


//AUTHENTICATION
// ==========================================================
//===========================================================


// Sign Up

app.get("/SignUp" ,async (req,res)=>{
    res.sendFile(path.join(__dirname , "public" , "signin.html"))
})

app.post("/SignUp" , async (req,res) =>{
    const specialChar = /[!@#$%^&*(),.?":{}|<>]/
    const letter = /[A-Za-z]/
    const number = /[0-9]/
    const {username , email, password} = req.body

    if(!username || !email || !password){
         return res.status(404).json("We Cannot Find Your Data Please Try Agian!")
    }

    if(username === ""|| username == null){
        res.json({message:"Please Enter your Username"})
    }else if(email === "" || email == null){
        res.json({message:"Please Enter your Email"})
    }else if(password === "" || password == null){
        res.json({message:"Please Enter Your Password"})
    }else if(password.length < 6){
        res.json({message:"Your Password Must Be At Least 6 Characters"})
    }else if(!specialChar.test(password)){
        res.json({message:"Your Password Must Include A Special Character"})
    }else if(!letter.test(password)){
        res.json({message:"Your Password Must Include Letters"})
    }else if(!number.test(password)){
        res.json({message:"Your Password Must have a number"})
    }


    try{
    const hashedPassword = await bcrypt.hash(password, 10); //<-- Hashes Password
    const code = Math.floor(100000 + Math.random()* 900000).toString();

    db.prepare(`
        INSERT INTO users (username, email, password, verfication_code) VALUES (?,?,?,?)
        `).run(username, email, hashedPassword, code);

        req.session.verifyEmail = email;

    await transporter.sendMail({
        from:"Trail App",
        to:email,
        subject: "Verify Your TRAIL Account",
        html: `
        <style>
            .email{
            background-color: #556b2f;
            font-family: Verdana, Geneva, Tahoma, sans-serif;
            color: #f4f6f8;
            border-radius: 14px;
            text-align: center;
            }

        </style>

        <div class="email">
            <h2>Trail</h2><br><br>
            <p>Your Verifaction Code Is ${code}</p>
        
        </div>
        `
    })

    res.redirect("/verify")
    
    
    

}catch(err){
    res.status(501).json({message:"Email Already Is Used"})

}
})


// Verify Email

app.get("/verify", (req,res)=>{
    res.sendFile(path.join(__dirname, "public" , "verify.html"))
})

app.post("/verify", (req,res)=>{
    const enteredCode = req.body.code;
    const email = req.session.verifyEmail;

    const user = db.prepare(`
        SELECT * FROM users WHERE email =?
        `).get(email);
    
    if (!user){
        return res.status(401).json({message:"We Couldnt Find Your Email, Please try agian"})
    }

    if(user.verfication_code !== enteredCode){
        return res.status(401).json({message:"Wrong Code"})
    }

    db.prepare(`
        UPDATE users
        SET verified = 1, verfication_code = NULL
        WHERE email = ?
        `).run(email)

    res.redirect("/dashboard")

});

app.get("/login", async (req, res)=>{
    res.sendFile(path.join(__dirname, "public", "login.html"))
})

app.post("/login", async (req,res) =>{
    const{email, password} = req.body
    if(!email || !password){
        return res.status(404).json({message: "We Couldnt Find Your Data Please Try again"})
    }

    if(email == "alexandruadmin05@gmail.com"){
        
    }
    
    const users = db.prepare(`
        SELECT * FROM users WHERE email = ?
        
        `).get(email);

    if(!users){
        return res.status(404).json({message:"User Not Found"})
    }

    if(!users.verified){
        res.status(401).json({message:"Verify Your Account First"})
    }

    const match = await bcrypt.compare(password, users.password);
    if (!match){
        return res.status(401).json({message:"Wrong Password"})
    }

    res.redirect("/dashboard")

})





// CONTACT
//============================================================================================

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
//======================================================================================================

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


// Dashboard 
//========================================================================================================
app.get("/dashboard", (req,res)=>{
    res.sendFile(path.join(__dirname, "public", "dashboard.html"))
})









app.listen(PORT, ()=>{
    console.log("Server Is Running On http://localhost:8000")
})