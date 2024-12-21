const express = require("express");
const expressSession = require("express-session");
const passport = require("passport");
const crypto = require("crypto");
const RedditStrategy = require("passport-reddit").Strategy;
const luxon = require("luxon");
require("dotenv").config();

const app = express();

// Configuration
const { REDDIT_ID, REDDIT_SECRET, SHEET_ID } = process.env;
const BASE_URL = "http://localhost:3000"; // Change to your production URL in deployment
const PORT = process.env.PORT || 3000;

// Middleware
app.set("view engine", "ejs");
app.use(
  expressSession({
    secret: "secure-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }, // 1-hour session
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static("public"));

// Passport.js setup
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(
  new RedditStrategy(
    {
      clientID: REDDIT_ID,
      clientSecret: REDDIT_SECRET,
      callbackURL: `${BASE_URL}/auth/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      // Eligibility logic: Check if account is older than a specific date
      const accountCreatedDate = luxon.DateTime.fromSeconds(
        profile._json.created_utc
      ).setZone("Asia/Seoul");
      const cutoffDate = luxon.DateTime.fromObject(
        { year: 2024, month: 8, day: 1 },
        { zone: "Asia/Seoul" }
      );

      if (accountCreatedDate < cutoffDate) {
        return done(null, profile); // Eligible
      } else {
        return done(null, null); // Ineligible
      }
    }
  )
);

// Routes
app.get("/", (req, res) => {
  res.render("index", {
    title: "Welcome to Reddit Auth App",
    desc: "Authenticate with Reddit to proceed.",
    button_text: "Continue with Reddit",
    auth_url: "/auth",
  });
});

app.get("/auth", (req, res, next) => {
  req.session.state = crypto.randomBytes(32).toString("hex");
  passport.authenticate("reddit", {
    scope: ["identity"],
    state: req.session.state,
  })(req, res, next);
});

app.get(
  "/auth/callback",
  passport.authenticate("reddit", {
    failureRedirect: "/ineligible",
  }),
  (req, res) => {
    req.session.user = req.user; // Save user to session
    res.redirect("/ballot");
  }
);

app.get("/ballot", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  res.render("ballot", { username: req.session.user.name });
});

app.get("/ineligible", (req, res) => {
  res.render("ineligible", {
    title: "Access Denied",
    desc: "You are ineligible to proceed further.",
    button_text: "Go Back to Home",
  });
});

// 404 Page
app.use((req, res) => {
  res.status(404).render("404", {
    message: "Page Not Found",
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
