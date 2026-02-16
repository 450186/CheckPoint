const express = require('express');
const app = express();
const port = process.env.PORT || 4000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})

const userModel = require('./Models/users.js');
const libraryModel = require('./Models/Library.js');

const session = require('express-session');
const bcrypt = require('bcrypt');

const dotenv = require('dotenv').config();

const fiveMins = 5 * 60 * 1000;
const tenMins = 10 * 60 * 1000;
const oneHour = 1 * 60 * 60 * 1000;

const sessionSecret = process.env.sessionSecret
const mongoUsername = process.env.MongoUsername
const mongoPassword = process.env.MongoPassword
const mongoAppName = process.env.MongoAppName

const twitchClientId = process.env.TWITCH_CLIENT_ID
const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET

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

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
    const now = Date.now();

    if (cachedToken && now < tokenExpiry) {
        return cachedToken;
    }

    const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
    const url = new URL(TOKEN_URL);
    url.searchParams.append("client_id", twitchClientId);
    url.searchParams.append("client_secret", twitchClientSecret);
    url.searchParams.append("grant_type", "client_credentials");

    const resp = await fetch(url.toString(), { method: "POST" })
    const data = await resp.json();

    if (!resp.ok) {
        throw new Error(`Token request failed: ${resp.status} ${JSON.stringify(data)}`);
    }

    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    return cachedToken;
}

async function IGDBrequest(endpoint, body) {
    const token = await getAccessToken();
    const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: {
            'Client-ID': twitchClientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
        },
        body,
    })

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`IGDB request failed: ${response.status} ${text}`);
    }

    return response.json()
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
        id: user._id,
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
    if (await userModel.createUser(username, hashed, email, firstName, lastName)) {
        req.session.errorMessage = null;
        req.session.user = { username, email, firstName, lastName, id: _id };
        res.redirect('/dashboard');
    } else {
        req.session.errorMessage = 'Username or email already exists.';
        res.render('pages/Login', {
            title: 'Login',
            errorMessage: req.session.errorMessage,
        });
    }
})
app.get("/dashboard", checkLogin, async (req, res) => {
    const items = await libraryModel.find({ userId: req.session.user.id })
        .sort({ createdAt: -1 })
        .lean();

    const playing = items.filter(i => i.status === 'playing').slice(0, 4);

    res.render('pages/dashboard', {
        title: 'Dashboard',
        user: req.session.user,
        playing,
    })
})
app.get("/search", checkLogin, (req, res) => {
    const q = (req.query.query || "").trim();

    // go back if empty
    if (!q) return res.redirect(req.get("referer") || "/discover");

    return res.redirect(`/discover?query=${encodeURIComponent(q)}&page=1`);
});
app.get("/discover", checkLogin, async (req, res) => {
    const q = (req.query.query || "").trim();
    const pageNum = Math.max(parseInt(req.query.page || "1", 10), 1);

    try {
        const libraryItems = await libraryModel
            .find({ userId: req.session.user.id })
            .lean();
        const ownedGames = new Set(libraryItems.map((item) => item.gameId));

        const limit = 12;
        const offset = (pageNum - 1) * limit;

        const safeQ = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

        const igdbBody = q
            ? `
    search "${safeQ}";
    fields name, cover.url, first_release_date, aggregated_rating, platforms.name, genres.name;
    where cover != null;
    limit ${limit};
    offset ${offset};
    `
            : `
    fields name, cover.url, first_release_date, aggregated_rating, platforms.name, genres.name;
    where cover != null & aggregated_rating != null;
    sort first_release_date desc;
    limit ${limit};
    offset ${offset};`;

        const games = await IGDBrequest("games", igdbBody);
        console.log("q =", q, "| games =", games.length);

        res.render("pages/discover", {
            title: "Discover",
            user: req.session.user,
            games,
            errorMessage: null,
            pageNum,
            ownedGames,
            query: q,
        });
    } catch (error) {
        console.error(error);
        req.session.errorMessage = "Failed to load games. Please try again later.";
        res.render("pages/discover", {
            title: "Discover",
            user: req.session.user,
            games: [],
            errorMessage: req.session.errorMessage,
            pageNum,
            ownedGames: new Set(),
            query: q,
        });
    }
});
app.get("/game/:id", checkLogin, async (req, res) => {
    const id = Number(req.params.id);

    const [g] = await IGDBrequest("games", `
        fields
        id,
        name,
        cover.url,
        summary,
        first_release_date,
        aggregated_rating,
        platforms.id, platforms.name,
        genres.id, genres.name,
        themes.id, themes.name,
        keywords.id, keywords.name,
        involved_companies.company.id,
        involved_companies.developer,
        involved_companies.company.name,
        similar_games;
        where id = ${id};
        limit 1;
        `
    )

    if (!g) return res.redirect('/discover')

    const genresId = g.genres?.map(x => x.id) ?? [];

    const similarGenres = genresId.length
        ? await IGDBrequest("games", `
      fields id, name, cover.url, first_release_date, aggregated_rating;
      where genres = (${genresId.join(",")})
        & cover != null
        & id != ${id}
        & version_parent = null
        & parent_game = null
        & aggregated_rating != null
        & aggregated_rating > 80;
      sort aggregated_rating desc;
      limit 6;
    `)
        : [];


    const devCompany = g.involved_companies?.find(c => c.developer)?.company || null;
    const devCompanyId = devCompany?.id || null;
    const devCompanyName = devCompany?.name || "Unknown";

    const moreFromDev = devCompanyId
        ? await IGDBrequest("games", `
      fields id, name, cover.url, first_release_date, aggregated_rating;
      where involved_companies.company = ${devCompanyId}
        & involved_companies.developer = true
        & version_parent = null
        & parent_game = null
        & cover != null
        & id != ${id}
        & aggregated_rating != null
        & aggregated_rating > 80;
      sort first_release_date desc;
      limit 6;
    `)
        : [];

    const game = {
        id: g.id,
        name: g.name,
        coverUrl: g.cover?.url
            ? `http:${g.cover.url.replace("t_thumb", "t_cover_big")}`
            : "",
        description: g.summary || "No description available",
        developer: devCompanyName,
        platforms: g.platforms?.map(p => p.name) || [],
        genres: g.genres?.map(g => g.name) || [],
        releaseDate: g.first_release_date || null,
        rating: g.aggregated_rating || null
    }

    res.render('pages/game', {
        title: game.name,
        user: req.session.user,
        game,
        similarGenres,
        moreFromDev,
        devCompanyName,
    })
})
app.get("/profile", checkLogin, (req, res) => {
    res.render('pages/profile', {
        title: 'Profile',
        user: req.session.user,
    })
})
app.get("/library", checkLogin, async (req, res) => {

    const items = await libraryModel.find({ userId: req.session.user.id })
        .sort({ createdAt: -1 })
        .lean();

    const grouped = {
        playing: items.filter(i => i.status === 'playing'),
        completed: items.filter(i => i.status === 'completed'),
        wishlist: items.filter(i => i.status === 'wishlist'),
        dropped: items.filter(i => i.status === 'dropped'),
    }

    res.render('pages/library', {
        title: 'Library',
        user: req.session.user,
        grouped,
    })
})
app.post('/library/add', checkLogin, async (req, res) => {
    try {
        const { gameId, status, name, coverUrl } = req.body;

        await libraryModel.create({
            userId: req.session.user.id,
            gameId: Number(gameId),
            status: status || 'wishlist',
            cachedName: name || 'Unknown Title',
            cachedCoverUrl: coverUrl,
        });
        res.redirect('/library');
    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Failed to add game to library.';
        res.redirect('/discover');
    }
});
app.post("/library/status", checkLogin, async (req, res) => {
    const { gameId, status } = req.body;

    await libraryModel.updateOne(
        { userId: req.session.user.id, gameId: Number(gameId) },
        { $set: { status } }
    );

    res.redirect("/library");
});

app.post("/library/remove", checkLogin, async (req, res) => {
    const { gameId } = req.body;

    await libraryModel.deleteOne({
        userId: req.session.user.id,
        gameId: Number(gameId),
    });

    res.redirect("/library");
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect('/home');
    });
})