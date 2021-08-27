const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Token = require('../models/token');
const {createAccessToken, createRefreshToken, verifyAuth} = require('../tokens');

router.use(express.json());

router.get('/', (req, res) => {   
    res.send("Auth route");
})

router.post('/register', async (req, res) => {
    const {email, password} = req.body;

    // hash password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);    

    try {
        const user = await User.create({
            email: email,
            password: hashedPassword
        });
        console.log("User created succesfully", user);

        //assign tokens to user
        const accessToken = createAccessToken(user);
        const refreshToken = createRefreshToken(user);

        res.status(200).json({
            user,
            accessToken: accessToken,
            refreshToken: refreshToken
        });
        const refToken = new Token({token: refreshToken});
        await refToken.save();
    } catch (error) {
        console.log(error);
        return res.status(400).json(error.message);        
    }
})

router.post('/login', async (req, res) => {
    const {email, password} = req.body;
    try {
        const user = await User.findOne({email: email});
        if (!user) {
            return res.status(400).json({message: "Email or password is incorrect."});
        }
        //if user enters valid password
        if (await bcrypt.compare(password, user.password)) {        
            //assign tokens
            const accessToken = createAccessToken(user);
            const refreshToken = createRefreshToken(user);

            res.status(200).json({
                user: user._id,                
                accessToken: accessToken,
                refreshToken: refreshToken
            });                             
            const refToken = new Token({token: refreshToken});
            await refToken.save();
            console.log("Login reftoken "+ refToken.token);
        } else { 
            return res.status(400).json({message: "Email or password is incorrect."});
        }    
    } catch (error) {
        console.log(error);
        res.status(401).json(error.message);
    }   
})

router.post('/refresh', async (req, res) => {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({message: "Token is required"});
    }

    const refToken = await Token.findOne({token: refreshToken});    
    if (!refToken) {
        return res.status(400).json({message: "Access denied. Valid token is required"});
    }

    jwt.verify(refToken.token, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
        if (err) {
            return res.status(401).json({message: "Invalid access token"});
        }
        //delete old refresh token
        await Token.findOneAndDelete({token: refToken.token })
        //assign new tokens
        const newAccessToken = createAccessToken(user);
        const newRefreshToken = createRefreshToken(user);
        //save new token to collection
        await new Token({token: newRefreshToken}).save();

        res.status(200).json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });    
    });    
})

router.post('/logout', async (req, res) => {
    const refreshToken = req.body.refreshToken;
    try {
        //Removing refresh token when user logs out
        console.log("token is +" + refreshToken);
        await Token.findOneAndDelete({ token: refreshToken });
        res.status(200).json("User logged out successfully");
    } catch (error) {
        res.status(500).json({error: error});
    }
})

//Protected route for testing verification
router.get('/protected', verifyAuth, (req, res) => {
   res.send("protected stuff");
})

module.exports = router;