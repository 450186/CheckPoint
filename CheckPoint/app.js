const express = require('express');
const app = express();
const port = process.env.PORT || 4000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})

const userModel = require('./Models/users.js');

const session = require('express-session');
const bcrypt = require('bcrypt');

const dotenv = require('dotenv').config();

const fiveMins =  5 * 60 * 1000;
const tenMins =  10 * 60 * 1000;
const oneHour =  1 * 60 * 60 * 1000;

const sessionSecret = process.env.sessionSecret
const mongoUsername = process.env.MongoUsername
const mongoPassword = process.env.MongoPassword
const mongoAppName = process.env.MongoAppName

app.use(session({
    secret: sessionSecret,
    saveUninitialized: false,
    cookie: {
        maxAge: fiveMins,
        secure: false, // Set to true if using HTTPS
    },
    resave: false,
}))

const connectionString = `mongodb+srv://${mongoUsername}:${mongoPassword}@checkpoint.iztnugv.mongodb.net/${mongoAppName}?retryWrites=true&w=majority`;
const mongoose = require('mongoose');
mongoose.connect(connectionString)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

const path = require('path');
const { log } = require('console');
app.use(express.static(path.join(__dirname, 'Public')));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function checkLogin(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/home');
    }
}
function isLoggedIn(request) {
    return request.session && request.session.user;
}

app.get('/', (req, res) => {
    res.render('pages/home', {
        title: 'Home',
    })
})
app.get("/home", (req, res) => {
    res.render('pages/home', {
        title: 'Home',
    })
})
app.get("/login", async (req, res) => {

    res.render('pages/login', {
        title: 'Login',
        user: req.session.user,
        loggedIn: isLoggedIn(req),
    })
})

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await userModel.userData.findOne({ username });
    if (!user) {
        return res.status(401).send('Invalid username or password');
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return res.status(401).send('Invalid username or password');
    }
    req.session.user = {
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
    };
    res.redirect('/dashboard');
}) 

app.get("/register", (req, res) => {
    res.render('pages/register', {
        title: 'Register',
        errorMessage: req.session.errorMessage || null,
    })
})
app.post("/register", async (req, res) => {
    const { username, password, email, firstName, lastName } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/

    if (!passwordRegex.test(password)) {
        req.session.errorMessage = 'Password must match the rules, press the information icon to check the rules.';
        return res.redirect('/register');
    }
    if(await userModel.createUser(username, hashed, email, firstName, lastName)) {
        req.session.errorMessage = null;
        req.session.user = { username, email, firstName, lastName, profilePicture };
        res.redirect('/dashboard');
    } else {
        req.session.errorMessage = 'Username or email already exists.';
        res.render('pages/Login', {
            title: 'Login',
            errorMessage: req.session.errorMessage,
        });
    }
})
app.get("/dashboard", checkLogin, (req, res) => {
    res.render('pages/dashboard', {
        title: 'Dashboard',
        user: req.session.user,
    })
})
app.get("/discover", checkLogin, (req, res) => {
    res.render('pages/discover', {
        title: 'Discover',
        user: req.session.user,
    })
})
app.get("/profile", checkLogin, (req, res) => {
    res.render('pages/profile', {
        title: 'Profile',
        user: req.session.user,
    })
})
app.get("/library", checkLogin, (req, res) => {
    res.render('pages/library', {
        title: 'Library',
        user: req.session.user,
    })
})
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect('/home');
    });
})