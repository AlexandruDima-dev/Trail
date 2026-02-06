const express = require("express")
const Database = require("better-sqlite3")
const bcrypt = require("bcrypt")
const erl = require("express-rate-limit")
const session = require("express-session")
const path = require("path")

const app = express();
const PORT = 8000

// DATA BASE
db = new Database("database.db")

db.prepare(`
    CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    email TEXT UNIQUE,
    password TEXT
    )`).run()


//ADVANCED MIDDLEWARE
const limiter = rateLimit({
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



//MIDDLEWARE
app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.use(express.static("public"))
app.use(limiter)
app.use(ses)
