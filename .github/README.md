# CI/CD Pipeline Documentation

This repository uses GitHub Actions for automated testing, building, and deployment.

## 🚀 Workflows Overview

### 1. Frontend CI/CD (`frontend.yml`)
**Triggers:** Push/PR to `main` or `develop` with frontend changes

**Jobs:**
- **Test**: Linting, type checking, unit tests with coverage
- **Build**: Create production build artifacts
- **Deploy Staging**: Auto-deploy to staging on `develop` branch
- **Deploy Production**: Auto-deploy to production on `main` branch

### 2. Backend CI/CD (`backend.yml`)
**Triggers:** Push/PR to `main` or `develop` with backend changes

**Jobs:**
- **Test**: Run pytest with PostgreSQL, generate coverage
- **Security Scan**: Bandit security analysis
- **Build**: Create wheel package and Docker image
- **Deploy Staging**: Auto-deploy to staging on `develop` branch  
- **Deploy Production**: Auto-deploy to production on `main` branch

### 3. PR Validation (`pr-validation.yml`)
**Triggers:** All pull requests

**Jobs:**
- **Changes Detection**: Identify which parts of codebase changed
- **PR Validation**: Semantic PR titles, security checks
- **Integration Tests**: Full stack testing when both frontend/backend change

### 4. Dependency Updates (`dependency-update.yml`)
**Triggers:** Weekly schedule (Mondays 9 AM UTC) + manual dispatch

**Jobs:**
- **Frontend Updates**: Auto-update npm dependencies
- **Backend Updates**: Auto-update Poetry dependencies
- Creates PRs for review

### 5. Release (`release.yml`)
**Triggers:** Git tags starting with `v*`

**Jobs:**
- **Create Release**: Generate GitHub release with changelog
- **Build & Package**: Create release artifacts (frontend build, Docker image)
- **Deploy Production**: Deploy tagged release to production

## 🔧 Setup Requirements

### Environment Variables
Set these in your GitHub repository settings:

```
GITHUB_TOKEN  # Automatically provided by GitHub
```

### Branch Protection Rules
Configure these for `main` branch:
- Require status checks to pass before merging
- Require up-to-date branches before merging
- Include administrators

### Environments
Create these environments in GitHub Settings:
- `staging` - For development deployments
- `production` - For production deployments

## 📝 Development Workflow

### For Feature Development:
1. Create feature branch from `develop`
2. Make changes and push
3. Create PR to `develop`
4. CI runs validation and tests
5. After approval, merge to `develop`
6. Auto-deployment to staging occurs

### For Production Release:
1. Create PR from `develop` to `main`
2. CI runs full validation
3. After approval, merge to `main`
4. Auto-deployment to production occurs
5. Tag release with `git tag v1.0.0` for formal releases

### For Hotfixes:
1. Create hotfix branch from `main`
2. Make critical fixes
3. Create PR to `main`
4. After approval, merge and tag

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
- **Trigger**: Automatic on `develop` branch merges
- **Purpose**: Pre-production testing and validation
- **URL**: Configure your staging URL

### Production Environment
- **Trigger**: Automatic on `main` branch merges
- **Purpose**: Live application serving users
- **URL**: Configure your production URL

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

1. **For staging**: Edit the "Deploy to staging" steps in workflows
2. **For production**: Edit the "Deploy to production" steps in workflows

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