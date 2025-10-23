import axios from 'axios';

export type TokenServiceConfig = {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
};

export class TokenService {
  private clientId: string;
  private clientSecret: string;
  private tokenUrl: string;
  private accessToken: string | null = null;
  private expiry: number = 0;

  constructor(config: TokenServiceConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokenUrl = config.tokenUrl;
  }

  public async getAccessToken(): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 10;

    if (this.accessToken && now < this.expiry) {
      return this.accessToken;
    }

    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(this.clientId)}&client_secret=${encodeURIComponent(this.clientSecret)}`;
    const response = await axios.post(this.tokenUrl, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token, expires_in } = response.data;
    this.accessToken = access_token;
    this.expiry = now + (expires_in || 60) - bufferTime;
    return this.accessToken;
  }
}
