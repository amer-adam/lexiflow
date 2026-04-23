FROM node:lts-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4556
CMD ["node", "index.js"]