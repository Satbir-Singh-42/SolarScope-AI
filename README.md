# SolarScope AI

> **AI-Powered Solar Panel Analysis Platform**

Professional full-stack web application leveraging Google Gemini AI for comprehensive solar panel analysis, featuring dynamic installation planning, intelligent fault detection, user authentication with PostgreSQL storage, PDF report generation, and expert AI consultation with mobile-responsive design. Optimized for API efficiency and streamlined codebase.

![SolarScope AI](https://img.shields.io/badge/AI-Powered-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Express](https://img.shields.io/badge/Express.js-404D59?logo=express)
![Google AI](https://img.shields.io/badge/Google_AI-Gemini-orange)

## 🌟 Overview

SolarScope AI is an AI-powered solar panel analysis platform that leverages Google Gemini AI to provide two main services:
1. **Installation Planning**: Analyzes rooftop images to recommend optimal solar panel placement
2. **Fault Detection**: Identifies defects and performance issues in existing solar panel installations

The application is built as a full-stack web application with a React frontend and Express.js backend, designed for deployment with PostgreSQL database integration.

## Features

### 🔍 Installation Planning
- **AI-Powered Roof Analysis**: Analyze rooftop images to determine optimal solar panel placement
- **Dynamic Calculations**: Real-time calculations for coverage, power output, and efficiency
- **Market-Standard Metrics**: Accurate calculations using industry-standard panel specifications
- **Professional PDF Reports**: Generate detailed installation reports with technical specifications

### 🛠️ Fault Detection
- **Advanced Defect Recognition**: Detect cracks, delamination, hot spots, and other panel defects
- **Severity Classification**: Categorize issues by severity (Critical, High, Medium, Low)
- **AI-Generated Recommendations**: Specific maintenance plans based on detected faults
- **Comprehensive Reporting**: Detailed fault analysis with professional PDF exports

### 💬 AI Chat Assistant
- **Real-time Solar Expertise**: Get instant answers about solar technology and best practices
- **Context-Aware Responses**: Intelligent responses based on your analysis history
- **Professional Formatting**: Clean, formatted responses with technical accuracy
- **Persistent Chat History**: Conversations saved during your session

### 👤 User Authentication
- **Optional Authentication**: Use the platform without registration or create an account for enhanced features
- **Secure Data Storage**: Password hashing with bcrypt and secure session management
- **Personal Analysis History**: Save and review your past analyses (authenticated users only)
- **Cross-Device Sync**: Access your data from any device with your account

## Technology Stack

### Frontend
- **React 18** - Modern UI framework with hooks and functional components
- **TypeScript** - Type-safe development with enhanced IDE support
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework for responsive design
- **shadcn/ui** - High-quality component library built on Radix UI
- **TanStack Query** - Server state management and caching
- **Wouter** - Lightweight client-side routing
- **React Hook Form** - Efficient form handling with validation
- **Framer Motion** - Smooth animations and transitions

### Backend
- **Node.js** - Server-side JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **Google Gemini AI** - Advanced AI for image analysis and chat
- **PostgreSQL** - Robust relational database
- **Drizzle ORM** - Type-safe database queries and migrations
- **Passport.js** - Authentication middleware
- **Multer** - File upload handling
- **bcrypt** - Password hashing and security

### Development Tools
- **ESBuild** - Fast JavaScript bundler
- **Drizzle Kit** - Database migration and schema management
- **Cross-env** - Cross-platform environment variable management
- **tsx** - TypeScript execution for development

## Architecture

### Client-Server Separation
- **Frontend**: React SPA with Vite dev server
- **Backend**: Express.js API server with REST endpoints
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: Google Gemini AI for image analysis and chat

### Security Features
- **Password Hashing**: bcrypt for secure password storage
- **Session Management**: Express-session with PostgreSQL store
- **Input Validation**: Zod schemas for request validation
- **File Upload Security**: Multer with size and type restrictions
- **CORS Protection**: Configured for secure cross-origin requests

### Database Design
- **Users Table**: User authentication and profile data
- **Analyses Table**: Solar panel analysis results with user association
- **Chat Messages Table**: AI chat history with user and session tracking
- **Session Storage**: Secure session management with PostgreSQL backend

## Getting Started

### Prerequisites
- Node.js 18 or higher
- PostgreSQL database
- Google Gemini AI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd solarscope-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   DATABASE_URL=postgresql://username:password@host:port/database
   GOOGLE_API_KEY=your_google_gemini_api_key
   ```

4. **Database Setup**
   ```bash
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/user` - Get current user info

#### Analysis
- `POST /api/validate-image` - Validate image content
- `POST /api/analyze/installation` - Analyze rooftop for installation planning
- `POST /api/analyze/fault-detection` - Detect faults in solar panels
- `GET /api/analyses` - Get user's analysis history
- `GET /api/analyses/session` - Get session-based analyses

#### AI Chat
- `POST /api/ai/chat` - Send message to AI assistant
- `GET /api/chat/messages` - Get chat history
- `POST /api/chat/clear` - Clear chat history

#### System
- `GET /api/health` - System health check
- `POST /api/clear-users` - Clear user data (development only)

## Project Structure

```
solarscope-ai/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/           # Utilities and helpers
│   │   ├── hooks/         # Custom React hooks
│   │   └── pages/         # Page components
├── server/                 # Backend Express application
│   ├── ai-service.ts      # Google Gemini AI integration
│   ├── auth.ts            # Authentication setup
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database operations
│   └── index.ts           # Server entry point
├── shared/                 # Shared type definitions
│   └── schema.ts          # Database schema and types
├── package.json           # Project dependencies
├── drizzle.config.ts      # Database configuration
├── vite.config.ts         # Vite build configuration
└── tailwind.config.ts     # Tailwind CSS configuration
```

## Configuration

### Database Configuration
The application uses PostgreSQL with Drizzle ORM. Configure your database connection in the `.env` file:

```env
DATABASE_URL=postgresql://username:password@host:port/database
```

### AI Configuration
Get your Google Gemini API key from [Google AI Studio](https://aistudio.google.com/) and add it to your `.env` file:

```env
GOOGLE_API_KEY=your_api_key_here
```

### Development vs Production
- **Development**: Uses memory storage fallback if database is unavailable
- **Production**: Requires PostgreSQL database for data persistence


### 🚀 Deployment

You can deploy SolarScope AI easily using [Render](https://render.com) or any cloud platform that supports Node.js and PostgreSQL.
- **Build Command**: npm install && npm run build
- **Pre-Deploy Command**: npm run db:push
- **Start Command**: node start-production.js


## Performance Optimization

### Image Processing
- **Compression**: Automatic image compression (1200px max width, 80% quality)
- **Storage**: Efficient sessionStorage usage with cleanup routines
- **Caching**: React Query caching for API responses

### Database Optimization
- **Connection Pooling**: PostgreSQL connection pool management
- **Query Optimization**: Efficient Drizzle ORM queries
- **Session Management**: PostgreSQL session store for scalability

### AI Service Optimization
- **Rate Limiting**: Intelligent request throttling
- **Error Handling**: Robust error recovery and retry logic
- **Response Caching**: Strategic caching for repeated requests

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Check the documentation above
- Review the code comments for implementation details
- Ensure all environment variables are properly configured
- Verify your Google Gemini API key is valid and has sufficient quota

## Technical Details

### AI Integration
- **Google Gemini 2.0 Flash**: Latest AI model for image analysis
- **Content Validation**: AI-powered image classification
- **Structured Responses**: JSON-formatted AI responses for consistency

### Security Measures
- **Password Hashing**: bcrypt with salt rounds
- **Session Security**: Secure session cookies with PostgreSQL store
- **Input Validation**: Comprehensive request validation with Zod
- **File Upload Security**: Size limits and MIME type validation

### Performance Metrics
- **Build Time**: ~2 seconds for frontend, ~35ms for backend
- **Bundle Size**: Optimized with code splitting and tree shaking
- **API Response**: Average 2-4 seconds for AI analysis
- **Database**: Sub-100ms query response times

---

Built with ❤️ for the solar energy industry
