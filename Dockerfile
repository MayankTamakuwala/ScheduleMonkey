# Use the official Node.js 22.4.1 image as the base image
FROM node:22.4.1 AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy specific files and directories into the container
COPY next-env.d.ts .
COPY next.config.mjs .
COPY package.json .
COPY package-lock.json .
COPY postcss.config.mjs .
COPY public/ ./public/
COPY src/ ./src/
COPY tailwind.config.ts .
COPY tsconfig.json .

# Build the Next.js application
RUN npm run build

# Stage 2: Production image, copy built assets and serve them
FROM node:22.4.1 AS production

# Set the working directory inside the container
WORKDIR /app

# Copy the build output and necessary files from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/node_modules ./node_modules

# Expose the port that Next.js will run on
EXPOSE 3000

# Start the Next.js application
CMD ["npm", "run", "dev"]
