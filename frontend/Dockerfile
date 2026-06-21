# build stage
FROM node:lts-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE

RUN npm run build

# production stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]