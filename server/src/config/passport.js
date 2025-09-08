const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const userModel = require('../models/user');

// ============================================================================
// PASSPORT CONFIGURATION
// ============================================================================

// serialize user id for session storage
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// deserialize user from session id
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.getUserById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ============================================================================
// OAUTH STRATEGIES
// ============================================================================

// google oauth strategy configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET',
  callbackURL: `${process.env.SERVER_URL || 'https://localhost:5000'}/api/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // find existing user or create new one
    let user = await userModel.getUserByEmail(profile.emails[0].value);
    if (!user) {
      user = await userModel.createUser({
        username: profile.displayName,
        email: profile.emails[0].value,
        google_id: profile.id,
        profile_picture_url: profile.photos[0]?.value,
        status: 'active',
      });
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// github oauth strategy configuration
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID || 'GITHUB_CLIENT_ID',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || 'GITHUB_CLIENT_SECRET',
  callbackURL: `${process.env.SERVER_URL || 'https://localhost:5000'}/api/auth/github/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // find existing user or create new one
    let user = await userModel.getUserByEmail(profile.emails[0].value);
    if (!user) {
      user = await userModel.createUser({
        username: profile.username,
        email: profile.emails[0].value,
        github_id: profile.id,
        profile_picture_url: profile.photos[0]?.value,
        status: 'active',
      });
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

module.exports = passport; 