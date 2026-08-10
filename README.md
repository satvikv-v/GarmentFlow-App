# GarmentFlow

### AI-Powered Garment Manufacturing Management Platform

GarmentFlow is a premium full-stack factory management system designed specifically for the garment manufacturing and textile industry.

It brings production, inventory, orders, suppliers, workers, dispatch, and AI-assisted operational intelligence into a single platform.

**Built with React, TypeScript, FastAPI, Python, PostgreSQL, and machine-learning components.**

---

## Overview

GarmentFlow is built to provide a unified operational view of a garment manufacturing facility.

Instead of managing production, inventory, workforce, suppliers, orders, and dispatch through disconnected workflows, GarmentFlow brings these operations together into one centralized system.

The platform combines operational data with AI-assisted analysis to help factory teams identify production risks, anticipate material requirements, and prioritize upcoming work.

### What GarmentFlow manages

* **Orders** — Track customer orders and their production lifecycle.
* **Production** — Manage production batches across manufacturing stages.
* **Inventory** — Monitor fabrics, threads, buttons, zippers, labels, and packaging.
* **Workers** — Track workers, departments, skills, and assignments.
* **Suppliers** — Manage supplier information and reliability.
* **Dispatch** — Track completed batches, invoices, couriers, and delivery status.
* **AI Intelligence** — Assist with delay prediction, inventory forecasting, and production prioritization.

---

## Core Modules

### Authentication & Role-Based Access Control

GarmentFlow uses JWT-based authentication with role-based authorization.

Supported roles include:

* Owner
* Production Manager
* Inventory Manager
* Sales Executive

Each role is designed around the responsibilities and access requirements of the corresponding operational function.

### Factory Dashboard

The dashboard provides a centralized snapshot of factory operations, including:

* Active orders
* Orders approaching deadlines
* Delayed production batches
* Pending dispatches
* Factory efficiency
* Inventory health
* Low-stock materials

### Production Management

Production batches are tracked across dedicated manufacturing stages:

**Cutting → Stitching → Embroidery → Printing → Quality Check**

The system provides visibility into batch progress and production-stage bottlenecks.

### Inventory Management

The inventory system tracks essential manufacturing materials including:

* Fabric
* Thread
* Buttons
* Zippers
* Labels
* Packaging

It maintains current stock levels, minimum stock thresholds, and purchase information to help identify low-stock conditions.

### Worker Management

The Workers module tracks:

* Worker information
* Departments
* Skills
* Active status
* Production assignments

### Supplier Management

The Suppliers module centralizes vendor information and provides visibility into supplier relationships and reliability.

### Orders

Orders can be tracked throughout their lifecycle and connected to the corresponding production workflows.

### Dispatch & Logistics

Completed production batches can move into the dispatch workflow, where the system tracks:

* Invoices
* Courier assignments
* Dispatch dates
* Delivery status

---

## AI Intelligence

GarmentFlow includes an AI-assisted intelligence layer designed to support manufacturing decisions using operational data.

### Delay Risk Prediction

Production batches can be evaluated for potential schedule risk based on production-stage conditions and bottlenecks.

Risk indicators help factory managers identify batches that may require attention before deadlines are missed.

### Inventory Forecasting

The platform forecasts upcoming material requirements using active and upcoming production demand.

This provides a forward-looking view of expected material requirements and helps identify potential inventory shortages.

### Production Recommendations

The Recommendations Engine evaluates upcoming orders using operational factors such as:

* Order urgency
* Fabric availability
* Current production capacity
* Production constraints

Orders are then ranked to help production teams determine which work should receive priority.

> The intelligence layer is designed as decision support for factory operations rather than as a replacement for human planning.

---

## Technology Stack

### Frontend

| Technology     | Purpose                                |
| -------------- | -------------------------------------- |
| React          | Component-based user interface         |
| TypeScript     | Type-safe frontend development         |
| Vite           | Frontend development and build tooling |
| React Router   | Client-side routing                    |
| TanStack Query | Server-state management and caching    |
| Lucide React   | Interface icons                        |
| Tailwind CSS   | Styling and responsive UI              |

### Backend

| Technology | Purpose                      |
| ---------- | ---------------------------- |
| Python     | Backend development          |
| FastAPI    | REST API framework           |
| PostgreSQL | Relational database          |
| SQLAlchemy | ORM and database interaction |
| Alembic    | Database migrations          |
| JWT        | Authentication               |
| bcrypt     | Password hashing             |

### Intelligence Layer

| Component                  | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| Delay Risk Prediction      | Identify potentially delayed production batches |
| Inventory Forecasting      | Estimate upcoming material requirements         |
| Production Recommendations | Prioritize orders using operational constraints |

---

## Architecture

GarmentFlow follows a modular full-stack architecture.

```text
React + TypeScript + Vite
          |
          | REST API
          v
FastAPI + Python
          |
     +----+----+
     |         |
     v         v
PostgreSQL   AI Intelligence
SQLAlchemy   - Delay Prediction
Alembic      - Inventory Forecasting
             - Production Recommendations
```

### Frontend

The frontend is a React and TypeScript single-page application organized around reusable components, page-level modules, custom hooks, centralized API utilities, and protected routes.

### Backend

The backend is built with FastAPI and follows a modular structure separating:

* API routes
* Authentication and security
* Database access
* SQLAlchemy models
* Request and response schemas
* Business services
* Machine-learning components

### Database

PostgreSQL serves as the primary relational database.

SQLAlchemy handles ORM-based database interaction, while Alembic manages database schema migrations.

### Intelligence Layer

The intelligence layer is integrated with the backend and operates on manufacturing data to provide:

* Production delay-risk signals
* Inventory forecasts
* Order prioritization recommendations

---

## Project Structure

```text
GarmentFlow-App/
│
├── backend/
│   ├── alembic/
│   │   └── versions/
│   │
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── database/
│   │   ├── ml/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   │
│   ├── scripts/
│   ├── requirements.txt
│   ├── seed.py
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   └── garment and factory imagery
│   │
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   └── types/
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.ts
│
├── .gitignore
├── LICENSE
└── README.md
```

### Backend organization

| Directory   | Responsibility                                    |
| ----------- | ------------------------------------------------- |
| `api/`      | REST API routes and endpoints                     |
| `core/`     | Authentication, JWT, security, and configuration  |
| `database/` | Database connection and session management        |
| `models/`   | SQLAlchemy database models                        |
| `schemas/`  | API request and response schemas                  |
| `services/` | Business logic and application services           |
| `ml/`       | Prediction, forecasting, and recommendation logic |
| `scripts/`  | Development and database utilities                |

### Frontend organization

| Directory     | Responsibility                                    |
| ------------- | ------------------------------------------------- |
| `components/` | Reusable UI components                            |
| `hooks/`      | Data-fetching and application hooks               |
| `lib/`        | API, authentication, image mapping, and utilities |
| `pages/`      | Application screens and route-level views         |
| `types/`      | Shared TypeScript types                           |
| `public/`     | Garment, factory, and interface imagery           |

---

## Installation & Setup

### Prerequisites

Make sure the following are installed:

* Python 3.x
* Node.js and npm
* PostgreSQL
* Git

### 1. Clone the Repository

```bash
git clone https://github.com/satvikv-v/GarmentFlow-App.git
cd GarmentFlow-App
```

### 2. Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```powershell
venv\Scripts\activate
```

On macOS/Linux:

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a local environment file:

```text
backend/.env
```

Use `backend/.env.example` as the template.

Example:

```env
DATABASE_URL=postgresql+psycopg2://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME
SECRET_KEY=your-long-random-secret-here
TEST_PASSWORD=your-local-test-password
```

**Never commit your `.env` file or real credentials to GitHub.**

### 4. Configure PostgreSQL

Create the PostgreSQL database specified in your `DATABASE_URL`.

Then run the database migrations:

```bash
alembic upgrade head
```

### 5. Seed Development Data

Set a local development password through your environment:

```env
TEST_PASSWORD=your-local-test-password
```

Then run:

```bash
python seed.py
```

This populates the development database with sample operational data across the major GarmentFlow modules.

### 6. Start the Backend

From the `backend` directory:

```bash
uvicorn app.main:app --reload
```

The FastAPI backend will start on the local development server.

### 7. Frontend Setup

Open a new terminal and navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will display the local development URL in the terminal.

### Running the Full Application

For local development, run both services simultaneously.

**Terminal 1 — Backend**

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

The frontend communicates with the FastAPI backend through the configured API endpoint.

---

## Screenshots

GarmentFlow uses a clean, modern operational interface that combines factory management workflows with editorial-style garment and manufacturing imagery.

### Dashboard

![GarmentFlow Dashboard](frontend/public/screenshots/dashboard.png)

### Production

![GarmentFlow Production](frontend/public/screenshots/production.png)

### Inventory

![GarmentFlow Inventory](frontend/public/screenshots/inventory.png)

### Recommendations

![GarmentFlow Recommendations](frontend/public/screenshots/recommendations.png)

### Orders & Detail Views

![GarmentFlow Orders](frontend/public/screenshots/orders.png)

### Workers

![GarmentFlow Workers](frontend/public/screenshots/workers.png)

### Suppliers

![GarmentFlow Suppliers](frontend/public/screenshots/suppliers.png)
---

## Security & Configuration

GarmentFlow keeps sensitive configuration outside the repository.

### Environment Variables

Local secrets and credentials should be stored in:

```text
backend/.env
```

The repository only includes:

```text
backend/.env.example
```

as a safe configuration template.

Sensitive values such as the following should never be committed:

* Database credentials
* JWT signing secrets
* API keys
* Local passwords
* Authentication credentials

The `.gitignore` configuration excludes environment files and other sensitive local configuration from version control.

### Authentication Security

GarmentFlow uses:

* JWT-based authentication
* bcrypt password hashing
* Role-based authorization
* Protected frontend routes

Development credentials should always be supplied through local environment variables rather than hard-coded into application source code.

> **Security note:** The credentials shown in `.env.example` are placeholders. Configure your own local values before running the application.

---

## Roadmap

The current version of GarmentFlow establishes the core factory-management workflow. Future development can extend the platform with:

* [ ] Real-time operational notifications
* [ ] Advanced production analytics
* [ ] Historical forecasting dashboards
* [ ] Automated supplier recommendations
* [ ] Production capacity simulation
* [ ] Advanced workforce analytics
* [ ] Automated dispatch optimization
* [ ] Multi-factory support
* [ ] Cloud deployment
* [ ] Audit logging
* [ ] Automated report generation
* [ ] Expanded AI decision-support capabilities

---

## Project Highlights

* Full-stack application built around a real-world manufacturing workflow
* Modular FastAPI backend with SQLAlchemy and PostgreSQL
* React and TypeScript single-page application
* JWT authentication with role-based access control
* Production batch and stage tracking
* Inventory and supplier management
* AI-assisted delay prediction
* Inventory forecasting
* Constraint-aware production recommendations
* Clean, modern operational interface with integrated garment and factory imagery
* Editorial garment and factory imagery integrated into the application
* Database migrations managed with Alembic
* Environment-based configuration for sensitive credentials

---

## License

This project is licensed under the MIT License.

See the `LICENSE` file for more information.
