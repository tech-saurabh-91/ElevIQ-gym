FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=5000
EXPOSE 5000
CMD ["node", "dist/src/index.js"]
