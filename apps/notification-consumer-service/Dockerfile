FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json

RUN npm i -g prisma

RUN npm i

COPY libs libs
COPY apps/notification-consumer-service apps/notification-consumer-service

RUN npx prisma generate --schema=apps/notification-consumer-service/src/prisma/schema/schema.prisma
RUN npm run build notification-consumer-service

CMD ["npm", "start:dev", "notification-consumer-service"]

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install -g prisma

RUN npm install
COPY apps/notification-consumer-service/src/prisma/schema/schema.prisma apps/notification-consumer-service/src/prisma/schema/schema.prisma
RUN npx prisma generate --schema=apps/notification-consumer-service/src/prisma/schema/schema.prisma
RUN npm prune --prod

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/notification-consumer-service/main"]




