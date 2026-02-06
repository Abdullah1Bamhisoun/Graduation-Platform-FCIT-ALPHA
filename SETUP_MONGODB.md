# MongoDB Setup Guide for GPP Platform

## What Was Configured

I've successfully linked MongoDB to your Graduation Project Platform. Here's what was set up:

### 1. Docker Compose Configuration ([docker-compose.yml](docker-compose.yml))
Created a complete Docker Compose setup with:
- **MongoDB 7.0** - Main database (port 27017)
- **Redis 7** - For job queues with BullMQ (port 6379)
- **MinIO** - S3-compatible file storage (ports 9000, 9001)
- **App Container** - Node.js development environment

### 2. Environment Configuration ([server/.env](server/.env))
Created environment file with all necessary configuration:
- MongoDB connection string: `mongodb://mongodb:27017/gpp-fcit`
- Redis connection details
- MinIO/S3 storage settings
- JWT authentication settings
- Email/SMTP settings (to be configured)

### 3. Dev Container Integration ([.devcontainer/devcontainer.json](.devcontainer/devcontainer.json))
Updated to use Docker Compose, with:
- All services automatically started
- Port forwarding configured
- All VS Code extensions pre-installed

### 4. Connection Test Script ([server/test-connection.js](server/test-connection.js))
Added a script to verify MongoDB connection

## How to Get Started

### Step 1: Rebuild Your Dev Container

Since we updated the devcontainer configuration, you need to rebuild:

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type: "Dev Containers: Rebuild Container"
3. Wait for the container to rebuild (this will start all services)

### Step 2: Install Dependencies

After rebuild, install the server dependencies:

```bash
cd server
npm install
```

### Step 3: Test MongoDB Connection

Run the test script to verify MongoDB is working:

```bash
cd server
npm run test:db
```

You should see: ✅ MongoDB connected successfully!

### Step 4: Start the Server

```bash
# In the server directory
npm run dev
```

The server will connect to MongoDB automatically on startup.

## Accessing Services

After rebuilding, you can access:

- **Frontend**: http://localhost:3000 or http://localhost:5173
- **Backend API**: http://localhost:5000
- **MongoDB**: mongodb://localhost:27017 (use MongoDB Compass or VS Code extension)
- **MinIO Console**: http://localhost:9001 (login: minioadmin / minioadmin123)
- **Redis**: localhost:6379

## MongoDB VS Code Extension

The MongoDB VS Code extension is already installed. To connect:

1. Click the MongoDB icon in the sidebar
2. Click "Add Connection"
3. Use connection string: `mongodb://localhost:27017`

## Troubleshooting

### Services not starting?
```bash
# Check running containers
docker ps

# View logs
docker compose logs mongodb
docker compose logs redis
docker compose logs minio
```

### Connection refused?
- Make sure you rebuilt the dev container
- Check that services are running: `docker compose ps`
- Verify .env file has correct settings

### Need to reset data?
```bash
# Stop and remove volumes
docker compose down -v

# Start fresh
docker compose up -d
```

## Next Steps

1. **Configure Email Settings**: Update SMTP settings in [server/.env](server/.env) for email functionality
2. **Change JWT Secret**: Update `JWT_SECRET` in production
3. **Create Initial Data**: Run any seed scripts to populate initial data
4. **Test API Endpoints**: Use Thunder Client extension to test your API

## Database Connection Details

- **Database Name**: gpp-fcit
- **Connection String**: `mongodb://mongodb:27017/gpp-fcit`
- **Default Port**: 27017
- **Data Persistence**: Yes (Docker volume: `mongodb_data`)

Your MongoDB is now fully integrated with the GPP platform! 🎉
