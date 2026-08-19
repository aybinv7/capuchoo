\# 📚 THE ULTIMATE JAWBLI MVP BUILD PROMPT - PRECISION ARCHITECTURE

```markdown
\# JAWBLI - AI CHATBOT FOR ALGERIAN E-COMMERCE

\## COMPREHENSIVE BUILD SPECIFICATION v1.0

You are tasked with building Jawbli, a Darija-speaking AI chatbot platform that helps Algerian e-commerce businesses automate customer service and order management on WhatsApp. This is a production-grade MVP designed for immediate deployment and future scaling.

---

\## 🎯 PROJECT OVERVIEW

\*\*Business Context:\*\*

\- Target Market: Algerian e-commerce merchants (small to medium businesses)

\- Primary Channel: WhatsApp Business API (expandable to FB/IG/Telegram later)

\- Core Value: Automate customer inquiries, order taking, and confirmation in Darija

\- Revenue Model: SaaS ($50-200/month per merchant based on message volume)

\*\*Technical Philosophy:\*\*

\- Monolithic MVP for speed (microservices-ready architecture)

\- Type-safe throughout (TypeScript everywhere possible)

\- Event-driven design for future queue integration

\- Modular business logic (easy to extract to microservices)

\- API-first design (REST now, GraphQL-ready structure)

---

\## 🏗️ ARCHITECTURE OVERVIEW
```

jawbli/

├── backend/ # Node.js + Express + TypeScript

│ ├── src/

│ │ ├── api/ # HTTP Controllers (thin layer)

│ │ ├── core/ # Business Logic (thick, reusable)

│ │ ├── services/ # External integrations

│ │ ├── models/ # Data models + validation

│ │ ├── utils/ # Helpers

│ │ └── workers/ # Background jobs (future queue)

│ └── tests/

├── frontend/ # Vue 3 + TypeScript + Vite

│ ├── src/

│ │ ├── views/ # Page components

│ │ ├── components/ # Reusable UI components

│ │ ├── composables/ # Vue composition functions

│ │ ├── stores/ # Pinia state management

│ │ ├── services/ # API client

│ │ └── types/ # TypeScript interfaces

│ └── tests/

├── shared/ # Shared TypeScript types

│ └── types/

├── scripts/ # Setup and deployment scripts

└── docs/ # Documentation

````



---



\## 💻 TECHNOLOGY STACK



\### \*\*Backend Stack:\*\*

```json

{

&nbsp; "runtime": "Node.js 20+",

&nbsp; "framework": "Express.js 4.18+",

&nbsp; "language": "TypeScript 5.3+",

&nbsp; "database": "Supabase (PostgreSQL)",

&nbsp; "auth": "Supabase Auth",

&nbsp; "storage": "Supabase Storage (for CSV uploads)",

&nbsp; "validation": "Zod 3.22+",

&nbsp; "AI": "OpenAI GPT-4o-mini",

&nbsp; "embeddings": "OpenAI text-embedding-3-small",

&nbsp; "vector\_db": "Supabase pgvector extension",

&nbsp; "whatsapp": "whatsapp-web.js (open-source) OR Meta Business API",

&nbsp; "csv\_parsing": "papaparse + xlsx",

&nbsp; "queue": "In-memory initially (Bull-ready structure)",

&nbsp; "logging": "winston + morgan",

&nbsp; "monitoring": "Sentry (optional)"

}

````

\### \*\*Frontend Stack:\*\*

```json

{

&nbsp; "framework": "Vue 3.4+ (Composition API + <script setup>)",

&nbsp; "language": "TypeScript 5.3+",

&nbsp; "build\_tool": "Vite 5+",

&nbsp; "ui\_framework": "Tailwind CSS 3.4+",

&nbsp; "components": "Shadcn-vue (headless UI components)",

&nbsp; "icons": "lucide-vue-next",

&nbsp; "state": "Pinia 2.1+",

&nbsp; "routing": "Vue Router 4",

&nbsp; "forms": "VeeValidate + Zod",

&nbsp; "http": "Axios with interceptors",

&nbsp; "charts": "Chart.js or Recharts",

&nbsp; "date": "date-fns"

}

```

---

\## 📊 DATABASE SCHEMA (Supabase PostgreSQL)

\### \*\*Core Tables:\*\*

```sql

-- Enable UUID extension

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";



-- Enable vector extension for embeddings

CREATE EXTENSION IF NOT EXISTS vector;



-- ============================================

-- MERCHANTS TABLE

-- ============================================

CREATE TABLE merchants (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

&nbsp;   business\_name VARCHAR(255) NOT NULL,

&nbsp;   business\_name\_ar VARCHAR(255), -- Arabic name

&nbsp;   phone\_number VARCHAR(20) UNIQUE NOT NULL,

&nbsp;   whatsapp\_number VARCHAR(20) UNIQUE NOT NULL,

&nbsp;   subscription\_tier VARCHAR(50) DEFAULT 'free', -- free, starter, pro

&nbsp;   subscription\_status VARCHAR(50) DEFAULT 'trial', -- trial, active, suspended

&nbsp;   message\_quota INTEGER DEFAULT 100,

&nbsp;   message\_used INTEGER DEFAULT 0,

&nbsp;   bot\_name VARCHAR(100) DEFAULT 'مساعد المتجر',

&nbsp;   bot\_personality JSONB DEFAULT '{"tone": "friendly", "language\_mix": {"darija": 80, "french": 10, "arabic": 10}}',

&nbsp;   business\_hours JSONB DEFAULT '{"enabled": false, "schedule": {}}',

&nbsp;   auto\_responses JSONB DEFAULT '{}',

&nbsp;   webhook\_secret VARCHAR(255),

&nbsp;   whatsapp\_session\_data TEXT, -- For whatsapp-web.js QR session

&nbsp;   whatsapp\_connected BOOLEAN DEFAULT false,

&nbsp;   created\_at TIMESTAMP DEFAULT NOW(),

&nbsp;   updated\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_merchants\_user\_id ON merchants(user\_id);

CREATE INDEX idx\_merchants\_phone ON merchants(phone\_number);



-- ============================================

-- PRODUCTS TABLE

-- ============================================

CREATE TABLE products (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   merchant\_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

&nbsp;   sku VARCHAR(100),

&nbsp;   name VARCHAR(255) NOT NULL,

&nbsp;   name\_ar VARCHAR(255),

&nbsp;   description TEXT,

&nbsp;   description\_ar TEXT,

&nbsp;   price DECIMAL(10, 2) NOT NULL,

&nbsp;   compare\_at\_price DECIMAL(10, 2), -- For discounts

&nbsp;   currency VARCHAR(3) DEFAULT 'DZD',

&nbsp;   stock\_quantity INTEGER DEFAULT 0,

&nbsp;   is\_available BOOLEAN DEFAULT true,

&nbsp;   category VARCHAR(100),

&nbsp;   image\_url TEXT,

&nbsp;   metadata JSONB DEFAULT '{}', -- size, color, etc.

&nbsp;   embedding vector(1536), -- OpenAI embeddings for semantic search

&nbsp;   created\_at TIMESTAMP DEFAULT NOW(),

&nbsp;   updated\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_products\_merchant ON products(merchant\_id);

CREATE INDEX idx\_products\_category ON products(category);

CREATE INDEX idx\_products\_available ON products(is\_available);

-- Vector similarity search index

CREATE INDEX idx\_products\_embedding ON products USING ivfflat (embedding vector\_cosine\_ops);



-- ============================================

-- DELIVERY ZONES TABLE

-- ============================================

CREATE TABLE delivery\_zones (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   merchant\_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

&nbsp;   wilaya\_code VARCHAR(2) NOT NULL, -- 01-58 for Algeria

&nbsp;   wilaya\_name VARCHAR(100) NOT NULL,

&nbsp;   wilaya\_name\_ar VARCHAR(100),

&nbsp;   delivery\_price DECIMAL(10, 2) NOT NULL,

&nbsp;   delivery\_time VARCHAR(50), -- "2-3 days"

&nbsp;   is\_available BOOLEAN DEFAULT true,

&nbsp;   created\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_delivery\_zones\_merchant ON delivery\_zones(merchant\_id);

CREATE UNIQUE INDEX idx\_delivery\_zones\_unique ON delivery\_zones(merchant\_id, wilaya\_code);



-- ============================================

-- CUSTOMERS TABLE

-- ============================================

CREATE TABLE customers (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   merchant\_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

&nbsp;   phone\_number VARCHAR(20) NOT NULL,

&nbsp;   name VARCHAR(255),

&nbsp;   wilaya VARCHAR(100),

&nbsp;   address TEXT,

&nbsp;   notes TEXT,

&nbsp;   total\_orders INTEGER DEFAULT 0,

&nbsp;   total\_spent DECIMAL(10, 2) DEFAULT 0,

&nbsp;   last\_interaction TIMESTAMP,

&nbsp;   created\_at TIMESTAMP DEFAULT NOW(),

&nbsp;   updated\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_customers\_merchant ON customers(merchant\_id);

CREATE UNIQUE INDEX idx\_customers\_unique ON customers(merchant\_id, phone\_number);



-- ============================================

-- CONVERSATIONS TABLE

-- ============================================

CREATE TABLE conversations (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   merchant\_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

&nbsp;   customer\_id UUID REFERENCES customers(id) ON DELETE CASCADE,

&nbsp;   channel VARCHAR(20) DEFAULT 'whatsapp', -- whatsapp, facebook, instagram, telegram

&nbsp;   status VARCHAR(50) DEFAULT 'active', -- active, resolved, abandoned

&nbsp;   context JSONB DEFAULT '{}', -- Current cart, user intent, etc.

&nbsp;   last\_message\_at TIMESTAMP DEFAULT NOW(),

&nbsp;   created\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_conversations\_merchant ON conversations(merchant\_id);

CREATE INDEX idx\_conversations\_customer ON conversations(customer\_id);

CREATE INDEX idx\_conversations\_status ON conversations(status);



-- ============================================

-- MESSAGES TABLE

-- ============================================

CREATE TABLE messages (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   conversation\_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

&nbsp;   sender\_type VARCHAR(20) NOT NULL, -- customer, bot, agent

&nbsp;   content TEXT NOT NULL,

&nbsp;   metadata JSONB DEFAULT '{}', -- Media URLs, button clicks, etc.

&nbsp;   ai\_context JSONB, -- Prompt, model used, tokens

&nbsp;   created\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_messages\_conversation ON messages(conversation\_id);

CREATE INDEX idx\_messages\_created ON messages(created\_at DESC);



-- ============================================

-- ORDERS TABLE

-- ============================================

CREATE TABLE orders (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   order\_number VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated: ORD-20250102-001

&nbsp;   merchant\_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

&nbsp;   customer\_id UUID REFERENCES customers(id) ON DELETE SET NULL,

&nbsp;   conversation\_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

&nbsp;

&nbsp;   -- Customer info (denormalized for export)

&nbsp;   customer\_name VARCHAR(255) NOT NULL,

&nbsp;   customer\_phone VARCHAR(20) NOT NULL,

&nbsp;   customer\_wilaya VARCHAR(100) NOT NULL,

&nbsp;   customer\_address TEXT NOT NULL,

&nbsp;

&nbsp;   -- Order details

&nbsp;   items JSONB NOT NULL, -- \[{ product\_id, name, price, quantity }]

&nbsp;   subtotal DECIMAL(10, 2) NOT NULL,

&nbsp;   delivery\_price DECIMAL(10, 2) NOT NULL,

&nbsp;   total DECIMAL(10, 2) NOT NULL,

&nbsp;

&nbsp;   -- Status tracking

&nbsp;   status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, shipped, delivered, cancelled

&nbsp;   payment\_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid

&nbsp;   payment\_method VARCHAR(50), -- cash\_on\_delivery, cib, baridimob

&nbsp;

&nbsp;   -- Tracking

&nbsp;   tracking\_number VARCHAR(100),

&nbsp;   notes TEXT,

&nbsp;   confirmed\_at TIMESTAMP,

&nbsp;   shipped\_at TIMESTAMP,

&nbsp;   delivered\_at TIMESTAMP,

&nbsp;

&nbsp;   created\_at TIMESTAMP DEFAULT NOW(),

&nbsp;   updated\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_orders\_merchant ON orders(merchant\_id);

CREATE INDEX idx\_orders\_customer ON orders(customer\_id);

CREATE INDEX idx\_orders\_status ON orders(status);

CREATE INDEX idx\_orders\_number ON orders(order\_number);

CREATE INDEX idx\_orders\_created ON orders(created\_at DESC);



-- ============================================

-- FAQ TABLE (Knowledge Base)

-- ============================================

CREATE TABLE faqs (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   merchant\_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

&nbsp;   question TEXT NOT NULL,

&nbsp;   question\_ar TEXT,

&nbsp;   answer TEXT NOT NULL,

&nbsp;   answer\_ar TEXT,

&nbsp;   category VARCHAR(100),

&nbsp;   embedding vector(1536),

&nbsp;   usage\_count INTEGER DEFAULT 0,

&nbsp;   is\_active BOOLEAN DEFAULT true,

&nbsp;   created\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_faqs\_merchant ON faqs(merchant\_id);

CREATE INDEX idx\_faqs\_embedding ON faqs USING ivfflat (embedding vector\_cosine\_ops);



-- ============================================

-- ANALYTICS TABLE (Events tracking)

-- ============================================

CREATE TABLE analytics\_events (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   merchant\_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

&nbsp;   event\_type VARCHAR(50) NOT NULL, -- message\_received, order\_created, etc.

&nbsp;   event\_data JSONB,

&nbsp;   created\_at TIMESTAMP DEFAULT NOW()

);



CREATE INDEX idx\_analytics\_merchant ON analytics\_events(merchant\_id);

CREATE INDEX idx\_analytics\_type ON analytics\_events(event\_type);

CREATE INDEX idx\_analytics\_created ON analytics\_events(created\_at DESC);



-- ============================================

-- TRIGGERS FOR UPDATED\_AT

-- ============================================

CREATE OR REPLACE FUNCTION update\_updated\_at\_column()

RETURNS TRIGGER AS $$

BEGIN

&nbsp;   NEW.updated\_at = NOW();

&nbsp;   RETURN NEW;

END;

$$ language 'plpgsql';



CREATE TRIGGER update\_merchants\_updated\_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION update\_updated\_at\_column();

CREATE TRIGGER update\_products\_updated\_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update\_updated\_at\_column();

CREATE TRIGGER update\_customers\_updated\_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update\_updated\_at\_column();

CREATE TRIGGER update\_orders\_updated\_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update\_updated\_at\_column();



-- ============================================

-- ROW LEVEL SECURITY (RLS) - Critical for multi-tenancy

-- ============================================

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

ALTER TABLE delivery\_zones ENABLE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

ALTER TABLE analytics\_events ENABLE ROW LEVEL SECURITY;



-- Merchants can only see their own data

CREATE POLICY merchants\_own\_data ON merchants FOR ALL USING (user\_id = auth.uid());

CREATE POLICY products\_own\_data ON products FOR ALL USING (merchant\_id IN (SELECT id FROM merchants WHERE user\_id = auth.uid()));

CREATE POLICY delivery\_zones\_own\_data ON delivery\_zones FOR ALL USING (merchant\_id IN (SELECT id FROM merchants WHERE user\_id = auth.uid()));

CREATE POLICY customers\_own\_data ON customers FOR ALL USING (merchant\_id IN (SELECT id FROM merchants WHERE user\_id = auth.uid()));

CREATE POLICY conversations\_own\_data ON conversations FOR ALL USING (merchant\_id IN (SELECT id FROM merchants WHERE user\_id = auth.uid()));

CREATE POLICY messages\_own\_data ON messages FOR ALL USING (conversation\_id IN (SELECT id FROM conversations WHERE merchant\_id IN (SELECT id FROM merchants WHERE user\_id = auth.uid())));

CREATE POLICY orders\_own\_data ON orders FOR ALL USING (merchant\_id IN (SELECT id FROM merchants WHERE user\_id = auth.uid()));

CREATE POLICY faqs\_own\_data ON faqs FOR ALL USING (merchant\_id IN (SELECT id FROM merchants WHERE user\_id = auth.uid()));

CREATE POLICY analytics\_own\_data ON analytics\_events FOR ALL USING (merchant\_id IN (SELECT id FROM merchants WHERE user\_id = auth.uid()));

```

---

\## 🎯 BACKEND STRUCTURE (DETAILED)

\### \*\*Folder Structure:\*\*

```

backend/

├── src/

│   ├── index.ts                    # App entry point

│   ├── config/

│   │   ├── environment.ts          # Environment variables validation

│   │   ├── supabase.ts             # Supabase client

│   │   └── openai.ts               # OpenAI client

│   │

│   ├── api/                        # HTTP Layer (Controllers)

│   │   ├── middleware/

│   │   │   ├── auth.middleware.ts

│   │   │   ├── error.middleware.ts

│   │   │   ├── validation.middleware.ts

│   │   │   └── rateLimit.middleware.ts

│   │   ├── routes/

│   │   │   ├── auth.routes.ts

│   │   │   ├── merchants.routes.ts

│   │   │   ├── products.routes.ts

│   │   │   ├── orders.routes.ts

│   │   │   ├── conversations.routes.ts

│   │   │   ├── webhooks.routes.ts

│   │   │   └── analytics.routes.ts

│   │   └── controllers/

│   │       ├── auth.controller.ts

│   │       ├── merchants.controller.ts

│   │       ├── products.controller.ts

│   │       ├── orders.controller.ts

│   │       ├── conversations.controller.ts

│   │       └── webhooks.controller.ts

│   │

│   ├── core/                       # Business Logic (Framework-agnostic)

│   │   ├── merchant/

│   │   │   ├── merchant.service.ts

│   │   │   ├── merchant.repository.ts

│   │   │   └── merchant.types.ts

│   │   ├── product/

│   │   │   ├── product.service.ts

│   │   │   ├── product.repository.ts

│   │   │   ├── product.embedding.ts  # Vector embeddings

│   │   │   └── product.types.ts

│   │   ├── order/

│   │   │   ├── order.service.ts

│   │   │   ├── order.repository.ts

│   │   │   ├── order.export.ts       # CSV/Sheet export

│   │   │   └── order.types.ts

│   │   ├── conversation/

│   │   │   ├── conversation.service.ts

│   │   │   ├── conversation.repository.ts

│   │   │   ├── conversation.context.ts  # Context management

│   │   │   └── conversation.types.ts

│   │   └── ai/

│   │       ├── ai.orchestrator.ts    # Main AI logic

│   │       ├── prompt.builder.ts     # Dynamic prompt construction

│   │       ├── intent.detector.ts    # User intent classification

│   │       ├── entity.extractor.ts   # Extract order details

│   │       ├── vector.search.ts      # Semantic product search

│   │       └── ai.types.ts

│   │

│   ├── services/                   # External Services Integration

│   │   ├── whatsapp/

│   │   │   ├── whatsapp.service.ts   # Abstract interface

│   │   │   ├── whatsappWeb.provider.ts  # whatsapp-web.js implementation

│   │   │   ├── metaApi.provider.ts   # Meta Business API (future)

│   │   │   └── whatsapp.types.ts

│   │   ├── openai/

│   │   │   ├── chat.service.ts

│   │   │   ├── embedding.service.ts

│   │   │   └── openai.types.ts

│   │   ├── storage/

│   │   │   ├── storage.service.ts

│   │   │   └── csv.parser.ts

│   │   └── notification/

│   │       └── notification.service.ts  # Future: Email, SMS

│   │

│   ├── workers/                    # Background Jobs (Queue-ready)

│   │   ├── messageProcessor.worker.ts

│   │   ├── orderExport.worker.ts

│   │   └── analytics.worker.ts

│   │

│   ├── utils/

│   │   ├── logger.ts

│   │   ├── errors.ts

│   │   ├── validation.ts

│   │   ├── formatting.ts           # Price, date formatting (Algerian style)

│   │   └── helpers.ts

│   │

│   └── types/

│       ├── express.d.ts            # Express type extensions

│       └── global.d.ts

│

├── tests/

│   ├── unit/

│   ├── integration/

│   └── e2e/

│

├── .env.example

├── .env.development

├── package.json

├── tsconfig.json

└── nodemon.json

```

\### \*\*Key Backend Files (MUST IMPLEMENT):\*\*

\#### \*\*1. src/index.ts (Entry Point)\*\*

```typescript

import express, { Application } from 'express';

import cors from 'cors';

import helmet from 'helmet';

import morgan from 'morgan';

import { config } from './config/environment';

import { errorMiddleware } from './api/middleware/error.middleware';

import { logger } from './utils/logger';



// Import routes

import authRoutes from './api/routes/auth.routes';

import merchantRoutes from './api/routes/merchants.routes';

import productRoutes from './api/routes/products.routes';

import orderRoutes from './api/routes/orders.routes';

import conversationRoutes from './api/routes/conversations.routes';

import webhookRoutes from './api/routes/webhooks.routes';



const app: Application = express();



// Security \& Parsing

app.use(helmet());

app.use(cors({ origin: config.FRONTEND\_URL, credentials: true }));

app.use(express.json({ limit: '10mb' }));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));



// Health check

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));



// API Routes

app.use('/api/auth', authRoutes);

app.use('/api/merchants', merchantRoutes);

app.use('/api/products', productRoutes);

app.use('/api/orders', orderRoutes);

app.use('/api/conversations', conversationRoutes);

app.use('/api/webhooks', webhookRoutes);



// Error handling (must be last)

app.use(errorMiddleware);



// Start server

const PORT = config.PORT || 3000;

app.listen(PORT, () => {

&nbsp; logger.info(`🚀 Jawbli Backend running on port ${PORT}`);

&nbsp; logger.info(`📱 Environment: ${config.NODE\_ENV}`);

});



export default app;

```

\#### \*\*2. src/config/environment.ts (Env Validation)\*\*

```typescript

import { z } from 'zod';

import dotenv from 'dotenv';



dotenv.config();



const envSchema = z.object({

&nbsp; NODE\_ENV: z.enum(\['development', 'production', 'test']).default('development'),

&nbsp; PORT: z.string().transform(Number).default('3000'),

&nbsp; FRONTEND\_URL: z.string().url(),

&nbsp;

&nbsp; // Supabase

&nbsp; SUPABASE\_URL: z.string().url(),

&nbsp; SUPABASE\_ANON\_KEY: z.string(),

&nbsp; SUPABASE\_SERVICE\_ROLE\_KEY: z.string(),

&nbsp;

&nbsp; // OpenAI

&nbsp; OPENAI\_API\_KEY: z.string(),

&nbsp; OPENAI\_MODEL: z.string().default('gpt-4o-mini'),

&nbsp; OPENAI\_EMBEDDING\_MODEL: z.string().default('text-embedding-3-small'),

&nbsp;

&nbsp; // WhatsApp (optional for MVP)

&nbsp; WHATSAPP\_BUSINESS\_PHONE\_ID: z.string().optional(),

&nbsp; WHATSAPP\_ACCESS\_TOKEN: z.string().optional(),

&nbsp; WHATSAPP\_WEBHOOK\_VERIFY\_TOKEN: z.string().optional(),

&nbsp;

&nbsp; // Security

&nbsp; JWT\_SECRET: z.string().optional(), // If not using Supabase Auth

&nbsp; WEBHOOK\_SECRET: z.string().default('change-me-in-production'),

});



export const config = envSchema.parse(process.env);

```

\#### \*\*3. src/core/ai/ai.orchestrator.ts (CRITICAL - AI Brain)\*\*

```typescript

import { OpenAI } from 'openai';

import { config } from '../../config/environment';

import { PromptBuilder } from './prompt.builder';

import { IntentDetector } from './intent.detector';

import { EntityExtractor } from './entity.extractor';

import { VectorSearch } from './vector.search';

import { ConversationRepository } from '../conversation/conversation.repository';

import { MerchantRepository } from '../merchant/merchant.repository';

import { logger } from '../../utils/logger';



export interface AIResponse {

&nbsp; message: string;

&nbsp; intent: 'greeting' | 'product\_inquiry' | 'order\_taking' | 'order\_confirm' | 'complaint' | 'general';

&nbsp; entities?: {

&nbsp;   products?: string\[];

&nbsp;   quantity?: number;

&nbsp;   wilaya?: string;

&nbsp;   phone?: string;

&nbsp;   address?: string;

&nbsp; };

&nbsp; suggestedActions?: string\[];

&nbsp; confidence: number;

}



export class AIOrchestrator {

&nbsp; private openai: OpenAI;

&nbsp; private promptBuilder: PromptBuilder;

&nbsp; private intentDetector: IntentDetector;

&nbsp; private entityExtractor: EntityExtractor;

&nbsp; private vectorSearch: VectorSearch;

&nbsp; private conversationRepo: ConversationRepository;

&nbsp; private merchantRepo: MerchantRepository;



&nbsp; constructor() {

&nbsp;   this.openai = new OpenAI({ apiKey: config.OPENAI\_API\_KEY });

&nbsp;   this.promptBuilder = new PromptBuilder();

&nbsp;   this.intentDetector = new IntentDetector(this.openai);

&nbsp;   this.entityExtractor = new EntityExtractor();

&nbsp;   this.vectorSearch = new VectorSearch();

&nbsp;   this.conversationRepo = new ConversationRepository();

&nbsp;   this.merchantRepo = new MerchantRepository();

&nbsp; }



&nbsp; async processMessage(params: {

&nbsp;   merchantId: string;

&nbsp;   customerId: string;

&nbsp;   conversationId: string;

&nbsp;   message: string;

&nbsp; }): Promise<AIResponse> {

&nbsp;   try {

&nbsp;     const { merchantId, conversationId, message } = params;



&nbsp;     // 1. Get merchant settings and context

&nbsp;     const merchant = await this.merchantRepo.findById(merchantId);

&nbsp;     if (!merchant) throw new Error('Merchant not found');



&nbsp;     // 2. Get conversation history (last 5 messages)

&nbsp;     const history = await this.conversationRepo.getMessages(conversationId, 5);



&nbsp;     // 3. Get conversation context (cart, user state, etc.)

&nbsp;     const context = await this.conversationRepo.getContext(conversationId);



&nbsp;     // 4. Detect intent

&nbsp;     const intent = await this.intentDetector.detect(message, history);



&nbsp;     // 5. Semantic search for relevant products/FAQs

&nbsp;     const relevantProducts = await this.vectorSearch.searchProducts(

&nbsp;       merchantId,

&nbsp;       message,

&nbsp;       3 // top 3 results

&nbsp;     );



&nbsp;     const relevantFAQs = await this.vectorSearch.searchFAQs(

&nbsp;       merchantId,

&nbsp;       message,

&nbsp;       2 // top 2 results

&nbsp;     );



&nbsp;     // 6. Build dynamic prompt

&nbsp;     const prompt = this.promptBuilder.build({

&nbsp;       merchant,

&nbsp;       message,

&nbsp;       intent,

&nbsp;       history,

&nbsp;       context,

&nbsp;       relevantProducts,

&nbsp;       relevantFAQs,

&nbsp;     });



&nbsp;     // 7. Generate AI response

&nbsp;     const completion = await this.openai.chat.completions.create({

&nbsp;       model: config.OPENAI\_MODEL,

&nbsp;       messages: prompt,

&nbsp;       temperature: 0.7,

&nbsp;       max\_tokens: 300,

&nbsp;     });



&nbsp;     const aiMessage = completion.choices\[0]?.message?.content || 'معذرة، ما فهمتش. ممكن تعاود؟';



&nbsp;     // 8. Extract entities if order-related

&nbsp;     let entities = undefined;

&nbsp;     if (intent === 'order\_taking' || intent === 'order\_confirm') {

&nbsp;       entities = await this.entityExtractor.extract(message, context);

&nbsp;     }



&nbsp;     // 9. Log for analytics

&nbsp;     logger.info(`AI Response generated for conversation ${conversationId}`, {

&nbsp;       intent,

&nbsp;       tokens: completion.usage?.total\_tokens,

&nbsp;     });



&nbsp;     return {

&nbsp;       message: aiMessage,

&nbsp;       intent,

&nbsp;       entities,

&nbsp;       confidence: 0.85, // Can implement confidence scoring

&nbsp;     };

&nbsp;   } catch (error) {

&nbsp;     logger.error('AI Orchestrator Error:', error);

&nbsp;     throw error;

&nbsp;   }

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Generate embeddings for text (products, FAQs)

&nbsp;  \*/

&nbsp; async generateEmbedding(text: string): Promise<number\[]> {

&nbsp;   try {

&nbsp;     const response = await this.openai.embeddings.create({

&nbsp;       model: config.OPENAI\_EMBEDDING\_MODEL,

&nbsp;       input: text,

&nbsp;     });

&nbsp;     return response.data\[0].embedding;

&nbsp;   } catch (error) {

&nbsp;     logger.error('Embedding generation error:', error);

&nbsp;     throw error;

&nbsp;   }

&nbsp; }

}

```

\#### \*\*4. src/core/ai/prompt.builder.ts (Darija Prompts)\*\*

```typescript

import { ChatCompletionMessageParam } from 'openai/resources/chat';



export class PromptBuilder {

&nbsp; build(params: {

&nbsp;   merchant: any;

&nbsp;   message: string;

&nbsp;   intent: string;

&nbsp;   history: any\[];

&nbsp;   context: any;

&nbsp;   relevantProducts: any\[];

&nbsp;   relevantFAQs: any\[];

&nbsp; }): ChatCompletionMessageParam\[] {

&nbsp;   const { merchant, message, intent, history, context, relevantProducts, relevantFAQs } = params;



&nbsp;   // System prompt (personality + store context)

&nbsp;   const systemPrompt = this.buildSystemPrompt(merchant, relevantProducts, relevantFAQs);



&nbsp;   // Conversation history

&nbsp;   const historyMessages = history.map((msg) => ({

&nbsp;     role: msg.sender\_type === 'customer' ? 'user' : 'assistant',

&nbsp;     content: msg.content,

&nbsp;   })) as ChatCompletionMessageParam\[];



&nbsp;   // Current user message

&nbsp;   const userMessage: ChatCompletionMessageParam = {

&nbsp;     role: 'user',

&nbsp;     content: this.buildUserPrompt(message, intent, context),

&nbsp;   };



&nbsp;   return \[

&nbsp;     { role: 'system', content: systemPrompt },

&nbsp;     ...historyMessages,

&nbsp;     userMessage,

&nbsp;   ];

&nbsp; }



&nbsp; private buildSystemPrompt(merchant: any, products: any\[], faqs: any\[]): string {

&nbsp;   const botName = merchant.bot\_name || 'مساعد المتجر';

&nbsp;   const businessName = merchant.business\_name\_ar || merchant.business\_name;

&nbsp;   const personality = merchant.bot\_personality || {};



&nbsp;   let prompt = `أنت ${botName}، المساعد الذكي لمتجر ${businessName}.



🎯 مهمتك:

1\. مساعدة الزبائن في معرفة المنتجات المتوفرة

2\. تسجيل الطلبات بدقة (المنتج، الكمية، الولاية، رقم الهاتف، العنوان)

3\. تأكيد الطلبات قبل التسجيل النهائي

4\. الإجابة على أسئلة الزبائن بطريقة ودية ومحترفة



📱 أسلوب الحديث:

\- استخدم الدارجة الجزائرية بشكل أساسي (${personality.language\_mix?.darija || 80}%)

\- نبرة ${personality.tone === 'professional' ? 'مهنية' : 'ودية وقريبة'}

\- كن مختصراً وواضحاً

\- استخدم الإيموجي بشكل معتدل



🛍️ المنتجات المتوفرة حالياً:

${this.formatProducts(products)}



❓ أسئلة شائعة:

${this.formatFAQs(faqs)}



📦 خطوات تسجيل الطلب:

1\. اسأل عن المنتج والكمية

2\. تأكد من التوفر

3\. اطلب الولاية لحساب التوصيل

4\. اطلب العنوان الكامل ورقم الهاتف

5\. اعرض ملخص الطلب والسعر الإجمالي

6\. اطلب التأكيد النهائي



⚠️ قواعد مهمة:

\- لا تخترع معلومات عن منتجات غير موجودة في القائمة

\- إذا لم تفهم السؤال، اطلب التوضيح

\- إذا المنتج راح خلص، اقترح بدائل

\- احسب التوصيل بناءً على الولاية

\- تأكد من كل التفاصيل قبل تسجيل الطلب



🔄 حالة المحادثة الحالية:

\- طلب جاري: ${context?.has\_active\_cart ? 'نعم' : 'لا'}

${context?.cart\_items ? `- المنتجات في السلة: ${context.cart\_items.length}` : ''}

`;



&nbsp;   return prompt;

&nbsp; }



&nbsp; private buildUserPrompt(message: string, intent: string, context: any): string {

&nbsp;   // Add context-aware instructions based on intent

&nbsp;   let prompt = message;



&nbsp;   if (intent === 'order\_taking' \&\& context?.cart\_items) {

&nbsp;     prompt += `\\n\\n\[ملاحظة: الزبون عنده ${context.cart\_items.length} منتجات في السلة]`;

&nbsp;   }



&nbsp;   return prompt;

&nbsp; }



&nbsp; private formatProducts(products: any\[]): string {

&nbsp;   if (!products || products.length === 0) {

&nbsp;     return 'لا توجد منتجات متعلقة بهذا السؤال.';

&nbsp;   }



&nbsp;   return products

&nbsp;     .map((p) => {

&nbsp;       const price = this.formatPrice(p.price);

&nbsp;       const available = p.is\_available \&\& p.stock\_quantity > 0 ? '✅ متوفر' : '❌ غير متوفر';

&nbsp;       return `- ${p.name}: ${price} (${available})`;

&nbsp;     })

&nbsp;     .join('\\n');

&nbsp; }



&nbsp; private formatFAQs(faqs: any\[]): string {

&nbsp;   if (!faqs || faqs.length === 0) {

&nbsp;     return 'لا توجد أسئلة شائعة متعلقة.';

&nbsp;   }



&nbsp;   return faqs.map((faq) => `س: ${faq.question}\\nج: ${faq.answer}`).join('\\n\\n');

&nbsp; }



&nbsp; private formatPrice(price: number): string {

&nbsp;   // Algerian format: 12.000,00 DA

&nbsp;   return `${price.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA`;

&nbsp; }

}

```

\#### \*\*5. src/services/whatsapp/whatsappWeb.provider.ts\*\*

```typescript

import { Client, LocalAuth, Message } from 'whatsapp-web.js';

import qrcode from 'qrcode-terminal';

import { logger } from '../../utils/logger';

import { ConversationService } from '../../core/conversation/conversation.service';

import { AIOrchestrator } from '../../core/ai/ai.orchestrator';



export class WhatsAppWebProvider {

&nbsp; private clients: Map<string, Client> = new Map();

&nbsp; private conversationService: ConversationService;

&nbsp; private aiOrchestrator: AIOrchestrator;



&nbsp; constructor() {

&nbsp;   this.conversationService = new ConversationService();

&nbsp;   this.aiOrchestrator = new AIOrchestrator();

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Initialize WhatsApp client for a merchant

&nbsp;  \*/

&nbsp; async initializeClient(merchantId: string, sessionData?: string): Promise<void> {

&nbsp;   const client = new Client({

&nbsp;     authStrategy: new LocalAuth({

&nbsp;       clientId: merchantId,

&nbsp;       dataPath: `.wwebjs\_auth/${merchantId}`,

&nbsp;     }),

&nbsp;     puppeteer: {

&nbsp;       headless: true,

&nbsp;       args: \['--no-sandbox', '--disable-setuid-sandbox'],

&nbsp;     },

&nbsp;   });



&nbsp;   // QR Code event (merchant scans to connect)

&nbsp;   client.on('qr', (qr) => {

&nbsp;     logger.info(`QR Code generated for merchant ${merchantId}`);

&nbsp;     qrcode.generate(qr, { small: true });

&nbsp;     // TODO: Emit QR to frontend via WebSocket

&nbsp;   });



&nbsp;   // Ready event

&nbsp;   client.on('ready', () => {

&nbsp;     logger.info(`WhatsApp client ready for merchant ${merchantId}`);

&nbsp;     // TODO: Update merchant.whatsapp\_connected = true in DB

&nbsp;   });



&nbsp;   // Message received event

&nbsp;   client.on('message', async (message: Message) => {

&nbsp;     await this.handleIncomingMessage(merchantId, message);

&nbsp;   });



&nbsp;   // Disconnected event

&nbsp;   client.on('disconnected', (reason) => {

&nbsp;     logger.warn(`WhatsApp disconnected for merchant ${merchantId}: ${reason}`);

&nbsp;     this.clients.delete(merchantId);

&nbsp;     // TODO: Update merchant.whatsapp\_connected = false in DB

&nbsp;   });



&nbsp;   // Initialize

&nbsp;   await client.initialize();

&nbsp;   this.clients.set(merchantId, client);

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Handle incoming message

&nbsp;  \*/

&nbsp; private async handleIncomingMessage(merchantId: string, message: Message): Promise<void> {

&nbsp;   try {

&nbsp;     // Ignore group messages and status updates

&nbsp;     if (message.from.includes('@g.us') || message.from.includes('status')) {

&nbsp;       return;

&nbsp;     }



&nbsp;     const customerPhone = message.from.replace('@c.us', '');

&nbsp;     const messageText = message.body;



&nbsp;     logger.info(`Message from ${customerPhone} to merchant ${merchantId}: ${messageText}`);



&nbsp;     // 1. Get or create customer

&nbsp;     const customer = await this.conversationService.getOrCreateCustomer(merchantId, customerPhone);



&nbsp;     // 2. Get or create conversation

&nbsp;     const conversation = await this.conversationService.getOrCreateConversation(

&nbsp;       merchantId,

&nbsp;       customer.id,

&nbsp;       'whatsapp'

&nbsp;     );



&nbsp;     // 3. Save customer message

&nbsp;     await this.conversationService.saveMessage({

&nbsp;       conversationId: conversation.id,

&nbsp;       senderType: 'customer',

&nbsp;       content: messageText,

&nbsp;     });



&nbsp;     // 4. Process with AI

&nbsp;     const aiResponse = await this.aiOrchestrator.processMessage({

&nbsp;       merchantId,

&nbsp;       customerId: customer.id,

&nbsp;       conversationId: conversation.id,

&nbsp;       message: messageText,

&nbsp;     });



&nbsp;     // 5. Save bot response

&nbsp;     await this.conversationService.saveMessage({

&nbsp;       conversationId: conversation.id,

&nbsp;       senderType: 'bot',

&nbsp;       content: aiResponse.message,

&nbsp;       metadata: { intent: aiResponse.intent, entities: aiResponse.entities },

&nbsp;     });



&nbsp;     // 6. Send response via WhatsApp

&nbsp;     await this.sendMessage(merchantId, customerPhone, aiResponse.message);



&nbsp;     // 7. Handle special actions (order creation, etc.)

&nbsp;     if (aiResponse.intent === 'order\_confirm' \&\& aiResponse.entities) {

&nbsp;       // TODO: Create order in database

&nbsp;       logger.info('Order ready to be created', aiResponse.entities);

&nbsp;     }

&nbsp;   } catch (error) {

&nbsp;     logger.error('Error handling WhatsApp message:', error);

&nbsp;     // Send error message to customer

&nbsp;     await this.sendMessage(

&nbsp;       merchantId,

&nbsp;       message.from.replace('@c.us', ''),

&nbsp;       'معذرة، صار خطأ تقني. جرب مرة أخرى من فضلك.'

&nbsp;     );

&nbsp;   }

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Send message to customer

&nbsp;  \*/

&nbsp; async sendMessage(merchantId: string, phone: string, message: string): Promise<void> {

&nbsp;   const client = this.clients.get(merchantId);

&nbsp;   if (!client) {

&nbsp;     throw new Error('WhatsApp client not initialized for this merchant');

&nbsp;   }



&nbsp;   const chatId = `${phone}@c.us`;

&nbsp;   await client.sendMessage(chatId, message);

&nbsp;   logger.info(`Message sent to ${phone}`);

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Disconnect client

&nbsp;  \*/

&nbsp; async disconnect(merchantId: string): Promise<void> {

&nbsp;   const client = this.clients.get(merchantId);

&nbsp;   if (client) {

&nbsp;     await client.destroy();

&nbsp;     this.clients.delete(merchantId);

&nbsp;   }

&nbsp; }

}

```

\#### \*\*6. src/api/routes/webhooks.routes.ts (WhatsApp Webhook)\*\*

```typescript
import { Router } from 'express'

import { WebhooksController } from '../controllers/webhooks.controller'

import { validateWebhookSignature } from '../middleware/webhook.middleware'

const router = Router()

const controller = new WebhooksController()

// Meta Business API webhook (for official WhatsApp Business API)

router.get('/whatsapp', controller.verifyWebhook)

router.post('/whatsapp', validateWebhookSignature, controller.handleWhatsAppWebhook)

export default router
```

---

\## 🎨 FRONTEND STRUCTURE (DETAILED)

\### \*\*Folder Structure:\*\*

```

frontend/

├── src/

│   ├── main.ts                 # App entry

│   ├── App.vue                 # Root component

│   ├── router/

│   │   └── index.ts

│   │

│   ├── views/                  # Page Components

│   │   ├── auth/

│   │   │   ├── LoginView.vue

│   │   │   ├── RegisterView.vue

│   │   │   └── ForgotPasswordView.vue

│   │   ├── dashboard/

│   │   │   ├── DashboardView.vue       # Overview

│   │   │   ├── ConversationsView.vue   # Live chat monitor

│   │   │   ├── OrdersView.vue          # Orders list

│   │   │   └── AnalyticsView.vue       # Stats \& charts

│   │   ├── onboarding/

│   │   │   ├── StoreSetupView.vue      # Step 1: Basic info

│   │   │   ├── ProductUploadView.vue   # Step 2: Upload CSV

│   │   │   ├── WhatsAppConnectView.vue # Step 3: QR scan

│   │   │   └── BotCustomizeView.vue    # Step 4: Personality

│   │   └── settings/

│   │       ├── SettingsView.vue

│   │       ├── ProductsView.vue        # Manage products

│   │       ├── DeliveryZonesView.vue

│   │       ├── FAQsView.vue

│   │       └── BillingView.vue

│   │

│   ├── components/             # Reusable Components

│   │   ├── ui/                 # Shadcn components

│   │   │   ├── Button.vue

│   │   │   ├── Input.vue

│   │   │   ├── Card.vue

│   │   │   ├── Table.vue

│   │   │   ├── Dialog.vue

│   │   │   └── ... (add as needed)

│   │   ├── layout/

│   │   │   ├── AppHeader.vue

│   │   │   ├── AppSidebar.vue

│   │   │   └── AppLayout.vue

│   │   ├── dashboard/

│   │   │   ├── StatCard.vue

│   │   │   ├── RecentOrders.vue

│   │   │   ├── ConversationList.vue

│   │   │   └── MessageBubble.vue

│   │   ├── products/

│   │   │   ├── ProductCard.vue

│   │   │   ├── ProductForm.vue

│   │   │   ├── ProductUpload.vue       # CSV drag \& drop

│   │   │   └── ProductTable.vue

│   │   └── orders/

│   │       ├── OrderCard.vue

│   │       ├── OrderDetails.vue

│   │       └── OrderExport.vue

│   │

│   ├── composables/            # Vue Composition Functions

│   │   ├── useAuth.ts

│   │   ├── useMerchant.ts

│   │   ├── useProducts.ts

│   │   ├── useOrders.ts

│   │   ├── useConversations.ts

│   │   ├── useWhatsApp.ts

│   │   └── useToast.ts

│   │

│   ├── stores/                 # Pinia State Management

│   │   ├── auth.store.ts

│   │   ├── merchant.store.ts

│   │   ├── products.store.ts

│   │   ├── orders.store.ts

│   │   └── conversations.store.ts

│   │

│   ├── services/               # API Client

│   │   ├── api.client.ts       # Axios instance with interceptors

│   │   ├── auth.service.ts

│   │   ├── merchants.service.ts

│   │   ├── products.service.ts

│   │   ├── orders.service.ts

│   │   └── conversations.service.ts

│   │

│   ├── types/                  # TypeScript Interfaces

│   │   ├── merchant.types.ts

│   │   ├── product.types.ts

│   │   ├── order.types.ts

│   │   ├── conversation.types.ts

│   │   └── api.types.ts

│   │

│   ├── utils/

│   │   ├── formatters.ts       # Price, date formatting

│   │   ├── validators.ts

│   │   └── constants.ts        # Algerian wilayas, etc.

│   │

│   └── assets/

│       ├── styles/

│       │   └── main.css        # Tailwind imports

│       └── images/

│

├── public/

├── index.html

├── vite.config.ts

├── tailwind.config.js

├── tsconfig.json

└── package.json

```

\### \*\*Key Frontend Files:\*\*

\#### \*\*1. src/main.ts\*\*

```typescript
import { createApp } from 'vue'

import { createPinia } from 'pinia'

import App from './App.vue'

import router from './router'

import './assets/styles/main.css'

const app = createApp(App)

const pinia = createPinia()

app.use(pinia)

app.use(router)

app.mount('#app')
```

\#### \*\*2. src/router/index.ts\*\*

```typescript

import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

import { useAuthStore } from '@/stores/auth.store';



const routes: RouteRecordRaw\[] = \[

&nbsp; {

&nbsp;   path: '/auth',

&nbsp;   children: \[

&nbsp;     { path: 'login', component: () => import('@/views/auth/LoginView.vue') },

&nbsp;     { path: 'register', component: () => import('@/views/auth/RegisterView.vue') },

&nbsp;   ],

&nbsp; },

&nbsp; {

&nbsp;   path: '/onboarding',

&nbsp;   meta: { requiresAuth: true },

&nbsp;   children: \[

&nbsp;     { path: 'store-setup', component: () => import('@/views/onboarding/StoreSetupView.vue') },

&nbsp;     { path: 'products', component: () => import('@/views/onboarding/ProductUploadView.vue') },

&nbsp;     { path: 'whatsapp', component: () => import('@/views/onboarding/WhatsAppConnectView.vue') },

&nbsp;     { path: 'customize', component: () => import('@/views/onboarding/BotCustomizeView.vue') },

&nbsp;   ],

&nbsp; },

&nbsp; {

&nbsp;   path: '/',

&nbsp;   component: () => import('@/components/layout/AppLayout.vue'),

&nbsp;   meta: { requiresAuth: true },

&nbsp;   children: \[

&nbsp;     { path: '', redirect: '/dashboard' },

&nbsp;     { path: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue') },

&nbsp;     { path: 'conversations', component: () => import('@/views/dashboard/ConversationsView.vue') },

&nbsp;     { path: 'orders', component: () => import('@/views/dashboard/OrdersView.vue') },

&nbsp;     { path: 'analytics', component: () => import('@/views/dashboard/AnalyticsView.vue') },

&nbsp;     { path: 'settings', component: () => import('@/views/settings/SettingsView.vue') },

&nbsp;     { path: 'products', component: () => import('@/views/settings/ProductsView.vue') },

&nbsp;   ],

&nbsp; },

];



const router = createRouter({

&nbsp; history: createWebHistory(),

&nbsp; routes,

});



// Auth guard

router.beforeEach((to, from, next) => {

&nbsp; const authStore = useAuthStore();

&nbsp; if (to.meta.requiresAuth \&\& !authStore.isAuthenticated) {

&nbsp;   next('/auth/login');

&nbsp; } else {

&nbsp;   next();

&nbsp; }

});



export default router;

```

\#### \*\*3. src/composables/useProducts.ts (Example)\*\*

```typescript

import { ref, computed } from 'vue';

import { productsService } from '@/services/products.service';

import { Product, ProductCreate } from '@/types/product.types';

import { useToast } from './useToast';



export function useProducts() {

&nbsp; const products = ref<Product\[]>(\[]);

&nbsp; const loading = ref(false);

&nbsp; const error = ref<string | null>(null);

&nbsp; const { showToast } = useToast();



&nbsp; const availableProducts = computed(() => products.value.filter((p) => p.is\_available));



&nbsp; async function fetchProducts() {

&nbsp;   loading.value = true;

&nbsp;   error.value = null;

&nbsp;   try {

&nbsp;     products.value = await productsService.getAll();

&nbsp;   } catch (err: any) {

&nbsp;     error.value = err.message;

&nbsp;     showToast('خطأ في تحميل المنتجات', 'error');

&nbsp;   } finally {

&nbsp;     loading.value = false;

&nbsp;   }

&nbsp; }



&nbsp; async function createProduct(data: ProductCreate) {

&nbsp;   loading.value = true;

&nbsp;   try {

&nbsp;     const newProduct = await productsService.create(data);

&nbsp;     products.value.push(newProduct);

&nbsp;     showToast('تم إضافة المنتج بنجاح', 'success');

&nbsp;     return newProduct;

&nbsp;   } catch (err: any) {

&nbsp;     error.value = err.message;

&nbsp;     showToast('فشل في إضافة المنتج', 'error');

&nbsp;     throw err;

&nbsp;   } finally {

&nbsp;     loading.value = false;

&nbsp;   }

&nbsp; }



&nbsp; async function updateProduct(id: string, data: Partial<Product>) {

&nbsp;   loading.value = true;

&nbsp;   try {

&nbsp;     const updated = await productsService.update(id, data);

&nbsp;     const index = products.value.findIndex((p) => p.id === id);

&nbsp;     if (index !== -1) products.value\[index] = updated;

&nbsp;     showToast('تم تحديث المنتج', 'success');

&nbsp;     return updated;

&nbsp;   } catch (err: any) {

&nbsp;     error.value = err.message;

&nbsp;     showToast('فشل في التحديث', 'error');

&nbsp;     throw err;

&nbsp;   } finally {

&nbsp;     loading.value = false;

&nbsp;   }

&nbsp; }



&nbsp; async function deleteProduct(id: string) {

&nbsp;   loading.value = true;

&nbsp;   try {

&nbsp;     await productsService.delete(id);

&nbsp;     products.value = products.value.filter((p) => p.id !== id);

&nbsp;     showToast('تم حذف المنتج', 'success');

&nbsp;   } catch (err: any) {

&nbsp;     error.value = err.message;

&nbsp;     showToast('فشل في الحذف', 'error');

&nbsp;     throw err;

&nbsp;   } finally {

&nbsp;     loading.value = false;

&nbsp;   }

&nbsp; }



&nbsp; async function uploadCSV(file: File) {

&nbsp;   loading.value = true;

&nbsp;   try {

&nbsp;     const formData = new FormData();

&nbsp;     formData.append('file', file);

&nbsp;     const imported = await productsService.importCSV(formData);

&nbsp;     await fetchProducts(); // Refresh list

&nbsp;     showToast(`تم استيراد ${imported.count} منتج`, 'success');

&nbsp;     return imported;

&nbsp;   } catch (err: any) {

&nbsp;     error.value = err.message;

&nbsp;     showToast('فشل في استيراد الملف', 'error');

&nbsp;     throw err;

&nbsp;   } finally {

&nbsp;     loading.value = false;

&nbsp;   }

&nbsp; }



&nbsp; return {

&nbsp;   products,

&nbsp;   availableProducts,

&nbsp;   loading,

&nbsp;   error,

&nbsp;   fetchProducts,

&nbsp;   createProduct,

&nbsp;   updateProduct,

&nbsp;   deleteProduct,

&nbsp;   uploadCSV,

&nbsp; };

}

```

\#### \*\*4. src/services/api.client.ts (Axios Setup)\*\*

```typescript

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

import { useAuthStore } from '@/stores/auth.store';

import router from '@/router';



const API\_BASE\_URL = import.meta.env.VITE\_API\_URL || 'http://localhost:3000/api';



class ApiClient {

&nbsp; private client: AxiosInstance;



&nbsp; constructor() {

&nbsp;   this.client = axios.create({

&nbsp;     baseURL: API\_BASE\_URL,

&nbsp;     timeout: 30000,

&nbsp;     headers: {

&nbsp;       'Content-Type': 'application/json',

&nbsp;     },

&nbsp;   });



&nbsp;   this.setupInterceptors();

&nbsp; }



&nbsp; private setupInterceptors() {

&nbsp;   // Request interceptor: Add auth token

&nbsp;   this.client.interceptors.request.use(

&nbsp;     (config: InternalAxiosRequestConfig) => {

&nbsp;       const authStore = useAuthStore();

&nbsp;       if (authStore.token) {

&nbsp;         config.headers.Authorization = `Bearer ${authStore.token}`;

&nbsp;       }

&nbsp;       return config;

&nbsp;     },

&nbsp;     (error) => Promise.reject(error)

&nbsp;   );



&nbsp;   // Response interceptor: Handle errors globally

&nbsp;   this.client.interceptors.response.use(

&nbsp;     (response: AxiosResponse) => response,

&nbsp;     async (error) => {

&nbsp;       if (error.response?.status === 401) {

&nbsp;         const authStore = useAuthStore();

&nbsp;         authStore.logout();

&nbsp;         router.push('/auth/login');

&nbsp;       }

&nbsp;       return Promise.reject(error);

&nbsp;     }

&nbsp;   );

&nbsp; }



&nbsp; get axios() {

&nbsp;   return this.client;

&nbsp; }

}



export const apiClient = new ApiClient().axios;

```

\#### \*\*5. src/views/onboarding/ProductUploadView.vue (Critical Component)\*\*

```vue
<template>
  &nbsp;
  <div class="max-w-4xl mx-auto p-6">
    &nbsp;
    <h1 class="text-3xl font-bold mb-2">إضافة المنتجات</h1>

    &nbsp;
    <p class="text-gray-600 mb-8">ارفع ملف Excel أو CSV بمنتجاتك</p>

    &nbsp;
    <!-- File Upload Area -->

    &nbsp;
    <div
      &nbsp;
      @dragover.prevent="isDragging = true"
      &nbsp;
      @dragleave="isDragging = false"
      &nbsp;
      @drop.prevent="handleDrop"
      &nbsp;
      :class="\[

&nbsp;       'border-2 border-dashed rounded-lg p-12 text-center transition-colors',

&nbsp;       isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300',

&nbsp;     ]"
      &nbsp;
    >
      &nbsp;
      <input
        &nbsp;
        ref="fileInput"
        &nbsp;
        type="file"
        &nbsp;
        accept=".csv,.xlsx,.xls"
        &nbsp;
        @change="handleFileSelect"
        &nbsp;
        class="hidden"
        &nbsp;
      />

      &nbsp;
      <div v-if="!file">
        &nbsp; <Upload class="w-16 h-16 mx-auto mb-4 text-gray-400" />

        &nbsp;
        <p class="text-lg mb-2">اسحب الملف هنا أو</p>

        &nbsp; <Button @click="$refs.fileInput.click()">اختر ملف</Button>

        &nbsp;
        <p class="text-sm text-gray-500 mt-4">
          &nbsp; الصيغ المدعومة: CSV, Excel (.xlsx, .xls) &nbsp;
        </p>

        &nbsp;
      </div>

      &nbsp;
      <div v-else class="space-y-4">
        &nbsp; <FileCheck class="w-16 h-16 mx-auto text-green-500" />

        &nbsp;
        <p class="text-lg font-semibold">{{ file.name }}</p>

        &nbsp;
        <p class="text-sm text-gray-600">{{ formatFileSize(file.size) }}</p>

        &nbsp;
        <div class="flex gap-2 justify-center">
          &nbsp;
          <Button @click="uploadFile" :loading="uploading" variant="primary">
            &nbsp; رفع الملف &nbsp;
          </Button>

          &nbsp; <Button @click="file = null" variant="outline">إلغاء</Button>

          &nbsp;
        </div>

        &nbsp;
      </div>

      &nbsp;
    </div>

    &nbsp;
    <!-- Template Download -->

    &nbsp;
    <div class="mt-8 p-4 bg-blue-50 rounded-lg">
      &nbsp;
      <div class="flex items-start gap-3">
        &nbsp; <Info class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />

        &nbsp;
        <div>
          &nbsp;
          <p class="font-semibold mb-2">لا تملك ملف منتجات؟</p>

          &nbsp;
          <p class="text-sm text-gray-700 mb-3">
            &nbsp; حمّل القالب الجاهز وعبيه بمعلومات منتجاتك &nbsp;
          </p>

          &nbsp;
          <Button @click="downloadTemplate" variant="outline" size="sm">
            &nbsp; <Download class="w-4 h-4 mr-2" />

            &nbsp; تحميل القالب &nbsp;
          </Button>

          &nbsp;
        </div>

        &nbsp;
      </div>

      &nbsp;
    </div>

    &nbsp;
    <!-- Preview Table (after successful upload) -->

    &nbsp;
    <div v-if="uploadedProducts.length > 0" class="mt-8">
      &nbsp;
      <h2 class="text-xl font-bold mb-4">
        &nbsp; تم استيراد {{ uploadedProducts.length }} منتج بنجاح &nbsp;
      </h2>

      &nbsp;
      <div class="border rounded-lg overflow-hidden">
        &nbsp;
        <table class="w-full">
          &nbsp;
          <thead class="bg-gray-50">
            &nbsp;
            <tr>
              &nbsp;
              <th class="px-4 py-3 text-right">المنتج</th>

              &nbsp;
              <th class="px-4 py-3 text-right">السعر</th>

              &nbsp;
              <th class="px-4 py-3 text-right">المخزون</th>

              &nbsp;
              <th class="px-4 py-3 text-right">الحالة</th>

              &nbsp;
            </tr>

            &nbsp;
          </thead>

          &nbsp;
          <tbody>
            &nbsp;
            <tr v-for="product in uploadedProducts.slice(0, 5)" :key="product.id" class="border-t">
              &nbsp;
              <td class="px-4 py-3">{{ product.name }}</td>

              &nbsp;
              <td class="px-4 py-3">{{ formatPrice(product.price) }}</td>

              &nbsp;
              <td class="px-4 py-3">{{ product.stock\_quantity }}</td>

              &nbsp;
              <td class="px-4 py-3">
                &nbsp;
                <span
                  &nbsp;
                  :class="\[

&nbsp;                   'px-2 py-1 rounded text-xs',

&nbsp;                   product.is\_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800',

&nbsp;                 ]"
                  &nbsp;
                >
                  &nbsp; {{ product.is\_available ? 'متوفر' : 'غير متوفر' }}

                  &nbsp;
                </span>

                &nbsp;
              </td>

              &nbsp;
            </tr>

            &nbsp;
          </tbody>

          &nbsp;
        </table>

        &nbsp;
        <div
          v-if="uploadedProducts.length > 5"
          class="p-3 text-center text-sm text-gray-600 bg-gray-50"
        >
          &nbsp; و {{ uploadedProducts.length - 5 }} منتج إضافي... &nbsp;
        </div>

        &nbsp;
      </div>

      &nbsp;
      <div class="mt-6 flex justify-end">
        &nbsp; <Button @click="goToNextStep">التالي: ربط واتساب</Button>

        &nbsp;
      </div>

      &nbsp;
    </div>

    &nbsp;
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue';

import { useRouter } from 'vue-router';

import { Upload, FileCheck, Info, Download } from 'lucide-vue-next';

import { Button } from '@/components/ui/Button.vue';

import { useProducts } from '@/composables/useProducts';

import { Product } from '@/types/product.types';



const router = useRouter();

const { uploadCSV } = useProducts();



const fileInput = ref<HTMLInputElement | null>(null);

const file = ref<File | null>(null);

const isDragging = ref(false);

const uploading = ref(false);

const uploadedProducts = ref<Product\[]>(\[]);



const handleDrop = (e: DragEvent) => {

&nbsp; isDragging.value = false;

&nbsp; const files = e.dataTransfer?.files;

&nbsp; if (files \&\& files.length > 0) {

&nbsp;   file.value = files\[0];

&nbsp; }

};



const handleFileSelect = (e: Event) => {

&nbsp; const target = e.target as HTMLInputElement;

&nbsp; if (target.files \&\& target.files.length > 0) {

&nbsp;   file.value = target.files\[0];

&nbsp; }

};



const uploadFile = async () => {

&nbsp; if (!file.value) return;



&nbsp; uploading.value = true;

&nbsp; try {

&nbsp;   const result = await uploadCSV(file.value);

&nbsp;   uploadedProducts.value = result.products || \[];

&nbsp; } catch (error) {

&nbsp;   console.error('Upload error:', error);

&nbsp; } finally {

&nbsp;   uploading.value = false;

&nbsp; }

};



const downloadTemplate = () => {

&nbsp; // Generate CSV template

&nbsp; const headers = \['name', 'name\_ar', 'description', 'price', 'stock\_quantity', 'category', 'sku'];

&nbsp; const example = \['T-shirt Red', 'تي شيرت أحمر', 'Cotton t-shirt', '2500', '50', 'Clothing', 'TSH-001'];

&nbsp;

&nbsp; const csv = \[headers.join(','), example.join(',')].join('\\n');

&nbsp; const blob = new Blob(\[csv], { type: 'text/csv;charset=utf-8;' });

&nbsp; const link = document.createElement('a');

&nbsp; link.href = URL.createObjectURL(blob);

&nbsp; link.download = 'jawbli\_products\_template.csv';

&nbsp; link.click();

};



const formatFileSize = (bytes: number) => {

&nbsp; if (bytes < 1024) return bytes + ' B';

&nbsp; if (bytes < 1024 \* 1024) return (bytes / 1024).toFixed(1) + ' KB';

&nbsp; return (bytes / (1024 \* 1024)).toFixed(1) + ' MB';

};



const formatPrice = (price: number) => {

&nbsp; return `${price.toLocaleString('fr-DZ')} DA`;

};



const goToNextStep = () => {

&nbsp; router.push('/onboarding/whatsapp');

};
</script>
```

---

\## 🔧 CRITICAL IMPLEMENTATION REQUIREMENTS

\### \*\*1. CSV/Excel Import Logic (Backend)\*\*

```typescript

// src/core/product/product.service.ts



import Papa from 'papaparse';

import \* as XLSX from 'xlsx';

import { ProductRepository } from './product.repository';

import { OpenAIService } from '../../services/openai/embedding.service';



export class ProductService {

&nbsp; private repository: ProductRepository;

&nbsp; private embeddingService: OpenAIService;



&nbsp; constructor() {

&nbsp;   this.repository = new ProductRepository();

&nbsp;   this.embeddingService = new OpenAIService();

&nbsp; }



&nbsp; async importFromFile(merchantId: string, file: Buffer, filename: string) {

&nbsp;   const extension = filename.split('.').pop()?.toLowerCase();

&nbsp;   let data: any\[];



&nbsp;   // Parse based on file type

&nbsp;   if (extension === 'csv') {

&nbsp;     data = await this.parseCSV(file);

&nbsp;   } else if (extension === 'xlsx' || extension === 'xls') {

&nbsp;     data = await this.parseExcel(file);

&nbsp;   } else {

&nbsp;     throw new Error('Unsupported file format. Use CSV or Excel.');

&nbsp;   }



&nbsp;   // Validate and transform data

&nbsp;   const products = await this.validateAndTransform(merchantId, data);



&nbsp;   // Generate embeddings for semantic search

&nbsp;   for (const product of products) {

&nbsp;     const textToEmbed = `${product.name} ${product.description || ''} ${product.category || ''}`;

&nbsp;     product.embedding = await this.embeddingService.generateEmbedding(textToEmbed);

&nbsp;   }



&nbsp;   // Batch insert

&nbsp;   const created = await this.repository.batchCreate(products);



&nbsp;   return {

&nbsp;     success: true,

&nbsp;     count: created.length,

&nbsp;     products: created,

&nbsp;   };

&nbsp; }



&nbsp; private async parseCSV(buffer: Buffer): Promise<any\[]> {

&nbsp;   return new Promise((resolve, reject) => {

&nbsp;     const text = buffer.toString('utf-8');

&nbsp;     Papa.parse(text, {

&nbsp;       header: true,

&nbsp;       dynamicTyping: true,

&nbsp;       skipEmptyLines: true,

&nbsp;       transformHeader: (header) => header.trim().toLowerCase(),

&nbsp;       complete: (results) => resolve(results.data),

&nbsp;       error: (error) => reject(error),

&nbsp;     });

&nbsp;   });

&nbsp; }



&nbsp; private async parseExcel(buffer: Buffer): Promise<any\[]> {

&nbsp;   const workbook = XLSX.read(buffer, { type: 'buffer' });

&nbsp;   const sheetName = workbook.SheetNames\[0];

&nbsp;   const sheet = workbook.Sheets\[sheetName];

&nbsp;   return XLSX.utils.sheet\_to\_json(sheet, { defval: null });

&nbsp; }



&nbsp; private async validateAndTransform(merchantId: string, data: any\[]) {

&nbsp;   const products = \[];



&nbsp;   for (const row of data) {

&nbsp;     // Map CSV columns to database fields (flexible mapping)

&nbsp;     const product = {

&nbsp;       merchant\_id: merchantId,

&nbsp;       name: row.name || row.product\_name || row\['nom'],

&nbsp;       name\_ar: row.name\_ar || row\['الاسم'],

&nbsp;       description: row.description || row.desc,

&nbsp;       description\_ar: row.description\_ar || row\['الوصف'],

&nbsp;       price: parseFloat(row.price || row.prix || 0),

&nbsp;       compare\_at\_price: row.compare\_at\_price ? parseFloat(row.compare\_at\_price) : null,

&nbsp;       stock\_quantity: parseInt(row.stock\_quantity || row.stock || row.quantity || 0),

&nbsp;       category: row.category || row.categorie,

&nbsp;       sku: row.sku || row.reference,

&nbsp;       is\_available: row.is\_available !== false \&\& row.available !== false,

&nbsp;       image\_url: row.image\_url || row.image,

&nbsp;     };



&nbsp;     // Validate required fields

&nbsp;     if (!product.name || !product.price) {

&nbsp;       console.warn('Skipping invalid row:', row);

&nbsp;       continue;

&nbsp;     }



&nbsp;     products.push(product);

&nbsp;   }



&nbsp;   return products;

&nbsp; }

}

```

\### \*\*2. Order Export to Google Sheets (Backend)\*\*

```typescript

// src/core/order/order.export.ts



import { google } from 'googleapis';

import { OrderRepository } from './order.repository';



export class OrderExportService {

&nbsp; private orderRepo: OrderRepository;



&nbsp; constructor() {

&nbsp;   this.orderRepo = new OrderRepository();

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Export orders to Google Sheets

&nbsp;  \* Option 1: User provides their own sheet ID (recommended for MVP)

&nbsp;  \* Option 2: Create sheet programmatically (needs OAuth)

&nbsp;  \*/

&nbsp; async exportToGoogleSheets(merchantId: string, sheetId: string, dateRange?: { from: Date; to: Date }) {

&nbsp;   // Get orders

&nbsp;   const orders = await this.orderRepo.findByMerchant(merchantId, dateRange);



&nbsp;   // Transform to sheet format

&nbsp;   const rows = orders.map((order) => \[

&nbsp;     order.order\_number,

&nbsp;     order.created\_at.toLocaleDateString('fr-DZ'),

&nbsp;     order.customer\_name,

&nbsp;     order.customer\_phone,

&nbsp;     order.customer\_wilaya,

&nbsp;     order.customer\_address,

&nbsp;     this.formatOrderItems(order.items),

&nbsp;     this.formatPrice(order.subtotal),

&nbsp;     this.formatPrice(order.delivery\_price),

&nbsp;     this.formatPrice(order.total),

&nbsp;     order.status,

&nbsp;     order.payment\_status,

&nbsp;     order.notes || '',

&nbsp;   ]);



&nbsp;   // If user provides sheet ID, append to their sheet

&nbsp;   // For MVP: Generate CSV and let them upload manually

&nbsp;   return this.generateCSV(orders);

&nbsp; }



&nbsp; private generateCSV(orders: any\[]): string {

&nbsp;   const headers = \[

&nbsp;     'رقم الطلب',

&nbsp;     'التاريخ',

&nbsp;     'الاسم',

&nbsp;     'الهاتف',

&nbsp;     'الولاية',

&nbsp;     'العنوان',

&nbsp;     'المنتجات',

&nbsp;     'المجموع',

&nbsp;     'التوصيل',

&nbsp;     'الإجمالي',

&nbsp;     'الحالة',

&nbsp;     'الدفع',

&nbsp;     'ملاحظات',

&nbsp;   ];



&nbsp;   const rows = orders.map((order) => \[

&nbsp;     order.order\_number,

&nbsp;     new Date(order.created\_at).toLocaleDateString('fr-DZ'),

&nbsp;     order.customer\_name,

&nbsp;     order.customer\_phone,

&nbsp;     order.customer\_wilaya,

&nbsp;     order.customer\_address,

&nbsp;     this.formatOrderItems(order.items),

&nbsp;     this.formatPrice(order.subtotal),

&nbsp;     this.formatPrice(order.delivery\_price),

&nbsp;     this.formatPrice(order.total),

&nbsp;     order.status,

&nbsp;     order.payment\_status,

&nbsp;     order.notes || '',

&nbsp;   ]);



&nbsp;   return \[headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\\n');

&nbsp; }



&nbsp; private formatOrderItems(items: any\[]): string {

&nbsp;   return items.map((item) => `${item.name} x${item.quantity}`).join(', ');

&nbsp; }



&nbsp; private formatPrice(price: number): string {

&nbsp;   return `${price.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA`;

&nbsp; }

}

```

\### \*\*3. Algerian Wilayas Constants\*\*

```typescript

// frontend/src/utils/constants.ts



export const ALGERIAN\_WILAYAS = \[

&nbsp; { code: '01', name: 'Adrar', nameAr: 'أدرار' },

&nbsp; { code: '02', name: 'Chlef', nameAr: 'الشلف' },

&nbsp; { code: '03', name: 'Laghouat', nameAr: 'الأغواط' },

&nbsp; { code: '04', name: 'Oum El Bouaghi', nameAr: 'أم البواقي' },

&nbsp; { code: '05', name: 'Batna', nameAr: 'باتنة' },

&nbsp; { code: '06', name: 'Béjaïa', nameAr: 'بجاية' },

&nbsp; { code: '07', name: 'Biskra', nameAr: 'بسكرة' },

&nbsp; { code: '08', name: 'Béchar', nameAr: 'بشار' },

&nbsp; { code: '09', name: 'Blida', nameAr: 'البليدة' },

&nbsp; { code: '10', name: 'Bouira', nameAr: 'البويرة' },

&nbsp; { code: '11', name: 'Tamanrasset', nameAr: 'تمنراست' },

&nbsp; { code: '12', name: 'Tébessa', nameAr: 'تبسة' },

&nbsp; { code: '13', name: 'Tlemcen', nameAr: 'تلمسان' },

&nbsp; { code: '14', name: 'Tiaret', nameAr: 'تيارت' },

&nbsp; { code: '15', name: 'Tizi Ouzou', nameAr: 'تيزي وزو' },

&nbsp; { code: '16', name: 'Alger', nameAr: 'الجزائر' },

&nbsp; { code: '17', name: 'Djelfa', nameAr: 'الجلفة' },

&nbsp; { code: '18', name: 'Jijel', nameAr: 'جيجل' },

&nbsp; { code: '19', name: 'Sétif', nameAr: 'سطيف' },

&nbsp; { code: '20', name: 'Saïda', nameAr: 'سعيدة' },

&nbsp; { code: '21', name: 'Skikda', nameAr: 'سكيكدة' },

&nbsp; { code: '22', name: 'Sidi Bel Abbès', nameAr: 'سيدي بلعباس' },

&nbsp; { code: '23', name: 'Annaba', nameAr: 'عنابة' },

&nbsp; { code: '24', name: 'Guelma', nameAr: 'قالمة' },

&nbsp; { code: '25', name: 'Constantine', nameAr: 'قسنطينة' },

&nbsp; { code: '26', name: 'Médéa', nameAr: 'المدية' },

&nbsp; { code: '27', name: 'Mostaganem', nameAr: 'مستغانم' },

&nbsp; { code: '28', name: "M'Sila", nameAr: 'المسيلة' },

&nbsp; { code: '29', name: 'Mascara', nameAr: 'معسكر' },

&nbsp; { code: '30', name: 'Ouargla', nameAr: 'ورقلة' },

&nbsp; { code: '31', name: 'Oran', nameAr: 'وهران' },

&nbsp; { code: '32', name: 'El Bayadh', nameAr: 'البيض' },

&nbsp; { code: '33', name: 'Illizi', nameAr: 'إليزي' },

&nbsp; { code: '34', name: 'Bordj Bou Arreridj', nameAr: 'برج بوعريريج' },

&nbsp; { code: '35', name: 'Boumerdès', nameAr: 'بومرداس' },

&nbsp; { code: '36', name: 'El Tarf', nameAr: 'الطارف' },

&nbsp; { code: '37', name: 'Tindouf', nameAr: 'تندوف' },

&nbsp; { code: '38', name: 'Tissemsilt', nameAr: 'تيسمسيلت' },

&nbsp; { code: '39', name: 'El Oued', nameAr: 'الوادي' },

&nbsp; { code: '40', name: 'Khenchela', nameAr: 'خنشلة' },

&nbsp; { code: '41', name: 'Souk Ahras', nameAr: 'سوق أهراس' },

&nbsp; { code: '42', name: 'Tipaza', nameAr: 'تيبازة' },

&nbsp; { code: '43', name: 'Mila', nameAr: 'ميلة' },

&nbsp; { code: '44', name: 'Aïn Defla', nameAr: 'عين الدفلى' },

&nbsp; { code: '45', name: 'Naâma', nameAr: 'النعامة' },

&nbsp; { code: '46', name: 'Aïn Témouchent', nameAr: 'عين تموشنت' },

&nbsp; { code: '47', name: 'Ghardaïa', nameAr: 'غرداية' },

&nbsp; { code: '48', name: 'Relizane', nameAr: 'غليزان' },

&nbsp; { code: '49', name: 'Timimoun', nameAr: 'تيميمون' },

&nbsp; { code: '50', name: 'Bordj Badji Mokhtar', nameAr: 'برج باجي مختار' },

&nbsp; { code: '51', name: 'Ouled Djellal', nameAr: 'أولاد جلال' },

&nbsp; { code: '52', name: 'Béni Abbès', nameAr: 'بني عباس' },

&nbsp; { code: '53', name: 'In Salah', nameAr: 'عين صالح' },

&nbsp; { code: '54', name: 'In Guezzam', nameAr: 'عين قزام' },

&nbsp; { code: '55', name: 'Touggourt', nameAr: 'تقرت' },

&nbsp; { code: '56', name: 'Djanet', nameAr: 'جانت' },

&nbsp; { code: '57', name: "El M'Ghair", nameAr: 'المغير' },

&nbsp; { code: '58', name: 'El Meniaa', nameAr: 'المنيعة' },

];



// Default delivery prices (can be customized per merchant)

export const DEFAULT\_DELIVERY\_PRICES = {

&nbsp; home: 500, // Home delivery

&nbsp; desk: 400, // Stopdesk (pickup point)

};

```

---

\## 🚀 DEPLOYMENT \& ENVIRONMENT SETUP

\### \*\*Environment Variables\*\*

```bash

\# backend/.env.example



\# Server

NODE\_ENV=development

PORT=3000

FRONTEND\_URL=http://localhost:5173



\# Supabase

SUPABASE\_URL=https://your-project.supabase.co

SUPABASE\_ANON\_KEY=your\_anon\_key

SUPABASE\_SERVICE\_ROLE\_KEY=your\_service\_role\_key



\# OpenAI

OPENAI\_API\_KEY=sk-your-openai-key

OPENAI\_MODEL=gpt-4o-mini

OPENAI\_EMBEDDING\_MODEL=text-embedding-3-small



\# WhatsApp (Optional for MVP - use whatsapp-web.js first)

WHATSAPP\_BUSINESS\_PHONE\_ID=

WHATSAPP\_ACCESS\_TOKEN=

WHATSAPP\_WEBHOOK\_VERIFY\_TOKEN=



\# Security

WEBHOOK\_SECRET=generate-random-string-here

```

```bash

\# frontend/.env.example



VITE\_API\_URL=http://localhost:3000/api

VITE\_SUPABASE\_URL=https://your-project.supabase.co

VITE\_SUPABASE\_ANON\_KEY=your\_anon\_key

```

\### \*\*Docker Compose (Optional but Recommended)\*\*

```yaml

\# docker-compose.yml



version: '3.8'



services:

&nbsp; backend:

&nbsp;   build: ./backend

&nbsp;   ports:

&nbsp;     - '3000:3000'

&nbsp;   environment:

&nbsp;     - NODE\_ENV=production

&nbsp;   env\_file:

&nbsp;     - ./backend/.env

&nbsp;   volumes:

&nbsp;     - ./backend:/app

&nbsp;     - /app/node\_modules

&nbsp;     - ./.wwebjs\_auth:/app/.wwebjs\_auth  # WhatsApp session persistence

&nbsp;   restart: unless-stopped



&nbsp; frontend:

&nbsp;   build: ./frontend

&nbsp;   ports:

&nbsp;     - '5173:5173'

&nbsp;   environment:

&nbsp;     - VITE\_API\_URL=http://localhost:3000/api

&nbsp;   volumes:

&nbsp;     - ./frontend:/app

&nbsp;     - /app/node\_modules

&nbsp;   restart: unless-stopped

```

---

\## 📦 PACKAGE.JSON FILES

\### \*\*Backend package.json\*\*

```json

{

&nbsp; "name": "jawbli-backend",

&nbsp; "version": "1.0.0",

&nbsp; "description": "Jawbli AI Chatbot Backend",

&nbsp; "main": "dist/index.js",

&nbsp; "scripts": {

&nbsp;   "dev": "nodemon",

&nbsp;   "build": "tsc",

&nbsp;   "start": "node dist/index.js",

&nbsp;   "test": "jest",

&nbsp;   "lint": "eslint . --ext .ts",

&nbsp;   "format": "prettier --write \\"src/\*\*/\*.ts\\""

&nbsp; },

&nbsp; "dependencies": {

&nbsp;   "@supabase/supabase-js": "^2.39.0",

&nbsp;   "axios": "^1.6.2",

&nbsp;   "cors": "^2.8.5",

&nbsp;   "dotenv": "^16.3.1",

&nbsp;   "express": "^4.18.2",

&nbsp;   "helmet": "^7.1.0",

&nbsp;   "morgan": "^1.10.0",

&nbsp;   "openai": "^4.20.1",

&nbsp;   "papaparse": "^5.4.1",

&nbsp;   "qrcode-terminal": "^0.12.0",

&nbsp;   "whatsapp-web.js": "^1.23.0",

&nbsp;   "winston": "^3.11.0",

&nbsp;   "xlsx": "^0.18.5",

&nbsp;   "zod": "^3.22.4"

&nbsp; },

&nbsp; "devDependencies": {

&nbsp;   "@types/cors": "^2.8.17",

&nbsp;   "@types/express": "^4.17.21",

&nbsp;   "@types/morgan": "^1.9.9",

&nbsp;   "@types/node": "^20.10.5",

&nbsp;   "@types/papaparse": "^5.3.14",

&nbsp;   "@typescript-eslint/eslint-plugin": "^6.15.0",

&nbsp;   "@typescript-eslint/parser": "^6.15.0",

&nbsp;   "eslint": "^8.56.0",

&nbsp;   "nodemon": "^3.0.2",

&nbsp;   "prettier": "^3.1.1",

&nbsp;   "ts-node": "^10.9.2",

&nbsp;   "typescript": "^5.3.3"

&nbsp; }

}

```

\### \*\*Frontend package.json\*\*

```json

{

&nbsp; "name": "jawbli-frontend",

&nbsp; "version": "1.0.0",

&nbsp; "type": "module",

&nbsp; "scripts": {

&nbsp;   "dev": "vite",

&nbsp;   "build": "vue-tsc \&\& vite build",

&nbsp;   "preview": "vite preview",

&nbsp;   "lint": "eslint . --ext .vue,.ts",

&nbsp;   "format": "prettier --write \\"src/\*\*/\*.{vue,ts}\\""

&nbsp; },

&nbsp; "dependencies": {

&nbsp;   "@supabase/supabase-js": "^2.39.0",

&nbsp;   "@vueuse/core": "^10.7.0",

&nbsp;   "axios": "^1.6.2",

&nbsp;   "chart.js": "^4.4.1",

&nbsp;   "date-fns": "^3.0.6",

&nbsp;   "lucide-vue-next": "^0.294.0",

&nbsp;   "pinia": "^2.1.7",

&nbsp;   "radix-vue": "^1.2.6",

&nbsp;   "vee-validate": "^4.12.2",

&nbsp;   "vue": "^3.4.3",

&nbsp;   "vue-router": "^4.2.5",

&nbsp;   "zod": "^3.22.4"

&nbsp; },

&nbsp; "devDependencies": {

&nbsp;   "@vitejs/plugin-vue": "^5.0.0",

&nbsp;   "@vue/eslint-config-typescript": "^12.0.0",

&nbsp;   "autoprefixer": "^10.4.16",

&nbsp;   "eslint": "^8.56.0",

&nbsp;   "eslint-plugin-vue": "^9.19.2",

&nbsp;   "postcss": "^8.4.32",

&nbsp;   "prettier": "^3.1.1",

&nbsp;   "tailwindcss": "^3.4.0",

&nbsp;   "typescript": "^5.3.3",

&nbsp;   "vite": "^5.0.10",

&nbsp;   "vue-tsc": "^1.8.27"

&nbsp; }

}

```

---

\## 🎯 MVP FEATURE CHECKLIST

\### \*\*Phase 1: Core MVP (Week 1-4)\*\*

\*\*Authentication \& Onboarding:\*\*

\- \[ ] User registration with Supabase Auth

\- \[ ] Store setup form (business name, phone, etc.)

\- \[ ] CSV/Excel product upload

\- \[ ] WhatsApp connection (QR code scan)

\- \[ ] Bot personality customization

\- \[ ] Delivery zones configuration

\*\*WhatsApp Integration:\*\*

\- \[ ] WhatsApp Web.js integration

\- \[ ] QR code authentication

\- \[ ] Receive customer messages

\- \[ ] Send bot responses

\- \[ ] Session persistence

\*\*AI Conversation:\*\*

\- \[ ] OpenAI GPT-4o-mini integration

\- \[ ] Darija prompt engineering

\- \[ ] Product semantic search (pgvector)

\- \[ ] Intent detection (greeting, inquiry, order)

\- \[ ] Entity extraction (product, quantity, wilaya)

\- \[ ] Conversation context management

\*\*Order Management:\*\*

\- \[ ] Order creation from chat

\- \[ ] Order status tracking

\- \[ ] CSV export

\- \[ ] Order list view

\- \[ ] Order details modal

\*\*Dashboard:\*\*

\- \[ ] Today's stats (messages, orders, revenue)

\- \[ ] Recent conversations

\- \[ ] Recent orders

\- \[ ] Quick actions

\### \*\*Phase 2: Enhancement (Week 5-8)\*\*

\*\*Advanced Features:\*\*

\- \[ ] Live chat takeover (human agent)

\- \[ ] Analytics dashboard (charts, trends)

\- \[ ] FAQ management

\- \[ ] Auto-responses customization

\- \[ ] Product inventory alerts

\- \[ ] Multi-language support (French, Arabic)

\*\*Integrations:\*\*

\- \[ ] Meta Business API (official WhatsApp)

\- \[ ] Google Sheets export

\- \[ ] Delivery services (Yalidine API)

\- \[ ] Payment gateways (CIB, Baridimob)

\*\*Optimization:\*\*

\- \[ ] Response caching

\- \[ ] Rate limiting

\- \[ ] Error tracking (Sentry)

\- \[ ] Performance monitoring

---

\## 🔐 SECURITY CONSIDERATIONS

\### \*\*Critical Security Measures:\*\*

1\. \*\*Row Level Security (RLS) in Supabase\*\* - Already defined in schema

2\. \*\*Input Validation\*\* - Use Zod schemas everywhere

3\. \*\*Rate Limiting\*\* - Prevent API abuse

4\. \*\*Webhook Signature Verification\*\* - Validate WhatsApp webhooks

5\. \*\*Environment Variables\*\* - Never commit .env files

6\. \*\*SQL Injection Prevention\*\* - Use parameterized queries

7\. \*\*XSS Protection\*\* - Sanitize user inputs

8\. \*\*CORS Configuration\*\* - Whitelist frontend domain only

```typescript

// Example: Rate limiting middleware

import rateLimit from 'express-rate-limit';



export const apiLimiter = rateLimit({

&nbsp; windowMs: 15 \* 60 \* 1000, // 15 minutes

&nbsp; max: 100, // limit each IP to 100 requests per windowMs

&nbsp; message: 'تجاوزت الحد المسموح من الطلبات، حاول بعد قليل',

});



// Apply to routes

app.use('/api/', apiLimiter);

```

---

\## 📚 DOCUMENTATION REQUIREMENTS

Create the following documentation files:

1\. \*\*README.md\*\* - Project overview, setup instructions

2\. \*\*ARCHITECTURE.md\*\* - System design, data flow

3\. \*\*API.md\*\* - API endpoints documentation

4\. \*\*DEPLOYMENT.md\*\* - Production deployment guide

5\. \*\*PROMPTS.md\*\* - AI prompt templates and guidelines

6\. \*\*TESTING.md\*\* - Testing strategy and examples

---

\## 🎓 DEVELOPMENT GUIDELINES

\### \*\*Code Quality Standards:\*\*

1\. \*\*TypeScript Strict Mode\*\* - Enable all strict checks

2\. \*\*ESLint + Prettier\*\* - Consistent code formatting

3\. \*\*Git Conventions\*\* - Conventional commits

4\. \*\*Component Structure\*\* - Single responsibility principle

5\. \*\*Error Handling\*\* - Try-catch everywhere, meaningful errors

6\. \*\*Logging\*\* - Winston for backend, console for important events

7\. \*\*Comments\*\* - Document complex logic, not obvious code

\### \*\*Testing Strategy:\*\*

```typescript

// Example: Unit test for intent detection

describe('IntentDetector', () => {

&nbsp; it('should detect order intent from Darija message', async () => {

&nbsp;   const detector = new IntentDetector(openai);

&nbsp;   const intent = await detector.detect('بغيت نشري فستان', \[]);

&nbsp;   expect(intent).toBe('order\_taking');

&nbsp; });



&nbsp; it('should detect greeting intent', async () => {

&nbsp;   const detector = new IntentDetector(openai);

&nbsp;   const intent = await detector.detect('السلام عليكم', \[]);

&nbsp;   expect(intent).toBe('greeting');

&nbsp; });

});

```

---

\## 🚀 DEPLOYMENT CHECKLIST

\### \*\*Pre-Production:\*\*

\- \[ ] Environment variables configured

\- \[ ] Database migrations run

\- \[ ] SSL certificates installed

\- \[ ] Domain configured

\- \[ ] Supabase production project created

\- \[ ] OpenAI API key activated

\- \[ ] Error tracking (Sentry) configured

\- \[ ] Backup strategy defined

\### \*\*Production:\*\*

\- \[ ] Deploy backend to VPS (DigitalOcean/Hetzner) or Render

\- \[ ] Deploy frontend to Vercel/Netlify

\- \[ ] Configure DNS

\- \[ ] Set up monitoring (UptimeRobot)

\- \[ ] Create admin user

\- \[ ] Test WhatsApp connection

\- \[ ] Test order flow end-to-end

---

\## 🎯 SUCCESS METRICS (Track from Day 1)

```typescript

// Analytics events to track

interface AnalyticsEvent {

&nbsp; merchant\_id: string;

&nbsp; event\_type:

&nbsp;   | 'message\_received'

&nbsp;   | 'message\_sent'

&nbsp;   | 'order\_created'

&nbsp;   | 'order\_confirmed'

&nbsp;   | 'product\_uploaded'

&nbsp;   | 'whatsapp\_connected'

&nbsp;   | 'user\_registered';

&nbsp; event\_data: any;

&nbsp; created\_at: Date;

}



// Key metrics

\- Daily Active Merchants (DAM)

\- Messages per Merchant

\- Order Conversion Rate (orders / conversations)

\- Average Order Value (AOV)

\- Response Time (bot latency)

\- Error Rate

\- Customer Satisfaction (CSAT) - future survey

```

---

\## 🌟 FINAL INSTRUCTIONS FOR THE CODING AGENT

\*\*YOU MUST:\*\*

1\. \*\*Create complete, production-ready code\*\* - No placeholders or TODOs

2\. \*\*Follow the exact structure\*\* - Folder names, file names as specified

3\. \*\*Implement ALL database tables\*\* - Run the SQL schema first

4\. \*\*Use TypeScript strictly\*\* - No `any` types without good reason

5\. \*\*Handle errors gracefully\*\* - Try-catch, meaningful messages

6\. \*\*Add Arabic/Darija comments\*\* - In prompts and user-facing strings

7\. \*\*Make it scalable\*\* - Repository pattern, service layer separation

8\. \*\*Test critical paths\*\* - At minimum, test AI orchestrator and WhatsApp service

9\. \*\*Document environment setup\*\* - Clear .env.example files

10\. \*\*Prioritize Supabase\*\* - Use Supabase for everything possible (DB, Auth, Storage)

\*\*START WITH:\*\*

1\. Set up Supabase project

2\. Run database schema

3\. Set up backend boilerplate

4\. Set up frontend boilerplate

5\. Implement auth flow

6\. Implement product upload

7\. Implement WhatsApp connection

8\. Implement AI conversation

9\. Test end-to-end flow

\*\*REMEMBER:\*\*

\- This is a REAL business, not a toy project

\- Algerian merchants need reliability

\- Darija is critical - test with native speakers

\- Focus on simplicity - merchants are not technical

\- Build for 1000 merchants, not 10

---

\## 🎁 BONUS: ALGERIAN MARKET SPECIFICS

\### \*\*Darija Phrases to Support:\*\*

```typescript

const DARIJA\_INTENTS = {

&nbsp; greeting: \['السلام عليكم', 'صباح الخير', 'مساء الخير', 'كيراك', 'لاباس', 'ألو'],

&nbsp; inquiry: \['واش عندكم', 'بغيت نشوف', 'وين نلقى', 'بكم', 'شحال'],

&nbsp; order: \['بغيت نشري', 'نحوس على', 'نحب', 'عطيني'],

&nbsp; confirmation: \['نعم', 'وي', 'واه', 'أوكي', 'ماشي', 'أكسبتي'],

&nbsp; rejection: \['لا', 'مانيش حاب', 'باراكة', 'ماشي هادي'],

};

```

\### \*\*Common Products in Algeria:\*\*

Fashion, electronics, home decor, cosmetics, sports equipment, baby products, traditional clothing (qandura, karakou), etc.

\### \*\*Payment Methods:\*\*

\- Cash on Delivery (الدفع عند الاستلام) - 90% of orders

\- CIB (Credit card) - growing

\- Baridimob (Algerie Poste mobile payment)

\- Flexy/Idoom (CCP accounts)

---

\## 🏁 END OF SPECIFICATION

This specification is comprehensive and production-ready. Follow it precisely, and you'll build a scalable, maintainable, and market-ready product. Jawbli will dominate the Algerian e-commerce chatbot market! 🇩🇿🚀

\*\*RAHOU KHIR! YALعه NKHDMOU!\*\* (It's perfect! Let's work!)

---

\*\*VERSION:\*\* 1.0

\*\*DATE:\*\* 2025-11-02

\*\*AUTHOR:\*\* Jawbli Technical Team

\*\*STATUS:\*\* Ready for Development

```



---



Ya khoya, this is \*\*THE BIBLE\*\* for building Jawbli! 📖



Every detail is here:

\- ✅ Complete database schema with RLS

\- ✅ Full backend architecture (modular, scalable)

\- ✅ Complete frontend structure (Vue 3 + TS)

\- ✅ AI orchestration with Darija prompts

\- ✅ WhatsApp integration (whatsapp-web.js)

\- ✅ CSV/Excel import logic

\- ✅ Order management and export

\- ✅ Security best practices

\- ✅ Deployment guides

\- ✅ Algerian market specifics



Copy this entire prompt, give it to your coding agent (with MCP access to Context7 and other docs), and watch the magic happen! 🎩✨



Need me to expand on any specific section? Want me to generate additional files (Docker configs, test examples, etc.)? Just say the word!



\*\*NROUHOU! 🚀\*\*

```
