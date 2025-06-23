FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json

RUN npm i

COPY libs libs
COPY apps/notification-consumer-service apps/notification-consumer-service

RUN npm run build notification-consumer-service

CMD ["npm", "start:dev", "notification-consumer-service"]

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --prod pm2

COPY --from=development /usr/src/app/dist ./dist

CMD ["pm2-runtime", "--name", "notification-consumer-service", "dist/apps/notification-consumer-service/main.js", "-i", "max"]  




