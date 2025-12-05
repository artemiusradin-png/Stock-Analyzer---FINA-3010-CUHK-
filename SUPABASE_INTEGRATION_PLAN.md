# Supabase Integration Plan

## Current Architecture Review

### Backend (FastAPI)
```
backend/app/
├── api/            # API endpoints (REST)
│   ├── ai_npv.py   # AI-powered NPV calculations
│   ├── assets.py   # Asset management
│   ├── portfolios.py # Portfolio optimization
│   ├── risk.py     # Risk analytics
│   ├── sentiment.py # Sentiment analysis
│   └── valuations.py # DCF valuations
├── models/         # SQLAlchemy ORM models
├── schemas/        # Pydantic schemas (validation)
├── services/       # Business logic
│   ├── ai_npv_service.py
│   ├── dcf_engine.py
│   ├── finnhub_service.py
│   ├── portfolio_optimizer.py
│   └── sentiment_engine.py
├── config.py       # Configuration
├── database.py     # PostgreSQL connection (SQLAlchemy)
└── main.py         # FastAPI app
```

### Frontend (Vanilla JavaScript)
```
frontend/public/
├── project-npv.html  # Main application
├── css/              # Styling
├── js/               # Business logic
│   ├── ai-npv-module.js
│   ├── api-client.js
│   ├── dcf-module.js
│   ├── npv-module.js
│   └── portfolio-module.js
└── assets/           # Static assets
```

### Current Database Stack
- **ORM**: SQLAlchemy
- **Database**: PostgreSQL (local)
- **Connection**: `postgresql://portfolio_user:portfolio_pass@localhost:5432/portfolio_db`
- **Models**: Asset, Portfolio, Valuation, Sentiment

---

## Supabase Integration Options

### ✅ Option 1: Full Supabase Stack (Recommended)
**Replace PostgreSQL + Add Auth + Storage + Realtime**

#### Benefits
- **Managed PostgreSQL**: No infrastructure management
- **Built-in Auth**: User authentication & authorization
- **Storage**: File uploads (PDF exports, Excel files)
- **Realtime**: Live portfolio updates
- **Row Level Security (RLS)**: Data security per user
- **Auto-generated REST API**: Direct database access from frontend
- **Edge Functions**: Optional serverless functions

#### Implementation Steps

**1. Create Supabase Project**
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Create new project
supabase init

# Link to Supabase Cloud project
supabase link --project-ref your-project-ref
```

**2. Update Backend Configuration**
```python
# backend/app/config.py

class Settings(BaseSettings):
    # Supabase Configuration
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_KEY: str = ""  # Service role key (backend only)
    SUPABASE_ANON_KEY: str = ""  # Anonymous key (frontend)
    
    # Database - Supabase PostgreSQL
    DATABASE_URL: str = "postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres"
    
    # Keep existing API keys
    FINNHUB_API_KEY: str = "..."
    OPENAI_API_KEY: str = "..."
    # ... rest of config
```

**3. Install Supabase Python Client**
```bash
cd backend
pip install supabase
```

Add to `requirements.txt`:
```
supabase==2.0.0
```

**4. Create Supabase Service**
```python
# backend/app/services/supabase_service.py

from supabase import create_client, Client
from app.config import settings

class SupabaseService:
    """Supabase client wrapper"""
    
    def __init__(self):
        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )
    
    # Auth methods
    def sign_up(self, email: str, password: str):
        return self.client.auth.sign_up({
            "email": email,
            "password": password
        })
    
    def sign_in(self, email: str, password: str):
        return self.client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
    
    # Storage methods
    def upload_file(self, bucket: str, path: str, file):
        return self.client.storage.from_(bucket).upload(path, file)
    
    def get_file_url(self, bucket: str, path: str):
        return self.client.storage.from_(bucket).get_public_url(path)
    
    # Realtime subscription
    def subscribe_to_portfolio(self, portfolio_id: str, callback):
        return self.client.table('portfolios').on('*', callback).filter('id', 'eq', portfolio_id).subscribe()
```

**5. Update Database Models (Keep SQLAlchemy + Add RLS)**

Create migration for user-specific data:
```sql
-- migrations/001_add_user_id.sql

-- Add user_id to all tables
ALTER TABLE portfolios ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE assets ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE valuations ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Enable Row Level Security
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;

-- Create policies (users can only see their own data)
CREATE POLICY "Users can view own portfolios" 
    ON portfolios FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolios" 
    ON portfolios FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios" 
    ON portfolios FOR UPDATE 
    USING (auth.uid() = user_id);
```

**6. Update Frontend (Add Supabase Client)**

Create Supabase client:
```javascript
// frontend/public/js/supabase-client.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    })
    return { data, error }
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
    return { data, error }
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
}

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

// Storage helpers
export async function uploadPDF(file, filename) {
    const { data, error } = await supabase.storage
        .from('exports')
        .upload(`pdfs/${filename}`, file)
    return { data, error }
}

// Realtime subscription
export function subscribeToPortfolio(portfolioId, callback) {
    return supabase
        .channel(`portfolio:${portfolioId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'portfolios',
            filter: `id=eq.${portfolioId}`
        }, callback)
        .subscribe()
}
```

**7. Add Authentication UI**

Create login/signup modal:
```html
<!-- frontend/public/project-npv.html -->

<!-- Auth Modal -->
<div id="auth-modal" class="modal" style="display: none;">
    <div class="modal-content">
        <h2>Sign In</h2>
        <form id="auth-form">
            <input type="email" id="auth-email" placeholder="Email" required>
            <input type="password" id="auth-password" placeholder="Password" required>
            <button type="submit">Sign In</button>
            <button type="button" onclick="switchToSignUp()">Create Account</button>
        </form>
    </div>
</div>

<!-- User Menu -->
<div class="user-menu">
    <span id="user-email"></span>
    <button onclick="signOut()">Sign Out</button>
</div>
```

```javascript
// frontend/public/js/auth-module.js

import { supabase, signIn, signUp, signOut, getSession } from './supabase-client.js'

async function initAuth() {
    const session = await getSession()
    
    if (session) {
        // User is logged in
        showUserMenu(session.user.email)
        loadUserData()
    } else {
        // Show auth modal
        showAuthModal()
    }
}

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        hideAuthModal()
        showUserMenu(session.user.email)
        loadUserData()
    } else if (event === 'SIGNED_OUT') {
        showAuthModal()
        clearUserData()
    }
})
```

---

### ✅ Option 2: Hybrid Approach (Keep FastAPI Backend)
**Use Supabase for Auth + Storage only, keep FastAPI for business logic**

#### When to use
- You want to keep existing FastAPI backend intact
- Need complex business logic (DCF, NPV calculations)
- Want centralized API for external services (Finnhub, OpenAI)

#### Implementation
```javascript
// Frontend uses Supabase Auth
const session = await supabase.auth.getSession()

// Pass auth token to FastAPI
const response = await fetch('http://localhost:8000/api/portfolios', {
    headers: {
        'Authorization': `Bearer ${session.access_token}`
    }
})
```

```python
# Backend validates Supabase JWT
from fastapi import Depends, HTTPException
from jose import jwt, JWTError

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        # Verify Supabase JWT
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=['HS256']
        )
        user_id = payload.get('sub')
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

### ✅ Option 3: Minimal Integration (Database Only)
**Replace local PostgreSQL with Supabase PostgreSQL**

#### Implementation
1. Create Supabase project
2. Update `DATABASE_URL` in config
3. Run SQLAlchemy migrations
4. No code changes needed!

```python
# backend/app/config.py
DATABASE_URL: str = "postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres"
```

---

## Feature Comparison

| Feature | Current | With Supabase |
|---------|---------|---------------|
| **Database** | Local PostgreSQL | Managed PostgreSQL |
| **Authentication** | ❌ None | ✅ Built-in |
| **User Management** | ❌ None | ✅ Email/OAuth/Magic Links |
| **File Storage** | ❌ None | ✅ S3-compatible storage |
| **Realtime Updates** | ❌ None | ✅ WebSocket subscriptions |
| **Row Level Security** | ❌ Manual | ✅ Built-in RLS |
| **API Generation** | FastAPI only | FastAPI + Auto-generated REST |
| **Edge Functions** | ❌ None | ✅ Serverless functions |
| **Backups** | Manual | Automatic |
| **Scaling** | Manual | Automatic |

---

## Migration Checklist

### Phase 1: Setup (1-2 hours)
- [ ] Create Supabase account
- [ ] Create new project
- [ ] Install Supabase CLI
- [ ] Update `requirements.txt`

### Phase 2: Database Migration (2-3 hours)
- [ ] Export current PostgreSQL data
- [ ] Update `DATABASE_URL` in config
- [ ] Run SQLAlchemy migrations on Supabase
- [ ] Import data to Supabase
- [ ] Test database connection

### Phase 3: Authentication (3-4 hours)
- [ ] Add `user_id` columns to tables
- [ ] Enable Row Level Security
- [ ] Create RLS policies
- [ ] Add Supabase client to frontend
- [ ] Build login/signup UI
- [ ] Update API endpoints to check auth

### Phase 4: Storage (2-3 hours)
- [ ] Create storage bucket for exports
- [ ] Update PDF export to use Supabase Storage
- [ ] Update Excel export to use Supabase Storage
- [ ] Add file management UI

### Phase 5: Realtime (2-3 hours)
- [ ] Add realtime subscriptions for portfolios
- [ ] Update portfolio UI to show live changes
- [ ] Add optimistic updates

### Phase 6: Testing & Deployment (2-3 hours)
- [ ] Test all features
- [ ] Update environment variables
- [ ] Deploy backend
- [ ] Deploy frontend

**Total Time: 12-18 hours**

---

## Cost Estimate

### Supabase Pricing
- **Free Tier**: 
  - 500MB database
  - 1GB file storage
  - 2GB bandwidth
  - 50,000 monthly active users
  - Good for development & testing

- **Pro Tier ($25/month)**:
  - 8GB database
  - 100GB file storage
  - 250GB bandwidth
  - 100,000 monthly active users
  - Daily backups

### Recommendation
Start with **Free Tier** during development, upgrade to **Pro** when launching.

---

## Next Steps

1. **Review this plan** - Let me know which option you prefer
2. **Create Supabase project** - I can guide you through setup
3. **Start with Phase 1** - Basic integration
4. **Iterative migration** - Implement feature by feature

Would you like me to:
1. Create a Supabase project configuration?
2. Start implementing Option 1 (Full Stack)?
3. Write the authentication module?
4. Set up the database migration?

