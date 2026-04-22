const express = require('express');
const cookieParser = require("cookie-parser")
const cors = require("cors")
const app = express();

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))



// require all the routes here
const authRouter = require('./routes/auth')

const interviewRouter = require('./routes/interview.routes')

/**
 * @route GET /api/auth/get-me
 * @description get the current logged in user details
 * @access private
 */





//using all the routes here
app.use('/api/auth', authRouter)
app.use('/api/interview', interviewRouter)

module.exports = app