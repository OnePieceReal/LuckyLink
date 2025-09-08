const axios = require('axios');
const readline = require('readline-sync');

const BASE_URL = 'http://localhost:5000/api/auth';

async function testGoogleOAuth() {
  console.log('Testing Google OAuth...');
  console.log('Please open the following URL in your browser to complete the login:');
  console.log(`${BASE_URL}/google`);
  readline.question('Press Enter after you have completed the Google OAuth flow in your browser...');
  console.log('Check your browser for the JWT response.');
}

async function testGitHubOAuth() {
  console.log('Testing GitHub OAuth...');
  console.log('Please open the following URL in your browser to complete the login:');
  console.log(`${BASE_URL}/github`);
  readline.question('Press Enter after you have completed the GitHub OAuth flow in your browser...');
  console.log('Check your browser for the JWT response.');
}

async function main() {
  const arg = process.argv[2];
  if (arg === '1') {
    await testGoogleOAuth();
  } else if (arg === '2') {
    await testGitHubOAuth();
  } else {
    console.log('Usage: node oauthTest.js <1=Google | 2=GitHub>');
  }
}

main(); 