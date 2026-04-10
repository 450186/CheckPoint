const express = require('express');
const app = express();
const port = process.env.PORT || 4000;

const userModel = require('./Models/users.js');
const libraryModel = require('./Models/Library.js');
const reviewModel = require('./Models/Review.js');

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
    .then(() => {
        console.log('Connected to MongoDB')
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((err) => console.error('Error connecting to MongoDB:', err));

mongoose.connection.on("connected", () => {
    console.log("Mongoose connected");
});

mongoose.connection.on("disconnected", () => {
    console.log("Mongoose disconnected");
});

mongoose.connection.on("error", (err) => {
    console.error("Mongoose error:", err);
});

const path = require('path');
const { log, error } = require('console');
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
function popErrorMessage(req) {
    const errorMessage = req.session.errorMessage;
    req.session.errorMessage = null;
    return errorMessage;
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
function toTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) {
        return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    } else if (seconds < 7 * 86400) {
        const days = Math.floor(seconds / 86400);
        return `${days} day${days === 1 ? "" : "s"} ago`;
    } else if (seconds < 30 * 86400) {
        const weeks= Math.floor(seconds / (7 * 86400));
        return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    } else if (seconds < 365 * 86400) {
        const months = Math.floor(seconds / (30 * 86400));
        return `${months} month${months === 1 ? "" : "s"} ago`;
    }
    const years = Math.floor(seconds / (365 * 86400));
    return `${years} year${years === 1 ? "" : "s"} ago`;
}

async function getFriendRequests(userId) {
    const user = await userModel.userData.findById(userId)
    .populate("friendRequests")
    .lean();

    const friendRequests = user?.friendRequests || [];
    return friendRequests
}

app.get('/', (req, res) => {
    res.render('pages/home', {
        title: 'Home',
        requestPath: req.originalUrl,
    })
})
app.get("/home", (req, res) => {
    res.render('pages/home', {
        title: 'Home',
        requestPath: req.originalUrl
    })
})
app.get("/login", async (req, res) => {
    const errorMessage = popErrorMessage(req);

    res.render('pages/login', {
        title: 'Login',
        user: req.session.user,
        loggedIn: isLoggedIn(req),
        errorMessage,
        requestPath: req.originalUrl
    })
})
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await userModel.userData.findOne({ username });
    if (!user) {
        req.session.errorMessage = 'Invalid username or password';
        return res.redirect('/login');
    }
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
        req.session.errorMessage = 'Invalid username or password';
        return res.redirect('/login');
    }
    req.session.user = {
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarSeed: user.avatarSeed,
        id: user._id,
    };
    res.redirect('/dashboard');
})
app.get("/register", (req, res) => {
    const errorMessage = popErrorMessage(req);
    res.render('pages/register', {
        title: 'Register',
        errorMessage,
        requestPath: req.originalUrl
    })
})
app.post("/register", async (req, res) => {
    const { username, password, email, firstName, lastName } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    if (!passwordRegex.test(password)) {
        req.session.errorMessage = 'Password must match the rules, press the information icon to check the rules.';
        return res.redirect('/register');
    }

    const newUser = await userModel.createUser(username, hashed, email, firstName, lastName);

    if (newUser) {
        req.session.user = {
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            avatarSeed: newUser.avatarSeed,
            id: newUser._id,
        };
        return res.redirect('/dashboard');
    } else {
        req.session.errorMessage = 'Username or email already exists. Please choose another.';
        return res.redirect('/register');
    }
});
app.get("/dashboard", checkLogin, async (req, res) => {
    const highestRated = await libraryModel.find({ userId: req.session.user.id })
        .sort({ userRating: -1 })
        .limit(5)
        .lean();

    const items = await libraryModel.find({ userId: req.session.user.id })
        .sort({ createdAt: -1 })
        .lean();

    const playing = items.filter(i => i.status === 'playing').slice(0, 4);


    const YourReviews = await reviewModel.find({ userId: req.session.user.id })
        .sort({ createdAt: -1 })
        .lean();

        const errorMessage= popErrorMessage(req);

    const friendRequests = await getFriendRequests(req.session.user.id);

    res.render('pages/dashboard', {
        title: 'Dashboard',
        user: req.session.user,
        playing,
        YourReviews,
        highestRated,
        errorMessage,
        requestPath: req.originalUrl,
        friendRequests: friendRequests || [],
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

    const friendRequests = await getFriendRequests(req.session.user.id);

    const genres = (req.query.genres || "").toString().trim();
    const platforms = (req.query.platforms || "").toString().trim();
    const minRating = Number(req.query.minRating || 0);
    const yearFrom = (req.query.yearFrom || "").toString().trim();
    const yearTo = (req.query.yearTo || "").toString().trim();
    const sort = (req.query.sort || "newest").toString().toLowerCase();

    function IDlist(str) {
        return str
            .split(",")
            .map((s) => Number(s.trim()))
            .filter(n => Number.isFinite(n) && n > 0);
    }

    const genreIds = IDlist(genres);
    const platformIds = IDlist(platforms);

    function monthStartToUnix(yyyyMm) {
        const ms = Date.parse(`${yyyyMm}-01T00:00:00.000Z`);
        return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
    }

    function monthEndToUnix(yyyyMm) {
        const [y, m] = yyyyMm.split("-").map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

        const nextMonth = m === 12 ? 1 : m + 1;
        const nextYear = m === 12 ? y + 1 : y;

        const ms = Date.parse(
            `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`
        );
        return Number.isFinite(ms) ? Math.floor(ms / 1000) - 1 : null;
    }

    const fromDate = yearFrom ? monthStartToUnix(yearFrom) : null;
    const toDate = yearTo ? monthEndToUnix(yearTo) : null;

    try {
        const libraryItems = await libraryModel
            .find({ userId: req.session.user.id })
            .lean();

        const ownedGames = new Set(libraryItems.map((item) => item.gameId));

        const limit = 12;
        const offset = (pageNum - 1) * limit;

        const whereParts = ["cover != null & aggregated_rating != null"];
        const safeQ = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

        if (genreIds.length) whereParts.push(`genres = (${genreIds.join(",")})`);
        if (platformIds.length) whereParts.push(`platforms = (${platformIds.join(",")})`);

        if (Number.isFinite(minRating) && minRating > 0) {
            whereParts.push(`aggregated_rating != null`);
            whereParts.push(`aggregated_rating >= ${Math.min(minRating, 100)}`);
        }

        if (fromDate) {
            whereParts.push(`first_release_date != null`);
            whereParts.push(`first_release_date >= ${fromDate}`);
        }

        if (toDate) {
            whereParts.push(`first_release_date != null`);
            whereParts.push(`first_release_date <= ${toDate}`);
        }

        whereParts.push(`version_parent = null`);
        whereParts.push(`parent_game = null`);

        let sortLine = "";
        if (!q) {
            sortLine = `sort first_release_date desc`;
            if (sort === "rating") sortLine = `sort aggregated_rating desc`;
            if (sort === "name") sortLine = `sort name asc`;
        }

        const igdbBody = `
        ${q ? `search "${safeQ}";` : ""}
        fields name, cover.url, first_release_date, aggregated_rating, platforms.name, genres.name;
        where ${whereParts.join(" & ")};
        ${sortLine ? `${sortLine};` : ""}
        limit ${limit};
        offset ${offset};
        `;

        const games = await IGDBrequest("games", igdbBody);

        const availableGenres = await IGDBrequest("genres", `
            fields id, name;
            sort name asc;
            limit 100;
        `);

        const allowedPlatforms = [
            "PC (Microsoft Windows)",
            "PlayStation 5",
            "PlayStation 4",
            "Xbox Series X|S",
            "Xbox One",
            "Nintendo Switch",
            "iOS",
            "Android",
        ];

        const allowedPlatformsSet = new Set(allowedPlatforms);

        const allPlatforms = await IGDBrequest("platforms", `
            fields id, name;
            sort name asc;
            limit 200;
        `);

        const popularPlatforms = allPlatforms
            .filter(p => allowedPlatformsSet.has(p.name))
            .sort((a, b) => allowedPlatforms.indexOf(a.name) - allowedPlatforms.indexOf(b.name));

        const otherPlatforms = allPlatforms.filter(p => !allowedPlatformsSet.has(p.name));

        const errorMessage = popErrorMessage(req);

        res.render("pages/discover", {
            title: "Discover",
            user: req.session.user,
            games,
            errorMessage,
            pageNum,
            ownedGames,
            query: q,
            availableGenres,
            popularPlatforms,
            otherPlatforms,
            filters: {
                genres: genreIds,
                platforms: platformIds,
                minRating: Number.isFinite(minRating) ? minRating : 0,
                yearFrom: yearFrom || "",
                yearTo: yearTo || "",
                sort,
            },
            requestPath: req.originalUrl,
            friendRequests,
        });
    } catch (error) {
        console.error(error);

        res.render("pages/discover", {
            title: "Discover",
            user: req.session.user,
            games: [],
            errorMessage: "Failed to load games. Please try again later.",
            pageNum,
            ownedGames: new Set(),
            query: q,
            availableGenres: [],
            popularPlatforms: [],
            otherPlatforms: [],
            filters: {
                genres: [],
                platforms: [],
                minRating: 0,
                yearFrom: "",
                yearTo: "",
                sort: "newest"
            },
            requestPath: req.originalUrl,
            friendRequests
        });
    }
});
app.get("/game/:id", checkLogin, async (req, res) => {
    const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.redirect("/discover"); 
  }

    const [g] = await IGDBrequest("games", `
        fields
        id,
        name,
        cover.url,
        summary,
        first_release_date,
        aggregated_rating,
        screenshots.url,
        videos.video_id,
        artworks.url,
        game_modes.name,
        game_type.type,
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

const genreIds = g.genres?.map(x => x.id) ?? [];
const similarIds = (g.similar_games || []).slice(0, 30);

let similarGenres = [];

if (similarIds.length) {
  similarGenres = await IGDBrequest("games", `
    fields id, name, cover.url, genres.name, first_release_date, aggregated_rating, genres.id;
    where id = (${similarIds.join(",")})
      & cover != null
      & id != ${id}
      & version_parent = null
      & parent_game = null;
    limit 12;
  `);
}

if (!similarGenres.length && genreIds.length >= 2) {
  const candidates = await IGDBrequest("games", `
    fields id, name, cover.url, genres.name, first_release_date, aggregated_rating, genres.id;
    where genres = (${genreIds.join(",")})
      & cover != null
      & id != ${id}
      & version_parent = null
      & parent_game = null;
    limit 60;
  `);

  const base = new Set(genreIds);

  similarGenres = candidates
    .map(c => {
      const cGenres = c.genres?.map(gx => gx.id) ?? [];
      const overlap = cGenres.reduce((acc, gid) => acc + (base.has(gid) ? 1 : 0), 0);
      return { game: c, overlap };
    })
    .filter(x => x.overlap >= 2)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      const br = Number.isFinite(b.game.aggregated_rating) ? b.game.aggregated_rating : -1;
      const ar = Number.isFinite(a.game.aggregated_rating) ? a.game.aggregated_rating : -1;
      return br - ar;
    })
    .slice(0, 6)
    .map(x => x.game);
}
similarGenres = similarGenres.slice(0, 6);


    const devCompany = g.involved_companies?.find(c => c.developer)?.company || null;
    const devCompanyId = devCompany?.id || null;
    const devCompanyName = devCompany?.name || "Unknown";

    const moreFromDev = devCompanyId
        ? await IGDBrequest("games", `
      fields id, name, genres.id, genres.name, cover.url, first_release_date, aggregated_rating;
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
    const TimeToBeat = await IGDBrequest("game_time_to_beats",
        `
        fields game_id, completely, hastily, normally;
        where game_id = ${g.id};
        limit 1;
        `)

    const ttb = TimeToBeat[0] || null
    const completion = {
        main: ttb?.normally ? Math.round(ttb.normally / 3600) : null,
        completionist: ttb?.completely ? Math.round(ttb.completely / 3600) : null,
        rushed: ttb?.hastily ? Math.round(ttb.hastily / 3600) : null,
    };

    const userLibraryItem = await libraryModel.findOne({
        userId: req.session.user.id,
        gameId: id
    }).lean();

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
        rating: g.aggregated_rating || null,
        gameModes: g.game_modes?.map(mode => mode.name) || [],
        completion,

        artworks: g.artworks?.map(a => ({
            url: a.url ? `http:${a.url.replace("t_thumb", "t_1080p")}` : ""
        })).filter(a => a.url) || [], //filter out empty urls

        screenshots: g.screenshots?.map(s => ({
            url: s.url ? `http:${s.url.replace("t_thumb", "t_1080p")}` : ""
        })).filter(s => s.url) || [],//filter out empty urls

        videos: g.videos?.map(v => ({
            url: v.video_id ? `https://www.youtube.com/embed/${v.video_id}` : ""
        })).filter(v => v.url) || [],
    }

    const errorMessage = popErrorMessage(req);
    const friendRequests = await getFriendRequests(req.session.user.id);

    const from = (typeof req.query.from === "string" && req.query.from.startsWith("/")) 
    ? req.query.from 
    : "/dashboard";

    res.render('pages/game', {
        title: game.name,
        user: req.session.user,
        game,
        userLibraryItem,
        similarGenres,
        moreFromDev,
        devCompanyName,
        TimeToBeat,
        from,
        errorMessage,
        requestPath: req.originalUrl,
        friendRequests
    })
})
app.get("/profile", checkLogin, async (req, res) => {
    const profileUser = await userModel.userData
    .findById(req.session.user.id)
    .populate("friendsList")
    .lean();

    const userReviews = await reviewModel.find({ userId: req.session.user.id })
        .sort({ createdAt: -1 })
        .lean();

    const items = await libraryModel.find({ userId: req.session.user.id })
        .sort({ createdAt: -1 })
        .lean();

    const playing = items.filter(i => i.status === 'playing').slice(0, 4);

    const errorMessage = popErrorMessage(req);

    const from = (typeof req.query.from === "string" && req.query.from.startsWith("/")) 
    ? req.query.from 
    : "/dashboard";

    const friendRequests = await getFriendRequests(req.session.user.id);

    res.render('pages/profile', {
        title: 'Profile',
        user: req.session.user,
        profileUser,
        isOwnProfile: true,
        errorMessage,
        userReviews,
        playing,
        from,
        requestPath: req.originalUrl,
        friendRequests
    })
})
app.post('/profile/delete', checkLogin, async (req, res) => {
    try {
        const user = await userModel.userData.findById(req.session.user.id)
        if(!user) {
            req.session.destroy(() => {
                res.redirect("/home")
            })
            return
        }
        await userModel.userData.updateMany(
            {_id : {$in : user.friendsList}},
            {$pull : {friendsList : req.session.user.id}}
        )
        await userModel.userData.updateMany(
            {
                $or : [
                    { friendRequests : req.session.user.id },
                    { sentFriendRequests : req.session.user.id }
                ]
            },
            {
                $pull : {
                    friendRequests : req.session.user.id,
                    sentFriendRequests : req.session.user.id
                }
            }
        )

        await libraryModel.deleteMany({ userId: req.session.user.id });
        await reviewModel.deleteMany({ userId: req.session.user.id });

        await userModel.userData.findByIdAndDelete(req.session.user.id);

        req.session.destroy((e) => {
            if(e) {
                console.log(e)
                res.redirect("/home")
            }
            res.redirect("/home")
        })
    } catch (e) {
        console.error(e)
        console.log("error deleting user: ", e)
        res.redirect("/profile")
    }
})
app.post('/friends/remove', checkLogin, async (req, res) => {
    const { friendId } = req.body;
    
    await userModel.userData.updateOne(
        { _id: req.session.user.id },
        { $pull: { friendsList: friendId } }
    );
    await userModel.userData.updateOne(
        { _id: friendId },
        { $pull: { friendsList: req.session.user.id } }
    );

    res.redirect(req.get("referer") || "/profile");
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

    const genreCount = {};

    items.forEach(item => {
        const genres = (item.cachedGenres || "")
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
        
        genres.forEach(genre => {
            genreCount[genre] = (genreCount[genre] || 0) + 1
        })
    })
    const sortedGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])


    const topGenres = sortedGenres.slice(0, 5)
    const otherGenreEntries = sortedGenres.slice(5)

    const otherGenreTotal = otherGenreEntries.reduce((sum, [, count]) => sum + count, 0);

    const labels = topGenres.map(([genre]) => genre);
    const values = topGenres.map(([, count]) => count);

    if(otherGenreTotal > 0) {
        labels.push("Other");
        values.push(otherGenreTotal);
    }
    const genreData = {
        labels,
        values,
        otherGenres: otherGenreEntries.map(([genre, count]) => ({ genre, count }))
    }

    const totalGames = grouped['playing'].length + grouped['completed'].length + grouped['wishlist'].length + grouped['dropped'].length;

    const completionRate = totalGames > 0 ? Math.round((grouped['completed'].length / totalGames) * 100) : 0;

    const friendRequests = await getFriendRequests(req.session.user.id);

    res.render('pages/library', {
        title: 'Library',
        user: req.session.user,
        grouped,
        totalGames,
        completionRate,
        genreData,
        requestPath: req.originalUrl,
        friendRequests
    })
})
app.post('/library/add', checkLogin, async (req, res) => {
    try {
        const { gameId, status, name, coverUrl, genres, rating, release } = req.body;

        await libraryModel.create({
        userId: req.session.user.id,
        gameId: Number(gameId),
        status: status || "wishlist",
        cachedName: name || "Unknown Title",
        userRating: null,
        cachedCoverUrl: coverUrl,
        cachedGenres: genres || "",
        cachedRating: rating ? Number(rating) : null,
        cachedRelease: release || ""
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

    const update = { status };

    if(status === "wishlist") {
        update.userRating = null
    }

    await libraryModel.updateOne(
        { userId: req.session.user.id, gameId: Number(gameId) },
        { $set: update }
    );

    res.redirect("/library");
});
app.post("/library/rate", checkLogin, async (req, res) => {
    const { gameId, rating } = req.body;

    const ratingValue = 
        rating === "" || rating === null || rating === undefined
        ? null
        : Number(rating);

    await libraryModel.updateOne(
        { 
            userId: req.session.user.id, 
            gameId: Number(gameId) 
        },
        { 
            $set: { userRating: ratingValue }, 
            $currentDate: { updatedAt: true }
        }
    );

    res.sendStatus(204);
})

app.post("/library/remove", checkLogin, async (req, res) => {
    const { gameId } = req.body;

    await libraryModel.deleteOne({
        userId: req.session.user.id,
        gameId: Number(gameId),
    });

    res.redirect("/library");
});
app.post("/reviews/create", checkLogin, async (req, res) => {
    const { gameId, cachedName, cachedCoverUrl, title, rating,review } = req.body;

    await reviewModel.create({
        userId: req.session.user.id,
        gameId: Number(gameId),
        cachedName,
        cachedCoverUrl,
        title,
        rating: rating === "" ? null : Number(rating),
        body: review,
    });
    res.redirect(`/game/${gameId}`)
})
app.post("/reviews/delete", checkLogin, async (req, res) => {
    const { reviewId, gameId } = req.body;

    await reviewModel.deleteOne({ _id: reviewId });

    res.redirect(`/game/${gameId}`)
})
app.get("/users/:username", checkLogin, async (req, res) => {
    const profileUser = await userModel.userData.findOne({
        username: req.params.username
    }).populate("friendsList").lean();
    if(!profileUser) {
        req.session.errorMessage = "User not found.";
        return res.redirect(req.get("referer") || "/dashboard");
    }
        
    const items = await libraryModel.find({ userId: profileUser._id })
        .sort({ createdAt: -1 })
        .lean();

    const playing = items.filter(i => i.status === 'playing').slice(0, 4);

    const userReviews = await reviewModel.find({ userId: profileUser._id })
        .sort({ createdAt: -1 })
        .lean();

    const alreadyFriends = profileUser.friendsList.some(
        friend => friend._id.equals(req.session.user.id)
    );

    const errorMessage = popErrorMessage(req);

    const friendRequests = await getFriendRequests(req.session.user.id);

    const from = (typeof req.query.from === "string" && req.query.from.startsWith("/")) 
    ? req.query.from 
    : "/dashboard";

    res.render("pages/profile", {
        title: "Profile",
        user: req.session.user,
        profileUser,
        alreadyFriends,
        isOwnProfile: req.session.user.username === profileUser.username,
        userReviews,
        errorMessage,
        playing,
        from,
        requestPath: req.originalUrl,
        friendRequests
    })
})
app.post("/profile/avatar/randomise", checkLogin, async (req, res) => {
    const newSeed = Math.random().toString(36).slice(2) + Date.now();

    await userModel.userData.updateOne(
        { _id: req.session.user.id },
        { $set: { avatarSeed: newSeed } }
    );

    req.session.user.avatarSeed = newSeed;

    res.redirect("/profile");
})
app.get("/friends/search", checkLogin, async (req, res) => {
    const query = (req.query.query || "").trim();

    if(!query) {
        return res.redirect(req.get("referer") || "/dashboard");
    }
    const user = await userModel.userData.findOne({
        username: query,
    })

    if(!user) {
        req.session.errorMessage = "User not found.";
        return res.redirect(req.get("referer") || "/dashboard");
    }
    res.redirect(`/users/${encodeURIComponent(user.username)}`);
})
app.post("/friends/add", checkLogin, async (req, res) => {
    try {
        const {friendId} = req.body;
        if(!friendId) {
            req.session.errorMessage = "Invalid user.";
            return res.redirect(req.get("referer") || "/dashboard");
        }
        if(String(friendId) === String(req.session.user.id)) {
            req.session.errorMessage = "You cannot add yourself as a friend.";
            return res.redirect(req.get("referer") || "/dashboard");
        }
        const friend = await userModel.userData.findById(friendId);
        if(!friend) {
            req.session.errorMessage = "User not found.";
            return res.redirect(req.get("referer") || "/dashboard");
        }
        const currentUser = await userModel.userData.findById(req.session.user.id);
        if(!currentUser) {
            req.session.errorMessage = "Your Account could not be found.";
            return res.redirect(req.get("referer") || "/dashboard");
        }
        const alreadyFriends = currentUser.friendsList.some(
            id => String(id) === String(friendId)
        );
        if(alreadyFriends) {
            req.session.errorMessage = "You are already friends with this user.";
            return res.redirect(`/users/${encodeURIComponent(friend.username)}`);
        }
        await userModel.userData.updateOne(
            { _id: req.session.user.id },
            { $addToSet: {sentFriendRequests: friendId} }
        );
        await userModel.userData.updateOne(
            { _id: friend._id },
            { $addToSet: {friendRequests: req.session.user.id} }
        );
        req.session.errorMessage = "You have sent a friend request to " + friend.username + "!";
        return res.redirect(`/users/${encodeURIComponent(friend.username)}`);
    } catch (e) {
        console.error(e);
        req.session.errorMessage = "An error occurred while adding friend.";
        return res.redirect(req.get("referer") || "/dashboard");    
    }
})
app.post("/friends/accept", checkLogin, async (req, res) => {
    const {friendId} = req.body;

    await userModel.userData.updateOne(
        { _id: req.session.user.id },
        { 
            $addToSet: {friendsList: friendId},
            $pull: {friendRequests: friendId}
        }
    )
    await userModel.userData.updateOne(
        { _id: friendId },
        { 
            $addToSet: {friendsList: req.session.user.id},
            $pull: {sentFriendRequests: req.session.user.id} 
        },
    )
    res.redirect(req.get("referer") || "/dashboard");
})
app.post("/friends/reject", checkLogin, async (req, res) => {
    const {friendId} = req.body;

    await userModel.userData.updateOne(
        { _id: req.session.user.id },
        { $pull: {friendRequests: friendId} }
    )
    await userModel.userData.updateOne(
        { _id: friendId },
        { $pull: {sentFriendRequests: req.session.user.id} }
    )
    res.redirect(req.get("referer") || "/dashboard");
})
app.get("/activity", checkLogin, async (req, res) => {
    const user = await userModel.userData.findById(req.session.user.id)
    .populate("friendsList")
    .lean();

    const friends = user.friendsList.map(friend => friend._id)

    const reviews = await reviewModel.find({
        userId: { $in: friends },
    }).sort({ createdAt: -1 }).lean();

    const libraryUpdates = await libraryModel.find({
        userId: { $in: friends },
    }).sort({ updatedAt: -1 }).lean();

    const friendMap = new Map(user.friendsList.map(f => [String(f._id), f]));

    const friendRequests = await getFriendRequests(req.session.user.id);

    const reviewActivities = reviews.map(r => ({
        type: "review",
        createdAt: r.createdAt,
        timeAgo: toTimeAgo(new Date(r.createdAt)),
        user: friendMap.get(String(r.userId)),
        gameId: r.gameId,
        gameName: r.cachedName,
        coverUrl: r.cachedCoverUrl,
        reviewId: r._id,
        title: r.title,
        rating: r.rating,
        body: r.body,
    }))

    const libraryActivities = libraryUpdates.map(l => ({
        type: "status",
        createdAt: l.updatedAt || l.createdAt,
        timeAgo: toTimeAgo(new Date(l.updatedAt)) || toTimeAgo(new Date(l.createdAt)),
        user: friendMap.get(String(l.userId)),
        gameId: l.gameId,
        gameName: l.cachedName,
        coverUrl: l.cachedCoverUrl,
        status: l.status,
        userRating: l.userRating,
    }))

    const activityFeed = [...reviewActivities, ...libraryActivities] //get all activities using ... to spread the arrays into one array
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const errorMessage = popErrorMessage(req);

    res.render("pages/activity", {
        title: "Activity",
        user: req.session.user,
        activityFeed,
        errorMessage,
        requestPath: req.originalUrl,
        friendRequests
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