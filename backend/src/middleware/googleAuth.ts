import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(idToken: string) {
  // If in development/testing mode and using a mock token, bypass real verification
  if (process.env.NODE_ENV !== 'production' && idToken.startsWith('mock_google_id_token_')) {
    const email = idToken.replace('mock_google_id_token_', '');
    return {
      email: email,
      email_verified: true,
      name: email.split('@')[0],
      picture: null
    };
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload(); // Contains email, name, picture, etc.
}
