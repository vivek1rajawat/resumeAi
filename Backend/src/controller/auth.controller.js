const userModel = require('../models/user')
const authRouter = require('../routes/auth')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const tokenBlacklistModel = require("../models/blacklist.model")

/**
 * @name registerUserController
 * @description register a new user, expects username, email and password in the request
 * @access public
 */
async function registerUserController(req,res){
    const {username, email, password} = req.body;

    if(!username || !email || !password){
        res.status(400).json({
            message: "Please provide username, email and password"
        })

    }
    const isUserAlreadyExist = await userModel.findOne({
        $or: [{username}, {email}]
    })
    if(isUserAlreadyExist){
        res.status(400).json({
            message: "Account already exists with this email address"
        })
    }
    const hash = await bcrypt.hash(password,10);
    const user = await userModel.create({
        username,
        email,
        password: hash
    })
    const token = jwt.sign(
        {id: user._id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn: "1d"}
    )
    res.cookie("token", token)
    res.status(201).json({
        message: "User regisetered successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}

/**
 * @name loginUserController
 * @description login a user, expects email and password in the request body
 * @access public
 */

async function loginUserController(req,res){
    const {email, password} = req.body;
    const user = await userModel.findOne({email})
    if(!user){
        return res.status(400).json({
            message: "Invalid email and password"
        })
    }
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if(!isPasswordValid){
        return res.status(400).json({
            message: "Invalid email or passwod"
        })
    }
    const token = jwt.sign(
        {id: user._id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn: "1d"}
    )
    res.cookie("token", token)
    res.status(200).json({
        message: "User loggedIn successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}

async function logoutUserController(req,res){
    const token = req.cookies.token
    if(token){
        await tokenBlacklistModel.create({token})
    }
    res.clearCookie("token")
    res.status(200).json({
        message: "logged out successfully"
    })

}

/**
 * @name getMeController
 * @description get the current logged in user details
 * @access private
 */
async function getMeController(req,res){
    const user = await userModel.findById(req.user.id)
    res.status(200).json({
        message: "user detail fetch successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        } 
    })
}

module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController
}