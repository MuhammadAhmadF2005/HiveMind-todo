FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies required to compile native modules like bcrypt
RUN apk add --no-cache python3 make g++ dumb-init

# Copy package files
COPY package*.json ./

# Install dependencies (this will now compile bcrypt for Linux)
RUN npm install

# Copy application code
COPY . .

# Remove build dependencies to keep the image slim
RUN apk del python3 make g++

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Run based on NODE_ENV
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then node index.js; else npx nodemon index.js; fi"]