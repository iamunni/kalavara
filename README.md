# Kalavara (കലവറ)

> **Kalavara** means "Store Room" in Malayalam — a place to store and organize your financial transactions.

A local-first, privacy-focused personal expense tracker that automatically collects transaction data from your bank email notifications. No manual entry required.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- **Automatic Email Sync** — Fetches and parses transaction emails from Gmail (HDFC, SIB banks supported, with generic parser fallback)
- **Smart Categorization** — AI-powered transaction categorization using OpenAI (BYOK - Bring Your Own Key)
- **Deep Analytics** — Visualize spending by category, merchant, and time period
- **Local-First Storage** — All data stored locally in SQLite, your data never leaves your machine
- **Privacy-Focused** — BYOK model for both Google OAuth and OpenAI API keys

## Screenshots

*Coming soon*

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite with Drizzle ORM
- **Authentication**: NextAuth.js v4 with Google OAuth
- **Email**: Gmail API via googleapis
- **AI**: OpenAI API for categorization and fallback parsing
- **UI**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts (via shadcn/ui charts)

## Prerequisites

- Node.js 18+
- A Google Cloud Platform project with Gmail API enabled
- (Optional) OpenAI API key for smart categorization

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/kalavara.git
cd kalavara/expense-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Google Cloud Platform

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Gmail API**:
   - Navigate to **APIs & Services** > **Library**
   - Search for "Gmail API" and enable it
4. Configure OAuth consent screen:
   - Navigate to **APIs & Services** > **OAuth consent screen**
   - Choose "External" user type
   - Fill in app name, support email, and developer contact
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Add yourself as a test user
5. Create OAuth credentials:
   - Navigate to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - Select "Web application"
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Copy the **Client ID** and **Client Secret**

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Google OAuth (required)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OpenAI API (optional, for smart categorization)
OPENAI_API_KEY=your-openai-api-key

# NextAuth
NEXTAUTH_SECRET=generate-a-random-string-here
NEXTAUTH_URL=http://localhost:3000

# Database (optional, defaults to ./data/expense-tracker.db)
DATABASE_URL=./data/expense-tracker.db
```

Generate a NextAuth secret:

```bash
openssl rand -base64 32
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Sign in** with your Google account (requires Gmail access)
2. **Configure settings** — Add your OpenAI API key and select your banks
3. **Sync emails** — Click "Sync Now" to fetch transaction emails
4. **View dashboard** — See spending summaries, trends, and category breakdowns
5. **Browse transactions** — Filter and search through all your transactions
6. **Analyze spending** — Use the analytics page for deeper insights

## Supported Banks

Currently supported bank email formats:

- **HDFC Bank** — Credit/Debit card alerts, UPI transactions
- **South Indian Bank (SIB)** — Transaction alerts
- **Generic Parser** — Attempts to parse other bank formats
- **LLM Fallback** — Uses OpenAI to parse unrecognized formats

Want to add support for your bank? See [Contributing](#contributing).

## Project Structure

```
expense-tracker/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── analytics/     # Analytics APIs
│   │   │   ├── sync/          # Email sync endpoint
│   │   │   └── transactions/  # Transaction CRUD
│   │   ├── analytics/         # Analytics page
│   │   ├── settings/          # Settings page
│   │   └── transactions/      # Transactions page
│   ├── components/            # React components
│   │   ├── analytics/         # Charts and visualizations
│   │   ├── auth/             # Auth UI components
│   │   ├── layout/           # Layout components
│   │   ├── sync/             # Sync button
│   │   ├── transactions/     # Transaction table/filters
│   │   └── ui/               # shadcn/ui components
│   ├── lib/                   # Core logic
│   │   ├── auth/             # NextAuth configuration
│   │   ├── db/               # Database schema and init
│   │   ├── gmail/            # Gmail API client
│   │   ├── llm/              # OpenAI integration
│   │   ├── parsers/          # Bank email parsers
│   │   └── utils/            # Utility functions
│   └── types/                # TypeScript types
├── data/                      # SQLite database (gitignored)
└── public/                    # Static assets
```

## Data Privacy

Kalavara is designed with privacy in mind:

- **Local-first**: All data is stored locally in SQLite
- **No tracking**: No analytics or telemetry
- **BYOK**: You provide your own API keys, we don't see them
- **Open source**: Audit the code yourself

Your email content and transaction data never leave your machine (except when using the OpenAI API for categorization, which is optional).

## Roadmap

- [ ] More bank parsers (Axis, ICICI, Kotak, etc.)
- [ ] Budget planning and alerts
- [ ] Recurring transaction detection
- [ ] Export to CSV/Excel
- [ ] Mobile-responsive improvements
- [ ] SMS-based sync (via Android app)
- [ ] Multi-currency support

## Contributing

Contributions are welcome! Here's how you can help:

### Adding a new bank parser

1. Create a new parser in `src/lib/parsers/`
2. Follow the pattern in `hdfc.ts` or `sib.ts`
3. Register it in `src/lib/parsers/index.ts`
4. Submit a PR with sample email formats (anonymized)

### General contributions

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [gullak](https://github.com/mr-karan/gullak) by Karan Sharma
- Built with [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/), and [Drizzle ORM](https://orm.drizzle.team/)

---

**Kalavara** — Your personal expense store room. 💰
