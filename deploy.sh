#!/bin/bash

# PersonalBestie Deployment Script
# Usage: ./deploy.sh [environment]
# Environments: development, staging, production

set -e

ENVIRONMENT=${1:-development}
PROJECT_NAME="pe-be"

echo "🚀 Deploying $PROJECT_NAME to $ENVIRONMENT environment..."

# Validate environment
case $ENVIRONMENT in
    development|staging|production)
        echo "✅ Environment: $ENVIRONMENT"
        ;;
    *)
        echo "❌ Invalid environment. Use: development, staging, or production"
        exit 1
        ;;
esac

# Check if required files exist
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please update .env with your configuration"
    else
        echo "❌ .env.example not found"
        exit 1
    fi
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "🔍 Checking service health..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running"
    
    # Show running services
    echo "📋 Running services:"
    docker-compose ps
    
    # Show application URLs
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:8000"
    echo "   Database: postgresql://localhost:5432/pe_be"
    
    # Run database migrations if in production
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "🗄️  Running database migrations..."
        docker-compose exec backend alembic upgrade head
    fi
    
    echo ""
    echo "🎉 Deployment to $ENVIRONMENT completed successfully!"
    
else
    echo "❌ Some services failed to start"
    docker-compose logs
    exit 1
fi