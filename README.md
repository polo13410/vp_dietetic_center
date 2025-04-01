# VP Dietetic Center

A comprehensive web application for managing dietetic patients, appointments, and food journals.

## Project Structure

This is a monorepo containing:

- **Backend**: Node.js + TypeScript with AWS SAM for serverless deployment
- **Frontend**: Next.js application with static export for S3 hosting
- **Infrastructure**: Terraform code for AWS resources

## Prerequisites

- Node.js (v16+)
- PNPM (v7+)
- AWS CLI
- AWS SAM CLI
- Terraform

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd vp_dietetic_center

# Install dependencies
pnpm install
```

## Development

```bash
# Run both frontend and backend in development mode
pnpm dev

# Run only backend
cd packages/backend
pnpm dev

# Run only frontend
cd packages/frontend
pnpm dev
```

## Building for Production

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/frontend
pnpm build
```

## Deployment

### Backend Deployment (AWS SAM)

```bash
pnpm deploy:backend
```

### Frontend Deployment (S3 via Terraform)

```bash
pnpm deploy:frontend
```

### Full Deployment

```bash
pnpm deploy:all
```

## Infrastructure

Infrastructure is managed with Terraform:

```bash
cd infrastructure
pnpm init    # Initialize Terraform
pnpm plan    # Plan infrastructure changes
pnpm apply   # Apply infrastructure changes
```

## Features

- **Authentication**: Secure login for dietitians and patients
- **Patient Management**: Track and manage patient information, metrics, and progress
- **Food Journal**: Patients can log their meals and dietitians can review them
- **Appointment Scheduling**: Manage appointments with calendar integration
- **Data Visualization**: Charts and graphs for tracking patient progress
- **Settings**: Configure application parameters and preferences

## License

[MIT](LICENSE)
