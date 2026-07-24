# Slack AI Agent

A Node.js application that integrates with Slack and Groq AI to automatically analyze and report on members joining a workspace.

## Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL database
- A Slack Workspace with permissions to create an app
- A [Groq](https://console.groq.com/) account for the API key

### 1. Install Dependencies
Clone the repository and install the required packages:
```bash
npm install
```

### 2. Configure Environment Variables
You will need to set up several environment variables to connect to Slack, Groq, and your Database. This can be tricky, so follow these steps carefully.

First, copy the example environment file:
```bash
cp .env.example .env
```

Open the `.env` file and fill in the values:

#### Slack Credentials
To get these, go to the [Slack API Dashboard](https://api.slack.com/apps) and create a new app (or select your existing one).
- **`SLACK_BOT_TOKEN`**: Starts with `xoxb-`. Find this under **OAuth & Permissions** in your app settings after installing the app to your workspace. Ensure you have the necessary bot token scopes (e.g., `chat:write`, `users:read`, etc.).
- **`SLACK_SIGNING_SECRET`**: Find this under **Basic Information** in the "App Credentials" section.
- **`SLACK_APP_TOKEN`**: Starts with `xapp-`. Find this under **Basic Information** -> **App-Level Tokens**. You must generate a new token here and give it the `connections:write` scope to enable Socket Mode. (Also ensure Socket Mode is turned on in the "Socket Mode" settings).
- **`SLACK_PRIVATE_CHANNEL_ID`**: Open Slack, right-click the channel you want the bot to post in, select **View channel details**, and scroll to the bottom to find the Channel ID (e.g., `C0XXXXXXXXX`). **Important:** Make sure you have invited your bot to this channel (e.g., by typing `/invite @YourBotName` in the channel).

#### AI / LLM
- **`GROQ_API_KEY`**: Starts with `gsk_`. Get this from the [Groq Console](https://console.groq.com/keys).

#### Database
- **`DATABASE_URL`**: Your PostgreSQL connection string. (e.g., `postgresql://user:password@localhost:5432/slack_ai_agent`)

#### Company Context (Optional)
- **`COMPANY_NAME`** and **`COMPANY_PRODUCT`**: Used to give the AI context about your company for better member analysis.

### 3. Start the Server
Run the development server:
```bash
npm run dev
```
You should see logs indicating that the database is connected, the server is running, and the Slack bot is connected.

### 4. Test the Integration
You can test the member analysis functionality locally without needing someone to actually join the workspace. 

**Option A: Using the Web UI (Recommended)**
Open your browser and navigate to `http://localhost:3000`. You will see a modern web interface where you can enter a member's details and trigger the analysis directly.

**Option B: Using cURL**
Alternatively, run the following command in your terminal:

```bash
curl --location 'localhost:3000/test/analyze-member' \
--header 'Content-Type: application/json' \
--data-raw '{
    "memberInfo": {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "title": "Software Engineer at Google"
    }
}'
```

If everything is configured correctly, this will trigger the agent to analyze the member data, save it to the database, and the bot will post the generated report in the configured Slack channel.

## Customization

### Modifying the AI Prompt
The agent uses a default prompt tailored to evaluating how a member fits with a commercial product. You can customize this prompt to fit your specific business requirements or community goals.

To do this, open `src/services/aiService.js` and modify the template string inside the `analyzeWithAI` function:

```javascript
const prompt = ChatPromptTemplate.fromTemplate(`
    // Write your custom system instructions here...
`);
```

Make sure that your modified prompt still instructs the AI to return a JSON object with `fitScore`, `insights`, and `recommendations` keys so the application can process it correctly.
