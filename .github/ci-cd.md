# CI/CD Pipeline Documentation

This repository uses GitHub Actions for automated testing, packaging, and deployment support.

The deployment model is in transition after the migration from Render-hosted backend infrastructure to a Hetzner VPS. CI is active today, production VPS deployment is supported today through a manual GitHub Actions workflow, and fuller automatic deployment from `main` is an upcoming feature rather than the current state.

## 🚀 Workflows Overview

### 1. Frontend CI/CD (`frontend.yml`)
**Triggers:** Push/PR to `main` or `develop` with frontend changes

**Jobs:**
- **Test**: Linting, type checking, unit tests with coverage
- **Build**: Create production build artifacts
- **Deploy Staging**: Placeholder job on `develop`
- **Deploy Production**: Placeholder job on `main`

### 2. Backend CI/CD (`backend.yml`)
**Triggers:** Push/PR to `main` or `develop` with backend changes

**Jobs:**
- **Test**: Run pytest with PostgreSQL, generate coverage
- **Security Scan**: Bandit security analysis on pushes to `main`/`develop`
- **Build**: Create wheel package and Docker image on pushes to `main`/`develop`

### 3. VPS Deployment (`deploy-vps.yml`)
**Triggers:** Manual dispatch only

**Jobs:**
- **Deploy to Production VPS**: Sync repo contents to the Hetzner VPS, write production env config, build containers, run Alembic migrations, restart services, and refresh `systemd` timers for recurring jobs

### 4. Frontend E2E (`e2e.yml`)
**Triggers:** Pull requests to `main` or `develop` with frontend/backend changes, plus manual dispatch

**Jobs:**
- **E2E**: Boot backend + frontend and run Playwright tests

### 5. PR Validation (`pr-validation.yml`)
**Triggers:** All pull requests

**Jobs:**
- **Changes Detection**: Identify which parts of codebase changed
- **PR Validation**: Semantic PR titles, security checks
- **Integration Tests**: Full stack testing when both frontend/backend change

### 6. Dependency Updates (`dependency-update.yml`)
**Triggers:** Weekly schedule (Mondays 9 AM UTC) + manual dispatch

**Jobs:**
- **Frontend Updates**: Auto-update npm dependencies
- **Backend Updates**: Auto-update uv dependencies
- Creates PRs for review

### 7. Release (`release.yml`)
**Triggers:** Git tags starting with `v*`

**Jobs:**
- **Create Release**: Generate GitHub release with changelog
- **Build & Package**: Create release artifacts (frontend build, Docker image)
- **Deploy Production**: Placeholder release-stage job for future production automation

## 🔧 Setup Requirements

### Environment Variables
Set these in your GitHub repository settings:

```
GITHUB_TOKEN  # Automatically provided by GitHub
```

Optional repository variable for moving heavy jobs off GitHub-hosted minutes:

```
HEAVY_RUNNER_LABELS_JSON='["self-hosted","linux","x64","hetzner"]'
```

When that variable is set and the matching runner is registered on the VPS, the heavy Playwright and Docker jobs use the self-hosted runner. When it is unset, they fall back to `ubuntu-latest`.

### Branch Protection Rules
Configure these for `main` branch:
- Require status checks to pass before merging
- Require up-to-date branches before merging
- Include administrators

### Environments
Create these environments in GitHub Settings:
- `production` - Used by VPS deployment and release workflows

## 📝 Development Workflow

### For Feature Development:
1. Create feature branch from `develop`
2. Make changes and push
3. Create PR to `develop`
4. CI runs validation and tests
5. After approval, merge to `develop`
6. Staging deployment remains a placeholder in GitHub Actions today

### For Production Release:
1. Create PR from `develop` to `main`
2. CI runs full validation
3. After approval, merge to `main`
4. Production deployment is currently triggered manually through `deploy-vps.yml`
5. Automatic deployment from `main` is an upcoming feature
6. Tag release with `git tag v1.0.0` for formal releases and packaged artifacts

### For Hotfixes:
1. Create hotfix branch from `main`
2. Make critical fixes
3. Create PR to `main`
4. After approval, merge
5. Run the VPS deployment workflow manually if production rollout is needed immediately
6. Tag if you want a formal release artifact

## 🧪 Testing Strategy

### Frontend Tests
- **Unit Tests**: Vitest with React Testing Library
- **Coverage**: 80% minimum threshold
- **Linting**: ESLint with React hooks plugin
- **Type Checking**: TypeScript strict mode

### Backend Tests
- **Unit Tests**: pytest with async support
- **Integration Tests**: Full database testing
- **Coverage**: 80% minimum threshold
- **Security**: Bandit static analysis

### Integration Tests
- **API Testing**: Automated endpoint validation
- **Health Checks**: Service availability verification

## 🚢 Deployment Strategy

### Staging Environment
- **State Today**: Not fully wired as a real environment in GitHub Actions
- **Purpose**: Reserved for future pre-production validation
- **Note**: Current frontend staging/production deploy jobs are placeholders

### Production Environment
- **State Today**: Production backend infrastructure runs on a Hetzner VPS
- **Trigger Today**: Manual `workflow_dispatch` via `deploy-vps.yml`
- **Upcoming**: Automatic production deployment from `main`
- **Purpose**: Live application serving users

### Rollback Strategy
- Keep previous Docker images for quick rollback
- Use GitHub Deployments API for tracking
- Monitor deployment health post-release

## 📊 Monitoring and Notifications

### Success Notifications
- Successful deployments create GitHub Deployment status
- Coverage reports uploaded to Codecov (optional)

### Failure Notifications
- Failed builds/deployments notify via GitHub notifications
- Security scan results stored as artifacts

## 🔒 Security Features

### Automated Security Scanning
- **Bandit**: Python security linting
- **Sensitive File Detection**: Prevents committing secrets
- **Dependency Vulnerability**: Weekly dependency updates

### Best Practices
- No hardcoded secrets in code
- Environment-specific configuration
- Minimal Docker image permissions

## 📚 Adding Custom Deployment

To add your specific deployment commands:

1. **For the current production VPS flow**: Edit `deploy-vps.yml`
2. **For future automated staging/production flows**: Edit the placeholder deploy steps in `frontend.yml`, `backend.yml`, or `release.yml`

Example deployment methods:
```yaml
# AWS S3 + CloudFront (Frontend)
- name: Deploy to S3
  run: aws s3 sync ./dist s3://your-bucket --delete

# Docker Registry + ECS (Backend)
- name: Deploy to ECS
  run: |
    docker tag pe-be-backend:latest your-registry/pe-be-backend:latest
    docker push your-registry/pe-be-backend:latest
    aws ecs update-service --cluster your-cluster --service your-service
```

## 🆘 Troubleshooting

### Common Issues
1. **Test Failures**: Check logs in Actions tab
2. **Build Failures**: Verify dependencies and lock files
3. **Deployment Failures**: Check environment variables and permissions

### Debug Steps
1. Check workflow logs in GitHub Actions
2. Verify all required secrets are set
3. Ensure branch protection rules allow the workflow
4. Test locally with same Node.js/Python versions
