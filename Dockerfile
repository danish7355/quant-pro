# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies including devDependencies for the build process
COPY package*.json ./
RUN npm install

# Copy source code and build the application
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the built application and firebase config from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Set permissions and expose the port
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
